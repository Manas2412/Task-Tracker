import { cn } from '@/lib/utils';

import type { CalendarEvent, MonthDay } from '@/lib/calendar';
import { isoDay } from '@/lib/calendar';
import { DayCellButton } from './DateControls';
import { EventChip } from './EventItem';

type MonthViewProps = {
  grid: MonthDay[];
  events: CalendarEvent[];
};

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function MonthView({ grid, events }: MonthViewProps) {
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
        {WEEKDAY_LABELS.map((d) => (
          <div
            key={d}
            className="px-2 py-2 text-[10px] uppercase tracking-[0.06em] font-medium text-ink-3 text-center"
          >
            {d}
          </div>
        ))}
      </div>

      {/* 6 × 7 grid */}
      <div className="grid grid-cols-7">
        {grid.map((cell, i) => {
          const key = isoDay(cell.date);
          const dayEvents = byDay.get(key) ?? [];
          const visible = dayEvents.slice(0, 3);
          const overflow = dayEvents.length - visible.length;

          return (
            <div
              key={i}
              className={cn(
                'border-r border-b border-line-2 min-h-[92px] md:min-h-[116px] p-1.5 flex flex-col gap-1',
                (i + 1) % 7 === 0 && 'border-r-0',
                i >= 35 && 'border-b-0',
                !cell.isCurrentMonth && 'bg-bg/50',
              )}
            >
              <div className="flex items-center justify-between">
                <DayCellButton
                  dateIso={key}
                  ariaLabel={`Add on ${key}`}
                  className="px-1 py-0.5 -mx-0.5"
                >
                  <span
                    className={cn(
                      'text-[11px] font-medium leading-none',
                      cell.isCurrentMonth ? 'text-ink-2' : 'text-ink-4',
                      cell.isToday && 'text-accent',
                    )}
                  >
                    {cell.isToday ? (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-accent text-white text-[10px] font-medium">
                        {cell.date.getDate()}
                      </span>
                    ) : (
                      cell.date.getDate()
                    )}
                  </span>
                </DayCellButton>
                {dayEvents.length > 0 ? (
                  <span className="text-[9px] text-ink-3 leading-none">{dayEvents.length}</span>
                ) : null}
              </div>

              <div className="flex flex-col gap-0.5">
                {visible.map((e) => (
                  <EventChip key={e.id} event={e} />
                ))}
                {overflow > 0 ? (
                  <span className="text-[10px] text-ink-3 font-medium leading-tight px-1">
                    +{overflow} more
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
