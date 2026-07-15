-- Multi-division membership: the extra divisions a user is a FULL MEMBER of,
-- beyond their single home division (users.division_id). Replaces the retired
-- hardcoded cross-division links (KI<->NSDF allocation + participant config).
--
-- Idempotent by design: safe to apply to a fresh database and to a prod
-- database that may already carry these objects from `db push` drift.
-- Postgres has no "ADD CONSTRAINT IF NOT EXISTS", so the foreign keys are
-- guarded by pg_constraint existence checks in a DO block.

-- CreateTable
CREATE TABLE IF NOT EXISTS "user_division_access" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "division_id" UUID NOT NULL,
    "granted_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_division_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_division_access_division_id_idx" ON "user_division_access"("division_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_division_access_user_id_idx" ON "user_division_access"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "user_division_access_user_id_division_id_key" ON "user_division_access"("user_id", "division_id");

-- AddForeignKey (guarded — no ADD CONSTRAINT IF NOT EXISTS in Postgres)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_division_access_user_id_fkey') THEN
    ALTER TABLE "user_division_access"
      ADD CONSTRAINT "user_division_access_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_division_access_division_id_fkey') THEN
    ALTER TABLE "user_division_access"
      ADD CONSTRAINT "user_division_access_division_id_fkey"
      FOREIGN KEY ("division_id") REFERENCES "divisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_division_access_granted_by_fkey') THEN
    ALTER TABLE "user_division_access"
      ADD CONSTRAINT "user_division_access_granted_by_fkey"
      FOREIGN KEY ("granted_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
END $$;

-- Backfill: migrate the previously hardcoded per-user cross-division VIEW grant
-- into this admin-managed store. `yogesh` (home SGM) and `vaishali` (home
-- Autonomous Bodies) each become full members of both the SGM and Autonomous
-- Bodies (abbreviation 'ABD') divisions. The home-division row is excluded (a
-- division is never both home and an extra membership), and ON CONFLICT makes
-- this safe to re-run. A Super Admin can add/remove these in Users > Edit.
INSERT INTO "user_division_access" ("id", "user_id", "division_id", "created_at")
SELECT gen_random_uuid(), u."id", d."id", CURRENT_TIMESTAMP
FROM "users" u
CROSS JOIN "divisions" d
WHERE u."username" IN ('yogesh', 'vaishali')
  AND d."abbreviation" IN ('SGM', 'ABD')
  AND d."kind" = 'division'
  AND d."id" <> u."division_id"
ON CONFLICT ("user_id", "division_id") DO NOTHING;
