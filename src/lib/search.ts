import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { buildTfVisibilityClause } from '@/lib/timeline-files';
import { buildVisibilityClauses } from '@/lib/visibility';

/**
 * Global search across tasks, timeline files, users, and tags.
 *
 * Authorisation:
 *   - Tasks → existing task-visibility scoper (same as /tasks)
 *   - TFs   → existing TF-visibility scoper (same as /timeline-files)
 *   - Users → any signed-in user can browse the active-user directory
 *   - Tags  → any signed-in user can browse the master tag list
 */

const MIN_QUERY_LENGTH = 2;
const PREVIEW_PER_GROUP = 5;
const FULL_PER_GROUP = 50;

// ============================================================
// Types
// ============================================================

export type SearchTaskResult = {
  id: string;
  name: string;
  status: string;
  divisionName: string;
  divisionColour: string;
  ownerName: string;
  ownerInitials: string;
  href: string;
};

export type SearchTfResult = {
  id: string;
  refNo: string;
  subject: string;
  fromWhom: string;
  status: string;
  href: string;
};

export type SearchUserResult = {
  id: string;
  name: string;
  username: string;
  designation: string;
  divisionColour: string;
  isActive: boolean;
  href: string;
};

export type SearchTagResult = {
  id: string;
  name: string;
  taskCount: number;
  href: string;
};

export type SearchResults = {
  query: string;
  tasks: SearchTaskResult[];
  timelineFiles: SearchTfResult[];
  users: SearchUserResult[];
  tags: SearchTagResult[];
  totals: { tasks: number; timelineFiles: number; users: number; tags: number };
};

export type SearchType = 'all' | 'tasks' | 'timeline_files' | 'users' | 'tags';

export type SearchTaskFilters = {
  status?: string;
  priority?: string;
  divisionId?: string;
  dueFrom?: string;
  dueTo?: string;
  jsPriority?: boolean;
  milestone?: boolean;
};

// ============================================================
// Helpers
// ============================================================

function normaliseQuery(raw: string | null | undefined): string {
  return (raw ?? '').trim();
}

export function isQuerySearchable(query: string): boolean {
  return query.length >= MIN_QUERY_LENGTH;
}

function initials(name: string): string {
  const parts = name
    .replace(/[().]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase();
}

// ============================================================
// Per-entity searches
// ============================================================

export async function searchTasksFor(
  callerId: string,
  query: string,
  take: number,
  filters?: SearchTaskFilters,
): Promise<{ rows: SearchTaskResult[]; total: number }> {
  const q = normaliseQuery(query);
  if (!isQuerySearchable(q)) return { rows: [], total: 0 };

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
  if (!me) return { rows: [], total: 0 };

  const visibility = await buildVisibilityClauses(me);
  const filter: Prisma.TaskWhereInput = {
    archivedAt: null,
    parentTaskId: null,
    OR: [
      { name: { contains: q, mode: 'insensitive' } },
      { refNumber: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { owner: { name: { contains: q, mode: 'insensitive' } } },
    ],
  };
  const andClauses: Prisma.TaskWhereInput[] = [{ OR: visibility }, filter];

  if (filters) {
    if (filters.status) andClauses.push({ status: filters.status });
    if (filters.priority) andClauses.push({ priority: filters.priority });
    if (filters.divisionId) andClauses.push({ divisionId: filters.divisionId });
    if (filters.jsPriority) andClauses.push({ jsPriorityLane: { not: null } });
    if (filters.milestone) andClauses.push({ milestone: true });
    if (filters.dueFrom || filters.dueTo) {
      const dueDateClause: Prisma.DateTimeNullableFilter = {};
      if (filters.dueFrom) dueDateClause.gte = new Date(filters.dueFrom);
      if (filters.dueTo) {
        const end = new Date(filters.dueTo);
        end.setHours(23, 59, 59, 999);
        dueDateClause.lte = end;
      }
      andClauses.push({ dueDate: dueDateClause });
    }
  }

  const where: Prisma.TaskWhereInput = {
    AND: andClauses,
  };

  const [rowsRaw, total] = await Promise.all([
    prisma.task.findMany({
      where,
      include: {
        owner: { include: { division: true } },
        division: true,
      },
      orderBy: [{ updatedAt: 'desc' }],
      take,
    }),
    prisma.task.count({ where }),
  ]);

  const rows: SearchTaskResult[] = rowsRaw.map((t) => ({
    id: t.id,
    name: t.name,
    status: t.status,
    divisionName: t.division.name,
    divisionColour: t.division.avatarColour,
    ownerName: t.owner.name,
    ownerInitials: initials(t.owner.name),
    href: `/tasks/${t.id}`,
  }));

  return { rows, total };
}

export async function searchTimelineFilesFor(
  callerId: string,
  query: string,
  take: number,
): Promise<{ rows: SearchTfResult[]; total: number }> {
  const q = normaliseQuery(query);
  if (!isQuerySearchable(q)) return { rows: [], total: 0 };

  const me = await prisma.user.findUnique({
    where: { id: callerId },
    select: {
      id: true,
      hierarchySlot: true,
      isSuperAdmin: true,
      divisionId: true,
    },
  });
  if (!me) return { rows: [], total: 0 };

  const visibility = await buildTfVisibilityClause(me);
  const filter: Prisma.TimelineFileWhereInput = {
    archivedAt: null,
    OR: [
      { refNo: { contains: q, mode: 'insensitive' } },
      { subject: { contains: q, mode: 'insensitive' } },
      { fromWhom: { contains: q, mode: 'insensitive' } },
    ],
  };
  const where: Prisma.TimelineFileWhereInput = {
    AND: [visibility, filter],
  };

  const [rowsRaw, total] = await Promise.all([
    prisma.timelineFile.findMany({
      where,
      select: {
        id: true,
        refNo: true,
        subject: true,
        fromWhom: true,
        status: true,
      },
      orderBy: [{ receivedDate: 'desc' }],
      take,
    }),
    prisma.timelineFile.count({ where }),
  ]);

  const rows: SearchTfResult[] = rowsRaw.map((tf) => ({
    id: tf.id,
    refNo: tf.refNo,
    subject: tf.subject,
    fromWhom: tf.fromWhom,
    status: tf.status,
    href: `/timeline-files/${tf.id}`,
  }));

  return { rows, total };
}

export async function searchUsersFor(
  query: string,
  take: number,
): Promise<{ rows: SearchUserResult[]; total: number }> {
  const q = normaliseQuery(query);
  if (!isQuerySearchable(q)) return { rows: [], total: 0 };

  const where: Prisma.UserWhereInput = {
    OR: [
      { name: { contains: q, mode: 'insensitive' } },
      { username: { contains: q, mode: 'insensitive' } },
      { designation: { contains: q, mode: 'insensitive' } },
    ],
  };
  const [rowsRaw, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        username: true,
        designation: true,
        isActive: true,
        division: { select: { avatarColour: true } },
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      take,
    }),
    prisma.user.count({ where }),
  ]);

  const rows: SearchUserResult[] = rowsRaw.map((u) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    designation: u.designation,
    divisionColour: u.division.avatarColour,
    isActive: u.isActive,
    // Profile screens aren't built for other users yet — clicking falls back
    // to a tasks-by-owner search for now.
    href: `/search?q=${encodeURIComponent(u.name)}&type=tasks`,
  }));

  return { rows, total };
}

export async function searchTagsFor(
  query: string,
  take: number,
): Promise<{ rows: SearchTagResult[]; total: number }> {
  const q = normaliseQuery(query);
  if (!isQuerySearchable(q)) return { rows: [], total: 0 };

  const where: Prisma.TagWhereInput = {
    name: { contains: q, mode: 'insensitive' },
  };
  const [rowsRaw, total] = await Promise.all([
    prisma.tag.findMany({
      where,
      select: {
        id: true,
        name: true,
        _count: { select: { tasks: true } },
      },
      orderBy: { name: 'asc' },
      take,
    }),
    prisma.tag.count({ where }),
  ]);

  const rows: SearchTagResult[] = rowsRaw.map((t) => ({
    id: t.id,
    name: t.name,
    taskCount: t._count.tasks,
    // Filter the tasks list by this tag (Phase-4 follow-up); for now point
    // at the tag manager so Super Admin can act on it.
    href: `/admin/tags`,
  }));

  return { rows, total };
}

// ============================================================
// Aggregated entry points
// ============================================================

export async function searchPreview(
  callerId: string,
  query: string,
): Promise<SearchResults> {
  const [tasks, timelineFiles, users, tags] = await Promise.all([
    searchTasksFor(callerId, query, PREVIEW_PER_GROUP),
    searchTimelineFilesFor(callerId, query, PREVIEW_PER_GROUP),
    searchUsersFor(query, PREVIEW_PER_GROUP),
    searchTagsFor(query, PREVIEW_PER_GROUP),
  ]);
  return {
    query,
    tasks: tasks.rows,
    timelineFiles: timelineFiles.rows,
    users: users.rows,
    tags: tags.rows,
    totals: {
      tasks: tasks.total,
      timelineFiles: timelineFiles.total,
      users: users.total,
      tags: tags.total,
    },
  };
}

export async function searchFull(
  callerId: string,
  query: string,
  type: SearchType,
  taskFilters?: SearchTaskFilters,
): Promise<SearchResults> {
  const include = {
    tasks: type === 'all' || type === 'tasks',
    timelineFiles: type === 'all' || type === 'timeline_files',
    users: type === 'all' || type === 'users',
    tags: type === 'all' || type === 'tags',
  };

  const [tasks, timelineFiles, users, tags] = await Promise.all([
    include.tasks
      ? searchTasksFor(callerId, query, FULL_PER_GROUP, taskFilters)
      : Promise.resolve({ rows: [], total: 0 }),
    include.timelineFiles
      ? searchTimelineFilesFor(callerId, query, FULL_PER_GROUP)
      : Promise.resolve({ rows: [], total: 0 }),
    include.users
      ? searchUsersFor(query, FULL_PER_GROUP)
      : Promise.resolve({ rows: [], total: 0 }),
    include.tags
      ? searchTagsFor(query, FULL_PER_GROUP)
      : Promise.resolve({ rows: [], total: 0 }),
  ]);

  return {
    query,
    tasks: tasks.rows,
    timelineFiles: timelineFiles.rows,
    users: users.rows,
    tags: tags.rows,
    totals: {
      tasks: tasks.total,
      timelineFiles: timelineFiles.total,
      users: users.total,
      tags: tags.total,
    },
  };
}
