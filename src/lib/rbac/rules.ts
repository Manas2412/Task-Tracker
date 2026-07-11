/**
 * Division-based RBAC — pure rules.
 *
 * Three roles overlay the existing hierarchy model without replacing it:
 *
 *   super_admin   — users.is_super_admin = true. Unrestricted.
 *   division_head — the user is divisions.head_user_id for at least one
 *                   division, or holds an active DivisionAccessDelegation.
 *   division_user — everyone else.
 *
 * `headedDivisionIds` always means direct headships PLUS active
 * delegations — a delegate acts as the division's head for the whole
 * window (visibility, assignment, receiving transfers). The one thing a
 * delegate cannot do is re-delegate; see `canDelegateDivision`.
 *
 * This file must stay free of Prisma / database imports so the rules are
 * unit-testable in isolation. DB-backed context builders live in
 * `src/lib/rbac/index.ts`.
 */

export type RbacRole = 'super_admin' | 'division_head' | 'division_user';

export type RbacActor = {
  id: string;
  divisionId: string;
  isSuperAdmin: boolean;
  /** hierarchy_slot = 'osd' — the JS-office coordinator acts across divisions. */
  isOsd?: boolean;
  /** Divisions where the actor holds head powers — direct + delegated. */
  headedDivisionIds: string[];
  /**
   * Extra divisions this actor may ALLOCATE tasks to, beyond the base matrix —
   * configured cross-division links (see CROSS_DIVISION_ALLOCATION_LINKS in
   * `src/lib/rbac/index.ts`, e.g. a Khelo India head/delegate may give work to
   * NSDF members). "Allocate" covers all three ways of putting work on a user:
   * CREATING a division task in the linked division (`canCreateDivisionTask`),
   * directly ASSIGNING/reassigning its owner (`canAssignTaskTo`), and
   * TRANSFERRING to it (`canTransferTaskToOrLinked`). It grants only that reach
   * — NOT full head powers over the linked division (no delete, no visibility
   * of its board, no managing its existing tasks, no delegation). The
   * reassignment APPROVAL path stays on the base matrix. Populated by
   * `getRbacActor`; absent when there are no links for the actor.
   */
  allocatableDivisionIds?: string[];
};

export type RbacTarget = {
  id: string;
  divisionId: string;
  isSuperAdmin: boolean;
  headedDivisionIds: string[];
  isActive: boolean;
};

export function roleOf(actor: Pick<RbacActor, 'isSuperAdmin' | 'headedDivisionIds'>): RbacRole {
  if (actor.isSuperAdmin) return 'super_admin';
  if (actor.headedDivisionIds.length > 0) return 'division_head';
  return 'division_user';
}

/**
 * Is a delegation live at `now`? The window is inclusive on both ends and
 * a revocation wins over the window. Expiry is purely query/time-based —
 * no scheduled job flips anything.
 */
export function isDelegationActive(
  d: { startsAt: Date; endsAt: Date; revokedAt: Date | null },
  now: Date,
): boolean {
  if (d.revokedAt) return false;
  const t = now.getTime();
  return d.startsAt.getTime() <= t && t <= d.endsAt.getTime();
}

/**
 * Task transfer matrix (current owner hands the task off):
 *
 *   Super Admin   → anyone.
 *   Division Head → users in divisions they head or their home division,
 *                   another Division Head, or Super Admin.
 *   Division User → users in their own division, the head of their own
 *                   division, or Super Admin.
 *
 * Inactive targets and self-transfers are always rejected.
 */
export function canTransferTaskTo(actor: RbacActor, target: RbacTarget): boolean {
  if (!target.isActive || target.id === actor.id) return false;
  if (actor.isSuperAdmin) return true;
  if (target.isSuperAdmin) return true;

  if (roleOf(actor) === 'division_head') {
    if (target.headedDivisionIds.length > 0) return true;
    return (
      target.divisionId === actor.divisionId ||
      actor.headedDivisionIds.includes(target.divisionId)
    );
  }

  if (target.divisionId === actor.divisionId) return true;
  return target.headedDivisionIds.includes(actor.divisionId);
}

/**
 * Transfer target check for the Transfer-task flow: the base matrix
 * (`canTransferTaskTo`) PLUS any configured cross-division allocation links
 * carried on `actor.allocatableDivisionIds` (e.g. a Khelo India head/delegate
 * may hand tasks to NSDF members). The reassignment APPROVAL matrix deliberately
 * stays on the base rule, so cross-division owner *proposals* remain blocked;
 * all other transfer logic is unchanged.
 */
export function canTransferTaskToOrLinked(actor: RbacActor, target: RbacTarget): boolean {
  if (canTransferTaskTo(actor, target)) return true;
  if (!target.isActive || target.id === actor.id) return false;
  return (actor.allocatableDivisionIds ?? []).includes(target.divisionId);
}

/**
 * Assignment matrix (setting a task's owner directly, without the
 * target's consent): Super Admin assigns anywhere; a Division Head within
 * divisions they head (their home division counts while they hold any
 * headship) OR a cross-division allocation link (e.g. a Khelo India
 * head/delegate may assign to NSDF members). Division users cannot assign
 * directly — they go through transfer (with a mandatory comment) or the
 * approval flow.
 */
export function canAssignTaskTo(actor: RbacActor, target: RbacTarget): boolean {
  if (!target.isActive) return false;
  if (actor.isSuperAdmin) return true;
  if (actor.headedDivisionIds.length === 0) return false;
  return (
    actor.headedDivisionIds.includes(target.divisionId) ||
    target.divisionId === actor.divisionId ||
    (actor.allocatableDivisionIds ?? []).includes(target.divisionId)
  );
}

/** Head powers over one specific division (curation, free reassignment of its tasks). */
export function canActAsHeadOf(actor: RbacActor, divisionId: string): boolean {
  if (actor.isSuperAdmin) return true;
  return actor.headedDivisionIds.includes(divisionId);
}

/**
 * Division-level task creation (visibility: 'division') — giving work on a
 * division's board is reserved for Super Admin, OSD, the division's head or an
 * active delegate (`headedDivisionIds` covers direct + delegated), OR a head
 * with a cross-division allocation link into that division (e.g. a Khelo India
 * head/delegate may create division tasks for NSDF). Everyone else creates
 * personal tasks only. The same rule also gates changing an existing task's
 * visibility. (Moving a task into a different division is a separate,
 * Super-Admin/OSD-only gate in `updateTaskFieldsAction` — not this rule.)
 */
export function canCreateDivisionTask(actor: RbacActor, divisionId: string): boolean {
  if (actor.isSuperAdmin || actor.isOsd) return true;
  return (
    actor.headedDivisionIds.includes(divisionId) ||
    (actor.allocatableDivisionIds ?? []).includes(divisionId)
  );
}

/**
 * Who may MANAGE a task — edit its status / priority / description / subtasks
 * and add or remove its collaborators. The rule is the single source of truth
 * behind the server `canEditTask` guard (see src/app/actions/tasks.ts) and the
 * task-detail page's edit affordances, so the UI never shows a control the
 * server would refuse (nor hides one it would allow).
 *
 * Granted to:
 *   - the current owner or the ORIGINAL creator — the creator keeps management
 *     rights even after ownership is handed to someone else, so a Head / OSD /
 *     Super Admin who set up a task can still curate its collaborators;
 *   - a Super Admin, OSD, or JS (whole-office oversight);
 *   - a Director of the task's own division;
 *   - the head of the task's division — INCLUDING an active delegate, since
 *     `headedDivisionIds` folds in live delegations. A delegate is the
 *     temporary head for the delegation's lifetime and manages its tasks
 *     exactly as the head would.
 *
 * Pure so it can be unit-tested and shared verbatim by client and server.
 */
export function canManageTask(
  caller: {
    id: string;
    isSuperAdmin: boolean;
    hierarchySlot: string;
    divisionId: string;
    headedDivisionIds: string[];
  },
  task: { ownerId: string; createdById: string; divisionId: string },
): boolean {
  if (task.ownerId === caller.id || task.createdById === caller.id) return true;
  if (caller.isSuperAdmin) return true;
  if (caller.hierarchySlot === 'osd' || caller.hierarchySlot === 'js') return true;
  if (caller.hierarchySlot === 'director' && caller.divisionId === task.divisionId) return true;
  return caller.headedDivisionIds.includes(task.divisionId);
}

/**
 * Only the direct head (divisions.head_user_id) or a Super Admin can
 * delegate a division's access — a delegate cannot re-delegate.
 */
export function canDelegateDivision(
  actor: { id: string; isSuperAdmin: boolean },
  division: { headUserId: string | null },
): boolean {
  if (actor.isSuperAdmin) return true;
  return division.headUserId !== null && division.headUserId === actor.id;
}

/**
 * Who may receive a delegation: another direct Division Head, a user in
 * the delegated division, or a user in the delegator's home division.
 * The delegator themselves and inactive users never qualify.
 */
export function isEligibleDelegate(
  target: {
    id: string;
    isActive: boolean;
    divisionId: string;
    directHeadedDivisionIds: string[];
  },
  ctx: { divisionId: string; delegatorId: string; delegatorHomeDivisionId: string },
): boolean {
  if (!target.isActive || target.id === ctx.delegatorId) return false;
  if (target.directHeadedDivisionIds.length > 0) return true;
  return (
    target.divisionId === ctx.divisionId ||
    target.divisionId === ctx.delegatorHomeDivisionId
  );
}

/** Longest delegation we accept. Generous, but keeps "temporary" honest. */
export const MAX_DELEGATION_DAYS = 366;

/**
 * Validate a delegation window. Returns a sentence-case error message, or
 * null when the window is acceptable. `now` is injected for testability.
 * Windows may start in the future; they must not already be over.
 */
export function validateDelegationWindow(opts: {
  startsAt: Date;
  endsAt: Date;
  now: Date;
}): string | null {
  const { startsAt, endsAt, now } = opts;
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return 'Dates are invalid.';
  }
  if (endsAt.getTime() < startsAt.getTime()) {
    return 'End date cannot be before the start date.';
  }
  if (endsAt.getTime() < now.getTime()) {
    return 'End date cannot be in the past.';
  }
  const days = (endsAt.getTime() - startsAt.getTime()) / (24 * 60 * 60 * 1000);
  if (days > MAX_DELEGATION_DAYS) {
    return 'Delegations can cover at most one year.';
  }
  return null;
}
