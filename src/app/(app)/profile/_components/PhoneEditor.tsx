'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { updateMyProfileAction } from '@/app/actions/profile';

type PhoneEditorProps = {
  phone: string | null;
};

/**
 * Inline editor for the user's own phone number, rendered as the value of
 * the Phone detail row on /profile. Submits only the phone field; an
 * empty save clears the number.
 */
export function PhoneEditor({ phone }: PhoneEditorProps) {
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useFormState(updateMyProfileAction, {
    ok: false,
    epoch: 0,
  });

  useEffect(() => {
    if (state.ok) setEditing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  if (editing) {
    return (
      <form action={formAction} className="flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-1.5">
          <input
            type="tel"
            name="phone"
            defaultValue={phone ?? ''}
            autoFocus
            inputMode="numeric"
            maxLength={20}
            placeholder="10-digit mobile"
            aria-label="Phone number"
            className="w-40 px-2.5 py-1.5 rounded-md border border-line bg-panel text-[13px] text-ink text-right outline-none focus:border-ink"
          />
          <SaveButton />
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="px-2 py-1.5 rounded-md border border-line text-[11px] font-medium text-ink-2 hover:bg-line-2"
          >
            Cancel
          </button>
        </div>
        {state.fieldErrors?.phone ? (
          <p role="alert" className="text-[11px] text-urgent">
            {state.fieldErrors.phone}
          </p>
        ) : null}
        {state.error ? (
          <p role="alert" className="text-[11px] text-urgent">
            {state.error}
          </p>
        ) : null}
      </form>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {phone ? (
        <a href={`tel:+91${phone}`} className="hover:underline">
          {phone}
        </a>
      ) : (
        <span className="text-ink-3 italic font-normal">Add phone number</span>
      )}
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={phone ? 'Edit phone number' : 'Add phone number'}
        className="w-6 h-6 grid place-items-center rounded-md text-ink-3 hover:text-ink hover:bg-line-2 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
      >
        <i className="ti ti-pencil text-[13px]" aria-hidden="true" />
      </button>
    </span>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-2.5 py-1.5 rounded-md bg-ink text-onink text-[11px] font-medium disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Save'}
    </button>
  );
}
