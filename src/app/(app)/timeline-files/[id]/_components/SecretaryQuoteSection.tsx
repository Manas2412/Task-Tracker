'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { QuoteCard } from '@/components/ui';
import { updateTimelineFileFieldsAction } from '@/app/actions/timeline-files';

type SecretaryQuoteSectionProps = {
  tfId: string;
  comments: string | null;
  signature: string;
  canEdit: boolean;
};

/**
 * Secretary's comments block — quoted callout per Design Tokens §6.4.
 *   - canEdit + comments → quote view + Edit button
 *   - canEdit + no comments → small "Add comments" button
 *   - !canEdit + comments → read-only quote
 *   - !canEdit + no comments → nothing renders
 */
export function SecretaryQuoteSection({
  tfId,
  comments,
  signature,
  canEdit,
}: SecretaryQuoteSectionProps) {
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
      aria-labelledby="tf-secretary"
      className="px-4 md:px-6 py-5 border-b border-line-2"
    >
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="section-label" id="tf-secretary">
          Secretary&rsquo;s comments
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
            name="secretaryComments"
            defaultValue={comments ?? ''}
            rows={5}
            autoFocus
            placeholder="Direction from the Secretary, Sports…"
            className="w-full px-3 py-3 rounded-lg border border-line bg-panel text-[14px] font-serif text-ink leading-relaxed outline-none focus:border-ink resize-none"
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
      ) : null}
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
