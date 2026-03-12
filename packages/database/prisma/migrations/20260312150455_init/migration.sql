-- CreateTable
CREATE TABLE "BroadcastMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "taskStatus" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "geoPoliticalZoneId" TEXT,
    "stateId" TEXT,
    "senatorialDistrictId" TEXT,
    "federalConstituencyId" TEXT,
    "lgaId" TEXT,
    "wardId" TEXT,
    "stateConstituencyId" TEXT,
    "pollingUnitId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BroadcastMessage_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BroadcastMessage_geoPoliticalZoneId_fkey" FOREIGN KEY ("geoPoliticalZoneId") REFERENCES "GeoPoliticalZone" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BroadcastMessage_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BroadcastMessage_senatorialDistrictId_fkey" FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BroadcastMessage_federalConstituencyId_fkey" FOREIGN KEY ("federalConstituencyId") REFERENCES "FederalConstituency" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BroadcastMessage_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BroadcastMessage_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BroadcastMessage_stateConstituencyId_fkey" FOREIGN KEY ("stateConstituencyId") REFERENCES "StateConstituency" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BroadcastMessage_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BroadcastMessage_audience_createdAt_idx" ON "BroadcastMessage"("audience", "createdAt");

-- CreateIndex
CREATE INDEX "BroadcastMessage_taskStatus_idx" ON "BroadcastMessage"("taskStatus");

-- CreateIndex
CREATE INDEX "BroadcastMessage_stateId_idx" ON "BroadcastMessage"("stateId");

-- CreateIndex
CREATE INDEX "BroadcastMessage_lgaId_idx" ON "BroadcastMessage"("lgaId");

-- CreateIndex
CREATE INDEX "BroadcastMessage_wardId_idx" ON "BroadcastMessage"("wardId");

-- CreateIndex
CREATE INDEX "BroadcastMessage_pollingUnitId_idx" ON "BroadcastMessage"("pollingUnitId");
