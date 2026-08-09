-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CoordinatorLevel" AS ENUM ('SENATORIAL_DISTRICT', 'FEDERAL_CONSTITUENCY', 'STATE_CONSTITUENCY', 'WARD', 'POLLING_UNIT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'STATE_OFFICER';
ALTER TYPE "UserRole" ADD VALUE 'COORDINATOR';
ALTER TYPE "UserRole" ADD VALUE 'VALIDATOR';
ALTER TYPE "UserRole" ADD VALUE 'PAYOUT_OFFICER';
ALTER TYPE "UserRole" ADD VALUE 'MEMBER';

-- AlterTable
ALTER TABLE "AdminCandidateAssignment" ADD COLUMN     "candidateId" TEXT;

-- AlterTable
ALTER TABLE "CampaignEvent" ADD COLUMN     "candidateId" TEXT;

-- AlterTable
ALTER TABLE "Feedback" ADD COLUMN     "candidateId" TEXT;

-- AlterTable
ALTER TABLE "Poll" ADD COLUMN     "candidateId" TEXT;

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "candidateId" TEXT;

-- AlterTable
ALTER TABLE "StateConstituency" ADD COLUMN     "federalConstituencyId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE';

-- Preserve the effective state of legacy inactive accounts.
UPDATE "User" SET "accountStatus" = 'INACTIVE' WHERE "isActive" = false;

-- AlterTable
ALTER TABLE "Ward" ADD COLUMN     "stateConstituencyId" TEXT;

-- CreateTable
CREATE TABLE "CoordinatorProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" "CoordinatorLevel" NOT NULL,
    "stateId" TEXT NOT NULL,
    "senatorialDistrictId" TEXT,
    "federalConstituencyId" TEXT,
    "stateConstituencyId" TEXT,
    "wardId" TEXT,
    "pollingUnitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoordinatorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "legacyUserId" TEXT,
    "fullName" TEXT NOT NULL,
    "officeType" "CandidateOfficeType" NOT NULL,
    "politicalPartyId" TEXT,
    "portraitUrl" TEXT,
    "portraitAssetId" TEXT,
    "campaignSlogan" TEXT,
    "bio" TEXT,
    "websiteUrl" TEXT,
    "facebookUrl" TEXT,
    "instagramUrl" TEXT,
    "xUrl" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "stateId" TEXT NOT NULL,
    "senatorialDistrictId" TEXT,
    "federalConstituencyId" TEXT,
    "stateConstituencyId" TEXT,
    "lgaId" TEXT,
    "wardId" TEXT,
    "pollingUnitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoordinatorProfile_userId_key" ON "CoordinatorProfile"("userId");

-- CreateIndex
CREATE INDEX "CoordinatorProfile_level_idx" ON "CoordinatorProfile"("level");

-- CreateIndex
CREATE INDEX "CoordinatorProfile_stateId_idx" ON "CoordinatorProfile"("stateId");

-- CreateIndex
CREATE INDEX "CoordinatorProfile_senatorialDistrictId_idx" ON "CoordinatorProfile"("senatorialDistrictId");

-- CreateIndex
CREATE INDEX "CoordinatorProfile_federalConstituencyId_idx" ON "CoordinatorProfile"("federalConstituencyId");

-- CreateIndex
CREATE INDEX "CoordinatorProfile_stateConstituencyId_idx" ON "CoordinatorProfile"("stateConstituencyId");

-- CreateIndex
CREATE INDEX "CoordinatorProfile_wardId_idx" ON "CoordinatorProfile"("wardId");

-- CreateIndex
CREATE INDEX "CoordinatorProfile_pollingUnitId_idx" ON "CoordinatorProfile"("pollingUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_legacyUserId_key" ON "Candidate"("legacyUserId");

-- CreateIndex
CREATE INDEX "Candidate_officeType_idx" ON "Candidate"("officeType");

-- CreateIndex
CREATE INDEX "Candidate_politicalPartyId_idx" ON "Candidate"("politicalPartyId");

-- CreateIndex
CREATE INDEX "Candidate_portraitAssetId_idx" ON "Candidate"("portraitAssetId");

-- CreateIndex
CREATE INDEX "Candidate_isPublished_idx" ON "Candidate"("isPublished");

-- CreateIndex
CREATE INDEX "Candidate_isActive_idx" ON "Candidate"("isActive");

-- CreateIndex
CREATE INDEX "Candidate_stateId_idx" ON "Candidate"("stateId");

-- CreateIndex
CREATE INDEX "Candidate_senatorialDistrictId_idx" ON "Candidate"("senatorialDistrictId");

-- CreateIndex
CREATE INDEX "Candidate_federalConstituencyId_idx" ON "Candidate"("federalConstituencyId");

-- CreateIndex
CREATE INDEX "Candidate_stateConstituencyId_idx" ON "Candidate"("stateConstituencyId");

-- CreateIndex
CREATE INDEX "Candidate_lgaId_idx" ON "Candidate"("lgaId");

-- CreateIndex
CREATE INDEX "Candidate_wardId_idx" ON "Candidate"("wardId");

-- CreateIndex
CREATE INDEX "Candidate_pollingUnitId_idx" ON "Candidate"("pollingUnitId");

-- CreateIndex
CREATE INDEX "AdminCandidateAssignment_candidateId_idx" ON "AdminCandidateAssignment"("candidateId");

-- CreateIndex
CREATE INDEX "CampaignEvent_candidateId_idx" ON "CampaignEvent"("candidateId");

-- CreateIndex
CREATE INDEX "Feedback_candidateId_idx" ON "Feedback"("candidateId");

-- CreateIndex
CREATE INDEX "Poll_candidateId_idx" ON "Poll"("candidateId");

-- CreateIndex
CREATE INDEX "Post_candidateId_idx" ON "Post"("candidateId");

-- CreateIndex
CREATE INDEX "StateConstituency_federalConstituencyId_idx" ON "StateConstituency"("federalConstituencyId");

-- CreateIndex
CREATE INDEX "User_accountStatus_idx" ON "User"("accountStatus");

-- CreateIndex
CREATE INDEX "Ward_stateConstituencyId_idx" ON "Ward"("stateConstituencyId");

-- AddForeignKey
ALTER TABLE "CoordinatorProfile" ADD CONSTRAINT "CoordinatorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoordinatorProfile" ADD CONSTRAINT "CoordinatorProfile_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoordinatorProfile" ADD CONSTRAINT "CoordinatorProfile_senatorialDistrictId_fkey" FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoordinatorProfile" ADD CONSTRAINT "CoordinatorProfile_federalConstituencyId_fkey" FOREIGN KEY ("federalConstituencyId") REFERENCES "FederalConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoordinatorProfile" ADD CONSTRAINT "CoordinatorProfile_stateConstituencyId_fkey" FOREIGN KEY ("stateConstituencyId") REFERENCES "StateConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoordinatorProfile" ADD CONSTRAINT "CoordinatorProfile_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoordinatorProfile" ADD CONSTRAINT "CoordinatorProfile_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_legacyUserId_fkey" FOREIGN KEY ("legacyUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_politicalPartyId_fkey" FOREIGN KEY ("politicalPartyId") REFERENCES "PoliticalParty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_portraitAssetId_fkey" FOREIGN KEY ("portraitAssetId") REFERENCES "CandidateMediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_senatorialDistrictId_fkey" FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_federalConstituencyId_fkey" FOREIGN KEY ("federalConstituencyId") REFERENCES "FederalConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_stateConstituencyId_fkey" FOREIGN KEY ("stateConstituencyId") REFERENCES "StateConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminCandidateAssignment" ADD CONSTRAINT "AdminCandidateAssignment_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignEvent" ADD CONSTRAINT "CampaignEvent_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ward" ADD CONSTRAINT "Ward_stateConstituencyId_fkey" FOREIGN KEY ("stateConstituencyId") REFERENCES "StateConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StateConstituency" ADD CONSTRAINT "StateConstituency_federalConstituencyId_fkey" FOREIGN KEY ("federalConstituencyId") REFERENCES "FederalConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
