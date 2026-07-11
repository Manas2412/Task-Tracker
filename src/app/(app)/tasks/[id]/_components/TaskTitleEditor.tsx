'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { updateTaskFieldsAction } from '@/app/actions/tasks';
import {
  INITIAL_FIELDS_STATE,
  type UpdateFieldsState,
} from '@/app/actions/states';

type TaskTitleEditorProps = {
  taskId: string;
  name: string;
  canEdit: boolean;
};

/**
 * Task title with inline rename. View mode renders the H1 with a small
 * edit button beside it (only for users who can edit fields — owner,
 * creator, Director of the division, OSD, JS, Super Admin). Edit mode
 * swaps in a single-line form that submits only the name field.
 */
export function TaskTitleEditor({ taskId, name, canEdit }: TaskTitleEditorProps) {
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useFormState<UpdateFieldsState, FormData>(
    updateTaskFieldsAction,
    INITIAL_FIELDS_STATE,
  );

  useEffect(() => {
    if (state.ok) setEditing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  if (editing) {
    return (
      <form action={formAction} className="flex flex-col gap-2 mt-0.5">
        <input type="hidden" name="taskId" value={taskId} />
        <input
          type="text"
          name="name"
          defaultValue={name}
          autoFocus
          required
          maxLength={200}
          aria-label="Task name"
          className="w-full px-3 py-2 rounded-lg border border-line bg-panel font-serif text-[20px] md:text-[22px] leading-tight text-ink outline-none focus:border-ink"
        />
        {state.fieldErrors?.name ? (
          <p role="alert" className="text-[12px] text-urgent">
            {state.fieldErrors.name}
          </p>
        ) : null}
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
    );
  }

  return (
    <div className="flex items-start gap-2">
      <h1
        id="task-title"
        className="font-serif text-[26px] md:text-[30px] leading-tight font-medium text-ink tracking-tight-title"
      >
        {name}
      </h1>
      {canEdit ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Edit task name"
          className="mt-2 w-8 h-8 grid place-items-center rounded-md text-ink-3 hover:text-ink hover:bg-line-2 shrink-0 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        >
          <i className="ti ti-pencil text-[16px]" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-3 py-1.5 rounded-md bg-ink text-onink text-[12px] font-medium disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Save'}
    </button>
  );
}
