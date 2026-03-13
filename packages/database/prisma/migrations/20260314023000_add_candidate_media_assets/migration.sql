CREATE TYPE "CandidateMediaAssetKind" AS ENUM ('PROFILE_PHOTO', 'EVENT_COVER');

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

ALTER TABLE "CandidateProfile"
ADD COLUMN "portraitAssetId" TEXT;

ALTER TABLE "CampaignEvent"
ADD COLUMN "coverImageAssetId" TEXT;

CREATE INDEX "CandidateMediaAsset_ownerUserId_idx" ON "CandidateMediaAsset"("ownerUserId");
CREATE INDEX "CandidateMediaAsset_kind_idx" ON "CandidateMediaAsset"("kind");
CREATE INDEX "CandidateProfile_portraitAssetId_idx" ON "CandidateProfile"("portraitAssetId");
CREATE INDEX "CampaignEvent_coverImageAssetId_idx" ON "CampaignEvent"("coverImageAssetId");

ALTER TABLE "CandidateMediaAsset"
ADD CONSTRAINT "CandidateMediaAsset_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CandidateProfile"
ADD CONSTRAINT "CandidateProfile_portraitAssetId_fkey" FOREIGN KEY ("portraitAssetId") REFERENCES "CandidateMediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CampaignEvent"
ADD CONSTRAINT "CampaignEvent_coverImageAssetId_fkey" FOREIGN KEY ("coverImageAssetId") REFERENCES "CandidateMediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
