'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { Pill, Sheet } from '@/components/ui';
import { updateTimelineFileStatusAction } from '@/app/actions/timeline-files';
import { cn } from '@/lib/utils';

import type { PillStatusTone } from '@/components/ui/Pill';

const OPTIONS: { value: string; label: string; icon: string; tone: PillStatusTone }[] = [
  { value: 'pending_action', label: 'Pending action', icon: 'ti-circle-dashed', tone: 'pending_action' },
  { value: 'in_progress', label: 'In progress', icon: 'ti-progress', tone: 'in_progress' },
  { value: 'awaiting_reply', label: 'Awaiting reply', icon: 'ti-clock', tone: 'awaiting_reply' },
  { value: 'on_hold', label: 'On hold', icon: 'ti-player-pause', tone: 'on_hold' },
  { value: 'closed', label: 'Closed', icon: 'ti-circle-check', tone: 'closed' },
];

const LABEL: Record<string, string> = Object.fromEntries(OPTIONS.map((o) => [o.value, o.label]));

type TfStatusPickerProps = {
  tfId: string;
  current: string;
  canEdit: boolean;
};

export function TfStatusPicker({ tfId, current, canEdit }: TfStatusPickerProps) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState(current);
  const [state, formAction] = useFormState(updateTimelineFileStatusAction, {
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

  const tone = (OPTIONS.find((o) => o.value === current)?.tone ?? 'pending_action') as PillStatusTone;
  const label = LABEL[current] ?? current;

  if (!canEdit) {
    return <Pill variant="status" tone={tone} label={label} />;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Change status — currently ${label}`}
        className="inline-flex"
      >
        <Pill variant="status" tone={tone} label={label} />
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Update file status"
        subtitle="OSD and the marked-to division's Director can change this."
      >
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={tfId} />
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
      className="flex-1 py-2.5 rounded-lg bg-ink text-white text-[13px] font-medium disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Apply'}
    </button>
  );
}
