-- CreateTable
CREATE TABLE "public"."LeaderboardSnapshot" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "settledBalance" DECIMAL(12,2) NOT NULL,
    "rank" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaderboardSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeaderboardSnapshot_gameId_createdAt_idx" ON "public"."LeaderboardSnapshot"("gameId", "createdAt");

-- CreateIndex
CREATE INDEX "LeaderboardSnapshot_gameId_userId_createdAt_idx" ON "public"."LeaderboardSnapshot"("gameId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "LeaderboardSnapshot_marketId_idx" ON "public"."LeaderboardSnapshot"("marketId");

-- AddForeignKey
ALTER TABLE "public"."LeaderboardSnapshot" ADD CONSTRAINT "LeaderboardSnapshot_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "public"."Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeaderboardSnapshot" ADD CONSTRAINT "LeaderboardSnapshot_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "public"."Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeaderboardSnapshot" ADD CONSTRAINT "LeaderboardSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
