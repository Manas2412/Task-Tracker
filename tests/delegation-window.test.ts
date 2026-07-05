import { describe, expect, it } from 'vitest';

import {
  isDelegationActive,
  MAX_DELEGATION_DAYS,
  validateDelegationWindow,
} from '@/lib/rbac/rules';

const d = (iso: string) => new Date(iso);

describe('isDelegationActive', () => {
  const window = {
    startsAt: d('2026-07-10T00:00:00+05:30'),
    endsAt: d('2026-07-20T23:59:59.999+05:30'),
    revokedAt: null as Date | null,
  };

  it('is inactive before the start', () => {
    expect(isDelegationActive(window, d('2026-07-09T23:59:59+05:30'))).toBe(false);
  });

  it('is active on the inclusive boundaries', () => {
    expect(isDelegationActive(window, window.startsAt)).toBe(true);
    expect(isDelegationActive(window, window.endsAt)).toBe(true);
  });

  it('is active in the middle of the window', () => {
    expect(isDelegationActive(window, d('2026-07-15T12:00:00+05:30'))).toBe(true);
  });

  it('expires automatically after the end date', () => {
    expect(isDelegationActive(window, d('2026-07-21T00:00:01+05:30'))).toBe(false);
  });

  it('a revocation wins over the window', () => {
    expect(
      isDelegationActive(
        { ...window, revokedAt: d('2026-07-12T10:00:00+05:30') },
        d('2026-07-15T12:00:00+05:30'),
      ),
    ).toBe(false);
  });
});

describe('validateDelegationWindow', () => {
  const now = d('2026-07-05T12:00:00+05:30');

  it('accepts a valid current window', () => {
    expect(
      validateDelegationWindow({
        startsAt: d('2026-07-05T00:00:00+05:30'),
        endsAt: d('2026-07-12T23:59:59.999+05:30'),
        now,
      }),
    ).toBeNull();
  });

  it('accepts a future window', () => {
    expect(
      validateDelegationWindow({
        startsAt: d('2026-08-01T00:00:00+05:30'),
        endsAt: d('2026-08-15T23:59:59.999+05:30'),
        now,
      }),
    ).toBeNull();
  });

  it('accepts a single-day window', () => {
    expect(
      validateDelegationWindow({
        startsAt: d('2026-07-06T00:00:00+05:30'),
        endsAt: d('2026-07-06T23:59:59.999+05:30'),
        now,
      }),
    ).toBeNull();
  });

  it('rejects invalid dates', () => {
    expect(
      validateDelegationWindow({ startsAt: new Date('nope'), endsAt: new Date('nope'), now }),
    ).toBe('Dates are invalid.');
  });

  it('rejects end before start', () => {
    expect(
      validateDelegationWindow({
        startsAt: d('2026-07-10T00:00:00+05:30'),
        endsAt: d('2026-07-09T23:59:59.999+05:30'),
        now,
      }),
    ).toBe('End date cannot be before the start date.');
  });

  it('rejects windows that already ended', () => {
    expect(
      validateDelegationWindow({
        startsAt: d('2026-06-01T00:00:00+05:30'),
        endsAt: d('2026-06-10T23:59:59.999+05:30'),
        now,
      }),
    ).toBe('End date cannot be in the past.');
  });

  it(`rejects windows longer than ${MAX_DELEGATION_DAYS} days`, () => {
    expect(
      validateDelegationWindow({
        startsAt: d('2026-07-05T00:00:00+05:30'),
        endsAt: d('2027-08-05T23:59:59.999+05:30'),
        now,
      }),
    ).toBe('Delegations can cover at most one year.');
  });
});
