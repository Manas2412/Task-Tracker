'use client';

import Link from 'next/link';

import { Avatar } from '@/components/ui/Avatar';
import {
  SlideOverShell,
  SlideOverSection,
  SlideOverDocs,
  type SlideOverDoc,
} from '@/components/ui/SlideOverShell';
import { cn } from '@/lib/utils';

/**
 * Right-side read-only slide-over for a task card (mobile only).
 *
 * Opened by swiping a card left. Shows the task's Title, Description, Due date,
 * Owner, and Attached documents in a compact light-indigo popup. The documents
 * are tappable and open on mobile; "Open full task" links to the detail page
 * for anything editable. All chrome (popup framing, swipe-to-close, lifecycle)
 * lives in SlideOverShell.
 */

type DueTone = 'today' | 'overdue' | 'soon' | 'future' | 'none';

export type TaskDetailSlideOverProps = {
  open: boolean;
  onClose: () => void;
  href: string;
  name: string;
  refNumber?: string | null;
  description?: string | null;
  dueLabel?: string;
  dueTone?: DueTone;
  ownerName: string;
  ownerInitials: string;
  ownerColour: string;
  docs: SlideOverDoc[];
};

export function TaskDetailSlideOver({
  open,
  onClose,
  href,
  name,
  refNumber,
  description,
  dueLabel,
  dueTone = 'none',
  ownerName,
  ownerInitials,
  ownerColour,
  docs,
}: TaskDetailSlideOverProps) {
  const hasDescription = !!description && description.trim().length > 0;
  const dueColour =
    dueTone === 'overdue'
      ? 'text-urgent'
      : dueTone === 'today'
        ? 'text-accent'
        : 'text-ink-2';

  return (
    <SlideOverShell
      open={open}
      onClose={onClose}
      eyebrow="Task"
      refNumber={refNumber}
      labelledById="task-drawer-title"
      closeLabel="Close task preview"
    >
      <div className="px-3.5 pt-3 pb-1">
        <h2 id="task-drawer-title" className="font-serif text-[18px] text-ink leading-tight">
          {name}
        </h2>
      </div>

      <SlideOverSection label="Description">
        {hasDescription ? (
          <p className="text-[12.5px] text-ink-2 leading-relaxed whitespace-pre-wrap line-clamp-6">
            {description}
          </p>
        ) : (
          <p className="text-[12.5px] italic text-ink-3">No description</p>
        )}
      </SlideOverSection>

      <SlideOverSection label="Due · owner">
        <div className="flex items-center justify-between gap-3">
          <span className={cn('inline-flex items-center gap-1.5 text-[12.5px] font-medium', dueColour)}>
            <i className="ti ti-calendar-event text-[14px] text-ink-3" aria-hidden="true" />
            {dueLabel && dueTone !== 'none' ? dueLabel : 'No due date'}
          </span>
          <span className="flex items-center gap-1.5 min-w-0">
            <Avatar initials={ownerInitials} colour={ownerColour} size="xs" ariaLabel={`Owner ${ownerName}`} />
            <span className="text-[12.5px] text-ink truncate">{ownerName}</span>
          </span>
        </div>
      </SlideOverSection>

      <SlideOverSection label="Attached documents">
        <SlideOverDocs docs={docs} emptyLabel="No documents attached" />
      </SlideOverSection>

      <div className="px-3.5 py-3 border-t border-primary-line/25">
        <Link
          href={href}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-primary hover:underline"
        >
          Open full task
          <i className="ti ti-arrow-right text-[14px]" aria-hidden="true" />
        </Link>
      </div>
    </SlideOverShell>
  );
}
