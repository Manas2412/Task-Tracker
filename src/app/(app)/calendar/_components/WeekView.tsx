import Link from 'next/link';
import { format } from 'date-fns';

import { cn } from '@/lib/utils';

import type { CalendarEvent, WeekDay } from '@/lib/calendar';
import { isoDay } from '@/lib/calendar';

type WeekViewProps = {
  grid: WeekDay[];
  events: CalendarEvent[];
};

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function WeekView({ grid, events }: WeekViewProps) {
  // Index events by ISO day for O(1) cell lookup
  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const key = isoDay(e.date);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(e);
  }

  return (
    <div className="rounded-xl border border-line bg-panel overflow-hidden">
      {/* Weekday header strip */}
      <div className="grid grid-cols-7 border-b border-line bg-bg">
        {WEEKDAY_LABELS.map((d, i) => {
          const cell = grid[i];
          return (
            <div
              key={d}
              className="px-2 py-2 text-center"
            >
              <span className="text-[10px] uppercase tracking-[0.06em] font-medium text-ink-3 block">
                {d}
              </span>
              <span
                className={cn(
                  'text-[13px] font-medium leading-none mt-1 inline-block',
                  cell.isToday ? 'text-accent' : 'text-ink-2',
                )}
              >
                {cell.isToday ? (
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent text-white text-[11px] font-medium">
                    {cell.date.getDate()}
                  </span>
                ) : (
                  cell.date.getDate()
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* Week day columns */}
      <div className="grid grid-cols-7">
        {grid.map((cell, i) => {
          const key = isoDay(cell.date);
          const dayEvents = byDay.get(key) ?? [];

          return (
            <div
              key={i}
              className={cn(
                'border-r border-line-2 min-h-[160px] md:min-h-[200px] p-1.5 flex flex-col gap-1',
                i === 6 && 'border-r-0',
              )}
            >
              {/* Mobile date label (hidden on desktop where the header suffices) */}
              <div className="flex items-center justify-between md:hidden mb-1">
                <span
                  className={cn(
                    'text-[11px] font-medium leading-none',
                    cell.isToday ? 'text-accent' : 'text-ink-2',
                  )}
                >
                  {format(cell.date, 'd MMM')}
                </span>
                {dayEvents.length > 0 && (
                  <span className="text-[9px] text-ink-3 leading-none">
                    {dayEvents.length}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-0.5">
                {dayEvents.map((e) => (
                  <EventChip key={e.id} event={e} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// EventChip — identical to MonthView's chip for visual consistency
// ------------------------------------------------------------

function EventChip({ event }: { event: CalendarEvent }) {
  const isTask = event.kind === 'task';
  return (
    <Link
      href={event.href}
      title={`${event.title}\n${event.sub}`}
      className={cn(
        'flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium truncate transition-colors',
        isTask
          ? 'bg-primary-soft text-primary hover:bg-primary-soft/80'
          : 'bg-accent-soft text-accent hover:bg-accent-soft/80',
      )}
    >
      <i
        className={cn('ti text-[10px] shrink-0', isTask ? 'ti-flag-3' : 'ti-file-stack')}
        aria-hidden="true"
      />
      <span className="truncate">{event.title}</span>
    </Link>
  );
}
