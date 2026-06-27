import type { Prisma, Task } from '@prisma/client';

import { prisma } from '@/lib/db';

/**
 * Server-side visibility scoper for tasks.
 *
 * Implements the rules in docs/PERMISSIONS.md §2 with the Phase 1 caveat:
 * for hierarchy slots below Director, we cover own + direct-reports tasks.
 * Full recursive chain traversal (via a Postgres recursive CTE) lands in
 * a later turn — flagged here so it's not silently forgotten.
 *
 * Personal-visibility tasks are NEVER returned to anyone but their owner,
 * including Super Admin and OSD.
 */

export type TaskFilter = 'all' | 'today' | 'overdue' | 'mine' | 'urgent' | 'completed' | 'js_priority' | 'milestone';

export type CallerSummary = {
  id: string;
  hierarchySlot: string;
  isSuperAdmin: boolean;
  divisionId: string;
  isPmu: boolean;
};

/**
 * Build the OR-of-visibility-clauses for a caller.
 * Returns clauses that are then composed with the filter clause in the page.
 */
export async function buildVisibilityClauses(me: CallerSummary): Promise<Prisma.TaskWhereInput[]> {
  const clauses: Prisma.TaskWhereInput[] = [
    // Always: tasks I own.
    { ownerId: me.id },
    // Always: tasks I'm explicitly added to.
    { collaborators: { some: { userId: me.id } } },
  ];

  if (me.isSuperAdmin || me.hierarchySlot === 'osd') {
    // Super Admin + OSD see all non-personal tasks across the ministry.
    clauses.push({ visibility: 'division' });
    return clauses;
  }

  if (me.hierarchySlot === 'js') {
    // JS sees own + the JS Priority Board surface.
    // The board itself ships in Phase 2; the query is correct now.
    clauses.push({
      visibility: 'division',
      jsPriorityLane: { not: null },
    });
    return clauses;
  }

  if (me.hierarchySlot === 'director') {
    // Director sees every non-personal task in their division.
    clauses.push({
      visibility: 'division',
      divisionId: me.divisionId,
    });
    return clauses;
  }

  if (me.isPmu) {
    // Phase 1: PMU members see only own + collaborated. PMU-tag concept
    // (per PERMISSIONS.md §5.2) lands when the tag UI exists.
    // TODO: Phase 3 — add PMU-tagged tasks in the same division.
    return clauses;
  }

  // Dy Sec / Under Sec / Section Officer / ASO — own + direct reports.
  // TODO: Phase 1 follow-up — recursive CTE for the full subordinate chain.
  const directReports = await prisma.user.findMany({
    where: { supervisorId: me.id },
    select: { id: true },
  });
  if (directReports.length > 0) {
    clauses.push({
      visibility: 'division',
      ownerId: { in: directReports.map((u) => u.id) },
    });
  }
  return clauses;
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
};

export async function fetchVisibleTasks(opts: {
  callerId: string;
  filter: TaskFilter;
  divisionId?: string;
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
    orderBy: [
      { jsPriorityLane: { sort: 'asc', nulls: 'last' } },
      { dueDate: { sort: 'asc', nulls: 'last' } },
      { priority: 'desc' },
      { createdAt: 'desc' },
    ],
  });

  return tasks as VisibleTask[];
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
