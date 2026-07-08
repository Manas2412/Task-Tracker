'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';

import { Avatar, UserPicker, type UserPickerOption } from '@/components/ui';
import { addSubtaskAction, toggleSubtaskAction, updateSubtaskAction } from '@/app/actions/tasks';
import { initialsOf, formatDue } from '@/lib/format';
import { cn } from '@/lib/utils';

type Subtask = {
  id: string;
  name: string;
  status: string;
  dueDate: Date | null;
  owner: { id: string; name: string; division: { avatarColour: string } };
};

type AssigneeOption = {
  id: string;
  name: string;
  designation: string;
  divisionName?: string;
  divisionColour: string;
};

type SectionSubtasksProps = {
  taskId: string;
  subtasks: Subtask[];
  /** Manage existing subtasks — reassign, change deadline, toggle done. */
  canEdit: boolean;
  /**
   * Add new subtasks. Defaults to `canEdit`; passed separately so
   * collaborators can create subtasks without gaining edit rights over the
   * ones already there.
   */
  canAdd?: boolean;
  assignees: AssigneeOption[];
  parentDueDate: Date | null;
};

export function SectionSubtasks({
  taskId,
  subtasks,
  canEdit,
  canAdd = canEdit,
  assignees,
  parentDueDate,
}: SectionSubtasksProps) {
  const [showAdd, setShowAdd] = useState(false);
  const total = subtasks.length;
  const done = subtasks.filter((s) => s.status === 'completed').length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <section aria-labelledby="sec-subtasks" className="px-4 md:px-6 py-5 border-b border-line-2">
      <div className="flex items-center justify-between mb-3">
        <h2 id="sec-subtasks" className="section-label">
          Subtasks{' '}
          {total > 0 ? (
            <span className="ml-2 text-ink-3 text-[11px] tracking-normal normal-case font-normal">
              {done} of {total} done
            </span>
          ) : null}
        </h2>
        {canAdd && !showAdd ? (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="text-[11px] font-medium text-primary inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-primary-soft"
          >
            <i className="ti ti-plus text-[13px]" aria-hidden="true" />
            Add
          </button>
        ) : null}
      </div>

      {total > 0 ? (
        <div
          className="h-1 bg-line-2 rounded-full overflow-hidden mb-3"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Subtask completion"
        >
          <div
            className="h-full bg-ink transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}

      <ul className="flex flex-col">
        {subtasks.map((s) => (
          <SubtaskRow
            key={s.id}
            subtask={s}
            canEdit={canEdit}
            assignees={assignees}
            parentDueDate={parentDueDate}
          />
        ))}
      </ul>

      {showAdd ? (
        <AddSubtaskForm
          taskId={taskId}
          assignees={assignees}
          parentDueDate={parentDueDate}
          onDone={() => setShowAdd(false)}
        />
      ) : total === 0 ? (
        <p className="text-[13px] text-ink-3 italic">No subtasks yet.</p>
      ) : null}
    </section>
  );
}

function SubtaskRow({
  subtask,
  canEdit,
  assignees,
  parentDueDate,
}: {
  subtask: Subtask;
  canEdit: boolean;
  assignees: AssigneeOption[];
  parentDueDate: Date | null;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const isDone = subtask.status === 'completed';
  const due = formatDue(subtask.dueDate);

  const toggle = () => {
    const fd = new FormData();
    fd.set('subtaskId', subtask.id);
    startTransition(async () => {
      await toggleSubtaskAction(undefined, fd);
    });
  };

  return (
    <li className="border-b border-line-2 last:border-b-0">
      <div className="flex items-center gap-2.5 py-2.5">
        <button
          type="button"
          role="checkbox"
          aria-checked={isDone}
          aria-label={isDone ? 'Mark subtask not done' : 'Mark subtask done'}
          onClick={toggle}
          disabled={pending}
          className={cn(
            'w-[22px] h-[22px] grid place-items-center rounded-md border-2 shrink-0 transition-all active:scale-90 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-success',
            // The check is always rendered but transparent when open, so an
            // incomplete box previews a soft-green tick on hover — a clear,
            // friendly hint that a tap completes the subtask.
            isDone
              ? 'bg-success border-success text-white shadow-sm'
              : 'border-ink-4 bg-panel text-transparent hover:border-success hover:bg-success-soft hover:text-success',
          )}
        >
          <i className="ti ti-check text-[14px]" aria-hidden="true" />
        </button>

        <Link
          href={`/tasks/${subtask.id}`}
          className={cn(
            'flex-1 text-[13px] leading-snug min-w-0 truncate',
            isDone ? 'text-ink-3 line-through' : 'text-ink hover:underline',
          )}
        >
          {subtask.name}
        </Link>

        <div className="flex items-center gap-2 shrink-0">
          {due.tone !== 'none' ? (
            <span
              className={cn(
                'text-[11px]',
                due.tone === 'overdue' && 'text-urgent font-medium',
                due.tone === 'today' && 'text-accent font-medium',
                (due.tone === 'soon' || due.tone === 'future') && 'text-ink-3',
              )}
            >
              {due.label}
            </span>
          ) : null}
          <Avatar
            initials={initialsOf(subtask.owner.name)}
            colour={subtask.owner.division.avatarColour}
            size="xs"
            ariaLabel={`Assigned to ${subtask.owner.name}`}
          />
          {canEdit ? (
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="text-[11px] text-ink-3 hover:text-ink px-1"
              aria-label="Edit subtask"
            >
              <i className="ti ti-pencil text-[13px]" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      {editing ? (
        <EditSubtaskForm
          subtask={subtask}
          assignees={assignees}
          parentDueDate={parentDueDate}
          onDone={() => setEditing(false)}
        />
      ) : null}
    </li>
  );
}

function toDatetimeLocalValue(d: Date | null): string {
  if (!d) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parentDueDateMax(parentDueDate: Date | null): string | undefined {
  if (!parentDueDate) return undefined;
  const end = new Date(parentDueDate);
  end.setHours(23, 59);
  return toDatetimeLocalValue(end);
}

function toPickerOptions(assignees: AssigneeOption[]): UserPickerOption[] {
  return assignees.map((u) => ({
    id: u.id,
    name: u.name,
    designation: u.designation,
    divisionName: u.divisionName,
    divisionColour: u.divisionColour,
  }));
}

function AddSubtaskForm({
  taskId,
  assignees,
  parentDueDate,
  onDone,
}: {
  taskId: string;
  assignees: AssigneeOption[];
  parentDueDate: Date | null;
  onDone: () => void;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, formAction] = useFormState(addSubtaskAction, { ok: false, epoch: 0 });
  const [assigneeId, setAssigneeId] = useState('');

  useEffect(() => {
    if (state.ok) {
      ref.current?.reset();
      setAssigneeId('');
      onDone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  const maxDue = parentDueDateMax(parentDueDate);

  return (
    <form ref={ref} action={formAction} className="mt-3 flex flex-col gap-2">
      <input type="hidden" name="parentTaskId" value={taskId} />

      <input
        name="name"
        autoFocus
        required
        maxLength={200}
        placeholder="Subtask name…"
        className="w-full px-3 py-2 rounded-lg border border-line bg-panel text-[13px] outline-none focus:border-ink"
      />

      <div className="flex gap-2">
        <div className="flex-1 flex flex-col gap-1">
          <span className="text-[10px] font-medium text-ink-3">Assign to</span>
          <UserPicker
            options={toPickerOptions(assignees)}
            value={assigneeId}
            onChange={setAssigneeId}
            placeholder="Search or leave blank for myself…"
            name="assigneeId"
          />
        </div>

        <label className="flex-1 flex flex-col gap-1">
          <span className="text-[10px] font-medium text-ink-3">Deadline</span>
          <input
            name="dueDate"
            type="datetime-local"
            max={maxDue}
            className="w-full px-2 py-2 rounded-lg border border-line bg-panel text-[12px] outline-none focus:border-ink"
          />
        </label>
      </div>

      {state.fieldErrors?.name ? (
        <p className="text-[11px] text-urgent">{state.fieldErrors.name}</p>
      ) : null}
      {state.fieldErrors?.dueDate ? (
        <p className="text-[11px] text-urgent">{state.fieldErrors.dueDate}</p>
      ) : null}

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onDone}
          className="px-3 py-1.5 rounded-md border border-line text-[12px] font-medium text-ink-2 hover:bg-line-2"
        >
          Cancel
        </button>
        <AddButton />
      </div>
    </form>
  );
}

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-3 py-1.5 rounded-md bg-ink text-white text-[12px] font-medium disabled:opacity-60"
    >
      {pending ? 'Adding…' : 'Add'}
    </button>
  );
}

function EditSubtaskForm({
  subtask,
  assignees,
  parentDueDate,
  onDone,
}: {
  subtask: Subtask;
  assignees: AssigneeOption[];
  parentDueDate: Date | null;
  onDone: () => void;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, formAction] = useFormState(updateSubtaskAction, { ok: false, epoch: 0 });
  const [assigneeId, setAssigneeId] = useState(subtask.owner.id);

  useEffect(() => {
    if (state.ok) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  const maxDue = parentDueDateMax(parentDueDate);

  return (
    <form ref={ref} action={formAction} className="pb-3 flex flex-col gap-2 pl-[30px]">
      <input type="hidden" name="subtaskId" value={subtask.id} />

      <div className="flex gap-2">
        <div className="flex-1 flex flex-col gap-1">
          <span className="text-[10px] font-medium text-ink-3">Assigned to</span>
          <UserPicker
            options={toPickerOptions(assignees)}
            value={assigneeId}
            onChange={setAssigneeId}
            placeholder="Search by name…"
            name="assigneeId"
          />
        </div>

        <label className="flex-1 flex flex-col gap-1">
          <span className="text-[10px] font-medium text-ink-3">Deadline</span>
          <input
            name="dueDate"
            type="datetime-local"
            defaultValue={toDatetimeLocalValue(subtask.dueDate)}
            max={maxDue}
            className="w-full px-2 py-2 rounded-lg border border-line bg-panel text-[12px] outline-none focus:border-ink"
          />
        </label>
      </div>

      {state.fieldErrors?.dueDate ? (
        <p className="text-[11px] text-urgent">{state.fieldErrors.dueDate}</p>
      ) : null}
      {state.error ? (
        <p className="text-[11px] text-urgent">{state.error}</p>
      ) : null}

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onDone}
          className="px-3 py-1.5 rounded-md border border-line text-[12px] font-medium text-ink-2 hover:bg-line-2"
        >
          Cancel
        </button>
        <SaveButton />
      </div>
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-3 py-1.5 rounded-md bg-ink text-white text-[12px] font-medium disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Save'}
    </button>
  );
}
