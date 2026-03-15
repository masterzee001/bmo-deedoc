ALTER TABLE "AdminProfile"
ADD COLUMN "politicalPartyId" TEXT;

ALTER TABLE "AgentProfile"
ADD COLUMN "politicalPartyId" TEXT;

ALTER TABLE "AdminProfile"
ADD CONSTRAINT "AdminProfile_politicalPartyId_fkey"
FOREIGN KEY ("politicalPartyId") REFERENCES "PoliticalParty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AgentProfile"
ADD CONSTRAINT "AgentProfile_politicalPartyId_fkey"
FOREIGN KEY ("politicalPartyId") REFERENCES "PoliticalParty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AdminProfile_politicalPartyId_idx" ON "AdminProfile"("politicalPartyId");
CREATE INDEX "AgentProfile_politicalPartyId_idx" ON "AgentProfile"("politicalPartyId");
