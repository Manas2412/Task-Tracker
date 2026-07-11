'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { Sheet } from '@/components/ui';
import { updateTaskFieldsAction } from '@/app/actions/tasks';
import {
  INITIAL_FIELDS_STATE,
  type UpdateFieldsState,
} from '@/app/actions/states';
import { RECURRENCE_LABEL } from '@/lib/labels';
import { cn } from '@/lib/utils';

const OPTIONS = [
  { value: '', label: 'One-time', sub: 'No recurrence' },
  { value: 'daily', label: 'Daily', sub: 'Every day' },
  { value: 'weekly', label: 'Weekly', sub: 'Every 7 days' },
  { value: 'monthly', label: 'Monthly', sub: 'Same day each month' },
  { value: 'quarterly', label: 'Quarterly', sub: 'Every 3 months' },
  { value: 'half_yearly', label: 'Half-yearly', sub: 'Every 6 months' },
] as const;

type RecurrencePickerProps = {
  taskId: string;
  current: string | null;
  trigger: React.ReactNode;
};

/**
 * Opens a sheet from any trigger. Used inside the Recurrence row in
 * SectionDetails — the row's right-hand value renders the human label
 * and a chevron, click anywhere on the row.
 */
export function RecurrencePicker({ taskId, current, trigger }: RecurrencePickerProps) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string>(current ?? '');
  const [state, formAction] = useFormState<UpdateFieldsState, FormData>(
    updateTaskFieldsAction,
    INITIAL_FIELDS_STATE,
  );

  useEffect(() => {
    if (state.ok) setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  useEffect(() => {
    if (open) setChosen(current ?? '');
  }, [open, current]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="contents"
        aria-label="Change recurrence"
      >
        {trigger}
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Set recurrence"
        subtitle="A new task spawns automatically every interval, copying the title and division."
      >
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="taskId" value={taskId} />
          <input type="hidden" name="recurrenceRule" value={chosen} />

          <div role="radiogroup" aria-label="Recurrence" className="flex flex-col gap-1">
            {OPTIONS.map((o) => {
              const active = chosen === o.value;
              const isNone = o.value === '';
              return (
                <button
                  key={o.value || 'none'}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setChosen(o.value)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                    active ? 'bg-primary-soft' : 'hover:bg-bg',
                  )}
                >
                  <span
                    className={cn(
                      'w-8 h-8 grid place-items-center rounded-lg',
                      active ? 'bg-panel' : 'bg-line-2',
                    )}
                  >
                    <i
                      className={cn(
                        'ti text-[15px] text-ink-2',
                        isNone ? 'ti-circle-x' : 'ti-repeat',
                      )}
                      aria-hidden="true"
                    />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-medium text-ink">{o.label}</span>
                    <span className="block text-[10px] text-ink-3 mt-0.5">{o.sub}</span>
                  </span>
                  {active ? (
                    <span className="w-5 h-5 grid place-items-center rounded-full bg-ink text-onink">
                      <i className="ti ti-check text-[12px]" aria-hidden="true" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {state.error ? (
            <p
              role="alert"
              className="text-[12px] text-urgent bg-urgent-soft border border-urgent/20 rounded-lg px-3 py-2"
            >
              {state.error}
            </p>
          ) : null}

          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 py-2.5 rounded-lg border border-line text-[13px] font-medium text-ink-2 hover:bg-line-2"
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
      className="flex-1 py-2.5 rounded-lg bg-ink text-onink text-[13px] font-medium disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Apply'}
    </button>
  );
}

export function humanRecurrence(rule: string | null | undefined): string {
  if (!rule) return 'One-time';
  return RECURRENCE_LABEL[rule] ?? rule;
}
