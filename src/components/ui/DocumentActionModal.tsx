'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';

import {
  setDocumentAwaitingInputAction,
  setDocumentReviewAction,
  setDocumentStatusAction,
} from '@/app/actions/documents';
import { cn } from '@/lib/utils';
import { useOverlayLifecycle } from '@/components/ui/useOverlayLifecycle';

/**
 * Centered quick-action modal for a Document Record card (mobile only), opened
 * by a ~1 s long press — the hold half of the task-card gesture pair, applied to
 * Document Records for consistency. Offers the same toggles as the record's
 * detail controls, each re-authorized server-side (Document Centre access):
 *   - Mark for review / Complete review
 *   - Awaited input / Clear awaiting input
 *   - Mark completed / Reopen
 *
 * Colour tokens match the detail controls and the workflow badges: review =
 * info, awaiting input = hold, completed = success.
 */

type ActionKey = 'review' | 'awaiting' | 'status';

export type DocumentActionModalProps = {
  open: boolean;
  onClose: () => void;
  documentId: string;
  subject: string;
  markedForReview: boolean;
  awaitingInput: boolean;
  status: 'open' | 'completed';
};

const EXIT_MS = 200;

type Row = {
  key: ActionKey;
  label: string;
  icon: string;
  chip: string; // color token classes for the icon chip
  run: () => Promise<{ ok: boolean; error?: string }>;
};

export function DocumentActionModal({
  open,
  onClose,
  documentId,
  subject,
  markedForReview,
  awaitingInput,
  status,
}: DocumentActionModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { render, shown, portalTarget } = useOverlayLifecycle(open, onClose, EXIT_MS, dialogRef);
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<ActionKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  // Bumped on every close so a still-in-flight action can't mutate a reopened
  // instance (the modal is never unmounted, so its state would otherwise leak).
  const genRef = useRef(0);

  useEffect(() => {
    if (!open) {
      genRef.current += 1;
      setError(null);
      setPendingKey(null);
    }
  }, [open]);

  if (!render || !portalTarget) return null;

  const isCompleted = status === 'completed';

  const boolRow = (
    key: Extract<ActionKey, 'review' | 'awaiting'>,
    on: boolean,
    action: (p: undefined, fd: FormData) => Promise<{ ok: boolean; error?: string }>,
    labelOn: string,
    labelOff: string,
    iconOn: string,
    iconOff: string,
    chip: string,
  ): Row => ({
    key,
    label: on ? labelOn : labelOff,
    icon: on ? iconOn : iconOff,
    chip,
    run: () => {
      const fd = new FormData();
      fd.set('id', documentId);
      fd.set('value', on ? 'false' : 'true');
      return action(undefined, fd);
    },
  });

  const rows: Row[] = [
    boolRow(
      'review',
      markedForReview,
      setDocumentReviewAction,
      'Complete review',
      'Mark for review',
      'ti-eye-check',
      'ti-eye',
      'bg-info-soft text-info',
    ),
    boolRow(
      'awaiting',
      awaitingInput,
      setDocumentAwaitingInputAction,
      'Clear awaiting input',
      'Awaited input',
      'ti-clock-pause',
      'ti-clock',
      'bg-hold-soft text-hold',
    ),
    {
      key: 'status',
      label: isCompleted ? 'Reopen' : 'Mark completed',
      icon: isCompleted ? 'ti-rotate' : 'ti-circle-check',
      chip: 'bg-success-soft text-success',
      run: () => {
        const fd = new FormData();
        fd.set('id', documentId);
        fd.set('status', isCompleted ? 'open' : 'completed');
        return setDocumentStatusAction(undefined, fd);
      },
    },
  ];

  const fire = (row: Row) => {
    if (pendingKey) return;
    setError(null);
    setPendingKey(row.key);
    const myGen = genRef.current;
    startTransition(async () => {
      const result = await row.run();
      // Committed + revalidated server-side, so sync the list even if the modal
      // was dismissed while the action was in flight.
      if (result.ok) router.refresh();
      if (myGen !== genRef.current) return;
      if (result.ok) {
        onClose();
      } else {
        setError(result.error ?? 'Could not apply that. Try again.');
      }
      setPendingKey(null);
    });
  };

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

      {/* Centered modal */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-actions-title"
        className={cn(
          'outline-none',
          'fixed z-[70] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
          'w-[calc(100vw-40px)] max-w-[320px] bg-panel rounded-2xl p-2',
          'shadow-[0_24px_60px_-12px_rgba(0,0,0,0.35)]',
          'transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none',
          shown
            ? 'opacity-100 scale-100 translate-x-[-50%] translate-y-[-50%]'
            : 'opacity-0 scale-95 translate-x-[-50%] translate-y-[-50%] pointer-events-none',
        )}
      >
        <h2 id="document-actions-title" className="sr-only">
          Record actions
        </h2>
        <p className="px-3 pt-2 pb-1 text-[12px] text-ink-3 truncate">{subject}</p>

        <div className="flex flex-col">
          {rows.map((row) => {
            const busy = pendingKey === row.key;
            return (
              <button
                key={row.key}
                type="button"
                onClick={() => fire(row)}
                disabled={pendingKey !== null && !busy}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors',
                  'active:scale-[0.99] motion-reduce:active:scale-100 hover:bg-bg',
                  pendingKey !== null && !busy && 'opacity-50',
                )}
              >
                <span className={cn('w-8 h-8 grid place-items-center rounded-lg shrink-0', row.chip)}>
                  <i
                    className={cn('ti text-[16px]', busy ? 'ti-loader-2 animate-spin' : row.icon)}
                    aria-hidden="true"
                  />
                </span>
                <span className="flex-1 text-[13px] font-medium text-ink">{row.label}</span>
              </button>
            );
          })}
        </div>

        {error ? (
          <p role="alert" className="px-3 pt-1 pb-2 text-[12px] text-urgent">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-1 py-2.5 rounded-xl text-[13px] font-medium text-ink-2 hover:bg-line-2 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  return createPortal(node, portalTarget);
}
