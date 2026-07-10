import { describe, expect, it } from 'vitest';

import {
  divisionRefNumber,
  padTaskSeq,
  timelineTaskRefNumber,
  tlSeqDigits,
} from '@/lib/task-ref';

/**
 * Task numbering: division tasks are <ABBR>-NN, Timeline-File tasks are
 * TL-<3 digit file seq>-NN. A one-digit file number must still pad to three
 * digits (4 → 004), and only the last three digits of larger numbers are used.
 */
describe('task ref-number formatting', () => {
  it('takes the last 3 digits of the file number, zero-padded', () => {
    expect(tlSeqDigits(4)).toBe('004');
    expect(tlSeqDigits(5)).toBe('005');
    expect(tlSeqDigits(34)).toBe('034');
    expect(tlSeqDigits(123)).toBe('123');
    expect(tlSeqDigits(1005)).toBe('005');
  });

  it('pads the sequence to at least two digits', () => {
    expect(padTaskSeq(1)).toBe('01');
    expect(padTaskSeq(9)).toBe('09');
    expect(padTaskSeq(10)).toBe('10');
    expect(padTaskSeq(100)).toBe('100');
  });

  it('formats a division task number', () => {
    expect(divisionRefNumber('SGM', 1)).toBe('SGM-01');
    expect(divisionRefNumber('M&IT', 1)).toBe('M&IT-01');
    expect(divisionRefNumber('KI_PMU', 2)).toBe('KI_PMU-02');
    expect(divisionRefNumber('', 3)).toBe('GEN-03');
  });

  it('formats a timeline-file task number', () => {
    expect(timelineTaskRefNumber(5, 1)).toBe('TL-005-01');
    expect(timelineTaskRefNumber(5, 2)).toBe('TL-005-02');
    expect(timelineTaskRefNumber(4, 1)).toBe('TL-004-01');
  });
});
