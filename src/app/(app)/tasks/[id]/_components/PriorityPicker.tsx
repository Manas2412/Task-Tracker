'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { Pill, Sheet } from '@/components/ui';
import { updateTaskPriorityAction } from '@/app/actions/tasks';
import {
  INITIAL_PRIORITY_STATE,
  type UpdatePriorityState,
} from '@/app/actions/states';
import { cn } from '@/lib/utils';

import type { PillPriorityTone } from '@/components/ui/Pill';

const OPTIONS: { value: PillPriorityTone; label: string; tone: string; dot: string }[] = [
  { value: 'low', label: 'Low', tone: 'text-low', dot: 'bg-low' },
  { value: 'medium', label: 'Medium', tone: 'text-medium', dot: 'bg-medium' },
  { value: 'high', label: 'High', tone: 'text-high', dot: 'bg-high' },
  { value: 'urgent', label: 'Urgent', tone: 'text-urgent', dot: 'bg-urgent' },
];
const LABEL: Record<string, string> = Object.fromEntries(OPTIONS.map((o) => [o.value, o.label]));

type PriorityPickerProps = {
  taskId: string;
  current: PillPriorityTone;
  canEdit: boolean;
};

export function PriorityPicker({ taskId, current, canEdit }: PriorityPickerProps) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<PillPriorityTone>(current);
  const [state, formAction] = useFormState<UpdatePriorityState, FormData>(
    updateTaskPriorityAction,
    INITIAL_PRIORITY_STATE,
  );

  useEffect(() => {
    if (state.ok) setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  useEffect(() => {
    if (open) setChosen(current);
  }, [open, current]);

  if (!canEdit) {
    return <Pill variant="priority" tone={current} label={LABEL[current] ?? current} />;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Change priority — currently ${LABEL[current]}`}
        className="inline-flex"
      >
        <Pill variant="priority" tone={current} label={LABEL[current] ?? current} />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Set priority">
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="taskId" value={taskId} />
          <input type="hidden" name="priority" value={chosen} />

          <div role="radiogroup" aria-label="Priority" className="flex flex-col gap-1">
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
                  <span className={cn('w-2.5 h-2.5 rounded-full', o.dot)} aria-hidden="true" />
                  <span className={cn('flex-1 text-[14px] font-medium', active ? o.tone : 'text-ink')}>
                    {o.label}
                  </span>
                  {active ? (
                    <span className="w-5 h-5 grid place-items-center rounded-full bg-ink text-white">
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
