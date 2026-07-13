import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { canAccessDocumentCentreById } from '@/lib/document-centre';
import { isDocQuerySearchable, quickSearchDocuments } from '@/lib/document-search';
import { rateLimit } from '@/lib/rate-limit';

/**
 * GET /api/documents/search?q=...
 *
 * Node runtime (Prisma). Auth + the executive-allowlist gate are enforced
 * here because /api bypasses the app middleware for authorization. Results
 * are scoped by the same gate as the module, so a leaked query can reveal
 * nothing to an unauthorized caller.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  if (!(await canAccessDocumentCentreById(session.user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { ok: allowed } = rateLimit(`docsearch:${session.user.id}`, 40, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const q = new URL(request.url).searchParams.get('q') ?? '';
  if (!isDocQuerySearchable(q)) {
    return NextResponse.json({ rows: [], total: 0, capped: false });
  }

  const result = await quickSearchDocuments(session.user.id, q);
  return NextResponse.json(result);
}
