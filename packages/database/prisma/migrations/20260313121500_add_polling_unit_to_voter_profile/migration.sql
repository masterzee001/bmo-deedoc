ALTER TABLE "VoterProfile"
ADD COLUMN "pollingUnitId" TEXT;

CREATE INDEX "VoterProfile_pollingUnitId_idx" ON "VoterProfile"("pollingUnitId");

ALTER TABLE "VoterProfile"
ADD CONSTRAINT "VoterProfile_pollingUnitId_fkey"
FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
