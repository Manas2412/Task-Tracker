'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sortable from 'sortablejs';

import { Avatar } from '@/components/ui';
import { setUserSupervisorAction } from '@/app/actions/admin-structure';
import { initialsOf } from '@/lib/format';
import {
  CONTRACT_ROLE_LABEL,
  HIERARCHY_SLOT_LABEL,
  HIERARCHY_SLOT_LEVEL,
} from '@/lib/labels';
import { cn } from '@/lib/utils';

export type OfficerNode = {
  id: string;
  name: string;
  designation: string;
  hierarchySlot: string;
  contractRole: string | null;
  divisionColour: string;
  supervisorId: string | null;
  isActive: boolean;
  isSelf: boolean;
};

type HierarchyMapperProps = {
  divisionName: string;
  parentBreadcrumb: string | null;
  officers: OfficerNode[];
  /** Officers with no supervisor (or supervisor outside this division) */
  rootOfficerIds: string[];
  /** Officers in this division who are not in the supervisor chain */
  unassignedIds: string[];
};

/**
 * Org chart with Sortable.js drag-and-drop reassignment.
 *
 * Layout: each supervisor's direct reports render as a sortable list
 * underneath the supervisor card. All lists share the group name 'officers'
 * so cards can be dragged between any two — including the Unassigned pool
 * (which sets supervisorId = null).
 *
 * Phase-1 cycle protection happens server-side in setUserSupervisorAction.
 */
export function HierarchyMapper({
  divisionName,
  parentBreadcrumb,
  officers,
  rootOfficerIds,
  unassignedIds,
}: HierarchyMapperProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get('selected');
  const [pending, startTransition] = useTransition();
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // index officers + reports map
  const byId = useMemo(() => new Map(officers.map((o) => [o.id, o])), [officers]);
  const reports = useMemo(() => {
    const m = new Map<string, OfficerNode[]>();
    for (const o of officers) {
      if (o.supervisorId && byId.has(o.supervisorId)) {
        if (!m.has(o.supervisorId)) m.set(o.supervisorId, []);
        m.get(o.supervisorId)!.push(o);
      }
    }
    return m;
  }, [officers, byId]);

  const rootOfficers = rootOfficerIds.map((id) => byId.get(id)).filter(Boolean) as OfficerNode[];
  const unassignedOfficers = unassignedIds
    .map((id) => byId.get(id))
    .filter(Boolean) as OfficerNode[];

  // Sortable instances are managed via a registry of refs by parent-id.
  const listRefs = useRef<Map<string, HTMLUListElement | null>>(new Map());
  const sortablesRef = useRef<Sortable[]>([]);

  useEffect(() => {
    // Destroy any prior instances before re-creating.
    sortablesRef.current.forEach((s) => s.destroy());
    sortablesRef.current = [];

    const createSortableFor = (el: HTMLUListElement) => {
      const s = Sortable.create(el, {
        group: 'officers',
        animation: 200,
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        chosenClass: 'sortable-chosen',
        forceFallback: true,
        fallbackOnBody: true,
        emptyInsertThreshold: 28,
        onStart: () => {
          document.body.classList.add('sortable-dragging');
        },
        onEnd: (evt) => {
          document.body.classList.remove('sortable-dragging');
          const item = evt.item as HTMLElement;
          const userId = item.dataset.officerId;
          const toContainer = evt.to as HTMLElement;
          const fromContainer = evt.from as HTMLElement;
          const newParentRaw = toContainer.dataset.parentId ?? '';
          const oldParentRaw = fromContainer.dataset.parentId ?? '';
          if (!userId) return;
          // No-op if same container and same index
          if (newParentRaw === oldParentRaw && evt.newIndex === evt.oldIndex) return;

          const newSupervisorId = newParentRaw === 'unassigned' ? '' : newParentRaw;

          const fd = new FormData();
          fd.set('userId', userId);
          fd.set('supervisorId', newSupervisorId);
          startTransition(async () => {
            const result = await setUserSupervisorAction(undefined, fd);
            if (!result.ok && result.error) {
              setErrorBanner(result.error);
              // Re-fetch to reset DOM to canonical state.
              router.refresh();
              setTimeout(() => setErrorBanner(null), 4000);
            } else {
              router.refresh();
            }
          });
        },
      });
      sortablesRef.current.push(s);
    };

    listRefs.current.forEach((el) => {
      if (el) createSortableFor(el);
    });

    return () => {
      sortablesRef.current.forEach((s) => s.destroy());
      sortablesRef.current = [];
    };
    // Re-init when the org changes structure
  }, [officers, router]);

  const renderReportsList = (parentId: string) => {
    const kids = reports.get(parentId) ?? [];
    return (
      <ul
        ref={(el) => { listRefs.current.set(parentId, el); }}
        data-parent-id={parentId}
        className={cn(
          'mt-2 flex flex-wrap gap-3 justify-center min-h-[60px] rounded-lg px-2 py-2',
          'border border-dashed border-transparent transition-colors',
          'sortable-target',
        )}
      >
        {kids.map((k) => (
          <li key={k.id} className="flex flex-col items-center">
            <OfficerCard
              officer={k}
              isSelected={k.id === selectedId}
              onSelect={() => selectOfficer(router, searchParams, k.id)}
            />
            {(reports.get(k.id)?.length ?? 0) > 0 ? renderReportsList(k.id) : null}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="bg-panel border border-line rounded-xl p-4 md:p-5">
      {/* Header */}
      <div className="mb-4">
        {parentBreadcrumb ? (
          <p className="text-[10px] uppercase tracking-[0.06em] font-medium text-ink-3 mb-1">
            {parentBreadcrumb}
          </p>
        ) : null}
        <h3 className="font-serif text-[20px] md:text-[22px] text-ink leading-tight">
          {divisionName} · reporting hierarchy
        </h3>
        <p className="mt-2 text-[12px] text-primary bg-primary-soft border border-primary-line/40 rounded-lg px-3 py-2 inline-flex items-center gap-1.5">
          <i className="ti ti-arrows-move text-[14px]" aria-hidden="true" />
          Drag any officer card to reorder them, drop into a new supervisor&apos;s group, or drop into the Unassigned pool.
        </p>
        {pending ? (
          <p className="mt-2 text-[11px] text-ink-3">Saving…</p>
        ) : null}
        {errorBanner ? (
          <p
            role="alert"
            className="mt-2 text-[12px] text-urgent bg-urgent-soft border border-urgent/20 rounded-lg px-3 py-2"
          >
            {errorBanner}
          </p>
        ) : null}
      </div>

      {/* Chart */}
      {rootOfficers.length === 0 && officers.length > 0 ? (
        <p className="text-[12px] text-ink-3 italic py-4 text-center">
          Everyone in this division reports outside the division. Drag a card from the Unassigned pool to pin a root.
        </p>
      ) : rootOfficers.length === 0 ? (
        <p className="text-[12px] text-ink-3 italic py-6 text-center">
          No officers in this division yet. Add users from <em>Users</em>, then assign them here.
        </p>
      ) : (
        <div className="overflow-x-auto pb-4">
          <ul
            ref={(el) => { listRefs.current.set('__root', el as HTMLUListElement | null); }}
            data-parent-id={rootOfficers[0]?.supervisorId ?? ''}
            className="flex flex-wrap gap-4 justify-center"
          >
            {rootOfficers.map((root) => (
              <li key={root.id} className="flex flex-col items-center">
                <OfficerCard
                  officer={root}
                  isSelected={root.id === selectedId}
                  onSelect={() => selectOfficer(router, searchParams, root.id)}
                />
                {(reports.get(root.id)?.length ?? 0) > 0 ? renderReportsList(root.id) : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Unassigned pool */}
      <section className="mt-6 pt-4 border-t border-dashed border-line">
        <header className="flex items-center justify-between mb-2">
          <h4 className="section-label inline-flex items-center gap-1.5">
            <i className="ti ti-inbox text-[14px]" aria-hidden="true" />
            Unassigned in this division
          </h4>
          <span className="text-[10px] text-ink-3">
            Drop here to remove from chain
          </span>
        </header>
        <ul
          ref={(el) => { listRefs.current.set('unassigned', el as HTMLUListElement | null); }}
          data-parent-id="unassigned"
          className={cn(
            'flex flex-wrap gap-2.5 min-h-[60px] rounded-lg px-2 py-3 border border-dashed border-line',
          )}
        >
          {unassignedOfficers.length === 0 ? (
            <li className="text-[11px] text-ink-3 italic px-2 py-1">
              All officers in this division are in the chain.
            </li>
          ) : (
            unassignedOfficers.map((o) => (
              <li key={o.id}>
                <OfficerCard
                  officer={o}
                  isSelected={o.id === selectedId}
                  onSelect={() => selectOfficer(router, searchParams, o.id)}
                />
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}

// ------------------------------------------------------------
// OfficerCard
// ------------------------------------------------------------

function OfficerCard({
  officer,
  isSelected,
  onSelect,
}: {
  officer: OfficerNode;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      data-officer-id={officer.id}
      onClick={onSelect}
      className={cn(
        'group relative inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-panel text-left',
        'transition-shadow hover:shadow-sm cursor-grab active:cursor-grabbing',
        isSelected
          ? 'border-primary shadow-[0_0_0_3px_var(--primary-soft)]'
          : 'border-line',
        !officer.isActive && 'opacity-60',
      )}
      title={officer.designation}
    >
      {officer.contractRole ? (
        <span
          className="absolute -top-2 right-2 text-[8px] uppercase tracking-[0.06em] font-medium text-white bg-accent px-1.5 py-0.5 rounded"
          aria-label={CONTRACT_ROLE_LABEL[officer.contractRole]}
        >
          {officer.contractRole}
        </span>
      ) : null}

      <Avatar
        initials={initialsOf(officer.name)}
        colour={officer.contractRole ? '#b45309' : officer.divisionColour}
        size="sm"
        ariaLabel={officer.name}
      />
      <span className="flex flex-col min-w-0">
        <span className="text-[12.5px] font-medium text-ink leading-tight truncate max-w-[140px]">
          {officer.name}
          {officer.isSelf ? (
            <span className="ml-1 text-[10px] text-accent">· you</span>
          ) : null}
        </span>
        <span className="text-[10px] text-ink-3 leading-tight truncate max-w-[140px]">
          {HIERARCHY_SLOT_LABEL[officer.hierarchySlot]}
          {HIERARCHY_SLOT_LEVEL[officer.hierarchySlot]
            ? ` · L${HIERARCHY_SLOT_LEVEL[officer.hierarchySlot]}`
            : ''}
        </span>
      </span>
    </button>
  );
}

function selectOfficer(
  router: ReturnType<typeof useRouter>,
  searchParams: URLSearchParams | ReturnType<typeof useSearchParams>,
  officerId: string,
) {
  const sp = new URLSearchParams(searchParams.toString());
  sp.set('selected', officerId);
  router.replace(`/admin/structure?${sp.toString()}`, { scroll: false });
}
