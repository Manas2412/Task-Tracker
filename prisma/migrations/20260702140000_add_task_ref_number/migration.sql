-- Add abbreviation and task sequence counter to divisions
ALTER TABLE "divisions" ADD COLUMN "abbreviation" TEXT NOT NULL DEFAULT '';
ALTER TABLE "divisions" ADD COLUMN "task_seq" INTEGER NOT NULL DEFAULT 0;

-- Add human-readable ref number to tasks
ALTER TABLE "tasks" ADD COLUMN "ref_number" TEXT;

-- Unique index on ref_number (nullable, only enforced on non-null)
CREATE UNIQUE INDEX "tasks_ref_number_key" ON "tasks"("ref_number");
