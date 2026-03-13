CREATE TYPE "CampaignMediaType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT');

ALTER TABLE "CandidateProfile"
ADD COLUMN "portraitUrl" TEXT,
ADD COLUMN "campaignSlogan" TEXT,
ADD COLUMN "bio" TEXT,
ADD COLUMN "websiteUrl" TEXT,
ADD COLUMN "facebookUrl" TEXT,
ADD COLUMN "instagramUrl" TEXT,
ADD COLUMN "xUrl" TEXT,
ADD COLUMN "isProfilePublished" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "PoliticalParty"
ADD COLUMN "logoUrl" TEXT;

ALTER TABLE "Post"
ADD COLUMN "mediaType" "CampaignMediaType" NOT NULL DEFAULT 'TEXT',
ADD COLUMN "mediaUrl" TEXT,
ADD COLUMN "thumbnailUrl" TEXT;

CREATE INDEX "CandidateProfile_isProfilePublished_idx" ON "CandidateProfile"("isProfilePublished");
CREATE INDEX "Post_mediaType_idx" ON "Post"("mediaType");
