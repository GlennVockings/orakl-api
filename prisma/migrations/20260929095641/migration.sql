/*
  Warnings:

  - A unique constraint covering the columns `[competitionId,normalizedName]` on the table `Team` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `normalizedName` to the `Team` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Team_competitionId_name_key";

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "normalizedName" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Team_competitionId_normalizedName_key" ON "Team"("competitionId", "normalizedName");
