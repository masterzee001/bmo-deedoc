ALTER TABLE "AgentProfile"
ADD COLUMN "gpsTrackingConsentAt" TIMESTAMP(3),
ADD COLUMN "activeSessionNonce" TEXT;

CREATE INDEX "AgentProfile_activeSessionNonce_idx" ON "AgentProfile"("activeSessionNonce");
