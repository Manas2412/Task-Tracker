import { differenceInCalendarDays, format, isToday, isTomorrow, isYesterday } from 'date-fns';

/**
 * Initials extractor.
 *   "Ravi Kumar"  → "RK"
 *   "OSD"         → "OS"
 *   "Aditya N."   → "AN"
 *   "Karan V."    → "KV"
 */
export function initialsOf(name: string): string {
  const cleaned = name.trim().replace(/[().]/g, '');
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0][0] ?? '';
  const last = parts[parts.length - 1][0] ?? '';
  return (first + last).toUpperCase();
}

/**
 * Due-date formatter for task cards.
 * Sentence case, no exclamation marks.
 */
export type DueTone = 'today' | 'overdue' | 'soon' | 'future' | 'none';

export type DueDisplay = { label: string; tone: DueTone };

export function formatDue(due: Date | null | undefined, now: Date = new Date()): DueDisplay {
  if (!due) return { label: 'No due date', tone: 'none' };

  const diff = differenceInCalendarDays(due, now);
  const hasTime = due.getHours() !== 0 || due.getMinutes() !== 0;
  const timeSuffix = hasTime ? `, ${format(due, 'h:mm a').toLowerCase()}` : '';

  if (diff < 0) {
    const abs = Math.abs(diff);
    return {
      label: `Overdue ${abs} ${abs === 1 ? 'd' : 'd'}`,
      tone: 'overdue',
    };
  }
  if (isToday(due)) {
    return {
      label: `Today${timeSuffix}`,
      tone: 'today',
    };
  }
  if (isTomorrow(due)) return { label: `Tomorrow${timeSuffix}`, tone: 'soon' };
  if (isYesterday(due)) return { label: 'Yesterday', tone: 'overdue' };

  // Within the next 7 days → "Mon, 9 Jun"; further out → "9 Jun".
  if (diff > 0 && diff <= 7) {
    return { label: `${format(due, 'EEE, d LLL')}${timeSuffix}`, tone: 'soon' };
  }
  return { label: `${format(due, 'd LLL')}${timeSuffix}`, tone: 'future' };
}

/**
 * Deadline countdown for Timeline File pills.
 */
export function daysUntil(date: Date, now: Date = new Date()): number {
  return differenceInCalendarDays(date, now);
}

/**
 * IST offset — the app is India-only (Asia/Kolkata, UTC+05:30).
 */
export const IST_UTC_OFFSET = '+05:30';

/** Default time-of-day for a due date entered without a time: 4 pm IST. */
export const DEFAULT_DUE_TIME = '16:00';

/**
 * Parse a due-date form value into a Date.
 *
 * A date-only value (`YYYY-MM-DD`, from an `<input type="date">`) carries no
 * time. Left to `new Date()` it is read as 00:00 UTC, which renders as
 * 05:30 IST — so we default it to 16:00 IST (4 pm) instead. Values that
 * already include a time (`YYYY-MM-DDTHH:mm`, from a datetime-local input)
 * are interpreted in IST as entered. Anything already carrying a timezone or
 * seconds is passed straight to `new Date()`.
 */
export function parseDueDateInput(value: string): Date {
  const s = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T${DEFAULT_DUE_TIME}:00${IST_UTC_OFFSET}`);
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) {
    return new Date(`${s}:00${IST_UTC_OFFSET}`);
  }
  return new Date(s);
}
