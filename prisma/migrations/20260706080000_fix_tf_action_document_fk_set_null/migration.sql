-- Fix H-7: TF with action document can never be hard-deleted.
-- Change the FK from NoAction to SetNull so deleting the attachment
-- nullifies the reference instead of raising a FK violation.
ALTER TABLE "timeline_files" DROP CONSTRAINT IF EXISTS "timeline_files_action_document_attachment_id_fkey";
ALTER TABLE "timeline_files"
  ADD CONSTRAINT "timeline_files_action_document_attachment_id_fkey"
  FOREIGN KEY ("action_document_attachment_id")
  REFERENCES "attachments"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
