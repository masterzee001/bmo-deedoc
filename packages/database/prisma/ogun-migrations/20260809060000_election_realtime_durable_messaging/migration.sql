-- CreateEnum
CREATE TYPE "OperationalAlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'ESCALATED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "OperationalAlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('DIRECT', 'GROUP', 'TERRITORY', 'ELECTION_OPERATION');

-- CreateEnum
CREATE TYPE "MessageReceiptStatus" AS ENUM ('DELIVERED', 'READ');

-- CreateEnum
CREATE TYPE "RealtimeEventDeliveryStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

-- CreateTable
CREATE TABLE "OperationalAlert" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "OperationalAlertStatus" NOT NULL DEFAULT 'OPEN',
    "severity" "OperationalAlertSeverity" NOT NULL DEFAULT 'MEDIUM',
    "message" TEXT NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "actorUserId" TEXT,
    "acknowledgedByUserId" TEXT,
    "resolvedByUserId" TEXT,
    "stateId" TEXT NOT NULL,
    "senatorialDistrictId" TEXT,
    "federalConstituencyId" TEXT,
    "stateConstituencyId" TEXT,
    "wardId" TEXT,
    "pollingUnitId" TEXT,
    "metadataJson" JSONB,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "escalatedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "type" "ConversationType" NOT NULL,
    "title" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "stateId" TEXT NOT NULL,
    "senatorialDistrictId" TEXT,
    "federalConstituencyId" TEXT,
    "stateConstituencyId" TEXT,
    "wardId" TEXT,
    "pollingUnitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationMember" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleLabel" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "lastReadAt" TIMESTAMP(3),

    CONSTRAINT "ConversationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "metadataJson" JSONB,
    "stateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageReceipt" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "MessageReceiptStatus" NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "evidenceAssetId" TEXT,
    "storageKey" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "sha256" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RealtimeEventOutbox" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventVersion" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "territoryJson" JSONB,
    "stateId" TEXT,
    "senatorialDistrictId" TEXT,
    "federalConstituencyId" TEXT,
    "stateConstituencyId" TEXT,
    "wardId" TEXT,
    "pollingUnitId" TEXT,
    "status" "RealtimeEventDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "committedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RealtimeEventOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OperationalAlert_type_status_idx" ON "OperationalAlert"("type", "status");

-- CreateIndex
CREATE INDEX "OperationalAlert_severity_status_idx" ON "OperationalAlert"("severity", "status");

-- CreateIndex
CREATE INDEX "OperationalAlert_sourceType_sourceId_idx" ON "OperationalAlert"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "OperationalAlert_stateId_idx" ON "OperationalAlert"("stateId");

-- CreateIndex
CREATE INDEX "OperationalAlert_senatorialDistrictId_idx" ON "OperationalAlert"("senatorialDistrictId");

-- CreateIndex
CREATE INDEX "OperationalAlert_federalConstituencyId_idx" ON "OperationalAlert"("federalConstituencyId");

-- CreateIndex
CREATE INDEX "OperationalAlert_stateConstituencyId_idx" ON "OperationalAlert"("stateConstituencyId");

-- CreateIndex
CREATE INDEX "OperationalAlert_wardId_idx" ON "OperationalAlert"("wardId");

-- CreateIndex
CREATE INDEX "OperationalAlert_pollingUnitId_idx" ON "OperationalAlert"("pollingUnitId");

-- CreateIndex
CREATE INDEX "OperationalAlert_detectedAt_idx" ON "OperationalAlert"("detectedAt");

-- CreateIndex
CREATE INDEX "Conversation_type_createdAt_idx" ON "Conversation"("type", "createdAt");

-- CreateIndex
CREATE INDEX "Conversation_createdByUserId_idx" ON "Conversation"("createdByUserId");

-- CreateIndex
CREATE INDEX "Conversation_stateId_idx" ON "Conversation"("stateId");

-- CreateIndex
CREATE INDEX "Conversation_senatorialDistrictId_idx" ON "Conversation"("senatorialDistrictId");

-- CreateIndex
CREATE INDEX "Conversation_federalConstituencyId_idx" ON "Conversation"("federalConstituencyId");

-- CreateIndex
CREATE INDEX "Conversation_stateConstituencyId_idx" ON "Conversation"("stateConstituencyId");

-- CreateIndex
CREATE INDEX "Conversation_wardId_idx" ON "Conversation"("wardId");

-- CreateIndex
CREATE INDEX "Conversation_pollingUnitId_idx" ON "Conversation"("pollingUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationMember_conversationId_userId_key" ON "ConversationMember"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "ConversationMember_userId_idx" ON "ConversationMember"("userId");

-- CreateIndex
CREATE INDEX "ConversationMember_conversationId_idx" ON "ConversationMember"("conversationId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_senderUserId_idx" ON "Message"("senderUserId");

-- CreateIndex
CREATE INDEX "Message_stateId_idx" ON "Message"("stateId");

-- CreateIndex
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MessageReceipt_messageId_userId_status_key" ON "MessageReceipt"("messageId", "userId", "status");

-- CreateIndex
CREATE INDEX "MessageReceipt_userId_status_idx" ON "MessageReceipt"("userId", "status");

-- CreateIndex
CREATE INDEX "MessageAttachment_messageId_idx" ON "MessageAttachment"("messageId");

-- CreateIndex
CREATE INDEX "MessageAttachment_evidenceAssetId_idx" ON "MessageAttachment"("evidenceAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "RealtimeEventOutbox_eventId_key" ON "RealtimeEventOutbox"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "RealtimeEventOutbox_idempotencyKey_key" ON "RealtimeEventOutbox"("idempotencyKey");

-- CreateIndex
CREATE INDEX "RealtimeEventOutbox_eventType_committedAt_idx" ON "RealtimeEventOutbox"("eventType", "committedAt");

-- CreateIndex
CREATE INDEX "RealtimeEventOutbox_status_committedAt_idx" ON "RealtimeEventOutbox"("status", "committedAt");

-- CreateIndex
CREATE INDEX "RealtimeEventOutbox_stateId_idx" ON "RealtimeEventOutbox"("stateId");

-- CreateIndex
CREATE INDEX "RealtimeEventOutbox_senatorialDistrictId_idx" ON "RealtimeEventOutbox"("senatorialDistrictId");

-- CreateIndex
CREATE INDEX "RealtimeEventOutbox_federalConstituencyId_idx" ON "RealtimeEventOutbox"("federalConstituencyId");

-- CreateIndex
CREATE INDEX "RealtimeEventOutbox_stateConstituencyId_idx" ON "RealtimeEventOutbox"("stateConstituencyId");

-- CreateIndex
CREATE INDEX "RealtimeEventOutbox_wardId_idx" ON "RealtimeEventOutbox"("wardId");

-- CreateIndex
CREATE INDEX "RealtimeEventOutbox_pollingUnitId_idx" ON "RealtimeEventOutbox"("pollingUnitId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReceipt" ADD CONSTRAINT "MessageReceipt_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReceipt" ADD CONSTRAINT "MessageReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
