/*
  Warnings:

  - You are about to drop the column `gameId` on the `Bet` table. All the data in the column will be lost.
  - You are about to drop the column `gameId` on the `FauxStakesCompetition` table. All the data in the column will be lost.
  - You are about to drop the column `gameId` on the `LeaderboardSnapshot` table. All the data in the column will be lost.
  - You are about to drop the column `gameId` on the `Market` table. All the data in the column will be lost.
  - You are about to drop the column `gameId` on the `Team` table. All the data in the column will be lost.
  - You are about to drop the `Game` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GameLedgerTxn` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GameMember` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[competitionId]` on the table `FauxStakesCompetition` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[competitionId,name]` on the table `Market` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[competitionId,name]` on the table `Team` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `competitionId` to the `Bet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `competitionId` to the `FauxStakesCompetition` table without a default value. This is not possible if the table is not empty.
  - Added the required column `competitionId` to the `LeaderboardSnapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `competitionId` to the `Market` table without a default value. This is not possible if the table is not empty.
  - Added the required column `competitionId` to the `Team` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Bet" DROP CONSTRAINT "Bet_gameId_fkey";

-- DropForeignKey
ALTER TABLE "FauxStakesCompetition" DROP CONSTRAINT "FauxStakesCompetition_gameId_fkey";

-- DropForeignKey
ALTER TABLE "Game" DROP CONSTRAINT "Game_createdById_fkey";

-- DropForeignKey
ALTER TABLE "GameLedgerTxn" DROP CONSTRAINT "GameLedgerTxn_betId_fkey";

-- DropForeignKey
ALTER TABLE "GameLedgerTxn" DROP CONSTRAINT "GameLedgerTxn_gameId_fkey";

-- DropForeignKey
ALTER TABLE "GameLedgerTxn" DROP CONSTRAINT "GameLedgerTxn_marketId_fkey";

-- DropForeignKey
ALTER TABLE "GameLedgerTxn" DROP CONSTRAINT "GameLedgerTxn_userId_fkey";

-- DropForeignKey
ALTER TABLE "GameMember" DROP CONSTRAINT "GameMember_gameId_fkey";

-- DropForeignKey
ALTER TABLE "GameMember" DROP CONSTRAINT "GameMember_userId_fkey";

-- DropForeignKey
ALTER TABLE "LeaderboardSnapshot" DROP CONSTRAINT "LeaderboardSnapshot_gameId_fkey";

-- DropForeignKey
ALTER TABLE "Market" DROP CONSTRAINT "Market_gameId_fkey";

-- DropForeignKey
ALTER TABLE "Team" DROP CONSTRAINT "Team_gameId_fkey";

-- DropIndex
DROP INDEX "Bet_gameId_userId_status_idx";

-- DropIndex
DROP INDEX "FauxStakesCompetition_gameId_idx";

-- DropIndex
DROP INDEX "FauxStakesCompetition_gameId_key";

-- DropIndex
DROP INDEX "LeaderboardSnapshot_gameId_createdAt_idx";

-- DropIndex
DROP INDEX "LeaderboardSnapshot_gameId_userId_createdAt_idx";

-- DropIndex
DROP INDEX "Market_gameId_idx";

-- DropIndex
DROP INDEX "Market_gameId_name_key";

-- DropIndex
DROP INDEX "Market_gameId_status_idx";

-- DropIndex
DROP INDEX "Team_gameId_idx";

-- DropIndex
DROP INDEX "Team_gameId_name_key";

-- AlterTable
ALTER TABLE "Bet" DROP COLUMN "gameId",
ADD COLUMN     "competitionId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "FauxStakesCompetition" DROP COLUMN "gameId",
ADD COLUMN     "competitionId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "LeaderboardSnapshot" DROP COLUMN "gameId",
ADD COLUMN     "competitionId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Market" DROP COLUMN "gameId",
ADD COLUMN     "competitionId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Team" DROP COLUMN "gameId",
ADD COLUMN     "competitionId" TEXT NOT NULL;

-- DropTable
DROP TABLE "Game";

-- DropTable
DROP TABLE "GameLedgerTxn";

-- DropTable
DROP TABLE "GameMember";

-- CreateTable
CREATE TABLE "CompetitionMember" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'PLAYER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitionMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'DRAFT',
    "joinCode" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "gameType" "GameType" NOT NULL DEFAULT 'FAUX_STAKES',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionLedgerTxn" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "LedgerType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "betId" TEXT,
    "marketId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitionLedgerTxn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompetitionMember_userId_idx" ON "CompetitionMember"("userId");

-- CreateIndex
CREATE INDEX "CompetitionMember_competitionId_idx" ON "CompetitionMember"("competitionId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionMember_competitionId_userId_key" ON "CompetitionMember"("competitionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Competition_joinCode_key" ON "Competition"("joinCode");

-- CreateIndex
CREATE INDEX "Competition_createdById_idx" ON "Competition"("createdById");

-- CreateIndex
CREATE INDEX "CompetitionLedgerTxn_competitionId_idx" ON "CompetitionLedgerTxn"("competitionId");

-- CreateIndex
CREATE INDEX "CompetitionLedgerTxn_userId_competitionId_idx" ON "CompetitionLedgerTxn"("userId", "competitionId");

-- CreateIndex
CREATE INDEX "CompetitionLedgerTxn_betId_idx" ON "CompetitionLedgerTxn"("betId");

-- CreateIndex
CREATE INDEX "CompetitionLedgerTxn_marketId_idx" ON "CompetitionLedgerTxn"("marketId");

-- CreateIndex
CREATE INDEX "Bet_competitionId_userId_status_idx" ON "Bet"("competitionId", "userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FauxStakesCompetition_competitionId_key" ON "FauxStakesCompetition"("competitionId");

-- CreateIndex
CREATE INDEX "FauxStakesCompetition_competitionId_idx" ON "FauxStakesCompetition"("competitionId");

-- CreateIndex
CREATE INDEX "LeaderboardSnapshot_competitionId_createdAt_idx" ON "LeaderboardSnapshot"("competitionId", "createdAt");

-- CreateIndex
CREATE INDEX "LeaderboardSnapshot_competitionId_userId_createdAt_idx" ON "LeaderboardSnapshot"("competitionId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "Market_competitionId_idx" ON "Market"("competitionId");

-- CreateIndex
CREATE INDEX "Market_competitionId_status_idx" ON "Market"("competitionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Market_competitionId_name_key" ON "Market"("competitionId", "name");

-- CreateIndex
CREATE INDEX "Team_competitionId_idx" ON "Team"("competitionId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_competitionId_name_key" ON "Team"("competitionId", "name");

-- AddForeignKey
ALTER TABLE "CompetitionMember" ADD CONSTRAINT "CompetitionMember_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionMember" ADD CONSTRAINT "CompetitionMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competition" ADD CONSTRAINT "Competition_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FauxStakesCompetition" ADD CONSTRAINT "FauxStakesCompetition_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Market" ADD CONSTRAINT "Market_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionLedgerTxn" ADD CONSTRAINT "CompetitionLedgerTxn_betId_fkey" FOREIGN KEY ("betId") REFERENCES "Bet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionLedgerTxn" ADD CONSTRAINT "CompetitionLedgerTxn_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionLedgerTxn" ADD CONSTRAINT "CompetitionLedgerTxn_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionLedgerTxn" ADD CONSTRAINT "CompetitionLedgerTxn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardSnapshot" ADD CONSTRAINT "LeaderboardSnapshot_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
