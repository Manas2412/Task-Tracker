'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { updateDocumentFieldsAction } from '@/app/actions/documents';

/**
 * Inline subject editor for a document record (mirrors TaskTitleEditor). Reads
 * as an <h1> until the pencil is tapped, then an input + save via the shared
 * fields action.
 */
export function DocumentTitleEditor({
  documentId,
  subject,
}: {
  documentId: string;
  subject: string;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useFormState(updateDocumentFieldsAction, { ok: false, epoch: 0 });

  useEffect(() => {
    if (state.ok) setEditing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  if (!editing) {
    return (
      <div className="flex items-start gap-2">
        <h1 className="flex-1 font-serif text-[20px] md:text-[24px] leading-tight text-ink tracking-tight-title">
          {subject}
        </h1>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Edit subject"
          className="mt-1 shrink-0 w-7 h-7 grid place-items-center rounded-md text-ink-3 hover:bg-line-2 hover:text-ink-2 transition-colors"
        >
          <i className="ti ti-edit text-[15px]" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={documentId} />
      <input
        name="subject"
        defaultValue={subject}
        autoFocus
        required
        maxLength={300}
        className="w-full px-3 py-2 rounded-lg border border-line bg-panel text-[16px] font-medium text-ink outline-none focus:border-ink"
      />
      {state.error ? (
        <p role="alert" className="text-[11px] text-urgent">
          {state.error}
        </p>
      ) : null}
      <div className="flex gap-2 justify-end">
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
