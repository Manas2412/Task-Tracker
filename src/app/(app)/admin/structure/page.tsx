import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

import { DivisionHeadCard, type HeadCandidate } from './_components/DivisionHeadCard';
import { HierarchyMapper, type OfficerNode } from './_components/HierarchyMapper';
import {
  PersonInspector,
  type InspectorUser,
} from './_components/PersonInspector';
import { StructureTree, type StructureNode, type TreeUser } from './_components/StructureTree';

import type {
  UserFormDivisionOption,
  UserFormSupervisorOption,
} from '@/app/(app)/admin/users/_components/UserFormFields';

type PageProps = {
  searchParams?: { division?: string; selected?: string };
};

function headCandidateOf(
  u: {
    id: string;
    name: string;
    designation: string;
    division: { name: string; avatarColour: string };
  } | null,
): HeadCandidate | null {
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    designation: u.designation,
    divisionName: u.division.name,
    divisionColour: u.division.avatarColour,
  };
}

export default async function StructurePage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  // Pull every division + every user, then derive everything client-side.
  const [divisions, allUsers] = await Promise.all([
    prisma.division.findMany({
      orderBy: [{ kind: 'asc' }, { displayOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.user.findMany({
      include: {
        division: true,
        subDivision: true,
        section: true,
        supervisor: { include: { division: true } },
        subordinates: { include: { division: true } },
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  // User counts per division (primary placement = divisionId).
  const userCountsByDivision = new Map<string, number>();
  for (const u of allUsers) {
    userCountsByDivision.set(u.divisionId, (userCountsByDivision.get(u.divisionId) ?? 0) + 1);
    if (u.subDivisionId) {
      userCountsByDivision.set(
        u.subDivisionId,
        (userCountsByDivision.get(u.subDivisionId) ?? 0) + 1,
      );
    }
    if (u.sectionId) {
      userCountsByDivision.set(u.sectionId, (userCountsByDivision.get(u.sectionId) ?? 0) + 1);
    }
    if (u.pmuId) {
      userCountsByDivision.set(u.pmuId, (userCountsByDivision.get(u.pmuId) ?? 0) + 1);
    }
  }

  const treeNodes: StructureNode[] = divisions.map((d) => ({
    id: d.id,
    name: d.name,
    kind: d.kind as StructureNode['kind'],
    parentId: d.parentId,
    pmuParentDivisionId: d.pmuParentDivisionId,
    avatarColour: d.avatarColour,
    userCount: userCountsByDivision.get(d.id) ?? 0,
  }));

  const treeUsers: TreeUser[] = allUsers.filter((u) => u.isActive).map((u) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    designation: u.designation,
    divisionId: u.divisionId,
    divisionName: u.division.name,
    divisionColour: u.division.avatarColour,
    pmuId: u.pmuId,
  }));

  // Pick the active division — default to the first top-level division.
  const activeDivision =
    (searchParams?.division &&
      divisions.find((d) => d.id === searchParams.division)) ||
    divisions.find((d) => d.kind === 'division') ||
    divisions[0] ||
    null;

  if (!activeDivision) {
    // No divisions exist — show an empty-state page that nudges creation.
    return (
      <div className="max-w-6xl mx-auto py-10 text-center">
        <i className="ti ti-building text-[40px] text-ink-3 block mb-3" aria-hidden="true" />
        <h2 className="font-serif text-[22px] text-ink mb-2">No divisions yet</h2>
        <p className="text-[13px] text-ink-2 max-w-md mx-auto leading-relaxed">
          Add your first division to start mapping the hierarchy. Use the “New” button in the
          left sidebar once divisions exist.
        </p>
      </div>
    );
  }

  // Officers shown in the chart: users placed in the active node — by
  // divisionId / subDivisionId / sectionId for ministry units, by pmuId
  // for PMU teams.
  const officersInActive = allUsers.filter((u) => {
    if (activeDivision.kind === 'division') return u.divisionId === activeDivision.id;
    if (activeDivision.kind === 'sub_division') return u.subDivisionId === activeDivision.id;
    if (activeDivision.kind === 'section') return u.sectionId === activeDivision.id;
    return u.pmuId === activeDivision.id;
  });

  const officersInActiveIds = new Set(officersInActive.map((u) => u.id));

  const officerNodes: OfficerNode[] = officersInActive.map((u) => ({
    id: u.id,
    name: u.name,
    designation: u.designation,
    hierarchySlot: u.hierarchySlot,
    contractRole: u.contractRole,
    divisionColour: u.division.avatarColour,
    supervisorId: u.supervisorId,
    isActive: u.isActive,
    isSelf: u.id === session.user.id,
  }));

  // "In the chain" = has a parent in division, has a parent outside division,
  // OR is the parent of someone in division. Otherwise → Unassigned.
  const inChainIds = new Set<string>();
  for (const u of officersInActive) {
    if (u.supervisorId && officersInActiveIds.has(u.supervisorId)) {
      inChainIds.add(u.id);
      inChainIds.add(u.supervisorId);
    } else if (u.supervisorId) {
      // External supervisor — they're a chart root for this division.
      inChainIds.add(u.id);
    }
  }

  // Chart roots: in chain AND supervisor is not also in this division.
  const rootsOnlyChartIds = officersInActive
    .filter(
      (u) =>
        inChainIds.has(u.id) &&
        (!u.supervisorId || !officersInActiveIds.has(u.supervisorId)),
    )
    .map((u) => u.id);

  // Unassigned: in this division but not in the chain at all.
  const unassignedIds = officersInActive
    .filter((u) => !inChainIds.has(u.id))
    .map((u) => u.id);

  // Build the inspector data for the selected user.
  const selectedUser = searchParams?.selected
    ? allUsers.find((u) => u.id === searchParams.selected) ?? null
    : null;

  let inspectorUser: InspectorUser | null = null;
  if (selectedUser) {
    inspectorUser = {
      id: selectedUser.id,
      name: selectedUser.name,
      username: selectedUser.username,
      designation: selectedUser.designation,
      hierarchySlot: selectedUser.hierarchySlot,
      contractRole: selectedUser.contractRole,
      isPmu: selectedUser.isPmu,
      pmuRole: selectedUser.pmuRole,
      isActive: selectedUser.isActive,
      isSuperAdmin: selectedUser.isSuperAdmin,
      lastLogin: selectedUser.lastLogin,
      division: {
        id: selectedUser.division.id,
        name: selectedUser.division.name,
        avatarColour: selectedUser.division.avatarColour,
      },
      subDivision: selectedUser.subDivision
        ? { name: selectedUser.subDivision.name }
        : null,
      section: selectedUser.section ? { name: selectedUser.section.name } : null,
      supervisor: selectedUser.supervisor
        ? {
            id: selectedUser.supervisor.id,
            name: selectedUser.supervisor.name,
            designation: selectedUser.supervisor.designation,
            division: { avatarColour: selectedUser.supervisor.division.avatarColour },
          }
        : null,
      directReports: selectedUser.subordinates.map((s) => ({
        id: s.id,
        name: s.name,
        designation: s.designation,
        division: { avatarColour: s.division.avatarColour },
      })),
      defaults: {
        name: selectedUser.name,
        username: selectedUser.username,
        designation: selectedUser.designation,
        hierarchySlot: selectedUser.hierarchySlot,
        contractRole: selectedUser.contractRole ?? '',
        divisionId: selectedUser.divisionId,
        subDivisionId: selectedUser.subDivisionId,
        sectionId: selectedUser.sectionId,
        pmuId: selectedUser.pmuId,
        supervisorId: selectedUser.supervisorId,
        isSuperAdmin: selectedUser.isSuperAdmin,
      },
    };
  }

  // Form options for the dialogs.
  const divisionOptions: UserFormDivisionOption[] = divisions.map((d) => ({
    id: d.id,
    name: d.name,
    parentId: d.parentId,
    pmuParentDivisionId: d.pmuParentDivisionId,
    kind: d.kind as 'division' | 'sub_division' | 'section' | 'pmu',
  }));

  const supervisorOptions: UserFormSupervisorOption[] = allUsers
    .filter((u) => u.isActive)
    .map((u) => ({ id: u.id, name: u.name, designation: u.designation }));

  // Breadcrumb for the active node.
  const parentBreadcrumb = (() => {
    const parts: string[] = [];
    let current: typeof activeDivision | null = activeDivision;
    while (current && current.parentId) {
      const parent = divisions.find((d) => d.id === current!.parentId) ?? null;
      if (!parent) break;
      parts.unshift(parent.name);
      current = parent;
    }
    return parts.length > 0 ? parts.join(' · ') : null;
  })();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_320px] gap-4">
      {/* Left — Structure Tree */}
      <aside className="lg:sticky lg:top-[7rem] self-start">
        <StructureTree
          nodes={treeNodes}
          activeId={activeDivision.id}
          allUsers={treeUsers}
          divisions={divisionOptions}
          supervisors={supervisorOptions}
        />
      </aside>

      {/* Centre — Division head + Hierarchy Mapper */}
      <section>
        {activeDivision.kind === 'division' ? (
          <DivisionHeadCard
            divisionId={activeDivision.id}
            divisionName={activeDivision.name}
            currentHead={headCandidateOf(
              allUsers.find((u) => u.id === activeDivision.headUserId) ?? null,
            )}
            candidates={allUsers
              .filter((u) => u.isActive)
              .map((u) => ({
                id: u.id,
                name: u.name,
                designation: u.designation,
                divisionName: u.division.name,
                divisionColour: u.division.avatarColour,
              }))}
            canEdit={session.user.isSuperAdmin === true}
          />
        ) : null}
        <HierarchyMapper
          divisionName={activeDivision.name}
          parentBreadcrumb={parentBreadcrumb}
          officers={officerNodes}
          rootOfficerIds={rootsOnlyChartIds}
          unassignedIds={unassignedIds}
        />
      </section>

      {/* Right — Person Inspector */}
      <aside className="lg:sticky lg:top-[7rem] self-start">
        <PersonInspector
          user={inspectorUser}
          divisions={divisionOptions}
          supervisors={supervisorOptions}
          selfId={session.user.id}
          activeDivision={{ id: activeDivision.id, name: activeDivision.name }}
          allUsers={treeUsers}
        />
      </aside>
    </div>
  );
}
