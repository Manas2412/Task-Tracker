import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { canViewAllottedTasks, getAllottedDivisionTasksFor } from '@/lib/user-profile';

/**
 * GET /api/users/[id]/allotted-tasks
 *
 * Division-visibility tasks allotted to the given person, for the search
 * profile popup. Gated to same-division colleagues + OSD / Super Admin
 * (`canViewAllottedTasks`); the list itself is additionally visibility-scoped
 * to the caller, so it can never leak a task they could not already see.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const { ok: allowed } = rateLimit(`allotted:${session.user.id}`, 60, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: { divisionId: true },
  });
  if (!target) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const permitted = canViewAllottedTasks(
    {
      divisionId: session.user.divisionId,
      isSuperAdmin: session.user.isSuperAdmin,
      hierarchySlot: session.user.hierarchySlot,
    },
    target.divisionId,
  );
  if (!permitted) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const tasks = await getAllottedDivisionTasksFor(session.user.id, params.id);
  return NextResponse.json({ tasks });
}
