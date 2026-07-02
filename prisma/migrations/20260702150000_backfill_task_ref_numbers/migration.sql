-- Backfill: set division abbreviations, assign ref numbers to all existing
-- tasks, and update each division's task_seq counter.
--
-- Safe to run on any database state — skips divisions that already have an
-- abbreviation, skips tasks that already have a ref_number.

-- Step 1: Set known division abbreviations (prod + dev).
UPDATE divisions SET abbreviation = 'OJS'  WHERE name = 'Office of JS'      AND abbreviation = '';
UPDATE divisions SET abbreviation = 'KI'   WHERE name = 'Khelo India'       AND abbreviation = '';
UPDATE divisions SET abbreviation = 'NSDF' WHERE name = 'NSDF'              AND abbreviation = '';
UPDATE divisions SET abbreviation = 'SGM'  WHERE name = 'SGM'               AND abbreviation = '';
UPDATE divisions SET abbreviation = 'MED'  WHERE name = 'Media & IT'        AND abbreviation = '';
UPDATE divisions SET abbreviation = 'ABD'  WHERE name = 'Autonomous Bodies'  AND abbreviation = '';

-- Step 1b: Any remaining divisions without abbreviation get an auto-generated
-- one from the first 4 uppercase characters of their name.
UPDATE divisions
SET abbreviation = UPPER(LEFT(REGEXP_REPLACE(name, '[^A-Za-z0-9]', '', 'g'), 4))
WHERE abbreviation = '';

-- Step 2: Assign sequential ref numbers per division, ordered by created_at.
WITH numbered AS (
  SELECT
    t.id,
    d.abbreviation AS prefix,
    ROW_NUMBER() OVER (PARTITION BY t.division_id ORDER BY t.created_at ASC, t.id ASC) AS seq
  FROM tasks t
  JOIN divisions d ON d.id = t.division_id
  WHERE t.ref_number IS NULL
)
UPDATE tasks
SET ref_number = 'T-' || numbered.prefix || numbered.seq
FROM numbered
WHERE tasks.id = numbered.id;

-- Step 3: Update each division's task_seq counter to the max sequence used,
-- so the next task created gets the correct next number.
WITH max_seq AS (
  SELECT
    division_id,
    COUNT(*) AS total
  FROM tasks
  WHERE ref_number IS NOT NULL
  GROUP BY division_id
)
UPDATE divisions
SET task_seq = max_seq.total
FROM max_seq
WHERE divisions.id = max_seq.division_id
  AND divisions.task_seq < max_seq.total;
