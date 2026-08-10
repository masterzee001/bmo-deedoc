-- Background job durability and evidence derivative renditions.
-- Additive only: creates new enums, tables, indexes, and foreign keys.
-- No existing table, column, or migration is modified.
--
-- BackgroundJob makes PostgreSQL authoritative for what must run; Redis/BullMQ
-- is only the execution transport, so losing Redis delays work, never drops it.
-- EvidenceDerivative renditions are never authoritative: the original object and
-- its server-computed SHA-256 remain the evidentiary record.

-- CreateEnum
CREATE TYPE "EvidenceDerivativeKind" AS ENUM ('THUMBNAIL', 'PREVIEW', 'POSTER');

-- CreateEnum
CREATE TYPE "EvidenceDerivativeStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED', 'DEFERRED');

-- CreateEnum
CREATE TYPE "BackgroundJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD_LETTER');

-- CreateTable
CREATE TABLE "EvidenceDerivative" (
    "id" TEXT NOT NULL,
    "evidenceAssetId" TEXT NOT NULL,
    "kind" "EvidenceDerivativeKind" NOT NULL,
    "status" "EvidenceDerivativeStatus" NOT NULL DEFAULT 'PENDING',
    "storageKey" TEXT,
    "sha256" TEXT,
    "mimeType" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "byteSize" INTEGER,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "deferredReason" TEXT,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvidenceDerivative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackgroundJob" (
    "id" TEXT NOT NULL,
    "queue" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "status" "BackgroundJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceDerivative_storageKey_key" ON "EvidenceDerivative"("storageKey");

-- CreateIndex
CREATE INDEX "EvidenceDerivative_status_createdAt_idx" ON "EvidenceDerivative"("status", "createdAt");

-- CreateIndex
CREATE INDEX "EvidenceDerivative_evidenceAssetId_idx" ON "EvidenceDerivative"("evidenceAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceDerivative_evidenceAssetId_kind_key" ON "EvidenceDerivative"("evidenceAssetId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "BackgroundJob_idempotencyKey_key" ON "BackgroundJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "BackgroundJob_status_availableAt_idx" ON "BackgroundJob"("status", "availableAt");

-- CreateIndex
CREATE INDEX "BackgroundJob_queue_status_idx" ON "BackgroundJob"("queue", "status");

-- CreateIndex
CREATE INDEX "BackgroundJob_createdAt_idx" ON "BackgroundJob"("createdAt");

-- AddForeignKey
ALTER TABLE "EvidenceDerivative" ADD CONSTRAINT "EvidenceDerivative_evidenceAssetId_fkey" FOREIGN KEY ("evidenceAssetId") REFERENCES "EvidenceAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

