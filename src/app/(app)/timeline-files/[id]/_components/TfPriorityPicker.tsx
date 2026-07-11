'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { Pill, Sheet } from '@/components/ui';
import { updateTimelineFilePriorityAction } from '@/app/actions/timeline-files';
import { cn } from '@/lib/utils';

import type { PillPriorityTone } from '@/components/ui/Pill';

const OPTIONS: { value: PillPriorityTone; label: string; dot: string; tone: string }[] = [
  { value: 'low', label: 'Low', dot: 'bg-low', tone: 'text-low' },
  { value: 'medium', label: 'Medium', dot: 'bg-medium', tone: 'text-medium' },
  { value: 'high', label: 'High', dot: 'bg-high', tone: 'text-high' },
  { value: 'urgent', label: 'Urgent', dot: 'bg-urgent', tone: 'text-urgent' },
];

const LABEL: Record<string, string> = Object.fromEntries(OPTIONS.map((o) => [o.value, o.label]));

type TfPriorityPickerProps = {
  tfId: string;
  current: string;
  canEdit: boolean;
};

/**
 * Timeline file priority — same picker pattern and priority Pill as tasks,
 * so the tag reads identically across the platform. Editable by OSD /
 * Super Admin and the marked-to division's Director (same gate as status).
 */
export function TfPriorityPicker({ tfId, current, canEdit }: TfPriorityPickerProps) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState(current);
  const [state, formAction] = useFormState(updateTimelineFilePriorityAction, {
    ok: false,
    epoch: 0,
  });

  useEffect(() => {
    if (state.ok) setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  useEffect(() => {
    if (open) setChosen(current);
  }, [open, current]);

  const tone = (current as PillPriorityTone) ?? 'medium';
  const label = LABEL[current] ?? current;

  if (!canEdit) {
    return <Pill variant="priority" tone={tone} label={label} />;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Change priority — currently ${label}`}
        className="inline-flex"
      >
        <Pill variant="priority" tone={tone} label={label} />
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Set priority"
        subtitle="OSD and the marked-to division's Director can change this."
      >
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={tfId} />
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
            <SaveButton />
          </div>
        </form>
      </Sheet>
    </>
  );
}

function SaveButton() {
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
