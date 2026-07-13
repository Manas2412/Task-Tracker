import Link from 'next/link';

import { Pill } from '@/components/ui/Pill';
import {
  AWAITING_INPUT_TONE,
  COMPLETED_TONE,
  UNDER_REVIEW_TONE,
  URGENCY_LABEL,
  URGENCY_TONE,
  type DocumentUrgency,
} from '@/lib/document-centre-shared';
import { cn } from '@/lib/utils';

/**
 * DocumentCard — the Document Centre list card. Server-compatible (no
 * 'use client'), so it renders in both the server list and the client quick-
 * search results, exactly like TaskCard. Displays the subject, urgency, the
 * workflow badges, created-by / created-date, and an attachment clip.
 */

export type DocumentCardProps = {
  id: string;
  subject: string;
  urgency: DocumentUrgency;
  status: 'open' | 'completed';
  markedForReview: boolean;
  awaitingInput: boolean;
  createdByName: string;
  createdAt: Date | string;
  hasAttachment?: boolean;
  href?: string;
  className?: string;
};

function formatCreated(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

export function DocumentCard({
  id,
  subject,
  urgency,
  status,
  markedForReview,
  awaitingInput,
  createdByName,
  createdAt,
  hasAttachment,
  href,
  className,
}: DocumentCardProps) {
  const Wrapper: React.ElementType = href ? Link : 'article';
  const wrapperProps = href ? { href, draggable: false } : {};
  const isCompleted = status === 'completed';

  return (
    <Wrapper
      {...wrapperProps}
      data-document-id={id}
      className={cn(
        'relative block bg-panel border border-line rounded-xl p-[13px] shadow-card',
        'transition-[color,border-color,box-shadow,transform] duration-[var(--dur-base)] ease-[var(--ease-standard)]',
        'hover:border-ink-4 hover:-translate-y-px hover:shadow-card-hover active:translate-y-0 active:scale-[0.99]',
        'motion-reduce:transition-none motion-reduce:transform-none',
        'focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',
        className,
      )}
    >
      <header className="mb-2">
        <h3 className="text-[14px] font-medium leading-[1.35] text-ink tracking-[-0.005em]">
          {subject}
        </h3>
      </header>

      <div className="mb-2 flex flex-wrap gap-1.5">
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
          </>
        )}
      </div>

      <footer className="flex items-center justify-between gap-2 text-[11px] text-ink-3">
        <span className="min-w-0 truncate">
          {createdByName}
          <span className="mx-1.5 text-ink-4">·</span>
          <time>{formatCreated(createdAt)}</time>
        </span>
        {hasAttachment ? (
          <i
            className="ti ti-paperclip text-[13px] text-ink-3 shrink-0"
            aria-hidden="true"
            title="Has attachment"
          />
        ) : null}
      </footer>
    </Wrapper>
  );
}
