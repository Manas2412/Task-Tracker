-- CreateTable
CREATE TABLE "timeline_file_comments" (
    "id" UUID NOT NULL,
    "timeline_file_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "mentions" UUID[] DEFAULT ARRAY[]::UUID[],
    "parent_comment_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at" TIMESTAMPTZ(6),

    CONSTRAINT "timeline_file_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "timeline_file_comments_timeline_file_id_created_at_idx" ON "timeline_file_comments"("timeline_file_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "timeline_file_comments_parent_comment_id_idx" ON "timeline_file_comments"("parent_comment_id");

-- AddForeignKey
ALTER TABLE "timeline_file_comments" ADD CONSTRAINT "timeline_file_comments_timeline_file_id_fkey" FOREIGN KEY ("timeline_file_id") REFERENCES "timeline_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_file_comments" ADD CONSTRAINT "timeline_file_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_file_comments" ADD CONSTRAINT "timeline_file_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "timeline_file_comments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
