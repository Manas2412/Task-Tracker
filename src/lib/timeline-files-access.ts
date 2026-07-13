/**
 * Timeline Files — the pure access rule for the module.
 *
 * Kept free of any server-only import (no prisma) so both client components
 * (nav gating) and the server data layer (`buildTfVisibilityClause` in
 * src/lib/timeline-files.ts) share one source of truth — the same split as
 * document-centre-shared.ts (pure) vs document-centre.ts (db-backed).
 */

/**
 * Hierarchy slots barred from the Timeline Files module entirely — they never
 * see a Timeline File in any list, detail, count, calendar deadline, search
 * result, or attachment, and the nav link is hidden for them.
 *
 * `consultant` (the PMU Consultant slot) is excluded by product decision: TL
 * files are internal ministry correspondence and are hidden from consultants.
 * Oversight roles (OSD / JS / Super Admin) and ordinary officers are unaffected.
 */
export const TIMELINE_FILES_HIDDEN_SLOTS: readonly string[] = ['consultant'];

/** Whether a hierarchy slot may access the Timeline Files module at all. */
export function canAccessTimelineFiles(hierarchySlot: string): boolean {
  return !TIMELINE_FILES_HIDDEN_SLOTS.includes(hierarchySlot);
}
