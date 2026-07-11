'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import { TaskCard } from '@/components/ui';
import type { PillJsLane, PillPriorityTone, PillStatusTone } from '@/components/ui/Pill';
import type { QuickSearchTaskCard } from '@/lib/search';
import { cn } from '@/lib/utils';

/**
 * Quick Search for the tasks page. Sits below the Summary panel; typing runs a
 * deep, visibility-scoped search across every task's title, description/context,
 * discussions, document names, subtasks and more (via `/api/tasks/search`), and
 * shows the matching task cards in place of the normal list. The list (passed
 * as `children`) returns the moment the query is cleared with the red ✕.
 *
 * It never touches the URL, so the existing filter chips / division controls
 * and their state are untouched — the search is purely additive and overlays
 * the list while a query is active.
 */

const MIN_CHARS = 2;
const DEBOUNCE_MS = 250;

type Data = { rows: QuickSearchTaskCard[]; total: number; capped: boolean };

export function TasksQuickSearch({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Data>({ rows: [], total: 0, capped: false });

  const abortRef = useRef<AbortController | null>(null);
  // Monotonic request id: every effect run bumps it, so any earlier in-flight
  // fetch becomes stale and its resolution is ignored. Guards against both the
  // debounce gap (the old request isn't aborted until the next timer fires) and
  // an already-buffered response that abort() can't un-resolve — so the
  // last-typed query is always the one whose results win, whatever the network
  // ordering.
  const reqIdRef = useRef(0);
  const trimmed = query.trim();
  const active = trimmed.length >= MIN_CHARS;

  useEffect(() => {
    const reqId = ++reqIdRef.current;

    if (trimmed.length < MIN_CHARS) {
      abortRef.current?.abort();
      setLoading(false);
      setError(null);
      setData({ rows: [], total: 0, capped: false });
      return;
    }

    setLoading(true);
    setError(null);

    const handle = setTimeout(() => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      fetch(`/api/tasks/search?q=${encodeURIComponent(trimmed)}`, { signal: ac.signal })
        .then(async (res) => {
          if (!res.ok) {
            throw new Error(
              res.status === 429
                ? 'Too many searches just now — pause a moment and try again.'
                : 'Could not run the search. Try again.',
            );
          }
          return res.json();
        })
        .then((json: Data) => {
          if (reqId !== reqIdRef.current) return; // a newer query superseded this one
          setData({ rows: json.rows ?? [], total: json.total ?? 0, capped: json.capped ?? false });
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          if (reqId !== reqIdRef.current) return;
          setError(err instanceof Error ? err.message : 'Could not run the search.');
          setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [trimmed]);

  return (
    <>
      {/* Compact search bar — a small, fixed-width field below the Summary
          panel. Capped at the same width on every breakpoint (never full-bleed
          on mobile / tablet / desktop). The very-light yellow tint is the
          sanctioned pale-yellow token `--accent-soft` mixed toward transparent
          (a translucent wash), paired with the amber border so the field keeps a
          defined edge; both are tokens, so they adapt to dark mode. */}
      <div className="px-4 md:px-6 lg:px-8 mt-4">
        <div className="relative w-full max-w-xs">
          <i
            className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-[15px] text-ink-3 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks…"
            autoComplete="off"
            enterKeyHint="search"
            aria-label="Quick search tasks"
            style={{ backgroundColor: 'color-mix(in srgb, var(--accent-soft) 55%, transparent)' }}
            className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-accent-line text-[13px] text-ink placeholder:text-ink-3 outline-none focus:border-ink transition-colors [&::-webkit-search-cancel-button]:hidden"
          />
          {loading ? (
            <i
              className="ti ti-loader-2 animate-spin absolute right-9 top-1/2 -translate-y-1/2 text-[14px] text-ink-3"
              aria-hidden="true"
            />
          ) : null}
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 grid place-items-center rounded-full text-urgent hover:bg-urgent-soft active:scale-95 transition-transform"
            >
              <i className="ti ti-x text-[16px]" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Results replace the list while a query is active; the list returns on clear. */}
      <div className="px-4 md:px-6 lg:px-8 mt-5">
        {active ? (
          <Results query={trimmed} loading={loading} error={error} data={data} />
        ) : (
          children
        )}
      </div>
    </>
  );
}

function Results({
  query,
  loading,
  error,
  data,
}: {
  query: string;
  loading: boolean;
  error: string | null;
  data: Data;
}) {
  const { rows, total, capped } = data;
  const hasRows = rows.length > 0;

  const countLabel = loading && !hasRows
    ? 'Searching…'
    : capped
      ? `Showing ${rows.length} of ${total}`
      : `${total} ${total === 1 ? 'match' : 'matches'}`;

  return (
    <section aria-label="Search results" aria-busy={loading}>
      <div className="flex items-center justify-between mb-2">
        <h2 className="section-label">Search results</h2>
        <span className="text-[11px] text-ink-3" aria-live="polite">
          {error ? '' : countLabel}
        </span>
      </div>

      {error ? (
        <div className="rounded-xl border border-urgent/30 bg-urgent-soft px-4 py-3 text-[13px] text-urgent">
          {error}
        </div>
      ) : loading && !hasRows ? (
        <div className="rounded-xl border border-dashed border-line bg-panel px-4 py-8 text-center">
          <i className="ti ti-loader-2 animate-spin text-[20px] text-ink-3 mb-2 block" aria-hidden="true" />
          <p className="text-[13px] text-ink-3">Searching all tasks…</p>
        </div>
      ) : hasRows ? (
        <ul
          className={cn(
            'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 md:gap-3',
            // Dim slightly while a follow-up query is loading over existing results.
            loading && 'opacity-60 transition-opacity',
          )}
        >
          {rows.map((t) => (
            <li key={t.taskId}>
              <TaskCard
                taskId={t.taskId}
                refNumber={t.refNumber}
                name={t.name}
                division={t.division}
                status={t.status as PillStatusTone}
                priority={t.priority as PillPriorityTone}
                jsPriorityLane={(t.jsPriorityLane as PillJsLane | null) ?? undefined}
                due={t.due}
                owner={t.owner}
                subtasks={t.subtasks ?? undefined}
                hasAttachment={t.hasAttachment}
                primaryDivisionName={t.primaryDivisionName ?? undefined}
                mobileSplit
                href={t.href}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed border-line p-10 text-center bg-panel">
          <i className="ti ti-search-off text-[28px] text-ink-3 mb-2 block" aria-hidden="true" />
          <p className="text-[13px] text-ink-2">
            No tasks match “{query}”.
          </p>
          <p className="text-[11px] text-ink-3 mt-1">
            Searches titles, context, discussions, document names and subtasks.
          </p>
        </div>
      )}
    </section>
  );
}
