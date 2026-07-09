import type { Prisma, TimelineFile } from '@prisma/client';

import { prisma } from '@/lib/db';
import { startOfDayIST, endOfDayIST } from '@/lib/date';

/**
 * Server-side scoper + ref-number generator for Timeline Files.
 *
 * Visibility (per PRD §5.2):
 *   - OSD, JS, Super Admin → master view (all TFs)
 *   - Everyone else → only TFs marked to their division
 *
 * Sub-division and section users in Phase 3 inherit their parent division's
 * visibility; finer-grained scoping is a follow-up.
 */

export type TfFilter = 'all' | 'pending_action' | 'in_progress' | 'awaiting_reply' | 'on_hold' | 'closed';

/**
 * List ordering:
 *   - 'default' — open files first, then soonest deadline, then newest.
 *   - 'latest'  — most recently added files first (createdAt desc).
 */
export type TfSort = 'default' | 'latest';

type CallerSummary = {
  id: string;
  hierarchySlot: string;
  isSuperAdmin: boolean;
  divisionId: string;
};

export async function buildTfVisibilityClause(
  me: CallerSummary,
): Promise<Prisma.TimelineFileWhereInput> {
  if (
    me.isSuperAdmin ||
    me.hierarchySlot === 'osd' ||
    me.hierarchySlot === 'js'
  ) {
    return {};
  }
  return { markedTo: { some: { divisionId: me.divisionId } } };
}

export type VisibleTimelineFile = TimelineFile & {
  createdBy: { id: string; name: string };
  markedTo: Array<{
    division: { id: string; name: string; avatarColour: string };
  }>;
  _count: { taskLinks: number };
};

export async function fetchVisibleTimelineFiles(opts: {
  callerId: string;
  filter: TfFilter;
  sort?: TfSort;
  /** Narrow to files marked to this division (on top of visibility). */
  divisionId?: string;
}): Promise<VisibleTimelineFile[]> {
  const me = await prisma.user.findUnique({
    where: { id: opts.callerId },
    select: {
      id: true,
      hierarchySlot: true,
      isSuperAdmin: true,
      divisionId: true,
    },
  });
  if (!me) return [];

  const visibility = await buildTfVisibilityClause(me);
  const statusFilter: Prisma.TimelineFileWhereInput =
    opts.filter !== 'all' ? { status: opts.filter } : {};
  const divisionFilter: Prisma.TimelineFileWhereInput =
    opts.divisionId ? { markedTo: { some: { divisionId: opts.divisionId } } } : {};

  const orderBy: Prisma.TimelineFileOrderByWithRelationInput[] =
    opts.sort === 'latest'
      ? [
          // Most recently added correspondence first.
          { createdAt: 'desc' },
          // Stable tiebreaker for same-instant rows.
          { receivedDate: 'desc' },
        ]
      : [
          // Open files first; closed last.
          { status: 'asc' },
          // Then by deadline (closest first), nulls last.
          { deadlineDate: { sort: 'asc', nulls: 'last' } },
          // Stable tiebreaker.
          { receivedDate: 'desc' },
        ];

  return prisma.timelineFile.findMany({
    where: {
      archivedAt: null,
      AND: [visibility, statusFilter, divisionFilter],
    },
    include: {
      createdBy: { select: { id: true, name: true } },
      markedTo: {
        include: { division: { select: { id: true, name: true, avatarColour: true } } },
      },
      _count: { select: { taskLinks: true } },
    },
    orderBy,
  });
}

/**
 * Counters behind the summary cards on the list page.
 *
 * `deadlineDate` is a date-only column stored at UTC midnight; because IST is
 * ahead of UTC, that instant always falls inside its own IST calendar day, so
 * the IST day boundaries below classify each file into exactly one of
 * due-today / overdue (open files only). Closed files count as completed.
 */
export async function fetchTfCounts(callerId: string): Promise<{
  open: number;
  dueToday: number;
  overdue: number;
  completed: number;
}> {
  const me = await prisma.user.findUnique({
    where: { id: callerId },
    select: {
      id: true,
      hierarchySlot: true,
      isSuperAdmin: true,
      divisionId: true,
    },
  });
  if (!me) return { open: 0, dueToday: 0, overdue: 0, completed: 0 };

  const visibility = await buildTfVisibilityClause(me);
  const base: Prisma.TimelineFileWhereInput = {
    archivedAt: null,
    AND: [visibility],
  };
  const dayStart = startOfDayIST();
  const dayEnd = endOfDayIST();

  const [open, dueToday, overdue, completed] = await Promise.all([
    prisma.timelineFile.count({
      where: { ...base, status: { not: 'closed' } },
    }),
    prisma.timelineFile.count({
      where: {
        ...base,
        status: { not: 'closed' },
        deadlineDate: { gte: dayStart, lte: dayEnd },
      },
    }),
    prisma.timelineFile.count({
      where: {
        ...base,
        status: { not: 'closed' },
        deadlineDate: { lt: dayStart },
      },
    }),
    prisma.timelineFile.count({
      where: { ...base, status: 'closed' },
    }),
  ]);

  return { open, dueToday, overdue, completed };
}

/** Which summary card a drill-down list belongs to. */
export type TfStatKind = 'open' | 'today' | 'overdue' | 'completed';

/** One file row shown inside a summary-card drill-down sheet. */
export type TfStatRow = {
  id: string;
  refNo: string;
  subject: string;
  fromWhom: string;
  status: string;
  deadlineDate: string | null;
  href: string;
};

/**
 * Visibility-scoped list of files behind a summary card — the drill-down for
 * Open files / Due today / Overdue / Completed. Scoped through the same
 * `buildTfVisibilityClause`, so a card can never reveal a file the caller
 * could not already see in the list.
 */
export async function fetchTfStatFiles(
  callerId: string,
  kind: TfStatKind,
): Promise<TfStatRow[]> {
  const me = await prisma.user.findUnique({
    where: { id: callerId },
    select: {
      id: true,
      hierarchySlot: true,
      isSuperAdmin: true,
      divisionId: true,
    },
  });
  if (!me) return [];

  const visibility = await buildTfVisibilityClause(me);
  const dayStart = startOfDayIST();
  const dayEnd = endOfDayIST();

  const kindClause: Prisma.TimelineFileWhereInput =
    kind === 'completed'
      ? { status: 'closed' }
      : kind === 'today'
        ? { status: { not: 'closed' }, deadlineDate: { gte: dayStart, lte: dayEnd } }
        : kind === 'overdue'
          ? { status: { not: 'closed' }, deadlineDate: { lt: dayStart } }
          : { status: { not: 'closed' } };

  const orderBy: Prisma.TimelineFileOrderByWithRelationInput[] =
    kind === 'completed'
      ? [{ createdAt: 'desc' }]
      : [{ deadlineDate: { sort: 'asc', nulls: 'last' } }, { receivedDate: 'desc' }];

  const rows = await prisma.timelineFile.findMany({
    where: { archivedAt: null, AND: [visibility, kindClause] },
    select: {
      id: true,
      refNo: true,
      subject: true,
      fromWhom: true,
      status: true,
      deadlineDate: true,
    },
    orderBy,
    take: 200,
  });

  return rows.map((f) => ({
    id: f.id,
    refNo: f.refNo,
    subject: f.subject,
    fromWhom: f.fromWhom,
    status: f.status,
    deadlineDate: f.deadlineDate ? f.deadlineDate.toISOString() : null,
    href: `/timeline-files/${f.id}`,
  }));
}

// ============================================================
// Ref-number: TF-YYYY/Number (per PRD §5.2, desk-entered)
// ============================================================

/**
 * Suggests the next sequential file number for the given year — shown as
 * a convenience default on the create form. The desk officer types the
 * actual number from their physical file register (overriding the
 * suggestion when it differs); uniqueness for that year is enforced by
 * the `(ref_year, ref_seq)` constraint at insert time, not here.
 */
export async function suggestNextRefSeq(year: number): Promise<number> {
  const last = await prisma.timelineFile.findFirst({
    where: { refYear: year },
    orderBy: { refSeq: 'desc' },
    select: { refSeq: true },
  });
  return (last?.refSeq ?? 0) + 1;
}
