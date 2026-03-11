-- CreateTable
CREATE TABLE "GeoPoliticalZone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PoliticalParty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AdminProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "adminLevel" TEXT NOT NULL,
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
    CONSTRAINT "AdminProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AdminProfile_geoPoliticalZoneId_fkey" FOREIGN KEY ("geoPoliticalZoneId") REFERENCES "GeoPoliticalZone" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AdminProfile_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AdminProfile_senatorialDistrictId_fkey" FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AdminProfile_federalConstituencyId_fkey" FOREIGN KEY ("federalConstituencyId") REFERENCES "FederalConstituency" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AdminProfile_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AdminProfile_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AdminProfile_stateConstituencyId_fkey" FOREIGN KEY ("stateConstituencyId") REFERENCES "StateConstituency" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AdminProfile_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AdminProfile" ("adminLevel", "createdAt", "federalConstituencyId", "id", "lgaId", "pollingUnitId", "senatorialDistrictId", "stateConstituencyId", "stateId", "updatedAt", "userId", "wardId") SELECT "adminLevel", "createdAt", "federalConstituencyId", "id", "lgaId", "pollingUnitId", "senatorialDistrictId", "stateConstituencyId", "stateId", "updatedAt", "userId", "wardId" FROM "AdminProfile";
DROP TABLE "AdminProfile";
ALTER TABLE "new_AdminProfile" RENAME TO "AdminProfile";
CREATE UNIQUE INDEX "AdminProfile_userId_key" ON "AdminProfile"("userId");
CREATE INDEX "AdminProfile_adminLevel_idx" ON "AdminProfile"("adminLevel");
CREATE INDEX "AdminProfile_geoPoliticalZoneId_idx" ON "AdminProfile"("geoPoliticalZoneId");
CREATE INDEX "AdminProfile_stateId_idx" ON "AdminProfile"("stateId");
CREATE INDEX "AdminProfile_senatorialDistrictId_idx" ON "AdminProfile"("senatorialDistrictId");
CREATE INDEX "AdminProfile_federalConstituencyId_idx" ON "AdminProfile"("federalConstituencyId");
CREATE INDEX "AdminProfile_lgaId_idx" ON "AdminProfile"("lgaId");
CREATE INDEX "AdminProfile_wardId_idx" ON "AdminProfile"("wardId");
CREATE INDEX "AdminProfile_stateConstituencyId_idx" ON "AdminProfile"("stateConstituencyId");
CREATE INDEX "AdminProfile_pollingUnitId_idx" ON "AdminProfile"("pollingUnitId");
CREATE TABLE "new_AgentActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentUserId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "latitude" REAL,
    "longitude" REAL,
    "accuracyMeters" REAL,
    "note" TEXT,
    "geoPoliticalZoneId" TEXT,
    "stateId" TEXT NOT NULL,
    "lgaId" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "pollingUnitId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentActivity_agentUserId_fkey" FOREIGN KEY ("agentUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgentActivity_geoPoliticalZoneId_fkey" FOREIGN KEY ("geoPoliticalZoneId") REFERENCES "GeoPoliticalZone" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AgentActivity_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AgentActivity_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AgentActivity_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AgentActivity_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AgentActivity" ("accuracyMeters", "agentUserId", "createdAt", "id", "latitude", "lgaId", "longitude", "note", "pollingUnitId", "stateId", "type", "wardId") SELECT "accuracyMeters", "agentUserId", "createdAt", "id", "latitude", "lgaId", "longitude", "note", "pollingUnitId", "stateId", "type", "wardId" FROM "AgentActivity";
DROP TABLE "AgentActivity";
ALTER TABLE "new_AgentActivity" RENAME TO "AgentActivity";
CREATE INDEX "AgentActivity_geoPoliticalZoneId_idx" ON "AgentActivity"("geoPoliticalZoneId");
CREATE INDEX "AgentActivity_agentUserId_idx" ON "AgentActivity"("agentUserId");
CREATE INDEX "AgentActivity_pollingUnitId_idx" ON "AgentActivity"("pollingUnitId");
CREATE INDEX "AgentActivity_createdAt_idx" ON "AgentActivity"("createdAt");
CREATE INDEX "AgentActivity_type_idx" ON "AgentActivity"("type");
CREATE TABLE "new_AgentProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "assignedAdminUserId" TEXT,
    "geoPoliticalZoneId" TEXT,
    "stateId" TEXT NOT NULL,
    "lgaId" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "pollingUnitId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgentProfile_assignedAdminUserId_fkey" FOREIGN KEY ("assignedAdminUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AgentProfile_geoPoliticalZoneId_fkey" FOREIGN KEY ("geoPoliticalZoneId") REFERENCES "GeoPoliticalZone" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AgentProfile_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AgentProfile_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AgentProfile_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AgentProfile_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AgentProfile" ("assignedAdminUserId", "createdAt", "id", "lgaId", "pollingUnitId", "stateId", "updatedAt", "userId", "wardId") SELECT "assignedAdminUserId", "createdAt", "id", "lgaId", "pollingUnitId", "stateId", "updatedAt", "userId", "wardId" FROM "AgentProfile";
DROP TABLE "AgentProfile";
ALTER TABLE "new_AgentProfile" RENAME TO "AgentProfile";
CREATE UNIQUE INDEX "AgentProfile_userId_key" ON "AgentProfile"("userId");
CREATE INDEX "AgentProfile_geoPoliticalZoneId_idx" ON "AgentProfile"("geoPoliticalZoneId");
CREATE INDEX "AgentProfile_assignedAdminUserId_idx" ON "AgentProfile"("assignedAdminUserId");
CREATE INDEX "AgentProfile_stateId_idx" ON "AgentProfile"("stateId");
CREATE INDEX "AgentProfile_lgaId_idx" ON "AgentProfile"("lgaId");
CREATE INDEX "AgentProfile_wardId_idx" ON "AgentProfile"("wardId");
CREATE INDEX "AgentProfile_pollingUnitId_idx" ON "AgentProfile"("pollingUnitId");
CREATE TABLE "new_CandidateProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "officeType" TEXT NOT NULL,
    "geoPoliticalZoneId" TEXT,
    "politicalPartyId" TEXT,
    "stateId" TEXT,
    "senatorialDistrictId" TEXT,
    "federalConstituencyId" TEXT,
    "lgaId" TEXT,
    "wardId" TEXT,
    "stateConstituencyId" TEXT,
    "pollingUnitId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CandidateProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CandidateProfile_geoPoliticalZoneId_fkey" FOREIGN KEY ("geoPoliticalZoneId") REFERENCES "GeoPoliticalZone" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CandidateProfile_politicalPartyId_fkey" FOREIGN KEY ("politicalPartyId") REFERENCES "PoliticalParty" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CandidateProfile_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CandidateProfile_senatorialDistrictId_fkey" FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CandidateProfile_federalConstituencyId_fkey" FOREIGN KEY ("federalConstituencyId") REFERENCES "FederalConstituency" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CandidateProfile_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CandidateProfile_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CandidateProfile_stateConstituencyId_fkey" FOREIGN KEY ("stateConstituencyId") REFERENCES "StateConstituency" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CandidateProfile_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CandidateProfile" ("createdAt", "federalConstituencyId", "id", "lgaId", "officeType", "pollingUnitId", "senatorialDistrictId", "stateConstituencyId", "stateId", "updatedAt", "userId", "wardId") SELECT "createdAt", "federalConstituencyId", "id", "lgaId", "officeType", "pollingUnitId", "senatorialDistrictId", "stateConstituencyId", "stateId", "updatedAt", "userId", "wardId" FROM "CandidateProfile";
DROP TABLE "CandidateProfile";
ALTER TABLE "new_CandidateProfile" RENAME TO "CandidateProfile";
CREATE UNIQUE INDEX "CandidateProfile_userId_key" ON "CandidateProfile"("userId");
CREATE INDEX "CandidateProfile_officeType_idx" ON "CandidateProfile"("officeType");
CREATE INDEX "CandidateProfile_geoPoliticalZoneId_idx" ON "CandidateProfile"("geoPoliticalZoneId");
CREATE INDEX "CandidateProfile_politicalPartyId_idx" ON "CandidateProfile"("politicalPartyId");
CREATE INDEX "CandidateProfile_stateId_idx" ON "CandidateProfile"("stateId");
CREATE INDEX "CandidateProfile_senatorialDistrictId_idx" ON "CandidateProfile"("senatorialDistrictId");
CREATE INDEX "CandidateProfile_federalConstituencyId_idx" ON "CandidateProfile"("federalConstituencyId");
CREATE INDEX "CandidateProfile_lgaId_idx" ON "CandidateProfile"("lgaId");
CREATE INDEX "CandidateProfile_wardId_idx" ON "CandidateProfile"("wardId");
CREATE INDEX "CandidateProfile_stateConstituencyId_idx" ON "CandidateProfile"("stateConstituencyId");
CREATE INDEX "CandidateProfile_pollingUnitId_idx" ON "CandidateProfile"("pollingUnitId");
CREATE TABLE "new_Feedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "voterUserId" TEXT,
    "agentUserId" TEXT,
    "candidateUserId" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "geoPoliticalZoneId" TEXT,
    "stateId" TEXT NOT NULL,
    "senatorialDistrictId" TEXT,
    "lgaId" TEXT NOT NULL,
    "wardId" TEXT,
    "pollingUnitId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Feedback_voterUserId_fkey" FOREIGN KEY ("voterUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Feedback_agentUserId_fkey" FOREIGN KEY ("agentUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Feedback_candidateUserId_fkey" FOREIGN KEY ("candidateUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Feedback_geoPoliticalZoneId_fkey" FOREIGN KEY ("geoPoliticalZoneId") REFERENCES "GeoPoliticalZone" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Feedback_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Feedback_senatorialDistrictId_fkey" FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Feedback_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Feedback_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Feedback_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Feedback" ("agentUserId", "candidateUserId", "createdAt", "id", "lgaId", "message", "pollingUnitId", "senatorialDistrictId", "stateId", "type", "voterUserId", "wardId") SELECT "agentUserId", "candidateUserId", "createdAt", "id", "lgaId", "message", "pollingUnitId", "senatorialDistrictId", "stateId", "type", "voterUserId", "wardId" FROM "Feedback";
DROP TABLE "Feedback";
ALTER TABLE "new_Feedback" RENAME TO "Feedback";
CREATE INDEX "Feedback_geoPoliticalZoneId_idx" ON "Feedback"("geoPoliticalZoneId");
CREATE INDEX "Feedback_voterUserId_idx" ON "Feedback"("voterUserId");
CREATE INDEX "Feedback_agentUserId_idx" ON "Feedback"("agentUserId");
CREATE INDEX "Feedback_candidateUserId_idx" ON "Feedback"("candidateUserId");
CREATE INDEX "Feedback_stateId_idx" ON "Feedback"("stateId");
CREATE INDEX "Feedback_senatorialDistrictId_idx" ON "Feedback"("senatorialDistrictId");
CREATE INDEX "Feedback_lgaId_idx" ON "Feedback"("lgaId");
CREATE INDEX "Feedback_wardId_idx" ON "Feedback"("wardId");
CREATE INDEX "Feedback_pollingUnitId_idx" ON "Feedback"("pollingUnitId");
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");
CREATE TABLE "new_Incident" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportedByUserId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "latitude" REAL,
    "longitude" REAL,
    "geoPoliticalZoneId" TEXT,
    "stateId" TEXT NOT NULL,
    "senatorialDistrictId" TEXT,
    "lgaId" TEXT NOT NULL,
    "wardId" TEXT,
    "pollingUnitId" TEXT,
    "assignedAdminUserId" TEXT,
    "escalatedAt" DATETIME,
    "escalatedByUserId" TEXT,
    "escalationNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Incident_reportedByUserId_fkey" FOREIGN KEY ("reportedByUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Incident_geoPoliticalZoneId_fkey" FOREIGN KEY ("geoPoliticalZoneId") REFERENCES "GeoPoliticalZone" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Incident_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Incident_senatorialDistrictId_fkey" FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Incident_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Incident_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Incident_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Incident_assignedAdminUserId_fkey" FOREIGN KEY ("assignedAdminUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Incident_escalatedByUserId_fkey" FOREIGN KEY ("escalatedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Incident" ("assignedAdminUserId", "createdAt", "description", "escalatedAt", "escalatedByUserId", "escalationNote", "id", "latitude", "lgaId", "longitude", "pollingUnitId", "reportedByUserId", "senatorialDistrictId", "severity", "stateId", "status", "title", "type", "updatedAt", "wardId") SELECT "assignedAdminUserId", "createdAt", "description", "escalatedAt", "escalatedByUserId", "escalationNote", "id", "latitude", "lgaId", "longitude", "pollingUnitId", "reportedByUserId", "senatorialDistrictId", "severity", "stateId", "status", "title", "type", "updatedAt", "wardId" FROM "Incident";
DROP TABLE "Incident";
ALTER TABLE "new_Incident" RENAME TO "Incident";
CREATE INDEX "Incident_geoPoliticalZoneId_idx" ON "Incident"("geoPoliticalZoneId");
CREATE INDEX "Incident_reportedByUserId_idx" ON "Incident"("reportedByUserId");
CREATE INDEX "Incident_stateId_idx" ON "Incident"("stateId");
CREATE INDEX "Incident_senatorialDistrictId_idx" ON "Incident"("senatorialDistrictId");
CREATE INDEX "Incident_lgaId_idx" ON "Incident"("lgaId");
CREATE INDEX "Incident_wardId_idx" ON "Incident"("wardId");
CREATE INDEX "Incident_pollingUnitId_idx" ON "Incident"("pollingUnitId");
CREATE INDEX "Incident_assignedAdminUserId_idx" ON "Incident"("assignedAdminUserId");
CREATE INDEX "Incident_escalatedByUserId_idx" ON "Incident"("escalatedByUserId");
CREATE INDEX "Incident_createdAt_idx" ON "Incident"("createdAt");
CREATE TABLE "new_Poll" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "candidateUserId" TEXT,
    "officeType" TEXT,
    "geoPoliticalZoneId" TEXT,
    "stateId" TEXT,
    "senatorialDistrictId" TEXT,
    "federalConstituencyId" TEXT,
    "lgaId" TEXT,
    "wardId" TEXT,
    "stateConstituencyId" TEXT,
    "pollingUnitId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Poll_candidateUserId_fkey" FOREIGN KEY ("candidateUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Poll_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Poll_geoPoliticalZoneId_fkey" FOREIGN KEY ("geoPoliticalZoneId") REFERENCES "GeoPoliticalZone" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Poll_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Poll_senatorialDistrictId_fkey" FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Poll_federalConstituencyId_fkey" FOREIGN KEY ("federalConstituencyId") REFERENCES "FederalConstituency" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Poll_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Poll_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Poll_stateConstituencyId_fkey" FOREIGN KEY ("stateConstituencyId") REFERENCES "StateConstituency" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Poll_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Poll" ("candidateUserId", "createdAt", "createdByUserId", "description", "federalConstituencyId", "id", "isActive", "lgaId", "officeType", "pollingUnitId", "senatorialDistrictId", "stateConstituencyId", "stateId", "title", "updatedAt", "wardId") SELECT "candidateUserId", "createdAt", "createdByUserId", "description", "federalConstituencyId", "id", "isActive", "lgaId", "officeType", "pollingUnitId", "senatorialDistrictId", "stateConstituencyId", "stateId", "title", "updatedAt", "wardId" FROM "Poll";
DROP TABLE "Poll";
ALTER TABLE "new_Poll" RENAME TO "Poll";
CREATE INDEX "Poll_geoPoliticalZoneId_idx" ON "Poll"("geoPoliticalZoneId");
CREATE INDEX "Poll_candidateUserId_idx" ON "Poll"("candidateUserId");
CREATE INDEX "Poll_officeType_idx" ON "Poll"("officeType");
CREATE INDEX "Poll_isActive_idx" ON "Poll"("isActive");
CREATE INDEX "Poll_stateId_idx" ON "Poll"("stateId");
CREATE INDEX "Poll_senatorialDistrictId_idx" ON "Poll"("senatorialDistrictId");
CREATE INDEX "Poll_federalConstituencyId_idx" ON "Poll"("federalConstituencyId");
CREATE INDEX "Poll_lgaId_idx" ON "Poll"("lgaId");
CREATE INDEX "Poll_wardId_idx" ON "Poll"("wardId");
CREATE INDEX "Poll_stateConstituencyId_idx" ON "Poll"("stateConstituencyId");
CREATE INDEX "Poll_pollingUnitId_idx" ON "Poll"("pollingUnitId");
CREATE TABLE "new_Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "authorUserId" TEXT NOT NULL,
    "candidateUserId" TEXT,
    "geoPoliticalZoneId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "stateId" TEXT,
    "senatorialDistrictId" TEXT,
    "federalConstituencyId" TEXT,
    "lgaId" TEXT,
    "wardId" TEXT,
    "stateConstituencyId" TEXT,
    "pollingUnitId" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Post_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Post_candidateUserId_fkey" FOREIGN KEY ("candidateUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Post_geoPoliticalZoneId_fkey" FOREIGN KEY ("geoPoliticalZoneId") REFERENCES "GeoPoliticalZone" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Post_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Post_senatorialDistrictId_fkey" FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Post_federalConstituencyId_fkey" FOREIGN KEY ("federalConstituencyId") REFERENCES "FederalConstituency" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Post_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Post_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Post_stateConstituencyId_fkey" FOREIGN KEY ("stateConstituencyId") REFERENCES "StateConstituency" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Post_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Post" ("authorUserId", "candidateUserId", "content", "createdAt", "federalConstituencyId", "id", "isPublished", "lgaId", "pollingUnitId", "senatorialDistrictId", "stateConstituencyId", "stateId", "title", "updatedAt", "wardId") SELECT "authorUserId", "candidateUserId", "content", "createdAt", "federalConstituencyId", "id", "isPublished", "lgaId", "pollingUnitId", "senatorialDistrictId", "stateConstituencyId", "stateId", "title", "updatedAt", "wardId" FROM "Post";
DROP TABLE "Post";
ALTER TABLE "new_Post" RENAME TO "Post";
CREATE INDEX "Post_geoPoliticalZoneId_idx" ON "Post"("geoPoliticalZoneId");
CREATE INDEX "Post_authorUserId_idx" ON "Post"("authorUserId");
CREATE INDEX "Post_candidateUserId_idx" ON "Post"("candidateUserId");
CREATE INDEX "Post_isPublished_idx" ON "Post"("isPublished");
CREATE INDEX "Post_stateId_idx" ON "Post"("stateId");
CREATE INDEX "Post_senatorialDistrictId_idx" ON "Post"("senatorialDistrictId");
CREATE INDEX "Post_federalConstituencyId_idx" ON "Post"("federalConstituencyId");
CREATE INDEX "Post_lgaId_idx" ON "Post"("lgaId");
CREATE INDEX "Post_wardId_idx" ON "Post"("wardId");
CREATE INDEX "Post_stateConstituencyId_idx" ON "Post"("stateConstituencyId");
CREATE INDEX "Post_pollingUnitId_idx" ON "Post"("pollingUnitId");
CREATE TABLE "new_State" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "geoPoliticalZoneId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "State_geoPoliticalZoneId_fkey" FOREIGN KEY ("geoPoliticalZoneId") REFERENCES "GeoPoliticalZone" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_State" ("createdAt", "id", "name", "updatedAt") SELECT "createdAt", "id", "name", "updatedAt" FROM "State";
DROP TABLE "State";
ALTER TABLE "new_State" RENAME TO "State";
CREATE UNIQUE INDEX "State_name_key" ON "State"("name");
CREATE INDEX "State_geoPoliticalZoneId_idx" ON "State"("geoPoliticalZoneId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "email", "id", "name", "passwordHash", "phone", "role", "updatedAt") SELECT "createdAt", "email", "id", "name", "passwordHash", "phone", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_isActive_idx" ON "User"("isActive");
CREATE TABLE "new_VoterProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "voterCardNumber" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "referredByUserId" TEXT,
    "geoPoliticalZoneId" TEXT,
    "stateId" TEXT NOT NULL,
    "lgaId" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VoterProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VoterProfile_referredByUserId_fkey" FOREIGN KEY ("referredByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VoterProfile_geoPoliticalZoneId_fkey" FOREIGN KEY ("geoPoliticalZoneId") REFERENCES "GeoPoliticalZone" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VoterProfile_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VoterProfile_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VoterProfile_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_VoterProfile" ("createdAt", "id", "lgaId", "referralCode", "referredByUserId", "stateId", "updatedAt", "userId", "voterCardNumber", "wardId") SELECT "createdAt", "id", "lgaId", "referralCode", "referredByUserId", "stateId", "updatedAt", "userId", "voterCardNumber", "wardId" FROM "VoterProfile";
DROP TABLE "VoterProfile";
ALTER TABLE "new_VoterProfile" RENAME TO "VoterProfile";
CREATE UNIQUE INDEX "VoterProfile_userId_key" ON "VoterProfile"("userId");
CREATE UNIQUE INDEX "VoterProfile_voterCardNumber_key" ON "VoterProfile"("voterCardNumber");
CREATE UNIQUE INDEX "VoterProfile_referralCode_key" ON "VoterProfile"("referralCode");
CREATE INDEX "VoterProfile_geoPoliticalZoneId_idx" ON "VoterProfile"("geoPoliticalZoneId");
CREATE INDEX "VoterProfile_stateId_idx" ON "VoterProfile"("stateId");
CREATE INDEX "VoterProfile_lgaId_idx" ON "VoterProfile"("lgaId");
CREATE INDEX "VoterProfile_wardId_idx" ON "VoterProfile"("wardId");
CREATE INDEX "VoterProfile_referredByUserId_idx" ON "VoterProfile"("referredByUserId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "GeoPoliticalZone_name_key" ON "GeoPoliticalZone"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PoliticalParty_name_key" ON "PoliticalParty"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PoliticalParty_code_key" ON "PoliticalParty"("code");
