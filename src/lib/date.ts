const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Current instant shifted to IST for date-boundary arithmetic.
 *
 * The server runs UTC. When we compute "start of today" with
 * `setHours(0,0,0,0)` on a plain `new Date()`, midnight lands at
 * 00:00 UTC — which is 05:30 IST, clipping ~5.5 hours from every
 * Indian business day. This helper returns a Date whose UTC fields
 * read as IST wall-clock, so `setHours(0)` gives IST midnight.
 *
 * Use for day-boundary checks (due today, overdue, calendar grid).
 * Do NOT use for timestamps stored in the DB — those stay as UTC.
 */
export function nowIST(): Date {
  return new Date(Date.now() + IST_OFFSET_MS);
}

export function startOfDayIST(d?: Date): Date {
  const shifted = d ? new Date(d.getTime() + IST_OFFSET_MS) : nowIST();
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - IST_OFFSET_MS);
}

export function endOfDayIST(d?: Date): Date {
  const shifted = d ? new Date(d.getTime() + IST_OFFSET_MS) : nowIST();
  shifted.setUTCHours(23, 59, 59, 999);
  return new Date(shifted.getTime() - IST_OFFSET_MS);
}

export function isoDay(d: Date): string {
  const shifted = new Date(d.getTime() + IST_OFFSET_MS);
  return shifted.toISOString().slice(0, 10);
}

/**
 * Combine an IST wall-clock date (`YYYY-MM-DD`) and time (`HH:mm`) into the
 * UTC instant to store. India has a fixed +05:30 offset (no DST), so the
 * offset suffix parse is exact. Returns null on malformed input.
 */
export function istWallClockToUtc(dateStr: string, timeStr: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !/^\d{2}:\d{2}$/.test(timeStr)) return null;
  const d = new Date(`${dateStr}T${timeStr}:00.000+05:30`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** IST wall-clock time of a stored instant as `HH:mm`, for a `<input type="time">`. */
export function istTimeInput(d: Date): string {
  const shifted = new Date(d.getTime() + IST_OFFSET_MS);
  return `${String(shifted.getUTCHours()).padStart(2, '0')}:${String(
    shifted.getUTCMinutes(),
  ).padStart(2, '0')}`;
}

/** Format a stored UTC instant as an IST clock time, e.g. "2:30 pm". */
export function formatTimeIST(d: Date): string {
  const shifted = new Date(d.getTime() + IST_OFFSET_MS);
  let h = shifted.getUTCHours();
  const m = shifted.getUTCMinutes();
  const meridiem = h < 12 ? 'am' : 'pm';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')} ${meridiem}`;
}

/**
 * Whole-day difference between two instants by IST calendar day:
 * `istDayDiff(due, now)` is +1 when `due` is tomorrow (IST), -2 when it was
 * two days ago, etc. Timezone-explicit, so it agrees on server and client.
 */
export function istDayDiff(a: Date, b: Date): number {
  const da = Date.parse(`${isoDay(a)}T00:00:00Z`);
  const db = Date.parse(`${isoDay(b)}T00:00:00Z`);
  return Math.round((da - db) / (24 * 60 * 60 * 1000));
}

/**
 * Format a stored UTC instant as its IST calendar date — "9 Jun", or
 * "Mon, 9 Jun" with the weekday. Uses the Asia/Kolkata time zone explicitly
 * (not the ambient one), so server and client render the same day.
 */
export function formatDateIST(d: Date, withWeekday = false): string {
  const date = d.toLocaleDateString('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
  });
  if (!withWeekday) return date;
  const weekday = d.toLocaleDateString('en-GB', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
  });
  return `${weekday}, ${date}`;
}

/** Full IST date + clock time, e.g. "9 Jun 2026, 4:00 pm". */
export function formatDateTimeIST(d: Date): string {
  const date = d.toLocaleDateString('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `${date}, ${formatTimeIST(d)}`;
}
