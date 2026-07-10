'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Sheet, Switch } from '@/components/ui';

import type { CalendarFilters as Filters } from '@/lib/calendar';
import { buildCalendarHref, type RawParams } from './filter-params';

type Props = {
  sp: RawParams;
  filters: Filters;
  /** Divisions offered in the division filter (only shown when >1). */
  divisions: { id: string; name: string }[];
};

const PRIORITY_OPTIONS = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'awaiting_input', label: 'Awaiting input' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'completed', label: 'Completed' },
];

export function CalendarFilters({ sp, filters, divisions }: Props) {
  const router = useRouter();
  // The division control (and therefore the division filter) is only offered to
  // cross-division viewers. Keep the badge and the applied URL in lock-step with
  // the control so a phantom ?division from a shared URL can't linger unseen.
  const canPickDivision = divisions.length > 1;

  const [open, setOpen] = useState(false);
  // Pending selections — synced to the applied filters each time the sheet opens.
  // Item-kind filtering lives outside the sheet, in the KindFilterBar legend.
  const [mine, setMine] = useState(filters.mine);
  const [divisionId, setDivisionId] = useState(filters.divisionId ?? '');
  const [priority, setPriority] = useState(filters.priority ?? '');
  const [status, setStatus] = useState(filters.status ?? '');

  // Badge on the trigger reflects the currently APPLIED filters (kinds excluded —
  // they are toggled on the legend, not here).
  const appliedCount =
    (filters.mine ? 1 : 0) +
    (canPickDivision && filters.divisionId ? 1 : 0) +
    (filters.priority ? 1 : 0) +
    (filters.status ? 1 : 0);

  const openSheet = () => {
    setMine(filters.mine);
    setDivisionId(filters.divisionId ?? '');
    setPriority(filters.priority ?? '');
    setStatus(filters.status ?? '');
    setOpen(true);
  };

  const reset = () => {
    setMine(false);
    setDivisionId('');
    setPriority('');
    setStatus('');
  };

  const apply = () => {
    // Preserve view + date + the legend's kind selection (types); rebuild the
    // rest of the filters from the pending state.
    const href = buildCalendarHref(
      { view: sp.view, date: sp.date, types: sp.types },
      {
        mine: mine ? '1' : null,
        division: canPickDivision ? divisionId || null : null,
        priority: priority || null,
        status: status || null,
      },
    );
    setOpen(false);
    router.push(href, { scroll: false });
  };

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        aria-label={appliedCount > 0 ? `Filters, ${appliedCount} applied` : 'Filters'}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 px-2.5 md:px-3 py-2 rounded-lg border border-line bg-panel text-[13px] font-medium text-ink-2 hover:text-ink hover:border-ink-4 transition-colors"
      >
        <i className="ti ti-adjustments-horizontal text-[16px]" aria-hidden="true" />
        <span className="hidden sm:inline">Filters</span>
        {appliedCount > 0 ? (
          <span className="min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-ink text-white text-[10px] font-medium leading-none tabular-nums">
            {appliedCount}
          </span>
        ) : null}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Filters">
        <div className="flex flex-col gap-5">
          {/* My items */}
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span className="min-w-0">
              <span className="block text-[14px] font-medium text-ink">My items</span>
              <span className="block text-[12px] text-ink-3">Only what I own or take part in</span>
            </span>
            <Switch checked={mine} onChange={setMine} ariaLabel="Show only my items" />
          </label>

          {/* Narrowing selects */}
          <div className="flex flex-col gap-3">
            {canPickDivision ? (
              <SelectRow
                value={divisionId}
                onChange={setDivisionId}
                placeholder="All divisions"
                options={divisions.map((d) => ({ value: d.id, label: d.name }))}
                ariaLabel="Filter by division"
              />
            ) : null}
            <SelectRow
              value={priority}
              onChange={setPriority}
              placeholder="Any priority"
              options={PRIORITY_OPTIONS}
              ariaLabel="Filter by priority"
            />
            <SelectRow
              value={status}
              onChange={setStatus}
              placeholder="Any status"
              options={STATUS_OPTIONS}
              ariaLabel="Filter by task status"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={reset}
              className="flex-1 py-3 rounded-lg border border-line text-[14px] font-medium text-ink-2 hover:bg-line-2 transition-colors"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={apply}
              className="flex-1 py-3 rounded-lg bg-ink text-white text-[14px] font-medium hover:bg-ink-2 transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      </Sheet>
    </>
  );
}

function SelectRow({
  value,
  onChange,
  placeholder,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
  ariaLabel: string;
}) {
  return (
    <div className="relative">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none pl-3 pr-9 py-2.5 rounded-lg border border-line bg-panel text-[14px] text-ink outline-none focus:border-ink cursor-pointer"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <i
        className="ti ti-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[15px] text-ink-3 pointer-events-none"
        aria-hidden="true"
      />
    </div>
  );
}
