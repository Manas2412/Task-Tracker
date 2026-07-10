-- Adds `last_activity_at` to tasks and timeline_files: the timestamp of the
-- last MEANINGFUL activity, used by the "Recently modified" list sort.
--
-- "Meaningful" = creation, comments/discussions, subtask creation, file
-- uploads, tag/collaborator/marked-to changes, and owner/status/priority/
-- context edits. It is NEVER advanced by passive reads (the task_read /
-- subtask_read activity events) — those keep a task exactly where it sits.
--
-- Kept separate from tasks.updated_at (Prisma @updatedAt, shown as "Last
-- edited"): last_activity_at also advances on cross-table events (comments,
-- attachments) that never touch the task/file row itself.

-- 1. Columns. DEFAULT now() populates every existing row up front; the
--    backfill below then corrects each to its true historical value.
ALTER TABLE "tasks"          ADD COLUMN "last_activity_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now();
ALTER TABLE "timeline_files" ADD COLUMN "last_activity_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now();

-- 2. Backfill tasks: the latest of the row's own creation, its most recent
--    non-passive activity event, its most recent comment, and its most recent
--    attachment upload. Subtask events are logged on the parent's task_id, so
--    the activity term already captures subtask add/toggle/update.
UPDATE "tasks" t
SET "last_activity_at" = GREATEST(
  t."created_at",
  COALESCE((
    SELECT MAX(a."created_at") FROM "task_activity" a
    WHERE a."task_id" = t."id"
      AND a."event_type" NOT IN ('task_read', 'subtask_read')
  ), t."created_at"),
  COALESCE((
    SELECT MAX(c."created_at") FROM "task_comments" c
    WHERE c."task_id" = t."id"
  ), t."created_at"),
  COALESCE((
    SELECT MAX(att."uploaded_at") FROM "attachments" att
    WHERE att."owner_type" = 'task' AND att."owner_id" = t."id"
  ), t."created_at")
);

-- 3. Backfill timeline files: creation, latest activity (TF activity has no
--    passive read events), latest comment, and latest document upload across
--    all three TF attachment scopes.
UPDATE "timeline_files" tf
SET "last_activity_at" = GREATEST(
  tf."created_at",
  COALESCE((
    SELECT MAX(a."created_at") FROM "timeline_file_activity" a
    WHERE a."timeline_file_id" = tf."id"
  ), tf."created_at"),
  COALESCE((
    SELECT MAX(c."created_at") FROM "timeline_file_comments" c
    WHERE c."timeline_file_id" = tf."id"
  ), tf."created_at"),
  COALESCE((
    SELECT MAX(att."uploaded_at") FROM "attachments" att
    WHERE att."owner_type" IN ('timeline_file', 'timeline_file_source', 'timeline_file_action')
      AND att."owner_id" = tf."id"
  ), tf."created_at")
);

-- 4. Indexes backing the ORDER BY last_activity_at DESC list sort.
CREATE INDEX "tasks_last_activity_at_idx" ON "tasks"("last_activity_at");
CREATE INDEX "timeline_files_last_activity_at_idx" ON "timeline_files"("last_activity_at");
