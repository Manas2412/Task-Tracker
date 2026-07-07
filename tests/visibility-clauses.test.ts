import { describe, expect, it } from 'vitest';

import {
  buildVisibilityClausesFrom,
  type CallerSummary,
} from '@/lib/visibility-rules';

const KI = 'div-ki';
const NSDF = 'div-nsdf';
const ABD = 'div-abd';

function caller(overrides: Partial<CallerSummary> = {}): CallerSummary {
  return {
    id: 'me',
    hierarchySlot: 'aso',
    isSuperAdmin: false,
    divisionId: KI,
    isPmu: false,
    ...overrides,
  };
}

/** The division-scope clause pushed after the own/collaborator pair. */
function divisionClause(clauses: ReturnType<typeof buildVisibilityClausesFrom>) {
  return clauses.find(
    (c) => 'divisionId' in c && c.visibility === 'division',
  ) as { divisionId?: { in?: string[] } } | undefined;
}

describe('buildVisibilityClausesFrom — base clauses', () => {
  it('always includes own, collaborated, and personal-created tasks first', () => {
    const clauses = buildVisibilityClausesFrom(caller(), []);
    expect(clauses[0]).toEqual({ ownerId: 'me' });
    expect(clauses[1]).toEqual({ collaborators: { some: { userId: 'me' } } });
    expect(clauses[2]).toEqual({ createdById: 'me', visibility: 'personal' });
  });

  it('the creator can see a personal task they created but assigned away', () => {
    // A Division Head / Super Admin who sets a task Personal and assigns it
    // to someone else keeps it in their own Personal list.
    const clauses = buildVisibilityClausesFrom(caller(), []);
    expect(clauses).toContainEqual({ createdById: 'me', visibility: 'personal' });
  });

  it('never emits a clause that matches personal tasks by role', () => {
    // Every role-based clause must be gated on visibility: 'division';
    // personal tasks are only reachable via the three base clauses
    // (owner / collaborator / creator).
    const variants: CallerSummary[] = [
      caller({ isSuperAdmin: true }),
      caller({ hierarchySlot: 'osd' }),
      caller({ hierarchySlot: 'js' }),
      caller({ hierarchySlot: 'director' }),
      caller({ hierarchySlot: 'aso' }),
      caller({ isPmu: true }),
    ];
    for (const v of variants) {
      const clauses = buildVisibilityClausesFrom(v, [NSDF]);
      for (const c of clauses.slice(3)) {
        expect(c.visibility).toBe('division');
      }
    }
  });
});

describe('buildVisibilityClausesFrom — roles', () => {
  it('super admin and OSD see everything non-personal, division-unfiltered', () => {
    for (const me of [caller({ isSuperAdmin: true }), caller({ hierarchySlot: 'osd' })]) {
      const clauses = buildVisibilityClausesFrom(me, []);
      expect(clauses).toHaveLength(4);
      expect(clauses[3]).toEqual({ visibility: 'division' });
    }
  });

  it('a ministry officer sees their own division', () => {
    const clauses = buildVisibilityClausesFrom(caller({ hierarchySlot: 'aso' }), []);
    expect(divisionClause(clauses)?.divisionId?.in).toEqual([KI]);
  });

  it('all division users see division tasks regardless of who created them', () => {
    // The clause filters on divisionId + visibility only — no ownerId or
    // createdById restriction, so Super Admin- or head-created tasks in
    // the division are visible to every division user.
    const clauses = buildVisibilityClausesFrom(caller({ hierarchySlot: 'section_officer' }), []);
    const clause = divisionClause(clauses);
    expect(clause).toBeDefined();
    expect(Object.keys(clause as object).sort()).toEqual(['divisionId', 'visibility']);
  });

  it('a division head sees home plus every headed division', () => {
    // Zuber: home ABD, heads ABD + NSDF.
    const clauses = buildVisibilityClausesFrom(
      caller({ divisionId: ABD, hierarchySlot: 'deputy_secretary' }),
      [ABD, NSDF],
    );
    expect(divisionClause(clauses)?.divisionId?.in?.sort()).toEqual([ABD, NSDF].sort());
  });

  it('a delegate gains the delegated division for the window', () => {
    const clauses = buildVisibilityClausesFrom(caller({ divisionId: KI }), [NSDF]);
    expect(divisionClause(clauses)?.divisionId?.in?.sort()).toEqual([KI, NSDF].sort());
  });

  it('JS keeps the priority-board surface', () => {
    const clauses = buildVisibilityClausesFrom(caller({ hierarchySlot: 'js' }), []);
    expect(clauses[3]).toEqual({
      visibility: 'division',
      jsPriorityLane: { not: null },
    });
    expect(clauses).toHaveLength(4);
  });

  it('a PMU member with no teammates loaded sees own + collaborated + created only', () => {
    const clauses = buildVisibilityClausesFrom(caller({ isPmu: true }), []);
    expect(clauses).toHaveLength(3);
  });

  it("PMU members see their PMU team's tasks, never the whole division", () => {
    const team = ['me', 'mate-1', 'mate-2'];
    const clauses = buildVisibilityClausesFrom(caller({ isPmu: true }), [], team);
    // 3 base clauses + the owner-scoped PMU clause — no division clause.
    expect(clauses).toHaveLength(4);
    expect(clauses[3]).toEqual({ visibility: 'division', ownerId: { in: team } });
    // Crucially, no bare divisionId clause that would leak the division board.
    expect(clauses.some((c) => 'divisionId' in c)).toBe(false);
  });

  it('a PMU delegate still gains the delegated division on top of their team', () => {
    const clauses = buildVisibilityClausesFrom(caller({ isPmu: true }), [NSDF], ['me']);
    // The delegated-division clause is still present…
    expect(divisionClause(clauses)?.divisionId?.in).toEqual([NSDF]);
    // …alongside the PMU-team owner clause.
    expect(clauses).toContainEqual({ visibility: 'division', ownerId: { in: ['me'] } });
  });
});
