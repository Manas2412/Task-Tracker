'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormState, useFormStatus } from 'react-dom';

import { Sheet, UserPicker, type UserPickerOption } from '@/components/ui';
import { createTaskAction } from '@/app/actions/tasks';
import { INITIAL_CREATE_STATE, type CreateTaskState } from '@/app/actions/states';
import { cn } from '@/lib/utils';

export type CtfDivisionOption = {
  id: string;
  name: string;
  /** Office of JS tasks may be owned by any active user. */
  isOfficeOfJs: boolean;
};

export type CtfOwnerCandidate = {
  id: string;
  name: string;
  designation: string;
  divisionId: string;
  divisionName: string;
  divisionColour: string;
};

type CreateTaskFromTfDialogProps = {
  tfId: string;
  refNo: string;
  defaultDueDate: string | null; // ISO yyyy-mm-dd
  divisions: CtfDivisionOption[]; // marked-to divisions the caller may spawn into
  /** Active members of those divisions — the optional initial-owner pool. */
  ownerCandidates: CtfOwnerCandidate[];
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
  ownerCandidates,
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
  const [ownerId, setOwnerId] = useState('');

  useEffect(() => {
    if (open) {
      setPriority('medium');
      setDivisionId(divisions[0]?.id ?? '');
      setOwnerId('');
    }
  }, [open, divisions]);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setOwnerId('');
      setOpen(false);
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  const isCrossDivision = divisions.length > 1;
  const selectedDivision = divisions.find((d) => d.id === divisionId);

  // Owner pool for the picked division: its members, or any active user for an
  // Office-of-JS task. Marked-to targets are always top-level divisions (the
  // marked-to editor offers no PMUs), so a home-division match is exactly
  // createTaskAction's server-side membership check on this path.
  const ownerOptions: UserPickerOption[] = ownerCandidates
    .filter((c) => (selectedDivision?.isOfficeOfJs ? true : c.divisionId === divisionId))
    .map((c) => ({
      id: c.id,
      name: c.name,
      designation: c.designation,
      divisionName: c.divisionName,
      divisionColour: c.divisionColour,
    }));

  const onDivisionChange = (id: string) => {
    setDivisionId(id);
    setOwnerId(''); // the previous owner may not belong to the new division
  };

  // Surface any error the server returns. `name` and `ownerId` render inline;
  // anything else (a general error, or a field error like dueDate) must still
  // be shown so a failed submit is never silent.
  const generalError =
    state.error ??
    (state.fieldErrors
      ? Object.entries(state.fieldErrors).find(
          ([k]) => k !== 'name' && k !== 'ownerId',
        )?.[1]
      : undefined);

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
            <input type="hidden" name="visibility" value="division" />
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
                <PrefillRow label="Visibility" value="Division" />
              </dl>
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
                    onChange={(e) => onDivisionChange(e.target.value)}
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

            {/* Owner (optional) — a head may name the initial owner up front,
                otherwise the task starts unassigned for a member to claim. */}
            <div>
              <label htmlFor="ctf-owner" className="block text-[11px] font-medium text-ink-2 mb-1.5">
                Owner <span className="font-normal text-ink-3">· optional</span>
              </label>
              <UserPicker
                options={ownerOptions}
                value={ownerId}
                onChange={setOwnerId}
                name="ownerId"
                placeholder="Leave blank to start unassigned…"
              />
              <p className="text-[11px] text-ink-3 mt-1">
                Blank keeps it unassigned — any member of the division can claim it.
              </p>
              {state.fieldErrors?.ownerId ? (
                <p className="text-[11px] text-urgent mt-1">{state.fieldErrors.ownerId}</p>
              ) : null}
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

            {generalError ? (
              <p
                role="alert"
                className="text-[12px] text-urgent bg-urgent-soft border border-urgent/20 rounded-lg px-3 py-2"
              >
                {generalError}
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
