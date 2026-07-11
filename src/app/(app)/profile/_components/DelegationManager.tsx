'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { Sheet } from '@/components/ui';
import {
  createDelegationAction,
  revokeDelegationAction,
} from '@/app/actions/delegations';
import { INITIAL_DELEGATION_STATE } from '@/app/actions/states';
import { cn } from '@/lib/utils';

export type DelegationTarget = {
  id: string;
  name: string;
  designation: string;
  divisionName: string;
  /** 'Division head' | null */
  badge: string | null;
};

export type HeadedDivisionOption = {
  id: string;
  name: string;
  targets: DelegationTarget[];
};

export type DelegationRow = {
  id: string;
  divisionName: string;
  personName: string;
  windowLabel: string;
  upcoming: boolean;
  canRevoke: boolean;
};

type DelegationManagerProps = {
  /** Divisions the signed-in user directly heads (delegable). */
  headedDivisions: HeadedDivisionOption[];
  /** Live/upcoming delegations this user has given. */
  given: DelegationRow[];
  /** Live/upcoming delegations this user has received. */
  received: DelegationRow[];
};

export function DelegationManager({ headedDivisions, given, received }: DelegationManagerProps) {
  const [open, setOpen] = useState(false);

  if (headedDivisions.length === 0 && given.length === 0 && received.length === 0) {
    return null;
  }

  return (
    <section className="mt-4 bg-panel border border-line rounded-2xl">
      <div className="flex items-center justify-between px-5 md:px-6 pt-5 pb-2">
        <h3 className="section-label">Division access</h3>
        {headedDivisions.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-line text-[12px] font-medium text-ink-2 hover:bg-line-2 transition-colors"
          >
            <i className="ti ti-key text-[14px]" aria-hidden="true" />
            Delegate access
          </button>
        ) : null}
      </div>

      <div className="px-5 md:px-6 pb-5 flex flex-col gap-4">
        {headedDivisions.length > 0 ? (
          <p className="text-[12px] text-ink-3 leading-relaxed">
            You are head of {headedDivisions.map((d) => d.name).join(', ')}. You can
            temporarily delegate that access to another division head or a user in
            your division — it expires on the end date by itself, and Super Admin is
            notified.
          </p>
        ) : null}

        {given.length > 0 ? (
          <div>
            <p className="text-[11px] font-medium text-ink-2 mb-1.5">Delegated by you</p>
            <ul className="flex flex-col divide-y divide-line-2 border border-line rounded-xl">
              {given.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
                  <i className="ti ti-key text-[15px] text-primary shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] text-ink truncate">
                      {d.personName} · {d.divisionName}
                    </span>
                    <span className="block text-[11px] text-ink-3">
                      {d.windowLabel}
                      {d.upcoming ? ' · starts later' : ' · active'}
                    </span>
                  </span>
                  {d.canRevoke ? <RevokeButton delegationId={d.id} /> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {received.length > 0 ? (
          <div>
            <p className="text-[11px] font-medium text-ink-2 mb-1.5">Delegated to you</p>
            <ul className="flex flex-col divide-y divide-line-2 border border-line rounded-xl">
              {received.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
                  <i className="ti ti-key text-[15px] text-success shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] text-ink truncate">
                      {d.divisionName} · from {d.personName}
                    </span>
                    <span className="block text-[11px] text-ink-3">
                      {d.windowLabel}
                      {d.upcoming ? ' · starts later' : ' · active'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {headedDivisions.length > 0 ? (
        <DelegateSheet
          open={open}
          onClose={() => setOpen(false)}
          headedDivisions={headedDivisions}
        />
      ) : null}
    </section>
  );
}

// ------------------------------------------------------------
// Create sheet
// ------------------------------------------------------------

function DelegateSheet({
  open,
  onClose,
  headedDivisions,
}: {
  open: boolean;
  onClose: () => void;
  headedDivisions: HeadedDivisionOption[];
}) {
  const [divisionId, setDivisionId] = useState(headedDivisions[0]?.id ?? '');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [state, formAction] = useFormState(createDelegationAction, INITIAL_DELEGATION_STATE);

  const close = () => {
    onClose();
    setSearch('');
    setSelectedId(null);
  };

  useEffect(() => {
    if (state.ok) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  const division = headedDivisions.find((d) => d.id === divisionId) ?? headedDivisions[0];

  const filtered = useMemo(() => {
    const targets = division?.targets ?? [];
    if (!search) return targets;
    const q = search.toLowerCase();
    return targets.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.designation.toLowerCase().includes(q) ||
        t.divisionName.toLowerCase().includes(q),
    );
  }, [division, search]);

  return (
    <Sheet open={open} onClose={close} title="Delegate division access">
      {open ? (
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="delegateToId" value={selectedId ?? ''} />

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-ink-2">Division</span>
            <select
              name="divisionId"
              value={divisionId}
              onChange={(e) => {
                setDivisionId(e.target.value);
                setSelectedId(null);
              }}
              className="w-full px-3 py-2 rounded-lg border border-line bg-panel text-[13px] text-ink outline-none focus:border-ink appearance-none"
            >
              {headedDivisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-ink-2">Start date</span>
              <input
                type="date"
                name="startDate"
                required
                className={cn(
                  'w-full px-3 py-2 rounded-lg border bg-panel text-[13px] text-ink outline-none',
                  state.fieldErrors?.startDate ? 'border-urgent' : 'border-line focus:border-ink',
                )}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-ink-2">End date</span>
              <input
                type="date"
                name="endDate"
                required
                className={cn(
                  'w-full px-3 py-2 rounded-lg border bg-panel text-[13px] text-ink outline-none',
                  state.fieldErrors?.endDate ? 'border-urgent' : 'border-line focus:border-ink',
                )}
              />
            </label>
          </div>
          {state.fieldErrors?.endDate ? (
            <p className="text-[11px] text-urgent -mt-1">{state.fieldErrors.endDate}</p>
          ) : null}

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-ink-2">Delegate to</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people…"
              className="w-full px-3 py-2.5 rounded-lg border border-line bg-panel text-[14px] outline-none focus:border-ink"
            />
          </label>

          <ul
            className="max-h-[220px] overflow-y-auto flex flex-col gap-0.5"
            role="listbox"
            aria-label="Delegate to"
          >
            {filtered.length === 0 ? (
              <li className="py-6 text-center text-[13px] text-ink-3">No matches</li>
            ) : (
              filtered.map((t) => {
                const isSelected = t.id === selectedId;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => setSelectedId(isSelected ? null : t.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors border',
                        isSelected ? 'border-ink bg-bg' : 'border-transparent hover:bg-bg',
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-medium text-ink truncate">
                          {t.name}
                        </span>
                        <span className="block text-[11px] text-ink-3 truncate">
                          {t.designation} · {t.divisionName}
                        </span>
                      </span>
                      {t.badge ? (
                        <span className="shrink-0 text-[10px] font-medium text-primary bg-primary-soft border border-primary-line/40 px-1.5 py-0.5 rounded">
                          {t.badge}
                        </span>
                      ) : null}
                      {isSelected ? (
                        <i className="ti ti-check text-[15px] text-ink shrink-0" aria-hidden="true" />
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          {state.error ? (
            <p role="alert" className="text-[12px] text-urgent">{state.error}</p>
          ) : null}

          <DelegateSubmit disabled={!selectedId} />
        </form>
      ) : null}
    </Sheet>
  );
}

function DelegateSubmit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="w-full py-2.5 rounded-lg bg-ink text-onink text-[13px] font-medium disabled:opacity-50 transition-opacity"
    >
      {pending ? 'Delegating…' : 'Delegate access'}
    </button>
  );
}

// ------------------------------------------------------------
// Revoke
// ------------------------------------------------------------

function RevokeButton({ delegationId }: { delegationId: string }) {
  const [state, formAction] = useFormState(revokeDelegationAction, INITIAL_DELEGATION_STATE);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm('Revoke this delegation now?')) e.preventDefault();
      }}
    >
      <input type="hidden" name="delegationId" value={delegationId} />
      <RevokeSubmit />
      {state.error ? (
        <span role="alert" className="sr-only">{state.error}</span>
      ) : null}
    </form>
  );
}

function RevokeSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 px-2.5 py-1 rounded-md border border-line text-[11px] font-medium text-urgent hover:bg-urgent-soft transition-colors disabled:opacity-60"
    >
      {pending ? 'Revoking…' : 'Revoke'}
    </button>
  );
}
