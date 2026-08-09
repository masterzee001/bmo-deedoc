-- CreateEnum
CREATE TYPE "VoterVerificationStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING', 'UNDER_REVIEW', 'RESUBMISSION_REQUIRED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VoterVerificationDecision" AS ENUM ('SUBMITTED', 'CLAIMED', 'APPROVED', 'REJECTED', 'RESUBMISSION_REQUIRED', 'FLAGGED', 'NOTE_ADDED');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('REGISTERED', 'PENDING_VERIFICATION', 'QUALIFIED', 'REJECTED', 'FLAGGED', 'REWARD_PROCESSED');

-- CreateEnum
CREATE TYPE "RewardQualifyingEvent" AS ENUM ('VOTER_VERIFICATION_APPROVED');

-- CreateEnum
CREATE TYPE "RewardLedgerCategory" AS ENUM ('VERIFIED_REFERRAL', 'FIELD_ACTIVITY', 'TASK_COMPLETION', 'APPROVED_PARTICIPATION', 'BONUS', 'MANUAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "RewardEventStatus" AS ENUM ('PENDING', 'PROCESSED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'ELIGIBLE', 'APPROVED', 'PROCESSING', 'PAID', 'HELD', 'REJECTED');

-- AlterTable
ALTER TABLE "VoterProfile" ADD COLUMN "privacyAcceptedAt" TIMESTAMP(3);
ALTER TABLE "VoterProfile" ADD COLUMN "documentConsentAt" TIMESTAMP(3);
ALTER TABLE "VoterProfile" ADD COLUMN "consentVersion" TEXT;

-- CreateTable
CREATE TABLE "VoterVerification" (
    "id" TEXT NOT NULL,
    "memberUserId" TEXT NOT NULL,
    "voterIdentifier" TEXT NOT NULL,
    "status" "VoterVerificationStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "fraudReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewStartedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoterVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoterVerificationDocument" (
    "id" TEXT NOT NULL,
    "verificationId" TEXT NOT NULL,
    "originalStorageKey" TEXT NOT NULL,
    "previewStorageKey" TEXT,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoterVerificationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoterVerificationHistory" (
    "id" TEXT NOT NULL,
    "verificationId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "fromStatus" "VoterVerificationStatus",
    "toStatus" "VoterVerificationStatus" NOT NULL,
    "decision" "VoterVerificationDecision" NOT NULL,
    "note" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoterVerificationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralCode" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "referrerUserId" TEXT NOT NULL,
    "referralCodeId" TEXT,
    "referralCode" TEXT NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'REGISTERED',
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "qualifiedAt" TIMESTAMP(3),
    "rewardProcessedAt" TIMESTAMP(3),
    "flaggedAt" TIMESTAMP(3),
    "fraudReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "qualifyingEvent" "RewardQualifyingEvent" NOT NULL,
    "eligibleRole" "UserRole" NOT NULL,
    "eligibleCoordinatorLevel" "CoordinatorLevel",
    "active" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveUntil" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardRuleVersion" (
    "id" TEXT NOT NULL,
    "rewardRuleId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "directPoints" INTEGER NOT NULL,
    "upstreamPointsConfig" JSONB,
    "maximumPoints" INTEGER,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardRuleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardEvent" (
    "id" TEXT NOT NULL,
    "eventType" "RewardQualifyingEvent" NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "referralId" TEXT,
    "rewardRuleVersionId" TEXT,
    "status" "RewardEventStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardLedgerEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "category" "RewardLedgerCategory" NOT NULL,
    "sourceEventType" "RewardQualifyingEvent" NOT NULL,
    "sourceEventId" TEXT NOT NULL,
    "rewardRuleVersionId" TEXT,
    "relatedUserId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutConfiguration" (
    "id" TEXT NOT NULL,
    "minimumPoints" INTEGER NOT NULL,
    "pointConversionRate" DECIMAL(18,4) NOT NULL,
    "frequency" TEXT NOT NULL,
    "nextPayoutDate" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutCycle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "payoutDate" TIMESTAMP(3) NOT NULL,
    "minimumThreshold" INTEGER NOT NULL,
    "conversionRate" DECIMAL(18,4) NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutBatch" (
    "id" TEXT NOT NULL,
    "payoutCycleId" TEXT NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "PayoutBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutAssignment" (
    "id" TEXT NOT NULL,
    "payoutBatchId" TEXT NOT NULL,
    "payoutOfficerUserId" TEXT NOT NULL,
    "beneficiaryUserId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "PayoutAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutTransaction" (
    "id" TEXT NOT NULL,
    "payoutAssignmentId" TEXT NOT NULL,
    "payoutOfficerUserId" TEXT NOT NULL,
    "paymentReference" TEXT NOT NULL,
    "pointsRedeemed" INTEGER NOT NULL,
    "amountPaid" DECIMAL(18,2) NOT NULL,
    "status" "PayoutStatus" NOT NULL,
    "proofStorageKey" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrengthMetricDefinition" (
    "id" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrengthMetricDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrengthWeightConfiguration" (
    "id" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "weight" DECIMAL(8,4) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveUntil" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrengthWeightConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerritoryTarget" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT,
    "territoryType" TEXT NOT NULL,
    "territoryId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "targetValue" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TerritoryTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerritoryMetricSnapshot" (
    "id" TEXT NOT NULL,
    "territoryType" TEXT NOT NULL,
    "territoryId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "actualValue" INTEGER NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadataJson" JSONB,

    CONSTRAINT "TerritoryMetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerritoryStrengthSnapshot" (
    "id" TEXT NOT NULL,
    "territoryType" TEXT NOT NULL,
    "territoryId" TEXT NOT NULL,
    "candidateId" TEXT,
    "score" DECIMAL(8,4) NOT NULL,
    "breakdownJson" JSONB NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TerritoryStrengthSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VoterVerification_memberUserId_key" ON "VoterVerification"("memberUserId");
CREATE INDEX "VoterVerification_status_submittedAt_idx" ON "VoterVerification"("status", "submittedAt");
CREATE INDEX "VoterVerification_reviewedByUserId_idx" ON "VoterVerification"("reviewedByUserId");
CREATE INDEX "VoterVerification_voterIdentifier_idx" ON "VoterVerification"("voterIdentifier");
CREATE INDEX "VoterVerification_isFlagged_idx" ON "VoterVerification"("isFlagged");
CREATE UNIQUE INDEX "VoterVerificationDocument_originalStorageKey_key" ON "VoterVerificationDocument"("originalStorageKey");
CREATE INDEX "VoterVerificationDocument_verificationId_idx" ON "VoterVerificationDocument"("verificationId");
CREATE INDEX "VoterVerificationDocument_sha256_idx" ON "VoterVerificationDocument"("sha256");
CREATE INDEX "VoterVerificationDocument_uploadedAt_idx" ON "VoterVerificationDocument"("uploadedAt");
CREATE INDEX "VoterVerificationHistory_verificationId_createdAt_idx" ON "VoterVerificationHistory"("verificationId", "createdAt");
CREATE INDEX "VoterVerificationHistory_actorUserId_idx" ON "VoterVerificationHistory"("actorUserId");
CREATE INDEX "VoterVerificationHistory_decision_idx" ON "VoterVerificationHistory"("decision");
CREATE UNIQUE INDEX "ReferralCode_code_key" ON "ReferralCode"("code");
CREATE INDEX "ReferralCode_ownerUserId_idx" ON "ReferralCode"("ownerUserId");
CREATE INDEX "ReferralCode_isActive_idx" ON "ReferralCode"("isActive");
CREATE UNIQUE INDEX "Referral_referredUserId_key" ON "Referral"("referredUserId");
CREATE UNIQUE INDEX "Referral_referrerUserId_referredUserId_key" ON "Referral"("referrerUserId", "referredUserId");
CREATE INDEX "Referral_referrerUserId_idx" ON "Referral"("referrerUserId");
CREATE INDEX "Referral_status_idx" ON "Referral"("status");
CREATE INDEX "Referral_registeredAt_idx" ON "Referral"("registeredAt");
CREATE INDEX "RewardRule_qualifyingEvent_active_idx" ON "RewardRule"("qualifyingEvent", "active");
CREATE INDEX "RewardRule_eligibleRole_idx" ON "RewardRule"("eligibleRole");
CREATE INDEX "RewardRule_createdByUserId_idx" ON "RewardRule"("createdByUserId");
CREATE UNIQUE INDEX "RewardRuleVersion_rewardRuleId_version_key" ON "RewardRuleVersion"("rewardRuleId", "version");
CREATE INDEX "RewardRuleVersion_rewardRuleId_effectiveFrom_idx" ON "RewardRuleVersion"("rewardRuleId", "effectiveFrom");
CREATE UNIQUE INDEX "RewardEvent_idempotencyKey_key" ON "RewardEvent"("idempotencyKey");
CREATE UNIQUE INDEX "RewardEvent_eventType_sourceType_sourceId_key" ON "RewardEvent"("eventType", "sourceType", "sourceId");
CREATE INDEX "RewardEvent_status_occurredAt_idx" ON "RewardEvent"("status", "occurredAt");
CREATE INDEX "RewardEvent_referralId_idx" ON "RewardEvent"("referralId");
CREATE INDEX "RewardEvent_rewardRuleVersionId_idx" ON "RewardEvent"("rewardRuleVersionId");
CREATE UNIQUE INDEX "RewardLedgerEntry_userId_sourceEventId_category_key" ON "RewardLedgerEntry"("userId", "sourceEventId", "category");
CREATE INDEX "RewardLedgerEntry_userId_createdAt_idx" ON "RewardLedgerEntry"("userId", "createdAt");
CREATE INDEX "RewardLedgerEntry_category_idx" ON "RewardLedgerEntry"("category");
CREATE INDEX "RewardLedgerEntry_rewardRuleVersionId_idx" ON "RewardLedgerEntry"("rewardRuleVersionId");
CREATE INDEX "RewardLedgerEntry_relatedUserId_idx" ON "RewardLedgerEntry"("relatedUserId");
CREATE INDEX "PayoutConfiguration_active_idx" ON "PayoutConfiguration"("active");
CREATE INDEX "PayoutConfiguration_createdByUserId_idx" ON "PayoutConfiguration"("createdByUserId");
CREATE INDEX "PayoutCycle_status_payoutDate_idx" ON "PayoutCycle"("status", "payoutDate");
CREATE INDEX "PayoutBatch_payoutCycleId_idx" ON "PayoutBatch"("payoutCycleId");
CREATE INDEX "PayoutBatch_status_idx" ON "PayoutBatch"("status");
CREATE UNIQUE INDEX "PayoutAssignment_payoutBatchId_beneficiaryUserId_key" ON "PayoutAssignment"("payoutBatchId", "beneficiaryUserId");
CREATE INDEX "PayoutAssignment_payoutOfficerUserId_status_idx" ON "PayoutAssignment"("payoutOfficerUserId", "status");
CREATE INDEX "PayoutAssignment_beneficiaryUserId_idx" ON "PayoutAssignment"("beneficiaryUserId");
CREATE UNIQUE INDEX "PayoutTransaction_paymentReference_key" ON "PayoutTransaction"("paymentReference");
CREATE INDEX "PayoutTransaction_payoutAssignmentId_idx" ON "PayoutTransaction"("payoutAssignmentId");
CREATE INDEX "PayoutTransaction_payoutOfficerUserId_idx" ON "PayoutTransaction"("payoutOfficerUserId");
CREATE INDEX "PayoutTransaction_status_idx" ON "PayoutTransaction"("status");
CREATE UNIQUE INDEX "StrengthMetricDefinition_metric_key" ON "StrengthMetricDefinition"("metric");
CREATE INDEX "StrengthMetricDefinition_active_idx" ON "StrengthMetricDefinition"("active");
CREATE INDEX "StrengthWeightConfiguration_metric_effectiveFrom_idx" ON "StrengthWeightConfiguration"("metric", "effectiveFrom");
CREATE INDEX "TerritoryTarget_territoryType_territoryId_idx" ON "TerritoryTarget"("territoryType", "territoryId");
CREATE INDEX "TerritoryTarget_metric_idx" ON "TerritoryTarget"("metric");
CREATE INDEX "TerritoryTarget_candidateId_idx" ON "TerritoryTarget"("candidateId");
CREATE INDEX "TerritoryMetricSnapshot_scope_metric_time_idx" ON "TerritoryMetricSnapshot"("territoryType", "territoryId", "metric", "calculatedAt");
CREATE INDEX "TerritoryStrengthSnapshot_scope_time_idx" ON "TerritoryStrengthSnapshot"("territoryType", "territoryId", "calculatedAt");
CREATE INDEX "TerritoryStrengthSnapshot_candidateId_idx" ON "TerritoryStrengthSnapshot"("candidateId");

-- AddForeignKey
ALTER TABLE "VoterVerification" ADD CONSTRAINT "VoterVerification_memberUserId_fkey" FOREIGN KEY ("memberUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VoterVerification" ADD CONSTRAINT "VoterVerification_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VoterVerificationDocument" ADD CONSTRAINT "VoterVerificationDocument_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "VoterVerification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VoterVerificationHistory" ADD CONSTRAINT "VoterVerificationHistory_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "VoterVerification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VoterVerificationHistory" ADD CONSTRAINT "VoterVerificationHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReferralCode" ADD CONSTRAINT "ReferralCode_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerUserId_fkey" FOREIGN KEY ("referrerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referralCodeId_fkey" FOREIGN KEY ("referralCodeId") REFERENCES "ReferralCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RewardRule" ADD CONSTRAINT "RewardRule_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RewardRuleVersion" ADD CONSTRAINT "RewardRuleVersion_rewardRuleId_fkey" FOREIGN KEY ("rewardRuleId") REFERENCES "RewardRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RewardEvent" ADD CONSTRAINT "RewardEvent_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RewardEvent" ADD CONSTRAINT "RewardEvent_rewardRuleVersionId_fkey" FOREIGN KEY ("rewardRuleVersionId") REFERENCES "RewardRuleVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RewardLedgerEntry" ADD CONSTRAINT "RewardLedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RewardLedgerEntry" ADD CONSTRAINT "RewardLedgerEntry_relatedUserId_fkey" FOREIGN KEY ("relatedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RewardLedgerEntry" ADD CONSTRAINT "RewardLedgerEntry_sourceEventId_fkey" FOREIGN KEY ("sourceEventId") REFERENCES "RewardEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RewardLedgerEntry" ADD CONSTRAINT "RewardLedgerEntry_rewardRuleVersionId_fkey" FOREIGN KEY ("rewardRuleVersionId") REFERENCES "RewardRuleVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayoutConfiguration" ADD CONSTRAINT "PayoutConfiguration_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayoutBatch" ADD CONSTRAINT "PayoutBatch_payoutCycleId_fkey" FOREIGN KEY ("payoutCycleId") REFERENCES "PayoutCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayoutAssignment" ADD CONSTRAINT "PayoutAssignment_payoutBatchId_fkey" FOREIGN KEY ("payoutBatchId") REFERENCES "PayoutBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayoutAssignment" ADD CONSTRAINT "PayoutAssignment_payoutOfficerUserId_fkey" FOREIGN KEY ("payoutOfficerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayoutAssignment" ADD CONSTRAINT "PayoutAssignment_beneficiaryUserId_fkey" FOREIGN KEY ("beneficiaryUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayoutTransaction" ADD CONSTRAINT "PayoutTransaction_payoutAssignmentId_fkey" FOREIGN KEY ("payoutAssignmentId") REFERENCES "PayoutAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayoutTransaction" ADD CONSTRAINT "PayoutTransaction_payoutOfficerUserId_fkey" FOREIGN KEY ("payoutOfficerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StrengthMetricDefinition" ADD CONSTRAINT "StrengthMetricDefinition_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StrengthWeightConfiguration" ADD CONSTRAINT "StrengthWeightConfiguration_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TerritoryTarget" ADD CONSTRAINT "TerritoryTarget_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
