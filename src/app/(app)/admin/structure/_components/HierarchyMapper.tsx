'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sortable from 'sortablejs';

import { Avatar } from '@/components/ui';
import {
  moveTeamToUnitAction,
  setUserSupervisorAction,
} from '@/app/actions/admin-structure';
import { initialsOf } from '@/lib/format';
import {
  CONTRACT_ROLE_LABEL,
  HIERARCHY_SLOT_LABEL,
  HIERARCHY_SLOT_LEVEL,
} from '@/lib/labels';
import { partitionOrgChart } from '@/lib/org-chart';
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
};

/**
 * Org chart with Sortable.js drag-and-drop reassignment.
 *
 * Every officer passed in is guaranteed to render exactly once:
 *   - no supervisor           → Unassigned pool
 *   - supervisor outside view → chart root
 *   - supervisor in view      → nested under them
 *   - otherwise unreachable (supervisor sits in the pool, or a data
 *     cycle) → promoted to a chart root instead of silently vanishing.
 *
 * Drops: every card exposes a drop zone (visible while dragging), so a
 * leaf officer can receive reports too. Dropping on the Unassigned pool
 * clears the supervisor. Keyboard users change supervisors from the
 * person inspector instead of dragging.
 */
export function HierarchyMapper({
  divisionName,
  parentBreadcrumb,
  officers,
}: HierarchyMapperProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get('selected');
  const [pending, startTransition] = useTransition();
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  // ----------------------------------------------------------
  // Partition: pool / roots / children — total by construction
  // (see src/lib/org-chart.ts; unit-tested for exactly-once rendering).
  // ----------------------------------------------------------
  const { byId, reports, rootOfficers, unassignedOfficers } = useMemo(() => {
    const byId = new Map(officers.map((o) => [o.id, o]));
    const part = partitionOrgChart(officers);
    const get = (ids: string[]) =>
      ids.map((id) => byId.get(id)).filter(Boolean) as OfficerNode[];

    const reports = new Map<string, OfficerNode[]>();
    for (const [parentId, childIds] of part.childrenByParent) {
      reports.set(parentId, get(childIds));
    }

    return {
      byId,
      reports,
      rootOfficers: get(part.rootIds),
      unassignedOfficers: get(part.unassignedIds),
    };
  }, [officers]);

  // ----------------------------------------------------------
  // Sortable wiring
  // ----------------------------------------------------------
  const listRefs = useRef<Map<string, HTMLUListElement | null>>(new Map());
  const sortablesRef = useRef<Sortable[]>([]);

  useEffect(() => {
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
        // Keep touch scrolling usable — a drag starts after a short hold.
        delay: 150,
        delayOnTouchOnly: true,
        touchStartThreshold: 4,
        // Auto-scroll while dragging near the edges of large charts.
        scroll: true,
        scrollSensitivity: 80,
        scrollSpeed: 14,
        onStart: () => {
          document.body.classList.add('sortable-dragging');
        },
        onEnd: (evt) => {
          document.body.classList.remove('sortable-dragging');
          const item = evt.item as HTMLElement;
          const userId = item.dataset.officerId;

          // Team move: did the drop land over a unit row in the left tree?
          // We hit-test the pointer rather than making the tree a Sortable
          // drop target, so no React-owned card is ever relocated across
          // component trees, and freshly-expanded rows work with no
          // registration step. When the drop is over the tree, Sortable
          // (whose only lists are the chart) left the card in place, so the
          // chart branch below would be a no-op anyway.
          const dropNode = unitRowUnderPointer(
            (evt as unknown as { originalEvent?: Event }).originalEvent,
          );
          if (dropNode && userId) {
            const nodeId = dropNode.dataset.dropNodeId;
            if (nodeId) {
              const fd = new FormData();
              fd.set('userId', userId);
              fd.set('targetNodeId', nodeId);
              startTransition(async () => {
                const result = await moveTeamToUnitAction(undefined, fd);
                if (!result.ok && result.error) {
                  setErrorBanner(result.error);
                  setTimeout(() => setErrorBanner(null), 4000);
                } else {
                  setSavedFlash(true);
                  setTimeout(() => setSavedFlash(false), 2000);
                }
                router.refresh();
              });
              return;
            }
          }

          const toContainer = evt.to as HTMLElement;
          const fromContainer = evt.from as HTMLElement;
          const newParentRaw = toContainer.dataset.parentId ?? '';
          const oldParentRaw = fromContainer.dataset.parentId ?? '';
          if (!userId) return;
          // Same container → pure reorder, nothing to persist.
          if (newParentRaw === oldParentRaw) return;
          // The root strip is not a supervisor — snap back.
          if (newParentRaw === '__root') {
            router.refresh();
            return;
          }
          // Self-drop guard (dropping into your own reports list).
          if (newParentRaw === userId) {
            router.refresh();
            return;
          }

          const newSupervisorId = newParentRaw === 'unassigned' ? '' : newParentRaw;

          const fd = new FormData();
          fd.set('userId', userId);
          fd.set('supervisorId', newSupervisorId);
          startTransition(async () => {
            const result = await setUserSupervisorAction(undefined, fd);
            if (!result.ok && result.error) {
              setErrorBanner(result.error);
              router.refresh();
              setTimeout(() => setErrorBanner(null), 4000);
            } else {
              setSavedFlash(true);
              setTimeout(() => setSavedFlash(false), 2000);
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

  // Freeze dragging while a change is saving — prevents queued,
  // contradictory moves from racing each other.
  useEffect(() => {
    sortablesRef.current.forEach((s) => s.option('disabled', pending));
  }, [pending]);

  const renderReportsList = (parentId: string) => {
    const kids = reports.get(parentId) ?? [];
    const parent = byId.get(parentId);
    return (
      <ul
        ref={(el) => { listRefs.current.set(parentId, el); }}
        data-parent-id={parentId}
        role="group"
        aria-label={parent ? `Direct reports of ${parent.name}` : 'Direct reports'}
        className={cn(
          'mt-2 flex flex-wrap gap-3 justify-center rounded-lg px-2 transition-all',
          'border border-dashed border-transparent',
          'sortable-target',
          kids.length > 0 ? 'min-h-[60px] py-2' : 'min-h-[10px] py-0 sortable-empty-target',
        )}
      >
        {kids.map((k) => (
          <li key={k.id} data-officer-id={k.id} className="flex flex-col items-center">
            <OfficerCard
              officer={k}
              supervisorName={byId.get(k.supervisorId ?? '')?.name ?? null}
              isSelected={k.id === selectedId}
              onSelect={() => selectOfficer(router, searchParams, k.id)}
            />
            {renderReportsList(k.id)}
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
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="font-serif text-[20px] md:text-[22px] text-ink leading-tight">
            {divisionName} · reporting hierarchy
          </h3>
          <span className="text-[11px] text-ink-3">
            {officers.length} {officers.length === 1 ? 'person' : 'people'}
          </span>
        </div>
        <p className="mt-2 text-[12px] text-primary bg-primary-soft border border-primary-line/40 rounded-lg px-3 py-2 inline-flex items-start gap-1.5">
          <i className="ti ti-arrows-move text-[14px] mt-0.5" aria-hidden="true" />
          <span>
            Drag a card onto another officer to set the supervisor, or into the
            Unassigned pool. Drag it onto a unit in the left tree to move that
            officer and their whole team into it. Keyboard: select a card and
            use the inspector&rsquo;s Reports-to control.
          </span>
        </p>
        <span role="status" aria-live="polite" className="block">
          {pending ? (
            <span className="mt-2 inline-block text-[11px] text-ink-3">Saving…</span>
          ) : savedFlash ? (
            <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-success">
              <i className="ti ti-check text-[12px]" aria-hidden="true" />
              Change saved
            </span>
          ) : null}
        </span>
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
      {officers.length === 0 ? (
        <p className="text-[12px] text-ink-3 italic py-6 text-center">
          No officers in this unit yet. Add users from <em>Users</em> or{' '}
          <em>Manage members</em>, then map them here.
        </p>
      ) : rootOfficers.length === 0 ? (
        <p className="text-[12px] text-ink-3 italic py-4 text-center">
          Everyone here is in the Unassigned pool. Drag a card onto another
          officer to start the chain.
        </p>
      ) : (
        <div className="overflow-x-auto pb-4">
          <ul
            ref={(el) => { listRefs.current.set('__root', el as HTMLUListElement | null); }}
            data-parent-id="__root"
            role="group"
            aria-label={`Top of the ${divisionName} chart`}
            className="flex flex-wrap gap-4 justify-center"
          >
            {rootOfficers.map((root) => (
              <li key={root.id} data-officer-id={root.id} className="flex flex-col items-center">
                <OfficerCard
                  officer={root}
                  supervisorName={null}
                  isSelected={root.id === selectedId}
                  onSelect={() => selectOfficer(router, searchParams, root.id)}
                />
                {renderReportsList(root.id)}
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
            Unassigned in this unit
            {unassignedOfficers.length > 0 ? (
              <span className="text-[10px] text-ink-3 tracking-normal normal-case font-normal">
                {unassignedOfficers.length}
              </span>
            ) : null}
          </h4>
          <span className="text-[10px] text-ink-3">
            Drop here to remove from chain
          </span>
        </header>
        <ul
          ref={(el) => { listRefs.current.set('unassigned', el as HTMLUListElement | null); }}
          data-parent-id="unassigned"
          role="group"
          aria-label="Unassigned officers"
          className={cn(
            'flex flex-wrap gap-2.5 min-h-[60px] rounded-lg px-2 py-3 border border-dashed border-line',
            'sortable-target',
          )}
        >
          {unassignedOfficers.length === 0 ? (
            <li className="text-[11px] text-ink-3 italic px-2 py-1" data-officer-id="">
              Everyone in this unit is in the chain.
            </li>
          ) : (
            unassignedOfficers.map((o) => (
              <li key={o.id} data-officer-id={o.id}>
                <OfficerCard
                  officer={o}
                  supervisorName={null}
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
  supervisorName,
  isSelected,
  onSelect,
}: {
  officer: OfficerNode;
  supervisorName: string | null;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const slotLabel = HIERARCHY_SLOT_LABEL[officer.hierarchySlot] ?? officer.hierarchySlot;
  return (
    <button
      type="button"
      data-officer-id={officer.id}
      onClick={onSelect}
      aria-pressed={isSelected}
      aria-label={`${officer.name}, ${slotLabel}${
        supervisorName ? `, reports to ${supervisorName}` : ''
      }. Select to inspect.`}
      className={cn(
        'group relative inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-panel text-left',
        'transition-shadow hover:shadow-sm cursor-grab active:cursor-grabbing',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',
        isSelected
          ? 'border-primary shadow-[0_0_0_3px_var(--primary-soft)]'
          : 'border-line',
        !officer.isActive && 'opacity-60',
      )}
      title={officer.designation}
    >
      {officer.contractRole ? (
        <span
          className="absolute -top-2 right-2 text-[8px] uppercase tracking-[0.06em] font-medium text-onink bg-accent px-1.5 py-0.5 rounded"
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
          {slotLabel}
          {/* != null so the apex slot (hmyas, level 0) still shows a badge,
              while unranked slots (consultant) show none. */}
          {HIERARCHY_SLOT_LEVEL[officer.hierarchySlot] != null
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

/**
 * The structure-tree unit row under the drop pointer, if any. Sortable's
 * fallback clone is already removed by the time onEnd fires, so
 * elementFromPoint resolves to the real element beneath the cursor.
 * Returns null for drops that miss the tree (normal chart drops).
 */
function unitRowUnderPointer(originalEvent: Event | undefined): HTMLElement | null {
  if (!originalEvent) return null;
  let x: number | undefined;
  let y: number | undefined;
  const te = originalEvent as TouchEvent;
  if (te.changedTouches && te.changedTouches.length > 0) {
    x = te.changedTouches[0].clientX;
    y = te.changedTouches[0].clientY;
  } else {
    const me = originalEvent as MouseEvent;
    if (typeof me.clientX === 'number') {
      x = me.clientX;
      y = me.clientY;
    }
  }
  if (x == null || y == null) return null;
  const el = document.elementFromPoint(x, y);
  return (el?.closest('[data-drop-node-id]') as HTMLElement | null) ?? null;
}
