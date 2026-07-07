'use client';

import { useFormState, useFormStatus } from 'react-dom';

import { pullTaskAction } from '@/app/actions/tasks';

type PullTaskButtonProps = {
  taskId: string;
};

export function PullTaskButton({ taskId }: PullTaskButtonProps) {
  const [state, formAction] = useFormState(pullTaskAction, { ok: false, epoch: 0 });

  return (
    <form action={formAction}>
      <input type="hidden" name="taskId" value={taskId} />
      {state.error ? (
        <p role="alert" className="mb-2 text-[12px] text-urgent">
          {state.error}
        </p>
      ) : null}
      <PullSubmit />
    </form>
  );
}

// A prominent action card — matches the Transfer card's weight so the task's
// primary action reads clearly. One tap claims the task; the "you become the
// owner" outcome is stated on the card itself.
function PullSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="Pull this task — you will become its owner"
      className="group w-full flex items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3.5 text-left transition-colors hover:border-ink-4 hover:bg-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-60 disabled:cursor-wait"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-ink text-white">
        <i
          className="ti ti-user-plus text-[18px] transition-transform group-hover:scale-110"
          aria-hidden="true"
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium text-ink">
          {pending ? 'Pulling task…' : 'Pull this task'}
        </span>
        <span className="mt-0.5 block text-[12px] text-ink-3">
          You&rsquo;ll become the owner of this task
        </span>
      </span>
      <i
        className="ti ti-arrow-right shrink-0 text-[18px] text-ink-3 transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </button>
  );
}
