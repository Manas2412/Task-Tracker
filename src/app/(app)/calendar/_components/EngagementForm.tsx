'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import {
  createEngagementAction,
  updateEngagementAction,
} from '@/app/actions/engagements';
import { INITIAL_ENGAGEMENT_STATE, type EngagementState } from '@/app/actions/states';
import { isoDay, istTimeInput } from '@/lib/date';
import { cn } from '@/lib/utils';

import type { PickUser } from './types';

export type EngagementEditData = {
  id: string;
  title: string;
  startsAt: string; // ISO
  venue: string | null;
  momNotes: string | null;
  participantIds: string[];
};

type Props = {
  candidates: PickUser[];
  onDone: () => void;
  /** YYYY-MM-DD prefilled for a new engagement (e.g. the clicked date). */
  defaultDate?: string;
  /** Present when editing. */
  edit?: EngagementEditData;
};

const inputCn = (invalid?: boolean) =>
  cn(
    'w-full px-3 py-2.5 rounded-lg border bg-panel text-[14px] text-ink outline-none focus:border-ink',
    invalid ? 'border-urgent' : 'border-line',
  );

export function EngagementForm({ candidates, onDone, defaultDate, edit }: Props) {
  const isEdit = !!edit;
  const action = isEdit ? updateEngagementAction : createEngagementAction;
  const [state, formAction] = useFormState<EngagementState, FormData>(
    action,
    INITIAL_ENGAGEMENT_STATE,
  );
  const formRef = useRef<HTMLFormElement>(null);

  const startsAt = edit ? new Date(edit.startsAt) : null;
  const [selected, setSelected] = useState<string[]>(edit?.participantIds ?? []);

  useEffect(() => {
    if (state.ok) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3.5" noValidate>
      {isEdit ? <input type="hidden" name="engagementId" value={edit!.id} /> : null}
      <input type="hidden" name="participantIds" value={selected.join(',')} />

      <Field label="Title" error={state.fieldErrors?.title}>
        <input
          name="title"
          type="text"
          autoFocus
          maxLength={200}
          defaultValue={edit?.title ?? ''}
          placeholder="Meeting title…"
          className={inputCn(!!state.fieldErrors?.title)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" error={state.fieldErrors?.date}>
          <input
            name="date"
            type="date"
            defaultValue={startsAt ? isoDay(startsAt) : (defaultDate ?? '')}
            className={inputCn(!!state.fieldErrors?.date)}
          />
        </Field>
        <Field label="Start time" error={state.fieldErrors?.startTime}>
          <input
            name="startTime"
            type="time"
            defaultValue={startsAt ? istTimeInput(startsAt) : '10:00'}
            className={inputCn(!!state.fieldErrors?.startTime)}
          />
        </Field>
      </div>

      <Field label="Venue or meeting link">
        <input
          name="venue"
          type="text"
          maxLength={500}
          defaultValue={edit?.venue ?? ''}
          placeholder="Room 214, or a video link…"
          className={inputCn()}
        />
      </Field>

      <ParticipantPicker candidates={candidates} selected={selected} onChange={setSelected} />

      <Field label="MoM notes">
        <textarea
          name="momNotes"
          rows={4}
          maxLength={8000}
          defaultValue={edit?.momNotes ?? ''}
          placeholder="Minutes of meeting, agenda, decisions…"
          className={cn(inputCn(), 'resize-none')}
        />
      </Field>

      <Field label="Attachment link" error={state.fieldErrors?.driveUrl}>
        <input
          name="driveUrl"
          type="url"
          maxLength={1000}
          placeholder="Google Drive, Dropbox, or any URL…"
          className={inputCn(!!state.fieldErrors?.driveUrl)}
        />
      </Field>

      {state.error ? (
        <p
          role="alert"
          className="text-[12px] text-urgent bg-urgent-soft border border-urgent/20 rounded-lg px-3 py-2"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-2 mt-1">
        <button
          type="button"
          onClick={onDone}
          className="flex-1 py-3 rounded-lg border border-line text-[14px] font-medium text-ink-2 hover:bg-line-2 transition-colors"
        >
          Cancel
        </button>
        <SaveButton isEdit={isEdit} />
      </div>
    </form>
  );
}

function SaveButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 py-3 rounded-lg bg-ink text-white text-[14px] font-medium transition-opacity disabled:opacity-60"
    >
      {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Add engagement'}
    </button>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-ink-2 mb-1.5">{label}</label>
      {children}
      {error ? <p className="text-[11px] text-urgent mt-1">{error}</p> : null}
    </div>
  );
}

// ------------------------------------------------------------
// Participant picker — searchable checklist, selected shown as chips
// ------------------------------------------------------------

function ParticipantPicker({
  candidates,
  selected,
  onChange,
}: {
  candidates: PickUser[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const byId = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? candidates.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.designation.toLowerCase().includes(q) ||
            c.divisionName.toLowerCase().includes(q),
        )
      : candidates;
    return pool.slice(0, 8);
  }, [candidates, query]);

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);

  return (
    <div>
      <label className="block text-[11px] font-medium text-ink-2 mb-1.5">Participants</label>

      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((id) => {
            const u = byId.get(id);
            if (!u) return null;
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md bg-primary-soft text-primary text-[12px] font-medium"
              >
                {u.name}
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  aria-label={`Remove ${u.name}`}
                  className="w-4 h-4 grid place-items-center rounded hover:bg-primary/10"
                >
                  <i className="ti ti-x text-[11px]" aria-hidden="true" />
                </button>
              </span>
            );
          })}
        </div>
      ) : null}

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search people to add…"
        className={inputCn()}
      />

      {query.trim() ? (
        <ul className="mt-1.5 border border-line rounded-lg divide-y divide-line-2 overflow-hidden max-h-56 overflow-y-auto">
          {matches.length === 0 ? (
            <li className="px-3 py-2.5 text-[12px] text-ink-3">No matching people.</li>
          ) : (
            matches.map((u) => {
              const isSel = selected.includes(u.id);
              return (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => toggle(u.id)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-bg transition-colors"
                  >
                    <span className="min-w-0">
                      <span className="block text-[13px] text-ink truncate">{u.name}</span>
                      <span className="block text-[11px] text-ink-3 truncate">
                        {u.designation} · {u.divisionName}
                      </span>
                    </span>
                    <i
                      className={cn(
                        'ti text-[16px] shrink-0',
                        isSel ? 'ti-checkbox text-primary' : 'ti-square text-ink-4',
                      )}
                      aria-hidden="true"
                    />
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
