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
