import { describe, expect, it } from 'vitest';

import { isMediaAndIt } from '@/lib/divisions';

/**
 * In the "Group by division" views Media & IT sorts below every other
 * division, so the matcher must recognise the seeded name regardless of
 * spacing, case, or "&" vs "and".
 */
describe('isMediaAndIt', () => {
  it('matches the seeded name and its common variants', () => {
    expect(isMediaAndIt('Media & IT')).toBe(true);
    expect(isMediaAndIt('media and it')).toBe(true);
    expect(isMediaAndIt('  Media  &  IT  ')).toBe(true);
    expect(isMediaAndIt('MEDIA AND IT')).toBe(true);
  });

  it('does not match other divisions', () => {
    expect(isMediaAndIt('Khelo India Division')).toBe(false);
    expect(isMediaAndIt('Autonomous Bodies')).toBe(false);
    expect(isMediaAndIt('IT')).toBe(false);
    expect(isMediaAndIt('Media')).toBe(false);
  });
});
