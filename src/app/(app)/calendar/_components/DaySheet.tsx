'use client';

import { cn } from '@/lib/utils';

import type { CalendarEvent } from '@/lib/calendar';
import { EventRow } from './EventItem';

/** One "Create new" row inside the day sheet. */
export type CreateAction = {
  key: string;
  icon: string;
  /** Token text-colour class for the leading tile. */
  tone: string;
  label: string;
  hint: string;
  onClick: () => void;
};

type DaySheetProps = {
  events: CalendarEvent[];
  actions: CreateAction[];
  /**
   * Whether the day falls inside the currently-loaded window, so its agenda
   * is trustworthy. When false (e.g. "New" pressed for today while viewing a
   * different month) we show only the create options — never a "nothing
   * scheduled" claim we can't stand behind.
   */
  showAgenda: boolean;
  /** Called when an agenda row is activated, so the parent can close the sheet. */
  onRowActivate: () => void;
};

export function DaySheet({ events, actions, showAgenda, onRowActivate }: DaySheetProps) {
  return (
    <div className="flex flex-col gap-5">
      {showAgenda ? (
        <section aria-label="Scheduled on this day">
          {events.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {events.map((e) => (
                <li key={e.id}>
                  <EventRow event={e} showPriority onActivate={onRowActivate} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-dashed border-line bg-bg px-4 py-6 text-center">
              <i
                className="ti ti-calendar-off text-[22px] text-ink-4 mb-1.5 block"
                aria-hidden="true"
              />
              <p className="text-[13px] text-ink-3">Nothing scheduled on this day.</p>
            </div>
          )}
        </section>
      ) : null}

      <section aria-label="Create new">
        <p className="text-[10px] uppercase tracking-[0.08em] text-ink-3 font-medium mb-2">
          Create new
        </p>
        <div className="flex flex-col gap-2">
          {actions.map((a) => (
            <ActionButton key={a.key} action={a} />
          ))}
        </div>
      </section>
    </div>
  );
}

function ActionButton({ action }: { action: CreateAction }) {
  return (
    <button
      type="button"
      onClick={action.onClick}
      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border border-line bg-panel hover:border-ink-4 hover:bg-bg transition-colors text-left"
    >
      <span className={cn('w-9 h-9 grid place-items-center rounded-lg bg-bg', action.tone)}>
        <i className={cn('ti', action.icon, 'text-[18px]')} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-medium text-ink">{action.label}</span>
        <span className="block text-[12px] text-ink-3">{action.hint}</span>
      </span>
      <i className="ti ti-chevron-right text-[15px] text-ink-3 ml-auto" aria-hidden="true" />
    </button>
  );
}
