'use client';

import { useState } from 'react';
import Link from 'next/link';

import { Sheet, TF_REF_CHIP } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { TfStatKind, TfStatRow } from '@/lib/timeline-files';

type TfStatsStripProps = {
  counts: { open: number; dueToday: number; overdue: number; completed: number };
};

const SHEET_META: Record<TfStatKind, { title: string; subtitle: string; empty: string }> = {
  open: { title: 'Open files', subtitle: 'Files not yet closed', empty: 'No open files.' },
  today: { title: 'Due today', subtitle: 'Open files with a deadline today', empty: 'Nothing due today.' },
  overdue: { title: 'Overdue', subtitle: 'Open files past their deadline', empty: 'No overdue files.' },
  completed: { title: 'Completed', subtitle: 'Files that have been closed', empty: 'No completed files.' },
};

/**
 * Four-card summary strip on the timeline-files page, mirroring the tasks
 * page StatsStrip: a frosted glass card whose tiles are buttons that open a
 * lazily-fetched, visibility-scoped drill-down list. Open files / Due today /
 * Overdue / Completed.
 */
export function TfStatsStrip({ counts }: TfStatsStripProps) {
  const [kind, setKind] = useState<TfStatKind | null>(null);
  const [files, setFiles] = useState<TfStatRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openSheet = (next: TfStatKind) => {
    setKind(next);
    setError(null);
    setLoading(true);
    setFiles(null);
    fetch(`/api/timeline-files/stats?kind=${next}`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error('Could not load.');
        return r.json();
      })
      .then((data) => {
        setFiles(data.files ?? []);
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
      <div className="glass-card grid grid-cols-2 gap-3 rounded-2xl p-4 md:grid-cols-4 md:gap-6 md:p-5">
        <StatButton label="Open files" value={counts.open} onClick={() => openSheet('open')} />
        <StatButton label="Due today" value={counts.dueToday} tone="primary" onClick={() => openSheet('today')} />
        <StatButton
          label="Overdue"
          value={counts.overdue}
          tone={counts.overdue > 0 ? 'urgent' : 'ink'}
          onClick={() => openSheet('overdue')}
        />
        <StatButton label="Completed" value={counts.completed} tone="success" onClick={() => openSheet('completed')} />
      </div>

      <Sheet open={kind !== null} onClose={close} title={meta?.title} subtitle={meta?.subtitle}>
        {kind ? (
          <FileListView
            files={files}
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
  tone?: 'ink' | 'primary' | 'urgent' | 'success';
  onClick: () => void;
}) {
  const toneClass =
    tone === 'urgent'
      ? 'text-urgent'
      : tone === 'primary'
        ? 'text-primary'
        : tone === 'success'
          ? 'text-success'
          : 'text-ink';
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
// Drill-down list
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

function FileListView({
  files,
  loading,
  error,
  empty,
  onNavigate,
}: {
  files: TfStatRow[] | null;
  loading: boolean;
  error: string | null;
  empty: string;
  onNavigate: () => void;
}) {
  if (error) {
    return (
      <p role="alert" className="py-2 text-center text-[13px] text-urgent">
        {error}
      </p>
    );
  }
  if (loading && !files) return <ViewSkeleton />;
  if (!files || files.length === 0) {
    return <p className="py-3 text-center text-[13px] italic text-ink-3">{empty}</p>;
  }
  return (
    <ul className="-mx-1 flex max-h-[60dvh] flex-col gap-1.5 overflow-y-auto px-1">
      {files.map((f) => {
        const deadline = deadlineHint(f.deadlineDate, f.status);
        return (
          <li key={f.id}>
            <Link
              href={f.href}
              onClick={onNavigate}
              className="flex items-center gap-3 rounded-xl border border-line bg-panel px-3 py-2.5 transition-colors hover:border-ink-4 hover:bg-bg"
            >
              <span className="min-w-0 flex-1">
                <span className="mb-0.5 flex items-center gap-1.5">
                  <span className={cn(TF_REF_CHIP, 'shrink-0')}>{f.refNo}</span>
                </span>
                <span className="block truncate text-[13px] font-medium text-ink">{f.subject}</span>
                <span className="block truncate text-[11px] text-ink-3">From {f.fromWhom}</span>
              </span>
              {deadline ? (
                <span className={cn('shrink-0 text-[11px] font-medium', deadline.className)}>
                  {deadline.label}
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

/**
 * Short deadline label for a drill-down row. `deadlineDate` is a date-only
 * value stored at UTC midnight; India runs on IST (browser local time), so
 * the UTC-midnight instant reads as the correct IST calendar day locally.
 * Closed files show no deadline emphasis.
 */
function deadlineHint(
  iso: string | null,
  status: string,
): { label: string; className: string } | null {
  if (!iso || status === 'closed') return null;
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) {
    const n = Math.abs(days);
    return { label: `${n} ${n === 1 ? 'day' : 'days'} overdue`, className: 'text-urgent' };
  }
  if (days === 0) return { label: 'Today', className: 'text-primary' };
  return { label: `${days} ${days === 1 ? 'day' : 'days'} left`, className: 'text-ink-3' };
}
