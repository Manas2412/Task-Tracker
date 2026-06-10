import Link from 'next/link';
import { redirect } from 'next/navigation';

import { TimelineFileCard } from '@/components/ui';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  fetchTfCounts,
  fetchVisibleTimelineFiles,
  type TfFilter,
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

type PageProps = {
  searchParams?: { filter?: string };
};

export default async function TimelineFilesPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const filter: TfFilter = VALID_FILTERS.includes(
    (searchParams?.filter as TfFilter) ?? 'all',
  )
    ? ((searchParams?.filter as TfFilter) ?? 'all')
    : 'all';

  const canCreate =
    session.user.isSuperAdmin || session.user.hierarchySlot === 'osd';

  const [tfs, counts, divisions] = await Promise.all([
    fetchVisibleTimelineFiles({ callerId: session.user.id, filter }),
    fetchTfCounts(session.user.id),
    canCreate
      ? prisma.division.findMany({
          where: { kind: 'division' },
          orderBy: { displayOrder: 'asc' },
          select: { id: true, name: true, avatarColour: true },
        })
      : Promise.resolve([]),
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
          const href = f === 'all' ? '/timeline-files' : `/timeline-files?filter=${f}`;
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
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tfs.map((tf) => (
              <li key={tf.id}>
                <TimelineFileCard
                  refNo={tf.refNo}
                  subject={tf.subject}
                  fromWhom={tf.fromWhom}
                  receivedDate={tf.receivedDate}
                  deadlineDate={tf.deadlineDate}
                  status={tf.status}
                  markedTo={tf.markedTo.map((m) => m.division)}
                  taskLinkCount={tf._count.taskLinks}
                  href={`/timeline-files/${tf.id}`}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
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
