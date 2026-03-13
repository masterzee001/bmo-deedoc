ALTER TABLE "VoterProfile"
ADD COLUMN "contactConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
