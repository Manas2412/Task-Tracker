import { prisma } from '@/lib/db';

/**
 * JS Engagements — data layer.
 *
 * Engagements are the Office of JS's meetings. Both *seeing* and *managing*
 * them is restricted to Office-of-JS members and Super Admins (see
 * `canAccessEngagements`). Every engagement is anchored to the Office of JS
 * division, so the caller's own membership is the only gate the calendar
 * needs — there is no per-row visibility beyond that.
 */

export type EngagementCaller = {
  /** The caller's member divisions (home + admin-granted extras). */
  memberDivisionIds: string[];
  isSuperAdmin: boolean;
};

/**
 * The Office of JS division id, looked up by its seeded name (stable across
 * deployments — the seed scripts key off the same name). Returns null if the
 * division is missing, in which case only Super Admins can access engagements.
 */
export async function getOfficeOfJsDivisionId(): Promise<string | null> {
  const div = await prisma.division.findFirst({
    where: { name: 'Office of JS' },
    select: { id: true },
  });
  return div?.id ?? null;
}

/**
 * Office-of-JS members and Super Admins may both see and manage engagements.
 * Managing and viewing share the same gate by design (per product decision).
 */
export function canAccessEngagements(
  me: EngagementCaller,
  officeOfJsDivisionId: string | null,
): boolean {
  if (me.isSuperAdmin) return true;
  // A member (home or admin-granted extra) of the Office of JS division.
  return officeOfJsDivisionId !== null && me.memberDivisionIds.includes(officeOfJsDivisionId);
}

export type EngagementSummary = {
  id: string;
  title: string;
  startsAt: Date;
  venue: string | null;
  momNotes: string | null;
  createdBy: { id: string; name: string };
  participants: { id: string; name: string }[];
};

function toSummary(e: {
  id: string;
  title: string;
  startsAt: Date;
  venue: string | null;
  momNotes: string | null;
  createdBy: { id: string; name: string };
  participants: { user: { id: string; name: string } }[];
}): EngagementSummary {
  return {
    id: e.id,
    title: e.title,
    startsAt: e.startsAt,
    venue: e.venue,
    momNotes: e.momNotes,
    createdBy: e.createdBy,
    participants: e.participants.map((p) => p.user),
  };
}

/** Engagements starting within [from, to]. Callers must be OJS members/SA. */
export async function fetchEngagements(opts: {
  from: Date;
  to: Date;
}): Promise<EngagementSummary[]> {
  const rows = await prisma.jsEngagement.findMany({
    where: {
      archivedAt: null,
      startsAt: { gte: opts.from, lte: opts.to },
    },
    include: {
      createdBy: { select: { id: true, name: true } },
      participants: { include: { user: { select: { id: true, name: true } } } },
    },
    orderBy: { startsAt: 'asc' },
  });
  return rows.map(toSummary);
}

/** A single engagement for the detail view, or null if missing/archived. */
export async function fetchEngagement(id: string): Promise<EngagementSummary | null> {
  const e = await prisma.jsEngagement.findFirst({
    where: { id, archivedAt: null },
    include: {
      createdBy: { select: { id: true, name: true } },
      participants: { include: { user: { select: { id: true, name: true } } } },
    },
  });
  return e ? toSummary(e) : null;
}
