import { format, isToday, isTomorrow } from 'date-fns';

import { cn } from '@/lib/utils';

import type { CalendarEvent } from '@/lib/calendar';
import { isoDay } from '@/lib/calendar';
import { AddOnDayButton } from './DateControls';
import { EventRow } from './EventItem';

type ListViewProps = {
  events: CalendarEvent[];
};

export function ListView({ events }: ListViewProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line p-10 text-center bg-panel">
        <i
          className="ti ti-calendar-event text-[28px] text-ink-3 mb-2 block"
          aria-hidden="true"
        />
        <p className="text-[13px] text-ink-2">
          Nothing here in this window. Adjust the filters, try the Month view, or scroll forward.
        </p>
      </div>
    );
  }

  // Group by day
  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const key = isoDay(e.date);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(e);
  }
  const sortedDays = Array.from(byDay.keys()).sort();

  return (
    <ul className="flex flex-col gap-5">
      {sortedDays.map((day) => {
        const sample = byDay.get(day)![0].date;
        return (
          <li key={day}>
            <DayHeading date={sample} dateIso={day} />
            <ul className="flex flex-col gap-1.5 mt-2">
              {byDay.get(day)!.map((e) => (
                <li key={e.id}>
                  <EventRow event={e} />
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}

function DayHeading({ date, dateIso }: { date: Date; dateIso: string }) {
  const today = isToday(date);
  const tomorrow = isTomorrow(date);
  const label = today ? 'Today' : tomorrow ? 'Tomorrow' : format(date, 'EEEE, d LLLL');
  return (
    <div className="flex items-center gap-2 px-1">
      <span className={cn('font-serif text-[18px] leading-none', today ? 'text-accent' : 'text-ink')}>
        {label}
      </span>
      <span className="ml-auto">
        <AddOnDayButton dateIso={dateIso} />
      </span>
    </div>
  );
}
