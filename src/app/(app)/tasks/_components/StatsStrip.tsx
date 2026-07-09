'use client';

import { useState } from 'react';
import Link from 'next/link';

import { Sheet } from '@/components/ui';
import { formatDue } from '@/lib/format';
import type { DivisionOpenBreakdown, StatTaskRow } from '@/lib/visibility';
import { cn } from '@/lib/utils';

type StatsStripProps = {
  counts: { open: number; dueToday: number; overdue: number };
};

type Kind = 'today' | 'overdue' | 'divisions';

const SHEET_META: Record<Kind, { title: string; subtitle: string; empty: string }> = {
  today: { title: 'Due today', subtitle: 'Open tasks due today', empty: 'Nothing due today.' },
  overdue: { title: 'Overdue', subtitle: 'Open tasks past their due date', empty: 'No overdue tasks.' },
  divisions: { title: 'Open tasks by division', subtitle: 'Where the open work sits — counts only', empty: 'No open tasks.' },
};

/**
 * Three-stat strip on the tasks page. Each tile is a button that opens a
 * drill-down popup (lazily fetched, visibility-scoped): Due today / Overdue
 * list the tasks (each opens its detail), Open tasks shows the per-division /
 * sub-division counts. The panel itself is a frosted glass card.
 */
export function StatsStrip({ counts }: StatsStripProps) {
  const [kind, setKind] = useState<Kind | null>(null);
  const [tasks, setTasks] = useState<StatTaskRow[] | null>(null);
  const [divisions, setDivisions] = useState<DivisionOpenBreakdown[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openSheet = (next: Kind) => {
    setKind(next);
    setError(null);
    setLoading(true);
    if (next === 'divisions') setDivisions(null);
    else setTasks(null);
    fetch(`/api/tasks/stats?kind=${next}`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error('Could not load.');
        return r.json();
      })
      .then((data) => {
        if (next === 'divisions') setDivisions(data.divisions ?? []);
        else setTasks(data.tasks ?? []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Could not load.');
        setLoading(false);
      });
  };

  const close = () => setKind(null);
  const meta = kind ? SHEET_META[kind] : null;

  return (
    <>
      <div className="glass-card mt-4 grid grid-cols-3 gap-3 rounded-2xl p-4 md:gap-6 md:p-5">
        <StatButton label="Open tasks" value={counts.open} onClick={() => openSheet('divisions')} />
        <StatButton label="Due today" value={counts.dueToday} tone="accent" onClick={() => openSheet('today')} />
        <StatButton
          label="Overdue"
          value={counts.overdue}
          tone={counts.overdue > 0 ? 'urgent' : 'ink'}
          onClick={() => openSheet('overdue')}
        />
      </div>

      <Sheet open={kind !== null} onClose={close} title={meta?.title} subtitle={meta?.subtitle}>
        {kind === 'divisions' ? (
          <DivisionsView
            divisions={divisions}
            loading={loading}
            error={error}
            empty={SHEET_META.divisions.empty}
            onNavigate={close}
          />
        ) : kind ? (
          <TaskListView
            tasks={tasks}
            loading={loading}
            error={error}
            empty={SHEET_META[kind].empty}
            onNavigate={close}
          />
        ) : null}
      </Sheet>
    </>
  );
}

// ------------------------------------------------------------
// Tile
// ------------------------------------------------------------

function StatButton({
  label,
  value,
  tone = 'ink',
  onClick,
}: {
  label: string;
  value: number;
  tone?: 'ink' | 'accent' | 'urgent';
  onClick: () => void;
}) {
  const toneClass = tone === 'urgent' ? 'text-urgent' : tone === 'accent' ? 'text-accent' : 'text-ink';
  return (
    <button
      type="button"
      onClick={onClick}
      className="group -m-1 rounded-xl p-1 text-left transition-colors hover:bg-white/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <div className={cn('font-serif text-[22px] leading-none font-medium md:text-[28px]', toneClass)}>
        {value}
      </div>
      <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.04em] text-ink-3 md:text-[11px]">
        {label}
        <i
          className="ti ti-chevron-right text-[11px] text-ink-4 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </div>
    </button>
  );
}

// ------------------------------------------------------------
// Popup views
// ------------------------------------------------------------

function ViewSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-12 rounded-xl bg-line-2/60 animate-pulse" />
      ))}
    </div>
  );
}

function ViewError({ message }: { message: string }) {
  return (
    <p role="alert" className="py-2 text-center text-[13px] text-urgent">
      {message}
    </p>
  );
}

function TaskListView({
  tasks,
  loading,
  error,
  empty,
  onNavigate,
}: {
  tasks: StatTaskRow[] | null;
  loading: boolean;
  error: string | null;
  empty: string;
  onNavigate: () => void;
}) {
  if (error) return <ViewError message={error} />;
  if (loading && !tasks) return <ViewSkeleton />;
  if (!tasks || tasks.length === 0) {
    return <p className="py-3 text-center text-[13px] italic text-ink-3">{empty}</p>;
  }
  return (
    <ul className="-mx-1 flex max-h-[60dvh] flex-col gap-1.5 overflow-y-auto px-1">
      {tasks.map((t) => {
        const due = t.dueDate ? formatDue(new Date(t.dueDate)) : null;
        return (
          <li key={t.id}>
            <Link
              href={t.href}
              onClick={onNavigate}
              className="flex items-center gap-3 rounded-xl border border-line bg-panel px-3 py-2.5 transition-colors hover:border-ink-4 hover:bg-bg"
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: t.divisionColour }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">{t.name}</span>
                <span className="block truncate text-[11px] text-ink-3">
                  {t.divisionName} · {t.ownerName}
                </span>
              </span>
              {due && due.tone !== 'none' ? (
                <span
                  className={cn(
                    'shrink-0 text-[11px] font-medium',
                    due.tone === 'overdue' && 'text-urgent',
                    due.tone === 'today' && 'text-accent',
                    (due.tone === 'soon' || due.tone === 'future') && 'text-ink-3',
                  )}
                >
                  {due.label}
                </span>
              ) : null}
              <i className="ti ti-chevron-right shrink-0 text-[15px] text-ink-3" aria-hidden="true" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function DivisionsView({
  divisions,
  loading,
  error,
  empty,
  onNavigate,
}: {
  divisions: DivisionOpenBreakdown[] | null;
  loading: boolean;
  error: string | null;
  empty: string;
  onNavigate: () => void;
}) {
  if (error) return <ViewError message={error} />;
  if (loading && !divisions) return <ViewSkeleton />;
  if (!divisions || divisions.length === 0) {
    return <p className="py-3 text-center text-[13px] italic text-ink-3">{empty}</p>;
  }
  return (
    <ul className="-mx-1 flex max-h-[60dvh] flex-col gap-1.5 overflow-y-auto px-1">
      {divisions.map((d) => (
        <li key={d.divisionId}>
          <div className="rounded-xl border border-line bg-panel px-3 py-2.5">
            <Link
              href={`/tasks?division=${d.divisionId}`}
              onClick={onNavigate}
              className="group flex items-center gap-2.5"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: d.colour }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink group-hover:underline">
                {d.divisionName}
              </span>
              <span className="shrink-0 text-[13px] font-medium tabular-nums text-ink">{d.count}</span>
            </Link>
            {d.subDivisions.length > 0 ? (
              <ul className="ml-1 mt-1.5 flex flex-col gap-1 border-l border-line-2 pl-3">
                {d.subDivisions.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 text-[12px] text-ink-2">
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    <span className="shrink-0 tabular-nums text-ink-3">{s.count}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
