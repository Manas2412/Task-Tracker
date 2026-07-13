-- Spelling correction: the division historically named "HMAYS" is renamed to
-- "HMYAS" for consistency across the platform. Both statements are no-ops on a
-- database that never had the row / designation, so this is safe everywhere.

UPDATE "divisions"
   SET "name" = 'HMYAS', "abbreviation" = 'HMYAS'
 WHERE "name" = 'HMAYS';

-- Keep the seeded director designation ("Director, HMAYS") consistent.
UPDATE "users"
   SET "designation" = REPLACE("designation", 'HMAYS', 'HMYAS')
 WHERE "designation" LIKE '%HMAYS%';
