'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { updateMyProfileAction } from '@/app/actions/profile';

type WorkActivitiesEditorProps = {
  workActivities: string | null;
};

/**
 * The Work activities section on /profile with self-service editing,
 * mirroring the SectionContext / DeskCommentSection pattern. Submits only
 * the workActivities field; an empty save clears it.
 */
export function WorkActivitiesEditor({ workActivities }: WorkActivitiesEditorProps) {
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useFormState(updateMyProfileAction, {
    ok: false,
    epoch: 0,
  });

  useEffect(() => {
    if (state.ok) setEditing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  return (
    <section className="mt-4 bg-panel border border-line rounded-2xl">
      <div className="flex items-center justify-between px-5 md:px-6 pt-5 pb-2">
        <h3 className="section-label">Work activities</h3>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[11px] font-medium text-primary inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-primary-soft"
          >
            <i className="ti ti-edit text-[13px]" aria-hidden="true" />
            {workActivities ? 'Edit' : 'Add'}
          </button>
        ) : null}
      </div>

      <div className="px-5 md:px-6 pb-5">
        {editing ? (
          <form action={formAction} className="flex flex-col gap-2">
            <textarea
              name="workActivities"
              defaultValue={workActivities ?? ''}
              rows={5}
              autoFocus
              maxLength={5000}
              placeholder="The subjects, schemes, and responsibilities you handle…"
              className="w-full px-3 py-2.5 rounded-lg border border-line bg-panel text-[13px] text-ink-2 leading-relaxed outline-none focus:border-ink resize-none"
            />
            {state.fieldErrors?.workActivities ? (
              <p role="alert" className="text-[11px] text-urgent">
                {state.fieldErrors.workActivities}
              </p>
            ) : null}
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
        ) : workActivities ? (
          <p className="text-[13px] text-ink-2 leading-relaxed whitespace-pre-wrap">
            {workActivities}
          </p>
        ) : (
          <p className="text-[13px] text-ink-3 italic">
            No work activities added yet.
          </p>
        )}
      </div>
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
