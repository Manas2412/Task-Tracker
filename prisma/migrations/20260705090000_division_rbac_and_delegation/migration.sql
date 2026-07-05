-- Division-based RBAC:
--   * divisions.head_user_id     — the division's head (role mapping in DB, not code)
--   * division_access_delegations — temporary, calendar-bounded head access
--   * users.pmu_id               — which PMU unit a user belongs to (placement)
--   * NotificationType            — delegation created / revoked
-- Generated with `prisma migrate diff` against the previous schema; the
-- head backfill at the bottom is hand-written and idempotent.

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'division_access_delegated';
ALTER TYPE "NotificationType" ADD VALUE 'division_access_delegation_revoked';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "pmu_id" UUID;

-- AlterTable
ALTER TABLE "divisions" ADD COLUMN     "head_user_id" UUID;

-- CreateTable
CREATE TABLE "division_access_delegations" (
    "id" UUID NOT NULL,
    "division_id" UUID NOT NULL,
    "delegated_by" UUID NOT NULL,
    "delegated_to" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "division_access_delegations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "division_access_delegations_delegated_to_ends_at_idx" ON "division_access_delegations"("delegated_to", "ends_at");

-- CreateIndex
CREATE INDEX "division_access_delegations_division_id_ends_at_idx" ON "division_access_delegations"("division_id", "ends_at");

-- CreateIndex
CREATE INDEX "division_access_delegations_delegated_by_idx" ON "division_access_delegations"("delegated_by");

-- CreateIndex
CREATE INDEX "divisions_head_user_id_idx" ON "divisions"("head_user_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_pmu_id_fkey" FOREIGN KEY ("pmu_id") REFERENCES "divisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "divisions" ADD CONSTRAINT "divisions_head_user_id_fkey" FOREIGN KEY ("head_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "division_access_delegations" ADD CONSTRAINT "division_access_delegations_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "divisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "division_access_delegations" ADD CONSTRAINT "division_access_delegations_delegated_by_fkey" FOREIGN KEY ("delegated_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "division_access_delegations" ADD CONSTRAINT "division_access_delegations_delegated_to_fkey" FOREIGN KEY ("delegated_to") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "division_access_delegations" ADD CONSTRAINT "division_access_delegations_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Backfill the six division heads. Keyed on stable usernames and division
-- names from the production seed; each statement is a no-op when either
-- side is missing, and only fills divisions that have no head yet.
UPDATE "divisions" d SET "head_user_id" = u."id" FROM "users" u
  WHERE u."username" = 'osd.myas' AND d."name" = 'Office of JS'      AND d."kind" = 'division' AND d."head_user_id" IS NULL;
UPDATE "divisions" d SET "head_user_id" = u."id" FROM "users" u
  WHERE u."username" = 'zuber'    AND d."name" = 'NSDF'              AND d."kind" = 'division' AND d."head_user_id" IS NULL;
UPDATE "divisions" d SET "head_user_id" = u."id" FROM "users" u
  WHERE u."username" = 'harilal'  AND d."name" = 'SGM'               AND d."kind" = 'division' AND d."head_user_id" IS NULL;
UPDATE "divisions" d SET "head_user_id" = u."id" FROM "users" u
  WHERE u."username" = 'zuber'    AND d."name" = 'Autonomous Bodies' AND d."kind" = 'division' AND d."head_user_id" IS NULL;
UPDATE "divisions" d SET "head_user_id" = u."id" FROM "users" u
  WHERE u."username" = 'chanchal' AND d."name" = 'Khelo India'       AND d."kind" = 'division' AND d."head_user_id" IS NULL;
UPDATE "divisions" d SET "head_user_id" = u."id" FROM "users" u
  WHERE u."username" = 'ayushman' AND d."name" = 'Media & IT'        AND d."kind" = 'division' AND d."head_user_id" IS NULL;
