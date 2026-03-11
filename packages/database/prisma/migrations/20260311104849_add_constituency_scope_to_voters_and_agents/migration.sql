-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AgentProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "assignedAdminUserId" TEXT,
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
    CONSTRAINT "AgentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgentProfile_assignedAdminUserId_fkey" FOREIGN KEY ("assignedAdminUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AgentProfile_geoPoliticalZoneId_fkey" FOREIGN KEY ("geoPoliticalZoneId") REFERENCES "GeoPoliticalZone" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AgentProfile_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AgentProfile_senatorialDistrictId_fkey" FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AgentProfile_federalConstituencyId_fkey" FOREIGN KEY ("federalConstituencyId") REFERENCES "FederalConstituency" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AgentProfile_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AgentProfile_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AgentProfile_stateConstituencyId_fkey" FOREIGN KEY ("stateConstituencyId") REFERENCES "StateConstituency" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AgentProfile_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AgentProfile" ("assignedAdminUserId", "createdAt", "geoPoliticalZoneId", "id", "lgaId", "pollingUnitId", "stateId", "updatedAt", "userId", "wardId") SELECT "assignedAdminUserId", "createdAt", "geoPoliticalZoneId", "id", "lgaId", "pollingUnitId", "stateId", "updatedAt", "userId", "wardId" FROM "AgentProfile";
DROP TABLE "AgentProfile";
ALTER TABLE "new_AgentProfile" RENAME TO "AgentProfile";
CREATE UNIQUE INDEX "AgentProfile_userId_key" ON "AgentProfile"("userId");
CREATE INDEX "AgentProfile_geoPoliticalZoneId_idx" ON "AgentProfile"("geoPoliticalZoneId");
CREATE INDEX "AgentProfile_assignedAdminUserId_idx" ON "AgentProfile"("assignedAdminUserId");
CREATE INDEX "AgentProfile_stateId_idx" ON "AgentProfile"("stateId");
CREATE INDEX "AgentProfile_senatorialDistrictId_idx" ON "AgentProfile"("senatorialDistrictId");
CREATE INDEX "AgentProfile_federalConstituencyId_idx" ON "AgentProfile"("federalConstituencyId");
CREATE INDEX "AgentProfile_lgaId_idx" ON "AgentProfile"("lgaId");
CREATE INDEX "AgentProfile_wardId_idx" ON "AgentProfile"("wardId");
CREATE INDEX "AgentProfile_stateConstituencyId_idx" ON "AgentProfile"("stateConstituencyId");
CREATE INDEX "AgentProfile_pollingUnitId_idx" ON "AgentProfile"("pollingUnitId");
CREATE TABLE "new_VoterProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "voterCardNumber" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "referredByUserId" TEXT,
    "geoPoliticalZoneId" TEXT,
    "stateId" TEXT NOT NULL,
    "senatorialDistrictId" TEXT,
    "federalConstituencyId" TEXT,
    "lgaId" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "stateConstituencyId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VoterProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VoterProfile_referredByUserId_fkey" FOREIGN KEY ("referredByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VoterProfile_geoPoliticalZoneId_fkey" FOREIGN KEY ("geoPoliticalZoneId") REFERENCES "GeoPoliticalZone" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VoterProfile_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VoterProfile_senatorialDistrictId_fkey" FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VoterProfile_federalConstituencyId_fkey" FOREIGN KEY ("federalConstituencyId") REFERENCES "FederalConstituency" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VoterProfile_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VoterProfile_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VoterProfile_stateConstituencyId_fkey" FOREIGN KEY ("stateConstituencyId") REFERENCES "StateConstituency" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_VoterProfile" ("createdAt", "geoPoliticalZoneId", "id", "lgaId", "referralCode", "referredByUserId", "stateId", "updatedAt", "userId", "voterCardNumber", "wardId") SELECT "createdAt", "geoPoliticalZoneId", "id", "lgaId", "referralCode", "referredByUserId", "stateId", "updatedAt", "userId", "voterCardNumber", "wardId" FROM "VoterProfile";
DROP TABLE "VoterProfile";
ALTER TABLE "new_VoterProfile" RENAME TO "VoterProfile";
CREATE UNIQUE INDEX "VoterProfile_userId_key" ON "VoterProfile"("userId");
CREATE UNIQUE INDEX "VoterProfile_voterCardNumber_key" ON "VoterProfile"("voterCardNumber");
CREATE UNIQUE INDEX "VoterProfile_referralCode_key" ON "VoterProfile"("referralCode");
CREATE INDEX "VoterProfile_geoPoliticalZoneId_idx" ON "VoterProfile"("geoPoliticalZoneId");
CREATE INDEX "VoterProfile_stateId_idx" ON "VoterProfile"("stateId");
CREATE INDEX "VoterProfile_senatorialDistrictId_idx" ON "VoterProfile"("senatorialDistrictId");
CREATE INDEX "VoterProfile_federalConstituencyId_idx" ON "VoterProfile"("federalConstituencyId");
CREATE INDEX "VoterProfile_lgaId_idx" ON "VoterProfile"("lgaId");
CREATE INDEX "VoterProfile_wardId_idx" ON "VoterProfile"("wardId");
CREATE INDEX "VoterProfile_stateConstituencyId_idx" ON "VoterProfile"("stateConstituencyId");
CREATE INDEX "VoterProfile_referredByUserId_idx" ON "VoterProfile"("referredByUserId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
