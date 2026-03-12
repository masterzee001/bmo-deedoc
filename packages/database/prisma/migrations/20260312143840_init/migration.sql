-- CreateTable
CREATE TABLE "FieldTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "createdByUserId" TEXT NOT NULL,
    "assignedToUserId" TEXT NOT NULL,
    "incidentId" TEXT,
    "dueAt" DATETIME,
    "completedAt" DATETIME,
    "resolutionNote" TEXT,
    "geoPoliticalZoneId" TEXT,
    "stateId" TEXT NOT NULL,
    "senatorialDistrictId" TEXT,
    "federalConstituencyId" TEXT,
    "lgaId" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "stateConstituencyId" TEXT,
    "pollingUnitId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FieldTask_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FieldTask_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FieldTask_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FieldTask_geoPoliticalZoneId_fkey" FOREIGN KEY ("geoPoliticalZoneId") REFERENCES "GeoPoliticalZone" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FieldTask_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FieldTask_senatorialDistrictId_fkey" FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FieldTask_federalConstituencyId_fkey" FOREIGN KEY ("federalConstituencyId") REFERENCES "FederalConstituency" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FieldTask_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FieldTask_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FieldTask_stateConstituencyId_fkey" FOREIGN KEY ("stateConstituencyId") REFERENCES "StateConstituency" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FieldTask_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FieldTask_assignedToUserId_status_idx" ON "FieldTask"("assignedToUserId", "status");

-- CreateIndex
CREATE INDEX "FieldTask_createdByUserId_createdAt_idx" ON "FieldTask"("createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "FieldTask_incidentId_idx" ON "FieldTask"("incidentId");

-- CreateIndex
CREATE INDEX "FieldTask_stateId_idx" ON "FieldTask"("stateId");

-- CreateIndex
CREATE INDEX "FieldTask_lgaId_idx" ON "FieldTask"("lgaId");

-- CreateIndex
CREATE INDEX "FieldTask_wardId_idx" ON "FieldTask"("wardId");

-- CreateIndex
CREATE INDEX "FieldTask_pollingUnitId_idx" ON "FieldTask"("pollingUnitId");

-- CreateIndex
CREATE INDEX "FieldTask_priority_idx" ON "FieldTask"("priority");

-- CreateIndex
CREATE INDEX "FieldTask_dueAt_idx" ON "FieldTask"("dueAt");
