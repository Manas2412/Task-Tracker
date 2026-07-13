-- Add two hierarchy slots:
--   * hmyas      — top of the ladder (Hon'ble Minister / HMYAS).
--   * consultant — an unranked support role (no fixed rank).
--
-- Ranking is driven by HIERARCHY_SLOT_LEVEL in src/lib/labels.ts, not the
-- enum's internal order, so a plain append is correct. Neither value is used
-- in this migration, so adding both in one transaction is safe on PG12+.
ALTER TYPE "HierarchySlot" ADD VALUE IF NOT EXISTS 'consultant';
ALTER TYPE "HierarchySlot" ADD VALUE IF NOT EXISTS 'hmyas';
