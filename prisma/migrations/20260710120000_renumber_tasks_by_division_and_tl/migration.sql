-- Renumber every task under the new division / Timeline-File convention and
-- drop the "T-" prefix. Timeline File numbers themselves are left untouched.
--
--   division tasks : <ABBREVIATION>-<2-digit per-division seq>   e.g. SGM-01
--   PMU tasks      : <parent>_PMU-<2-digit seq>                   e.g. KI_PMU-01
--   TL-file tasks  : TL-<3-digit file seq>-<2-digit per-file seq> e.g. TL-005-01
--
-- The new format is intentionally NOT globally unique (TL-005-01 can recur
-- across years), so the global unique index on ref_number is dropped and
-- replaced with a plain lookup index. The row UUID stays the true key.

-- 1. Per-Timeline-File task counter, and relax the ref_number index.
ALTER TABLE "timeline_files" ADD COLUMN "task_seq" INTEGER NOT NULL DEFAULT 0;
DROP INDEX IF EXISTS "tasks_ref_number_key";
CREATE INDEX IF NOT EXISTS "tasks_ref_number_idx" ON "tasks"("ref_number");

-- 2. Division abbreviations for the new convention.
UPDATE divisions SET abbreviation = 'M&IT' WHERE name = 'Media & IT';

-- PMUs adopt <parent abbreviation>_PMU (run after the parent abbreviations above).
UPDATE divisions AS pmu
SET abbreviation = parent.abbreviation || '_PMU'
FROM divisions AS parent
WHERE pmu.kind = 'pmu'
  AND pmu.pmu_parent_division_id = parent.id
  AND parent.abbreviation <> '';

-- Safety net: any division still without an abbreviation gets one from its name.
UPDATE divisions
SET abbreviation = UPPER(LEFT(REGEXP_REPLACE(name, '[^A-Za-z0-9]', '', 'g'), 4))
WHERE abbreviation IS NULL OR abbreviation = '';

-- 3a. Tasks generated from a Timeline File → TL-<3-digit file seq>-<2-digit seq>,
--     per file, in creation order.
WITH tl_numbered AS (
  SELECT
    t.id,
    LPAD(RIGHT(tf.ref_seq::text, 3), 3, '0') AS tl_part,
    ROW_NUMBER() OVER (
      PARTITION BY t.linked_timeline_file_id
      ORDER BY t.created_at ASC, t.id ASC
    ) AS seq
  FROM tasks t
  JOIN timeline_files tf ON tf.id = t.linked_timeline_file_id
  WHERE t.linked_timeline_file_id IS NOT NULL
)
UPDATE tasks
SET ref_number = 'TL-' || tl_numbered.tl_part || '-' || LPAD(tl_numbered.seq::text, 2, '0')
FROM tl_numbered
WHERE tasks.id = tl_numbered.id;

-- 3b. Every other task → <ABBREVIATION>-<2-digit seq>, per division, in creation order.
WITH div_numbered AS (
  SELECT
    t.id,
    COALESCE(NULLIF(d.abbreviation, ''), 'GEN') AS prefix,
    ROW_NUMBER() OVER (
      PARTITION BY t.division_id
      ORDER BY t.created_at ASC, t.id ASC
    ) AS seq
  FROM tasks t
  JOIN divisions d ON d.id = t.division_id
  WHERE t.linked_timeline_file_id IS NULL
)
UPDATE tasks
SET ref_number = div_numbered.prefix || '-' || LPAD(div_numbered.seq::text, 2, '0')
FROM div_numbered
WHERE tasks.id = div_numbered.id;

-- 4a. Division counters = count of non-TL tasks per division (so new tasks continue).
UPDATE divisions SET task_seq = 0;
WITH div_counts AS (
  SELECT division_id, COUNT(*) AS total
  FROM tasks
  WHERE linked_timeline_file_id IS NULL
  GROUP BY division_id
)
UPDATE divisions
SET task_seq = div_counts.total
FROM div_counts
WHERE divisions.id = div_counts.division_id;

-- 4b. Timeline File counters = count of tasks generated from each file.
WITH tl_counts AS (
  SELECT linked_timeline_file_id AS tf_id, COUNT(*) AS total
  FROM tasks
  WHERE linked_timeline_file_id IS NOT NULL
  GROUP BY linked_timeline_file_id
)
UPDATE timeline_files
SET task_seq = tl_counts.total
FROM tl_counts
WHERE timeline_files.id = tl_counts.tf_id;
