-- Document Centre — enum additions.
--
-- Adds the new polymorphic attachment owner type and the Document Centre
-- notification types. Kept in its own migration (no table DDL) so the new
-- enum values are committed before any later migration or runtime code uses
-- them — Postgres forbids using a freshly-added enum value in the same
-- transaction that added it.

-- AlterEnum: attachments can now belong to a document record.
ALTER TYPE "AttachmentOwnerType" ADD VALUE IF NOT EXISTS 'document_record';

-- AlterEnum: Document Centre notification types. `mention` is reused as-is
-- (its payload gains a documentId branch), so it is not added here.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'document_record_created';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'document_discussion';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'document_review_requested';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'document_review_completed';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'document_awaiting_input';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'document_attachment_added';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'document_drive_link_added';
