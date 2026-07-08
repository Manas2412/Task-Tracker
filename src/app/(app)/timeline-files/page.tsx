import Link from 'next/link';
import { redirect } from 'next/navigation';

import { TimelineFileCard } from '@/components/ui';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isS3Configured } from '@/lib/s3';
import {
  fetchTfCounts,
  fetchVisibleTimelineFiles,
  suggestNextRefSeq,
  type TfFilter,
  type TfSort,
  type VisibleTimelineFile,
} from '@/lib/timeline-files';
import { cn } from '@/lib/utils';

import { CreateTimelineFileDialog } from './_components/CreateTimelineFileDialog';

const VALID_FILTERS: TfFilter[] = [
  'all',
  'pending_action',
  'in_progress',
  'awaiting_reply',
  'on_hold',
  'closed',
];

const FILTER_LABELS: Record<TfFilter, string> = {
  all: 'All',
  pending_action: 'Pending action',
  in_progress: 'In progress',
  awaiting_reply: 'Awaiting reply',
  on_hold: 'On hold',
  closed: 'Closed',
};

const VALID_SORTS: TfSort[] = ['default', 'latest'];

const SORT_LABELS: Record<TfSort, string> = {
  default: 'Default',
  latest: 'Latest',
};

/** How the list is grouped. 'none' = a single flat list. */
type TfGroup = 'none' | 'division';
const VALID_GROUPS: TfGroup[] = ['none', 'division'];

type PageProps = {
  searchParams?: { filter?: string; sort?: string; group?: string };
};

/** Build a list URL, omitting params left at their default. */
function buildHref(params: { filter: TfFilter; sort: TfSort; group: TfGroup }): string {
  const sp = new URLSearchParams();
  if (params.filter !== 'all') sp.set('filter', params.filter);
  if (params.sort !== 'default') sp.set('sort', params.sort);
  if (params.group !== 'none') sp.set('group', params.group);
  const qs = sp.toString();
  return qs ? `/timeline-files?${qs}` : '/timeline-files';
}

/**
 * Group visible files by the divisions each is marked to. A file marked to
 * several divisions appears under each. Groups are ordered by division name;
 * files with no marked-to division fall into a trailing "No division" group.
 * Within a group the incoming (already sorted) order is preserved.
 */
function groupByDivision(tfs: VisibleTimelineFile[]): Array<{
  id: string;
  name: string;
  colour: string | null;
  tfs: VisibleTimelineFile[];
}> {
  const groups = new Map<string, { id: string; name: string; colour: string | null; tfs: VisibleTimelineFile[] }>();
  const NO_DIVISION = '__none__';

  for (const tf of tfs) {
    if (tf.markedTo.length === 0) {
      const g = groups.get(NO_DIVISION) ?? { id: NO_DIVISION, name: 'No division', colour: null, tfs: [] };
      g.tfs.push(tf);
      groups.set(NO_DIVISION, g);
      continue;
    }
    for (const { division } of tf.markedTo) {
      const g =
        groups.get(division.id) ??
        { id: division.id, name: division.name, colour: division.avatarColour, tfs: [] };
      g.tfs.push(tf);
      groups.set(division.id, g);
    }
  }

  return Array.from(groups.values()).sort((a, b) => {
    // "No division" always sinks to the bottom.
    if (a.id === NO_DIVISION) return 1;
    if (b.id === NO_DIVISION) return -1;
    return a.name.localeCompare(b.name);
  });
}

export default async function TimelineFilesPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const filter: TfFilter = VALID_FILTERS.includes(
    (searchParams?.filter as TfFilter) ?? 'all',
  )
    ? ((searchParams?.filter as TfFilter) ?? 'all')
    : 'all';

  const sort: TfSort = VALID_SORTS.includes((searchParams?.sort as TfSort) ?? 'default')
    ? ((searchParams?.sort as TfSort) ?? 'default')
    : 'default';

  const group: TfGroup = VALID_GROUPS.includes((searchParams?.group as TfGroup) ?? 'none')
    ? ((searchParams?.group as TfGroup) ?? 'none')
    : 'none';

  const canCreate =
    session.user.isSuperAdmin || session.user.hierarchySlot === 'osd';

  const [tfs, counts, divisions, suggestedFileNumber] = await Promise.all([
    fetchVisibleTimelineFiles({ callerId: session.user.id, filter, sort }),
    fetchTfCounts(session.user.id),
    canCreate
      ? prisma.division.findMany({
          where: { kind: 'division' },
          orderBy: { displayOrder: 'asc' },
          select: { id: true, name: true, avatarColour: true },
        })
      : Promise.resolve([]),
    canCreate ? suggestNextRefSeq(new Date().getUTCFullYear()) : Promise.resolve(1),
  ]);

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 pt-4 md:pt-6 pb-12">
      {/* Page header */}
      <header className="mb-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.08em] text-ink-3 font-medium mb-1 inline-flex items-center gap-1">
              <i
                className="ti ti-file-stack text-[11px] text-primary"
                aria-hidden="true"
              />
              Correspondence
            </p>
            <h1 className="font-serif text-[22px] md:text-[28px] leading-tight text-ink">
              Timeline files
            </h1>
            <p className="mt-1.5 text-[12px] text-ink-2 max-w-2xl leading-relaxed">
              Important correspondence — letters, memos, references from the
              Minister, other ministries, external parties. Each gets a
              reference number and a deadline.
            </p>
          </div>
          {canCreate ? (
            <CreateTimelineFileDialog
              divisions={divisions}
              defaultReceivedDate={todayIso}
              suggestedFileNumber={suggestedFileNumber}
              s3Configured={isS3Configured()}
            />
          ) : null}
        </div>
      </header>

      {/* Stats strip */}
      <section
        aria-label="Counters"
        className="grid grid-cols-3 gap-3 mb-5"
      >
        <Stat label="Open files" value={counts.open} />
        <Stat label="Pending action" value={counts.pendingAction} accent />
        <Stat label="Overdue" value={counts.overdue} alert={counts.overdue > 0} />
      </section>

      {/* Filter chips */}
      <nav
        aria-label="Filter files"
        className="flex gap-1.5 flex-wrap mb-4"
      >
        {VALID_FILTERS.map((f) => {
          const active = f === filter;
          const href = buildHref({ filter: f, sort, group });
          return (
            <Link
              key={f}
              href={href}
              scroll={false}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'whitespace-nowrap px-[11px] py-[5px] rounded-[14px] text-[12px] font-medium border transition-colors',
                active
                  ? 'bg-ink text-white border-ink'
                  : 'bg-panel text-ink-2 border-line hover:border-ink-4',
              )}
            >
              {FILTER_LABELS[f]}
            </Link>
          );
        })}
      </nav>

      {/* Sort + group controls */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
        <div className="flex items-center gap-1.5" role="group" aria-label="Sort files">
          <span className="text-[11px] font-medium text-ink-3">Sort</span>
          {VALID_SORTS.map((s) => {
            const active = s === sort;
            return (
              <Link
                key={s}
                href={buildHref({ filter, sort: s, group })}
                scroll={false}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'whitespace-nowrap px-[11px] py-[5px] rounded-[14px] text-[12px] font-medium border transition-colors',
                  active
                    ? 'bg-ink text-white border-ink'
                    : 'bg-panel text-ink-2 border-line hover:border-ink-4',
                )}
              >
                {SORT_LABELS[s]}
              </Link>
            );
          })}
        </div>

        <Link
          href={buildHref({ filter, sort, group: group === 'division' ? 'none' : 'division' })}
          scroll={false}
          aria-pressed={group === 'division'}
          className={cn(
            'inline-flex items-center gap-1.5 whitespace-nowrap px-[11px] py-[5px] rounded-[14px] text-[12px] font-medium border transition-colors',
            group === 'division'
              ? 'bg-ink text-white border-ink'
              : 'bg-panel text-ink-2 border-line hover:border-ink-4',
          )}
        >
          <i
            className={cn('text-[13px]', group === 'division' ? 'ti ti-check' : 'ti ti-layout-list')}
            aria-hidden="true"
          />
          Group by division
        </Link>
      </div>

      {/* List */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="section-label">Files</h2>
          <span className="text-[11px] text-ink-3">
            {tfs.length} {tfs.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        {tfs.length === 0 ? (
          <EmptyState filter={filter} canCreate={canCreate} />
        ) : group === 'division' ? (
          <div className="flex flex-col gap-6">
            {groupByDivision(tfs).map((g) => (
              <section key={g.id} aria-label={g.name}>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={g.colour ? { background: g.colour } : undefined}
                    aria-hidden="true"
                  />
                  <h3 className="text-[13px] font-medium text-ink">{g.name}</h3>
                  <span className="text-[11px] text-ink-3">
                    {g.tfs.length} {g.tfs.length === 1 ? 'item' : 'items'}
                  </span>
                </div>
                <TfGrid items={g.tfs} />
              </section>
            ))}
          </div>
        ) : (
          <TfGrid items={tfs} />
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Card grid — shared by the flat list and each division group
// ------------------------------------------------------------

function TfGrid({ items }: { items: VisibleTimelineFile[] }) {
  return (
    <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {items.map((tf) => (
        <li key={tf.id}>
          <TimelineFileCard
            refNo={tf.refNo}
            subject={tf.subject}
            fromWhom={tf.fromWhom}
            receivedDate={tf.receivedDate}
            deadlineDate={tf.deadlineDate}
            status={tf.status}
            priority={tf.priority}
            markedTo={tf.markedTo.map((m) => m.division)}
            taskLinkCount={tf._count.taskLinks}
            href={`/timeline-files/${tf.id}`}
          />
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------
// Stat + EmptyState
// ------------------------------------------------------------

function Stat({
  label,
  value,
  accent,
  alert,
}: {
  label: string;
  value: number;
  accent?: boolean;
  alert?: boolean;
}) {
  const tone = alert
    ? 'text-urgent'
    : accent
      ? 'text-primary'
      : 'text-ink';
  return (
    <div
      className="p-4 rounded-xl border border-line"
      style={{ background: 'linear-gradient(180deg, #fafaf7 0%, #f5f4f0 100%)' }}
    >
      <div className={cn('font-serif text-[22px] md:text-[26px] leading-none font-medium', tone)}>
        {value}
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.04em] font-medium text-ink-3">
        {label}
      </div>
    </div>
  );
}

function EmptyState({
  filter,
  canCreate,
}: {
  filter: TfFilter;
  canCreate: boolean;
}) {
  const copy: Record<TfFilter, string> = {
    all: canCreate
      ? 'No timeline files yet. Tap "New timeline file" to log the first piece of correspondence.'
      : 'Nothing marked to your division yet.',
    pending_action: 'Nothing pending action.',
    in_progress: 'No files in progress.',
    awaiting_reply: 'No files awaiting reply.',
    on_hold: 'Nothing on hold.',
    closed: 'No closed files.',
  };
  return (
    <div className="rounded-xl border border-dashed border-line p-10 text-center bg-panel">
      <i
        className="ti ti-file-stack text-[28px] text-ink-3 mb-2 block"
        aria-hidden="true"
      />
      <p className="text-[13px] text-ink-2">{copy[filter]}</p>
    </div>
  );
}
