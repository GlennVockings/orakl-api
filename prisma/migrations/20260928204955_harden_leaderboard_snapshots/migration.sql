/*
  Warnings:

  - A unique constraint covering the columns `[marketId,userId]` on the table `LeaderboardSnapshot` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardSnapshot_marketId_userId_key" ON "LeaderboardSnapshot"("marketId", "userId");
