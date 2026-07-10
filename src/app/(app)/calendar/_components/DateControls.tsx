'use client';

import { formatDayLong } from '@/lib/date';
import { cn } from '@/lib/utils';

import { useCalendar } from './CalendarProvider';

/** Today's date in IST as YYYY-MM-DD (en-CA renders ISO order). */
function todayIsoIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/**
 * Wraps a month/week day cell in a button that opens the day sheet — that
 * day's agenda plus the "Create new" actions. Every signed-in user can at
 * least create a task, so the whole grid is actionable.
 */
export function DayCellButton({
  dateIso,
  ariaLabel,
  className,
  children,
}: {
  dateIso: string;
  ariaLabel: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { openDay } = useCalendar();
  return (
    <button
      type="button"
      onClick={() => openDay(dateIso)}
      aria-label={ariaLabel}
      className={cn('rounded-md hover:bg-line-2 transition-colors', className)}
    >
      {children}
    </button>
  );
}

/** Header "New" button — opens the create actions for today. */
export function NewButton() {
  const { openDay } = useCalendar();
  return (
    <button
      type="button"
      onClick={() => openDay(todayIsoIST(), true)}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-ink text-white text-[13px] font-medium hover:bg-ink-2 transition-colors"
    >
      <i className="ti ti-plus text-[15px]" aria-hidden="true" />
      New
    </button>
  );
}

/**
 * A small "+" quick-add affordance next to a list-view day heading. The day's
 * agenda is already listed under the heading, so this opens straight to the
 * "Create new" actions rather than repeating the agenda.
 */
export function AddOnDayButton({ dateIso }: { dateIso: string }) {
  const { openDay } = useCalendar();
  return (
    <button
      type="button"
      onClick={() => openDay(dateIso, true)}
      aria-label={`Add to ${formatDayLong(dateIso)}`}
      className="w-6 h-6 grid place-items-center rounded-md text-ink-3 hover:text-ink hover:bg-line-2 transition-colors"
    >
      <i className="ti ti-plus text-[15px]" aria-hidden="true" />
    </button>
  );
}

/** "+N more" affordance in a month cell — opens the day sheet to see them all. */
export function MoreOnDayButton({ dateIso, count }: { dateIso: string; count: number }) {
  const { openDay } = useCalendar();
  return (
    <button
      type="button"
      onClick={() => openDay(dateIso)}
      aria-label={`Open ${formatDayLong(dateIso)}, ${count} more ${count === 1 ? 'item' : 'items'}`}
      className="w-fit text-[10px] text-ink-3 hover:text-ink font-medium leading-tight px-1 py-1 -my-0.5 -mx-0.5 rounded hover:bg-line-2 transition-colors text-left"
    >
      +{count} more
    </button>
  );
}
