CREATE TABLE "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "passwordHash" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "State" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "SenatorialDistrict" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "stateId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "SenatorialDistrict_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "FederalConstituency" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "stateId" TEXT NOT NULL,
  "senatorialDistrictId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "FederalConstituency_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FederalConstituency_senatorialDistrictId_fkey" FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "LGA" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "stateId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "LGA_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Ward" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "stateId" TEXT NOT NULL,
  "lgaId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Ward_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Ward_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "StateConstituency" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "stateId" TEXT NOT NULL,
  "lgaId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "StateConstituency_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StateConstituency_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "PollingUnit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "stateId" TEXT NOT NULL,
  "lgaId" TEXT NOT NULL,
  "wardId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "PollingUnit_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PollingUnit_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PollingUnit_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "AdminProfile" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "adminLevel" TEXT NOT NULL,
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
  CONSTRAINT "AdminProfile_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AdminProfile_senatorialDistrictId_fkey" FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AdminProfile_federalConstituencyId_fkey" FOREIGN KEY ("federalConstituencyId") REFERENCES "FederalConstituency" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AdminProfile_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AdminProfile_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AdminProfile_stateConstituencyId_fkey" FOREIGN KEY ("stateConstituencyId") REFERENCES "StateConstituency" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AdminProfile_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "CandidateProfile" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "officeType" TEXT NOT NULL,
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
  CONSTRAINT "CandidateProfile_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "CandidateProfile_senatorialDistrictId_fkey" FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "CandidateProfile_federalConstituencyId_fkey" FOREIGN KEY ("federalConstituencyId") REFERENCES "FederalConstituency" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "CandidateProfile_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "CandidateProfile_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "CandidateProfile_stateConstituencyId_fkey" FOREIGN KEY ("stateConstituencyId") REFERENCES "StateConstituency" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "CandidateProfile_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "AgentProfile" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "assignedAdminUserId" TEXT,
  "stateId" TEXT NOT NULL,
  "lgaId" TEXT NOT NULL,
  "wardId" TEXT NOT NULL,
  "pollingUnitId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "AgentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AgentProfile_assignedAdminUserId_fkey" FOREIGN KEY ("assignedAdminUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AgentProfile_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AgentProfile_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AgentProfile_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AgentProfile_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "VoterProfile" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "voterCardNumber" TEXT NOT NULL,
  "referralCode" TEXT NOT NULL,
  "referredByUserId" TEXT,
  "stateId" TEXT NOT NULL,
  "lgaId" TEXT NOT NULL,
  "wardId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "VoterProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "VoterProfile_referredByUserId_fkey" FOREIGN KEY ("referredByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "VoterProfile_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "VoterProfile_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "VoterProfile_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "AdminCandidateAssignment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "adminUserId" TEXT NOT NULL,
  "candidateUserId" TEXT NOT NULL,
  "permissionType" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminCandidateAssignment_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AdminCandidateAssignment_candidateUserId_fkey" FOREIGN KEY ("candidateUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "RewardLedger" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "voterUserId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "points" INTEGER NOT NULL,
  "amount" REAL,
  "description" TEXT NOT NULL,
  "relatedUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RewardLedger_voterUserId_fkey" FOREIGN KEY ("voterUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RewardLedger_relatedUserId_fkey" FOREIGN KEY ("relatedUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "RewardRedemption" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "voterUserId" TEXT NOT NULL,
  "pointsRequested" INTEGER NOT NULL,
  "amountRequested" REAL,
  "status" TEXT NOT NULL,
  "note" TEXT,
  "reviewedByUserId" TEXT,
  "reviewedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "RewardRedemption_voterUserId_fkey" FOREIGN KEY ("voterUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RewardRedemption_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "Poll" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "candidateUserId" TEXT,
  "officeType" TEXT,
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
  CONSTRAINT "Poll_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Poll_senatorialDistrictId_fkey" FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Poll_federalConstituencyId_fkey" FOREIGN KEY ("federalConstituencyId") REFERENCES "FederalConstituency" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Poll_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Poll_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Poll_stateConstituencyId_fkey" FOREIGN KEY ("stateConstituencyId") REFERENCES "StateConstituency" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Poll_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "PollOption" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "pollId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "PollResponse" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "pollId" TEXT NOT NULL,
  "voterUserId" TEXT NOT NULL,
  "optionId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "PollResponse_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PollResponse_voterUserId_fkey" FOREIGN KEY ("voterUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PollResponse_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "PollOption" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Post" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "authorUserId" TEXT NOT NULL,
  "candidateUserId" TEXT,
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
  CONSTRAINT "Post_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Post_senatorialDistrictId_fkey" FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Post_federalConstituencyId_fkey" FOREIGN KEY ("federalConstituencyId") REFERENCES "FederalConstituency" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Post_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Post_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Post_stateConstituencyId_fkey" FOREIGN KEY ("stateConstituencyId") REFERENCES "StateConstituency" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Post_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "ParticipationEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "voterUserId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "pointsAwarded" INTEGER NOT NULL,
  "relatedPollId" TEXT,
  "relatedPostId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ParticipationEvent_voterUserId_fkey" FOREIGN KEY ("voterUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ParticipationEvent_relatedPollId_fkey" FOREIGN KEY ("relatedPollId") REFERENCES "Poll" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ParticipationEvent_relatedPostId_fkey" FOREIGN KEY ("relatedPostId") REFERENCES "Post" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "Feedback" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "voterUserId" TEXT,
  "agentUserId" TEXT,
  "candidateUserId" TEXT,
  "type" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "stateId" TEXT NOT NULL,
  "senatorialDistrictId" TEXT,
  "lgaId" TEXT NOT NULL,
  "wardId" TEXT,
  "pollingUnitId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Feedback_voterUserId_fkey" FOREIGN KEY ("voterUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Feedback_agentUserId_fkey" FOREIGN KEY ("agentUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Feedback_candidateUserId_fkey" FOREIGN KEY ("candidateUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Feedback_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Feedback_senatorialDistrictId_fkey" FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Feedback_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Feedback_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Feedback_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "metadataJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "MediaAttachment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "uploaderUserId" TEXT NOT NULL,
  "incidentId" TEXT,
  "feedbackId" TEXT,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediaAttachment_uploaderUserId_fkey" FOREIGN KEY ("uploaderUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MediaAttachment_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "MediaAttachment_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "Feedback" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "AgentActivity" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "agentUserId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "latitude" REAL,
  "longitude" REAL,
  "accuracyMeters" REAL,
  "note" TEXT,
  "stateId" TEXT NOT NULL,
  "lgaId" TEXT NOT NULL,
  "wardId" TEXT NOT NULL,
  "pollingUnitId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentActivity_agentUserId_fkey" FOREIGN KEY ("agentUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AgentActivity_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AgentActivity_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AgentActivity_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AgentActivity_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "Incident" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "reportedByUserId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "latitude" REAL,
  "longitude" REAL,
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
  CONSTRAINT "Incident_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Incident_senatorialDistrictId_fkey" FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Incident_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Incident_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Incident_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Incident_assignedAdminUserId_fkey" FOREIGN KEY ("assignedAdminUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Incident_escalatedByUserId_fkey" FOREIGN KEY ("escalatedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE UNIQUE INDEX "State_name_key" ON "State"("name");
CREATE UNIQUE INDEX "SenatorialDistrict_stateId_name_key" ON "SenatorialDistrict"("stateId", "name");
CREATE INDEX "SenatorialDistrict_stateId_idx" ON "SenatorialDistrict"("stateId");
CREATE UNIQUE INDEX "FederalConstituency_stateId_name_key" ON "FederalConstituency"("stateId", "name");
CREATE INDEX "FederalConstituency_stateId_idx" ON "FederalConstituency"("stateId");
CREATE INDEX "FederalConstituency_senatorialDistrictId_idx" ON "FederalConstituency"("senatorialDistrictId");
CREATE UNIQUE INDEX "LGA_stateId_name_key" ON "LGA"("stateId", "name");
CREATE INDEX "LGA_stateId_idx" ON "LGA"("stateId");
CREATE UNIQUE INDEX "Ward_lgaId_name_key" ON "Ward"("lgaId", "name");
CREATE INDEX "Ward_stateId_idx" ON "Ward"("stateId");
CREATE INDEX "Ward_lgaId_idx" ON "Ward"("lgaId");
CREATE UNIQUE INDEX "StateConstituency_stateId_name_key" ON "StateConstituency"("stateId", "name");
CREATE INDEX "StateConstituency_stateId_idx" ON "StateConstituency"("stateId");
CREATE INDEX "StateConstituency_lgaId_idx" ON "StateConstituency"("lgaId");
CREATE UNIQUE INDEX "PollingUnit_wardId_name_key" ON "PollingUnit"("wardId", "name");
CREATE INDEX "PollingUnit_stateId_idx" ON "PollingUnit"("stateId");
CREATE INDEX "PollingUnit_lgaId_idx" ON "PollingUnit"("lgaId");
CREATE INDEX "PollingUnit_wardId_idx" ON "PollingUnit"("wardId");
CREATE UNIQUE INDEX "AdminProfile_userId_key" ON "AdminProfile"("userId");
CREATE INDEX "AdminProfile_adminLevel_idx" ON "AdminProfile"("adminLevel");
CREATE INDEX "AdminProfile_stateId_idx" ON "AdminProfile"("stateId");
CREATE INDEX "AdminProfile_senatorialDistrictId_idx" ON "AdminProfile"("senatorialDistrictId");
CREATE INDEX "AdminProfile_federalConstituencyId_idx" ON "AdminProfile"("federalConstituencyId");
CREATE INDEX "AdminProfile_lgaId_idx" ON "AdminProfile"("lgaId");
CREATE INDEX "AdminProfile_wardId_idx" ON "AdminProfile"("wardId");
CREATE INDEX "AdminProfile_stateConstituencyId_idx" ON "AdminProfile"("stateConstituencyId");
CREATE INDEX "AdminProfile_pollingUnitId_idx" ON "AdminProfile"("pollingUnitId");
CREATE UNIQUE INDEX "CandidateProfile_userId_key" ON "CandidateProfile"("userId");
CREATE INDEX "CandidateProfile_officeType_idx" ON "CandidateProfile"("officeType");
CREATE INDEX "CandidateProfile_stateId_idx" ON "CandidateProfile"("stateId");
CREATE INDEX "CandidateProfile_senatorialDistrictId_idx" ON "CandidateProfile"("senatorialDistrictId");
CREATE INDEX "CandidateProfile_federalConstituencyId_idx" ON "CandidateProfile"("federalConstituencyId");
CREATE INDEX "CandidateProfile_lgaId_idx" ON "CandidateProfile"("lgaId");
CREATE INDEX "CandidateProfile_wardId_idx" ON "CandidateProfile"("wardId");
CREATE INDEX "CandidateProfile_stateConstituencyId_idx" ON "CandidateProfile"("stateConstituencyId");
CREATE INDEX "CandidateProfile_pollingUnitId_idx" ON "CandidateProfile"("pollingUnitId");
CREATE UNIQUE INDEX "AgentProfile_userId_key" ON "AgentProfile"("userId");
CREATE INDEX "AgentProfile_assignedAdminUserId_idx" ON "AgentProfile"("assignedAdminUserId");
CREATE INDEX "AgentProfile_stateId_idx" ON "AgentProfile"("stateId");
CREATE INDEX "AgentProfile_lgaId_idx" ON "AgentProfile"("lgaId");
CREATE INDEX "AgentProfile_wardId_idx" ON "AgentProfile"("wardId");
CREATE INDEX "AgentProfile_pollingUnitId_idx" ON "AgentProfile"("pollingUnitId");
CREATE UNIQUE INDEX "VoterProfile_userId_key" ON "VoterProfile"("userId");
CREATE UNIQUE INDEX "VoterProfile_voterCardNumber_key" ON "VoterProfile"("voterCardNumber");
CREATE UNIQUE INDEX "VoterProfile_referralCode_key" ON "VoterProfile"("referralCode");
CREATE INDEX "VoterProfile_stateId_idx" ON "VoterProfile"("stateId");
CREATE INDEX "VoterProfile_lgaId_idx" ON "VoterProfile"("lgaId");
CREATE INDEX "VoterProfile_wardId_idx" ON "VoterProfile"("wardId");
CREATE INDEX "VoterProfile_referredByUserId_idx" ON "VoterProfile"("referredByUserId");
CREATE UNIQUE INDEX "AdminCandidateAssignment_adminUserId_candidateUserId_permissionType_key" ON "AdminCandidateAssignment"("adminUserId", "candidateUserId", "permissionType");
CREATE INDEX "AdminCandidateAssignment_candidateUserId_idx" ON "AdminCandidateAssignment"("candidateUserId");
CREATE INDEX "AdminCandidateAssignment_permissionType_idx" ON "AdminCandidateAssignment"("permissionType");
CREATE INDEX "RewardLedger_voterUserId_createdAt_idx" ON "RewardLedger"("voterUserId", "createdAt");
CREATE INDEX "RewardLedger_type_idx" ON "RewardLedger"("type");
CREATE UNIQUE INDEX "RewardLedger_voterUserId_type_relatedUserId_key" ON "RewardLedger"("voterUserId", "type", "relatedUserId");
CREATE INDEX "RewardRedemption_voterUserId_idx" ON "RewardRedemption"("voterUserId");
CREATE INDEX "RewardRedemption_status_idx" ON "RewardRedemption"("status");
CREATE INDEX "RewardRedemption_reviewedByUserId_idx" ON "RewardRedemption"("reviewedByUserId");
CREATE INDEX "RewardRedemption_createdAt_idx" ON "RewardRedemption"("createdAt");
CREATE INDEX "ParticipationEvent_voterUserId_createdAt_idx" ON "ParticipationEvent"("voterUserId", "createdAt");
CREATE INDEX "ParticipationEvent_type_idx" ON "ParticipationEvent"("type");
CREATE INDEX "ParticipationEvent_relatedPollId_idx" ON "ParticipationEvent"("relatedPollId");
CREATE INDEX "ParticipationEvent_relatedPostId_idx" ON "ParticipationEvent"("relatedPostId");
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
CREATE UNIQUE INDEX "PollOption_pollId_label_key" ON "PollOption"("pollId", "label");
CREATE INDEX "PollOption_pollId_idx" ON "PollOption"("pollId");
CREATE UNIQUE INDEX "PollResponse_pollId_voterUserId_key" ON "PollResponse"("pollId", "voterUserId");
CREATE INDEX "PollResponse_optionId_idx" ON "PollResponse"("optionId");
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
CREATE INDEX "Feedback_voterUserId_idx" ON "Feedback"("voterUserId");
CREATE INDEX "Feedback_agentUserId_idx" ON "Feedback"("agentUserId");
CREATE INDEX "Feedback_candidateUserId_idx" ON "Feedback"("candidateUserId");
CREATE INDEX "Feedback_stateId_idx" ON "Feedback"("stateId");
CREATE INDEX "Feedback_senatorialDistrictId_idx" ON "Feedback"("senatorialDistrictId");
CREATE INDEX "Feedback_lgaId_idx" ON "Feedback"("lgaId");
CREATE INDEX "Feedback_wardId_idx" ON "Feedback"("wardId");
CREATE INDEX "Feedback_pollingUnitId_idx" ON "Feedback"("pollingUnitId");
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "MediaAttachment_uploaderUserId_idx" ON "MediaAttachment"("uploaderUserId");
CREATE INDEX "MediaAttachment_incidentId_idx" ON "MediaAttachment"("incidentId");
CREATE INDEX "MediaAttachment_feedbackId_idx" ON "MediaAttachment"("feedbackId");
CREATE INDEX "MediaAttachment_createdAt_idx" ON "MediaAttachment"("createdAt");
CREATE INDEX "AgentActivity_agentUserId_idx" ON "AgentActivity"("agentUserId");
CREATE INDEX "AgentActivity_pollingUnitId_idx" ON "AgentActivity"("pollingUnitId");
CREATE INDEX "AgentActivity_createdAt_idx" ON "AgentActivity"("createdAt");
CREATE INDEX "AgentActivity_type_idx" ON "AgentActivity"("type");
CREATE INDEX "Incident_reportedByUserId_idx" ON "Incident"("reportedByUserId");
CREATE INDEX "Incident_stateId_idx" ON "Incident"("stateId");
CREATE INDEX "Incident_senatorialDistrictId_idx" ON "Incident"("senatorialDistrictId");
CREATE INDEX "Incident_lgaId_idx" ON "Incident"("lgaId");
CREATE INDEX "Incident_wardId_idx" ON "Incident"("wardId");
CREATE INDEX "Incident_pollingUnitId_idx" ON "Incident"("pollingUnitId");
CREATE INDEX "Incident_assignedAdminUserId_idx" ON "Incident"("assignedAdminUserId");
CREATE INDEX "Incident_escalatedByUserId_idx" ON "Incident"("escalatedByUserId");
CREATE INDEX "Incident_createdAt_idx" ON "Incident"("createdAt");
