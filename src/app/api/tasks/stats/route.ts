import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { fetchOpenTasksByDivision, fetchStatTasks } from '@/lib/visibility';

/**
 * GET /api/tasks/stats?kind=today|overdue|completed|divisions
 *
 * Drill-down data behind the tasks-page stat tiles. Everything is scoped to
 * the caller's task visibility (buildVisibilityClauses), so a popup can never
 * reveal a task the user could not already see on the board.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const { ok: allowed } = rateLimit(`taskstats:${session.user.id}`, 60, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const kind = new URL(request.url).searchParams.get('kind');

  if (kind === 'today' || kind === 'overdue' || kind === 'completed') {
    const tasks = await fetchStatTasks(session.user.id, kind);
    return NextResponse.json({ tasks });
  }
  if (kind === 'divisions') {
    const divisions = await fetchOpenTasksByDivision(session.user.id);
    return NextResponse.json({ divisions });
  }

  return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
}
