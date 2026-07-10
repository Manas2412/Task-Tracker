import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';

/**
 * Task reference-number convention (no "T-" prefix):
 *
 *   - A task generated from a Timeline File is numbered
 *     `TL-<last 3 digits of the file number>-<2-digit per-file sequence>`,
 *     e.g. file TF-2026/005 → TL-005-01, TL-005-02. A one-digit file number
 *     (4) still pads to three digits → TL-004-01.
 *   - Every other task is numbered `<DIVISION_ABBREVIATION>-<2-digit
 *     per-division sequence>`, e.g. SGM-01, KI-01, M&IT-01, KI_PMU-01 (PMUs
 *     carry a `<parent>_PMU` abbreviation).
 *
 * Each sequence is independent and gap-free: division tasks advance the
 * division's counter, Timeline-File tasks advance that file's counter. The
 * counters are the source of truth so the sequence keeps climbing as tasks
 * are created; the migration seeds them from existing rows (by creation
 * order). These numbers are NOT globally unique — `TL-005-01` can recur across
 * years — so `Task.refNumber` is a plain index, not a unique constraint; the
 * row UUID remains the true key.
 */

/** Last 3 digits of a Timeline File's sequence, zero-padded (4 → "004", 1005 → "005"). */
export function tlSeqDigits(refSeq: number): string {
  return String(Math.abs(Math.trunc(refSeq))).padStart(3, '0').slice(-3);
}

/** Two-digit (minimum) zero-padded sequence: 1 → "01", 100 → "100". */
export function padTaskSeq(seq: number): string {
  return String(seq).padStart(2, '0');
}

/** `<ABBREVIATION>-<2-digit seq>`, falling back to GEN when the abbreviation is empty. */
export function divisionRefNumber(abbreviation: string, seq: number): string {
  return `${abbreviation || 'GEN'}-${padTaskSeq(seq)}`;
}

/** `TL-<3-digit file seq>-<2-digit seq>`. */
export function timelineTaskRefNumber(refSeq: number, seq: number): string {
  return `TL-${tlSeqDigits(refSeq)}-${padTaskSeq(seq)}`;
}

/**
 * Reserve and return the next reference number for a task, atomically bumping
 * the relevant counter inside the caller's transaction. Pass
 * `linkedTimelineFileId` for a task generated from a Timeline File.
 */
export async function nextTaskRefNumber(
  opts: { divisionId: string; linkedTimelineFileId?: string | null },
  tx: Prisma.TransactionClient = prisma,
): Promise<string> {
  if (opts.linkedTimelineFileId) {
    const tf = await tx.timelineFile.update({
      where: { id: opts.linkedTimelineFileId },
      data: { taskSeq: { increment: 1 } },
      select: { refSeq: true, taskSeq: true },
    });
    return timelineTaskRefNumber(tf.refSeq, tf.taskSeq);
  }
  const div = await tx.division.update({
    where: { id: opts.divisionId },
    data: { taskSeq: { increment: 1 } },
    select: { abbreviation: true, taskSeq: true },
  });
  return divisionRefNumber(div.abbreviation, div.taskSeq);
}
