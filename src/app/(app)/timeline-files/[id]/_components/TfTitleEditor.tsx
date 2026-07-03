'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { updateTimelineFileFieldsAction } from '@/app/actions/timeline-files';

type TfTitleEditorProps = {
  tfId: string;
  subject: string;
  canEdit: boolean;
};

/**
 * Timeline file subject with inline rename, mirroring TaskTitleEditor.
 * Shown to OSD and Super Admin only — the same gate as every other
 * TF field edit (subject/from/dates/secretary + desk comments).
 */
export function TfTitleEditor({ tfId, subject, canEdit }: TfTitleEditorProps) {
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useFormState(updateTimelineFileFieldsAction, {
    ok: false,
    epoch: 0,
  });

  useEffect(() => {
    if (state.ok) setEditing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  if (editing) {
    return (
      <form action={formAction} className="flex flex-col gap-2 mt-0.5">
        <input type="hidden" name="id" value={tfId} />
        <input
          type="text"
          name="subject"
          defaultValue={subject}
          autoFocus
          required
          maxLength={200}
          aria-label="Timeline file subject"
          className="w-full px-3 py-2 rounded-lg border border-line bg-panel font-serif text-[20px] md:text-[22px] leading-tight text-ink outline-none focus:border-ink"
        />
        {state.fieldErrors?.subject ? (
          <p role="alert" className="text-[12px] text-urgent">
            {state.fieldErrors.subject}
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
        id="tf-title"
        className="font-serif text-[24px] md:text-[28px] leading-tight text-ink tracking-tight-title mb-2"
      >
        {subject}
      </h1>
      {canEdit ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Edit subject"
          className="mt-0.5 w-8 h-8 grid place-items-center rounded-md text-ink-3 hover:text-ink hover:bg-line-2 shrink-0 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
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
      className="px-3 py-1.5 rounded-md bg-ink text-white text-[12px] font-medium disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Save'}
    </button>
  );
}
