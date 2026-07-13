'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import {
  deleteDocumentAction,
  setDocumentAwaitingInputAction,
  setDocumentReviewAction,
  setDocumentStatusAction,
  setDocumentUrgencyAction,
} from '@/app/actions/documents';
import { URGENCY_LABEL, URGENCY_OPTIONS, type DocumentUrgency } from '@/lib/document-centre-shared';
import { cn } from '@/lib/utils';

/**
 * Interactive detail controls for a document record — urgency, the two
 * workflow flags, completion, and delete. Each calls its server action
 * directly (the epoch-protocol result is checked) then refreshes; all are
 * gated server-side, so this is UI only.
 */

const URGENCY_DOT: Record<DocumentUrgency, string> = {
  highly_urgent: 'bg-urgent',
  urgent: 'bg-high',
  normal: 'bg-low',
};
const URGENCY_ACTIVE: Record<DocumentUrgency, string> = {
  highly_urgent: 'bg-urgent-soft text-urgent border-urgent/30',
  urgent: 'bg-high-soft text-high border-high/30',
  normal: 'bg-low-soft text-low border-low/30',
};

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (build: () => FormData, action: (p: undefined, fd: FormData) => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const res = await action(undefined, build());
      if (res.ok) router.refresh();
      else setError(res.error ?? 'Something went wrong.');
    });
  return { pending, error, run };
}

export function UrgencyControl({
  documentId,
  urgency,
}: {
  documentId: string;
  urgency: DocumentUrgency;
}) {
  const { pending, error, run } = useAction();
  return (
    <div>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Urgency">
        {URGENCY_OPTIONS.map((value) => {
          const active = urgency === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={pending}
              onClick={() => {
                if (active) return;
                run(() => {
                  const fd = new FormData();
                  fd.set('id', documentId);
                  fd.set('urgency', value);
                  return fd;
                }, setDocumentUrgencyAction);
              }}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-pill text-[11px] font-medium border transition-colors disabled:opacity-60',
                active ? URGENCY_ACTIVE[value] : 'bg-panel text-ink-2 border-line hover:border-ink-4',
              )}
            >
              <span className={cn('w-1.5 h-1.5 rounded-full', URGENCY_DOT[value])} aria-hidden="true" />
              {URGENCY_LABEL[value]}
            </button>
          );
        })}
      </div>
      {error ? <p role="alert" className="mt-1 text-[11px] text-urgent">{error}</p> : null}
    </div>
  );
}

function ToggleButton({
  on,
  pending,
  onClick,
  iconOn,
  iconOff,
  labelOn,
  labelOff,
  activeClass,
}: {
  on: boolean;
  pending: boolean;
  onClick: () => void;
  iconOn: string;
  iconOff: string;
  labelOn: string;
  labelOff: string;
  activeClass: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={on}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors disabled:opacity-60',
        on ? activeClass : 'bg-panel text-ink-2 border-line hover:border-ink-4',
      )}
    >
      <i className={cn('ti', on ? iconOn : iconOff, 'text-[14px]')} aria-hidden="true" />
      {on ? labelOn : labelOff}
    </button>
  );
}

export function WorkflowControls({
  documentId,
  markedForReview,
  awaitingInput,
  status,
}: {
  documentId: string;
  markedForReview: boolean;
  awaitingInput: boolean;
  status: 'open' | 'completed';
}) {
  const { pending, error, run } = useAction();
  const toggle = (
    action: (p: undefined, fd: FormData) => Promise<{ ok: boolean; error?: string }>,
    value: boolean,
  ) =>
    run(() => {
      const fd = new FormData();
      fd.set('id', documentId);
      fd.set('value', value ? 'true' : 'false');
      return fd;
    }, action);
  const setStatus = (next: 'open' | 'completed') =>
    run(() => {
      const fd = new FormData();
      fd.set('id', documentId);
      fd.set('status', next);
      return fd;
    }, setDocumentStatusAction);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <ToggleButton
          on={markedForReview}
          pending={pending}
          onClick={() => toggle(setDocumentReviewAction, !markedForReview)}
          iconOn="ti-eye-check"
          iconOff="ti-eye"
          labelOn="Complete review"
          labelOff="Mark for review"
          activeClass="bg-info-soft text-info border-info/30"
        />
        <ToggleButton
          on={awaitingInput}
          pending={pending}
          onClick={() => toggle(setDocumentAwaitingInputAction, !awaitingInput)}
          iconOn="ti-clock-pause"
          iconOff="ti-clock"
          labelOn="Clear awaiting input"
          labelOff="Awaited input"
          activeClass="bg-hold-soft text-hold border-hold/30"
        />
        <ToggleButton
          on={status === 'completed'}
          pending={pending}
          onClick={() => setStatus(status === 'completed' ? 'open' : 'completed')}
          iconOn="ti-rotate"
          iconOff="ti-circle-check"
          labelOn="Reopen"
          labelOff="Mark completed"
          activeClass="bg-success-soft text-success border-success/30"
        />
      </div>
      {error ? <p role="alert" className="mt-1 text-[11px] text-urgent">{error}</p> : null}
    </div>
  );
}

export function DeleteDocumentButton({
  documentId,
  canDelete,
}: {
  documentId: string;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canDelete) return null;

  const onDelete = () =>
    start(async () => {
      setError(null);
      const fd = new FormData();
      fd.set('id', documentId);
      const res = await deleteDocumentAction(undefined, fd);
      if (res.ok) router.push('/document-centre');
      else setError(res.error ?? 'Could not delete the record.');
    });

  return (
    <div>
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-ink-2">Delete this record permanently?</span>
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-urgent text-white text-[12px] font-medium disabled:opacity-60"
          >
            <i className="ti ti-trash text-[13px]" aria-hidden="true" />
            {pending ? 'Deleting…' : 'Delete'}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={pending}
            className="px-3 py-1.5 rounded-lg border border-line text-[12px] font-medium text-ink-2 hover:bg-line-2"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-[12px] font-medium text-ink-2 hover:border-urgent/40 hover:text-urgent transition-colors"
        >
          <i className="ti ti-trash text-[13px]" aria-hidden="true" />
          Delete record
        </button>
      )}
      {error ? <p role="alert" className="mt-1 text-[11px] text-urgent">{error}</p> : null}
    </div>
  );
}
