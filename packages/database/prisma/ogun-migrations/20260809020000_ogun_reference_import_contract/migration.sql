-- CreateEnum
CREATE TYPE "ReferenceDataImportKind" AS ENUM ('OGUN_IDENTITY', 'OGUN_POLLING_UNIT_GEODATA');

-- CreateEnum
CREATE TYPE "ReferenceDataImportStatus" AS ENUM ('STAGED', 'APPLIED', 'REJECTED');

-- CreateTable
CREATE TABLE "ReferenceDataImportRelease" (
    "id" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "kind" "ReferenceDataImportKind" NOT NULL,
    "stateId" TEXT NOT NULL,
    "sourcePublisher" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceDocumentId" TEXT,
    "sourceRetrievedAt" TIMESTAMP(3) NOT NULL,
    "sourceEffectiveAt" TIMESTAMP(3),
    "approvedBy" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL,
    "manifestSha256" TEXT NOT NULL,
    "territoriesSha256" TEXT,
    "commandRelationshipsSha256" TEXT,
    "lgaMembershipsSha256" TEXT,
    "pollingUnitGeodataSha256" TEXT,
    "declaredCountsJson" JSONB NOT NULL,
    "sourceCodeNamespaces" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "supersedesReleaseId" TEXT,
    "status" "ReferenceDataImportStatus" NOT NULL DEFAULT 'STAGED',
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferenceDataImportRelease_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "LGA" ADD COLUMN "sourceCode" TEXT,
ADD COLUMN "sourceCodeNamespace" TEXT,
ADD COLUMN "sourceNameAliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "referenceImportReleaseId" TEXT,
ADD COLUMN "referenceImportedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StateConstituency" ADD COLUMN "sourceCode" TEXT,
ADD COLUMN "sourceCodeNamespace" TEXT,
ADD COLUMN "sourceNameAliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "referenceImportReleaseId" TEXT,
ADD COLUMN "referenceImportedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Ward" ADD COLUMN "sourceCode" TEXT,
ADD COLUMN "sourceCodeNamespace" TEXT,
ADD COLUMN "sourceNameAliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "referenceImportReleaseId" TEXT,
ADD COLUMN "referenceImportedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PollingUnit" ADD COLUMN "sourceCode" TEXT,
ADD COLUMN "sourceCodeNamespace" TEXT,
ADD COLUMN "sourceNameAliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "referenceImportReleaseId" TEXT,
ADD COLUMN "referenceImportedAt" TIMESTAMP(3),
ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION,
ADD COLUMN "geoAccuracyMeters" DOUBLE PRECISION,
ADD COLUMN "geoCaptureMethod" TEXT,
ADD COLUMN "geoCapturedAt" TIMESTAMP(3),
ADD COLUMN "geoSource" TEXT,
ADD COLUMN "geofenceRadiusMeters" INTEGER,
ADD COLUMN "geodataImportReleaseId" TEXT,
ADD COLUMN "geodataImportedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "ReferenceDataImportRelease_releaseId_key" ON "ReferenceDataImportRelease"("releaseId");

-- CreateIndex
CREATE INDEX "ReferenceDataImportRelease_kind_idx" ON "ReferenceDataImportRelease"("kind");

-- CreateIndex
CREATE INDEX "ReferenceDataImportRelease_stateId_idx" ON "ReferenceDataImportRelease"("stateId");

-- CreateIndex
CREATE INDEX "ReferenceDataImportRelease_status_idx" ON "ReferenceDataImportRelease"("status");

-- CreateIndex
CREATE INDEX "ReferenceDataImportRelease_supersedesReleaseId_idx" ON "ReferenceDataImportRelease"("supersedesReleaseId");

-- CreateIndex
CREATE UNIQUE INDEX "LGA_stateId_sourceCodeNamespace_sourceCode_key" ON "LGA"("stateId", "sourceCodeNamespace", "sourceCode");

-- CreateIndex
CREATE INDEX "LGA_referenceImportReleaseId_idx" ON "LGA"("referenceImportReleaseId");

-- CreateIndex
CREATE UNIQUE INDEX "StateConstituency_stateId_sourceCodeNamespace_sourceCode_key" ON "StateConstituency"("stateId", "sourceCodeNamespace", "sourceCode");

-- CreateIndex
CREATE INDEX "StateConstituency_referenceImportReleaseId_idx" ON "StateConstituency"("referenceImportReleaseId");

-- CreateIndex
CREATE UNIQUE INDEX "Ward_stateId_sourceCodeNamespace_sourceCode_key" ON "Ward"("stateId", "sourceCodeNamespace", "sourceCode");

-- CreateIndex
CREATE INDEX "Ward_referenceImportReleaseId_idx" ON "Ward"("referenceImportReleaseId");

-- CreateIndex
CREATE UNIQUE INDEX "PollingUnit_stateId_sourceCodeNamespace_sourceCode_key" ON "PollingUnit"("stateId", "sourceCodeNamespace", "sourceCode");

-- CreateIndex
CREATE INDEX "PollingUnit_referenceImportReleaseId_idx" ON "PollingUnit"("referenceImportReleaseId");

-- CreateIndex
CREATE INDEX "PollingUnit_geodataImportReleaseId_idx" ON "PollingUnit"("geodataImportReleaseId");

-- AddForeignKey
ALTER TABLE "ReferenceDataImportRelease" ADD CONSTRAINT "ReferenceDataImportRelease_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceDataImportRelease" ADD CONSTRAINT "ReferenceDataImportRelease_supersedesReleaseId_fkey" FOREIGN KEY ("supersedesReleaseId") REFERENCES "ReferenceDataImportRelease"("releaseId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LGA" ADD CONSTRAINT "LGA_referenceImportReleaseId_fkey" FOREIGN KEY ("referenceImportReleaseId") REFERENCES "ReferenceDataImportRelease"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StateConstituency" ADD CONSTRAINT "StateConstituency_referenceImportReleaseId_fkey" FOREIGN KEY ("referenceImportReleaseId") REFERENCES "ReferenceDataImportRelease"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ward" ADD CONSTRAINT "Ward_referenceImportReleaseId_fkey" FOREIGN KEY ("referenceImportReleaseId") REFERENCES "ReferenceDataImportRelease"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollingUnit" ADD CONSTRAINT "PollingUnit_referenceImportReleaseId_fkey" FOREIGN KEY ("referenceImportReleaseId") REFERENCES "ReferenceDataImportRelease"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollingUnit" ADD CONSTRAINT "PollingUnit_geodataImportReleaseId_fkey" FOREIGN KEY ("geodataImportReleaseId") REFERENCES "ReferenceDataImportRelease"("id") ON DELETE SET NULL ON UPDATE CASCADE;
