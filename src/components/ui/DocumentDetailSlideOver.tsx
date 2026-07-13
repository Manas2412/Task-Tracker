'use client';

import Link from 'next/link';

import { Pill } from '@/components/ui/Pill';
import { SlideOverShell, SlideOverSection } from '@/components/ui/SlideOverShell';
import {
  AWAITING_INPUT_TONE,
  COMPLETED_TONE,
  UNDER_REVIEW_TONE,
  URGENCY_LABEL,
  URGENCY_TONE,
  type DocumentUrgency,
} from '@/lib/document-centre-shared';

/**
 * Right-side read-only slide-over for a Document Record card (mobile only).
 *
 * Opened by swiping a card left — mirrors the task and Timeline-File card
 * slide-overs. Shows the subject, urgency, workflow badges, and creator in a
 * compact light-indigo popup, with "Open full record" for anything editable.
 * All chrome (framing, swipe-to-close, lifecycle) lives in SlideOverShell.
 */

export type DocumentDetailSlideOverProps = {
  open: boolean;
  onClose: () => void;
  href: string;
  subject: string;
  urgency: DocumentUrgency;
  status: 'open' | 'completed';
  markedForReview: boolean;
  awaitingInput: boolean;
  createdByName: string;
  createdAtLabel: string;
  hasAttachment?: boolean;
};

export function DocumentDetailSlideOver({
  open,
  onClose,
  href,
  subject,
  urgency,
  status,
  markedForReview,
  awaitingInput,
  createdByName,
  createdAtLabel,
  hasAttachment,
}: DocumentDetailSlideOverProps) {
  const isCompleted = status === 'completed';

  return (
    <SlideOverShell
      open={open}
      onClose={onClose}
      eyebrow="Record"
      labelledById="document-drawer-title"
      closeLabel="Close record preview"
    >
      <div className="px-3.5 pt-3 pb-1">
        <h2 id="document-drawer-title" className="font-serif text-[18px] text-ink leading-tight">
          {subject}
        </h2>
      </div>

      <SlideOverSection label="Urgency · status">
        <div className="flex flex-wrap gap-1.5">
          <Pill variant="priority" tone={URGENCY_TONE[urgency]} label={URGENCY_LABEL[urgency]} />
          {isCompleted ? (
            <Pill variant="status" tone={COMPLETED_TONE} label="Completed" />
          ) : (
            <>
              {markedForReview ? (
                <Pill variant="status" tone={UNDER_REVIEW_TONE} label="Under review" />
              ) : null}
              {awaitingInput ? (
                <Pill variant="status" tone={AWAITING_INPUT_TONE} label="Awaiting input" />
              ) : null}
              {!markedForReview && !awaitingInput ? (
                <span className="text-[12.5px] text-ink-3">Open · no flags</span>
              ) : null}
            </>
          )}
        </div>
      </SlideOverSection>

      <SlideOverSection label="Created by">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[12.5px] text-ink truncate">{createdByName}</span>
          <span className="text-[12px] text-ink-3 shrink-0">{createdAtLabel}</span>
        </div>
        {hasAttachment ? (
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] text-ink-3">
            <i className="ti ti-paperclip text-[13px]" aria-hidden="true" />
            Has attachment
          </p>
        ) : null}
      </SlideOverSection>

      <div className="px-3.5 py-3 border-t border-primary-line/25">
        <Link
          href={href}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-primary hover:underline"
        >
          Open full record
          <i className="ti ti-arrow-right text-[14px]" aria-hidden="true" />
        </Link>
      </div>
    </SlideOverShell>
  );
}
