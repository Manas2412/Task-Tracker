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
        <p className="text-[11px] text-urgent mb-1">{state.error}</p>
      ) : null}
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-line text-[12px] font-medium text-ink-2 hover:bg-line-2 transition-colors disabled:opacity-60"
    >
      <i className="ti ti-git-pull-request text-[14px]" aria-hidden="true" />
      {pending ? 'Pulling…' : 'Pull task'}
    </button>
  );
}
