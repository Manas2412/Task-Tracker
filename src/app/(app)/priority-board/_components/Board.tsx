'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sortable from 'sortablejs';

import { Avatar, Pill } from '@/components/ui';
import { setJsPriorityLaneAction, reorderBoardAction } from '@/app/actions/tasks';
import { formatDue, initialsOf } from '@/lib/format';
import { TASK_STATUS_LABEL } from '@/lib/labels';
import { cn } from '@/lib/utils';

import type { PillJsLane, PillPriorityTone, PillStatusTone } from '@/components/ui/Pill';

/**
 * JS Priority Board — per PRD §5.3.
 *
 * Four lanes visible simultaneously, scrollable horizontally on narrow
 * viewports. Each card is draggable between lanes when the caller is OSD
 * or Super Admin (anyone else sees the board read-only).
 */

export type BoardTask = {
  id: string;
  refNumber?: string | null;
  name: string;
  status: string;
  priority: string;
  jsPriorityLane: PillJsLane;
  divisionName: string;
  due: Date | null;
  owner: {
    name: string;
    initials: string;
    colour: string;
  };
};

type BoardProps = {
  tasksByLane: Record<PillJsLane, BoardTask[]>;
  /** When true, drag-and-drop is enabled and OSD can curate */
  canCurate: boolean;
};

const LANES: { id: PillJsLane; label: string; sub: string }[] = [
  { id: 'today', label: 'Today', sub: 'Eyes on this now' },
  { id: 'week', label: 'This week', sub: 'Lands inside the week' },
  { id: 'month', label: 'This month', sub: 'On the monthly horizon' },
  { id: 'watchlist', label: 'Watchlist', sub: 'Hold open, revisit' },
];

export function Board({ tasksByLane, canCurate }: BoardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const listRefs = useRef<Record<string, HTMLUListElement | null>>({});
  const sortablesRef = useRef<Sortable[]>([]);

  useEffect(() => {
    sortablesRef.current.forEach((s) => s.destroy());
    sortablesRef.current = [];
    if (!canCurate) return;

    LANES.forEach((lane) => {
      const el = listRefs.current[lane.id];
      if (!el) return;
      const s = Sortable.create(el, {
        group: 'js-priority-board',
        animation: 200,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        forceFallback: true,
        fallbackOnBody: true,
        emptyInsertThreshold: 32,
        onStart: () => document.body.classList.add('sortable-dragging'),
        onEnd: (evt) => {
          document.body.classList.remove('sortable-dragging');
          const item = evt.item as HTMLElement;
          const taskId = item.dataset.taskId;
          const toLane = (evt.to as HTMLElement).dataset.laneId as PillJsLane | undefined;
          const fromLane = (evt.from as HTMLElement).dataset.laneId as PillJsLane | undefined;
          if (!taskId || !toLane) return;
          if (toLane === fromLane && evt.newIndex === evt.oldIndex) return;

          const targetList = evt.to as HTMLElement;
          const orderedIds = Array.from(
            targetList.querySelectorAll<HTMLElement>('[data-task-id]'),
          ).map((el) => el.dataset.taskId!);

          startTransition(async () => {
            if (toLane !== fromLane) {
              const fd = new FormData();
              fd.set('taskId', taskId);
              fd.set('lane', toLane);
              const laneResult = await setJsPriorityLaneAction(undefined, fd);
              if (!laneResult.ok && laneResult.error) {
                setErrorBanner(laneResult.error);
                router.refresh();
                setTimeout(() => setErrorBanner(null), 4000);
                return;
              }
            }

            const reorderFd = new FormData();
            reorderFd.set('payload', JSON.stringify({ lane: toLane, taskIds: orderedIds }));
            const reorderResult = await reorderBoardAction(undefined, reorderFd);
            if (!reorderResult.ok && reorderResult.error) {
              setErrorBanner(reorderResult.error);
              setTimeout(() => setErrorBanner(null), 4000);
            }
            router.refresh();
          });
        },
      });
      sortablesRef.current.push(s);
    });

    return () => {
      sortablesRef.current.forEach((s) => s.destroy());
      sortablesRef.current = [];
    };
  }, [canCurate, tasksByLane, router]);

  return (
    <div>
      {pending ? (
        <p className="text-[11px] text-ink-3 mb-2">Saving…</p>
      ) : null}
      {errorBanner ? (
        <p
          role="alert"
          className="mb-3 text-[12px] text-urgent bg-urgent-soft border border-urgent/20 rounded-lg px-3 py-2"
        >
          {errorBanner}
        </p>
      ) : null}

      <div
        className={cn(
          'grid gap-4 overflow-x-auto pb-3',
          // Stack on mobile, 2-col tablet, 4-col laptop+
          'grid-cols-[repeat(4,minmax(260px,1fr))] md:grid-cols-2 lg:grid-cols-4',
        )}
      >
        {LANES.map((lane) => (
          <Lane
            key={lane.id}
            lane={lane}
            tasks={tasksByLane[lane.id] ?? []}
            registerRef={(el) => (listRefs.current[lane.id] = el)}
            canCurate={canCurate}
          />
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Lane
// ------------------------------------------------------------

function Lane({
  lane,
  tasks,
  registerRef,
  canCurate,
}: {
  lane: { id: PillJsLane; label: string; sub: string };
  tasks: BoardTask[];
  registerRef: (el: HTMLUListElement | null) => void;
  canCurate: boolean;
}) {
  return (
    <section
      aria-labelledby={`lane-${lane.id}`}
      className="bg-gradient-to-b from-[#faf9f5] to-bg border border-line rounded-xl p-3 flex flex-col min-h-[420px]"
    >
      <header className="flex items-center justify-between pb-2.5 border-b border-line mb-2.5">
        <div>
          <h2
            id={`lane-${lane.id}`}
            className="font-serif text-[17px] text-ink leading-none"
          >
            {lane.label}
          </h2>
          <p className="text-[10px] text-ink-3 mt-0.5">{lane.sub}</p>
        </div>
        <span
          className={cn(
            'text-[11px] font-medium px-2 py-0.5 rounded-pill border',
            tasks.length > 0
              ? 'bg-accent-soft text-accent border-accent-line'
              : 'bg-bg text-ink-3 border-line',
          )}
        >
          {tasks.length}
        </span>
      </header>

      <ul
        ref={registerRef}
        data-lane-id={lane.id}
        className={cn(
          'flex flex-col gap-2 flex-1 min-h-[200px] rounded-lg p-1',
          canCurate && 'sortable-target',
        )}
      >
        {tasks.length === 0 ? (
          <li
            className="text-center text-[11px] text-ink-3 italic rounded-lg border border-dashed border-line py-8"
            aria-hidden="true"
          >
            <i className="ti ti-inbox text-[22px] block mb-1 opacity-40" />
            {canCurate ? 'Drop tasks here' : 'Empty'}
          </li>
        ) : (
          tasks.map((t) => (
            <li key={t.id}>
              <LaneCard task={t} canCurate={canCurate} />
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

// ------------------------------------------------------------
// LaneCard — compact variant of TaskCard for the board
// ------------------------------------------------------------

function LaneCard({ task, canCurate }: { task: BoardTask; canCurate: boolean }) {
  const due = formatDue(task.due);
  return (
    <article
      data-task-id={task.id}
      className={cn(
        'relative bg-gradient-to-b from-[#fffdf7] to-white border border-accent-line rounded-xl p-2.5',
        canCurate ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
      )}
    >
      <span
        aria-hidden="true"
        className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r bg-accent"
      />

      <div className="flex items-start gap-1.5">
        {canCurate ? (
          <i
            className="ti ti-grip-vertical text-[13px] text-ink-3 mt-[2px]"
            aria-hidden="true"
          />
        ) : null}
        <Link
          href={`/tasks/${task.id}`}
          className="flex-1 min-w-0 hover:underline"
        >
          {task.refNumber ? (
            <span className="font-mono text-[9px] text-ink-3 tracking-wide block">{task.refNumber}</span>
          ) : null}
          <span className="text-[13px] font-medium text-ink leading-snug">{task.name}</span>
        </Link>
        <span
          className={cn(
            'w-2 h-2 rounded-full mt-1.5 shrink-0',
            task.priority === 'urgent' && 'bg-urgent',
            task.priority === 'high' && 'bg-high',
            task.priority === 'medium' && 'bg-medium',
            task.priority === 'low' && 'bg-low',
          )}
          aria-label={`${task.priority} priority`}
        />
      </div>

      <p className="text-[10px] text-ink-3 mt-1 mb-1.5">{task.divisionName}</p>

      <div className="flex items-center justify-between gap-2">
        <Pill
          variant="status"
          tone={task.status as PillStatusTone}
          label={TASK_STATUS_LABEL[task.status] ?? task.status}
        />
        <div className="flex items-center gap-2 text-[10px] text-ink-3 shrink-0">
          {due.tone !== 'none' ? (
            <span
              className={cn(
                due.tone === 'overdue' && 'text-urgent font-medium',
                due.tone === 'today' && 'text-accent font-medium',
              )}
            >
              {due.label}
            </span>
          ) : null}
          <Avatar
            initials={task.owner.initials}
            colour={task.owner.colour}
            size="xs"
            ariaLabel={`Owner ${task.owner.name}`}
          />
        </div>
      </div>
    </article>
  );
}
