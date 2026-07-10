'use client';

import { useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';

import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { useOverlayLifecycle } from '@/components/ui/useOverlayLifecycle';

/**
 * Right-side read-only slide-over for a task card (mobile only).
 *
 * Opened by swiping a card left. Dims the list behind a subtle overlay and
 * shows the task's Title, Description, Due date, Owner, and Attached documents.
 * Closes via the back-arrow, a tap on the dim overlay, or Escape. Read-only:
 * all data comes from props (no fetch); "Open full task" links to the detail
 * page for anything editable.
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
  attachmentNames: string[];
};

const EXIT_MS = 300;

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
  attachmentNames,
}: TaskDetailSlideOverProps) {
  const backRef = useRef<HTMLButtonElement>(null);
  const { render, shown, portalTarget } = useOverlayLifecycle(open, onClose, EXIT_MS, backRef);

  if (!render || !portalTarget) return null;

  const hasDescription = !!description && description.trim().length > 0;
  const dueColour =
    dueTone === 'overdue'
      ? 'text-urgent'
      : dueTone === 'today'
        ? 'text-accent'
        : 'text-ink-2';

  const node = (
    <div className="md:hidden">
      {/* Dim overlay */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-[60] bg-black/40 transition-opacity duration-200',
          shown ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      />

      {/* Right drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-drawer-title"
        className={cn(
          'fixed z-[70] top-0 right-0 h-[100dvh] w-[86vw] max-w-[380px]',
          'bg-panel shadow-[0_0_40px_-8px_rgba(0,0,0,0.3)] overflow-y-auto overscroll-contain',
          'will-change-transform transition-transform duration-300 ease-out motion-reduce:transition-none',
          shown ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header — back arrow + eyebrow */}
        <header className="sticky top-0 z-10 bg-panel/95 backdrop-blur-sm border-b border-line-2 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <button
              ref={backRef}
              type="button"
              onClick={onClose}
              aria-label="Close task preview"
              className="w-8 h-8 grid place-items-center rounded-full text-ink-2 hover:bg-line-2 active:scale-95 transition-transform"
            >
              <i className="ti ti-arrow-left text-[18px]" aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.08em] text-ink-3 font-medium">Task</p>
              {refNumber ? (
                <p className="font-mono text-[10px] text-ink-3 leading-none">{refNumber}</p>
              ) : null}
            </div>
          </div>
        </header>

        <div className="px-4 py-4">
          <h2
            id="task-drawer-title"
            className="font-serif text-[20px] text-ink leading-tight"
          >
            {name}
          </h2>
        </div>

        <Section label="Description">
          {hasDescription ? (
            <p className="text-[13px] text-ink-2 leading-relaxed whitespace-pre-wrap">{description}</p>
          ) : (
            <p className="text-[13px] italic text-ink-3">No description</p>
          )}
        </Section>

        <Section label="Due date">
          <p className={cn('inline-flex items-center gap-1.5 text-[13px] font-medium', dueColour)}>
            <i className="ti ti-calendar-event text-[14px] text-ink-3" aria-hidden="true" />
            {dueLabel && dueTone !== 'none' ? dueLabel : 'No due date'}
          </p>
        </Section>

        <Section label="Owner">
          <div className="flex items-center gap-2">
            <Avatar initials={ownerInitials} colour={ownerColour} size="xs" ariaLabel={`Owner ${ownerName}`} />
            <span className="text-[13px] text-ink">{ownerName}</span>
          </div>
        </Section>

        <Section label="Attached documents">
          {attachmentNames.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {attachmentNames.map((fileName, i) => (
                <li key={i} className="flex items-center gap-1.5 min-w-0">
                  <i className="ti ti-paperclip text-[13px] text-ink-3 shrink-0" aria-hidden="true" />
                  <span className="text-[13px] text-ink-2 truncate">{fileName}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] italic text-ink-3">No documents attached</p>
          )}
        </Section>

        <div className="px-4 py-4">
          <Link
            href={href}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"
          >
            Open full task
            <i className="ti ti-arrow-right text-[14px]" aria-hidden="true" />
          </Link>
        </div>
      </aside>
    </div>
  );

  return createPortal(node, portalTarget);
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="px-4 py-3.5 border-t border-line">
      <p className="text-[11px] uppercase tracking-[0.06em] text-ink-3 mb-1.5">{label}</p>
      {children}
    </section>
  );
}
