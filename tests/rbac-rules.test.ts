import { describe, expect, it } from 'vitest';

import {
  canActAsHeadOf,
  canAssignTaskTo,
  canCreateDivisionTask,
  canDelegateDivision,
  canManageTask,
  canTransferTaskTo,
  canTransferTaskToOrLinked,
  isEligibleDelegate,
  linkedParticipantAbbreviations,
  roleOf,
  type RbacActor,
  type RbacTarget,
} from '@/lib/rbac/rules';

// The production division layout: Zuber (home ABD) heads ABD + NSDF,
// Chanchal heads KI, Ayushman heads MEDIA, osd.myas is Super Admin.
const KI = 'div-ki';
const NSDF = 'div-nsdf';
const SGM = 'div-sgm';
const ABD = 'div-abd';
const MEDIA = 'div-media';
const OJS = 'div-ojs';

function actor(overrides: Partial<RbacActor> = {}): RbacActor {
  return {
    id: 'actor-1',
    divisionId: KI,
    isSuperAdmin: false,
    headedDivisionIds: [],
    ...overrides,
  };
}

function target(overrides: Partial<RbacTarget> = {}): RbacTarget {
  return {
    id: 'target-1',
    divisionId: KI,
    isSuperAdmin: false,
    headedDivisionIds: [],
    isActive: true,
    ...overrides,
  };
}

describe('roleOf', () => {
  it('maps the three roles', () => {
    expect(roleOf({ isSuperAdmin: true, headedDivisionIds: [] })).toBe('super_admin');
    expect(roleOf({ isSuperAdmin: false, headedDivisionIds: [KI] })).toBe('division_head');
    expect(roleOf({ isSuperAdmin: false, headedDivisionIds: [] })).toBe('division_user');
  });

  it('super admin wins over headship', () => {
    expect(roleOf({ isSuperAdmin: true, headedDivisionIds: [KI] })).toBe('super_admin');
  });
});

describe('canTransferTaskTo — division user', () => {
  const user = actor({ divisionId: KI });

  it('allows a user in the same division', () => {
    expect(canTransferTaskTo(user, target({ divisionId: KI }))).toBe(true);
  });

  it('allows their own division head, even one homed in another division', () => {
    // Zuber-style: head of KI whose own row lives elsewhere.
    expect(
      canTransferTaskTo(user, target({ divisionId: ABD, headedDivisionIds: [KI] })),
    ).toBe(true);
  });

  it('allows Super Admin', () => {
    expect(
      canTransferTaskTo(user, target({ divisionId: OJS, isSuperAdmin: true })),
    ).toBe(true);
  });

  it('rejects a user in another division', () => {
    expect(canTransferTaskTo(user, target({ divisionId: SGM }))).toBe(false);
  });

  it("rejects another division's head", () => {
    expect(
      canTransferTaskTo(user, target({ divisionId: SGM, headedDivisionIds: [SGM] })),
    ).toBe(false);
  });

  it('rejects inactive users and self-transfers', () => {
    expect(canTransferTaskTo(user, target({ isActive: false }))).toBe(false);
    expect(canTransferTaskTo(user, target({ id: user.id }))).toBe(false);
  });
});

describe('canTransferTaskTo — division head', () => {
  // Zuber: home ABD, heads ABD + NSDF.
  const head = actor({ id: 'zuber', divisionId: ABD, headedDivisionIds: [ABD, NSDF] });

  it('allows users in every division they head', () => {
    expect(canTransferTaskTo(head, target({ divisionId: ABD }))).toBe(true);
    expect(canTransferTaskTo(head, target({ divisionId: NSDF }))).toBe(true);
  });

  it('allows another division head', () => {
    expect(
      canTransferTaskTo(head, target({ divisionId: SGM, headedDivisionIds: [SGM] })),
    ).toBe(true);
  });

  it('allows Super Admin', () => {
    expect(canTransferTaskTo(head, target({ divisionId: OJS, isSuperAdmin: true }))).toBe(true);
  });

  it('rejects a regular user of an unheaded division', () => {
    expect(canTransferTaskTo(head, target({ divisionId: MEDIA }))).toBe(false);
  });

  it('allows home-division users for a delegate homed outside their headed set', () => {
    // A KI user holding a delegation over SGM keeps their KI reach.
    const delegate = actor({ divisionId: KI, headedDivisionIds: [SGM] });
    expect(canTransferTaskTo(delegate, target({ divisionId: KI }))).toBe(true);
    expect(canTransferTaskTo(delegate, target({ divisionId: SGM }))).toBe(true);
  });
});

describe('canTransferTaskTo — super admin', () => {
  it('allows anyone active', () => {
    const sa = actor({ isSuperAdmin: true, divisionId: OJS });
    expect(canTransferTaskTo(sa, target({ divisionId: MEDIA }))).toBe(true);
    expect(canTransferTaskTo(sa, target({ divisionId: SGM }))).toBe(true);
  });

  it('still rejects inactive targets', () => {
    const sa = actor({ isSuperAdmin: true });
    expect(canTransferTaskTo(sa, target({ isActive: false }))).toBe(false);
  });
});

describe('canTransferTaskToOrLinked — cross-division links (Khelo India → NSDF)', () => {
  // Chanchal: home + head of KI, granted the KI→NSDF transfer link.
  const kiHead = actor({ id: 'chanchal', divisionId: KI, headedDivisionIds: [KI], allocatableDivisionIds: [NSDF] });

  it('lets a Khelo India head transfer to an NSDF member (beyond the base matrix)', () => {
    // The base matrix alone forbids it — a plain NSDF member is neither in KI nor a head.
    expect(canTransferTaskTo(kiHead, target({ divisionId: NSDF }))).toBe(false);
    expect(canTransferTaskToOrLinked(kiHead, target({ divisionId: NSDF }))).toBe(true);
  });

  it('works the same for a KI delegate (headship via delegation)', () => {
    // A user whose home is elsewhere but who holds the KI headship + link.
    const delegate = actor({ id: 'deleg', divisionId: MEDIA, headedDivisionIds: [KI], allocatableDivisionIds: [NSDF] });
    expect(canTransferTaskToOrLinked(delegate, target({ divisionId: NSDF }))).toBe(true);
  });

  it('does not widen the link to other divisions', () => {
    expect(canTransferTaskToOrLinked(kiHead, target({ divisionId: MEDIA }))).toBe(false);
    expect(canTransferTaskToOrLinked(kiHead, target({ divisionId: SGM }))).toBe(false);
  });

  it('still rejects inactive NSDF targets and self-transfers', () => {
    expect(canTransferTaskToOrLinked(kiHead, target({ divisionId: NSDF, isActive: false }))).toBe(false);
    expect(canTransferTaskToOrLinked(kiHead, target({ id: kiHead.id, divisionId: NSDF }))).toBe(false);
  });

  it('grants nothing extra to a regular Khelo India user (no link, not a head)', () => {
    const kiUser = actor({ divisionId: KI });
    expect(canTransferTaskToOrLinked(kiUser, target({ divisionId: NSDF }))).toBe(false);
  });

  it('is one-way — an NSDF head with no link cannot reach KI members through it', () => {
    const nsdfHead = actor({ id: 'zuber', divisionId: ABD, headedDivisionIds: [ABD, NSDF] });
    // A plain KI member is outside Zuber's headed divisions and not a head himself.
    expect(canTransferTaskToOrLinked(nsdfHead, target({ divisionId: KI }))).toBe(false);
  });

  it('preserves the base matrix when there is no link', () => {
    // Identical to canTransferTaskTo for the ordinary same-division case.
    const plain = actor({ divisionId: KI });
    expect(canTransferTaskToOrLinked(plain, target({ divisionId: KI }))).toBe(true);
  });
});

describe('canAssignTaskTo', () => {
  it('super admin assigns anywhere', () => {
    const sa = actor({ isSuperAdmin: true, divisionId: OJS });
    expect(canAssignTaskTo(sa, target({ divisionId: MEDIA }))).toBe(true);
  });

  it('head assigns only within headed divisions (plus home)', () => {
    const head = actor({ divisionId: ABD, headedDivisionIds: [ABD, NSDF] });
    expect(canAssignTaskTo(head, target({ divisionId: NSDF }))).toBe(true);
    expect(canAssignTaskTo(head, target({ divisionId: ABD }))).toBe(true);
    expect(canAssignTaskTo(head, target({ divisionId: KI }))).toBe(false);
  });

  it('division user cannot assign directly', () => {
    const user = actor({ headedDivisionIds: [] });
    expect(canAssignTaskTo(user, target({ divisionId: KI }))).toBe(false);
  });

  it('never assigns to inactive users', () => {
    const sa = actor({ isSuperAdmin: true });
    expect(canAssignTaskTo(sa, target({ isActive: false }))).toBe(false);
  });

  it('honours a cross-division allocation link (KI head → NSDF)', () => {
    const kiHead = actor({ divisionId: KI, headedDivisionIds: [KI], allocatableDivisionIds: [NSDF] });
    expect(canAssignTaskTo(kiHead, target({ divisionId: NSDF }))).toBe(true);
    // link is scoped: no reach to unlinked divisions, and never to inactive.
    expect(canAssignTaskTo(kiHead, target({ divisionId: MEDIA }))).toBe(false);
    expect(canAssignTaskTo(kiHead, target({ divisionId: NSDF, isActive: false }))).toBe(false);
  });

  it('a KI delegate (home elsewhere) also assigns to NSDF via the link', () => {
    const delegate = actor({ divisionId: MEDIA, headedDivisionIds: [KI], allocatableDivisionIds: [NSDF] });
    expect(canAssignTaskTo(delegate, target({ divisionId: NSDF }))).toBe(true);
  });

  it('a non-head with a stray link still cannot assign (assignment is head-only)', () => {
    // Links are derived from headship, so this never occurs in practice; the
    // head-only guard keeps it fail-safe regardless.
    const plain = actor({ divisionId: KI, headedDivisionIds: [], allocatableDivisionIds: [NSDF] });
    expect(canAssignTaskTo(plain, target({ divisionId: NSDF }))).toBe(false);
  });
});

describe('canActAsHeadOf', () => {
  it('matches headed divisions and super admin', () => {
    const head = actor({ headedDivisionIds: [NSDF] });
    expect(canActAsHeadOf(head, NSDF)).toBe(true);
    expect(canActAsHeadOf(head, KI)).toBe(false);
    expect(canActAsHeadOf(actor({ isSuperAdmin: true }), KI)).toBe(true);
  });

  it('a cross-division allocation link does NOT confer head powers', () => {
    // KI head may ALLOCATE to NSDF, but is not a head of NSDF — no delete,
    // no free reassignment of NSDF's own tasks, no delegation.
    const kiHead = actor({ headedDivisionIds: [KI], allocatableDivisionIds: [NSDF] });
    expect(canActAsHeadOf(kiHead, NSDF)).toBe(false);
  });
});

describe('canCreateDivisionTask', () => {
  it('super admin creates division-level tasks anywhere', () => {
    const sa = actor({ isSuperAdmin: true, divisionId: OJS });
    expect(canCreateDivisionTask(sa, MEDIA)).toBe(true);
    expect(canCreateDivisionTask(sa, KI)).toBe(true);
  });

  it('OSD creates division-level tasks anywhere', () => {
    const osd = actor({ isOsd: true, divisionId: OJS });
    expect(canCreateDivisionTask(osd, MEDIA)).toBe(true);
    expect(canCreateDivisionTask(osd, KI)).toBe(true);
  });

  it('a head only within divisions they head — home does not count', () => {
    // Zuber-style: home ABD, heads NSDF only.
    const head = actor({ divisionId: ABD, headedDivisionIds: [NSDF] });
    expect(canCreateDivisionTask(head, NSDF)).toBe(true);
    expect(canCreateDivisionTask(head, ABD)).toBe(false);
    expect(canCreateDivisionTask(head, KI)).toBe(false);
  });

  it('an active delegate gains the power for the delegated division', () => {
    // headedDivisionIds already folds in active delegations.
    const delegate = actor({ divisionId: KI, headedDivisionIds: [SGM] });
    expect(canCreateDivisionTask(delegate, SGM)).toBe(true);
    expect(canCreateDivisionTask(delegate, KI)).toBe(false);
  });

  it('a division user cannot create division-level tasks, even at home', () => {
    const user = actor({ divisionId: KI });
    expect(canCreateDivisionTask(user, KI)).toBe(false);
    expect(canCreateDivisionTask(user, SGM)).toBe(false);
  });

  it('honours a cross-division allocation link (KI head → NSDF)', () => {
    const kiHead = actor({ divisionId: KI, headedDivisionIds: [KI], allocatableDivisionIds: [NSDF] });
    expect(canCreateDivisionTask(kiHead, NSDF)).toBe(true);
    expect(canCreateDivisionTask(kiHead, KI)).toBe(true);
    // scoped: no reach to divisions outside the link.
    expect(canCreateDivisionTask(kiHead, MEDIA)).toBe(false);
  });

  it('a KI delegate (home elsewhere) also creates NSDF tasks via the link', () => {
    const delegate = actor({ divisionId: MEDIA, headedDivisionIds: [KI], allocatableDivisionIds: [NSDF] });
    expect(canCreateDivisionTask(delegate, NSDF)).toBe(true);
  });
});

describe('canManageTask — edit fields + manage collaborators', () => {
  // A task created by the SGM head, then handed to a plain SGM member.
  const task = { ownerId: 'member-x', createdById: 'sgm-head', divisionId: SGM };

  const caller = (
    overrides: Partial<{
      id: string;
      isSuperAdmin: boolean;
      hierarchySlot: string;
      divisionId: string;
      headedDivisionIds: string[];
    }> = {},
  ) => ({
    id: 'caller-1',
    isSuperAdmin: false,
    hierarchySlot: 'under_secretary',
    divisionId: SGM,
    headedDivisionIds: [] as string[],
    ...overrides,
  });

  it('allows the current owner', () => {
    expect(canManageTask(caller({ id: 'member-x' }), task)).toBe(true);
  });

  it('lets the original creator keep it AFTER ownership is handed off', () => {
    // The crux of the requirement: the SGM head created the task, no longer
    // owns it, is not currently a head here — yet still manages it as creator.
    expect(
      canManageTask(caller({ id: 'sgm-head', headedDivisionIds: [] }), task),
    ).toBe(true);
  });

  it('allows Super Admin, OSD, and JS', () => {
    expect(canManageTask(caller({ isSuperAdmin: true }), task)).toBe(true);
    expect(canManageTask(caller({ hierarchySlot: 'osd' }), task)).toBe(true);
    expect(canManageTask(caller({ hierarchySlot: 'js' }), task)).toBe(true);
  });

  it("allows a Director of the task's own division only", () => {
    expect(
      canManageTask(caller({ hierarchySlot: 'director', divisionId: SGM }), task),
    ).toBe(true);
    expect(
      canManageTask(caller({ hierarchySlot: 'director', divisionId: KI }), task),
    ).toBe(false);
  });

  it('allows the division head', () => {
    expect(canManageTask(caller({ headedDivisionIds: [SGM] }), task)).toBe(true);
  });

  it('allows an active DELEGATE of the division (delegation folds into headedDivisionIds)', () => {
    // A user homed elsewhere, holding a live delegation over SGM, is the
    // temporary head and manages SGM tasks — including their collaborators.
    const delegate = caller({ id: 'deleg', divisionId: MEDIA, headedDivisionIds: [SGM] });
    expect(canManageTask(delegate, task)).toBe(true);
  });

  it('rejects a plain member who is neither owner, creator, nor head', () => {
    expect(canManageTask(caller({ id: 'someone-else', divisionId: SGM }), task)).toBe(false);
  });

  it('rejects a head of a different division', () => {
    expect(canManageTask(caller({ headedDivisionIds: [KI] }), task)).toBe(false);
  });
});

describe('canDelegateDivision', () => {
  it('only the direct head or super admin can delegate', () => {
    expect(canDelegateDivision({ id: 'u1', isSuperAdmin: false }, { headUserId: 'u1' })).toBe(true);
    expect(canDelegateDivision({ id: 'u2', isSuperAdmin: false }, { headUserId: 'u1' })).toBe(false);
    expect(canDelegateDivision({ id: 'u2', isSuperAdmin: true }, { headUserId: 'u1' })).toBe(true);
    expect(canDelegateDivision({ id: 'u1', isSuperAdmin: false }, { headUserId: null })).toBe(false);
  });
});

describe('isEligibleDelegate', () => {
  const ctx = { divisionId: NSDF, delegatorId: 'zuber', delegatorHomeDivisionId: ABD };

  const person = (overrides: Record<string, unknown>) => ({
    id: 'p1',
    isActive: true,
    divisionId: KI,
    directHeadedDivisionIds: [] as string[],
    ...overrides,
  });

  it('accepts another direct division head', () => {
    expect(isEligibleDelegate(person({ directHeadedDivisionIds: [SGM] }), ctx)).toBe(true);
  });

  it('accepts a user of the delegated division', () => {
    expect(isEligibleDelegate(person({ divisionId: NSDF }), ctx)).toBe(true);
  });

  it("accepts a user of the delegator's home division", () => {
    expect(isEligibleDelegate(person({ divisionId: ABD }), ctx)).toBe(true);
  });

  it('rejects outsiders, the delegator, and inactive users', () => {
    expect(isEligibleDelegate(person({ divisionId: KI }), ctx)).toBe(false);
    expect(isEligibleDelegate(person({ id: 'zuber', divisionId: NSDF }), ctx)).toBe(false);
    expect(isEligibleDelegate(person({ divisionId: NSDF, isActive: false }), ctx)).toBe(false);
  });
});

// The configured cross-division participant links for the ministry: Khelo India
// (KI) and Khelo India Mission (KIM) are each symmetrically linked with NSDF.
// These govern subtask assignees, collaborators, and @mentions alike.
const PARTICIPANT_LINKS: readonly (readonly [string, string])[] = [
  ['KI', 'NSDF'],
  ['KIM', 'NSDF'],
];

describe('linkedParticipantAbbreviations', () => {
  it('KI and KIM both link out to NSDF', () => {
    expect(linkedParticipantAbbreviations('KI', PARTICIPANT_LINKS)).toEqual(['NSDF']);
    expect(linkedParticipantAbbreviations('KIM', PARTICIPANT_LINKS)).toEqual(['NSDF']);
  });

  it('is symmetric — NSDF links back to both KI and KIM', () => {
    const linked = linkedParticipantAbbreviations('NSDF', PARTICIPANT_LINKS);
    expect(new Set(linked)).toEqual(new Set(['KI', 'KIM']));
  });

  it('an unlinked division gets nothing', () => {
    expect(linkedParticipantAbbreviations('SGM', PARTICIPANT_LINKS)).toEqual([]);
    expect(linkedParticipantAbbreviations('OJS', PARTICIPANT_LINKS)).toEqual([]);
  });

  it('never links a division to itself', () => {
    expect(linkedParticipantAbbreviations('KI', [['KI', 'KI']])).toEqual([]);
  });

  it('does not bridge KI and KIM through their shared NSDF link', () => {
    // KI links to NSDF, KIM links to NSDF, but KI must not reach KIM.
    expect(linkedParticipantAbbreviations('KI', PARTICIPANT_LINKS)).not.toContain('KIM');
    expect(linkedParticipantAbbreviations('KIM', PARTICIPANT_LINKS)).not.toContain('KI');
  });
});
