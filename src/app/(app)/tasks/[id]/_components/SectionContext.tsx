'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { updateTaskFieldsAction } from '@/app/actions/tasks';
import {
  INITIAL_FIELDS_STATE,
  type UpdateFieldsState,
} from '@/app/actions/states';
import { cn } from '@/lib/utils';

type SectionContextProps = {
  taskId: string;
  description: string | null;
};

/**
 * Description / context section with inline edit.
 * Default: view mode (Read more on long copy).
 * Edit mode: textarea + Save / Cancel; uses updateTaskFieldsAction.
 */
export function SectionContext({ taskId, description }: SectionContextProps) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [state, formAction] = useFormState<UpdateFieldsState, FormData>(
    updateTaskFieldsAction,
    INITIAL_FIELDS_STATE,
  );

  useEffect(() => {
    if (state.ok) setEditing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  return (
    <section aria-labelledby="sec-context" className="px-4 md:px-6 py-5 border-b border-line-2">
      <div className="flex items-center justify-between mb-2.5">
        <h2 id="sec-context" className="section-label">
          Context
        </h2>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[11px] font-medium text-primary inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-primary-soft"
          >
            <i className="ti ti-edit text-[13px]" aria-hidden="true" />
            {description ? 'Edit' : 'Add'}
          </button>
        ) : null}
      </div>

      {editing ? (
        <form action={formAction} className="flex flex-col gap-2">
          <input type="hidden" name="taskId" value={taskId} />
          <textarea
            name="description"
            defaultValue={description ?? ''}
            rows={5}
            autoFocus
            placeholder="Add context, references, background…"
            className="w-full px-3 py-2.5 rounded-lg border border-line bg-panel text-[14px] text-ink-2 leading-relaxed outline-none focus:border-ink resize-none"
            maxLength={5000}
          />
          {state.error ? (
            <p role="alert" className="text-[12px] text-urgent">
              {state.error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 rounded-md border border-line text-[12px] font-medium text-ink-2 hover:bg-line-2"
            >
              Cancel
            </button>
            <SaveButton />
          </div>
        </form>
      ) : description ? (
        <>
          <p
            className={cn(
              'text-[13px] text-ink-2 leading-relaxed whitespace-pre-wrap',
              !expanded && description.length > 280 && 'line-clamp-3',
            )}
          >
            {description}
          </p>
          {description.length > 280 ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="mt-1.5 text-[12px] font-medium text-primary"
            >
              {expanded ? 'Show less' : 'Read more'}
            </button>
          ) : null}
        </>
      ) : (
        <p className="text-[13px] text-ink-3 italic">No description yet.</p>
      )}
    </section>
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
