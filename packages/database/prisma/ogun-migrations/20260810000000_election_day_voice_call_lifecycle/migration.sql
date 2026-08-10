-- Election Day voice-call lifecycle and durable call history.
-- Additive only: creates new enums, tables, indexes, and foreign keys.
-- No existing table, column, or migration is modified.
-- PostgreSQL is authoritative for call lifecycle/history; Redis/Socket.IO
-- carries only transient signalling. Call media is never recorded.

-- CreateEnum
CREATE TYPE "VoiceCallStatus" AS ENUM ('INITIATED', 'RINGING', 'CONNECTED', 'ENDED');

-- CreateEnum
CREATE TYPE "VoiceCallEndReason" AS ENUM ('COMPLETED', 'REJECTED', 'MISSED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "VoiceCallParticipantStatus" AS ENUM ('CALLING', 'RINGING', 'ACCEPTED', 'REJECTED', 'MISSED', 'LEFT', 'FAILED');

-- CreateEnum
CREATE TYPE "VoiceCallEventType" AS ENUM ('INITIATED', 'RINGING', 'ACCEPTED', 'REJECTED', 'CONNECTED', 'ENDED', 'MISSED', 'FAILED', 'SIGNAL_RELAYED');

-- CreateTable
CREATE TABLE "VoiceCall" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT,
    "initiatorUserId" TEXT NOT NULL,
    "status" "VoiceCallStatus" NOT NULL DEFAULT 'INITIATED',
    "endReason" "VoiceCallEndReason",
    "stateId" TEXT NOT NULL,
    "senatorialDistrictId" TEXT,
    "federalConstituencyId" TEXT,
    "stateConstituencyId" TEXT,
    "wardId" TEXT,
    "pollingUnitId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ringingAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "endedByUserId" TEXT,
    "recordingPolicy" TEXT NOT NULL DEFAULT 'DISABLED',
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceCallParticipant" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isInitiator" BOOLEAN NOT NULL DEFAULT false,
    "status" "VoiceCallParticipantStatus" NOT NULL DEFAULT 'CALLING',
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ringingAt" TIMESTAMP(3),
    "answeredAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceCallParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceCallEvent" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "type" "VoiceCallEventType" NOT NULL,
    "actorUserId" TEXT,
    "targetUserId" TEXT,
    "signalType" TEXT,
    "fromStatus" "VoiceCallStatus",
    "toStatus" "VoiceCallStatus",
    "metadataJson" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceCallEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VoiceCall_status_startedAt_idx" ON "VoiceCall"("status", "startedAt");

-- CreateIndex
CREATE INDEX "VoiceCall_initiatorUserId_idx" ON "VoiceCall"("initiatorUserId");

-- CreateIndex
CREATE INDEX "VoiceCall_conversationId_idx" ON "VoiceCall"("conversationId");

-- CreateIndex
CREATE INDEX "VoiceCall_stateId_idx" ON "VoiceCall"("stateId");

-- CreateIndex
CREATE INDEX "VoiceCall_senatorialDistrictId_idx" ON "VoiceCall"("senatorialDistrictId");

-- CreateIndex
CREATE INDEX "VoiceCall_federalConstituencyId_idx" ON "VoiceCall"("federalConstituencyId");

-- CreateIndex
CREATE INDEX "VoiceCall_stateConstituencyId_idx" ON "VoiceCall"("stateConstituencyId");

-- CreateIndex
CREATE INDEX "VoiceCall_wardId_idx" ON "VoiceCall"("wardId");

-- CreateIndex
CREATE INDEX "VoiceCall_pollingUnitId_idx" ON "VoiceCall"("pollingUnitId");

-- CreateIndex
CREATE INDEX "VoiceCall_startedAt_idx" ON "VoiceCall"("startedAt");

-- CreateIndex
CREATE INDEX "VoiceCallParticipant_userId_status_idx" ON "VoiceCallParticipant"("userId", "status");

-- CreateIndex
CREATE INDEX "VoiceCallParticipant_callId_idx" ON "VoiceCallParticipant"("callId");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceCallParticipant_callId_userId_key" ON "VoiceCallParticipant"("callId", "userId");

-- CreateIndex
CREATE INDEX "VoiceCallEvent_callId_occurredAt_idx" ON "VoiceCallEvent"("callId", "occurredAt");

-- CreateIndex
CREATE INDEX "VoiceCallEvent_actorUserId_idx" ON "VoiceCallEvent"("actorUserId");

-- CreateIndex
CREATE INDEX "VoiceCallEvent_type_idx" ON "VoiceCallEvent"("type");

-- AddForeignKey
ALTER TABLE "VoiceCall" ADD CONSTRAINT "VoiceCall_initiatorUserId_fkey" FOREIGN KEY ("initiatorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceCallParticipant" ADD CONSTRAINT "VoiceCallParticipant_callId_fkey" FOREIGN KEY ("callId") REFERENCES "VoiceCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceCallParticipant" ADD CONSTRAINT "VoiceCallParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceCallEvent" ADD CONSTRAINT "VoiceCallEvent_callId_fkey" FOREIGN KEY ("callId") REFERENCES "VoiceCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceCallEvent" ADD CONSTRAINT "VoiceCallEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

