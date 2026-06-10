'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { Sheet } from '@/components/ui';
import { createTagAction } from '@/app/actions/tags';
import { cn } from '@/lib/utils';

export function CreateTagDialog() {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useFormState(createTagAction, { ok: false, epoch: 0 });

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-ink text-white text-[13px] font-medium hover:bg-ink-2 transition-colors"
      >
        <i className="ti ti-tag-plus text-[14px]" aria-hidden="true" />
        New tag
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="New tag"
        subtitle="Short, lowercase or title-case is conventional (e.g. Cabinet, Q1, NADA)."
      >
        {open ? (
          <form ref={formRef} action={formAction} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-ink-2">Name</span>
              <input
                name="name"
                autoFocus
                required
                maxLength={40}
                autoComplete="off"
                placeholder="Cabinet"
                className={cn(
                  'w-full px-3 py-2 rounded-lg border bg-panel text-[13px] outline-none transition-colors',
                  state.fieldErrors?.name
                    ? 'border-urgent focus:border-urgent'
                    : 'border-line focus:border-ink',
                )}
              />
              {state.fieldErrors?.name ? (
                <span className="text-[11px] text-urgent">{state.fieldErrors.name}</span>
              ) : null}
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

function CreateButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 py-2.5 rounded-lg bg-ink text-white text-[13px] font-medium disabled:opacity-60"
    >
      {pending ? 'Creating…' : 'Create tag'}
    </button>
  );
}
