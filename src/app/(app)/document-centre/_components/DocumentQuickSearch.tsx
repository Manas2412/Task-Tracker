'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import { DocumentCard } from '@/components/ui/DocumentCard';
import type { DocumentSearchCard } from '@/lib/document-search';
import { cn } from '@/lib/utils';

/**
 * Quick Search for the Document Centre. Typing runs a gated search across
 * subject, context, attachment names, discussion, and Drive links (via
 * /api/documents/search) and overlays the matching record cards in place of
 * the normal list. Mirrors the tasks TasksQuickSearch; never touches the URL,
 * so filters/sort stay put.
 */

const MIN_CHARS = 2;
const DEBOUNCE_MS = 250;

type Data = { rows: DocumentSearchCard[]; total: number; capped: boolean };

export function DocumentQuickSearch({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Data>({ rows: [], total: 0, capped: false });

  const abortRef = useRef<AbortController | null>(null);
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

      fetch(`/api/documents/search?q=${encodeURIComponent(trimmed)}`, { signal: ac.signal })
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
          if (reqId !== reqIdRef.current) return;
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
            placeholder="Search records…"
            autoComplete="off"
            enterKeyHint="search"
            aria-label="Quick search records"
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

      <div className="px-4 md:px-6 lg:px-8 mt-5">
        {active ? <Results query={trimmed} loading={loading} error={error} data={data} /> : children}
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
          <p className="text-[13px] text-ink-3">Searching all records…</p>
        </div>
      ) : hasRows ? (
        <ul
          className={cn(
            'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 md:gap-3',
            loading && 'opacity-60 transition-opacity',
          )}
        >
          {rows.map((r) => (
            <li key={r.id}>
              <DocumentCard
                id={r.id}
                subject={r.subject}
                urgency={r.urgency}
                status={r.status}
                markedForReview={r.markedForReview}
                awaitingInput={r.awaitingInput}
                createdByName={r.createdByName}
                createdAt={r.createdAt}
                hasAttachment={r.hasAttachment}
                href={`/document-centre/${r.id}`}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed border-line p-10 text-center bg-panel">
          <i className="ti ti-search-off text-[28px] text-ink-3 mb-2 block" aria-hidden="true" />
          <p className="text-[13px] text-ink-2">No records match “{query}”.</p>
          <p className="text-[11px] text-ink-3 mt-1">
            Searches subject, context, attachment names, discussion and Drive links.
          </p>
        </div>
      )}
    </section>
  );
}
