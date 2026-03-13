CREATE TABLE "VoterEngagementTask" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "rewardPoints" INTEGER NOT NULL,
  "targetCount" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT NOT NULL,
  "geoPoliticalZoneId" TEXT,
  "stateId" TEXT,
  "senatorialDistrictId" TEXT,
  "federalConstituencyId" TEXT,
  "lgaId" TEXT,
  "wardId" TEXT,
  "stateConstituencyId" TEXT,
  "pollingUnitId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VoterEngagementTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VoterEngagementClaim" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "voterUserId" TEXT NOT NULL,
  "progressCount" INTEGER NOT NULL DEFAULT 0,
  "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VoterEngagementClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VoterEngagementClaim_taskId_voterUserId_key" ON "VoterEngagementClaim"("taskId", "voterUserId");
CREATE INDEX "VoterEngagementTask_createdByUserId_idx" ON "VoterEngagementTask"("createdByUserId");
CREATE INDEX "VoterEngagementTask_isActive_idx" ON "VoterEngagementTask"("isActive");
CREATE INDEX "VoterEngagementTask_geoPoliticalZoneId_idx" ON "VoterEngagementTask"("geoPoliticalZoneId");
CREATE INDEX "VoterEngagementTask_stateId_idx" ON "VoterEngagementTask"("stateId");
CREATE INDEX "VoterEngagementTask_lgaId_idx" ON "VoterEngagementTask"("lgaId");
CREATE INDEX "VoterEngagementTask_wardId_idx" ON "VoterEngagementTask"("wardId");
CREATE INDEX "VoterEngagementTask_pollingUnitId_idx" ON "VoterEngagementTask"("pollingUnitId");
CREATE INDEX "VoterEngagementClaim_voterUserId_idx" ON "VoterEngagementClaim"("voterUserId");

ALTER TABLE "VoterEngagementTask" ADD CONSTRAINT "VoterEngagementTask_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VoterEngagementTask" ADD CONSTRAINT "VoterEngagementTask_geoPoliticalZoneId_fkey" FOREIGN KEY ("geoPoliticalZoneId") REFERENCES "GeoPoliticalZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VoterEngagementTask" ADD CONSTRAINT "VoterEngagementTask_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VoterEngagementTask" ADD CONSTRAINT "VoterEngagementTask_senatorialDistrictId_fkey" FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VoterEngagementTask" ADD CONSTRAINT "VoterEngagementTask_federalConstituencyId_fkey" FOREIGN KEY ("federalConstituencyId") REFERENCES "FederalConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VoterEngagementTask" ADD CONSTRAINT "VoterEngagementTask_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VoterEngagementTask" ADD CONSTRAINT "VoterEngagementTask_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VoterEngagementTask" ADD CONSTRAINT "VoterEngagementTask_stateConstituencyId_fkey" FOREIGN KEY ("stateConstituencyId") REFERENCES "StateConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VoterEngagementTask" ADD CONSTRAINT "VoterEngagementTask_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VoterEngagementClaim" ADD CONSTRAINT "VoterEngagementClaim_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "VoterEngagementTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VoterEngagementClaim" ADD CONSTRAINT "VoterEngagementClaim_voterUserId_fkey" FOREIGN KEY ("voterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
