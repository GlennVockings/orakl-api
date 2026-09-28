/*
  Warnings:

  - A unique constraint covering the columns `[betId,type]` on the table `CompetitionLedgerTxn` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Market" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionLedgerTxn_betId_type_key" ON "CompetitionLedgerTxn"("betId", "type");
