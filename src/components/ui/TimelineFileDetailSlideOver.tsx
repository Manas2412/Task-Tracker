'use client';

import Link from 'next/link';

import { MarkedToChip } from '@/components/ui/MarkedToChip';
import { Pill, type PillPriorityTone } from '@/components/ui/Pill';
import {
  SlideOverShell,
  SlideOverSection,
  SlideOverDocs,
  type SlideOverDoc,
} from '@/components/ui/SlideOverShell';
import { TF_STATUS_LABEL, TF_STATUS_TONE } from '@/components/ui/TimelineFileCard';
import { istDayDiff } from '@/lib/date';
import { TASK_PRIORITY_LABEL } from '@/lib/labels';

/**
 * Right-side read-only slide-over for a Timeline File card (mobile only).
 *
 * Opened by swiping a file card left. Shows the file's ref/subject, status,
 * priority, deadline, sender, marked-to divisions, and — tappable, opening on
 * mobile — its source and action documents. "Open full file" links to the
 * detail page. All popup chrome lives in SlideOverShell.
 */

export type TimelineFileDetailSlideOverProps = {
  open: boolean;
  onClose: () => void;
  href: string;
  refNo: string;
  subject: string;
  fromWhom: string;
  receivedDate: Date;
  deadlineDate: Date | null;
  status: string;
  priority: string;
  markedTo: Array<{ id: string; name: string; avatarColour: string }>;
  taskLinkCount: number;
  sourceDocs: SlideOverDoc[];
  actionDocs: SlideOverDoc[];
};

export function TimelineFileDetailSlideOver({
  open,
  onClose,
  href,
  refNo,
  subject,
  fromWhom,
  receivedDate,
  deadlineDate,
  status,
  priority,
  markedTo,
  taskLinkCount,
  sourceDocs,
  actionDocs,
}: TimelineFileDetailSlideOverProps) {
  const isClosed = status === 'closed';
  const days = deadlineDate ? daysUntil(deadlineDate) : null;
  const isOverdue = days !== null && days < 0;

  return (
    <SlideOverShell
      open={open}
      onClose={onClose}
      eyebrow="Timeline file"
      refNumber={refNo}
      labelledById="tf-drawer-title"
      closeLabel="Close file preview"
    >
      <div className="px-3.5 pt-3 pb-2">
        <h2 id="tf-drawer-title" className="font-serif text-[17px] text-ink leading-tight tracking-tight-title">
          {subject}
        </h2>
        <p className="mt-1.5 text-[11px] text-ink-3">
          From <span className="text-ink-2 font-medium">{fromWhom}</span>
          <span className="mx-1.5 text-ink-4">·</span>
          Received {formatShort(receivedDate)}
        </p>
      </div>

      <SlideOverSection label="Status">
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill
            variant="priority"
            tone={(priority as PillPriorityTone) ?? 'medium'}
            label={TASK_PRIORITY_LABEL[priority] ?? priority}
          />
          <Pill
            variant="status"
            tone={TF_STATUS_TONE[status] ?? 'pending_action'}
            label={TF_STATUS_LABEL[status] ?? status}
          />
          {deadlineDate && !isClosed && days !== null ? (
            <Pill variant="deadline" daysLeft={days} overdue={isOverdue} />
          ) : null}
          {taskLinkCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-ink-3 px-1.5 py-0.5 rounded-md bg-line-2">
              <i className="ti ti-link text-[11px]" aria-hidden="true" />
              {taskLinkCount} {taskLinkCount === 1 ? 'task' : 'tasks'}
            </span>
          ) : null}
        </div>
      </SlideOverSection>

      {markedTo.length > 0 ? (
        <SlideOverSection label="Marked to">
          <div className="flex flex-wrap gap-1.5">
            {markedTo.map((d) => (
              <MarkedToChip key={d.id} name={d.name} colour={d.avatarColour} />
            ))}
          </div>
        </SlideOverSection>
      ) : null}

      <SlideOverSection label="Source documents">
        <SlideOverDocs docs={sourceDocs} emptyLabel="No source documents" />
      </SlideOverSection>

      <SlideOverSection label="Action documents">
        <SlideOverDocs docs={actionDocs} emptyLabel="Not yet uploaded" />
      </SlideOverSection>

      <div className="px-3.5 py-3 border-t border-primary-line/25">
        <Link
          href={href}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-primary hover:underline"
        >
          Open full file
          <i className="ti ti-arrow-right text-[14px]" aria-hidden="true" />
        </Link>
      </div>
    </SlideOverShell>
  );
}

// IST-explicit (this is a client component) so the deadline pill agrees with
// the server render — see TimelineFileCard for the rationale.
function daysUntil(d: Date): number {
  return istDayDiff(d, new Date());
}

function formatShort(d: Date): string {
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}
