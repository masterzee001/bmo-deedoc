CREATE TYPE "ElectionDayOpeningStatus" AS ENUM ('OPENED_ON_TIME', 'OPENED_LATE', 'NOT_OPEN');
CREATE TYPE "ElectionDayReportStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');
CREATE TYPE "ElectionDayReportAssetKind" AS ENUM ('ARRIVAL_PHOTO', 'POST_COUNTING_PHOTO');

CREATE TABLE "ElectionDayReportAsset" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "kind" "ElectionDayReportAssetKind" NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "data" BYTEA NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ElectionDayReportAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ElectionDayReport" (
  "id" TEXT NOT NULL,
  "agentUserId" TEXT NOT NULL,
  "reviewedByUserId" TEXT,
  "reportDate" TIMESTAMP(3) NOT NULL,
  "status" "ElectionDayReportStatus" NOT NULL DEFAULT 'SUBMITTED',
  "openingStatus" "ElectionDayOpeningStatus" NOT NULL,
  "arrivalConfirmedAt" TIMESTAMP(3) NOT NULL,
  "turnoutObservation" TEXT NOT NULL,
  "incidentNotes" TEXT,
  "remarks" TEXT,
  "reviewNote" TEXT,
  "voteEntriesJson" JSONB NOT NULL,
  "arrivalPhotoAssetId" TEXT NOT NULL,
  "postCountingPhotoAssetId" TEXT NOT NULL,
  "geoPoliticalZoneId" TEXT,
  "stateId" TEXT NOT NULL,
  "senatorialDistrictId" TEXT,
  "federalConstituencyId" TEXT,
  "lgaId" TEXT NOT NULL,
  "wardId" TEXT NOT NULL,
  "stateConstituencyId" TEXT,
  "pollingUnitId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "reviewedAt" TIMESTAMP(3),

  CONSTRAINT "ElectionDayReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ElectionDayReport_agentUserId_pollingUnitId_reportDate_key" ON "ElectionDayReport"("agentUserId", "pollingUnitId", "reportDate");
CREATE UNIQUE INDEX "ElectionDayReport_arrivalPhotoAssetId_key" ON "ElectionDayReport"("arrivalPhotoAssetId");
CREATE UNIQUE INDEX "ElectionDayReport_postCountingPhotoAssetId_key" ON "ElectionDayReport"("postCountingPhotoAssetId");

CREATE INDEX "ElectionDayReportAsset_ownerUserId_idx" ON "ElectionDayReportAsset"("ownerUserId");
CREATE INDEX "ElectionDayReportAsset_kind_idx" ON "ElectionDayReportAsset"("kind");
CREATE INDEX "ElectionDayReportAsset_createdAt_idx" ON "ElectionDayReportAsset"("createdAt");

CREATE INDEX "ElectionDayReport_status_idx" ON "ElectionDayReport"("status");
CREATE INDEX "ElectionDayReport_agentUserId_idx" ON "ElectionDayReport"("agentUserId");
CREATE INDEX "ElectionDayReport_reviewedByUserId_idx" ON "ElectionDayReport"("reviewedByUserId");
CREATE INDEX "ElectionDayReport_reportDate_idx" ON "ElectionDayReport"("reportDate");
CREATE INDEX "ElectionDayReport_geoPoliticalZoneId_idx" ON "ElectionDayReport"("geoPoliticalZoneId");
CREATE INDEX "ElectionDayReport_stateId_idx" ON "ElectionDayReport"("stateId");
CREATE INDEX "ElectionDayReport_senatorialDistrictId_idx" ON "ElectionDayReport"("senatorialDistrictId");
CREATE INDEX "ElectionDayReport_federalConstituencyId_idx" ON "ElectionDayReport"("federalConstituencyId");
CREATE INDEX "ElectionDayReport_lgaId_idx" ON "ElectionDayReport"("lgaId");
CREATE INDEX "ElectionDayReport_wardId_idx" ON "ElectionDayReport"("wardId");
CREATE INDEX "ElectionDayReport_stateConstituencyId_idx" ON "ElectionDayReport"("stateConstituencyId");
CREATE INDEX "ElectionDayReport_pollingUnitId_idx" ON "ElectionDayReport"("pollingUnitId");
CREATE INDEX "ElectionDayReport_createdAt_idx" ON "ElectionDayReport"("createdAt");

ALTER TABLE "ElectionDayReportAsset"
  ADD CONSTRAINT "ElectionDayReportAsset_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ElectionDayReport"
  ADD CONSTRAINT "ElectionDayReport_agentUserId_fkey"
  FOREIGN KEY ("agentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ElectionDayReport"
  ADD CONSTRAINT "ElectionDayReport_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ElectionDayReport"
  ADD CONSTRAINT "ElectionDayReport_arrivalPhotoAssetId_fkey"
  FOREIGN KEY ("arrivalPhotoAssetId") REFERENCES "ElectionDayReportAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ElectionDayReport"
  ADD CONSTRAINT "ElectionDayReport_postCountingPhotoAssetId_fkey"
  FOREIGN KEY ("postCountingPhotoAssetId") REFERENCES "ElectionDayReportAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ElectionDayReport"
  ADD CONSTRAINT "ElectionDayReport_geoPoliticalZoneId_fkey"
  FOREIGN KEY ("geoPoliticalZoneId") REFERENCES "GeoPoliticalZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ElectionDayReport"
  ADD CONSTRAINT "ElectionDayReport_stateId_fkey"
  FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ElectionDayReport"
  ADD CONSTRAINT "ElectionDayReport_senatorialDistrictId_fkey"
  FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ElectionDayReport"
  ADD CONSTRAINT "ElectionDayReport_federalConstituencyId_fkey"
  FOREIGN KEY ("federalConstituencyId") REFERENCES "FederalConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ElectionDayReport"
  ADD CONSTRAINT "ElectionDayReport_lgaId_fkey"
  FOREIGN KEY ("lgaId") REFERENCES "LGA"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ElectionDayReport"
  ADD CONSTRAINT "ElectionDayReport_wardId_fkey"
  FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ElectionDayReport"
  ADD CONSTRAINT "ElectionDayReport_stateConstituencyId_fkey"
  FOREIGN KEY ("stateConstituencyId") REFERENCES "StateConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ElectionDayReport"
  ADD CONSTRAINT "ElectionDayReport_pollingUnitId_fkey"
  FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
