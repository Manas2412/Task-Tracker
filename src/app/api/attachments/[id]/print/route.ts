import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/log';
import { prisma } from '@/lib/db';
import { sanitizeFilename, getObjectStream, isS3Configured } from '@/lib/s3';
import { buildTfVisibilityClause } from '@/lib/timeline-files';
import { buildVisibilityClauses } from '@/lib/visibility';

/**
 * GET /api/attachments/:id/print
 *
 * Streams an uploaded attachment's bytes back through THIS origin, inline, so
 * the client can load it into a hidden iframe and call `window.print()`
 * directly — the browser blocks programmatic printing of the cross-origin
 * presigned S3 URL that `/view` and `/download` redirect to. Same auth and
 * parent-visibility checks as those routes; only browser-renderable files
 * (PDFs, images) are ever requested here (the client routes Office documents to
 * their hosted viewer instead), but any uploaded object streams fine.
 *
 * Drive links are not proxied (we do not have their bytes) — the client opens
 * those in a new tab and prints from there.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  if (!/^[0-9a-f-]{36}$/i.test(params.id)) {
    return NextResponse.json({ error: 'Bad id' }, { status: 400 });
  }

  const att = await prisma.attachment.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      ownerType: true,
      ownerId: true,
      fileUrl: true,
      fileName: true,
      mimeType: true,
      source: true,
    },
  });
  if (!att) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      hierarchySlot: true,
      isSuperAdmin: true,
      divisionId: true,
      isPmu: true,
      pmuId: true,
    },
  });
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (att.ownerType === 'task' || att.ownerType === 'task_comment') {
    const visibility = await buildVisibilityClauses(me);
    const ok = await prisma.task.findFirst({
      where: { id: att.ownerId, AND: [{ OR: visibility }] },
      select: { id: true },
    });
    if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  } else if (att.ownerType.startsWith('timeline_file')) {
    const tfVisibility = await buildTfVisibilityClause(me);
    const ok = await prisma.timelineFile.findFirst({
      where: { id: att.ownerId, AND: [tfVisibility] },
      select: { id: true },
    });
    if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (att.source === 'drive_link') {
    return NextResponse.json(
      { error: 'Drive links cannot be printed through the server.' },
      { status: 400 },
    );
  }

  if (!isS3Configured()) {
    return NextResponse.json(
      { error: 'Storage is not configured on this server.' },
      { status: 503 },
    );
  }

  try {
    const { body, contentType, contentLength } = await getObjectStream(att.fileUrl);
    const headers = new Headers({
      'Content-Type': att.mimeType || contentType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${sanitizeFilename(att.fileName)}"`,
      // Same-origin only, keep out of any shared cache — these are access-gated.
      'Cache-Control': 'private, no-store',
      // Defence in depth: this route serves attachment bytes from our OWN
      // origin, so active content (a scripted SVG, stray HTML) must never
      // execute here. `nosniff` pins the declared type; `sandbox` neutralises
      // any script/plugin/navigation if the URL is opened directly. The normal
      // print path fetches these bytes and re-wraps them in a fresh blob (whose
      // type is constrained to safe formats by isBrowserPrintable), so neither
      // header affects PDF/image printing.
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': 'sandbox',
    });
    if (contentLength != null) headers.set('Content-Length', String(contentLength));
    return new NextResponse(body, { status: 200, headers });
  } catch (err) {
    logError('attachment print stream failed', err);
    return NextResponse.json({ error: 'Could not load file' }, { status: 500 });
  }
}
