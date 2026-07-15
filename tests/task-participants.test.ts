import { describe, expect, it } from 'vitest';

import {
  buildTaskParticipantWhereFrom,
  type ParticipantTask,
} from '@/lib/task-participants';

const DIV = 'div-ki';
const PMU = 'div-pmu';
const OJS = 'div-ojs';
const HEAD = 'user-head';

function task(overrides: Partial<ParticipantTask> = {}): ParticipantTask {
  return {
    divisionId: DIV,
    division: { kind: 'division', headUserId: HEAD },
    ...overrides,
  };
}

describe('buildTaskParticipantWhereFrom', () => {
  it('a division task: members (home + granted) + head + OSD + Super Admin', () => {
    const where = buildTaskParticipantWhereFrom(task(), HEAD, OJS);
    expect(where.isActive).toBe(true);
    expect(where.OR).toEqual([
      { divisionId: DIV },
      { hierarchySlot: 'osd' },
      { isSuperAdmin: true },
      // Admin-granted extra members of the division participate like home members.
      { divisionAccess: { some: { divisionId: DIV } } },
      { id: HEAD },
    ]);
  });

  it('a PMU task does NOT add the division-membership clause', () => {
    // Extra memberships are division-level (never a PMU), so a PMU task stays
    // pmu_id-scoped.
    const where = buildTaskParticipantWhereFrom(
      task({ divisionId: PMU, division: { kind: 'pmu', headUserId: null } }),
      HEAD,
      OJS,
    );
    expect(where.OR).not.toContainEqual({ divisionAccess: { some: { divisionId: PMU } } });
  });

  it('a PMU task scopes members by pmuId, not divisionId', () => {
    const where = buildTaskParticipantWhereFrom(
      task({ divisionId: PMU, division: { kind: 'pmu', headUserId: null } }),
      HEAD,
      OJS,
    );
    expect(where.OR).toContainEqual({ pmuId: PMU });
    expect(where.OR).not.toContainEqual({ divisionId: PMU });
    // Oversight + the resolved (parent-division) head are still included.
    expect(where.OR).toContainEqual({ hierarchySlot: 'osd' });
    expect(where.OR).toContainEqual({ isSuperAdmin: true });
    expect(where.OR).toContainEqual({ id: HEAD });
  });

  it('Office of JS admits any active user (no OR restriction)', () => {
    const where = buildTaskParticipantWhereFrom(
      task({ divisionId: OJS }),
      HEAD,
      OJS,
    );
    expect(where).toEqual({ isActive: true });
  });

  it('omits the head clause when the division has no head', () => {
    const where = buildTaskParticipantWhereFrom(
      task({ division: { kind: 'division', headUserId: null } }),
      null,
      OJS,
    );
    expect(where.OR).toEqual([
      { divisionId: DIV },
      { hierarchySlot: 'osd' },
      { isSuperAdmin: true },
      { divisionAccess: { some: { divisionId: DIV } } },
    ]);
    expect(where.OR).not.toContainEqual({ id: null });
  });

  it('still restricts when Office-of-JS id is unknown (null)', () => {
    // A null OJS id must not accidentally widen a normal division to everyone.
    const where = buildTaskParticipantWhereFrom(task(), HEAD, null);
    expect(where.OR).toBeDefined();
    expect(where.OR).toContainEqual({ divisionId: DIV });
  });
});
