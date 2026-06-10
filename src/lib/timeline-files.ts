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
    orderBy: [
      // Open files first; closed last.
      { status: 'asc' },
      // Then by deadline (closest first), nulls last.
      { deadlineDate: { sort: 'asc', nulls: 'last' } },
      // Stable tiebreaker.
      { receivedDate: 'desc' },
    ],
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
// Ref-number generation: TF-YYYY/NNN (per PRD §5.2)
// ============================================================

/**
 * Allocate the next sequential ref-number for the given year inside a
 * transaction. Caller passes its own Prisma tx so the SELECT + INSERT
 * are atomic, avoiding duplicate refSeq under concurrency.
 *
 * Retry-on-conflict happens in the action; this helper just computes.
 */
export async function nextRefNumber(
  tx: Prisma.TransactionClient,
  year: number,
): Promise<{ refYear: number; refSeq: number; refNo: string }> {
  const last = await tx.timelineFile.findFirst({
    where: { refYear: year },
    orderBy: { refSeq: 'desc' },
    select: { refSeq: true },
  });
  const refSeq = (last?.refSeq ?? 0) + 1;
  const refNo = `TF-${year}/${String(refSeq).padStart(3, '0')}`;
  return { refYear: year, refSeq, refNo };
}
