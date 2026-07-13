import { prisma } from '@/lib/db';

import {
  canTransferTaskToOrLinked,
  linkedParticipantAbbreviations,
  type RbacActor,
  type RbacTarget,
} from './rules';

export * from './rules';

/**
 * Configured cross-division ALLOCATION links. A head/delegate of the KEY
 * division may allocate tasks to members of the listed divisions on top of the
 * normal matrix — where "allocate" means all three ways of putting work on a
 * user: creating a division task there (`canCreateDivisionTask`), assigning /
 * reassigning its owner (`canAssignTaskTo`), and transferring to it
 * (`canTransferTaskToOrLinked`). It grants only that reach, NOT full head
 * powers over the linked division.
 *
 * Divisions are keyed by their ABBREVIATION (e.g. 'KI', 'NSDF') — unlike the
 * display name, an abbreviation is set once at creation and has no admin edit
 * path, so a division rename in Structure & Hierarchy cannot silently break the
 * link. If no division carries the abbreviation, the link is simply skipped —
 * fail-closed: it only ever adds the extra reach, never removes a base-matrix
 * permission.
 *
 * Product rule: the Khelo India (KI) division head/delegate may allocate tasks
 * to NSDF members. Everything else stays on the base matrix.
 */
const CROSS_DIVISION_ALLOCATION_LINKS: Record<string, string[]> = {
  KI: ['NSDF'],
};

/**
 * Configured cross-division PARTICIPANT links — symmetric, unordered pairs keyed
 * by ABBREVIATION. Members of either division in a pair may take part in the
 * other division's tasks (both directions): as subtask assignees, collaborators,
 * and @mentions in the discussion. Open to ALL members, not just heads, and
 * grants participant reach only — no head powers, no board visibility (see
 * `linkedParticipantAbbreviations` in ./rules and PERMISSIONS §5.17).
 *
 * Product rule: Khelo India (KI) and Khelo India Mission (KIM) are each linked
 * with NSDF, so their members may collaborate across the boundary in either
 * direction. Add more pairs here. Resolution is fail-closed — an abbreviation
 * that matches no division simply drops that pair.
 */
const CROSS_DIVISION_PARTICIPANT_LINKS: readonly (readonly [string, string])[] = [
  ['KI', 'NSDF'],
  ['KIM', 'NSDF'],
];

/**
 * Division ids whose members may take part in a task belonging to
 * `taskDivisionId`, via `CROSS_DIVISION_PARTICIPANT_LINKS`. Resolves the task
 * division's abbreviation to its symmetric link targets, then those target
 * abbreviations back to division ids. Returns [] when the division is unknown,
 * carries no linked abbreviation, or no division matches a target abbreviation.
 */
export async function getLinkedParticipantDivisionIds(taskDivisionId: string): Promise<string[]> {
  const division = await prisma.division.findUnique({
    where: { id: taskDivisionId },
    select: { abbreviation: true },
  });
  if (!division) return [];

  const targetAbbrs = linkedParticipantAbbreviations(
    division.abbreviation,
    CROSS_DIVISION_PARTICIPANT_LINKS,
  );
  if (targetAbbrs.length === 0) return [];

  // `abbreviation` is not DB-unique, so resolve to EVERY division carrying a
  // target abbreviation (deterministic, not scan-order-dependent).
  const divisions = await prisma.division.findMany({
    where: { abbreviation: { in: targetAbbrs } },
    select: { id: true },
  });
  return divisions.map((d) => d.id);
}

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

/**
 * Extra divisions the actor may ALLOCATE tasks to (create / assign / transfer)
 * via `CROSS_DIVISION_ALLOCATION_LINKS`, resolved from the divisions they
 * currently head (direct + delegated). Returns [] for non-heads (the common
 * case) without touching the database.
 */
export async function getAllocatableDivisionIds(headedDivisionIds: string[]): Promise<string[]> {
  if (headedDivisionIds.length === 0) return [];

  const abbreviations = new Set<string>();
  for (const [head, targets] of Object.entries(CROSS_DIVISION_ALLOCATION_LINKS)) {
    abbreviations.add(head);
    for (const t of targets) abbreviations.add(t);
  }

  const divisions = await prisma.division.findMany({
    where: { abbreviation: { in: [...abbreviations] } },
    select: { id: true, abbreviation: true },
  });
  // Group ALL ids per abbreviation. `abbreviation` is not DB-unique (no
  // @unique / admin uniqueness check), so a misconfigured duplicate must be
  // handled deterministically — resolve the link to every division carrying
  // the abbreviation rather than a scan-order-dependent last-write-wins single.
  const idsByAbbr = new Map<string, string[]>();
  for (const d of divisions) {
    const list = idsByAbbr.get(d.abbreviation) ?? [];
    list.push(d.id);
    idsByAbbr.set(d.abbreviation, list);
  }
  const headed = new Set(headedDivisionIds);

  const extra = new Set<string>();
  for (const [headAbbr, targetAbbrs] of Object.entries(CROSS_DIVISION_ALLOCATION_LINKS)) {
    // Grant only when the actor heads a division carrying the KEY abbreviation.
    const headsKey = (idsByAbbr.get(headAbbr) ?? []).some((id) => headed.has(id));
    if (!headsKey) continue;
    for (const ta of targetAbbrs) {
      for (const tid of idsByAbbr.get(ta) ?? []) extra.add(tid);
    }
  }
  return [...extra];
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
  const allocatableDivisionIds = await getAllocatableDivisionIds(headedDivisionIds);
  return {
    id: user.id,
    divisionId: user.divisionId,
    isSuperAdmin: user.isSuperAdmin,
    isOsd: user.hierarchySlot === 'osd',
    headedDivisionIds,
    allocatableDivisionIds,
  };
}

/**
 * Who owns a task placed in a given division or PMU — resolved from
 * Structure & Hierarchy, the single source of truth:
 *   - PMU (kind = 'pmu')       → the active user with pmuRole
 *                                'pmu_team_leader' for that PMU.
 *   - Division / sub-div / section → the division's head
 *                                (divisions.head_user_id), if active.
 * Falls back to `fallbackOwnerId` (the creator, per product rule) when the
 * head or team leader is unset or inactive, so a task always has an owner.
 */
export async function resolveDivisionOwner(
  divisionId: string,
  fallbackOwnerId: string,
): Promise<string> {
  const division = await prisma.division.findUnique({
    where: { id: divisionId },
    select: { kind: true, headUserId: true },
  });
  if (!division) return fallbackOwnerId;

  if (division.kind === 'pmu') {
    const leader = await prisma.user.findFirst({
      where: { pmuId: divisionId, pmuRole: 'pmu_team_leader', isActive: true },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    return leader?.id ?? fallbackOwnerId;
  }

  if (division.headUserId) {
    const head = await prisma.user.findUnique({
      where: { id: division.headUserId },
      select: { id: true, isActive: true },
    });
    if (head?.isActive) return head.id;
  }
  return fallbackOwnerId;
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
      canTransferTaskToOrLinked(actor, {
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
