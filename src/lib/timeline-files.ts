import type { Prisma, TimelineFile } from '@prisma/client';

import { prisma } from '@/lib/db';

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
      AND: [visibility, statusFilter],
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
 * Counters used by the page header.
 */
export async function fetchTfCounts(callerId: string): Promise<{
  open: number;
  pendingAction: number;
  overdue: number;
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
  if (!me) return { open: 0, pendingAction: 0, overdue: 0 };

  const visibility = await buildTfVisibilityClause(me);
  const base: Prisma.TimelineFileWhereInput = {
    archivedAt: null,
    AND: [visibility],
  };
  const now = new Date();

  const [open, pendingAction, overdue] = await Promise.all([
    prisma.timelineFile.count({
      where: { ...base, status: { not: 'closed' } },
    }),
    prisma.timelineFile.count({
      where: { ...base, status: 'pending_action' },
    }),
    prisma.timelineFile.count({
      where: {
        ...base,
        status: { not: 'closed' },
        deadlineDate: { lt: now },
      },
    }),
  ]);

  return { open, pendingAction, overdue };
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
