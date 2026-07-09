import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { fetchTfStatFiles, type TfStatKind } from '@/lib/timeline-files';

/**
 * GET /api/timeline-files/stats?kind=open|today|overdue|completed
 *
 * Drill-down data behind the timeline-files summary cards. Everything is
 * scoped to the caller's TF visibility (buildTfVisibilityClause), so a card
 * can never reveal a file the user could not already see in the list.
 *
 * Auth is enforced in the handler (not middleware), so this route stays safe
 * even if /api paths bypass the app middleware.
 */
const VALID_KINDS: TfStatKind[] = ['open', 'today', 'overdue', 'completed'];

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const { ok: allowed } = rateLimit(`tfstats:${session.user.id}`, 60, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const kind = new URL(request.url).searchParams.get('kind');
  if (!kind || !VALID_KINDS.includes(kind as TfStatKind)) {
    return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
  }

  const files = await fetchTfStatFiles(session.user.id, kind as TfStatKind);
  return NextResponse.json({ files });
}
