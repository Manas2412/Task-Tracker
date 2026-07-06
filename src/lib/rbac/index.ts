import { prisma } from '@/lib/db';

import {
  canTransferTaskTo,
  type RbacActor,
  type RbacTarget,
} from './rules';

export * from './rules';

/**
 * DB-backed context builders for division-based RBAC.
 *
 * Everything here re-reads role state from the database — never from JWT
 * claims — so a head change or a delegation takes effect on the next
 * request, not the next sign-in.
 */

/**
 * Divisions the user holds head powers over right now: direct headships
 * (divisions.head_user_id) plus active, unrevoked delegations.
 */
export async function getHeadedDivisionIds(
  userId: string,
  now: Date = new Date(),
): Promise<string[]> {
  const [headed, delegated] = await Promise.all([
    prisma.division.findMany({
      where: { headUserId: userId },
      select: { id: true },
    }),
    prisma.divisionAccessDelegation.findMany({
      where: {
        delegatedToId: userId,
        revokedAt: null,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      select: { divisionId: true },
    }),
  ]);
  const ids = new Set<string>();
  for (const d of headed) ids.add(d.id);
  for (const d of delegated) ids.add(d.divisionId);
  return [...ids];
}

/** Full RBAC view of one user, or null when the user is missing/disabled. */
export async function getRbacActor(userId: string): Promise<RbacActor | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      divisionId: true,
      isSuperAdmin: true,
      isActive: true,
      hierarchySlot: true,
    },
  });
  if (!user || !user.isActive) return null;
  const headedDivisionIds = await getHeadedDivisionIds(userId);
  return {
    id: user.id,
    divisionId: user.divisionId,
    isSuperAdmin: user.isSuperAdmin,
    isOsd: user.hierarchySlot === 'osd',
    headedDivisionIds,
  };
}

/**
 * Map of userId → divisions they head right now (direct + delegated),
 * for decorating candidate lists without one query per user.
 */
export async function getHeadedDivisionsByUser(
  now: Date = new Date(),
): Promise<Map<string, string[]>> {
  const [headRows, delegationRows] = await Promise.all([
    prisma.division.findMany({
      where: { headUserId: { not: null } },
      select: { id: true, headUserId: true },
    }),
    prisma.divisionAccessDelegation.findMany({
      where: { revokedAt: null, startsAt: { lte: now }, endsAt: { gte: now } },
      select: { divisionId: true, delegatedToId: true },
    }),
  ]);
  const byUser = new Map<string, Set<string>>();
  const add = (userId: string, divisionId: string) => {
    const set = byUser.get(userId) ?? new Set<string>();
    set.add(divisionId);
    byUser.set(userId, set);
  };
  for (const r of headRows) if (r.headUserId) add(r.headUserId, r.id);
  for (const r of delegationRows) add(r.delegatedToId, r.divisionId);
  return new Map([...byUser].map(([k, v]) => [k, [...v]]));
}

/** RBAC view of a prospective transfer/assignment target. */
export async function getRbacTarget(userId: string): Promise<RbacTarget | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, divisionId: true, isSuperAdmin: true, isActive: true },
  });
  if (!user) return null;
  const headedDivisionIds = await getHeadedDivisionIds(userId);
  return {
    id: user.id,
    divisionId: user.divisionId,
    isSuperAdmin: user.isSuperAdmin,
    headedDivisionIds,
    isActive: user.isActive,
  };
}

/**
 * Every user below `userId` in the supervisor chain (any depth). One
 * query over active users, BFS in memory — used to keep the legacy
 * "reassign downward within own chain" rule visible in pickers.
 */
export async function getSubordinateIds(userId: string): Promise<Set<string>> {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, supervisorId: true },
  });
  const children = new Map<string, string[]>();
  for (const u of users) {
    if (!u.supervisorId) continue;
    const list = children.get(u.supervisorId) ?? [];
    list.push(u.id);
    children.set(u.supervisorId, list);
  }
  const result = new Set<string>();
  const queue = [...(children.get(userId) ?? [])];
  while (queue.length > 0) {
    const next = queue.pop()!;
    if (result.has(next)) continue;
    result.add(next);
    queue.push(...(children.get(next) ?? []));
  }
  return result;
}

export type TransferTargetRow = {
  id: string;
  name: string;
  designation: string;
  divisionName: string;
  divisionColour: string;
  /** Short role marker for the picker row: 'Super Admin' | 'Division head' | null. */
  badge: string | null;
};

/**
 * Everyone the actor may transfer a task to, per the transfer matrix in
 * rules.ts. One user-list query plus two role queries; filtering happens
 * in memory (the ministry has well under a thousand users).
 */
export async function fetchTransferTargets(actor: RbacActor): Promise<TransferTargetRow[]> {
  const [users, headedByUser] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, id: { not: actor.id } },
      select: {
        id: true,
        name: true,
        designation: true,
        divisionId: true,
        isSuperAdmin: true,
        division: { select: { name: true, avatarColour: true } },
      },
      orderBy: { name: 'asc' },
    }),
    getHeadedDivisionsByUser(),
  ]);

  return users
    .filter((u) =>
      canTransferTaskTo(actor, {
        id: u.id,
        divisionId: u.divisionId,
        isSuperAdmin: u.isSuperAdmin,
        headedDivisionIds: headedByUser.get(u.id) ?? [],
        isActive: true,
      }),
    )
    .map((u) => ({
      id: u.id,
      name: u.name,
      designation: u.designation,
      divisionName: u.division.name,
      divisionColour: u.division.avatarColour,
      badge: u.isSuperAdmin
        ? 'Super Admin'
        : (headedByUser.get(u.id) ?? []).length > 0
          ? 'Division head'
          : null,
    }));
}
