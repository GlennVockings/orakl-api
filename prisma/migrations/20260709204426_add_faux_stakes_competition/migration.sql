-- CreateTable
CREATE TABLE "FauxStakesCompetition" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "startingChips" INTEGER NOT NULL DEFAULT 1000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FauxStakesCompetition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FauxStakesCompetition_gameId_key" ON "FauxStakesCompetition"("gameId");

-- CreateIndex
CREATE INDEX "FauxStakesCompetition_gameId_idx" ON "FauxStakesCompetition"("gameId");

-- AddForeignKey
ALTER TABLE "FauxStakesCompetition" ADD CONSTRAINT "FauxStakesCompetition_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
