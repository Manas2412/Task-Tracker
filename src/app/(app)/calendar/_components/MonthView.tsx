import { formatDayLong } from '@/lib/date';
import { cn } from '@/lib/utils';

import type { CalendarEvent, MonthDay } from '@/lib/calendar';
import { isoDay } from '@/lib/calendar';
import { DayCellButton, MoreOnDayButton } from './DateControls';
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
            <span className="hidden sm:inline">{d}</span>
            <span className="sm:hidden">{d.slice(0, 2)}</span>
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
          const count = dayEvents.length;

          return (
            <div
              key={i}
              className={cn(
                'border-r border-b border-line-2 min-h-[104px] md:min-h-[132px] p-1 md:p-1.5 flex flex-col gap-1',
                (i + 1) % 7 === 0 && 'border-r-0',
                i >= 35 && 'border-b-0',
                !cell.isCurrentMonth && 'bg-bg/50',
              )}
            >
              {/* Whole header row is the day-sheet trigger — a generous tap target. */}
              <DayCellButton
                dateIso={key}
                ariaLabel={
                  count > 0
                    ? `Open ${formatDayLong(key)}, ${count} ${count === 1 ? 'item' : 'items'}`
                    : `Open ${formatDayLong(key)}`
                }
                className="flex items-center justify-between gap-0.5 px-0.5 md:px-1 py-1"
              >
                {cell.isToday ? (
                  <span className="inline-flex items-center justify-center w-7 h-7 md:w-9 md:h-9 rounded-full bg-accent text-onink text-[15px] md:text-[18px] font-medium leading-none tabular-nums shrink-0">
                    {cell.date.getDate()}
                  </span>
                ) : (
                  <span
                    className={cn(
                      'text-[16px] md:text-[19px] font-medium leading-none tabular-nums',
                      cell.isCurrentMonth ? 'text-ink' : 'text-ink-4',
                    )}
                  >
                    {cell.date.getDate()}
                  </span>
                )}
                {count > 0 ? (
                  <span className="text-[10px] md:text-[11px] text-ink-3 font-medium leading-none tabular-nums shrink-0">
                    {count}
                  </span>
                ) : null}
              </DayCellButton>

              <div className="flex flex-col gap-0.5">
                {visible.map((e) => (
                  <EventChip key={e.id} event={e} />
                ))}
                {overflow > 0 ? <MoreOnDayButton dateIso={key} count={overflow} /> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
