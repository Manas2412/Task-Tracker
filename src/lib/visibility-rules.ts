import type { Prisma } from '@prisma/client';

/**
 * Pure task-visibility clause builder — no database imports, so the
 * rules are unit-testable in isolation. `src/lib/visibility.ts` wraps
 * this with the DB-backed headship lookup; everything else should import
 * from there.
 */

export type CallerSummary = {
  id: string;
  hierarchySlot: string;
  isSuperAdmin: boolean;
  divisionId: string;
  isPmu: boolean;
  /** The caller's PMU id (users.pmu_id), or null when not a PMU member. */
  pmuId: string | null;
};

/** Extra caller facts resolved from the DB, injected into the pure builder. */
export type VisibilityOptions = {
  /**
   * True when the caller is the head of their PMU's home (parent) division.
   * That head is excluded from the "shared with the PMU team" clause — they
   * still see such a task via the owner-scoped PMU clause, but it is not
   * surfaced to them as a whole-team share.
   */
  isPmuParentDivisionHead?: boolean;
  /**
   * Divisions the caller is a MEMBER of: their home division plus any
   * admin-granted extra divisions (user_division_access). Grants FULL board
   * visibility of each division's non-personal tasks. The home division is
   * handled per role — an officer always sees their home board, a PMU member
   * does NOT (PMU isolation is preserved), and a JS user sees the priority
   * board rather than a home board — so only the EXTRA granted divisions widen
   * the JS/PMU branches. Defaults to [me.divisionId] (home-only) when omitted.
   * Populated by buildVisibilityClauses; this replaces the retired
   * cross-division allocation-link visibility.
   */
  memberDivisionIds?: string[];
};

/**
 * Build the OR-of-visibility-clauses for a caller from an injected list
 * of divisions they head (direct headships + active delegations) and, for
 * PMU members, the ids of everyone in their PMU (themselves + teammates).
 *
 * Personal-visibility tasks never match any role clause — only the three
 * base clauses at the top (owner, collaborator, creator). A Personal task
 * is therefore visible to exactly: the assigned owner, users explicitly
 * added as collaborators, and its creator (e.g. a Division Head / Super
 * Admin who set it Personal and assigned it to someone) — and no one else.
 */
export function buildVisibilityClausesFrom(
  me: CallerSummary,
  headedDivisionIds: string[],
  pmuMemberIds: string[] = [],
  opts: VisibilityOptions = {},
): Prisma.TaskWhereInput[] {
  const clauses: Prisma.TaskWhereInput[] = [
    // Always: tasks I own.
    { ownerId: me.id },
    // Always: tasks I'm explicitly added to as a collaborator.
    { collaborators: { some: { userId: me.id } } },
    // Personal tasks I created — so the creator keeps sight of a Personal
    // task even after assigning it to someone else. Scoped to `personal`
    // so it never widens division-task visibility (division tasks I created
    // are already covered by the role clauses below).
    { createdById: me.id, visibility: 'personal' },
  ];

  if (me.isSuperAdmin || me.hierarchySlot === 'osd') {
    // Super Admin + OSD see all non-personal tasks across the ministry.
    clauses.push({ visibility: 'division' });
    return clauses;
  }

  // The caller's member divisions (home + admin-granted extras). The EXTRA
  // grants (member set minus home) widen every role's board; home is added only
  // in the officer branch, so PMU isolation and the JS surface are preserved
  // for callers with no extra grants.
  const memberDivisionIds = opts.memberDivisionIds ?? [me.divisionId];
  const extraDivisionIds = memberDivisionIds.filter((d) => d !== me.divisionId);

  const divisionIds = new Set(headedDivisionIds);
  for (const d of extraDivisionIds) divisionIds.add(d);

  if (me.hierarchySlot === 'js') {
    // JS sees own + the JS Priority Board surface, plus any division they head
    // or hold a delegation for, plus any admin-granted extra division board.
    clauses.push({
      visibility: 'division',
      jsPriorityLane: { not: null },
    });
    if (divisionIds.size > 0) {
      clauses.push({ visibility: 'division', divisionId: { in: [...divisionIds] } });
    }
    return clauses;
  }

  if (me.isPmu) {
    // PMU isolation (PERMISSIONS.md §5.2): a PMU team member sees the
    // tasks of their own PMU — those owned by anyone in the PMU
    // (themselves + teammates) — but never the division's internal
    // ministry tasks. A delegation still grants head-level visibility
    // over the delegated division.
    if (pmuMemberIds.length > 0) {
      clauses.push({ visibility: 'division', ownerId: { in: pmuMemberIds } });
    }
    // Tasks a PMU team leader explicitly shared with the whole PMU team.
    // Live: matches any current member of the caller's PMU at read time.
    // The PMU's home-division head is excluded (they already see it via the
    // owner-scoped clause; it is just not treated as a whole-team share).
    if (me.pmuId && !opts.isPmuParentDivisionHead) {
      clauses.push({
        visibility: 'division',
        sharedWithPmuTeam: true,
        divisionId: me.pmuId,
      });
    }
    if (divisionIds.size > 0) {
      clauses.push({ visibility: 'division', divisionId: { in: [...divisionIds] } });
    }
    return clauses;
  }

  // Ministry officers (director down to ASO) — all non-personal tasks in every
  // division they are a MEMBER of (home + admin-granted extras), plus every
  // division they head. Without the home-division clause a fresh division user
  // saw an empty board on first login.
  divisionIds.add(me.divisionId);
  clauses.push({ visibility: 'division', divisionId: { in: [...divisionIds] } });
  return clauses;
}
