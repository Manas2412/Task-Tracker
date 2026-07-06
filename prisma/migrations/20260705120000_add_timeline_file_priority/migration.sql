-- Priority marker on timeline files, reusing the existing TaskPriority enum
-- so the tag is consistent with tasks across the platform. Existing rows
-- backfill to 'medium' (a neutral default for correspondence).
ALTER TABLE "timeline_files" ADD COLUMN "priority" "TaskPriority" NOT NULL DEFAULT 'medium';
