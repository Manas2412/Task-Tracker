import { describe, expect, it } from 'vitest';

import { buildTfVisibilityClause } from '@/lib/timeline-files';
import {
  canAccessTimelineFiles,
  TIMELINE_FILES_HIDDEN_SLOTS,
} from '@/lib/timeline-files-access';

describe('canAccessTimelineFiles', () => {
  it('bars the PMU Consultant slot', () => {
    expect(canAccessTimelineFiles('consultant')).toBe(false);
    expect(TIMELINE_FILES_HIDDEN_SLOTS).toContain('consultant');
  });

  it('allows every other slot', () => {
    for (const slot of ['osd', 'js', 'director', 'deputy_secretary', 'under_secretary', 'section_officer', 'aso', 'hmyas']) {
      expect(canAccessTimelineFiles(slot)).toBe(true);
    }
  });
});

describe('buildTfVisibilityClause', () => {
  const base = { id: 'u1', divisionId: 'div-ki', isSuperAdmin: false };

  it('returns a match-nothing clause for a barred slot (PMU Consultant)', async () => {
    const where = await buildTfVisibilityClause({ ...base, hierarchySlot: 'consultant' });
    expect(where).toEqual({ id: { in: [] } });
  });

  it('bars the consultant even when Super Admin flag is somehow set — barred check runs first', async () => {
    // Defence in depth: the module gate precedes any role grant.
    const where = await buildTfVisibilityClause({ ...base, hierarchySlot: 'consultant', isSuperAdmin: true });
    expect(where).toEqual({ id: { in: [] } });
  });

  it('grants everything to oversight roles', async () => {
    expect(await buildTfVisibilityClause({ ...base, hierarchySlot: 'osd' })).toEqual({});
    expect(await buildTfVisibilityClause({ ...base, hierarchySlot: 'js' })).toEqual({});
    expect(await buildTfVisibilityClause({ ...base, hierarchySlot: 'director', isSuperAdmin: true })).toEqual({});
  });

  it('scopes an ordinary officer to files marked to their division', async () => {
    const where = await buildTfVisibilityClause({ ...base, hierarchySlot: 'section_officer' });
    expect(where).toEqual({ markedTo: { some: { divisionId: 'div-ki' } } });
  });
});
