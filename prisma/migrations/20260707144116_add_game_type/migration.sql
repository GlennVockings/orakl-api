-- CreateEnum
CREATE TYPE "GameType" AS ENUM ('FAUX_STAKES', 'PREDICTOR');

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "gameType" "GameType" NOT NULL DEFAULT 'FAUX_STAKES';
