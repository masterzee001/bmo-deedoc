-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'CANDIDATE', 'AGENT', 'VOTER');

-- CreateEnum
CREATE TYPE "AdminLevel" AS ENUM ('NATIONAL', 'GEO_POLITICAL_ZONE', 'STATE', 'SENATORIAL', 'FEDERAL_CONSTITUENCY', 'STATE_CONSTITUENCY', 'LGA', 'WARD');

-- CreateEnum
CREATE TYPE "CandidateOfficeType" AS ENUM ('PRESIDENTIAL', 'GOVERNORSHIP', 'SENATE', 'HOUSE_OF_REP', 'STATE_ASSEMBLY', 'CHAIRMANSHIP', 'COUNCILLOR');

-- CreateEnum
CREATE TYPE "RewardType" AS ENUM ('PARTICIPATION', 'REFERRAL', 'BONUS', 'MANUAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "RewardRedemptionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PAID');

-- CreateEnum
CREATE TYPE "AssignmentPermissionType" AS ENUM ('VIEW', 'MANAGE', 'PUBLISH', 'MODERATE');

-- CreateEnum
CREATE TYPE "AgentActivityType" AS ENUM ('CHECK_IN', 'CHECK_OUT', 'LOCATION_PING', 'INCIDENT_RESPONSE', 'VOTER_OUTREACH', 'MATERIAL_DISTRIBUTION', 'OBSERVATION');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('VIOLENCE', 'INTIMIDATION', 'VOTE_BUYING', 'MATERIAL_SHORTAGE', 'LOGISTICS_DELAY', 'MALFUNCTION', 'SECURITY_CONCERN', 'OTHER');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('REWARD_EARNED', 'REWARD_REDEMPTION', 'INCIDENT_ASSIGNED', 'INCIDENT_UPDATED', 'POLL_CREATED', 'POST_PUBLISHED', 'SYSTEM');

-- CreateEnum
CREATE TYPE "FieldTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE');

-- CreateEnum
CREATE TYPE "FieldTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "BroadcastAudience" AS ENUM ('ALL', 'ADMINS', 'AGENTS', 'VOTERS', 'CANDIDATES');

-- CreateEnum
CREATE TYPE "CampaignMediaType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "CampaignEventRsvpStatus" AS ENUM ('INTERESTED', 'GOING');

-- CreateEnum
CREATE TYPE "CandidateMediaAssetKind" AS ENUM ('PROFILE_PHOTO', 'EVENT_COVER');

-- CreateEnum
CREATE TYPE "ElectionDayOpeningStatus" AS ENUM ('OPENED_ON_TIME', 'OPENED_LATE', 'NOT_OPEN');

-- CreateEnum
CREATE TYPE "ElectionDayReportStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ElectionDayReportAssetKind" AS ENUM ('ARRIVAL_PHOTO', 'POST_COUNTING_PHOTO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "adminLevel" "AdminLevel" NOT NULL,
    "politicalPartyId" TEXT,
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

    CONSTRAINT "AdminProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "officeType" "CandidateOfficeType" NOT NULL,
    "geoPoliticalZoneId" TEXT,
    "politicalPartyId" TEXT,
    "portraitUrl" TEXT,
    "portraitAssetId" TEXT,
    "campaignSlogan" TEXT,
    "bio" TEXT,
    "websiteUrl" TEXT,
    "facebookUrl" TEXT,
    "instagramUrl" TEXT,
    "xUrl" TEXT,
    "isProfilePublished" BOOLEAN NOT NULL DEFAULT false,
    "stateId" TEXT,
    "senatorialDistrictId" TEXT,
    "federalConstituencyId" TEXT,
    "lgaId" TEXT,
    "wardId" TEXT,
    "stateConstituencyId" TEXT,
    "pollingUnitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAdminUserId" TEXT,
    "politicalPartyId" TEXT,
    "gpsTrackingConsentAt" TIMESTAMP(3),
    "activeSessionNonce" TEXT,
    "geoPoliticalZoneId" TEXT,
    "stateId" TEXT NOT NULL,
    "senatorialDistrictId" TEXT,
    "federalConstituencyId" TEXT,
    "lgaId" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "stateConstituencyId" TEXT,
    "pollingUnitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoterProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voterCardNumber" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "referredByUserId" TEXT,
    "contactConsent" BOOLEAN NOT NULL DEFAULT false,
    "termsAcceptedAt" TIMESTAMP(3),
    "geoPoliticalZoneId" TEXT,
    "stateId" TEXT NOT NULL,
    "senatorialDistrictId" TEXT,
    "federalConstituencyId" TEXT,
    "lgaId" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "stateConstituencyId" TEXT,
    "pollingUnitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoterProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "AdminCandidateAssignment" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "candidateUserId" TEXT NOT NULL,
    "permissionType" "AssignmentPermissionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminCandidateAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardLedger" (
    "id" TEXT NOT NULL,
    "voterUserId" TEXT NOT NULL,
    "type" "RewardType" NOT NULL,
    "points" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION,
    "description" TEXT NOT NULL,
    "relatedUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParticipationEvent" (
    "id" TEXT NOT NULL,
    "voterUserId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "pointsAwarded" INTEGER NOT NULL,
    "relatedPollId" TEXT,
    "relatedPostId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParticipationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignEvent" (
    "id" TEXT NOT NULL,
    "candidateUserId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "coverImageUrl" TEXT,
    "coverImageAssetId" TEXT,
    "registrationUrl" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
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

    CONSTRAINT "CampaignEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignEventRsvp" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "voterUserId" TEXT NOT NULL,
    "status" "CampaignEventRsvpStatus" NOT NULL DEFAULT 'GOING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignEventRsvp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateMediaAsset" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "kind" "CandidateMediaAssetKind" NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateMediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Poll" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "candidateUserId" TEXT,
    "officeType" "CandidateOfficeType",
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollOption" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollResponse" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "voterUserId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PollResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "candidateUserId" TEXT,
    "geoPoliticalZoneId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mediaType" "CampaignMediaType" NOT NULL DEFAULT 'TEXT',
    "mediaUrl" TEXT,
    "thumbnailUrl" TEXT,
    "stateId" TEXT,
    "senatorialDistrictId" TEXT,
    "federalConstituencyId" TEXT,
    "lgaId" TEXT,
    "wardId" TEXT,
    "stateConstituencyId" TEXT,
    "pollingUnitId" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentActivity" (
    "id" TEXT NOT NULL,
    "agentUserId" TEXT NOT NULL,
    "type" "AgentActivityType" NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "accuracyMeters" DOUBLE PRECISION,
    "note" TEXT,
    "geoPoliticalZoneId" TEXT,
    "stateId" TEXT NOT NULL,
    "lgaId" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "pollingUnitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "reportedByUserId" TEXT NOT NULL,
    "type" "IncidentType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "IncidentSeverity" NOT NULL,
    "status" "IncidentStatus" NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "geoPoliticalZoneId" TEXT,
    "stateId" TEXT NOT NULL,
    "senatorialDistrictId" TEXT,
    "lgaId" TEXT NOT NULL,
    "wardId" TEXT,
    "pollingUnitId" TEXT,
    "assignedAdminUserId" TEXT,
    "escalatedAt" TIMESTAMP(3),
    "escalatedByUserId" TEXT,
    "escalationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "FieldTaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "FieldTaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "createdByUserId" TEXT NOT NULL,
    "assignedToUserId" TEXT NOT NULL,
    "incidentId" TEXT,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "geoPoliticalZoneId" TEXT,
    "stateId" TEXT NOT NULL,
    "senatorialDistrictId" TEXT,
    "federalConstituencyId" TEXT,
    "lgaId" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "stateConstituencyId" TEXT,
    "pollingUnitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BroadcastMessage" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "audience" "BroadcastAudience" NOT NULL,
    "taskStatus" "FieldTaskStatus",
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BroadcastMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardRedemption" (
    "id" TEXT NOT NULL,
    "voterUserId" TEXT NOT NULL,
    "pointsRequested" INTEGER NOT NULL,
    "amountRequested" DOUBLE PRECISION,
    "status" "RewardRedemptionStatus" NOT NULL,
    "note" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "MediaAttachment" (
    "id" TEXT NOT NULL,
    "uploaderUserId" TEXT NOT NULL,
    "incidentId" TEXT,
    "feedbackId" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoPoliticalZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeoPoliticalZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoliticalParty" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "logoUrl" TEXT,
    "description" TEXT,
    "officialWebsite" TEXT,
    "isApprovedByInec" BOOLEAN NOT NULL DEFAULT false,
    "inecSourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PoliticalParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "State" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "geoPoliticalZoneId" TEXT,
    "agentsPerPollingUnitTarget" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "State_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SenatorialDistrict" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SenatorialDistrict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FederalConstituency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stateId" TEXT NOT NULL,
    "senatorialDistrictId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FederalConstituency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LGA" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LGA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ward" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stateId" TEXT NOT NULL,
    "lgaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StateConstituency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stateId" TEXT NOT NULL,
    "lgaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StateConstituency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollingUnit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stateId" TEXT NOT NULL,
    "lgaId" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PollingUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SenatorialDistrictLga" (
    "senatorialDistrictId" TEXT NOT NULL,
    "lgaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SenatorialDistrictLga_pkey" PRIMARY KEY ("senatorialDistrictId","lgaId")
);

-- CreateTable
CREATE TABLE "FederalConstituencyLga" (
    "federalConstituencyId" TEXT NOT NULL,
    "lgaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FederalConstituencyLga_pkey" PRIMARY KEY ("federalConstituencyId","lgaId")
);

-- CreateTable
CREATE TABLE "StateConstituencyLga" (
    "stateConstituencyId" TEXT NOT NULL,
    "lgaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StateConstituencyLga_pkey" PRIMARY KEY ("stateConstituencyId","lgaId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AdminProfile_userId_key" ON "AdminProfile"("userId");

-- CreateIndex
CREATE INDEX "AdminProfile_adminLevel_idx" ON "AdminProfile"("adminLevel");

-- CreateIndex
CREATE INDEX "AdminProfile_politicalPartyId_idx" ON "AdminProfile"("politicalPartyId");

-- CreateIndex
CREATE INDEX "AdminProfile_geoPoliticalZoneId_idx" ON "AdminProfile"("geoPoliticalZoneId");

-- CreateIndex
CREATE INDEX "AdminProfile_stateId_idx" ON "AdminProfile"("stateId");

-- CreateIndex
CREATE INDEX "AdminProfile_senatorialDistrictId_idx" ON "AdminProfile"("senatorialDistrictId");

-- CreateIndex
CREATE INDEX "AdminProfile_federalConstituencyId_idx" ON "AdminProfile"("federalConstituencyId");

-- CreateIndex
CREATE INDEX "AdminProfile_lgaId_idx" ON "AdminProfile"("lgaId");

-- CreateIndex
CREATE INDEX "AdminProfile_wardId_idx" ON "AdminProfile"("wardId");

-- CreateIndex
CREATE INDEX "AdminProfile_stateConstituencyId_idx" ON "AdminProfile"("stateConstituencyId");

-- CreateIndex
CREATE INDEX "AdminProfile_pollingUnitId_idx" ON "AdminProfile"("pollingUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateProfile_userId_key" ON "CandidateProfile"("userId");

-- CreateIndex
CREATE INDEX "CandidateProfile_officeType_idx" ON "CandidateProfile"("officeType");

-- CreateIndex
CREATE INDEX "CandidateProfile_geoPoliticalZoneId_idx" ON "CandidateProfile"("geoPoliticalZoneId");

-- CreateIndex
CREATE INDEX "CandidateProfile_politicalPartyId_idx" ON "CandidateProfile"("politicalPartyId");

-- CreateIndex
CREATE INDEX "CandidateProfile_portraitAssetId_idx" ON "CandidateProfile"("portraitAssetId");

-- CreateIndex
CREATE INDEX "CandidateProfile_isProfilePublished_idx" ON "CandidateProfile"("isProfilePublished");

-- CreateIndex
CREATE INDEX "CandidateProfile_stateId_idx" ON "CandidateProfile"("stateId");

-- CreateIndex
CREATE INDEX "CandidateProfile_senatorialDistrictId_idx" ON "CandidateProfile"("senatorialDistrictId");

-- CreateIndex
CREATE INDEX "CandidateProfile_federalConstituencyId_idx" ON "CandidateProfile"("federalConstituencyId");

-- CreateIndex
CREATE INDEX "CandidateProfile_lgaId_idx" ON "CandidateProfile"("lgaId");

-- CreateIndex
CREATE INDEX "CandidateProfile_wardId_idx" ON "CandidateProfile"("wardId");

-- CreateIndex
CREATE INDEX "CandidateProfile_stateConstituencyId_idx" ON "CandidateProfile"("stateConstituencyId");

-- CreateIndex
CREATE INDEX "CandidateProfile_pollingUnitId_idx" ON "CandidateProfile"("pollingUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentProfile_userId_key" ON "AgentProfile"("userId");

-- CreateIndex
CREATE INDEX "AgentProfile_geoPoliticalZoneId_idx" ON "AgentProfile"("geoPoliticalZoneId");

-- CreateIndex
CREATE INDEX "AgentProfile_assignedAdminUserId_idx" ON "AgentProfile"("assignedAdminUserId");

-- CreateIndex
CREATE INDEX "AgentProfile_politicalPartyId_idx" ON "AgentProfile"("politicalPartyId");

-- CreateIndex
CREATE INDEX "AgentProfile_activeSessionNonce_idx" ON "AgentProfile"("activeSessionNonce");

-- CreateIndex
CREATE INDEX "AgentProfile_stateId_idx" ON "AgentProfile"("stateId");

-- CreateIndex
CREATE INDEX "AgentProfile_senatorialDistrictId_idx" ON "AgentProfile"("senatorialDistrictId");

-- CreateIndex
CREATE INDEX "AgentProfile_federalConstituencyId_idx" ON "AgentProfile"("federalConstituencyId");

-- CreateIndex
CREATE INDEX "AgentProfile_lgaId_idx" ON "AgentProfile"("lgaId");

-- CreateIndex
CREATE INDEX "AgentProfile_wardId_idx" ON "AgentProfile"("wardId");

-- CreateIndex
CREATE INDEX "AgentProfile_stateConstituencyId_idx" ON "AgentProfile"("stateConstituencyId");

-- CreateIndex
CREATE INDEX "AgentProfile_pollingUnitId_idx" ON "AgentProfile"("pollingUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "VoterProfile_userId_key" ON "VoterProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VoterProfile_voterCardNumber_key" ON "VoterProfile"("voterCardNumber");

-- CreateIndex
CREATE UNIQUE INDEX "VoterProfile_referralCode_key" ON "VoterProfile"("referralCode");

-- CreateIndex
CREATE INDEX "VoterProfile_geoPoliticalZoneId_idx" ON "VoterProfile"("geoPoliticalZoneId");

-- CreateIndex
CREATE INDEX "VoterProfile_stateId_idx" ON "VoterProfile"("stateId");

-- CreateIndex
CREATE INDEX "VoterProfile_senatorialDistrictId_idx" ON "VoterProfile"("senatorialDistrictId");

-- CreateIndex
CREATE INDEX "VoterProfile_federalConstituencyId_idx" ON "VoterProfile"("federalConstituencyId");

-- CreateIndex
CREATE INDEX "VoterProfile_lgaId_idx" ON "VoterProfile"("lgaId");

-- CreateIndex
CREATE INDEX "VoterProfile_wardId_idx" ON "VoterProfile"("wardId");

-- CreateIndex
CREATE INDEX "VoterProfile_stateConstituencyId_idx" ON "VoterProfile"("stateConstituencyId");

-- CreateIndex
CREATE INDEX "VoterProfile_pollingUnitId_idx" ON "VoterProfile"("pollingUnitId");

-- CreateIndex
CREATE INDEX "VoterProfile_referredByUserId_idx" ON "VoterProfile"("referredByUserId");

-- CreateIndex
CREATE INDEX "VoterEngagementTask_createdByUserId_idx" ON "VoterEngagementTask"("createdByUserId");

-- CreateIndex
CREATE INDEX "VoterEngagementTask_isActive_idx" ON "VoterEngagementTask"("isActive");

-- CreateIndex
CREATE INDEX "VoterEngagementTask_geoPoliticalZoneId_idx" ON "VoterEngagementTask"("geoPoliticalZoneId");

-- CreateIndex
CREATE INDEX "VoterEngagementTask_stateId_idx" ON "VoterEngagementTask"("stateId");

-- CreateIndex
CREATE INDEX "VoterEngagementTask_lgaId_idx" ON "VoterEngagementTask"("lgaId");

-- CreateIndex
CREATE INDEX "VoterEngagementTask_wardId_idx" ON "VoterEngagementTask"("wardId");

-- CreateIndex
CREATE INDEX "VoterEngagementTask_pollingUnitId_idx" ON "VoterEngagementTask"("pollingUnitId");

-- CreateIndex
CREATE INDEX "VoterEngagementClaim_voterUserId_idx" ON "VoterEngagementClaim"("voterUserId");

-- CreateIndex
CREATE UNIQUE INDEX "VoterEngagementClaim_taskId_voterUserId_key" ON "VoterEngagementClaim"("taskId", "voterUserId");

-- CreateIndex
CREATE INDEX "AdminCandidateAssignment_candidateUserId_idx" ON "AdminCandidateAssignment"("candidateUserId");

-- CreateIndex
CREATE INDEX "AdminCandidateAssignment_permissionType_idx" ON "AdminCandidateAssignment"("permissionType");

-- CreateIndex
CREATE UNIQUE INDEX "AdminCandidateAssignment_adminUserId_candidateUserId_permis_key" ON "AdminCandidateAssignment"("adminUserId", "candidateUserId", "permissionType");

-- CreateIndex
CREATE INDEX "RewardLedger_voterUserId_createdAt_idx" ON "RewardLedger"("voterUserId", "createdAt");

-- CreateIndex
CREATE INDEX "RewardLedger_type_idx" ON "RewardLedger"("type");

-- CreateIndex
CREATE UNIQUE INDEX "RewardLedger_voterUserId_type_relatedUserId_key" ON "RewardLedger"("voterUserId", "type", "relatedUserId");

-- CreateIndex
CREATE INDEX "ParticipationEvent_voterUserId_createdAt_idx" ON "ParticipationEvent"("voterUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ParticipationEvent_type_idx" ON "ParticipationEvent"("type");

-- CreateIndex
CREATE INDEX "ParticipationEvent_relatedPollId_idx" ON "ParticipationEvent"("relatedPollId");

-- CreateIndex
CREATE INDEX "ParticipationEvent_relatedPostId_idx" ON "ParticipationEvent"("relatedPostId");

-- CreateIndex
CREATE INDEX "CampaignEvent_candidateUserId_idx" ON "CampaignEvent"("candidateUserId");

-- CreateIndex
CREATE INDEX "CampaignEvent_createdByUserId_idx" ON "CampaignEvent"("createdByUserId");

-- CreateIndex
CREATE INDEX "CampaignEvent_isPublished_idx" ON "CampaignEvent"("isPublished");

-- CreateIndex
CREATE INDEX "CampaignEvent_startsAt_idx" ON "CampaignEvent"("startsAt");

-- CreateIndex
CREATE INDEX "CampaignEvent_coverImageAssetId_idx" ON "CampaignEvent"("coverImageAssetId");

-- CreateIndex
CREATE INDEX "CampaignEvent_stateId_idx" ON "CampaignEvent"("stateId");

-- CreateIndex
CREATE INDEX "CampaignEvent_lgaId_idx" ON "CampaignEvent"("lgaId");

-- CreateIndex
CREATE INDEX "CampaignEvent_wardId_idx" ON "CampaignEvent"("wardId");

-- CreateIndex
CREATE INDEX "CampaignEvent_pollingUnitId_idx" ON "CampaignEvent"("pollingUnitId");

-- CreateIndex
CREATE INDEX "CampaignEventRsvp_voterUserId_idx" ON "CampaignEventRsvp"("voterUserId");

-- CreateIndex
CREATE INDEX "CampaignEventRsvp_status_idx" ON "CampaignEventRsvp"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignEventRsvp_eventId_voterUserId_key" ON "CampaignEventRsvp"("eventId", "voterUserId");

-- CreateIndex
CREATE INDEX "CandidateMediaAsset_ownerUserId_idx" ON "CandidateMediaAsset"("ownerUserId");

-- CreateIndex
CREATE INDEX "CandidateMediaAsset_kind_idx" ON "CandidateMediaAsset"("kind");

-- CreateIndex
CREATE INDEX "Poll_geoPoliticalZoneId_idx" ON "Poll"("geoPoliticalZoneId");

-- CreateIndex
CREATE INDEX "Poll_candidateUserId_idx" ON "Poll"("candidateUserId");

-- CreateIndex
CREATE INDEX "Poll_officeType_idx" ON "Poll"("officeType");

-- CreateIndex
CREATE INDEX "Poll_isActive_idx" ON "Poll"("isActive");

-- CreateIndex
CREATE INDEX "Poll_stateId_idx" ON "Poll"("stateId");

-- CreateIndex
CREATE INDEX "Poll_senatorialDistrictId_idx" ON "Poll"("senatorialDistrictId");

-- CreateIndex
CREATE INDEX "Poll_federalConstituencyId_idx" ON "Poll"("federalConstituencyId");

-- CreateIndex
CREATE INDEX "Poll_lgaId_idx" ON "Poll"("lgaId");

-- CreateIndex
CREATE INDEX "Poll_wardId_idx" ON "Poll"("wardId");

-- CreateIndex
CREATE INDEX "Poll_stateConstituencyId_idx" ON "Poll"("stateConstituencyId");

-- CreateIndex
CREATE INDEX "Poll_pollingUnitId_idx" ON "Poll"("pollingUnitId");

-- CreateIndex
CREATE INDEX "PollOption_pollId_idx" ON "PollOption"("pollId");

-- CreateIndex
CREATE UNIQUE INDEX "PollOption_pollId_label_key" ON "PollOption"("pollId", "label");

-- CreateIndex
CREATE INDEX "PollResponse_optionId_idx" ON "PollResponse"("optionId");

-- CreateIndex
CREATE UNIQUE INDEX "PollResponse_pollId_voterUserId_key" ON "PollResponse"("pollId", "voterUserId");

-- CreateIndex
CREATE INDEX "Post_geoPoliticalZoneId_idx" ON "Post"("geoPoliticalZoneId");

-- CreateIndex
CREATE INDEX "Post_authorUserId_idx" ON "Post"("authorUserId");

-- CreateIndex
CREATE INDEX "Post_candidateUserId_idx" ON "Post"("candidateUserId");

-- CreateIndex
CREATE INDEX "Post_isPublished_idx" ON "Post"("isPublished");

-- CreateIndex
CREATE INDEX "Post_mediaType_idx" ON "Post"("mediaType");

-- CreateIndex
CREATE INDEX "Post_stateId_idx" ON "Post"("stateId");

-- CreateIndex
CREATE INDEX "Post_senatorialDistrictId_idx" ON "Post"("senatorialDistrictId");

-- CreateIndex
CREATE INDEX "Post_federalConstituencyId_idx" ON "Post"("federalConstituencyId");

-- CreateIndex
CREATE INDEX "Post_lgaId_idx" ON "Post"("lgaId");

-- CreateIndex
CREATE INDEX "Post_wardId_idx" ON "Post"("wardId");

-- CreateIndex
CREATE INDEX "Post_stateConstituencyId_idx" ON "Post"("stateConstituencyId");

-- CreateIndex
CREATE INDEX "Post_pollingUnitId_idx" ON "Post"("pollingUnitId");

-- CreateIndex
CREATE INDEX "Feedback_geoPoliticalZoneId_idx" ON "Feedback"("geoPoliticalZoneId");

-- CreateIndex
CREATE INDEX "Feedback_voterUserId_idx" ON "Feedback"("voterUserId");

-- CreateIndex
CREATE INDEX "Feedback_agentUserId_idx" ON "Feedback"("agentUserId");

-- CreateIndex
CREATE INDEX "Feedback_candidateUserId_idx" ON "Feedback"("candidateUserId");

-- CreateIndex
CREATE INDEX "Feedback_stateId_idx" ON "Feedback"("stateId");

-- CreateIndex
CREATE INDEX "Feedback_senatorialDistrictId_idx" ON "Feedback"("senatorialDistrictId");

-- CreateIndex
CREATE INDEX "Feedback_lgaId_idx" ON "Feedback"("lgaId");

-- CreateIndex
CREATE INDEX "Feedback_wardId_idx" ON "Feedback"("wardId");

-- CreateIndex
CREATE INDEX "Feedback_pollingUnitId_idx" ON "Feedback"("pollingUnitId");

-- CreateIndex
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");

-- CreateIndex
CREATE INDEX "AgentActivity_geoPoliticalZoneId_idx" ON "AgentActivity"("geoPoliticalZoneId");

-- CreateIndex
CREATE INDEX "AgentActivity_agentUserId_idx" ON "AgentActivity"("agentUserId");

-- CreateIndex
CREATE INDEX "AgentActivity_pollingUnitId_idx" ON "AgentActivity"("pollingUnitId");

-- CreateIndex
CREATE INDEX "AgentActivity_createdAt_idx" ON "AgentActivity"("createdAt");

-- CreateIndex
CREATE INDEX "AgentActivity_type_idx" ON "AgentActivity"("type");

-- CreateIndex
CREATE INDEX "Incident_geoPoliticalZoneId_idx" ON "Incident"("geoPoliticalZoneId");

-- CreateIndex
CREATE INDEX "Incident_reportedByUserId_idx" ON "Incident"("reportedByUserId");

-- CreateIndex
CREATE INDEX "Incident_stateId_idx" ON "Incident"("stateId");

-- CreateIndex
CREATE INDEX "Incident_senatorialDistrictId_idx" ON "Incident"("senatorialDistrictId");

-- CreateIndex
CREATE INDEX "Incident_lgaId_idx" ON "Incident"("lgaId");

-- CreateIndex
CREATE INDEX "Incident_wardId_idx" ON "Incident"("wardId");

-- CreateIndex
CREATE INDEX "Incident_pollingUnitId_idx" ON "Incident"("pollingUnitId");

-- CreateIndex
CREATE INDEX "Incident_assignedAdminUserId_idx" ON "Incident"("assignedAdminUserId");

-- CreateIndex
CREATE INDEX "Incident_escalatedByUserId_idx" ON "Incident"("escalatedByUserId");

-- CreateIndex
CREATE INDEX "Incident_createdAt_idx" ON "Incident"("createdAt");

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

-- CreateIndex
CREATE INDEX "RewardRedemption_voterUserId_idx" ON "RewardRedemption"("voterUserId");

-- CreateIndex
CREATE INDEX "RewardRedemption_status_idx" ON "RewardRedemption"("status");

-- CreateIndex
CREATE INDEX "RewardRedemption_reviewedByUserId_idx" ON "RewardRedemption"("reviewedByUserId");

-- CreateIndex
CREATE INDEX "RewardRedemption_createdAt_idx" ON "RewardRedemption"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "ElectionDayReportAsset_ownerUserId_idx" ON "ElectionDayReportAsset"("ownerUserId");

-- CreateIndex
CREATE INDEX "ElectionDayReportAsset_kind_idx" ON "ElectionDayReportAsset"("kind");

-- CreateIndex
CREATE INDEX "ElectionDayReportAsset_createdAt_idx" ON "ElectionDayReportAsset"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ElectionDayReport_arrivalPhotoAssetId_key" ON "ElectionDayReport"("arrivalPhotoAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "ElectionDayReport_postCountingPhotoAssetId_key" ON "ElectionDayReport"("postCountingPhotoAssetId");

-- CreateIndex
CREATE INDEX "ElectionDayReport_status_idx" ON "ElectionDayReport"("status");

-- CreateIndex
CREATE INDEX "ElectionDayReport_agentUserId_idx" ON "ElectionDayReport"("agentUserId");

-- CreateIndex
CREATE INDEX "ElectionDayReport_reviewedByUserId_idx" ON "ElectionDayReport"("reviewedByUserId");

-- CreateIndex
CREATE INDEX "ElectionDayReport_reportDate_idx" ON "ElectionDayReport"("reportDate");

-- CreateIndex
CREATE INDEX "ElectionDayReport_geoPoliticalZoneId_idx" ON "ElectionDayReport"("geoPoliticalZoneId");

-- CreateIndex
CREATE INDEX "ElectionDayReport_stateId_idx" ON "ElectionDayReport"("stateId");

-- CreateIndex
CREATE INDEX "ElectionDayReport_senatorialDistrictId_idx" ON "ElectionDayReport"("senatorialDistrictId");

-- CreateIndex
CREATE INDEX "ElectionDayReport_federalConstituencyId_idx" ON "ElectionDayReport"("federalConstituencyId");

-- CreateIndex
CREATE INDEX "ElectionDayReport_lgaId_idx" ON "ElectionDayReport"("lgaId");

-- CreateIndex
CREATE INDEX "ElectionDayReport_wardId_idx" ON "ElectionDayReport"("wardId");

-- CreateIndex
CREATE INDEX "ElectionDayReport_stateConstituencyId_idx" ON "ElectionDayReport"("stateConstituencyId");

-- CreateIndex
CREATE INDEX "ElectionDayReport_pollingUnitId_idx" ON "ElectionDayReport"("pollingUnitId");

-- CreateIndex
CREATE INDEX "ElectionDayReport_createdAt_idx" ON "ElectionDayReport"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ElectionDayReport_agentUserId_pollingUnitId_reportDate_key" ON "ElectionDayReport"("agentUserId", "pollingUnitId", "reportDate");

-- CreateIndex
CREATE INDEX "MediaAttachment_uploaderUserId_idx" ON "MediaAttachment"("uploaderUserId");

-- CreateIndex
CREATE INDEX "MediaAttachment_incidentId_idx" ON "MediaAttachment"("incidentId");

-- CreateIndex
CREATE INDEX "MediaAttachment_feedbackId_idx" ON "MediaAttachment"("feedbackId");

-- CreateIndex
CREATE INDEX "MediaAttachment_createdAt_idx" ON "MediaAttachment"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GeoPoliticalZone_name_key" ON "GeoPoliticalZone"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PoliticalParty_name_key" ON "PoliticalParty"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PoliticalParty_code_key" ON "PoliticalParty"("code");

-- CreateIndex
CREATE INDEX "PoliticalParty_isApprovedByInec_idx" ON "PoliticalParty"("isApprovedByInec");

-- CreateIndex
CREATE UNIQUE INDEX "State_name_key" ON "State"("name");

-- CreateIndex
CREATE INDEX "State_geoPoliticalZoneId_idx" ON "State"("geoPoliticalZoneId");

-- CreateIndex
CREATE INDEX "SenatorialDistrict_stateId_idx" ON "SenatorialDistrict"("stateId");

-- CreateIndex
CREATE UNIQUE INDEX "SenatorialDistrict_stateId_name_key" ON "SenatorialDistrict"("stateId", "name");

-- CreateIndex
CREATE INDEX "FederalConstituency_stateId_idx" ON "FederalConstituency"("stateId");

-- CreateIndex
CREATE INDEX "FederalConstituency_senatorialDistrictId_idx" ON "FederalConstituency"("senatorialDistrictId");

-- CreateIndex
CREATE UNIQUE INDEX "FederalConstituency_stateId_name_key" ON "FederalConstituency"("stateId", "name");

-- CreateIndex
CREATE INDEX "LGA_stateId_idx" ON "LGA"("stateId");

-- CreateIndex
CREATE UNIQUE INDEX "LGA_stateId_name_key" ON "LGA"("stateId", "name");

-- CreateIndex
CREATE INDEX "Ward_stateId_idx" ON "Ward"("stateId");

-- CreateIndex
CREATE INDEX "Ward_lgaId_idx" ON "Ward"("lgaId");

-- CreateIndex
CREATE UNIQUE INDEX "Ward_lgaId_name_key" ON "Ward"("lgaId", "name");

-- CreateIndex
CREATE INDEX "StateConstituency_stateId_idx" ON "StateConstituency"("stateId");

-- CreateIndex
CREATE INDEX "StateConstituency_lgaId_idx" ON "StateConstituency"("lgaId");

-- CreateIndex
CREATE UNIQUE INDEX "StateConstituency_stateId_name_key" ON "StateConstituency"("stateId", "name");

-- CreateIndex
CREATE INDEX "PollingUnit_stateId_idx" ON "PollingUnit"("stateId");

-- CreateIndex
CREATE INDEX "PollingUnit_lgaId_idx" ON "PollingUnit"("lgaId");

-- CreateIndex
CREATE INDEX "PollingUnit_wardId_idx" ON "PollingUnit"("wardId");

-- CreateIndex
CREATE UNIQUE INDEX "PollingUnit_wardId_name_key" ON "PollingUnit"("wardId", "name");

-- CreateIndex
CREATE INDEX "SenatorialDistrictLga_lgaId_idx" ON "SenatorialDistrictLga"("lgaId");

-- CreateIndex
CREATE INDEX "FederalConstituencyLga_lgaId_idx" ON "FederalConstituencyLga"("lgaId");

-- CreateIndex
CREATE INDEX "StateConstituencyLga_lgaId_idx" ON "StateConstituencyLga"("lgaId");

-- AddForeignKey
ALTER TABLE "AdminProfile" ADD CONSTRAINT "AdminProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminProfile" ADD CONSTRAINT "AdminProfile_politicalPartyId_fkey" FOREIGN KEY ("politicalPartyId") REFERENCES "PoliticalParty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminProfile" ADD CONSTRAINT "AdminProfile_geoPoliticalZoneId_fkey" FOREIGN KEY ("geoPoliticalZoneId") REFERENCES "GeoPoliticalZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminProfile" ADD CONSTRAINT "AdminProfile_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminProfile" ADD CONSTRAINT "AdminProfile_senatorialDistrictId_fkey" FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminProfile" ADD CONSTRAINT "AdminProfile_federalConstituencyId_fkey" FOREIGN KEY ("federalConstituencyId") REFERENCES "FederalConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminProfile" ADD CONSTRAINT "AdminProfile_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminProfile" ADD CONSTRAINT "AdminProfile_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminProfile" ADD CONSTRAINT "AdminProfile_stateConstituencyId_fkey" FOREIGN KEY ("stateConstituencyId") REFERENCES "StateConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminProfile" ADD CONSTRAINT "AdminProfile_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_geoPoliticalZoneId_fkey" FOREIGN KEY ("geoPoliticalZoneId") REFERENCES "GeoPoliticalZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_politicalPartyId_fkey" FOREIGN KEY ("politicalPartyId") REFERENCES "PoliticalParty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_senatorialDistrictId_fkey" FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_federalConstituencyId_fkey" FOREIGN KEY ("federalConstituencyId") REFERENCES "FederalConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_stateConstituencyId_fkey" FOREIGN KEY ("stateConstituencyId") REFERENCES "StateConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_portraitAssetId_fkey" FOREIGN KEY ("portraitAssetId") REFERENCES "CandidateMediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProfile" ADD CONSTRAINT "AgentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProfile" ADD CONSTRAINT "AgentProfile_assignedAdminUserId_fkey" FOREIGN KEY ("assignedAdminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProfile" ADD CONSTRAINT "AgentProfile_politicalPartyId_fkey" FOREIGN KEY ("politicalPartyId") REFERENCES "PoliticalParty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProfile" ADD CONSTRAINT "AgentProfile_geoPoliticalZoneId_fkey" FOREIGN KEY ("geoPoliticalZoneId") REFERENCES "GeoPoliticalZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProfile" ADD CONSTRAINT "AgentProfile_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProfile" ADD CONSTRAINT "AgentProfile_senatorialDistrictId_fkey" FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProfile" ADD CONSTRAINT "AgentProfile_federalConstituencyId_fkey" FOREIGN KEY ("federalConstituencyId") REFERENCES "FederalConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProfile" ADD CONSTRAINT "AgentProfile_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProfile" ADD CONSTRAINT "AgentProfile_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProfile" ADD CONSTRAINT "AgentProfile_stateConstituencyId_fkey" FOREIGN KEY ("stateConstituencyId") REFERENCES "StateConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProfile" ADD CONSTRAINT "AgentProfile_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoterProfile" ADD CONSTRAINT "VoterProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoterProfile" ADD CONSTRAINT "VoterProfile_referredByUserId_fkey" FOREIGN KEY ("referredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoterProfile" ADD CONSTRAINT "VoterProfile_geoPoliticalZoneId_fkey" FOREIGN KEY ("geoPoliticalZoneId") REFERENCES "GeoPoliticalZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoterProfile" ADD CONSTRAINT "VoterProfile_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoterProfile" ADD CONSTRAINT "VoterProfile_senatorialDistrictId_fkey" FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoterProfile" ADD CONSTRAINT "VoterProfile_federalConstituencyId_fkey" FOREIGN KEY ("federalConstituencyId") REFERENCES "FederalConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoterProfile" ADD CONSTRAINT "VoterProfile_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoterProfile" ADD CONSTRAINT "VoterProfile_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoterProfile" ADD CONSTRAINT "VoterProfile_stateConstituencyId_fkey" FOREIGN KEY ("stateConstituencyId") REFERENCES "StateConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoterProfile" ADD CONSTRAINT "VoterProfile_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoterEngagementTask" ADD CONSTRAINT "VoterEngagementTask_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoterEngagementTask" ADD CONSTRAINT "VoterEngagementTask_geoPoliticalZoneId_fkey" FOREIGN KEY ("geoPoliticalZoneId") REFERENCES "GeoPoliticalZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoterEngagementTask" ADD CONSTRAINT "VoterEngagementTask_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoterEngagementTask" ADD CONSTRAINT "VoterEngagementTask_senatorialDistrictId_fkey" FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoterEngagementTask" ADD CONSTRAINT "VoterEngagementTask_federalConstituencyId_fkey" FOREIGN KEY ("federalConstituencyId") REFERENCES "FederalConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoterEngagementTask" ADD CONSTRAINT "VoterEngagementTask_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoterEngagementTask" ADD CONSTRAINT "VoterEngagementTask_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoterEngagementTask" ADD CONSTRAINT "VoterEngagementTask_stateConstituencyId_fkey" FOREIGN KEY ("stateConstituencyId") REFERENCES "StateConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoterEngagementTask" ADD CONSTRAINT "VoterEngagementTask_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoterEngagementClaim" ADD CONSTRAINT "VoterEngagementClaim_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "VoterEngagementTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoterEngagementClaim" ADD CONSTRAINT "VoterEngagementClaim_voterUserId_fkey" FOREIGN KEY ("voterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminCandidateAssignment" ADD CONSTRAINT "AdminCandidateAssignment_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminCandidateAssignment" ADD CONSTRAINT "AdminCandidateAssignment_candidateUserId_fkey" FOREIGN KEY ("candidateUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardLedger" ADD CONSTRAINT "RewardLedger_voterUserId_fkey" FOREIGN KEY ("voterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardLedger" ADD CONSTRAINT "RewardLedger_relatedUserId_fkey" FOREIGN KEY ("relatedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipationEvent" ADD CONSTRAINT "ParticipationEvent_voterUserId_fkey" FOREIGN KEY ("voterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipationEvent" ADD CONSTRAINT "ParticipationEvent_relatedPollId_fkey" FOREIGN KEY ("relatedPollId") REFERENCES "Poll"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipationEvent" ADD CONSTRAINT "ParticipationEvent_relatedPostId_fkey" FOREIGN KEY ("relatedPostId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignEvent" ADD CONSTRAINT "CampaignEvent_candidateUserId_fkey" FOREIGN KEY ("candidateUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignEvent" ADD CONSTRAINT "CampaignEvent_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignEvent" ADD CONSTRAINT "CampaignEvent_geoPoliticalZoneId_fkey" FOREIGN KEY ("geoPoliticalZoneId") REFERENCES "GeoPoliticalZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignEvent" ADD CONSTRAINT "CampaignEvent_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignEvent" ADD CONSTRAINT "CampaignEvent_senatorialDistrictId_fkey" FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignEvent" ADD CONSTRAINT "CampaignEvent_federalConstituencyId_fkey" FOREIGN KEY ("federalConstituencyId") REFERENCES "FederalConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignEvent" ADD CONSTRAINT "CampaignEvent_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignEvent" ADD CONSTRAINT "CampaignEvent_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignEvent" ADD CONSTRAINT "CampaignEvent_stateConstituencyId_fkey" FOREIGN KEY ("stateConstituencyId") REFERENCES "StateConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignEvent" ADD CONSTRAINT "CampaignEvent_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignEvent" ADD CONSTRAINT "CampaignEvent_coverImageAssetId_fkey" FOREIGN KEY ("coverImageAssetId") REFERENCES "CandidateMediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignEventRsvp" ADD CONSTRAINT "CampaignEventRsvp_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CampaignEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignEventRsvp" ADD CONSTRAINT "CampaignEventRsvp_voterUserId_fkey" FOREIGN KEY ("voterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateMediaAsset" ADD CONSTRAINT "CandidateMediaAsset_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_candidateUserId_fkey" FOREIGN KEY ("candidateUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_geoPoliticalZoneId_fkey" FOREIGN KEY ("geoPoliticalZoneId") REFERENCES "GeoPoliticalZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_senatorialDistrictId_fkey" FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_federalConstituencyId_fkey" FOREIGN KEY ("federalConstituencyId") REFERENCES "FederalConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_stateConstituencyId_fkey" FOREIGN KEY ("stateConstituencyId") REFERENCES "StateConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollOption" ADD CONSTRAINT "PollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollResponse" ADD CONSTRAINT "PollResponse_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollResponse" ADD CONSTRAINT "PollResponse_voterUserId_fkey" FOREIGN KEY ("voterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollResponse" ADD CONSTRAINT "PollResponse_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "PollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_candidateUserId_fkey" FOREIGN KEY ("candidateUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_geoPoliticalZoneId_fkey" FOREIGN KEY ("geoPoliticalZoneId") REFERENCES "GeoPoliticalZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_senatorialDistrictId_fkey" FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_federalConstituencyId_fkey" FOREIGN KEY ("federalConstituencyId") REFERENCES "FederalConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_stateConstituencyId_fkey" FOREIGN KEY ("stateConstituencyId") REFERENCES "StateConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_voterUserId_fkey" FOREIGN KEY ("voterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_agentUserId_fkey" FOREIGN KEY ("agentUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_candidateUserId_fkey" FOREIGN KEY ("candidateUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_geoPoliticalZoneId_fkey" FOREIGN KEY ("geoPoliticalZoneId") REFERENCES "GeoPoliticalZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_senatorialDistrictId_fkey" FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentActivity" ADD CONSTRAINT "AgentActivity_agentUserId_fkey" FOREIGN KEY ("agentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentActivity" ADD CONSTRAINT "AgentActivity_geoPoliticalZoneId_fkey" FOREIGN KEY ("geoPoliticalZoneId") REFERENCES "GeoPoliticalZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentActivity" ADD CONSTRAINT "AgentActivity_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentActivity" ADD CONSTRAINT "AgentActivity_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentActivity" ADD CONSTRAINT "AgentActivity_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentActivity" ADD CONSTRAINT "AgentActivity_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_reportedByUserId_fkey" FOREIGN KEY ("reportedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_geoPoliticalZoneId_fkey" FOREIGN KEY ("geoPoliticalZoneId") REFERENCES "GeoPoliticalZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_senatorialDistrictId_fkey" FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_assignedAdminUserId_fkey" FOREIGN KEY ("assignedAdminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_escalatedByUserId_fkey" FOREIGN KEY ("escalatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldTask" ADD CONSTRAINT "FieldTask_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldTask" ADD CONSTRAINT "FieldTask_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldTask" ADD CONSTRAINT "FieldTask_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldTask" ADD CONSTRAINT "FieldTask_geoPoliticalZoneId_fkey" FOREIGN KEY ("geoPoliticalZoneId") REFERENCES "GeoPoliticalZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldTask" ADD CONSTRAINT "FieldTask_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldTask" ADD CONSTRAINT "FieldTask_senatorialDistrictId_fkey" FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldTask" ADD CONSTRAINT "FieldTask_federalConstituencyId_fkey" FOREIGN KEY ("federalConstituencyId") REFERENCES "FederalConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldTask" ADD CONSTRAINT "FieldTask_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldTask" ADD CONSTRAINT "FieldTask_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldTask" ADD CONSTRAINT "FieldTask_stateConstituencyId_fkey" FOREIGN KEY ("stateConstituencyId") REFERENCES "StateConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldTask" ADD CONSTRAINT "FieldTask_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BroadcastMessage" ADD CONSTRAINT "BroadcastMessage_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BroadcastMessage" ADD CONSTRAINT "BroadcastMessage_geoPoliticalZoneId_fkey" FOREIGN KEY ("geoPoliticalZoneId") REFERENCES "GeoPoliticalZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BroadcastMessage" ADD CONSTRAINT "BroadcastMessage_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BroadcastMessage" ADD CONSTRAINT "BroadcastMessage_senatorialDistrictId_fkey" FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BroadcastMessage" ADD CONSTRAINT "BroadcastMessage_federalConstituencyId_fkey" FOREIGN KEY ("federalConstituencyId") REFERENCES "FederalConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BroadcastMessage" ADD CONSTRAINT "BroadcastMessage_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BroadcastMessage" ADD CONSTRAINT "BroadcastMessage_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BroadcastMessage" ADD CONSTRAINT "BroadcastMessage_stateConstituencyId_fkey" FOREIGN KEY ("stateConstituencyId") REFERENCES "StateConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BroadcastMessage" ADD CONSTRAINT "BroadcastMessage_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_voterUserId_fkey" FOREIGN KEY ("voterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionDayReportAsset" ADD CONSTRAINT "ElectionDayReportAsset_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionDayReport" ADD CONSTRAINT "ElectionDayReport_agentUserId_fkey" FOREIGN KEY ("agentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionDayReport" ADD CONSTRAINT "ElectionDayReport_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionDayReport" ADD CONSTRAINT "ElectionDayReport_arrivalPhotoAssetId_fkey" FOREIGN KEY ("arrivalPhotoAssetId") REFERENCES "ElectionDayReportAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionDayReport" ADD CONSTRAINT "ElectionDayReport_postCountingPhotoAssetId_fkey" FOREIGN KEY ("postCountingPhotoAssetId") REFERENCES "ElectionDayReportAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionDayReport" ADD CONSTRAINT "ElectionDayReport_geoPoliticalZoneId_fkey" FOREIGN KEY ("geoPoliticalZoneId") REFERENCES "GeoPoliticalZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionDayReport" ADD CONSTRAINT "ElectionDayReport_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionDayReport" ADD CONSTRAINT "ElectionDayReport_senatorialDistrictId_fkey" FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionDayReport" ADD CONSTRAINT "ElectionDayReport_federalConstituencyId_fkey" FOREIGN KEY ("federalConstituencyId") REFERENCES "FederalConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionDayReport" ADD CONSTRAINT "ElectionDayReport_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionDayReport" ADD CONSTRAINT "ElectionDayReport_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionDayReport" ADD CONSTRAINT "ElectionDayReport_stateConstituencyId_fkey" FOREIGN KEY ("stateConstituencyId") REFERENCES "StateConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionDayReport" ADD CONSTRAINT "ElectionDayReport_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAttachment" ADD CONSTRAINT "MediaAttachment_uploaderUserId_fkey" FOREIGN KEY ("uploaderUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAttachment" ADD CONSTRAINT "MediaAttachment_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAttachment" ADD CONSTRAINT "MediaAttachment_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "Feedback"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "State" ADD CONSTRAINT "State_geoPoliticalZoneId_fkey" FOREIGN KEY ("geoPoliticalZoneId") REFERENCES "GeoPoliticalZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SenatorialDistrict" ADD CONSTRAINT "SenatorialDistrict_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FederalConstituency" ADD CONSTRAINT "FederalConstituency_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FederalConstituency" ADD CONSTRAINT "FederalConstituency_senatorialDistrictId_fkey" FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LGA" ADD CONSTRAINT "LGA_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ward" ADD CONSTRAINT "Ward_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ward" ADD CONSTRAINT "Ward_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StateConstituency" ADD CONSTRAINT "StateConstituency_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StateConstituency" ADD CONSTRAINT "StateConstituency_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollingUnit" ADD CONSTRAINT "PollingUnit_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollingUnit" ADD CONSTRAINT "PollingUnit_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollingUnit" ADD CONSTRAINT "PollingUnit_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SenatorialDistrictLga" ADD CONSTRAINT "SenatorialDistrictLga_senatorialDistrictId_fkey" FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SenatorialDistrictLga" ADD CONSTRAINT "SenatorialDistrictLga_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FederalConstituencyLga" ADD CONSTRAINT "FederalConstituencyLga_federalConstituencyId_fkey" FOREIGN KEY ("federalConstituencyId") REFERENCES "FederalConstituency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FederalConstituencyLga" ADD CONSTRAINT "FederalConstituencyLga_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StateConstituencyLga" ADD CONSTRAINT "StateConstituencyLga_stateConstituencyId_fkey" FOREIGN KEY ("stateConstituencyId") REFERENCES "StateConstituency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StateConstituencyLga" ADD CONSTRAINT "StateConstituencyLga_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA"("id") ON DELETE CASCADE ON UPDATE CASCADE;
