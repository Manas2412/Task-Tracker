-- Subtask reference numbers become parent-relative: <parent ref>-<2-digit seq>,
-- e.g. OJS-28 -> OJS-28-01, OJS-28-02 (and TL-005-01 -> TL-005-01-01). Subtasks
-- therefore stop consuming the division / Timeline-File sequence, so:
--
--   * top-level DIVISION tasks are re-sequenced contiguously (their numbers change);
--   * top-level Timeline-File task numbers are left unchanged (only their subtasks
--     are reformatted).
--
-- Numbers are not globally unique (the row UUID stays the true key), so the
-- new three-part form is a plain lookup value, matching the existing index.
-- Subtask numbering is depth-safe: a grandchild (should any exist) is numbered
-- off its parent's already-final number, e.g. OJS-05-01-01.

-- 1. Per-parent subtask counter (0 on tasks with no subtasks).
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "subtask_seq" INTEGER NOT NULL DEFAULT 0;

-- 2. Re-sequence top-level DIVISION tasks (no parent, not Timeline-File-linked)
--    → <ABBREVIATION>-<2-digit seq>, per division, in creation order. With
--    subtasks excluded the sequence is now gap-free over parents only.
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
  WHERE t.parent_task_id IS NULL
    AND t.linked_timeline_file_id IS NULL
)
UPDATE tasks
SET ref_number = div_numbered.prefix || '-' || LPAD(div_numbered.seq::text, 2, '0')
FROM div_numbered
WHERE tasks.id = div_numbered.id;

-- 3. Number SUBTASKS relative to their parent → <parent ref>-<2-digit seq>, per
--    parent, in creation order. A recursive walk numbers each generation off its
--    parent's already-final number, so any nesting depth stays consistent
--    (a grandchild becomes <parent ref>-NN-MM). Covers division- and
--    Timeline-File-parented subtasks alike. A NULL-numbered top-level parent
--    (unseeded dev data only) propagates NULL down its subtree.
WITH RECURSIVE child_rank AS (
  SELECT
    s.id,
    s.parent_task_id,
    ROW_NUMBER() OVER (
      PARTITION BY s.parent_task_id
      ORDER BY s.created_at ASC, s.id ASC
    ) AS rn
  FROM tasks s
  WHERE s.parent_task_id IS NOT NULL
),
new_refs AS (
  -- Anchor: top-level tasks already carry their final number (division tasks
  -- from step 2; Timeline-File tasks unchanged).
  SELECT t.id, t.ref_number AS new_ref
  FROM tasks t
  WHERE t.parent_task_id IS NULL
  UNION ALL
  -- Recurse: a subtask's number is its parent's final number + its per-parent seq.
  SELECT cr.id, nr.new_ref || '-' || LPAD(cr.rn::text, 2, '0')
  FROM child_rank cr
  JOIN new_refs nr ON nr.id = cr.parent_task_id
)
UPDATE tasks
SET ref_number = new_refs.new_ref
FROM new_refs
WHERE tasks.id = new_refs.id
  AND tasks.parent_task_id IS NOT NULL;

-- 4a. Division counters = number of TOP-LEVEL division tasks, so new division
--     tasks continue the clean sequence (subtasks no longer advance it).
UPDATE divisions
SET task_seq = COALESCE((
  SELECT COUNT(*)
  FROM tasks t
  WHERE t.division_id = divisions.id
    AND t.parent_task_id IS NULL
    AND t.linked_timeline_file_id IS NULL
), 0);

-- 4b. Each parent's subtask counter = number of its direct subtasks, so the
--     next subtask continues from there.
UPDATE tasks
SET subtask_seq = COALESCE((
  SELECT COUNT(*) FROM tasks s WHERE s.parent_task_id = tasks.id
), 0);

-- Timeline-File counters (timeline_files.task_seq) are intentionally left as-is:
-- top-level Timeline-File task numbers are unchanged and the counter already sits
-- above them, so new Timeline-File tasks continue without colliding.
