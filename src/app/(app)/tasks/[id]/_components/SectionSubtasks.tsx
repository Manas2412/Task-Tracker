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
   * ones already there. Always false on a subtask's own page (one level deep).
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
            className="text-[11px] font-medium text-primary inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-primary-soft transition-colors"
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

      <ul className="flex flex-col gap-0.5">
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

function SubtaskCheckbox({
  isDone,
  disabled,
  onToggle,
}: {
  isDone: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={isDone}
      aria-label={isDone ? 'Mark subtask not done' : 'Mark subtask done'}
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        // Button-like, high-contrast box that reads clearly on any surface
        // (token colours adapt to a dark panel). Smooth fill + a press bounce.
        'group/box relative grid place-items-center w-[24px] h-[24px] rounded-[8px] border-2 shrink-0',
        'transition-all duration-200 ease-out active:scale-90',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-panel focus-visible:ring-success/60',
        isDone
          ? 'bg-success border-success shadow'
          : 'bg-panel border-ink-4 shadow-sm hover:border-success hover:bg-success-soft',
      )}
    >
      <i
        className={cn(
          'ti ti-check text-[15px] leading-none transition-all duration-200 ease-out',
          isDone
            ? 'text-white scale-100 opacity-100'
            : // Previews a soft-green tick on hover — a friendly hint that a tap completes it.
              'text-success scale-50 opacity-0 group-hover/box:scale-100 group-hover/box:opacity-60',
        )}
        aria-hidden="true"
      />
    </button>
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
    <li>
      <div
        className={cn(
          'flex items-center gap-3 py-2 px-2 -mx-2 rounded-xl transition-colors',
          isDone ? 'hover:bg-line-2/50' : 'hover:bg-bg',
        )}
      >
        <SubtaskCheckbox isDone={isDone} disabled={pending} onToggle={toggle} />

        <Link
          href={`/tasks/${subtask.id}`}
          className={cn(
            'flex-1 text-[13.5px] leading-snug min-w-0 truncate transition-colors',
            isDone ? 'text-ink-3 line-through' : 'text-ink hover:text-primary',
          )}
        >
          {subtask.name}
        </Link>

        <div className="flex items-center gap-2.5 shrink-0">
          {due.tone !== 'none' ? (
            <span
              className={cn(
                'text-[11px] tabular-nums',
                isDone && 'text-ink-4 line-through',
                !isDone && due.tone === 'overdue' && 'text-urgent font-medium',
                !isDone && due.tone === 'today' && 'text-accent font-medium',
                !isDone && (due.tone === 'soon' || due.tone === 'future') && 'text-ink-3',
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
              className="w-6 h-6 grid place-items-center rounded-md text-ink-3 hover:text-ink hover:bg-line-2 transition-colors"
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

// ------------------------------------------------------------
// Deadline: a date calendar + an optional time dropdown, combined into the
// single `dueDate` field the server action already understands. Leaving the
// time blank is allowed (it defaults to end of day); leaving the date blank
// means no deadline.
// ------------------------------------------------------------

function toDateValue(d: Date | null): string {
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function toTimeValue(d: Date | null): string {
  if (!d) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Combine the date + optional time into a `datetime-local` string (or '' for none). */
function combineDueDate(date: string, time: string): string {
  if (!date) return '';
  return `${date}T${time || '23:59'}`;
}

/** Date-only max ('YYYY-MM-DD') — a subtask cannot be due after its parent. */
function parentDueMaxDate(parentDueDate: Date | null): string | undefined {
  return parentDueDate ? toDateValue(parentDueDate) : undefined;
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

const fieldCn =
  'w-full px-3 py-2 rounded-lg border border-line bg-panel text-[13px] text-ink outline-none focus:border-ink transition-colors';

function DeadlineFields({
  date,
  time,
  onDate,
  onTime,
  maxDate,
}: {
  date: string;
  time: string;
  onDate: (v: string) => void;
  onTime: (v: string) => void;
  maxDate?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-medium text-ink-3">Deadline date</span>
        <input
          type="date"
          value={date}
          max={maxDate}
          onChange={(e) => onDate(e.target.value)}
          className={fieldCn}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-medium text-ink-3">
          Time <span className="font-normal text-ink-4">· optional</span>
        </span>
        <input
          type="time"
          value={time}
          disabled={!date}
          onChange={(e) => onTime(e.target.value)}
          className={cn(fieldCn, 'disabled:opacity-50 disabled:cursor-not-allowed')}
        />
      </label>
    </div>
  );
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
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  useEffect(() => {
    if (state.ok) {
      ref.current?.reset();
      setAssigneeId('');
      setDate('');
      setTime('');
      onDone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  return (
    <form ref={ref} action={formAction} className="mt-3 flex flex-col gap-2.5">
      <input type="hidden" name="parentTaskId" value={taskId} />
      <input type="hidden" name="dueDate" value={combineDueDate(date, time)} />

      <input
        name="name"
        autoFocus
        required
        maxLength={200}
        placeholder="Subtask name…"
        className={fieldCn}
      />

      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-medium text-ink-3">Assign to</span>
        <UserPicker
          options={toPickerOptions(assignees)}
          value={assigneeId}
          onChange={setAssigneeId}
          placeholder="Search or leave blank for myself…"
          name="assigneeId"
        />
      </div>

      <DeadlineFields
        date={date}
        time={time}
        onDate={setDate}
        onTime={setTime}
        maxDate={parentDueMaxDate(parentDueDate)}
      />

      {state.fieldErrors?.name ? (
        <p className="text-[11px] text-urgent">{state.fieldErrors.name}</p>
      ) : null}
      {state.fieldErrors?.dueDate ? (
        <p className="text-[11px] text-urgent">{state.fieldErrors.dueDate}</p>
      ) : null}

      <div className="flex gap-2 justify-end pt-0.5">
        <button
          type="button"
          onClick={onDone}
          className="px-3 py-1.5 rounded-md border border-line text-[12px] font-medium text-ink-2 hover:bg-line-2 transition-colors"
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
      className="px-3 py-1.5 rounded-md bg-ink text-white text-[12px] font-medium hover:bg-ink-2 disabled:opacity-60 transition-colors"
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
  const [date, setDate] = useState(toDateValue(subtask.dueDate));
  const [time, setTime] = useState(toTimeValue(subtask.dueDate));

  useEffect(() => {
    if (state.ok) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  return (
    <form ref={ref} action={formAction} className="pb-3 flex flex-col gap-2.5 pl-[36px]">
      <input type="hidden" name="subtaskId" value={subtask.id} />
      <input type="hidden" name="dueDate" value={combineDueDate(date, time)} />

      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-medium text-ink-3">Assigned to</span>
        <UserPicker
          options={toPickerOptions(assignees)}
          value={assigneeId}
          onChange={setAssigneeId}
          placeholder="Search by name…"
          name="assigneeId"
        />
      </div>

      <DeadlineFields
        date={date}
        time={time}
        onDate={setDate}
        onTime={setTime}
        maxDate={parentDueMaxDate(parentDueDate)}
      />

      {state.fieldErrors?.dueDate ? (
        <p className="text-[11px] text-urgent">{state.fieldErrors.dueDate}</p>
      ) : null}
      {state.error ? <p className="text-[11px] text-urgent">{state.error}</p> : null}

      <div className="flex gap-2 justify-end pt-0.5">
        <button
          type="button"
          onClick={onDone}
          className="px-3 py-1.5 rounded-md border border-line text-[12px] font-medium text-ink-2 hover:bg-line-2 transition-colors"
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
      className="px-3 py-1.5 rounded-md bg-ink text-white text-[12px] font-medium hover:bg-ink-2 disabled:opacity-60 transition-colors"
    >
      {pending ? 'Saving…' : 'Save'}
    </button>
  );
}
