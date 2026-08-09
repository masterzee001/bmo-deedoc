-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('PHOTO', 'VIDEO', 'WRITTEN_REPORT');

-- CreateEnum
CREATE TYPE "EvidenceClassification" AS ENUM ('ARRIVAL', 'OPENING', 'MATERIALS', 'SECURITY', 'INCIDENT', 'VOTING_PROCESS', 'COUNTING', 'RESULT_SHEET', 'POST_COUNTING', 'OTHER');

-- CreateEnum
CREATE TYPE "EvidenceReviewStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'DISPUTED', 'REQUIRES_CLARIFICATION', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EvidenceCustodyEventType" AS ENUM ('UPLOADED', 'VIEWED', 'REVIEWED', 'CLASSIFIED', 'DOWNLOADED', 'EXPORTED', 'ADDED_TO_CASE');

-- CreateEnum
CREATE TYPE "LegalCaseStatus" AS ENUM ('OPEN', 'LEGAL_HOLD', 'CLOSED');

-- CreateTable
CREATE TABLE "EvidenceAsset" (
    "id" TEXT NOT NULL,
    "evidenceType" "EvidenceType" NOT NULL,
    "classification" "EvidenceClassification" NOT NULL DEFAULT 'OTHER',
    "reviewStatus" "EvidenceReviewStatus" NOT NULL DEFAULT 'SUBMITTED',
    "originalStorageKey" TEXT NOT NULL,
    "storageBucket" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3),
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serverReceivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "accuracyMeters" DOUBLE PRECISION,
    "metadataJson" JSONB,
    "derivativesJson" JSONB,
    "uploaderUserId" TEXT NOT NULL,
    "incidentId" TEXT,
    "electionReportId" TEXT,
    "geoPoliticalZoneId" TEXT,
    "stateId" TEXT NOT NULL,
    "senatorialDistrictId" TEXT,
    "federalConstituencyId" TEXT,
    "lgaId" TEXT,
    "wardId" TEXT,
    "stateConstituencyId" TEXT,
    "pollingUnitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvidenceAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceCustodyEvent" (
    "id" TEXT NOT NULL,
    "evidenceAssetId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "eventType" "EvidenceCustodyEventType" NOT NULL,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceCustodyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalCase" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "LegalCaseStatus" NOT NULL DEFAULT 'OPEN',
    "createdByUserId" TEXT NOT NULL,
    "geoPoliticalZoneId" TEXT,
    "stateId" TEXT NOT NULL,
    "senatorialDistrictId" TEXT,
    "federalConstituencyId" TEXT,
    "lgaId" TEXT,
    "wardId" TEXT,
    "stateConstituencyId" TEXT,
    "pollingUnitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseEvidence" (
    "id" TEXT NOT NULL,
    "legalCaseId" TEXT NOT NULL,
    "evidenceAssetId" TEXT NOT NULL,
    "addedByUserId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalCaseNote" (
    "id" TEXT NOT NULL,
    "legalCaseId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalCaseNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidencePackage" (
    "id" TEXT NOT NULL,
    "legalCaseId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "manifestJson" JSONB NOT NULL,
    "manifestSha256" TEXT NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidencePackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidencePackageItem" (
    "id" TEXT NOT NULL,
    "evidencePackageId" TEXT NOT NULL,
    "evidenceAssetId" TEXT NOT NULL,
    "manifestEntryJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidencePackageItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceAsset_originalStorageKey_key" ON "EvidenceAsset"("originalStorageKey");

-- CreateIndex
CREATE INDEX "EvidenceAsset_evidenceType_idx" ON "EvidenceAsset"("evidenceType");

-- CreateIndex
CREATE INDEX "EvidenceAsset_classification_idx" ON "EvidenceAsset"("classification");

-- CreateIndex
CREATE INDEX "EvidenceAsset_reviewStatus_idx" ON "EvidenceAsset"("reviewStatus");

-- CreateIndex
CREATE INDEX "EvidenceAsset_uploaderUserId_idx" ON "EvidenceAsset"("uploaderUserId");

-- CreateIndex
CREATE INDEX "EvidenceAsset_sha256_idx" ON "EvidenceAsset"("sha256");

-- CreateIndex
CREATE INDEX "EvidenceAsset_incidentId_idx" ON "EvidenceAsset"("incidentId");

-- CreateIndex
CREATE INDEX "EvidenceAsset_electionReportId_idx" ON "EvidenceAsset"("electionReportId");

-- CreateIndex
CREATE INDEX "EvidenceAsset_stateId_idx" ON "EvidenceAsset"("stateId");

-- CreateIndex
CREATE INDEX "EvidenceAsset_senatorialDistrictId_idx" ON "EvidenceAsset"("senatorialDistrictId");

-- CreateIndex
CREATE INDEX "EvidenceAsset_federalConstituencyId_idx" ON "EvidenceAsset"("federalConstituencyId");

-- CreateIndex
CREATE INDEX "EvidenceAsset_lgaId_idx" ON "EvidenceAsset"("lgaId");

-- CreateIndex
CREATE INDEX "EvidenceAsset_wardId_idx" ON "EvidenceAsset"("wardId");

-- CreateIndex
CREATE INDEX "EvidenceAsset_stateConstituencyId_idx" ON "EvidenceAsset"("stateConstituencyId");

-- CreateIndex
CREATE INDEX "EvidenceAsset_pollingUnitId_idx" ON "EvidenceAsset"("pollingUnitId");

-- CreateIndex
CREATE INDEX "EvidenceAsset_serverReceivedAt_idx" ON "EvidenceAsset"("serverReceivedAt");

-- CreateIndex
CREATE INDEX "EvidenceCustodyEvent_evidenceAssetId_idx" ON "EvidenceCustodyEvent"("evidenceAssetId");

-- CreateIndex
CREATE INDEX "EvidenceCustodyEvent_actorUserId_idx" ON "EvidenceCustodyEvent"("actorUserId");

-- CreateIndex
CREATE INDEX "EvidenceCustodyEvent_eventType_idx" ON "EvidenceCustodyEvent"("eventType");

-- CreateIndex
CREATE INDEX "EvidenceCustodyEvent_createdAt_idx" ON "EvidenceCustodyEvent"("createdAt");

-- CreateIndex
CREATE INDEX "LegalCase_status_idx" ON "LegalCase"("status");

-- CreateIndex
CREATE INDEX "LegalCase_createdByUserId_idx" ON "LegalCase"("createdByUserId");

-- CreateIndex
CREATE INDEX "LegalCase_stateId_idx" ON "LegalCase"("stateId");

-- CreateIndex
CREATE INDEX "LegalCase_senatorialDistrictId_idx" ON "LegalCase"("senatorialDistrictId");

-- CreateIndex
CREATE INDEX "LegalCase_federalConstituencyId_idx" ON "LegalCase"("federalConstituencyId");

-- CreateIndex
CREATE INDEX "LegalCase_lgaId_idx" ON "LegalCase"("lgaId");

-- CreateIndex
CREATE INDEX "LegalCase_wardId_idx" ON "LegalCase"("wardId");

-- CreateIndex
CREATE INDEX "LegalCase_stateConstituencyId_idx" ON "LegalCase"("stateConstituencyId");

-- CreateIndex
CREATE INDEX "LegalCase_pollingUnitId_idx" ON "LegalCase"("pollingUnitId");

-- CreateIndex
CREATE INDEX "LegalCase_createdAt_idx" ON "LegalCase"("createdAt");

-- CreateIndex
CREATE INDEX "CaseEvidence_evidenceAssetId_idx" ON "CaseEvidence"("evidenceAssetId");

-- CreateIndex
CREATE INDEX "CaseEvidence_addedByUserId_idx" ON "CaseEvidence"("addedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "CaseEvidence_legalCaseId_evidenceAssetId_key" ON "CaseEvidence"("legalCaseId", "evidenceAssetId");

-- CreateIndex
CREATE INDEX "LegalCaseNote_legalCaseId_idx" ON "LegalCaseNote"("legalCaseId");

-- CreateIndex
CREATE INDEX "LegalCaseNote_authorUserId_idx" ON "LegalCaseNote"("authorUserId");

-- CreateIndex
CREATE INDEX "LegalCaseNote_createdAt_idx" ON "LegalCaseNote"("createdAt");

-- CreateIndex
CREATE INDEX "EvidencePackage_legalCaseId_idx" ON "EvidencePackage"("legalCaseId");

-- CreateIndex
CREATE INDEX "EvidencePackage_createdByUserId_idx" ON "EvidencePackage"("createdByUserId");

-- CreateIndex
CREATE INDEX "EvidencePackage_manifestSha256_idx" ON "EvidencePackage"("manifestSha256");

-- CreateIndex
CREATE INDEX "EvidencePackage_createdAt_idx" ON "EvidencePackage"("createdAt");

-- CreateIndex
CREATE INDEX "EvidencePackageItem_evidenceAssetId_idx" ON "EvidencePackageItem"("evidenceAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidencePackageItem_evidencePackageId_evidenceAssetId_key" ON "EvidencePackageItem"("evidencePackageId", "evidenceAssetId");

-- AddForeignKey
ALTER TABLE "EvidenceAsset" ADD CONSTRAINT "EvidenceAsset_uploaderUserId_fkey" FOREIGN KEY ("uploaderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceAsset" ADD CONSTRAINT "EvidenceAsset_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceAsset" ADD CONSTRAINT "EvidenceAsset_electionReportId_fkey" FOREIGN KEY ("electionReportId") REFERENCES "ElectionDayReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceAsset" ADD CONSTRAINT "EvidenceAsset_geoPoliticalZoneId_fkey" FOREIGN KEY ("geoPoliticalZoneId") REFERENCES "GeoPoliticalZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceAsset" ADD CONSTRAINT "EvidenceAsset_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceAsset" ADD CONSTRAINT "EvidenceAsset_senatorialDistrictId_fkey" FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceAsset" ADD CONSTRAINT "EvidenceAsset_federalConstituencyId_fkey" FOREIGN KEY ("federalConstituencyId") REFERENCES "FederalConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceAsset" ADD CONSTRAINT "EvidenceAsset_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceAsset" ADD CONSTRAINT "EvidenceAsset_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceAsset" ADD CONSTRAINT "EvidenceAsset_stateConstituencyId_fkey" FOREIGN KEY ("stateConstituencyId") REFERENCES "StateConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceAsset" ADD CONSTRAINT "EvidenceAsset_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceCustodyEvent" ADD CONSTRAINT "EvidenceCustodyEvent_evidenceAssetId_fkey" FOREIGN KEY ("evidenceAssetId") REFERENCES "EvidenceAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceCustodyEvent" ADD CONSTRAINT "EvidenceCustodyEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalCase" ADD CONSTRAINT "LegalCase_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalCase" ADD CONSTRAINT "LegalCase_geoPoliticalZoneId_fkey" FOREIGN KEY ("geoPoliticalZoneId") REFERENCES "GeoPoliticalZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalCase" ADD CONSTRAINT "LegalCase_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalCase" ADD CONSTRAINT "LegalCase_senatorialDistrictId_fkey" FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalCase" ADD CONSTRAINT "LegalCase_federalConstituencyId_fkey" FOREIGN KEY ("federalConstituencyId") REFERENCES "FederalConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalCase" ADD CONSTRAINT "LegalCase_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalCase" ADD CONSTRAINT "LegalCase_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalCase" ADD CONSTRAINT "LegalCase_stateConstituencyId_fkey" FOREIGN KEY ("stateConstituencyId") REFERENCES "StateConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalCase" ADD CONSTRAINT "LegalCase_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseEvidence" ADD CONSTRAINT "CaseEvidence_legalCaseId_fkey" FOREIGN KEY ("legalCaseId") REFERENCES "LegalCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseEvidence" ADD CONSTRAINT "CaseEvidence_evidenceAssetId_fkey" FOREIGN KEY ("evidenceAssetId") REFERENCES "EvidenceAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseEvidence" ADD CONSTRAINT "CaseEvidence_addedByUserId_fkey" FOREIGN KEY ("addedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalCaseNote" ADD CONSTRAINT "LegalCaseNote_legalCaseId_fkey" FOREIGN KEY ("legalCaseId") REFERENCES "LegalCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalCaseNote" ADD CONSTRAINT "LegalCaseNote_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidencePackage" ADD CONSTRAINT "EvidencePackage_legalCaseId_fkey" FOREIGN KEY ("legalCaseId") REFERENCES "LegalCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidencePackage" ADD CONSTRAINT "EvidencePackage_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidencePackageItem" ADD CONSTRAINT "EvidencePackageItem_evidencePackageId_fkey" FOREIGN KEY ("evidencePackageId") REFERENCES "EvidencePackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidencePackageItem" ADD CONSTRAINT "EvidencePackageItem_evidenceAssetId_fkey" FOREIGN KEY ("evidenceAssetId") REFERENCES "EvidenceAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

