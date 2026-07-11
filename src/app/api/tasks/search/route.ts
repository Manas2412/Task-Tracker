import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { isQuerySearchable, quickSearchTasks } from '@/lib/search';

/**
 * Tasks-page Quick Search endpoint.
 *
 * Returns full task-card rows for tasks matching the query across title,
 * description/context, ref number, owner, subtasks, discussion comments and
 * document names (Super Admin also matches tags). Scoped to the caller's task
 * visibility — same scoper as /tasks — so it can never surface a hidden task.
 *
 * Node runtime (Prisma). Auth is enforced here because /api bypasses the app
 * middleware.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim();

  const { ok: allowed } = rateLimit(`task-quick-search:${session.user.id}`, 40, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  if (!isQuerySearchable(q)) {
    return NextResponse.json({ query: q, rows: [], total: 0, capped: false });
  }

  const result = await quickSearchTasks(session.user.id, q);
  return NextResponse.json({ query: q, ...result });
}
