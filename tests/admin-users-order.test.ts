import { describe, expect, it } from 'vitest';

import {
  orderUsersByDivision,
  type OrderableDivision,
  type OrderableUser,
} from '@/lib/admin-users-order';

// Two top-level divisions, A before B by display order. Division A has a
// sub-division, a section, and a PMU; Division B is flat.
const divisions: OrderableDivision[] = [
  { id: 'A', name: 'Alpha', kind: 'division', parentId: null, pmuParentDivisionId: null, displayOrder: 0 },
  { id: 'B', name: 'Bravo', kind: 'division', parentId: null, pmuParentDivisionId: null, displayOrder: 1 },
  { id: 'A-sub', name: 'Alpha sub', kind: 'sub_division', parentId: 'A', pmuParentDivisionId: null, displayOrder: 0 },
  { id: 'A-sec', name: 'Alpha section', kind: 'section', parentId: 'A-sub', pmuParentDivisionId: null, displayOrder: 0 },
  { id: 'A-pmu', name: 'Alpha PMU', kind: 'pmu', parentId: null, pmuParentDivisionId: 'A', displayOrder: 0 },
];

function u(over: Partial<OrderableUser> & { id: string; name: string }): OrderableUser {
  return {
    username: over.name.toLowerCase(),
    divisionId: 'A',
    subDivisionId: null,
    sectionId: null,
    pmuId: null,
    isPmu: false,
    ...over,
  };
}

const names = (list: OrderableUser[]) => list.map((x) => x.id);

describe('orderUsersByDivision', () => {
  it('keeps divisions together, division A (lower displayOrder) before B', () => {
    const users = [
      u({ id: 'b1', name: 'Zed', divisionId: 'B' }),
      u({ id: 'a1', name: 'Yan', divisionId: 'A' }),
    ];
    expect(names(orderUsersByDivision(users, divisions))).toEqual(['a1', 'b1']);
  });

  it('orders tiers within a division: direct, sub-division, section, PMU', () => {
    const users = [
      u({ id: 'pmu', name: 'Pip', divisionId: 'A', isPmu: true, pmuId: 'A-pmu' }),
      u({ id: 'sec', name: 'Sam', divisionId: 'A', subDivisionId: 'A-sub', sectionId: 'A-sec' }),
      u({ id: 'sub', name: 'Sue', divisionId: 'A', subDivisionId: 'A-sub' }),
      u({ id: 'dir', name: 'Dan', divisionId: 'A' }),
    ];
    expect(names(orderUsersByDivision(users, divisions))).toEqual(['dir', 'sub', 'sec', 'pmu']);
  });

  it('sorts alphabetically by name within the same tier', () => {
    const users = [
      u({ id: 'c', name: 'Charlie', divisionId: 'A' }),
      u({ id: 'a', name: 'Aaron', divisionId: 'A' }),
      u({ id: 'b', name: 'Bella', divisionId: 'A' }),
    ];
    expect(names(orderUsersByDivision(users, divisions))).toEqual(['a', 'b', 'c']);
  });

  it('treats an isPmu member as PMU even when pmuId is unset (seed shape)', () => {
    const users = [
      u({ id: 'pmu', name: 'Pip', divisionId: 'A', isPmu: true, pmuId: null }),
      u({ id: 'dir', name: 'Zoe', divisionId: 'A' }),
    ];
    // Division-direct Zoe still precedes the PMU member despite Z > P.
    expect(names(orderUsersByDivision(users, divisions))).toEqual(['dir', 'pmu']);
  });

  it('does not mutate the input array', () => {
    const users = [u({ id: 'b', name: 'B', divisionId: 'B' }), u({ id: 'a', name: 'A', divisionId: 'A' })];
    const snapshot = names(users);
    orderUsersByDivision(users, divisions);
    expect(names(users)).toEqual(snapshot);
  });
});
