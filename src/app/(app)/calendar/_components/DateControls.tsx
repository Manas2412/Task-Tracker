'use client';

import { cn } from '@/lib/utils';

import { useCalendar } from './CalendarProvider';

/** Today's date in IST as YYYY-MM-DD (en-CA renders ISO order). */
function todayIsoIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/**
 * Wraps a month/week day number in a button that opens the "add to this
 * date" menu. Falls back to a plain span if the caller is read-only would
 * be handled upstream — here every signed-in user can at least create a
 * task, so the whole grid is actionable.
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
  const { openDateMenu } = useCalendar();
  return (
    <button
      type="button"
      onClick={() => openDateMenu(dateIso)}
      aria-label={ariaLabel}
      className={cn('rounded-md hover:bg-line-2 transition-colors', className)}
    >
      {children}
    </button>
  );
}

/** Header "New" button — opens the add menu for today. */
export function NewButton() {
  const { openDateMenu } = useCalendar();
  return (
    <button
      type="button"
      onClick={() => openDateMenu(todayIsoIST())}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-ink text-white text-[13px] font-medium hover:bg-ink-2 transition-colors"
    >
      <i className="ti ti-plus text-[15px]" aria-hidden="true" />
      New
    </button>
  );
}

/** A small "+" affordance next to a list-view day heading. */
export function AddOnDayButton({ dateIso }: { dateIso: string }) {
  const { openDateMenu } = useCalendar();
  return (
    <button
      type="button"
      onClick={() => openDateMenu(dateIso)}
      aria-label="Add on this day"
      className="w-6 h-6 grid place-items-center rounded-md text-ink-3 hover:text-ink hover:bg-line-2 transition-colors"
    >
      <i className="ti ti-plus text-[15px]" aria-hidden="true" />
    </button>
  );
}
