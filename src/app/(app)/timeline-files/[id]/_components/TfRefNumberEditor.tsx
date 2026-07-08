'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { TF_REF_CHIP } from '@/components/ui';
import { updateTimelineFileRefNumberAction } from '@/app/actions/timeline-files';

type TfRefNumberEditorProps = {
  tfId: string;
  refNo: string;
  refYear: number;
  /** The raw digits after the "/" in refNo — preserves any leading zeros. */
  fileNumber: string;
  canEdit: boolean;
};

/**
 * Reference-number chip ("TF-2026/004") with inline edit — Super Admin
 * only, stricter than the other TF field edits. Editing changes both the
 * year and the file number; they combine into TF-<year>/<number> exactly
 * as typed, same convention as at creation.
 */
export function TfRefNumberEditor({
  tfId,
  refNo,
  refYear,
  fileNumber,
  canEdit,
}: TfRefNumberEditorProps) {
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useFormState(updateTimelineFileRefNumberAction, {
    ok: false,
    epoch: 0,
  });

  useEffect(() => {
    if (state.ok) setEditing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  if (editing) {
    return (
      <form action={formAction} className="flex items-center gap-1.5 flex-wrap">
        <input type="hidden" name="id" value={tfId} />
        <span className="font-mono text-[11px] text-ink-3">TF-</span>
        <input
          type="text"
          name="refYear"
          defaultValue={String(refYear)}
          autoFocus
          required
          inputMode="numeric"
          pattern="[0-9]{4}"
          maxLength={4}
          aria-label="Reference year"
          className="w-14 px-1.5 py-1 rounded-md border border-line bg-panel font-mono text-[11px] text-ink outline-none focus:border-ink"
        />
        <span className="font-mono text-[11px] text-ink-3">/</span>
        <input
          type="text"
          name="fileNumber"
          defaultValue={fileNumber}
          required
          inputMode="numeric"
          pattern="[0-9]{1,6}"
          maxLength={6}
          aria-label="File number"
          className="w-16 px-1.5 py-1 rounded-md border border-line bg-panel font-mono text-[11px] text-ink outline-none focus:border-ink"
        />
        <SaveButton />
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-[11px] font-medium text-ink-2 px-1.5 py-1 rounded-md hover:bg-line-2"
        >
          Cancel
        </button>
        {state.fieldErrors?.refYear ? (
          <p role="alert" className="w-full text-[11px] text-urgent">
            {state.fieldErrors.refYear}
          </p>
        ) : null}
        {state.fieldErrors?.fileNumber ? (
          <p role="alert" className="w-full text-[11px] text-urgent">
            {state.fieldErrors.fileNumber}
          </p>
        ) : null}
        {state.error ? (
          <p role="alert" className="w-full text-[11px] text-urgent">
            {state.error}
          </p>
        ) : null}
      </form>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span className={TF_REF_CHIP}>{refNo}</span>
      {canEdit ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Edit reference number"
          className="w-6 h-6 grid place-items-center rounded-md text-ink-3 hover:text-ink hover:bg-line-2 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        >
          <i className="ti ti-pencil text-[13px]" aria-hidden="true" />
        </button>
      ) : null}
    </span>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-2 py-1 rounded-md bg-ink text-white text-[11px] font-medium disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Save'}
    </button>
  );
}
