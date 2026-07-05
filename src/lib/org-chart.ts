/**
 * Pure org-chart partition — no React, no DB, so it is unit-testable.
 *
 * Splits a flat officer list into the three regions the hierarchy mapper
 * renders: the Unassigned pool, the chart roots, and each supervisor's
 * direct reports. The contract is TOTALITY: every input id appears
 * exactly once across (unassigned ∪ roots ∪ all children). No officer can
 * be silently dropped from the chart — the failure that hid PMU members
 * whose reporting line passed through someone outside the current view.
 */

export type ChartNodeInput = {
  id: string;
  /** null → no supervisor; may point outside the given node set. */
  supervisorId: string | null;
};

export type OrgPartition = {
  /** Officers with no supervisor — rendered in the Unassigned pool. */
  unassignedIds: string[];
  /** Top-of-chart officers (supervisor outside the view, or promoted). */
  rootIds: string[];
  /** parentId → direct-report ids, in input order; only reachable edges. */
  childrenByParent: Map<string, string[]>;
};

export function partitionOrgChart(nodes: ChartNodeInput[]): OrgPartition {
  const inView = new Set(nodes.map((n) => n.id));

  const unassignedIds: string[] = [];
  const chart: ChartNodeInput[] = [];
  for (const n of nodes) {
    if (!n.supervisorId) unassignedIds.push(n.id);
    else chart.push(n);
  }

  // Edges only between two in-view officers.
  const childrenByParent = new Map<string, string[]>();
  for (const n of chart) {
    if (n.supervisorId && inView.has(n.supervisorId)) {
      const list = childrenByParent.get(n.supervisorId) ?? [];
      list.push(n.id);
      childrenByParent.set(n.supervisorId, list);
    }
  }

  // Roots: supervisor is not another in-view officer.
  const rootIds = chart
    .filter((n) => !n.supervisorId || !inView.has(n.supervisorId))
    .map((n) => n.id);

  // Reachability sweep. Anything the roots cannot reach — a subtree whose
  // top reports to someone in the Unassigned pool, or a supervisor cycle —
  // is promoted to a root so it still renders, and its dangling child edge
  // is dropped so it is not ALSO nested somewhere.
  const reached = new Set<string>();
  const sweep = (startId: string) => {
    const stack = [startId];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (reached.has(id)) continue;
      reached.add(id);
      for (const kid of childrenByParent.get(id) ?? []) stack.push(kid);
    }
  };
  for (const id of rootIds) sweep(id);

  for (const n of chart) {
    if (reached.has(n.id)) continue;
    rootIds.push(n.id);
    if (n.supervisorId) {
      const siblings = childrenByParent.get(n.supervisorId);
      if (siblings) {
        childrenByParent.set(
          n.supervisorId,
          siblings.filter((k) => k !== n.id),
        );
      }
    }
    sweep(n.id);
  }

  return { unassignedIds, rootIds, childrenByParent };
}
