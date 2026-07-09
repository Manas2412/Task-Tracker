'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sortable from 'sortablejs';

import { Avatar, Pill } from '@/components/ui';
import { setJsPriorityLaneAction, reorderBoardAction } from '@/app/actions/tasks';
import { formatDue } from '@/lib/format';
import { TASK_STATUS_LABEL } from '@/lib/labels';
import { cn } from '@/lib/utils';

import type { PillJsLane, PillStatusTone } from '@/components/ui/Pill';

/**
 * JS Priority Board — per PRD §5.3.
 *
 * Four lanes visible simultaneously, horizontally swipeable on narrow
 * viewports (snap scrolling). Cards drag between lanes when the caller is
 * OSD or Super Admin; everyone else sees the board read-only.
 *
 * Curators also get a search tray: find any open division task and either
 * drag it straight onto a lane or tap a lane chip to add it — the tap path
 * keeps the flow easy on phones and tablets.
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

/** A search-tray candidate (due arrives as an ISO string from the API). */
type TrayTask = Omit<BoardTask, 'jsPriorityLane' | 'due'> & {
  jsPriorityLane: PillJsLane | null;
  due: string | null;
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

const LANE_SHORT: Record<PillJsLane, string> = {
  today: 'Today',
  week: 'Week',
  month: 'Month',
  watchlist: 'Watch',
};

/**
 * Lane surfaces. Today → This month fades from the strongest amber wash to
 * the lightest (the JS-priority accent in its own home); Watchlist stands
 * apart as a frosted glass panel (.glass-card).
 */
const LANE_TINT: Partial<Record<PillJsLane, React.CSSProperties>> = {
  today: {
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--accent-soft) 95%, transparent) 0%, color-mix(in srgb, var(--accent-soft) 58%, transparent) 100%)',
  },
  week: {
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--accent-soft) 60%, transparent) 0%, color-mix(in srgb, var(--accent-soft) 32%, transparent) 100%)',
  },
  month: {
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--accent-soft) 30%, transparent) 0%, color-mix(in srgb, var(--accent-soft) 12%, transparent) 100%)',
  },
};

const LANE_BORDER: Record<PillJsLane, string> = {
  today: 'border border-accent-line',
  week: 'border border-accent-line/70',
  month: 'border border-accent-line/40',
  watchlist: '', // .glass-card carries its own border
};

/** Touch-friendly Sortable options: press-and-hold to drag, so a swipe
 *  scrolls the board instead of grabbing a card. */
const TOUCH_OPTS = {
  delay: 150,
  delayOnTouchOnly: true,
  touchStartThreshold: 4,
} as const;

export function Board({ tasksByLane, canCurate }: BoardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const listRefs = useRef<Record<string, HTMLUListElement | null>>({});
  const sortablesRef = useRef<Sortable[]>([]);

  const flashError = (message: string) => {
    setErrorBanner(message);
    setTimeout(() => setErrorBanner(null), 4000);
  };

  /**
   * Persist a move: optionally change the task's lane, then (when an order
   * snapshot is provided) persist the lane's order. Shared by lane-to-lane
   * drags, tray drops, and the tray's tap-to-add chips.
   */
  const applyMove = (
    taskId: string,
    toLane: PillJsLane,
    orderedIds: string[] | null,
    changeLane: boolean,
    onDone?: () => void,
  ) => {
    startTransition(async () => {
      if (changeLane) {
        const fd = new FormData();
        fd.set('taskId', taskId);
        fd.set('lane', toLane);
        const laneResult = await setJsPriorityLaneAction(undefined, fd);
        if (!laneResult.ok && laneResult.error) {
          flashError(laneResult.error);
          router.refresh();
          return;
        }
      }
      if (orderedIds && orderedIds.length > 0) {
        const reorderFd = new FormData();
        reorderFd.set('payload', JSON.stringify({ lane: toLane, taskIds: orderedIds }));
        const reorderResult = await reorderBoardAction(undefined, reorderFd);
        if (!reorderResult.ok && reorderResult.error) {
          flashError(reorderResult.error);
        }
      }
      onDone?.();
      router.refresh();
    });
  };

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
        // The "Drop tasks here" placeholder must never be draggable.
        filter: '.lane-empty',
        preventOnFilter: false,
        ...TOUCH_OPTS,
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
            new Set(
              Array.from(targetList.querySelectorAll<HTMLElement>('[data-task-id]')).map(
                (el) => el.dataset.taskId!,
              ),
            ),
          );

          applyMove(taskId, toLane, orderedIds, toLane !== fromLane);
        },
      });
      sortablesRef.current.push(s);
    });

    return () => {
      sortablesRef.current.forEach((s) => s.destroy());
      sortablesRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canCurate, tasksByLane, router]);

  return (
    <div>
      {canCurate ? (
        <SearchTray pending={pending} applyMove={applyMove} />
      ) : null}

      {pending ? (
        <p className="text-[11px] text-ink-3 mb-2" role="status">Saving…</p>
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
          'grid gap-4 overflow-x-auto pb-3 overscroll-x-contain',
          // Horizontal swipe (snap) on mobile, 2-col tablet, 4-col laptop+
          'snap-x snap-proximity md:snap-none',
          'grid-cols-[repeat(4,minmax(272px,1fr))] md:grid-cols-2 lg:grid-cols-4',
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
// Search tray — find a task, drag it onto a lane or tap to add
// ------------------------------------------------------------

const TRAY_DEBOUNCE_MS = 250;
const TRAY_MIN_LENGTH = 2;

function SearchTray({
  pending,
  applyMove,
}: {
  pending: boolean;
  applyMove: (
    taskId: string,
    toLane: PillJsLane,
    orderedIds: string[] | null,
    changeLane: boolean,
    onDone?: () => void,
  ) => void;
}) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [results, setResults] = useState<TrayTask[]>([]);
  const [loading, setLoading] = useState(false);
  const trayRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), TRAY_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (debounced.length < TRAY_MIN_LENGTH) {
      setResults([]);
      setLoading(false);
      return;
    }
    const ctl = new AbortController();
    setLoading(true);
    fetch(`/api/priority-board/search?q=${encodeURIComponent(debounced)}`, {
      signal: ctl.signal,
      cache: 'no-store',
    })
      .then(async (r) => {
        if (!r.ok) throw new Error('Search failed');
        return (await r.json()) as { tasks: TrayTask[] };
      })
      .then((data) => {
        setResults(data.tasks);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setLoading(false);
      });
    return () => ctl.abort();
  }, [debounced]);

  /** Optimistically stamp a result's lane badge once it lands on the board. */
  const markOnBoard = (taskId: string, lane: PillJsLane) => {
    setResults((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, jsPriorityLane: lane } : t)),
    );
  };

  // Drag OUT of the tray into any lane. `pull: 'clone'` keeps the tray
  // intact; on drop we snapshot the target order, then put the DOM back
  // exactly as React rendered it (clone trick) before persisting — so
  // React's tree is never left mutated underneath it.
  const hasResults = results.length > 0;
  useEffect(() => {
    const el = trayRef.current;
    if (!el) return;
    const s = Sortable.create(el, {
      group: { name: 'js-priority-board', pull: 'clone', put: false },
      sort: false,
      animation: 200,
      forceFallback: true,
      fallbackOnBody: true,
      ghostClass: 'sortable-ghost',
      dragClass: 'sortable-drag',
      filter: 'button, a',
      preventOnFilter: false,
      ...TOUCH_OPTS,
      onStart: () => document.body.classList.add('sortable-dragging'),
      onEnd: (evt) => {
        document.body.classList.remove('sortable-dragging');
        const to = evt.to as HTMLElement;
        const toLane = to.dataset.laneId as PillJsLane | undefined;
        if (!toLane) return; // dropped back on the tray — Sortable reverts

        const item = evt.item as HTMLElement;
        const taskId = item.dataset.taskId;

        // Snapshot the lane's order at the drop position (dedupe in case the
        // task's existing card is already in this lane).
        const orderedIds = Array.from(
          new Set(
            Array.from(to.querySelectorAll<HTMLElement>('[data-task-id]')).map(
              (n) => n.dataset.taskId!,
            ),
          ),
        );

        // Restore the DOM for React: original chip back into the tray where
        // the clone sits, clone removed.
        const clone = evt.clone as HTMLElement | undefined;
        if (clone && clone.parentNode) {
          clone.parentNode.insertBefore(item, clone);
          clone.remove();
        } else {
          item.remove();
        }

        if (!taskId) return;
        applyMove(taskId, toLane, orderedIds, true, () => markOnBoard(taskId, toLane));
      },
    });
    return () => s.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasResults]);

  const searching = debounced.length >= TRAY_MIN_LENGTH;

  return (
    <section aria-label="Add tasks to the board" className="glass-card rounded-xl p-3 md:p-4 mb-4">
      <div className="relative">
        <i
          className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-ink-3 pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tasks to add — drag onto a lane, or tap a lane chip…"
          aria-label="Search tasks to add to the board"
          autoComplete="off"
          className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-line bg-panel text-[13px] text-ink placeholder:text-ink-3 outline-none focus:border-ink"
        />
      </div>

      {searching ? (
        loading && !hasResults ? (
          <p className="mt-3 text-[12px] text-ink-3">Searching…</p>
        ) : hasResults ? (
          <ul
            ref={trayRef}
            className="mt-3 flex gap-2 overflow-x-auto pb-1 snap-x snap-proximity [&::-webkit-scrollbar]:h-1.5"
          >
            {results.map((t) => (
              <TrayCard
                key={t.id}
                task={t}
                disabled={pending}
                onAdd={(lane) =>
                  applyMove(t.id, lane, null, true, () => markOnBoard(t.id, lane))
                }
              />
            ))}
          </ul>
        ) : !loading ? (
          <p className="mt-3 text-[12px] text-ink-3">
            No open tasks match &ldquo;{debounced}&rdquo;.
          </p>
        ) : null
      ) : (
        <p className="mt-2 text-[11px] text-ink-3">
          Type at least two characters — search by task name, reference number, or owner.
        </p>
      )}
    </section>
  );
}

function TrayCard({
  task,
  disabled,
  onAdd,
}: {
  task: TrayTask;
  disabled: boolean;
  onAdd: (lane: PillJsLane) => void;
}) {
  return (
    <li
      data-task-id={task.id}
      className="snap-start shrink-0 w-[248px] rounded-xl border border-line bg-panel p-2.5 cursor-grab active:cursor-grabbing shadow-card"
    >
      <div className="flex items-start gap-1.5">
        <i className="ti ti-grip-vertical text-[13px] text-ink-3 mt-[2px] shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          {task.refNumber ? (
            <span className="font-mono text-[9px] text-ink-3 tracking-wide block">
              {task.refNumber}
            </span>
          ) : null}
          <span className="block text-[12.5px] font-medium text-ink leading-snug truncate">
            {task.name}
          </span>
          <span className="block text-[10px] text-ink-3 truncate mt-0.5">
            {task.divisionName} · {task.owner.name}
          </span>
        </div>
        <Avatar
          initials={task.owner.initials}
          colour={task.owner.colour}
          size="xs"
          ariaLabel={`Owner ${task.owner.name}`}
        />
      </div>

      <div className="mt-2 flex items-center gap-1 flex-wrap">
        {task.jsPriorityLane ? (
          <span className="inline-flex items-center gap-1 text-[9.5px] font-medium text-accent bg-accent-soft border border-accent-line px-1.5 py-0.5 rounded-pill">
            <i className="ti ti-bookmark-filled text-[8px]" aria-hidden="true" />
            On board · {LANE_SHORT[task.jsPriorityLane]}
          </span>
        ) : null}
        <span className="flex-1" />
        {LANES.map((lane) => (
          <button
            key={lane.id}
            type="button"
            disabled={disabled || task.jsPriorityLane === lane.id}
            onClick={() => onAdd(lane.id)}
            title={`Add to ${lane.label}`}
            className={cn(
              'px-1.5 py-0.5 rounded-md border text-[9.5px] font-medium transition-colors',
              task.jsPriorityLane === lane.id
                ? 'border-accent-line bg-accent-soft text-accent cursor-default'
                : 'border-line bg-bg text-ink-2 hover:border-ink-4 hover:text-ink disabled:opacity-50',
            )}
          >
            {LANE_SHORT[lane.id]}
          </button>
        ))}
      </div>
    </li>
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
  const isGlass = lane.id === 'watchlist';
  return (
    <section
      aria-labelledby={`lane-${lane.id}`}
      style={LANE_TINT[lane.id]}
      className={cn(
        'rounded-xl p-3 flex flex-col min-h-[420px] snap-start',
        LANE_BORDER[lane.id],
        isGlass && 'glass-card',
      )}
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
            className="lane-empty text-center text-[11px] text-ink-3 italic rounded-lg border border-dashed border-line py-8"
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
        'relative bg-gradient-to-b from-accent-tint to-panel border border-accent-line rounded-xl p-2.5 shadow-card',
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
