import { describe, expect, it } from 'vitest';

import { partitionOrgChart, type ChartNodeInput } from '@/lib/org-chart';

/**
 * Collect every id the mapper would render: pool + roots + all children.
 * The core invariant is that this equals the input set exactly, with no
 * duplicates — the bug that hid SGM_PMU members was a violation of it.
 */
function renderedIds(nodes: ChartNodeInput[]): string[] {
  const p = partitionOrgChart(nodes);
  const out = [...p.unassignedIds, ...p.rootIds];
  for (const kids of p.childrenByParent.values()) out.push(...kids);
  return out;
}

function expectRendersEveryoneOnce(nodes: ChartNodeInput[]) {
  const rendered = renderedIds(nodes);
  expect(new Set(rendered).size).toBe(rendered.length); // no duplicates
  expect(new Set(rendered)).toEqual(new Set(nodes.map((n) => n.id))); // total
}

describe('partitionOrgChart — totality (nobody is dropped)', () => {
  it('handles a simple in-view chain', () => {
    const nodes: ChartNodeInput[] = [
      { id: 'head', supervisorId: null },
      { id: 'tl', supervisorId: 'head' },
      { id: 'c1', supervisorId: 'tl' },
      { id: 'c2', supervisorId: 'tl' },
    ];
    expectRendersEveryoneOnce(nodes);
    const p = partitionOrgChart(nodes);
    expect(p.unassignedIds).toEqual(['head']);
    expect(p.childrenByParent.get('tl')).toEqual(['c1', 'c2']);
  });

  it('renders officers whose supervisor is OUTSIDE the view (the PMU case)', () => {
    // SGM_PMU shown alone: the team's supervisor (Harilal) is the division
    // head, injected into the view; but if he were NOT injected, the team
    // lead must still appear as a root rather than vanish.
    const nodes: ChartNodeInput[] = [
      { id: 'tl', supervisorId: 'harilal-outside' },
      { id: 'c1', supervisorId: 'tl' },
      { id: 'c2', supervisorId: 'tl' },
      { id: 'c3', supervisorId: 'tl' },
      { id: 'c4', supervisorId: 'tl' },
    ];
    expectRendersEveryoneOnce(nodes);
    const p = partitionOrgChart(nodes);
    expect(p.rootIds).toContain('tl');
    expect(p.childrenByParent.get('tl')?.sort()).toEqual(['c1', 'c2', 'c3', 'c4']);
  });

  it('promotes a subtree whose top reports into the Unassigned pool', () => {
    // 'lead' is unassigned (pool); 'a' reports to 'lead'. 'a' is reachable
    // only through a pool member, so it must be promoted, not dropped.
    const nodes: ChartNodeInput[] = [
      { id: 'lead', supervisorId: null },
      { id: 'a', supervisorId: 'lead' },
      { id: 'b', supervisorId: 'a' },
    ];
    expectRendersEveryoneOnce(nodes);
    const p = partitionOrgChart(nodes);
    expect(p.unassignedIds).toEqual(['lead']);
    // 'a' is promoted to a root; 'b' nests under it once.
    expect(p.rootIds).toContain('a');
    expect(p.childrenByParent.get('a')).toEqual(['b']);
  });

  it('does not render a promoted node twice (edge is dropped)', () => {
    const nodes: ChartNodeInput[] = [
      { id: 'pool', supervisorId: null },
      { id: 'x', supervisorId: 'pool' },
    ];
    const p = partitionOrgChart(nodes);
    // 'x' is a root, and must NOT also appear as a child of 'pool'.
    expect(p.rootIds).toContain('x');
    expect(p.childrenByParent.get('pool') ?? []).not.toContain('x');
    expectRendersEveryoneOnce(nodes);
  });

  it('survives a supervisor cycle without dropping or infinite-looping', () => {
    const nodes: ChartNodeInput[] = [
      { id: 'a', supervisorId: 'b' },
      { id: 'b', supervisorId: 'a' },
      { id: 'c', supervisorId: 'a' },
    ];
    expectRendersEveryoneOnce(nodes);
  });

  it('handles a mixed division: chain + external report + pool', () => {
    const nodes: ChartNodeInput[] = [
      { id: 'dir', supervisorId: 'osd-outside' }, // root (external sup)
      { id: 'so', supervisorId: 'dir' },
      { id: 'aso1', supervisorId: 'so' },
      { id: 'aso2', supervisorId: 'so' },
      { id: 'floater', supervisorId: null }, // pool
      { id: 'orphan', supervisorId: 'floater' }, // promoted from pool parent
    ];
    expectRendersEveryoneOnce(nodes);
    const p = partitionOrgChart(nodes);
    expect(p.rootIds).toContain('dir');
    expect(p.rootIds).toContain('orphan');
    expect(p.unassignedIds).toEqual(['floater']);
  });

  it('handles an empty division', () => {
    expect(renderedIds([])).toEqual([]);
  });

  it('handles everyone-unassigned', () => {
    const nodes: ChartNodeInput[] = [
      { id: 'a', supervisorId: null },
      { id: 'b', supervisorId: null },
    ];
    const p = partitionOrgChart(nodes);
    expect(p.unassignedIds.sort()).toEqual(['a', 'b']);
    expect(p.rootIds).toEqual([]);
    expectRendersEveryoneOnce(nodes);
  });
});
