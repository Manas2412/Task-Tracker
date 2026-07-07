import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isS3Configured, presignView } from '@/lib/s3';
import { buildTfVisibilityClause } from '@/lib/timeline-files';
import { buildVisibilityClauses } from '@/lib/visibility';

/**
 * GET /api/attachments/:id/view
 *
 * Like the download route but uses Content-Disposition: inline so the
 * browser displays the file (PDF, image) instead of force-downloading.
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
    if (!isSafeDriveLinkUrl(att.fileUrl)) {
      return NextResponse.json({ error: 'Blocked redirect URL' }, { status: 403 });
    }
    return NextResponse.redirect(att.fileUrl);
  }

  if (!isS3Configured()) {
    return NextResponse.json(
      { error: 'Storage is not configured on this server.' },
      { status: 503 },
    );
  }

  try {
    const url = await presignView({
      key: att.fileUrl,
      filename: att.fileName,
      contentType: att.mimeType ?? undefined,
    });

    if (isOfficeDocument(att.mimeType, att.fileName)) {
      const viewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
      return NextResponse.redirect(viewerUrl);
    }

    return NextResponse.redirect(url);
  } catch (err) {
    console.error('presignView failed:', err);
    return NextResponse.json({ error: 'Could not generate URL' }, { status: 500 });
  }
}

const ALLOWED_DRIVE_HOSTS = new Set([
  'drive.google.com',
  'docs.google.com',
  'sheets.google.com',
  'slides.google.com',
]);

function isSafeDriveLinkUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && ALLOWED_DRIVE_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

const OFFICE_MIMES = new Set([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

const OFFICE_EXTS = new Set(['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']);

function isOfficeDocument(mimeType: string | null, fileName: string): boolean {
  if (mimeType && OFFICE_MIMES.has(mimeType)) return true;
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return OFFICE_EXTS.has(ext);
}
