import { describe, expect, it } from 'vitest';

import {
  ALL_KINDS,
  buildCalendarHref,
  parseCalendarFilters,
  toggleKindParam,
} from '@/app/(app)/calendar/_components/filter-params';

describe('parseCalendarFilters', () => {
  it('defaults to all kinds and no narrowing', () => {
    const f = parseCalendarFilters({});
    expect([...f.kinds].sort()).toEqual([...ALL_KINDS].sort());
    expect(f.mine).toBe(false);
    expect(f.divisionId).toBeUndefined();
    expect(f.priority).toBeUndefined();
    expect(f.status).toBeUndefined();
  });

  it('reads a subset of kinds', () => {
    const f = parseCalendarFilters({ types: 'task,tf' });
    expect([...f.kinds].sort()).toEqual(['task', 'tf']);
  });

  it('ignores garbage kinds and never returns an empty set', () => {
    expect(parseCalendarFilters({ types: 'bogus' }).kinds.size).toBe(ALL_KINDS.length);
    expect(parseCalendarFilters({ types: '' }).kinds.size).toBe(ALL_KINDS.length);
  });

  it('accepts valid priority/status and rejects invalid', () => {
    expect(parseCalendarFilters({ priority: 'urgent' }).priority).toBe('urgent');
    expect(parseCalendarFilters({ priority: 'nope' }).priority).toBeUndefined();
    expect(parseCalendarFilters({ status: 'in_progress' }).status).toBe('in_progress');
    expect(parseCalendarFilters({ status: 'closed' }).status).toBeUndefined();
  });

  it('mine is on only for the literal "1"', () => {
    expect(parseCalendarFilters({ mine: '1' }).mine).toBe(true);
    expect(parseCalendarFilters({ mine: 'true' }).mine).toBe(false);
  });
});

describe('toggleKindParam', () => {
  it('turning one off from the default serialises the remaining two', () => {
    const all = new Set(ALL_KINDS);
    expect(toggleKindParam(all, 'engagement')).toBe('task,tf');
  });

  it('turning the last one back on collapses to null (= all, param dropped)', () => {
    const two = new Set<'task' | 'tf' | 'engagement'>(['task', 'tf']);
    expect(toggleKindParam(two, 'engagement')).toBeNull();
  });

  it('never produces an empty selection — it resets to all', () => {
    const one = new Set<'task' | 'tf' | 'engagement'>(['task']);
    expect(toggleKindParam(one, 'task')).toBe(ALL_KINDS.join(','));
  });
});

describe('buildCalendarHref', () => {
  it('preserves existing params and applies overrides', () => {
    const href = buildCalendarHref({ view: 'week', date: '2026-07-06' }, { mine: '1' });
    expect(href).toContain('view=week');
    expect(href).toContain('date=2026-07-06');
    expect(href).toContain('mine=1');
  });

  it('drops a param when the override is null', () => {
    const href = buildCalendarHref({ view: 'month', mine: '1' }, { mine: null });
    expect(href).not.toContain('mine');
    expect(href).toContain('view=month');
  });

  it('returns the bare path when nothing remains', () => {
    expect(buildCalendarHref({}, {})).toBe('/calendar');
  });
});
