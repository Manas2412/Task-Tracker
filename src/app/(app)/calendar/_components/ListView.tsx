import Link from 'next/link';
import { format, isToday, isTomorrow } from 'date-fns';

import { cn } from '@/lib/utils';

import type { CalendarEvent } from '@/lib/calendar';
import { isoDay } from '@/lib/calendar';

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
          No upcoming milestones in this window. Try the Month view, or scroll forward.
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
            <DayHeading date={sample} />
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

function DayHeading({ date }: { date: Date }) {
  const today = isToday(date);
  const tomorrow = isTomorrow(date);
  const label = today
    ? 'Today'
    : tomorrow
      ? 'Tomorrow'
      : format(date, 'EEEE, d LLLL');
  return (
    <div className="flex items-baseline gap-2 px-1">
      <span
        className={cn(
          'font-serif text-[18px] leading-none',
          today ? 'text-accent' : 'text-ink',
        )}
      >
        {label}
      </span>
      {!today && !tomorrow ? (
        <span className="text-[11px] text-ink-3">{format(date, 'd LLL yyyy')}</span>
      ) : null}
    </div>
  );
}

function EventRow({ event }: { event: CalendarEvent }) {
  const isTask = event.kind === 'task';
  return (
    <Link
      href={event.href}
      className={cn(
        'flex items-start gap-3 p-3 rounded-xl border bg-panel transition-shadow hover:shadow-sm',
        isTask ? 'border-primary-line/40' : 'border-accent-line',
      )}
    >
      <span
        className={cn(
          'w-9 h-9 grid place-items-center rounded-lg shrink-0',
          isTask ? 'bg-primary-soft text-primary' : 'bg-accent-soft text-accent',
        )}
      >
        <i
          className={cn('ti text-[16px]', isTask ? 'ti-flag-3' : 'ti-file-stack')}
          aria-hidden="true"
        />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[13.5px] font-medium text-ink truncate">{event.title}</p>
          <span className="text-[11px] text-ink-3 shrink-0">
            {isTask ? 'Milestone' : 'Timeline file'}
          </span>
        </div>
        <p className="text-[11px] text-ink-3 mt-0.5 truncate">{event.sub}</p>
      </div>
    </Link>
  );
}
