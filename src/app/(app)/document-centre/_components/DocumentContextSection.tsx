'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { QuoteCard } from '@/components/ui';
import { updateDocumentFieldsAction } from '@/app/actions/documents';

/**
 * Context block for a document record — mirrors the task SectionContext
 * (plain textarea edit, read-only QuoteCard display). "Context" is the record's
 * free-text background, the Document Centre analogue of task.description.
 */
export function DocumentContextSection({
  documentId,
  context,
}: {
  documentId: string;
  context: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useFormState(updateDocumentFieldsAction, { ok: false, epoch: 0 });
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (state.ok) setEditing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  const long = (context?.length ?? 0) > 280;

  return (
    <section aria-labelledby="doc-context" className="px-4 md:px-6 py-5 border-b border-line-2">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="section-label" id="doc-context">
          Context
        </h2>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[11px] font-medium text-primary inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-primary-soft"
          >
            <i className="ti ti-edit text-[13px]" aria-hidden="true" />
            {context ? 'Edit' : 'Add'}
          </button>
        ) : null}
      </div>

      {editing ? (
        <form action={formAction} className="flex flex-col gap-2">
          <input type="hidden" name="id" value={documentId} />
          <textarea
            name="context"
            defaultValue={context ?? ''}
            rows={5}
            autoFocus
            placeholder="Add context, background, or a summary…"
            className="w-full px-3 py-3 rounded-lg border border-line bg-panel text-[14px] text-ink leading-relaxed outline-none focus:border-ink resize-none"
            maxLength={5000}
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
      ) : context ? (
        <>
          <QuoteCard
            text={long && !expanded ? `${context.slice(0, 280).trimEnd()}…` : context}
            tone="ink"
          />
          {long ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 text-[11px] font-medium text-primary hover:underline"
            >
              {expanded ? 'Show less' : 'Read more'}
            </button>
          ) : null}
        </>
      ) : (
        <p className="text-[13px] text-ink-3 italic">No context yet.</p>
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
