'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';

import { Avatar } from '@/components/ui';
import { addSubtaskAction, toggleSubtaskAction } from '@/app/actions/tasks';
import { initialsOf, formatDue } from '@/lib/format';
import { cn } from '@/lib/utils';

type Subtask = {
  id: string;
  name: string;
  status: string;
  dueDate: Date | null;
  owner: { name: string; division: { avatarColour: string } };
};

type SectionSubtasksProps = {
  taskId: string;
  subtasks: Subtask[];
  canEdit: boolean;
};

export function SectionSubtasks({ taskId, subtasks, canEdit }: SectionSubtasksProps) {
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
        {canEdit && !showAdd ? (
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
          <SubtaskRow key={s.id} subtask={s} />
        ))}
      </ul>

      {showAdd ? (
        <AddSubtaskForm taskId={taskId} onDone={() => setShowAdd(false)} />
      ) : total === 0 ? (
        <p className="text-[13px] text-ink-3 italic">No subtasks yet.</p>
      ) : null}
    </section>
  );
}

function SubtaskRow({ subtask }: { subtask: Subtask }) {
  const [pending, startTransition] = useTransition();
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
    <li className="flex items-center gap-2.5 py-2.5 border-b border-line-2 last:border-b-0">
      <button
        type="button"
        role="checkbox"
        aria-checked={isDone}
        onClick={toggle}
        disabled={pending}
        className={cn(
          'w-[18px] h-[18px] grid place-items-center rounded-[5px] border-[1.5px] shrink-0 transition-colors',
          isDone ? 'bg-success border-success text-white' : 'border-ink-4 hover:border-ink',
        )}
      >
        {isDone ? <i className="ti ti-check text-[12px]" aria-hidden="true" /> : null}
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
          ariaLabel={`Owner ${subtask.owner.name}`}
        />
      </div>
    </li>
  );
}

function AddSubtaskForm({ taskId, onDone }: { taskId: string; onDone: () => void }) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, formAction] = useFormState(addSubtaskAction, { ok: false, epoch: 0 });

  useEffect(() => {
    if (state.ok) {
      ref.current?.reset();
      onDone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  return (
    <form ref={ref} action={formAction} className="mt-3 flex flex-col gap-2">
      <input type="hidden" name="parentTaskId" value={taskId} />
      <div className="flex gap-2">
        <input
          name="name"
          autoFocus
          required
          maxLength={200}
          placeholder="Subtask name…"
          className="flex-1 px-3 py-2 rounded-lg border border-line bg-panel text-[13px] outline-none focus:border-ink"
        />
        <input
          name="dueDate"
          type="date"
          className="px-2 py-2 rounded-lg border border-line bg-panel text-[12px] outline-none focus:border-ink"
        />
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
