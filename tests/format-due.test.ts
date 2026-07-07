import { describe, expect, it } from 'vitest';

import { formatDue } from '@/lib/format';

/**
 * formatDue must render deadlines in IST explicitly, so a task card rendered
 * on the server (UTC) reads the same clock time as the detail rendered in the
 * browser. A 4 pm IST deadline is stored as 10:30 UTC; the card must never
 * show "10:30 am". These assertions hold regardless of the runtime time zone.
 */
describe('formatDue — IST-explicit deadline display', () => {
  it('renders a 4 pm IST deadline as 4:00 pm, not the underlying 10:30 UTC', () => {
    const due = new Date('2026-06-09T16:00:00+05:30'); // 10:30 UTC
    const now = new Date('2026-06-09T09:00:00+05:30');
    const { label, tone } = formatDue(due, now);
    expect(label).toBe('Today, 4:00 pm');
    expect(tone).toBe('today');
  });

  it('shows no clock time for a date-only (midnight IST) deadline', () => {
    const due = new Date('2026-06-11T00:00:00+05:30');
    const now = new Date('2026-06-09T09:00:00+05:30');
    expect(formatDue(due, now).label).not.toMatch(/am|pm/);
  });

  it('counts the day by the IST calendar (tomorrow, across the UTC boundary)', () => {
    // 11 pm IST on the 9th vs a 4 pm deadline on the 10th — one IST day apart,
    // even though both instants straddle midnight UTC.
    const due = new Date('2026-06-10T16:00:00+05:30');
    const now = new Date('2026-06-09T23:00:00+05:30');
    expect(formatDue(due, now).label).toBe('Tomorrow, 4:00 pm');
  });

  it('is overdue by IST calendar day', () => {
    const due = new Date('2026-06-07T16:00:00+05:30');
    const now = new Date('2026-06-09T09:00:00+05:30');
    const { label, tone } = formatDue(due, now);
    expect(tone).toBe('overdue');
    expect(label).toBe('Overdue 2 d');
  });
});
