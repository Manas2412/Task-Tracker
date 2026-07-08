import type { Prisma, Task } from '@prisma/client';

import { startOfDayIST, endOfDayIST } from '@/lib/date';
import { prisma } from '@/lib/db';
import { USER_SUMMARY_SELECT } from '@/lib/prisma-selects';
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

export type TaskFilter = 'all' | 'today' | 'overdue' | 'mine' | 'urgent' | 'completed' | 'js_priority';

/**
 * List ordering. `default` is the smart order (JS Priority lane, then due
 * date, then priority, then newest); `latest` is newest-created first.
 */
export type TaskSort = 'default' | 'latest';

export { buildVisibilityClausesFrom };
export type { CallerSummary };

/**
 * Every active user in the caller's PMU — themselves plus their PMU
 * teammates (same `pmu_id`). Empty when the caller is not a PMU member or
 * their PMU is unset. Drives the owner-scoped PMU visibility clause so a
 * PMU team member sees their team's tasks but not the whole division.
 */
export async function getPmuTeammateIds(userId: string): Promise<string[]> {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { pmuId: true },
  });
  if (!me?.pmuId) return [];
  const teammates = await prisma.user.findMany({
    where: { pmuId: me.pmuId, isActive: true },
    select: { id: true },
  });
  return teammates.map((u) => u.id);
}

/**
 * The user id of the head of a PMU's home (parent) ministry division, or
 * null when the PMU or its parent has no head. A PMU (`kind = 'pmu'`) never
 * carries its own `head_user_id`; its head is the head of the division named
 * by `pmu_parent_division_id` (falling back to `parent_id` for legacy rows).
 * This is the "Division head" excluded from a whole-PMU-team share.
 */
export async function getPmuParentDivisionHeadId(pmuId: string): Promise<string | null> {
  const pmu = await prisma.division.findUnique({
    where: { id: pmuId },
    select: { pmuParentDivisionId: true, parentId: true },
  });
  const parentId = pmu?.pmuParentDivisionId ?? pmu?.parentId ?? null;
  if (!parentId) return null;
  const parent = await prisma.division.findUnique({
    where: { id: parentId },
    select: { headUserId: true },
  });
  return parent?.headUserId ?? null;
}

/**
 * Build the OR-of-visibility-clauses for a caller.
 * Returns clauses that are then composed with the filter clause in the page.
 */
export async function buildVisibilityClauses(me: CallerSummary): Promise<Prisma.TaskWhereInput[]> {
  const [headedDivisionIds, pmuMemberIds, pmuParentHeadId] = await Promise.all([
    getHeadedDivisionIds(me.id),
    me.isPmu ? getPmuTeammateIds(me.id) : Promise.resolve<string[]>([]),
    me.isPmu && me.pmuId
      ? getPmuParentDivisionHeadId(me.pmuId)
      : Promise.resolve<string | null>(null),
  ]);
  return buildVisibilityClausesFrom(me, headedDivisionIds, pmuMemberIds, {
    isPmuParentDivisionHead: pmuParentHeadId !== null && pmuParentHeadId === me.id,
  });
}

/**
 * Filter clause derived from the `filter` chip.
 * Composed with the visibility OR — both must match.
 */
function buildFilterClause(filter: TaskFilter, callerId: string): Prisma.TaskWhereInput {
  const now = new Date();
  switch (filter) {
    case 'today': {
      return { dueDate: { gte: startOfDayIST(), lte: endOfDayIST() } };
    }
    case 'overdue':
      return { dueDate: { lt: startOfDayIST() }, status: { not: 'completed' } };
    case 'urgent':
      return { priority: 'urgent' };
    case 'mine':
      return { ownerId: callerId };
    case 'completed':
      return { status: 'completed' };
    case 'js_priority':
      return { jsPriorityLane: { not: null }, status: { not: 'completed' } };
    case 'all':
    default:
      return { status: { not: 'completed' } };
  }
}

export type VisibleTask = Task & {
  owner: { id: string; name: string; designation: string; division: { id: string; name: string; avatarColour: string } };
  division: { id: string; name: string; avatarColour: string };
  subtasks: { status: string }[];
  collaborators: { role: string }[];
  hasAttachment: boolean;
  /** File names of the task's attachments, oldest first (for the hover preview). */
  attachmentNames: string[];
};

const TASK_PAGE_LIMIT = 200;

export async function fetchVisibleTasks(opts: {
  callerId: string;
  filter: TaskFilter;
  divisionId?: string;
  sort?: TaskSort;
}): Promise<{ tasks: VisibleTask[]; total: number; capped: boolean }> {
  const me = await prisma.user.findUnique({
    where: { id: opts.callerId },
    select: {
      id: true,
      hierarchySlot: true,
      isSuperAdmin: true,
      divisionId: true,
      isPmu: true,
      pmuId: true,
    },
  });
  if (!me) return { tasks: [], total: 0, capped: false };

  const visibilityClauses = await buildVisibilityClauses(me);
  const filterClause = buildFilterClause(opts.filter, me.id);

  const andClauses: Prisma.TaskWhereInput[] = [
    { OR: visibilityClauses },
    filterClause,
  ];
  if (opts.divisionId) {
    andClauses.push({ divisionId: opts.divisionId });
  }

  const where: Prisma.TaskWhereInput = {
    archivedAt: null,
    parentTaskId: null,
    AND: andClauses,
  };

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      include: {
        owner: { select: USER_SUMMARY_SELECT },
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
      take: TASK_PAGE_LIMIT,
    }),
    prisma.task.count({ where }),
  ]);

  const taskIds = tasks.map((t) => t.id);
  const namesByTask = new Map<string, string[]>();
  if (taskIds.length > 0) {
    const rows = await prisma.attachment.findMany({
      where: { ownerType: 'task', ownerId: { in: taskIds } },
      select: { ownerId: true, fileName: true },
      orderBy: { uploadedAt: 'asc' },
    });
    for (const r of rows) {
      const list = namesByTask.get(r.ownerId) ?? [];
      list.push(r.fileName);
      namesByTask.set(r.ownerId, list);
    }
  }

  const mapped = tasks.map((t) => {
    const attachmentNames = namesByTask.get(t.id) ?? [];
    return {
      ...t,
      hasAttachment: attachmentNames.length > 0,
      attachmentNames,
    };
  }) as VisibleTask[];

  return { tasks: mapped, total, capped: total > TASK_PAGE_LIMIT };
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
      pmuId: true,
    },
  });
  if (!me) return { open: 0, dueToday: 0, overdue: 0 };

  const visibilityClauses = await buildVisibilityClauses(me);
  const base: Prisma.TaskWhereInput = {
    archivedAt: null,
    parentTaskId: null,
    AND: [{ OR: visibilityClauses }],
  };

  const [open, dueToday, overdue] = await Promise.all([
    prisma.task.count({ where: { ...base, status: { not: 'completed' } } }),
    prisma.task.count({
      where: { ...base, dueDate: { gte: startOfDayIST(), lte: endOfDayIST() }, status: { not: 'completed' } },
    }),
    prisma.task.count({
      where: { ...base, dueDate: { lt: startOfDayIST() }, status: { not: 'completed' } },
    }),
  ]);

  return { open, dueToday, overdue };
}
