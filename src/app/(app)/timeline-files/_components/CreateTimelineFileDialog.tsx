'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { Sheet } from '@/components/ui';
import { createTimelineFileAction } from '@/app/actions/timeline-files';
import { INITIAL_TF_STATE, type TimelineFileState } from '@/app/actions/states';
import { cn } from '@/lib/utils';

export type DivisionOption = {
  id: string;
  name: string;
  avatarColour: string;
};

type CreateTimelineFileDialogProps = {
  divisions: DivisionOption[];
  defaultReceivedDate: string;
};

export function CreateTimelineFileDialog({
  divisions,
  defaultReceivedDate,
}: CreateTimelineFileDialogProps) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useFormState<TimelineFileState, FormData>(
    createTimelineFileAction,
    INITIAL_TF_STATE,
  );
  const [markedTo, setMarkedTo] = useState<string[]>([]);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setMarkedTo([]);
      setOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  const toggleDivision = (id: string) => {
    setMarkedTo((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-ink text-white text-[13px] font-medium hover:bg-ink-2 transition-colors"
      >
        <i className="ti ti-file-plus text-[14px]" aria-hidden="true" />
        New timeline file
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="New timeline file"
        subtitle="Reference number is generated as TF-YYYY/NNN automatically."
      >
        {open ? (
          <form ref={formRef} action={formAction} className="flex flex-col gap-3.5">
            <Field label="Subject" error={state.fieldErrors?.subject}>
              <input
                name="subject"
                required
                autoFocus
                maxLength={200}
                placeholder="e.g. Cabinet brief request — Khelo India Mission"
                className={inputCn(!!state.fieldErrors?.subject)}
              />
            </Field>

            <Field label="From" error={state.fieldErrors?.fromWhom}>
              <input
                name="fromWhom"
                required
                maxLength={120}
                placeholder="e.g. Prime Minister's Office"
                className={inputCn(!!state.fieldErrors?.fromWhom)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Received" error={state.fieldErrors?.receivedDate}>
                <input
                  name="receivedDate"
                  type="date"
                  required
                  defaultValue={defaultReceivedDate}
                  className={inputCn(!!state.fieldErrors?.receivedDate)}
                />
              </Field>

              <Field
                label="Deadline"
                hint="Optional. Countdown shows everywhere this file appears."
                error={state.fieldErrors?.deadlineDate}
              >
                <input
                  name="deadlineDate"
                  type="date"
                  className={inputCn(!!state.fieldErrors?.deadlineDate)}
                />
              </Field>
            </div>

            <Field
              label="Mark to divisions"
              hint="Pick one or more. Only marked divisions can see this file."
              error={state.fieldErrors?.markedTo}
            >
              <input type="hidden" name="markedTo" value={markedTo.join(',')} />
              {divisions.length === 0 ? (
                <p className="text-[12px] text-ink-3 italic px-2 py-3 rounded-lg border border-dashed border-line text-center">
                  No divisions yet. Create some from Super Admin → Structure & hierarchy.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {divisions.map((d) => {
                    const active = markedTo.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => toggleDivision(d.id)}
                        aria-pressed={active}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-pill text-[11px] font-medium border transition-colors',
                          active
                            ? 'bg-primary text-white border-primary'
                            : 'bg-panel text-ink-2 border-line hover:border-ink-4',
                        )}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{
                            backgroundColor: active ? 'rgba(255,255,255,0.8)' : d.avatarColour,
                          }}
                          aria-hidden="true"
                        />
                        {d.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </Field>

            <Field
              label="Secretary's comments"
              hint="Optional. Renders as a formal quote on the file detail screen."
            >
              <textarea
                name="secretaryComments"
                rows={4}
                maxLength={4000}
                placeholder="Direction from the Secretary, Sports…"
                className={cn(inputCn(false), 'resize-none')}
              />
            </Field>

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
              <SaveButton disabled={markedTo.length === 0} />
            </div>
          </form>
        ) : null}
      </Sheet>
    </>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-ink-2">{label}</span>
      {children}
      {error ? (
        <span className="text-[11px] text-urgent">{error}</span>
      ) : hint ? (
        <span className="text-[11px] text-ink-3">{hint}</span>
      ) : null}
    </label>
  );
}

function inputCn(hasError: boolean) {
  return cn(
    'w-full px-3 py-2 rounded-lg border bg-panel text-[13px] text-ink outline-none transition-colors',
    hasError ? 'border-urgent focus:border-urgent' : 'border-line focus:border-ink',
  );
}

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="flex-1 py-2.5 rounded-lg bg-ink text-white text-[13px] font-medium disabled:opacity-60"
    >
      {pending ? 'Creating…' : 'Create file'}
    </button>
  );
}
