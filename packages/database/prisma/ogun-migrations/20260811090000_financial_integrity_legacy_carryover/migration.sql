-- Financial integrity: one authoritative ledger and legacy balance carryover.
-- Additive only: new enums, enum values, tables, indexes and foreign keys.
-- No existing table, column, or migration is modified.
--
-- Preserves every legacy balance without asserting its value. A carryover is
-- created PENDING and is excluded from the eligible balance until an approved
-- equivalence ratio credits it, so no monetary value is created from an
-- unverified conversion assumption.

-- CreateEnum
CREATE TYPE "LegacyCarryoverStatus" AS ENUM ('LEGACY_CARRYOVER_PENDING', 'LEGACY_CARRYOVER_CONFIRMED', 'LEGACY_CARRYOVER_VOID');

-- AlterEnum
ALTER TYPE "RewardLedgerCategory" ADD VALUE 'LEGACY_CARRYOVER';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RewardQualifyingEvent" ADD VALUE 'PARTICIPATION_APPROVED';
ALTER TYPE "RewardQualifyingEvent" ADD VALUE 'LEGACY_BALANCE_RECONCILED';

-- CreateTable
CREATE TABLE "LegacyMigrationBatch" (
    "id" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedByUserId" TEXT,
    "sourceLedger" TEXT NOT NULL DEFAULT 'RewardLedger',
    "memberCount" INTEGER NOT NULL,
    "beforeTotalPoints" INTEGER NOT NULL,
    "migratedTotalPoints" INTEGER NOT NULL,
    "pendingTotalPoints" INTEGER NOT NULL,
    "reconciledTotalPoints" INTEGER NOT NULL DEFAULT 0,
    "snapshotChecksum" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegacyMigrationBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegacyBalanceCarryover" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "migrationBatchId" TEXT NOT NULL,
    "sourceLedger" TEXT NOT NULL DEFAULT 'RewardLedger',
    "sourceRowIdsJson" JSONB NOT NULL,
    "legacyPointBalance" INTEGER NOT NULL,
    "legacyReservedPoints" INTEGER NOT NULL DEFAULT 0,
    "rowChecksum" TEXT NOT NULL,
    "status" "LegacyCarryoverStatus" NOT NULL DEFAULT 'LEGACY_CARRYOVER_PENDING',
    "conversionRatio" DECIMAL(12,6),
    "reconciliationRuleVersion" TEXT,
    "creditedPoints" INTEGER,
    "reconciledLedgerEntryId" TEXT,
    "reconciledAt" TIMESTAMP(3),
    "reconciledByUserId" TEXT,
    "voidReason" TEXT,
    "migratedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegacyBalanceCarryover_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LegacyMigrationBatch_executedAt_idx" ON "LegacyMigrationBatch"("executedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LegacyBalanceCarryover_reconciledLedgerEntryId_key" ON "LegacyBalanceCarryover"("reconciledLedgerEntryId");

-- CreateIndex
CREATE INDEX "LegacyBalanceCarryover_status_idx" ON "LegacyBalanceCarryover"("status");

-- CreateIndex
CREATE INDEX "LegacyBalanceCarryover_userId_idx" ON "LegacyBalanceCarryover"("userId");

-- CreateIndex
CREATE INDEX "LegacyBalanceCarryover_migrationBatchId_idx" ON "LegacyBalanceCarryover"("migrationBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "LegacyBalanceCarryover_userId_migrationBatchId_key" ON "LegacyBalanceCarryover"("userId", "migrationBatchId");

-- AddForeignKey
ALTER TABLE "LegacyBalanceCarryover" ADD CONSTRAINT "LegacyBalanceCarryover_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegacyBalanceCarryover" ADD CONSTRAINT "LegacyBalanceCarryover_migrationBatchId_fkey" FOREIGN KEY ("migrationBatchId") REFERENCES "LegacyMigrationBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

