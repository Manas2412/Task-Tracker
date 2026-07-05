'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormState, useFormStatus } from 'react-dom';

import { Sheet, Switch } from '@/components/ui';
import { createTaskAction } from '@/app/actions/tasks';
import { INITIAL_CREATE_STATE, type CreateTaskState } from '@/app/actions/states';
import { cn } from '@/lib/utils';

type DivisionOption = {
  id: string;
  name: string;
};

type CreateTaskFromTfDialogProps = {
  tfId: string;
  refNo: string;
  defaultDueDate: string | null; // ISO yyyy-mm-dd
  divisions: DivisionOption[]; // marked-to divisions
  /** OSD / Super Admin — may create division-visible tasks anywhere. */
  isOsdOrSa: boolean;
  /** Divisions the user heads (direct + active delegation). */
  divisionsHeaded: string[];
};

const PRIORITIES = [
  { value: 'low', label: 'Low', tone: 'text-low' },
  { value: 'medium', label: 'Medium', tone: 'text-medium' },
  { value: 'high', label: 'High', tone: 'text-high' },
  { value: 'urgent', label: 'Urgent', tone: 'text-urgent' },
] as const;

export function CreateTaskFromTfDialog({
  tfId,
  refNo,
  defaultDueDate,
  divisions,
  isOsdOrSa,
  divisionsHeaded,
}: CreateTaskFromTfDialogProps) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const [state, formAction] = useFormState<CreateTaskState, FormData>(
    createTaskAction,
    INITIAL_CREATE_STATE,
  );
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [divisionId, setDivisionId] = useState(divisions[0]?.id ?? '');

  useEffect(() => {
    if (open) {
      setPriority('medium');
      setDivisionId(divisions[0]?.id ?? '');
    }
  }, [open, divisions]);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setOpen(false);
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  const isCrossDivision = divisions.length > 1;
  // Division visibility is a head power. If the user doesn't head the
  // selected division (and isn't OSD/SA), the task is created personal —
  // reflect that truthfully rather than claiming Division.
  const canDivision = isOsdOrSa || divisionsHeaded.includes(divisionId);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 mt-3 rounded-lg bg-ink text-white text-[13px] font-medium hover:bg-ink-2 transition-colors"
      >
        <i className="ti ti-plus text-[14px]" aria-hidden="true" />
        Create task from this file
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Create task from this file"
        subtitle="Deadline, division, and back-reference are pre-filled."
      >
        {open ? (
          <form ref={formRef} action={formAction} className="flex flex-col gap-3">
            <input type="hidden" name="linkedTimelineFileId" value={tfId} />
            <input type="hidden" name="priority" value={priority} />
            <input type="hidden" name="visibility" value={canDivision ? 'division' : 'personal'} />
            <input type="hidden" name="divisionId" value={divisionId} />

            {/* Task name */}
            <div>
              <label htmlFor="ctf-name" className="sr-only">
                Task name
              </label>
              <input
                id="ctf-name"
                name="name"
                type="text"
                autoFocus
                required
                maxLength={200}
                placeholder="Task name…"
                className={cn(
                  'w-full px-3.5 py-3.5 rounded-lg border bg-panel text-[16px] font-medium text-ink outline-none placeholder:text-ink-3 placeholder:font-normal',
                  state.fieldErrors?.name
                    ? 'border-urgent focus:border-urgent'
                    : 'border-line focus:border-ink',
                )}
              />
              {state.fieldErrors?.name ? (
                <p className="text-[11px] text-urgent mt-1">{state.fieldErrors.name}</p>
              ) : null}
            </div>

            {/* Pre-fill panel */}
            <div className="bg-primary-soft border-l-[3px] border-primary rounded-r-lg p-3">
              <p className="text-[10px] uppercase tracking-[0.08em] font-medium text-primary mb-1.5">
                Pre-filled from {refNo}
              </p>
              <dl className="flex flex-col gap-1">
                <PrefillRow label="Linked file" value={refNo} mono />
                <PrefillRow
                  label="Due date"
                  value={
                    defaultDueDate ? formatHuman(defaultDueDate) : 'No deadline on this file'
                  }
                />
                <PrefillRow
                  label="Division"
                  value={
                    isCrossDivision
                      ? `${divisions.find((d) => d.id === divisionId)?.name ?? 'Pick below'} (of ${divisions.length})`
                      : (divisions[0]?.name ?? '—')
                  }
                />
                <PrefillRow
                  label="Visibility"
                  value={canDivision ? 'Division' : 'Personal'}
                />
              </dl>
              {!canDivision ? (
                <p className="mt-2 text-[10px] text-ink-2 leading-relaxed">
                  Only the division head can make this visible to the division —
                  it will be created as your personal task.
                </p>
              ) : null}
            </div>

            {/* Optional editable fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="ctf-due"
                  className="block text-[11px] font-medium text-ink-2 mb-1.5"
                >
                  Due date
                </label>
                <input
                  id="ctf-due"
                  name="dueDate"
                  type="date"
                  defaultValue={defaultDueDate ?? undefined}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-panel text-[13px] outline-none focus:border-ink"
                />
              </div>

              {isCrossDivision ? (
                <div>
                  <label
                    htmlFor="ctf-div"
                    className="block text-[11px] font-medium text-ink-2 mb-1.5"
                  >
                    Primary division
                  </label>
                  <select
                    id="ctf-div"
                    value={divisionId}
                    onChange={(e) => setDivisionId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-line bg-panel text-[13px] outline-none focus:border-ink appearance-none"
                  >
                    {divisions.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div />
              )}
            </div>

            {/* Priority */}
            <div>
              <span className="block text-[11px] font-medium text-ink-2 mb-1.5">Priority</span>
              <div
                role="radiogroup"
                aria-label="Priority"
                className="grid grid-cols-4 gap-1 p-[3px] bg-line-2 rounded-[10px]"
              >
                {PRIORITIES.map((p) => {
                  const isActive = priority === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      onClick={() => setPriority(p.value)}
                      className={cn(
                        'py-2 text-[11px] font-medium rounded-md transition-colors',
                        isActive ? cn('bg-panel shadow-sm', p.tone) : 'text-ink-2 hover:text-ink',
                      )}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Milestone */}
            <label className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-line">
              <span className="text-[12px] text-ink inline-flex items-center gap-2">
                <i
                  className="ti ti-flag-3 text-[14px] text-accent"
                  aria-hidden="true"
                />
                Mark as milestone
              </span>
              <Switch name="milestone" ariaLabel="Mark as milestone" />
            </label>

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
              <CreateButton />
            </div>
          </form>
        ) : null}
      </Sheet>
    </>
  );
}

function PrefillRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2 text-[12px]">
      <dt className="text-ink-3 w-[80px] shrink-0">{label}</dt>
      <dd className={cn('font-medium text-ink', mono && 'font-mono')}>{value}</dd>
    </div>
  );
}

function CreateButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 py-2.5 rounded-lg bg-ink text-white text-[13px] font-medium disabled:opacity-60"
    >
      {pending ? 'Creating…' : 'Create task'}
    </button>
  );
}

function formatHuman(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
