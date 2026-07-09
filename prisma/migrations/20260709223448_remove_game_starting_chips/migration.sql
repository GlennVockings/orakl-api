/*
  Warnings:

  - You are about to drop the column `startingChips` on the `Game` table. All the data in the column will be lost.

*/
-- AlterTable
INSERT INTO "FauxStakesCompetition" (
  "id",
  "gameId",
  "startingChips",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  "id",
  "startingChips",
  NOW(),
  NOW()
FROM "Game"
WHERE "gameType" = 'FAUX_STAKES'
ON CONFLICT ("gameId") DO NOTHING;

ALTER TABLE "Game" DROP COLUMN "startingChips";
