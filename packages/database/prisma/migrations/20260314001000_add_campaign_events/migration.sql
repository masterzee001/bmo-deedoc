CREATE TYPE "CampaignEventRsvpStatus" AS ENUM ('INTERESTED', 'GOING');

CREATE TABLE "CampaignEvent" (
    "id" TEXT NOT NULL,
    "candidateUserId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "coverImageUrl" TEXT,
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

CREATE TABLE "CampaignEventRsvp" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "voterUserId" TEXT NOT NULL,
    "status" "CampaignEventRsvpStatus" NOT NULL DEFAULT 'GOING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CampaignEventRsvp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CampaignEventRsvp_eventId_voterUserId_key" ON "CampaignEventRsvp"("eventId", "voterUserId");
CREATE INDEX "CampaignEvent_candidateUserId_idx" ON "CampaignEvent"("candidateUserId");
CREATE INDEX "CampaignEvent_createdByUserId_idx" ON "CampaignEvent"("createdByUserId");
CREATE INDEX "CampaignEvent_isPublished_idx" ON "CampaignEvent"("isPublished");
CREATE INDEX "CampaignEvent_startsAt_idx" ON "CampaignEvent"("startsAt");
CREATE INDEX "CampaignEvent_stateId_idx" ON "CampaignEvent"("stateId");
CREATE INDEX "CampaignEvent_lgaId_idx" ON "CampaignEvent"("lgaId");
CREATE INDEX "CampaignEvent_wardId_idx" ON "CampaignEvent"("wardId");
CREATE INDEX "CampaignEvent_pollingUnitId_idx" ON "CampaignEvent"("pollingUnitId");
CREATE INDEX "CampaignEventRsvp_voterUserId_idx" ON "CampaignEventRsvp"("voterUserId");
CREATE INDEX "CampaignEventRsvp_status_idx" ON "CampaignEventRsvp"("status");

ALTER TABLE "CampaignEvent"
ADD CONSTRAINT "CampaignEvent_candidateUserId_fkey" FOREIGN KEY ("candidateUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignEvent"
ADD CONSTRAINT "CampaignEvent_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignEvent"
ADD CONSTRAINT "CampaignEvent_geoPoliticalZoneId_fkey" FOREIGN KEY ("geoPoliticalZoneId") REFERENCES "GeoPoliticalZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CampaignEvent"
ADD CONSTRAINT "CampaignEvent_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CampaignEvent"
ADD CONSTRAINT "CampaignEvent_senatorialDistrictId_fkey" FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CampaignEvent"
ADD CONSTRAINT "CampaignEvent_federalConstituencyId_fkey" FOREIGN KEY ("federalConstituencyId") REFERENCES "FederalConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CampaignEvent"
ADD CONSTRAINT "CampaignEvent_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CampaignEvent"
ADD CONSTRAINT "CampaignEvent_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CampaignEvent"
ADD CONSTRAINT "CampaignEvent_stateConstituencyId_fkey" FOREIGN KEY ("stateConstituencyId") REFERENCES "StateConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CampaignEvent"
ADD CONSTRAINT "CampaignEvent_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CampaignEventRsvp"
ADD CONSTRAINT "CampaignEventRsvp_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CampaignEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignEventRsvp"
ADD CONSTRAINT "CampaignEventRsvp_voterUserId_fkey" FOREIGN KEY ("voterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
