-- Document Centre — the executive records workspace.
--
-- `document_records` mirrors the Task/TimelineFile shape (urgency replaces
-- priority; status carries the open/completed lifecycle; two workflow flags).
-- `document_comments` is the discussion thread, identical in shape to
-- `timeline_file_comments`. Attachments + Drive links reuse the polymorphic
-- `attachments` table (ownerType 'document_record', added in the previous
-- migration), so no join table is needed here.

-- CreateEnum
CREATE TYPE "DocumentUrgency" AS ENUM ('highly_urgent', 'urgent', 'normal');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('open', 'completed');

-- CreateTable
CREATE TABLE "document_records" (
    "id" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "context" TEXT,
    "urgency" "DocumentUrgency" NOT NULL DEFAULT 'normal',
    "status" "DocumentStatus" NOT NULL DEFAULT 'open',
    "marked_for_review" BOOLEAN NOT NULL DEFAULT false,
    "awaiting_input" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "last_activity_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMPTZ(6),
    "archived_by" UUID,

    CONSTRAINT "document_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_comments" (
    "id" UUID NOT NULL,
    "document_record_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "mentions" UUID[] DEFAULT ARRAY[]::UUID[],
    "parent_comment_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at" TIMESTAMPTZ(6),

    CONSTRAINT "document_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_records_created_by_idx" ON "document_records"("created_by");

-- CreateIndex
CREATE INDEX "document_records_status_idx" ON "document_records"("status");

-- CreateIndex
CREATE INDEX "document_records_urgency_idx" ON "document_records"("urgency");

-- CreateIndex
CREATE INDEX "document_records_last_activity_at_idx" ON "document_records"("last_activity_at");

-- CreateIndex
CREATE INDEX "document_records_created_at_idx" ON "document_records"("created_at" DESC);

-- CreateIndex
CREATE INDEX "document_comments_document_record_id_created_at_idx" ON "document_comments"("document_record_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "document_comments_parent_comment_id_idx" ON "document_comments"("parent_comment_id");

-- AddForeignKey
ALTER TABLE "document_records" ADD CONSTRAINT "document_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "document_records" ADD CONSTRAINT "document_records_archived_by_fkey" FOREIGN KEY ("archived_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_document_record_id_fkey" FOREIGN KEY ("document_record_id") REFERENCES "document_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "document_comments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
