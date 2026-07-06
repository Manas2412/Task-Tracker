import Link from 'next/link';

import { cn } from '@/lib/utils';

import type { CalendarFilters, CalendarKind } from '@/lib/calendar';
import { FilterSelect } from './FilterSelect';
import { buildCalendarHref, toggleKindParam, type RawParams } from './filter-params';
import { KIND_META } from './kind-style';

type FilterBarProps = {
  sp: RawParams;
  filters: CalendarFilters;
  /** Whether the engagement chip is offered (OJS members + Super Admins). */
  showEngagements: boolean;
  /** Divisions offered in the division filter (only shown when >1). */
  divisions: { id: string; name: string }[];
};

const KIND_CHIPS: { kind: CalendarKind; label: string }[] = [
  { kind: 'engagement', label: 'JS engagements' },
  { kind: 'task', label: 'Task deadlines' },
  { kind: 'tf', label: 'Timeline files' },
];

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

export function FilterBar({ sp, filters, showEngagements, divisions }: FilterBarProps) {
  const chips = KIND_CHIPS.filter((c) => c.kind !== 'engagement' || showEngagements);
  const anyFilterActive =
    filters.mine ||
    !!filters.divisionId ||
    !!filters.priority ||
    !!filters.status ||
    chips.some((c) => !filters.kinds.has(c.kind));

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {/* Item-type toggles */}
      {chips.map(({ kind, label }) => {
        const active = filters.kinds.has(kind);
        return (
          <Link
            key={kind}
            href={buildCalendarHref(sp, { types: toggleKindParam(filters.kinds, kind) })}
            scroll={false}
            aria-pressed={active}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] font-medium transition-colors',
              active
                ? 'border-ink-4 bg-panel text-ink'
                : 'border-line bg-bg text-ink-3 hover:text-ink-2',
            )}
          >
            <span className={cn('w-2.5 h-2.5 rounded-full', active ? KIND_META[kind].dot : 'bg-ink-4/40')} />
            {label}
          </Link>
        );
      })}

      <span className="w-px h-5 bg-line-2 mx-0.5" aria-hidden="true" />

      {/* My items */}
      <Link
        href={buildCalendarHref(sp, { mine: filters.mine ? null : '1' })}
        scroll={false}
        aria-pressed={filters.mine}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] font-medium transition-colors',
          filters.mine
            ? 'border-ink-4 bg-panel text-ink'
            : 'border-line bg-bg text-ink-3 hover:text-ink-2',
        )}
      >
        <i className="ti ti-user text-[13px]" aria-hidden="true" />
        My items
      </Link>

      {/* Optional narrowing selects */}
      {divisions.length > 1 ? (
        <FilterSelect
          paramKey="division"
          value={filters.divisionId}
          options={divisions.map((d) => ({ value: d.id, label: d.name }))}
          allLabel="All divisions"
          sp={sp}
          ariaLabel="Filter by division"
        />
      ) : null}
      <FilterSelect
        paramKey="priority"
        value={filters.priority}
        options={PRIORITY_OPTIONS}
        allLabel="Any priority"
        sp={sp}
        ariaLabel="Filter by priority"
      />
      <FilterSelect
        paramKey="status"
        value={filters.status}
        options={STATUS_OPTIONS}
        allLabel="Any status"
        sp={sp}
        ariaLabel="Filter by task status"
      />

      {anyFilterActive ? (
        <Link
          href={buildCalendarHref(
            { view: sp.view, date: sp.date },
            {},
          )}
          scroll={false}
          className="inline-flex items-center gap-1 px-2 py-1.5 text-[12px] font-medium text-ink-3 hover:text-ink transition-colors"
        >
          <i className="ti ti-x text-[13px]" aria-hidden="true" />
          Reset
        </Link>
      ) : null}
    </div>
  );
}
