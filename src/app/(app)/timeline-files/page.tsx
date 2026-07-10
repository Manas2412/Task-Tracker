import { redirect } from 'next/navigation';

import { TimelineFileCardInteractive } from '@/components/ui';
import { DivisionAccordion } from '@/components/DivisionAccordion';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isS3Configured } from '@/lib/s3';
import { isMediaAndIt } from '@/lib/divisions';
import {
  fetchTfCounts,
  fetchVisibleTimelineFiles,
  suggestNextRefSeq,
  type TfFilter,
  type TfSort,
  type VisibleTimelineFile,
} from '@/lib/timeline-files';

import { CreateTimelineFileDialog } from './_components/CreateTimelineFileDialog';
import { TfListControls } from './_components/TfListControls';
import { TfStatsStrip } from './_components/TfStatsStrip';

const VALID_FILTERS: TfFilter[] = [
  'all',
  'pending_action',
  'in_progress',
  'awaiting_reply',
  'on_hold',
  'closed',
];

const VALID_SORTS: TfSort[] = ['default', 'latest', 'alpha'];

/** How the list is grouped. 'none' = a single flat list. */
type TfGroup = 'none' | 'division';
const VALID_GROUPS: TfGroup[] = ['none', 'division'];

type PageProps = {
  searchParams?: { filter?: string; sort?: string; group?: string; division?: string };
};

/**
 * Group visible files by the divisions each is marked to. A file marked to
 * several divisions appears under each. Groups are ordered by division name,
 * with Media & IT pushed below the others and a "No division" group last.
 * Within a group the incoming (already sorted) order is preserved.
 *
 * When a Division filter is active, only that division's group is emitted —
 * a file marked to the selected division and others is collapsed into the one
 * group the user asked for, so the grouped view can't contradict the filter.
 */
function groupByDivision(
  tfs: VisibleTimelineFile[],
  divisionFilter: string,
): Array<{
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
      if (divisionFilter && division.id !== divisionFilter) continue;
      const g =
        groups.get(division.id) ??
        { id: division.id, name: division.name, colour: division.avatarColour, tfs: [] };
      g.tfs.push(tf);
      groups.set(division.id, g);
    }
  }

  return Array.from(groups.values()).sort((a, b) => {
    // Media & IT sits below the other divisions; "No division" always last.
    const ra = a.id === NO_DIVISION ? 2 : isMediaAndIt(a.name) ? 1 : 0;
    const rb = b.id === NO_DIVISION ? 2 : isMediaAndIt(b.name) ? 1 : 0;
    if (ra !== rb) return ra - rb;
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

  // Group-by-division is a cross-division (leadership) view. Normal users only
  // ever see their own division, so the control is hidden and a manually-set
  // ?group=division URL param is ignored for them.
  const canGroupByDivision =
    session.user.isSuperAdmin ||
    session.user.hierarchySlot === 'osd' ||
    session.user.hierarchySlot === 'js';

  const requestedGroup: TfGroup = VALID_GROUPS.includes((searchParams?.group as TfGroup) ?? 'none')
    ? ((searchParams?.group as TfGroup) ?? 'none')
    : 'none';
  const group: TfGroup = canGroupByDivision ? requestedGroup : 'none';

  const divisionFilter = searchParams?.division ?? '';

  const canCreate =
    session.user.isSuperAdmin || session.user.hierarchySlot === 'osd';

  const [tfs, counts, divisions, suggestedFileNumber] = await Promise.all([
    fetchVisibleTimelineFiles({
      callerId: session.user.id,
      filter,
      sort,
      divisionId: divisionFilter || undefined,
    }),
    fetchTfCounts(session.user.id),
    // Divisions power both the create dialog and the Division filter dropdown,
    // so they are fetched for every viewer (not just curators).
    prisma.division.findMany({
      where: { kind: 'division' },
      orderBy: { displayOrder: 'asc' },
      select: { id: true, name: true, avatarColour: true },
    }),
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

      {/* Summary cards */}
      <div className="mb-5">
        <TfStatsStrip counts={counts} />
      </div>

      {/* Status / division / sort / group controls */}
      <TfListControls
        divisions={divisions.map((d) => ({ id: d.id, name: d.name }))}
        canGroupByDivision={canGroupByDivision}
      />

      {/* List */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="section-label">Files</h2>
          <span className="text-[11px] text-ink-3">
            {tfs.length} {tfs.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        {tfs.length === 0 ? (
          <EmptyState
            filter={filter}
            canCreate={canCreate}
            divisionActive={Boolean(divisionFilter)}
          />
        ) : group === 'division' ? (
          <div className="flex flex-col gap-3">
            {groupByDivision(tfs, divisionFilter).map((g) => (
              <DivisionAccordion
                key={g.id}
                name={g.name}
                colour={g.colour}
                count={g.tfs.length}
                unit="file"
              >
                <TfGrid items={g.tfs} />
              </DivisionAccordion>
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
          <TimelineFileCardInteractive
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
            sourceDocs={tf.sourceDocs}
            actionDocs={tf.actionDocs}
          />
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------
// EmptyState
// ------------------------------------------------------------

function EmptyState({
  filter,
  canCreate,
  divisionActive,
}: {
  filter: TfFilter;
  canCreate: boolean;
  divisionActive: boolean;
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
  // A Division filter narrowing to zero is a filtered-empty state, not an
  // empty module — say so rather than "No timeline files yet".
  const message = divisionActive
    ? filter === 'all'
      ? 'No timeline files marked to this division.'
      : 'No timeline files marked to this division for this status.'
    : copy[filter];
  return (
    <div className="rounded-xl border border-dashed border-line p-10 text-center bg-panel">
      <i
        className="ti ti-file-stack text-[28px] text-ink-3 mb-2 block"
        aria-hidden="true"
      />
      <p className="text-[13px] text-ink-2">{message}</p>
    </div>
  );
}
