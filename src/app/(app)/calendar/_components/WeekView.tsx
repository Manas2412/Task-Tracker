import { format } from 'date-fns';

import { formatDayLong } from '@/lib/date';
import { cn } from '@/lib/utils';

import type { CalendarEvent, WeekDay } from '@/lib/calendar';
import { isoDay } from '@/lib/calendar';
import { DayCellButton } from './DateControls';
import { EventChip } from './EventItem';

type WeekViewProps = {
  grid: WeekDay[];
  events: CalendarEvent[];
};

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function WeekView({ grid, events }: WeekViewProps) {
  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const key = isoDay(e.date);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(e);
  }

  return (
    <div className="rounded-xl border border-line bg-panel overflow-hidden">
      {/* Weekday header strip (desktop-oriented; mobile uses per-column labels) */}
      <div className="grid grid-cols-7 border-b border-line bg-bg">
        {WEEKDAY_LABELS.map((d, i) => {
          const cell = grid[i];
          const key = isoDay(cell.date);
          const count = byDay.get(key)?.length ?? 0;
          return (
            <div key={d} className="px-2 py-2 text-center">
              <span className="text-[10px] uppercase tracking-[0.06em] font-medium text-ink-3 block">
                {d}
              </span>
              <DayCellButton
                dateIso={key}
                ariaLabel={
                  count > 0
                    ? `Open ${formatDayLong(key)}, ${count} ${count === 1 ? 'item' : 'items'}`
                    : `Open ${formatDayLong(key)}`
                }
                className="mt-1 px-1 md:px-2 py-1 inline-block"
              >
                <span
                  className={cn(
                    'text-[17px] md:text-[18px] font-medium leading-none inline-block tabular-nums',
                    cell.isToday ? 'text-accent' : 'text-ink',
                  )}
                >
                  {cell.isToday ? (
                    <span className="inline-flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-full bg-accent text-white text-[15px] md:text-[17px] font-medium tabular-nums">
                      {cell.date.getDate()}
                    </span>
                  ) : (
                    cell.date.getDate()
                  )}
                </span>
              </DayCellButton>
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
                'border-r border-line-2 min-h-[160px] md:min-h-[200px] p-1 md:p-1.5 flex flex-col gap-1',
                i === 6 && 'border-r-0',
              )}
            >
              {/* Mobile date label (desktop uses the header strip) */}
              <DayCellButton
                dateIso={key}
                ariaLabel={`Open ${formatDayLong(key)}`}
                className="md:hidden flex items-center justify-between gap-1 mb-1 px-1 py-1"
              >
                <span
                  className={cn(
                    'text-[16px] font-medium leading-none tabular-nums',
                    cell.isToday ? 'text-accent' : 'text-ink',
                  )}
                >
                  {format(cell.date, 'd MMM')}
                </span>
                {dayEvents.length > 0 ? (
                  <span className="min-w-[16px] h-4 px-1 grid place-items-center rounded-full bg-line-2 text-ink-3 text-[9px] font-medium leading-none tabular-nums">
                    {dayEvents.length}
                  </span>
                ) : null}
              </DayCellButton>

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
