'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { Pill, Sheet } from '@/components/ui';
import { updateTaskStatusAction } from '@/app/actions/tasks';
import {
  INITIAL_STATUS_STATE,
  type UpdateStatusState,
} from '@/app/actions/states';
import { cn } from '@/lib/utils';

import type { PillStatusTone } from '@/components/ui/Pill';

const OPTIONS: { value: PillStatusTone; label: string; icon: string }[] = [
  { value: 'not_started', label: 'Not started', icon: 'ti-circle-dashed' },
  { value: 'in_progress', label: 'In progress', icon: 'ti-progress' },
  { value: 'awaiting_input', label: 'Awaiting input', icon: 'ti-clock' },
  { value: 'on_hold', label: 'On hold', icon: 'ti-player-pause' },
  { value: 'completed', label: 'Completed', icon: 'ti-circle-check' },
];

const LABEL: Record<string, string> = Object.fromEntries(OPTIONS.map((o) => [o.value, o.label]));

type StatusPickerProps = {
  taskId: string;
  current: PillStatusTone;
};

/**
 * Clickable status pill. Opens a sheet listing every status option plus an
 * optional "Add a note" textarea — when the note is provided, a comment is
 * created with the inline status-update card pattern (Design Tokens §6.5).
 */
export function StatusPicker({ taskId, current }: StatusPickerProps) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<PillStatusTone>(current);
  const [state, formAction] = useFormState<UpdateStatusState, FormData>(
    updateTaskStatusAction,
    INITIAL_STATUS_STATE,
  );

  // Close on success.
  useEffect(() => {
    if (state.ok) setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  // Reset chosen to current whenever opening
  useEffect(() => {
    if (open) setChosen(current);
  }, [open, current]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Change status — currently ${LABEL[current]}`}
        className="inline-flex"
      >
        <Pill variant="status" tone={current} label={LABEL[current] ?? current} />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Update status">
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="taskId" value={taskId} />
          <input type="hidden" name="status" value={chosen} />

          <div role="radiogroup" aria-label="Status" className="flex flex-col gap-1">
            {OPTIONS.map((o) => {
              const active = chosen === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setChosen(o.value)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left',
                    active ? 'bg-primary-soft' : 'hover:bg-bg',
                  )}
                >
                  <span
                    className={cn(
                      'w-8 h-8 grid place-items-center rounded-lg',
                      active ? 'bg-panel' : 'bg-line-2',
                    )}
                  >
                    <i className={cn('ti', o.icon, 'text-[16px] text-ink-2')} aria-hidden="true" />
                  </span>
                  <span className="flex-1 text-[14px] font-medium text-ink">{o.label}</span>
                  {active ? (
                    <span className="w-5 h-5 grid place-items-center rounded-full bg-ink text-white">
                      <i className="ti ti-check text-[12px]" aria-hidden="true" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="pt-2">
            <label
              htmlFor="status-note"
              className="block text-[11px] font-medium text-ink-2 mb-1.5"
            >
              Add a note (optional)
            </label>
            <textarea
              id="status-note"
              name="note"
              rows={2}
              placeholder="Why the change? Use @ to mention someone."
              className="w-full px-3 py-2 rounded-lg border border-line bg-panel text-[13px] outline-none focus:border-ink resize-none"
              maxLength={2000}
            />
          </div>

          {state.error ? (
            <p
              role="alert"
              className="text-[12px] text-urgent bg-urgent-soft border border-urgent/20 rounded-lg px-3 py-2"
            >
              {state.error}
            </p>
          ) : null}

          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 py-3 rounded-lg border border-line text-[14px] font-medium text-ink-2 hover:bg-line-2"
            >
              Cancel
            </button>
            <ApplyButton />
          </div>
        </form>
      </Sheet>
    </>
  );
}

function ApplyButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 py-3 rounded-lg bg-ink text-white text-[14px] font-medium disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Apply'}
    </button>
  );
}
