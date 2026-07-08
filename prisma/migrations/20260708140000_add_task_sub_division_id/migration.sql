-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "sub_division_id" UUID;

-- CreateIndex
CREATE INDEX "tasks_sub_division_id_idx" ON "tasks"("sub_division_id");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_sub_division_id_fkey" FOREIGN KEY ("sub_division_id") REFERENCES "divisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
