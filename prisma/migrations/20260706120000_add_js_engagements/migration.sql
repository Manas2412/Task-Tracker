-- JS Engagements: Office-of-JS meetings shown on the calendar. Managed by
-- and visible to Office-of-JS members and Super Admins only. Attachments
-- reuse the polymorphic attachments table via a new owner type.

-- New owner type for engagement attachments. Safe to add in-transaction on
-- PostgreSQL 12+ because the value is not used within this migration.
ALTER TYPE "AttachmentOwnerType" ADD VALUE IF NOT EXISTS 'js_engagement';

-- CreateTable
CREATE TABLE "js_engagements" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "venue" TEXT,
    "mom_notes" TEXT,
    "division_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "js_engagements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "js_engagement_participants" (
    "engagement_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "js_engagement_participants_pkey" PRIMARY KEY ("engagement_id","user_id")
);

-- CreateIndex
CREATE INDEX "js_engagements_starts_at_idx" ON "js_engagements"("starts_at");

-- CreateIndex
CREATE INDEX "js_engagements_division_id_idx" ON "js_engagements"("division_id");

-- CreateIndex
CREATE INDEX "js_engagement_participants_user_id_idx" ON "js_engagement_participants"("user_id");

-- AddForeignKey
ALTER TABLE "js_engagements" ADD CONSTRAINT "js_engagements_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "divisions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "js_engagements" ADD CONSTRAINT "js_engagements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "js_engagement_participants" ADD CONSTRAINT "js_engagement_participants_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "js_engagements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "js_engagement_participants" ADD CONSTRAINT "js_engagement_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
