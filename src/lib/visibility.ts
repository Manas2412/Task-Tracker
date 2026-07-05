import type { Prisma, Task } from '@prisma/client';

import { prisma } from '@/lib/db';
import { getHeadedDivisionIds } from '@/lib/rbac';
import {
  buildVisibilityClausesFrom,
  type CallerSummary,
} from '@/lib/visibility-rules';

/**
 * Server-side visibility scoper for tasks.
 *
 * Division-wide model: every ministry (non-PMU) officer sees all
 * non-personal tasks in their own division, regardless of hierarchy slot —
 * a newly created division user sees the division's tasks from first
 * login. JS and OSD keep their wider surfaces; PMU isolation is unchanged.
 *
 * Division heads additionally see every division they head — direct
 * headship (divisions.head_user_id) plus active access delegations. That
 * is how Mohd Zuber (home: Autonomous Bodies) also sees NSDF, and how a
 * delegate sees the delegated division for the window's duration.
 *
 * Personal-visibility tasks are NEVER returned to anyone but their owner,
 * including Super Admin and OSD.
 */

export type TaskFilter = 'all' | 'today' | 'overdue' | 'mine' | 'urgent' | 'completed' | 'js_priority' | 'milestone';

/**
 * List ordering. `default` is the smart order (JS Priority lane, then due
 * date, then priority, then newest); `latest` is newest-created first.
 */
export type TaskSort = 'default' | 'latest';

export { buildVisibilityClausesFrom };
export type { CallerSummary };

/**
 * Build the OR-of-visibility-clauses for a caller.
 * Returns clauses that are then composed with the filter clause in the page.
 */
export async function buildVisibilityClauses(me: CallerSummary): Promise<Prisma.TaskWhereInput[]> {
  const headedDivisionIds = await getHeadedDivisionIds(me.id);
  return buildVisibilityClausesFrom(me, headedDivisionIds);
}

/**
 * Filter clause derived from the `filter` chip.
 * Composed with the visibility OR — both must match.
 */
function buildFilterClause(filter: TaskFilter, callerId: string): Prisma.TaskWhereInput {
  const now = new Date();
  switch (filter) {
    case 'today': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return { dueDate: { gte: start, lte: end } };
    }
    case 'overdue':
      return { dueDate: { lt: now }, status: { not: 'completed' } };
    case 'urgent':
      return { priority: 'urgent' };
    case 'mine':
      return { ownerId: callerId };
    case 'completed':
      return { status: 'completed' };
    case 'js_priority':
      return { jsPriorityLane: { not: null }, status: { not: 'completed' } };
    case 'milestone':
      return { milestone: true, status: { not: 'completed' } };
    case 'all':
    default:
      return { status: { not: 'completed' } };
  }
}

export type VisibleTask = Task & {
  owner: { id: string; name: string; divisionId: string; division: { name: string; avatarColour: string } };
  division: { id: string; name: string; avatarColour: string };
  subtasks: { status: string }[];
  collaborators: { role: string }[];
  hasAttachment: boolean;
};

export async function fetchVisibleTasks(opts: {
  callerId: string;
  filter: TaskFilter;
  divisionId?: string;
  sort?: TaskSort;
}): Promise<VisibleTask[]> {
  const me = await prisma.user.findUnique({
    where: { id: opts.callerId },
    select: {
      id: true,
      hierarchySlot: true,
      isSuperAdmin: true,
      divisionId: true,
      isPmu: true,
    },
  });
  if (!me) return [];

  const visibilityClauses = await buildVisibilityClauses(me);
  const filterClause = buildFilterClause(opts.filter, me.id);

  const andClauses: Prisma.TaskWhereInput[] = [
    { OR: visibilityClauses },
    filterClause,
  ];
  if (opts.divisionId) {
    andClauses.push({ divisionId: opts.divisionId });
  }

  const tasks = await prisma.task.findMany({
    where: {
      archivedAt: null,
      parentTaskId: null,
      AND: andClauses,
    },
    include: {
      owner: { include: { division: true } },
      division: true,
      subtasks: { select: { status: true } },
      collaborators: { select: { role: true } },
    },
    orderBy:
      opts.sort === 'latest'
        ? [{ createdAt: 'desc' }]
        : [
            { jsPriorityLane: { sort: 'asc', nulls: 'last' } },
            { dueDate: { sort: 'asc', nulls: 'last' } },
            { priority: 'desc' },
            { createdAt: 'desc' },
          ],
  });

  const taskIds = tasks.map((t) => t.id);
  const attachedIds = new Set<string>();
  if (taskIds.length > 0) {
    const rows = await prisma.attachment.findMany({
      where: { ownerType: 'task', ownerId: { in: taskIds } },
      select: { ownerId: true },
      distinct: ['ownerId'],
    });
    for (const r of rows) attachedIds.add(r.ownerId);
  }

  return tasks.map((t) => ({
    ...t,
    hasAttachment: attachedIds.has(t.id),
  })) as VisibleTask[];
}

/**
 * Counters for the stats strip. Same scoping, different where clauses,
 * collapsed into a single query batch.
 */
export async function fetchTaskCounts(callerId: string): Promise<{
  open: number;
  dueToday: number;
  overdue: number;
}> {
  const me = await prisma.user.findUnique({
    where: { id: callerId },
    select: {
      id: true,
      hierarchySlot: true,
      isSuperAdmin: true,
      divisionId: true,
      isPmu: true,
    },
  });
  if (!me) return { open: 0, dueToday: 0, overdue: 0 };

  const visibilityClauses = await buildVisibilityClauses(me);
  const base: Prisma.TaskWhereInput = {
    archivedAt: null,
    parentTaskId: null,
    AND: [{ OR: visibilityClauses }],
  };

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const [open, dueToday, overdue] = await Promise.all([
    prisma.task.count({ where: { ...base, status: { not: 'completed' } } }),
    prisma.task.count({
      where: { ...base, dueDate: { gte: startOfToday, lte: endOfToday }, status: { not: 'completed' } },
    }),
    prisma.task.count({
      where: { ...base, dueDate: { lt: now }, status: { not: 'completed' } },
    }),
  ]);

  return { open, dueToday, overdue };
}
