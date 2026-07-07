'use client';

import { useFormState, useFormStatus } from 'react-dom';

type CompleteState = { ok: boolean; error?: string; epoch?: number };

type CompleteButtonProps = {
  /** A `(prev, formData) => Promise<State>` server action that completes the item. */
  action: (prev: CompleteState | undefined, formData: FormData) => Promise<CompleteState>;
  /** Hidden fields the action reads, e.g. { taskId, status: 'completed' } or { id, status: 'closed' }. */
  fields: Record<string, string>;
  /** Accessible label + tooltip, e.g. "Mark task complete". */
  label: string;
};

/**
 * A small round green tick that marks an item complete in one tap — shown
 * beside a task or Timeline File title. The host decides when to render it:
 * only for users who may complete the item, and only while it is not already
 * complete, so a tap here always moves the item to done. Uses the success
 * status token (not an accent), so it stays within the two-accent rule.
 */
export function CompleteButton({ action, fields, label }: CompleteButtonProps) {
  const [state, formAction] = useFormState(action, { ok: false, epoch: 0 });

  return (
    <form action={formAction} className="relative shrink-0">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Submit label={label} />
      {state.error ? (
        <span
          role="alert"
          className="absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded-md border border-urgent/20 bg-urgent-soft px-2 py-1 text-[11px] text-urgent"
        >
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={label}
      title={label}
      className="grid h-8 w-8 place-items-center rounded-full bg-success text-white shadow-sm transition-transform hover:scale-110 active:scale-95 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-success"
    >
      <i className="ti ti-check text-[16px]" aria-hidden="true" />
    </button>
  );
}
