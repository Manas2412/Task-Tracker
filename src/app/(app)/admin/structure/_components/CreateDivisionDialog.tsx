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
  initialKind?: 'division' | 'sub_division' | 'section' | 'pmu';
  initialParentId?: string;
};

const KIND_OPTIONS = [
  { value: 'division', label: 'Division', hint: 'Top-level unit', icon: 'ti-building' },
  { value: 'sub_division', label: 'Sub-division', hint: 'Under a division', icon: 'ti-git-branch' },
  { value: 'section', label: 'Section', hint: 'Under a sub-division', icon: 'ti-layout-list' },
  { value: 'pmu', label: 'PMU', hint: 'Consultant team', icon: 'ti-users-group' },
] as const;

const PALETTE = [
  { hex: '#1e1b4b', label: 'Indigo' },
  { hex: '#4338ca', label: 'Purple' },
  { hex: '#1e40af', label: 'Blue' },
  { hex: '#0e7490', label: 'Cyan' },
  { hex: '#047857', label: 'Emerald' },
  { hex: '#b45309', label: 'Amber' },
  { hex: '#c2410c', label: 'Orange' },
  { hex: '#be185d', label: 'Rose' },
  { hex: '#6b21a8', label: 'Violet' },
  { hex: '#525252', label: 'Grey' },
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
  const [abbr, setAbbr] = useState('');

  useEffect(() => {
    if (open) {
      setKind(initialKind);
      setParentId(initialParentId ?? '');
      setColour('#1e1b4b');
      setAbbr('');
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
      title="New unit"
      subtitle="Create a division, sub-division, section, or PMU team."
      size="md"
    >
      {open ? (
        <form ref={formRef} action={formAction} className="flex flex-col gap-5">
          {/* Kind selector */}
          <fieldset>
            <legend className="section-label mb-2.5">Type</legend>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {KIND_OPTIONS.map((k) => {
                const active = kind === k.value;
                return (
                  <button
                    key={k.value}
                    type="button"
                    onClick={() => setKind(k.value)}
                    className={cn(
                      'flex flex-col items-center md:items-center gap-1 px-3 py-3 md:py-2.5 rounded-xl border text-center transition-all',
                      active
                        ? 'border-primary bg-primary-soft shadow-sm ring-1 ring-primary/20'
                        : 'border-line bg-panel hover:border-ink-4 hover:bg-bg',
                    )}
                  >
                    <i
                      className={cn(
                        'ti',
                        k.icon,
                        'text-[18px] md:text-[20px] shrink-0',
                        active ? 'text-primary' : 'text-ink-3',
                      )}
                      aria-hidden="true"
                    />
                    <div className={cn('text-[12px] font-medium leading-tight', active ? 'text-primary' : 'text-ink')}>
                      {k.label}
                    </div>
                    <div className={cn('text-[10px] leading-tight', active ? 'text-primary/70' : 'text-ink-3')}>
                      {k.hint}
                    </div>
                  </button>
                );
              })}
            </div>
            <input type="hidden" name="kind" value={kind} />
          </fieldset>

          {/* Name */}
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-ink-2 uppercase tracking-[0.06em]">Name</span>
            <input
              name="name"
              autoFocus
              required
              maxLength={80}
              autoComplete="off"
              placeholder={kind === 'pmu' ? 'e.g. KIM PMU' : 'e.g. Khelo India Mission'}
              className={cn(
                'w-full px-3 py-2.5 rounded-lg border bg-panel text-[13px] outline-none transition-colors placeholder:text-ink-4',
                state.fieldErrors?.name ? 'border-urgent focus:border-urgent' : 'border-line focus:border-ink',
              )}
            />
            {state.fieldErrors?.name ? (
              <span className="text-[11px] text-urgent">{state.fieldErrors.name}</span>
            ) : null}
          </label>

          {/* Abbreviation */}
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-ink-2 uppercase tracking-[0.06em]">
              Abbreviation
            </span>
            <div className="relative">
              <input
                name="abbreviation"
                value={abbr}
                onChange={(e) => setAbbr(e.target.value.toUpperCase().replace(/[^A-Z0-9&_]/g, ''))}
                maxLength={10}
                autoComplete="off"
                placeholder="e.g. KI, ABD, M&IT, KI_PMU"
                className="w-full px-3 py-2.5 rounded-lg border border-line bg-panel text-[13px] font-mono tracking-wide outline-none transition-colors focus:border-ink placeholder:text-ink-4 placeholder:font-sans placeholder:tracking-normal"
              />
              {abbr ? (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-mono text-ink-3">
                  T-{abbr}1
                </span>
              ) : null}
            </div>
            <span className="text-[10px] text-ink-3">
              Auto-prefixes task IDs — leave blank to auto-generate
            </span>
          </label>

          {/* Parent (sub-division / section) */}
          {kind === 'sub_division' || kind === 'section' ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-ink-2 uppercase tracking-[0.06em]">
                Parent {kind === 'sub_division' ? 'division' : 'sub-division'}
              </span>
              <div className="relative">
                <select
                  name="parentId"
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  required
                  className={cn(
                    'w-full px-3 py-2.5 rounded-lg border bg-panel text-[13px] outline-none appearance-none pr-8',
                    state.fieldErrors?.parentId
                      ? 'border-urgent focus:border-urgent'
                      : 'border-line focus:border-ink',
                  )}
                >
                  <option value="" disabled>
                    Select…
                  </option>
                  {parentCandidates.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <i className="ti ti-chevron-down absolute right-2.5 top-1/2 -translate-y-1/2 text-[14px] text-ink-3 pointer-events-none" aria-hidden="true" />
              </div>
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
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-ink-2 uppercase tracking-[0.06em]">
                Attaches to division
              </span>
              <div className="relative">
                <select
                  name="pmuParentDivisionId"
                  required
                  defaultValue={initialParentId ?? ''}
                  className={cn(
                    'w-full px-3 py-2.5 rounded-lg border bg-panel text-[13px] outline-none appearance-none pr-8',
                    state.fieldErrors?.pmuParentDivisionId
                      ? 'border-urgent focus:border-urgent'
                      : 'border-line focus:border-ink',
                  )}
                >
                  <option value="" disabled>
                    Select a division…
                  </option>
                  {pmuParentCandidates.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <i className="ti ti-chevron-down absolute right-2.5 top-1/2 -translate-y-1/2 text-[14px] text-ink-3 pointer-events-none" aria-hidden="true" />
              </div>
              {state.fieldErrors?.pmuParentDivisionId ? (
                <span className="text-[11px] text-urgent">{state.fieldErrors.pmuParentDivisionId}</span>
              ) : null}
            </label>
          ) : null}

          {/* Colour palette */}
          <fieldset>
            <legend className="section-label mb-2.5">Colour</legend>
            <div className="flex flex-wrap gap-2">
              {PALETTE.map((c) => {
                const active = colour === c.hex;
                return (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setColour(c.hex)}
                    aria-label={c.label}
                    aria-pressed={active}
                    className={cn(
                      'w-8 h-8 rounded-full transition-all relative flex items-center justify-center',
                      active
                        ? 'ring-2 ring-offset-2 ring-offset-panel scale-110'
                        : 'hover:scale-110',
                    )}
                    style={{
                      backgroundColor: c.hex,
                      ...(active ? { ['--tw-ring-color' as string]: c.hex } : {}),
                    }}
                  >
                    {active ? (
                      <i className="ti ti-check text-[14px] text-white" aria-hidden="true" />
                    ) : null}
                  </button>
                );
              })}
            </div>
            <input type="hidden" name="avatarColour" value={colour} />
            <p className="text-[10px] text-ink-3 mt-2.5">
              Officers inherit this colour on their avatar inside the unit.
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

          <div className="flex gap-2 mt-1 pt-2 border-t border-line-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-line text-[13px] font-medium text-ink-2 hover:bg-bg transition-colors"
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
      className="flex-1 py-2.5 rounded-lg bg-ink text-white text-[13px] font-medium disabled:opacity-60 transition-opacity"
    >
      {pending ? 'Creating…' : 'Create'}
    </button>
  );
}
