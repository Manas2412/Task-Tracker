'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { QuoteCard } from '@/components/ui';
import { updateTimelineFileFieldsAction } from '@/app/actions/timeline-files';

type DeskCommentSectionProps = {
  tfId: string;
  comments: string | null;
  /** Optional attribution row shown under the note; omitted when absent. */
  signature?: string | null;
  canEdit: boolean;
};

/**
 * Desk-level note, rendered as the same quoted callout as the Secretary's
 * comments (Design Tokens §6.4) — the section label tells the two apart.
 *   - canEdit + comments → quote card + Edit button
 *   - canEdit + no comments → small "Add" button
 *   - !canEdit + comments → read-only quote card
 *   - !canEdit + no comments → nothing renders
 */
export function DeskCommentSection({ tfId, comments, signature, canEdit }: DeskCommentSectionProps) {
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useFormState(updateTimelineFileFieldsAction, {
    ok: false,
    epoch: 0,
  });

  useEffect(() => {
    if (state.ok) setEditing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  if (!canEdit && !comments) return null;

  return (
    <section
      aria-labelledby="tf-desk-comment"
      className="px-4 md:px-6 py-5 border-b border-line-2"
    >
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="section-label" id="tf-desk-comment">
          Desk comment
        </h2>
        {canEdit && !editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[11px] font-medium text-primary inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-primary-soft"
          >
            <i className="ti ti-edit text-[13px]" aria-hidden="true" />
            {comments ? 'Edit' : 'Add'}
          </button>
        ) : null}
      </div>

      {editing ? (
        <form action={formAction} className="flex flex-col gap-2">
          <input type="hidden" name="id" value={tfId} />
          <textarea
            name="deskComments"
            defaultValue={comments ?? ''}
            rows={4}
            autoFocus
            placeholder="Working note from the desk handling this file…"
            className="w-full px-3 py-2.5 rounded-lg border border-line bg-panel text-[13px] text-ink-2 leading-relaxed outline-none focus:border-ink resize-none"
            maxLength={4000}
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
      ) : comments ? (
        <QuoteCard text={comments} signature={signature} tone="primary" />
      ) : (
        <p className="text-[13px] text-ink-3 italic">No desk comment yet.</p>
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
      className="px-3 py-1.5 rounded-md bg-ink text-onink text-[12px] font-medium disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Save'}
    </button>
  );
}
