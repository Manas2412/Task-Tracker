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
  it('always includes own tasks and collaborations first', () => {
    const clauses = buildVisibilityClausesFrom(caller(), []);
    expect(clauses[0]).toEqual({ ownerId: 'me' });
    expect(clauses[1]).toEqual({ collaborators: { some: { userId: 'me' } } });
  });

  it('never emits a clause that matches personal tasks by role', () => {
    // Every role-based clause must be gated on visibility: 'division';
    // personal tasks are only reachable via owner/collaborator clauses.
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
      for (const c of clauses.slice(2)) {
        expect(c.visibility).toBe('division');
      }
    }
  });
});

describe('buildVisibilityClausesFrom — roles', () => {
  it('super admin and OSD see everything non-personal, division-unfiltered', () => {
    for (const me of [caller({ isSuperAdmin: true }), caller({ hierarchySlot: 'osd' })]) {
      const clauses = buildVisibilityClausesFrom(me, []);
      expect(clauses).toHaveLength(3);
      expect(clauses[2]).toEqual({ visibility: 'division' });
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
    expect(clauses[2]).toEqual({
      visibility: 'division',
      jsPriorityLane: { not: null },
    });
    expect(clauses).toHaveLength(3);
  });

  it('PMU members stay isolated: own + collaborated only', () => {
    const clauses = buildVisibilityClausesFrom(caller({ isPmu: true }), []);
    expect(clauses).toHaveLength(2);
  });

  it('a PMU delegate still gains the delegated division', () => {
    const clauses = buildVisibilityClausesFrom(caller({ isPmu: true }), [NSDF]);
    expect(divisionClause(clauses)?.divisionId?.in).toEqual([NSDF]);
  });
});
