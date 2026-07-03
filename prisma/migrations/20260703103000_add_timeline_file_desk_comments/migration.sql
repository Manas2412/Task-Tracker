-- Desk-level note field on timeline files, distinct from the Secretary's
-- formal quote. Nullable; no backfill required.
ALTER TABLE "timeline_files" ADD COLUMN "desk_comments" TEXT;
