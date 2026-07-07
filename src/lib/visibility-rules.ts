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

  const divisionIds = new Set(headedDivisionIds);

  if (me.hierarchySlot === 'js') {
    // JS sees own + the JS Priority Board surface, plus any division they
    // happen to head or hold a delegation for.
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
    if (divisionIds.size > 0) {
      clauses.push({ visibility: 'division', divisionId: { in: [...divisionIds] } });
    }
    return clauses;
  }

  // Ministry officers (director down to ASO) — all non-personal tasks in
  // their own division, plus every division they head. Without the own-
  // division clause a fresh division user saw an empty board on first login.
  divisionIds.add(me.divisionId);
  clauses.push({ visibility: 'division', divisionId: { in: [...divisionIds] } });
  return clauses;
}
