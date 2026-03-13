ALTER TABLE "PoliticalParty"
ADD COLUMN "description" TEXT,
ADD COLUMN "officialWebsite" TEXT,
ADD COLUMN "isApprovedByInec" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "inecSourceUrl" TEXT;

CREATE INDEX "PoliticalParty_isApprovedByInec_idx" ON "PoliticalParty"("isApprovedByInec");
