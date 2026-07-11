'use client';

import Link from 'next/link';

import { QuoteCard } from '@/components/ui/QuoteCard';
import {
  SlideOverShell,
  SlideOverSection,
  SlideOverDocs,
  type SlideOverDoc,
} from '@/components/ui/SlideOverShell';
import { istDayDiff } from '@/lib/date';

/**
 * Right-side read-only slide-over for a Timeline File card (mobile only).
 *
 * Opened by swiping a file card left. Focused on the file's substance rather
 * than its desk metadata: the subject, then — each only when it has content —
 * the Secretary's comments, the desk comment, and the latest discussion, plus
 * the tappable source/action documents. When none of the three comment fields
 * carry anything yet, a short overview (with the deadline, if any) stands in.
 * "Open full file" links to the detail page. All popup chrome lives in
 * SlideOverShell.
 */

export type TimelineFileDetailSlideOverProps = {
  open: boolean;
  onClose: () => void;
  href: string;
  refNo: string;
  subject: string;
  deadlineDate: Date | null;
  status: string;
  secretaryComments: string | null;
  deskComments: string | null;
  discussion: { count: number; latest: { author: string; body: string } | null };
  sourceDocs: SlideOverDoc[];
  actionDocs: SlideOverDoc[];
};

export function TimelineFileDetailSlideOver({
  open,
  onClose,
  href,
  refNo,
  subject,
  deadlineDate,
  status,
  secretaryComments,
  deskComments,
  discussion,
  sourceDocs,
  actionDocs,
}: TimelineFileDetailSlideOverProps) {
  const hasSecretary = Boolean(secretaryComments && secretaryComments.trim());
  const hasDesk = Boolean(deskComments && deskComments.trim());
  const hasDiscussion = discussion.count > 0;
  const hasAnyComment = hasSecretary || hasDesk || hasDiscussion;

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
      <div className="px-3.5 pt-3 pb-1.5">
        <h2
          id="tf-drawer-title"
          className="font-serif text-[17px] text-ink leading-tight tracking-tight-title"
        >
          {subject}
        </h2>
      </div>

      {hasSecretary ? (
        <SlideOverSection label="Secretary's comments">
          <QuoteCard
            text={secretaryComments as string}
            tone="primary"
            textClassName="text-[13px] line-clamp-5"
          />
        </SlideOverSection>
      ) : null}

      {hasDesk ? (
        <SlideOverSection label="Desk comment">
          <QuoteCard
            text={deskComments as string}
            tone="primary"
            textClassName="text-[13px] line-clamp-5"
          />
        </SlideOverSection>
      ) : null}

      {hasDiscussion ? (
        <SlideOverSection label="Discussion">
          <p className="text-[11px] font-medium text-primary/70">
            {discussion.count} {discussion.count === 1 ? 'comment' : 'comments'}
          </p>
          {discussion.latest ? (
            <div className="mt-1.5 rounded-lg bg-panel border border-primary-line/40 px-3 py-2">
              <p className="text-[11px] font-medium text-ink-2">{discussion.latest.author}</p>
              <p className="mt-0.5 text-[12.5px] text-ink leading-snug line-clamp-3 whitespace-pre-wrap">
                {discussion.latest.body}
              </p>
            </div>
          ) : null}
        </SlideOverSection>
      ) : null}

      {/* Improvised stand-in when the file carries no notes or discussion yet —
          keeps the preview intentional rather than empty. */}
      {!hasAnyComment ? (
        <SlideOverSection label="Overview">
          <p className="text-[12px] italic text-ink-3">No comments or discussion yet.</p>
          {deadlineDate && !isClosed ? (
            <p className="mt-1 text-[11.5px] text-ink-2">
              {isOverdue ? 'Deadline passed ' : 'Due '}
              <span className="font-medium">{formatShort(deadlineDate)}</span>
            </p>
          ) : null}
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

// IST-explicit (this is a client component) so the deadline agrees with the
// server render — see TimelineFileCard for the rationale.
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
