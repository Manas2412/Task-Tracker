import { describe, expect, it } from 'vitest';

import { taskListOrderBy } from '@/lib/visibility';
import { tfListOrderBy } from '@/lib/timeline-files';

/**
 * List sort ordering for the Tasks and Timeline Files panels. Both panels
 * expose the same three modes — Default order, "Recently modified" (latest),
 * and A–Z (alpha) — and must resolve to consistent, deterministic Prisma
 * `orderBy` clauses. "Recently modified" sorts by lastActivityAt (the last
 * meaningful update), so freshly created rows — whose lastActivityAt equals
 * createdAt — also surface at the top.
 */
describe('taskListOrderBy', () => {
  it('sorts "Recently modified" by lastActivityAt desc, then createdAt', () => {
    expect(taskListOrderBy('latest')).toEqual([
      { lastActivityAt: 'desc' },
      { createdAt: 'desc' },
    ]);
  });

  it('sorts A–Z by task name asc, with a deterministic tiebreaker', () => {
    expect(taskListOrderBy('alpha')).toEqual([
      { name: 'asc' },
      { createdAt: 'desc' },
    ]);
  });

  it('keeps the default smart order (JS Priority, due date, priority, newest)', () => {
    expect(taskListOrderBy('default')).toEqual([
      { jsPriorityLane: { sort: 'asc', nulls: 'last' } },
      { dueDate: { sort: 'asc', nulls: 'last' } },
      { priority: 'desc' },
      { createdAt: 'desc' },
    ]);
  });

  it('never leads with lastActivityAt outside "Recently modified"', () => {
    for (const sort of ['default', 'alpha'] as const) {
      expect(Object.keys(taskListOrderBy(sort)[0])).not.toContain('lastActivityAt');
    }
  });
});

describe('tfListOrderBy', () => {
  it('sorts "Recently modified" by lastActivityAt desc, then receivedDate', () => {
    expect(tfListOrderBy('latest')).toEqual([
      { lastActivityAt: 'desc' },
      { receivedDate: 'desc' },
    ]);
  });

  it('sorts A–Z by subject asc, with a deterministic tiebreaker', () => {
    expect(tfListOrderBy('alpha')).toEqual([
      { subject: 'asc' },
      { receivedDate: 'desc' },
    ]);
  });

  it('keeps the default order (open first, soonest deadline, newest)', () => {
    expect(tfListOrderBy('default')).toEqual([
      { status: 'asc' },
      { deadlineDate: { sort: 'asc', nulls: 'last' } },
      { receivedDate: 'desc' },
    ]);
  });
});
