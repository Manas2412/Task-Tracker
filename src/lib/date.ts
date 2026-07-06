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
