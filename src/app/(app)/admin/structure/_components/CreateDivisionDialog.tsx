'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { Sheet } from '@/components/ui';
import { createDivisionAction } from '@/app/actions/admin-structure';
import {
  INITIAL_STRUCTURE_STATE,
  type AdminStructureState,
} from '@/app/actions/states';
import { cn } from '@/lib/utils';

type DivisionOption = {
  id: string;
  name: string;
  kind: 'division' | 'sub_division' | 'section' | 'pmu';
};

type CreateDivisionDialogProps = {
  open: boolean;
  onClose: () => void;
  divisions: DivisionOption[];
  /** preselect this kind when opening */
  initialKind?: 'division' | 'sub_division' | 'section' | 'pmu';
  /** preselect this parent when opening */
  initialParentId?: string;
};

const KIND_OPTIONS = [
  { value: 'division', label: 'Division', hint: 'Top-level' },
  { value: 'sub_division', label: 'Sub-division', hint: 'Under a division' },
  { value: 'section', label: 'Section', hint: 'Under a sub-division' },
  { value: 'pmu', label: 'PMU', hint: 'Consultant team attached to a division' },
] as const;

// Standard division palette (per docs/COLOUR_TOKENS.css §1.4).
const PALETTE = [
  '#1e1b4b', // deep indigo
  '#4338ca', // indigo-purple
  '#1e40af', // blue
  '#0e7490', // cyan
  '#047857', // emerald
  '#b45309', // amber
  '#c2410c', // burnt orange
  '#be185d', // rose
  '#6b21a8', // violet
  '#525252', // grey
];

export function CreateDivisionDialog({
  open,
  onClose,
  divisions,
  initialKind = 'division',
  initialParentId,
}: CreateDivisionDialogProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useFormState<AdminStructureState, FormData>(
    createDivisionAction,
    INITIAL_STRUCTURE_STATE,
  );

  const [kind, setKind] = useState<typeof KIND_OPTIONS[number]['value']>(initialKind);
  const [parentId, setParentId] = useState<string>(initialParentId ?? '');
  const [colour, setColour] = useState('#1e1b4b');

  useEffect(() => {
    if (open) {
      setKind(initialKind);
      setParentId(initialParentId ?? '');
      setColour('#1e1b4b');
    }
  }, [open, initialKind, initialParentId]);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  const parentCandidates =
    kind === 'sub_division'
      ? divisions.filter((d) => d.kind === 'division')
      : kind === 'section'
        ? divisions.filter((d) => d.kind === 'sub_division')
        : [];
  const pmuParentCandidates = kind === 'pmu'
    ? divisions.filter((d) => d.kind === 'division')
    : [];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="New division"
      subtitle="Top-level divisions own sub-divisions, sections, and PMU teams."
    >
      {open ? (
        <form ref={formRef} action={formAction} className="flex flex-col gap-4">
          {/* Kind */}
          <fieldset>
            <legend className="section-label mb-2">Kind</legend>
            <div className="grid grid-cols-2 gap-1.5">
              {KIND_OPTIONS.map((k) => {
                const active = kind === k.value;
                return (
                  <button
                    key={k.value}
                    type="button"
                    onClick={() => setKind(k.value)}
                    className={cn(
                      'px-3 py-2 rounded-lg border text-left transition-colors',
                      active
                        ? 'border-primary bg-primary-soft'
                        : 'border-line bg-panel hover:border-ink-4',
                    )}
                  >
                    <div className={cn('text-[12.5px] font-medium', active ? 'text-primary' : 'text-ink')}>
                      {k.label}
                    </div>
                    <div className="text-[10px] text-ink-3 mt-0.5">{k.hint}</div>
                  </button>
                );
              })}
            </div>
            <input type="hidden" name="kind" value={kind} />
          </fieldset>

          {/* Name */}
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-ink-2">Name</span>
            <input
              name="name"
              autoFocus
              required
              maxLength={80}
              autoComplete="off"
              placeholder={kind === 'pmu' ? 'e.g. KIM PMU' : 'e.g. Khelo India Mission'}
              className={cn(
                'w-full px-3 py-2 rounded-lg border bg-panel text-[13px] outline-none transition-colors',
                state.fieldErrors?.name ? 'border-urgent focus:border-urgent' : 'border-line focus:border-ink',
              )}
            />
            {state.fieldErrors?.name ? (
              <span className="text-[11px] text-urgent">{state.fieldErrors.name}</span>
            ) : null}
          </label>

          {/* Parent (sub-division / section) */}
          {kind === 'sub_division' || kind === 'section' ? (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-ink-2">
                Parent {kind === 'sub_division' ? 'division' : 'sub-division'}
              </span>
              <select
                name="parentId"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                required
                className={cn(
                  'w-full px-3 py-2 rounded-lg border bg-panel text-[13px] outline-none appearance-none',
                  state.fieldErrors?.parentId
                    ? 'border-urgent focus:border-urgent'
                    : 'border-line focus:border-ink',
                )}
              >
                <option value="" disabled>
                  Pick one…
                </option>
                {parentCandidates.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {state.fieldErrors?.parentId ? (
                <span className="text-[11px] text-urgent">{state.fieldErrors.parentId}</span>
              ) : parentCandidates.length === 0 ? (
                <span className="text-[11px] text-ink-3">
                  No {kind === 'sub_division' ? 'divisions' : 'sub-divisions'} yet — create one first.
                </span>
              ) : null}
            </label>
          ) : null}

          {/* PMU parent */}
          {kind === 'pmu' ? (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-ink-2">Attaches to division</span>
              <select
                name="pmuParentDivisionId"
                required
                defaultValue={initialParentId ?? ''}
                className={cn(
                  'w-full px-3 py-2 rounded-lg border bg-panel text-[13px] outline-none appearance-none',
                  state.fieldErrors?.pmuParentDivisionId
                    ? 'border-urgent focus:border-urgent'
                    : 'border-line focus:border-ink',
                )}
              >
                <option value="" disabled>
                  Pick a division…
                </option>
                {pmuParentCandidates.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {state.fieldErrors?.pmuParentDivisionId ? (
                <span className="text-[11px] text-urgent">{state.fieldErrors.pmuParentDivisionId}</span>
              ) : null}
            </label>
          ) : null}

          {/* Colour palette */}
          <fieldset>
            <legend className="section-label mb-2">Avatar colour</legend>
            <div className="flex flex-wrap gap-1.5">
              {PALETTE.map((c) => {
                const active = colour === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColour(c)}
                    aria-label={`Pick ${c}`}
                    aria-pressed={active}
                    className={cn(
                      'w-7 h-7 rounded-full border-2 transition-transform',
                      active ? 'border-ink scale-110' : 'border-transparent hover:scale-105',
                    )}
                    style={{ backgroundColor: c }}
                  />
                );
              })}
            </div>
            <input type="hidden" name="avatarColour" value={colour} />
            <p className="text-[10px] text-ink-3 mt-2">
              Officers inherit this colour on their avatar inside the chosen unit.
            </p>
          </fieldset>

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
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-line text-[13px] font-medium text-ink-2 hover:bg-line-2"
            >
              Cancel
            </button>
            <CreateButton />
          </div>
        </form>
      ) : null}
    </Sheet>
  );
}

function CreateButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 py-2.5 rounded-lg bg-ink text-white text-[13px] font-medium disabled:opacity-60"
    >
      {pending ? 'Creating…' : 'Create'}
    </button>
  );
}
