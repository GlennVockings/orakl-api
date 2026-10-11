/*
  Introduce Team.normalizedName safely for databases that already contain teams.

  Team names are unique case-insensitively within a competition. Existing
  names are normalised with trim + lower before the new unique constraint is
  installed.

  If historical data already contains a case-insensitive duplicate, this
  migration fails explicitly rather than silently deleting or renaming data.
*/

-- Add the new column as nullable so existing rows remain valid during backfill.
ALTER TABLE "Team"
ADD COLUMN "normalizedName" TEXT;

-- Backfill all existing teams using the same normalisation rule as the API.
UPDATE "Team"
SET "normalizedName" = LOWER(TRIM("name"));

-- Fail clearly if historical data contains names that would collide under the
-- new case-insensitive uniqueness rule.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Team"
    GROUP BY "competitionId", "normalizedName"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot add case-insensitive Team uniqueness: duplicate team names exist within a competition';
  END IF;
END
$$;

-- Every existing row has now been backfilled.
ALTER TABLE "Team"
ALTER COLUMN "normalizedName" SET NOT NULL;

-- Replace the old case-sensitive uniqueness rule.
DROP INDEX IF EXISTS "Team_competitionId_name_key";

CREATE UNIQUE INDEX "Team_competitionId_normalizedName_key"
ON "Team"("competitionId", "normalizedName");