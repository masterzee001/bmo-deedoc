import { Router } from "express";
import {
  AgentActivityType,
  BroadcastAudience,
  ConversationType,
  FieldTaskPriority,
  FieldTaskStatus,
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
  MessageReceiptStatus,
  NotificationType,
  OperationalAlertSeverity,
  OperationalAlertStatus,
  Prisma,
  VoiceCallEndReason,
  VoiceCallEventType,
  VoiceCallParticipantStatus,
  VoiceCallStatus,
} from "@prisma/client";
import {
  ELECTION_DAY_REALTIME_EVENT_TYPES,
  OGUN_STATE_ID,
  VOICE_CALL_SIGNAL_TYPES,
  canTransitionVoiceCall,
  type AuthUserProfile,
  type ElectionDayCallEventItem,
  type ElectionDayCallItem,
  type ElectionDayCallParticipantItem,
  type ElectionDayConversationItem,
  type ElectionDayLocationEvaluation,
  type ElectionDayMessageItem,
  type ElectionDayOperationalAlertItem,
  type ElectionDayPollingUnitStatus,
  type ElectionDaySituationRoomStatus,
  type ElectionDayTimelineItem,
  type ElectionDayWebrtcConfig,
  type OperationalTerritory,
  type PollingUnitOperationalStatus,
  type RealtimePresenceEntry,
} from "@pics-nigeria/shared";
import { z } from "zod";
import { authorizeAction, resolveOperationalTerritory } from "../authorization";
import { getAuthUserProfile } from "../auth/profile";
import { createAuditLog } from "../lib/audit";
import { canContactUser, contactTerritoryForUser, messagingCommandScope } from "../lib/messaging-permissions";
import { createNotification } from "../lib/notifications";
import { serializeBroadcastMessageItem, serializeIncidentItem } from "../lib/serializers";
import { validateTerritoryReferences } from "../lib/territory";
import { requireAuth, requirePollingUnitFieldCapability } from "../middleware/auth";
import { prisma } from "../prisma";
import { createElectionDayRealtimeEvent } from "../realtime/events";
import { env } from "../env";
import {
  getPresenceSnapshot,
  getRealtimeGatewayStatus,
  publishRealtimeEvent,
  publishRealtimeEventToUsers,
} from "../realtime/gateway";

const router = Router();

const operationPayloadSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracyMeters: z.number().positive().max(5000).optional(),
  note: z.string().trim().max(500).optional(),
  pollingUnitId: z.string().trim().optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});

const incidentSchema = z.object({
  type: z.nativeEnum(IncidentType),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(1500),
  severity: z.nativeEnum(IncidentSeverity),
  pollingUnitId: z.string().trim().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

const territoryMessageSchema = z.object({
  title: z.string().trim().min(3).max(120),
  message: z.string().trim().min(5).max(1500),
});

const statusQuerySchema = z.object({
  reportDate: z.string().date().optional(),
});

const alertQuerySchema = z.object({
  status: z.nativeEnum(OperationalAlertStatus).optional(),
  type: z.string().trim().max(80).optional(),
  reportDate: z.string().date().optional(),
});

const alertLifecycleSchema = z.object({
  status: z.enum(["ACKNOWLEDGED", "ESCALATED", "RESOLVED"]),
  note: z.string().trim().max(500).optional(),
});

const conversationCreateSchema = z.object({
  type: z.enum(["DIRECT", "GROUP", "TERRITORY", "ELECTION_OPERATION"]).default("DIRECT"),
  title: z.string().trim().min(3).max(120).optional(),
  recipientUserId: z.string().trim().optional(),
  memberUserIds: z.array(z.string().trim()).min(1).max(100).optional(),
  territory: z
    .object({
      stateId: z.string().trim().optional(),
      senatorialDistrictId: z.string().trim().nullable().optional(),
      federalConstituencyId: z.string().trim().nullable().optional(),
      stateConstituencyId: z.string().trim().nullable().optional(),
      wardId: z.string().trim().nullable().optional(),
      pollingUnitId: z.string().trim().nullable().optional(),
    })
    .optional(),
});

const messageCreateSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  metadata: z.record(z.unknown()).optional(),
});

const timelineQuerySchema = z.object({
  reportDate: z.string().date().optional(),
  limit: z.coerce.number().int().min(10).max(200).default(80),
});

const callInitiateSchema = z.object({
  targetUserId: z.string().trim().min(1),
  conversationId: z.string().trim().optional(),
});

const callEndSchema = z.object({
  reason: z.enum(["COMPLETED", "CANCELLED", "FAILED"]).optional(),
});

const callSignalSchema = z.object({
  signalType: z.enum(VOICE_CALL_SIGNAL_TYPES),
  targetUserId: z.string().trim().min(1),
  /** Relayed verbatim to the peer and never persisted. */
  signal: z.unknown(),
});

const callHistoryQuerySchema = z.object({
  status: z.nativeEnum(VoiceCallStatus).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const realtimeReplaySchema = z.object({
  /** ISO cursor of the last event the client already applied. */
  since: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

type AgentProfileForOperation = {
  userId: string;
  geoPoliticalZoneId: string | null;
  stateId: string;
  senatorialDistrictId: string | null;
  federalConstituencyId: string | null;
  lgaId: string;
  wardId: string;
  stateConstituencyId: string | null;
  pollingUnitId: string | null;
  gpsTrackingConsentAt: Date | null;
};

type ActivityRow = {
  agentUserId: string;
  type: AgentActivityType;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  pollingUnitId: string | null;
  createdAt: Date;
};

type ReportRow = {
  pollingUnitId: string;
  status: "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
  openingStatus: "OPENED_ON_TIME" | "OPENED_LATE" | "NOT_OPEN";
  voteEntriesJson: Prisma.JsonValue;
  arrivalPhotoAssetId: string;
  postCountingPhotoAssetId: string;
  createdAt: Date;
};

function todayUtcRange(reportDate?: string) {
  const day = reportDate || new Date().toISOString().slice(0, 10);
  const start = new Date(`${day}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 86_400_000);
  return { day, start, end };
}

function commandScopeForActor(actor: AuthUserProfile): OperationalTerritory | null {
  if (actor.role === "SUPER_ADMIN" || actor.role === "STATE_OFFICER") {
    return { stateId: OGUN_STATE_ID };
  }

  if (actor.role !== "COORDINATOR" || !actor.coordinatorProfile) {
    return null;
  }

  return {
    stateId: actor.coordinatorProfile.stateId || OGUN_STATE_ID,
    senatorialDistrictId: actor.coordinatorProfile.senatorialDistrictId,
    federalConstituencyId: actor.coordinatorProfile.federalConstituencyId,
    stateConstituencyId: actor.coordinatorProfile.stateConstituencyId,
    wardId: actor.coordinatorProfile.wardId,
    pollingUnitId: actor.coordinatorProfile.pollingUnitId,
  };
}

function scopeToWhere(scope: OperationalTerritory): Prisma.PollingUnitWhereInput {
  return {
    stateId: scope.stateId,
    wardId: scope.wardId || undefined,
    id: scope.pollingUnitId || undefined,
    ward: {
      stateConstituencyId: scope.stateConstituencyId || undefined,
      stateConstituency: scope.federalConstituencyId
        ? { federalConstituencyId: scope.federalConstituencyId }
        : scope.senatorialDistrictId
          ? { federalConstituency: { senatorialDistrictId: scope.senatorialDistrictId } }
          : undefined,
    },
  };
}

function territoryFilter(scope: OperationalTerritory) {
  return {
    stateId: scope.stateId,
    senatorialDistrictId: scope.senatorialDistrictId || undefined,
    federalConstituencyId: scope.federalConstituencyId || undefined,
    stateConstituencyId: scope.stateConstituencyId || undefined,
    wardId: scope.wardId || undefined,
    pollingUnitId: scope.pollingUnitId || undefined,
  };
}

function operationalTerritoryFromProfile(profile: {
  stateId: string;
  senatorialDistrictId?: string | null;
  federalConstituencyId?: string | null;
  stateConstituencyId?: string | null;
  wardId?: string | null;
  pollingUnitId?: string | null;
}): OperationalTerritory {
  return {
    stateId: profile.stateId,
    senatorialDistrictId: profile.senatorialDistrictId || null,
    federalConstituencyId: profile.federalConstituencyId || null,
    stateConstituencyId: profile.stateConstituencyId || null,
    wardId: profile.wardId || null,
    pollingUnitId: profile.pollingUnitId || null,
  };
}

async function requireCommandScope(actor: AuthUserProfile): Promise<OperationalTerritory | null> {
  const scope = commandScopeForActor(actor);
  if (!scope) {
    return null;
  }

  const resolved = await resolveOperationalTerritory(prisma, scope);
  return authorizeAction(actor, "VIEW_TERRITORY", resolved) ? scope : null;
}

async function getAgentProfileOrError(userId: string): Promise<AgentProfileForOperation | null> {
  return prisma.agentProfile.findUnique({
    where: { userId },
    select: {
      userId: true,
      geoPoliticalZoneId: true,
      stateId: true,
      senatorialDistrictId: true,
      federalConstituencyId: true,
      lgaId: true,
      wardId: true,
      stateConstituencyId: true,
      pollingUnitId: true,
      gpsTrackingConsentAt: true,
    },
  });
}

function buildGeodataGatedEvaluation(accuracyMeters?: number | null): ElectionDayLocationEvaluation {
  return {
    status: "GATED_AUTHORITATIVE_PU_GEODATA_REQUIRED",
    checkedAt: new Date().toISOString(),
    reason: "Polling Unit geofence evaluation is gated until authoritative PU latitude, longitude, and radius data are approved.",
    distanceMeters: null,
    accuracyMeters: accuracyMeters ?? null,
  };
}

function serializeAlert(alert: {
  id: string;
  type: string;
  status: OperationalAlertStatus;
  severity: OperationalAlertSeverity;
  message: string;
  sourceType: string | null;
  sourceId: string | null;
  actorUserId: string | null;
  acknowledgedByUserId: string | null;
  resolvedByUserId: string | null;
  stateId: string;
  senatorialDistrictId: string | null;
  federalConstituencyId: string | null;
  stateConstituencyId: string | null;
  wardId: string | null;
  pollingUnitId: string | null;
  metadataJson: Prisma.JsonValue | null;
  detectedAt: Date;
  acknowledgedAt: Date | null;
  escalatedAt: Date | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ElectionDayOperationalAlertItem {
  return {
    id: alert.id,
    type: alert.type,
    status: alert.status,
    severity: alert.severity,
    message: alert.message,
    sourceType: alert.sourceType,
    sourceId: alert.sourceId,
    actorUserId: alert.actorUserId,
    acknowledgedByUserId: alert.acknowledgedByUserId,
    resolvedByUserId: alert.resolvedByUserId,
    territory: {
      stateId: alert.stateId,
      senatorialDistrictId: alert.senatorialDistrictId,
      federalConstituencyId: alert.federalConstituencyId,
      stateConstituencyId: alert.stateConstituencyId,
      wardId: alert.wardId,
      pollingUnitId: alert.pollingUnitId,
    },
    metadata: alert.metadataJson && typeof alert.metadataJson === "object" && !Array.isArray(alert.metadataJson)
      ? alert.metadataJson as Record<string, unknown>
      : null,
    detectedAt: alert.detectedAt.toISOString(),
    acknowledgedAt: alert.acknowledgedAt?.toISOString() || null,
    escalatedAt: alert.escalatedAt?.toISOString() || null,
    resolvedAt: alert.resolvedAt?.toISOString() || null,
    createdAt: alert.createdAt.toISOString(),
    updatedAt: alert.updatedAt.toISOString(),
  };
}

function serializeMessage(message: {
  id: string;
  conversationId: string;
  senderUserId: string;
  body: string;
  metadataJson: Prisma.JsonValue | null;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  senderUser: { name: string };
  receipts: Array<{
    userId: string;
    status: MessageReceiptStatus;
    deliveredAt: Date | null;
    readAt: Date | null;
  }>;
  attachments: Array<{
    id: string;
    evidenceAssetId: string | null;
    fileName: string | null;
    mimeType: string | null;
    fileSize: number | null;
    sha256: string | null;
  }>;
}): ElectionDayMessageItem {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderUserId: message.senderUserId,
    senderName: message.senderUser.name,
    body: message.deletedAt ? "" : message.body,
    metadata: message.metadataJson && typeof message.metadataJson === "object" && !Array.isArray(message.metadataJson)
      ? message.metadataJson as Record<string, unknown>
      : null,
    createdAt: message.createdAt.toISOString(),
    editedAt: message.editedAt?.toISOString() || null,
    deletedAt: message.deletedAt?.toISOString() || null,
    receipts: message.receipts.map((receipt) => ({
      userId: receipt.userId,
      status: receipt.status,
      deliveredAt: receipt.deliveredAt?.toISOString() || null,
      readAt: receipt.readAt?.toISOString() || null,
    })),
    attachments: message.attachments.map((attachment) => ({
      id: attachment.id,
      evidenceAssetId: attachment.evidenceAssetId,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
      sha256: attachment.sha256,
    })),
  };
}

function serializeConversation(
  conversation: {
    id: string;
    type: ConversationType;
    title: string | null;
    createdByUserId: string;
    stateId: string;
    senatorialDistrictId: string | null;
    federalConstituencyId: string | null;
    stateConstituencyId: string | null;
    wardId: string | null;
    pollingUnitId: string | null;
    createdAt: Date;
    updatedAt: Date;
    members: Array<{
      userId: string;
      roleLabel: string | null;
      lastReadAt: Date | null;
      user: { name: string; role: string };
    }>;
    messages: Array<Parameters<typeof serializeMessage>[0]>;
  },
  presence: RealtimePresenceEntry[],
  actorUserId: string,
): ElectionDayConversationItem {
  const presenceByUserId = new Map(presence.map((entry) => [entry.userId, entry]));
  const lastMessage = conversation.messages[0] ? serializeMessage(conversation.messages[0]) : null;
  const actorMember = conversation.members.find((member) => member.userId === actorUserId);
  const unreadCount = actorMember?.lastReadAt
    ? conversation.messages.filter((message) => message.senderUserId !== actorUserId && message.createdAt > actorMember.lastReadAt!).length
    : conversation.messages.filter((message) => message.senderUserId !== actorUserId).length;

  return {
    id: conversation.id,
    type: conversation.type,
    title: conversation.title,
    territory: {
      stateId: conversation.stateId,
      senatorialDistrictId: conversation.senatorialDistrictId,
      federalConstituencyId: conversation.federalConstituencyId,
      stateConstituencyId: conversation.stateConstituencyId,
      wardId: conversation.wardId,
      pollingUnitId: conversation.pollingUnitId,
    },
    createdByUserId: conversation.createdByUserId,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    members: conversation.members.map((member) => {
      const entry = presenceByUserId.get(member.userId);
      return {
        userId: member.userId,
        name: member.user.name,
        role: member.user.role,
        roleLabel: member.roleLabel,
        presence: entry?.state || "OFFLINE",
        lastSeenAt: entry?.lastSeenAt || null,
        lastReadAt: member.lastReadAt?.toISOString() || null,
      };
    }),
    lastMessage,
    unreadCount,
  };
}

async function persistAndPublishRealtimeEvent(event: ReturnType<typeof createElectionDayRealtimeEvent>) {
  await prisma.realtimeEventOutbox
    .create({
      data: {
        eventId: event.eventId,
        eventType: event.eventType,
        eventVersion: event.eventVersion,
        idempotencyKey: event.idempotencyKey,
        payloadJson: event.payload as Prisma.InputJsonValue,
        territoryJson: event.territory as Prisma.InputJsonValue,
        stateId: event.territory?.stateId || null,
        senatorialDistrictId: event.territory?.senatorialDistrictId || null,
        federalConstituencyId: event.territory?.federalConstituencyId || null,
        stateConstituencyId: event.territory?.stateConstituencyId || null,
        wardId: event.territory?.wardId || null,
        pollingUnitId: event.territory?.pollingUnitId || null,
      },
    })
    .catch((error) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return null;
      }
      throw error;
    });

  const published = publishRealtimeEvent(event);
  if (published) {
    await prisma.realtimeEventOutbox
      .update({
        where: { idempotencyKey: event.idempotencyKey },
        data: { status: "PUBLISHED", publishedAt: new Date(), attempts: { increment: 1 } },
      })
      .catch(() => undefined);
  }
  return published;
}

function severityForAlert(type: string): OperationalAlertSeverity {
  if (type === "TRACKING_STOPPED" || type === "GPS_PERMISSION_DISABLED") {
    return "HIGH";
  }
  if (type === "NO_CHECK_IN" || type === "REPORT_OVERDUE" || type === "LOCATION_STALE") {
    return "MEDIUM";
  }
  return "LOW";
}

function alertMessageForStatus(status: ElectionDayPollingUnitStatus, type: string) {
  const name = status.pollingUnitName || status.pollingUnitId;
  if (type === "NO_CHECK_IN") {
    return `${name} has an assigned coordinator but no Election Day check-in.`;
  }
  if (type === "REPORT_OVERDUE") {
    return `${name} has checked in but has not submitted the structured Election Day report.`;
  }
  if (type === "LOCATION_STALE") {
    return `${name} has stale GPS tracking; the last location is older than the allowed threshold.`;
  }
  return `${name} requires Election Day operational review.`;
}

async function upsertOpenAlert(input: {
  type: string;
  pollingUnit: ElectionDayPollingUnitStatus;
  territory: OperationalTerritory;
  actorUserId: string;
  sourceType: string;
  sourceId: string;
  metadata?: Record<string, unknown>;
}) {
  const existing = await prisma.operationalAlert.findFirst({
    where: {
      type: input.type,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      status: { in: [OperationalAlertStatus.OPEN, OperationalAlertStatus.ACKNOWLEDGED, OperationalAlertStatus.ESCALATED] },
    },
  });
  if (existing) {
    return { alert: existing, created: false };
  }

  const alert = await prisma.operationalAlert.create({
    data: {
      type: input.type,
      status: OperationalAlertStatus.OPEN,
      severity: severityForAlert(input.type),
      message: alertMessageForStatus(input.pollingUnit, input.type),
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      actorUserId: input.actorUserId,
      stateId: input.territory.stateId,
      senatorialDistrictId: input.territory.senatorialDistrictId || null,
      federalConstituencyId: input.territory.federalConstituencyId || null,
      stateConstituencyId: input.territory.stateConstituencyId || null,
      wardId: input.territory.wardId || null,
      pollingUnitId: input.pollingUnit.pollingUnitId,
      metadataJson: (input.metadata || {}) as Prisma.InputJsonObject,
    },
  });

  await createAuditLog(prisma, {
    actorUserId: input.actorUserId,
    action: "ELECTION_DAY_ALERT_CREATED",
    targetType: "OperationalAlert",
    targetId: alert.id,
    territory: alert,
    metadata: { type: alert.type, sourceType: alert.sourceType, sourceId: alert.sourceId },
  });

  return { alert, created: true };
}

function getPollingUnitTerritory(status: ElectionDayPollingUnitStatus, scope: OperationalTerritory): OperationalTerritory {
  return {
    stateId: scope.stateId,
    senatorialDistrictId: scope.senatorialDistrictId || null,
    federalConstituencyId: scope.federalConstituencyId || null,
    stateConstituencyId: scope.stateConstituencyId || null,
    wardId: scope.wardId || null,
    pollingUnitId: status.pollingUnitId,
  };
}

async function targetTerritoryForUser(userId: string): Promise<OperationalTerritory | null> {
  const profile = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      coordinatorProfile: true,
      agentProfile: true,
      voterProfile: true,
      isActive: true,
      accountStatus: true,
    },
  });
  if (!profile?.isActive || profile.accountStatus !== "ACTIVE") {
    return null;
  }
  const territory = profile.coordinatorProfile || profile.agentProfile || profile.voterProfile;
  if (!territory?.stateId) {
    return profile.role === "SUPER_ADMIN" || profile.role === "STATE_OFFICER" ? { stateId: OGUN_STATE_ID } : null;
  }
  return {
    stateId: territory.stateId,
    senatorialDistrictId: territory.senatorialDistrictId || null,
    federalConstituencyId: territory.federalConstituencyId || null,
    stateConstituencyId: territory.stateConstituencyId || null,
    wardId: territory.wardId || null,
    pollingUnitId: territory.pollingUnitId || null,
  };
}

/**
 * Messaging and voice calling share one contact rule, so both delegate to the
 * same helper that the realtime gateway uses.
 */
async function canMessageUser(actor: AuthUserProfile, targetUserId: string) {
  return canContactUser(actor, targetUserId);
}

async function createFieldActivity(
  actor: AuthUserProfile,
  type: AgentActivityType,
  payload: z.infer<typeof operationPayloadSchema>,
) {
  const agentProfile = await getAgentProfileOrError(actor.id);
  if (!agentProfile) {
    throw new Error("Polling Unit Coordinator profile was not found.");
  }

  if (type === AgentActivityType.LOCATION_PING && !agentProfile.gpsTrackingConsentAt) {
    throw new Error("GPS tracking consent is required before live location updates can be accepted.");
  }

  if (payload.pollingUnitId && agentProfile.pollingUnitId && payload.pollingUnitId !== agentProfile.pollingUnitId) {
    throw new Error("You can only submit Election Day activity for your assigned polling unit.");
  }

  if (!agentProfile.pollingUnitId && !payload.pollingUnitId) {
    throw new Error("An assigned polling unit is required for Election Day operations.");
  }

  if (
    type === AgentActivityType.LOCATION_PING &&
    (typeof payload.latitude !== "number" || typeof payload.longitude !== "number")
  ) {
    throw new Error("Live location updates require device GPS coordinates.");
  }

  const pollingUnitId = payload.pollingUnitId || agentProfile.pollingUnitId;
  const territoryError = await validateTerritoryReferences({
    geoPoliticalZoneId: agentProfile.geoPoliticalZoneId || undefined,
    stateId: agentProfile.stateId,
    senatorialDistrictId: agentProfile.senatorialDistrictId || undefined,
    federalConstituencyId: agentProfile.federalConstituencyId || undefined,
    lgaId: agentProfile.lgaId,
    wardId: agentProfile.wardId,
    stateConstituencyId: agentProfile.stateConstituencyId || undefined,
    pollingUnitId: pollingUnitId || undefined,
  });
  if (territoryError) {
    throw new Error(territoryError);
  }

  const { start, end } = todayUtcRange();
  if (type === AgentActivityType.CHECK_IN) {
    const existing = await prisma.agentActivity.findFirst({
      where: {
        agentUserId: actor.id,
        type: AgentActivityType.CHECK_IN,
        pollingUnitId,
        createdAt: { gte: start, lt: end },
      },
      orderBy: { createdAt: "asc" },
    });
    if (existing) {
      return { activity: existing, alreadyRecorded: true, territory: operationalTerritoryFromProfile(agentProfile) };
    }
  }

  const activity = await prisma.agentActivity.create({
    data: {
      agentUserId: actor.id,
      type,
      latitude: payload.latitude ?? null,
      longitude: payload.longitude ?? null,
      accuracyMeters: payload.accuracyMeters ?? null,
      note: payload.note?.trim() || null,
      geoPoliticalZoneId: agentProfile.geoPoliticalZoneId,
      stateId: agentProfile.stateId,
      lgaId: agentProfile.lgaId,
      wardId: agentProfile.wardId,
      pollingUnitId,
    },
  });

  await createAuditLog(prisma, {
    actorUserId: actor.id,
    action: `ELECTION_DAY_${type}`,
    targetType: "AgentActivity",
    targetId: activity.id,
    territory: {
      stateId: agentProfile.stateId,
      senatorialDistrictId: agentProfile.senatorialDistrictId,
      federalConstituencyId: agentProfile.federalConstituencyId,
      stateConstituencyId: agentProfile.stateConstituencyId,
      lgaId: agentProfile.lgaId,
      wardId: agentProfile.wardId,
      pollingUnitId,
    },
    metadata: {
      idempotencyKey: payload.idempotencyKey || null,
      geofenceStatus:
        typeof payload.latitude === "number" && typeof payload.longitude === "number"
          ? "GATED_AUTHORITATIVE_PU_GEODATA_REQUIRED"
          : "LOCATION_UNKNOWN",
    },
  });

  return { activity, alreadyRecorded: false, territory: operationalTerritoryFromProfile({ ...agentProfile, pollingUnitId }) };
}

function hasResult(report: ReportRow | undefined) {
  return Boolean(report && Array.isArray(report.voteEntriesJson) && report.voteEntriesJson.length > 0);
}

function operationalStatusFor(input: {
  checkIn?: ActivityRow;
  lastActivity?: ActivityRow;
  report?: ReportRow;
  openIncidentCount: number;
}): PollingUnitOperationalStatus {
  if (input.report?.status === "APPROVED") {
    return "COMPLETED";
  }
  if (hasResult(input.report)) {
    return "RESULT_SUBMITTED";
  }
  if (input.openIncidentCount > 0) {
    return "INCIDENT_REPORTED";
  }
  if (input.report) {
    return "REPORTING";
  }
  if (input.checkIn?.type === AgentActivityType.CHECK_IN) {
    return "CHECKED_IN";
  }
  return "NOT_CHECKED_IN";
}

async function buildSituationRoomStatus(scope: OperationalTerritory, reportDate?: string): Promise<ElectionDaySituationRoomStatus> {
  const { start, end } = todayUtcRange(reportDate);
  const pollingUnitWhere = scopeToWhere(scope);
  const baseTerritoryFilter = territoryFilter(scope);
  const recentSince = new Date(Date.now() - 30 * 60_000);

  const [pollingUnits, assignments, activities, incidents, reports] = await Promise.all([
    prisma.pollingUnit.findMany({
      where: pollingUnitWhere,
      select: { id: true, name: true, stateId: true, lgaId: true, wardId: true },
      orderBy: { name: "asc" },
    }),
    prisma.agentProfile.findMany({
      where: {
        ...baseTerritoryFilter,
        pollingUnitId: { not: null },
      },
      select: { userId: true, pollingUnitId: true, user: { select: { name: true } } },
    }),
    prisma.agentActivity.findMany({
      where: {
        ...baseTerritoryFilter,
        pollingUnitId: { not: null },
        createdAt: { gte: start, lt: end },
      },
      orderBy: { createdAt: "desc" },
      select: {
        agentUserId: true,
        type: true,
        latitude: true,
        longitude: true,
        accuracyMeters: true,
        pollingUnitId: true,
        createdAt: true,
      },
    }),
    prisma.incident.findMany({
      where: {
        ...baseTerritoryFilter,
        pollingUnitId: { not: null },
        createdAt: { gte: start, lt: end },
      },
      select: { pollingUnitId: true, status: true, severity: true, createdAt: true },
    }),
    prisma.electionDayReport.findMany({
      where: {
        ...baseTerritoryFilter,
        reportDate: { gte: start, lt: end },
      },
      orderBy: { createdAt: "desc" },
      select: {
        pollingUnitId: true,
        status: true,
        openingStatus: true,
        voteEntriesJson: true,
        arrivalPhotoAssetId: true,
        postCountingPhotoAssetId: true,
        createdAt: true,
      },
    }),
  ]);

  const pollingUnitIds = new Set(pollingUnits.map((unit) => unit.id));
  const assignmentByPollingUnit = new Map<string, { userId: string; name: string }>();
  for (const assignment of assignments) {
    if (assignment.pollingUnitId && pollingUnitIds.has(assignment.pollingUnitId) && !assignmentByPollingUnit.has(assignment.pollingUnitId)) {
      assignmentByPollingUnit.set(assignment.pollingUnitId, {
        userId: assignment.userId,
        name: assignment.user.name,
      });
    }
  }

  const latestByPollingUnit = new Map<string, ActivityRow>();
  const checkInByPollingUnit = new Map<string, ActivityRow>();
  for (const activity of activities) {
    if (!activity.pollingUnitId || !pollingUnitIds.has(activity.pollingUnitId)) {
      continue;
    }
    if (!latestByPollingUnit.has(activity.pollingUnitId)) {
      latestByPollingUnit.set(activity.pollingUnitId, activity);
    }
    if (activity.type === AgentActivityType.CHECK_IN) {
      const existing = checkInByPollingUnit.get(activity.pollingUnitId);
      if (!existing || activity.createdAt < existing.createdAt) {
        checkInByPollingUnit.set(activity.pollingUnitId, activity);
      }
    }
  }

  const openIncidentsByPollingUnit = new Map<string, number>();
  let openIncidents = 0;
  let criticalIncidents = 0;
  for (const incident of incidents) {
    if (incident.status === IncidentStatus.OPEN || incident.status === IncidentStatus.IN_PROGRESS) {
      openIncidents += 1;
      if (incident.pollingUnitId) {
        openIncidentsByPollingUnit.set(incident.pollingUnitId, (openIncidentsByPollingUnit.get(incident.pollingUnitId) || 0) + 1);
      }
    }
    if (incident.severity === IncidentSeverity.CRITICAL) {
      criticalIncidents += 1;
    }
  }

  const reportByPollingUnit = new Map<string, ReportRow>();
  for (const report of reports) {
    if (!reportByPollingUnit.has(report.pollingUnitId)) {
      reportByPollingUnit.set(report.pollingUnitId, report);
    }
  }

  const pollingUnitStatuses: ElectionDayPollingUnitStatus[] = pollingUnits.map((unit) => {
    const assignment = assignmentByPollingUnit.get(unit.id);
    const latestActivity = latestByPollingUnit.get(unit.id);
    const latestLocation =
      latestActivity && latestActivity.latitude !== null && latestActivity.longitude !== null
        ? {
            latitude: latestActivity.latitude,
            longitude: latestActivity.longitude,
            accuracyMeters: latestActivity.accuracyMeters,
            capturedAt: latestActivity.createdAt.toISOString(),
          }
        : null;
    const report = reportByPollingUnit.get(unit.id);
    const openIncidentCount = openIncidentsByPollingUnit.get(unit.id) || 0;

    return {
      pollingUnitId: unit.id,
      pollingUnitName: unit.name,
      coordinatorUserId: assignment?.userId || null,
      coordinatorName: assignment?.name || null,
      operationalStatus: operationalStatusFor({
        checkIn: checkInByPollingUnit.get(unit.id),
        lastActivity: latestActivity,
        report,
        openIncidentCount,
      }),
      checkedInAt: checkInByPollingUnit.get(unit.id)?.createdAt.toISOString() || null,
      lastSeenAt: latestActivity?.createdAt.toISOString() || null,
      lastLocation: latestLocation,
      openIncidentCount,
      reportStatus: report?.status || "NOT_SUBMITTED",
      resultSubmitted: hasResult(report),
      evidenceReceived: Boolean(report?.arrivalPhotoAssetId && report.postCountingPhotoAssetId),
      geofence: latestLocation
        ? buildGeodataGatedEvaluation(latestLocation.accuracyMeters)
        : {
            status: "LOCATION_UNKNOWN",
            checkedAt: new Date().toISOString(),
            reason: "No Election Day location has been received for this Polling Unit.",
            distanceMeters: null,
            accuracyMeters: null,
          },
    };
  });

  const assignedPollingUnitIds = new Set(Array.from(assignmentByPollingUnit.keys()));
  const checkedInPollingUnitIds = new Set(Array.from(checkInByPollingUnit.keys()));
  const reportsReceived = pollingUnitStatuses.filter((item) => item.reportStatus !== "NOT_SUBMITTED").length;
  const resultReportsReceived = pollingUnitStatuses.filter((item) => item.resultSubmitted).length;
  const evidenceReceived = pollingUnitStatuses.filter((item) => item.evidenceReceived).length;
  const completedPollingUnits = pollingUnitStatuses.filter((item) => item.operationalStatus === "COMPLETED").length;
  const reportsOutstanding = Math.max(pollingUnits.length - reportsReceived, 0);

  const alerts: ElectionDaySituationRoomStatus["alerts"] = pollingUnitStatuses
    .filter((item) => item.coordinatorUserId && !item.checkedInAt)
    .map((item) => ({
      type: "NO_CHECK_IN" as const,
      status: "OPEN" as const,
      pollingUnitId: item.pollingUnitId,
      message: `${item.pollingUnitName || "Polling Unit"} has an assigned coordinator but no check-in for the selected date.`,
      detectedAt: new Date().toISOString(),
    }));

  const durableAlerts = await prisma.operationalAlert.findMany({
    where: {
      ...baseTerritoryFilter,
      status: { in: [OperationalAlertStatus.OPEN, OperationalAlertStatus.ACKNOWLEDGED, OperationalAlertStatus.ESCALATED] },
    },
    orderBy: [{ severity: "desc" }, { detectedAt: "desc" }],
    take: 50,
  });
  const alertKeys = new Set(alerts.map((alert) => `${alert.type}:${alert.pollingUnitId}`));
  for (const alert of durableAlerts) {
    const type = alert.type as "NO_CHECK_IN" | "TRACKING_STOPPED" | "LOCATION_STALE" | "LOCATION_MISMATCH" | "GPS_PERMISSION_DISABLED" | "DEVICE_SESSION_CHANGED" | "REPORT_OVERDUE";
    const key = `${type}:${alert.pollingUnitId || ""}`;
    if (alertKeys.has(key)) {
      continue;
    }
    alerts.push({
      type,
      status: alert.status as "OPEN" | "ACKNOWLEDGED" | "ESCALATED" | "RESOLVED",
      pollingUnitId: alert.pollingUnitId || "",
      message: alert.message,
      detectedAt: alert.detectedAt.toISOString(),
    });
  }

  const realtimeStatus = getRealtimeGatewayStatus();

  return {
    generatedAt: new Date().toISOString(),
    territory: scope,
    realtime: {
      runtimeStatus: realtimeStatus.runtimeStatus,
      restFallbackAvailable: true,
      contractVersion: 1,
      eventTypes: realtimeStatus.eventTypes,
    },
    totals: {
      expectedPollingUnits: pollingUnits.length,
      assignedPollingUnits: assignedPollingUnitIds.size,
      checkedInPollingUnits: checkedInPollingUnitIds.size,
      missingCheckIns: Array.from(assignedPollingUnitIds).filter((id) => !checkedInPollingUnitIds.has(id)).length,
      activeRecently: pollingUnitStatuses.filter((item) => item.lastSeenAt && new Date(item.lastSeenAt) >= recentSince).length,
      openIncidents,
      criticalIncidents,
      reportsReceived,
      reportsOutstanding,
      resultReportsReceived,
      evidenceReceived,
      completedPollingUnits,
      reportingPercentage: pollingUnits.length === 0 ? 0 : Math.round((reportsReceived / pollingUnits.length) * 100),
    },
    byOpeningStatus: reports.reduce<Record<string, number>>((acc, report) => {
      acc[report.openingStatus] = (acc[report.openingStatus] || 0) + 1;
      return acc;
    }, {}),
    byReportStatus: pollingUnitStatuses.reduce<Record<string, number>>((acc, item) => {
      acc[item.reportStatus] = (acc[item.reportStatus] || 0) + 1;
      return acc;
    }, {}),
    alerts,
    pollingUnits: pollingUnitStatuses,
  };
}

router.get("/realtime-contracts", requireAuth, async (_request, response) => {
  const realtimeStatus = getRealtimeGatewayStatus();
  return response.json({
    realtime: {
      runtimeStatus: realtimeStatus.runtimeStatus,
      restFallbackAvailable: true,
      redisAdapter: realtimeStatus.redisAdapter,
      transport: "Socket.IO attached to the API HTTP server; REST endpoints remain authoritative fallback.",
      contractVersion: 1,
      eventTypes: realtimeStatus.eventTypes,
    },
  });
});

/**
 * Durable replay for a reconnecting client.
 *
 * Socket delivery is best effort: a client that was offline, backgrounded, or on
 * a flapping field connection can miss live events. Because every realtime event
 * is written to `RealtimeEventOutbox` in the same transaction as the business
 * change, the client can ask for everything committed since its last cursor and
 * rebuild exactly what it missed from PostgreSQL.
 *
 * Results are scoped to the caller's authorized territory, so replay cannot be
 * used to read events from a territory the caller could not subscribe to live.
 */
router.get("/realtime/replay", requireAuth, async (request, response) => {
  const parsed = realtimeReplaySchema.safeParse(request.query);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid replay query.", errors: parsed.error.flatten() });
  }

  const scope = await requireCommandScope(request.authUser!);
  if (!scope) {
    return response.status(403).json({ message: "Election Day realtime replay requires a command scope." });
  }

  const since = parsed.data.since ? new Date(parsed.data.since) : new Date(Date.now() - 30 * 60_000);

  const events = await prisma.realtimeEventOutbox.findMany({
    where: {
      committedAt: { gt: since },
      ...territoryFilter(scope),
    },
    orderBy: { committedAt: "asc" },
    take: parsed.data.limit,
  });

  const items = events.map((event) => ({
    eventId: event.eventId,
    eventType: event.eventType,
    eventVersion: event.eventVersion,
    idempotencyKey: event.idempotencyKey,
    committedAt: event.committedAt.toISOString(),
    territory: event.territoryJson,
    payload: event.payloadJson,
  }));

  return response.json({
    events: items,
    // The client advances its cursor to the last event it actually received, so
    // a truncated batch resumes correctly on the next call.
    cursor: items.length > 0 ? items[items.length - 1].committedAt : since.toISOString(),
    hasMore: items.length === parsed.data.limit,
    snapshotPath: "/election-day/situation-room/status",
  });
});

router.post("/check-in", requireAuth, requirePollingUnitFieldCapability, async (request, response) => {
  const parsed = operationPayloadSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid Election Day check-in payload.", errors: parsed.error.flatten() });
  }

  try {
    const { activity, alreadyRecorded, territory } = await createFieldActivity(request.authUser!, AgentActivityType.CHECK_IN, parsed.data);
    if (!alreadyRecorded) {
      publishRealtimeEvent(
        createElectionDayRealtimeEvent({
          eventType: "election.checkin.created",
          actorUserId: request.authUser!.id,
          territory,
          idempotencyKey: parsed.data.idempotencyKey || activity.id,
          payload: {
            activityId: activity.id,
            pollingUnitId: activity.pollingUnitId,
            checkedInAt: activity.createdAt.toISOString(),
            geofenceStatus: "GATED_AUTHORITATIVE_PU_GEODATA_REQUIRED",
          },
        }),
      );
      publishRealtimeEvent(
        createElectionDayRealtimeEvent({
          eventType: "election.situation.updated",
          actorUserId: request.authUser!.id,
          territory,
          idempotencyKey: `situation:${activity.id}`,
          payload: { reason: "CHECK_IN_CREATED", pollingUnitId: activity.pollingUnitId },
        }),
      );
    }
    return response.status(alreadyRecorded ? 200 : 201).json({
      message: alreadyRecorded ? "Check-in was already recorded for this polling unit today." : "Election Day check-in recorded.",
      alreadyRecorded,
      activity,
      geofence: buildGeodataGatedEvaluation(activity.accuracyMeters),
    });
  } catch (error) {
    return response.status(400).json({ message: error instanceof Error ? error.message : "Election Day check-in failed." });
  }
});

router.post("/check-out", requireAuth, requirePollingUnitFieldCapability, async (request, response) => {
  const parsed = operationPayloadSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid Election Day check-out payload.", errors: parsed.error.flatten() });
  }

  try {
    const { activity, territory } = await createFieldActivity(request.authUser!, AgentActivityType.CHECK_OUT, parsed.data);
    publishRealtimeEvent(
      createElectionDayRealtimeEvent({
        eventType: "election.situation.updated",
        actorUserId: request.authUser!.id,
        territory,
        idempotencyKey: parsed.data.idempotencyKey || `checkout:${activity.id}`,
        payload: { reason: "CHECK_OUT_CREATED", activityId: activity.id, pollingUnitId: activity.pollingUnitId },
      }),
    );
    return response.status(201).json({ message: "Election Day check-out recorded.", activity });
  } catch (error) {
    return response.status(400).json({ message: error instanceof Error ? error.message : "Election Day check-out failed." });
  }
});

router.post("/location-pings", requireAuth, requirePollingUnitFieldCapability, async (request, response) => {
  const parsed = operationPayloadSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid Election Day location payload.", errors: parsed.error.flatten() });
  }

  try {
    const { activity, territory } = await createFieldActivity(request.authUser!, AgentActivityType.LOCATION_PING, parsed.data);
    publishRealtimeEvent(
      createElectionDayRealtimeEvent({
        eventType: "election.location.updated",
        actorUserId: request.authUser!.id,
        territory,
        idempotencyKey: parsed.data.idempotencyKey || activity.id,
        payload: {
          activityId: activity.id,
          pollingUnitId: activity.pollingUnitId,
          latitude: activity.latitude,
          longitude: activity.longitude,
          accuracyMeters: activity.accuracyMeters,
          capturedAt: activity.createdAt.toISOString(),
          geofenceStatus: "GATED_AUTHORITATIVE_PU_GEODATA_REQUIRED",
        },
      }),
    );
    return response.status(201).json({
      message: "Election Day location ping recorded; geofence mismatch evaluation remains gated.",
      activity,
      geofence: buildGeodataGatedEvaluation(activity.accuracyMeters),
    });
  } catch (error) {
    return response.status(400).json({ message: error instanceof Error ? error.message : "Election Day location update failed." });
  }
});

router.post("/incidents", requireAuth, requirePollingUnitFieldCapability, async (request, response) => {
  const parsed = incidentSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid Election Day incident payload.", errors: parsed.error.flatten() });
  }

  const agentProfile = await getAgentProfileOrError(request.authUser!.id);
  if (!agentProfile) {
    return response.status(404).json({ message: "Polling Unit Coordinator profile was not found." });
  }

  if (parsed.data.pollingUnitId && agentProfile.pollingUnitId && parsed.data.pollingUnitId !== agentProfile.pollingUnitId) {
    return response.status(400).json({ message: "You can only report incidents for your assigned polling unit." });
  }

  const pollingUnitId = parsed.data.pollingUnitId || agentProfile.pollingUnitId;
  const territoryError = await validateTerritoryReferences({
    geoPoliticalZoneId: agentProfile.geoPoliticalZoneId || undefined,
    stateId: agentProfile.stateId,
    senatorialDistrictId: agentProfile.senatorialDistrictId || undefined,
    federalConstituencyId: agentProfile.federalConstituencyId || undefined,
    lgaId: agentProfile.lgaId,
    wardId: agentProfile.wardId,
    stateConstituencyId: agentProfile.stateConstituencyId || undefined,
    pollingUnitId: pollingUnitId || undefined,
  });
  if (territoryError) {
    return response.status(400).json({ message: territoryError });
  }

  const incident = await prisma.$transaction(async (transaction) => {
    const created = await transaction.incident.create({
      data: {
        reportedByUserId: request.authUser!.id,
        type: parsed.data.type,
        title: parsed.data.title,
        description: parsed.data.description,
        severity: parsed.data.severity,
        status: IncidentStatus.OPEN,
        latitude: parsed.data.latitude ?? null,
        longitude: parsed.data.longitude ?? null,
        geoPoliticalZoneId: agentProfile.geoPoliticalZoneId,
        stateId: agentProfile.stateId,
        senatorialDistrictId: agentProfile.senatorialDistrictId,
        lgaId: agentProfile.lgaId,
        wardId: agentProfile.wardId,
        pollingUnitId,
      },
    });

    await createAuditLog(transaction, {
      actorUserId: request.authUser!.id,
      action: "ELECTION_DAY_INCIDENT_CREATED",
      targetType: "Incident",
      targetId: created.id,
      territory: created,
      metadata: {
        severity: created.severity,
        type: created.type,
        realtimeEvent: "election.incident.created",
      },
    });

    return created;
  });

  const incidentTerritory = await resolveOperationalTerritory(prisma, {
    stateId: incident.stateId,
    senatorialDistrictId: incident.senatorialDistrictId,
    wardId: incident.wardId,
    pollingUnitId: incident.pollingUnitId,
  });
  publishRealtimeEvent(
    createElectionDayRealtimeEvent({
      eventType: "election.incident.created",
      actorUserId: request.authUser!.id,
      territory: incidentTerritory,
      idempotencyKey: incident.id,
      payload: {
        incidentId: incident.id,
        type: incident.type,
        severity: incident.severity,
        status: incident.status,
        pollingUnitId: incident.pollingUnitId,
        createdAt: incident.createdAt.toISOString(),
      },
    }),
  );
  publishRealtimeEvent(
    createElectionDayRealtimeEvent({
      eventType: "election.situation.updated",
      actorUserId: request.authUser!.id,
      territory: incidentTerritory,
      idempotencyKey: `situation:${incident.id}`,
      payload: { reason: "INCIDENT_CREATED", pollingUnitId: incident.pollingUnitId },
    }),
  );

  return response.status(201).json({
    message: "Election Day incident reported.",
    incident: serializeIncidentItem(incident),
  });
});

router.get("/my-status", requireAuth, requirePollingUnitFieldCapability, async (request, response) => {
  const parsed = statusQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid Election Day status query.", errors: parsed.error.flatten() });
  }

  const agentProfile = await getAgentProfileOrError(request.authUser!.id);
  if (!agentProfile?.pollingUnitId) {
    return response.status(400).json({ message: "An assigned polling unit is required for Election Day status." });
  }

  const status = await buildSituationRoomStatus(
    { stateId: agentProfile.stateId, pollingUnitId: agentProfile.pollingUnitId },
    parsed.data.reportDate,
  );
  return response.json({
    status: status.pollingUnits[0] || null,
    realtime: status.realtime,
  });
});

router.get("/situation-room/status", requireAuth, async (request, response) => {
  const parsed = statusQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid Situation Room query.", errors: parsed.error.flatten() });
  }

  const scope = await requireCommandScope(request.authUser!);
  if (!scope) {
    return response.status(403).json({ message: "Election Day command scope is required." });
  }

  const status = await buildSituationRoomStatus(scope, parsed.data.reportDate);
  return response.json({ status });
});

router.post("/alerts/reconcile", requireAuth, async (request, response) => {
  const parsed = statusQuerySchema.safeParse(request.body || {});
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid alert reconciliation payload.", errors: parsed.error.flatten() });
  }

  const scope = await requireCommandScope(request.authUser!);
  if (!scope) {
    return response.status(403).json({ message: "Election Day command scope is required." });
  }

  const status = await buildSituationRoomStatus(scope, parsed.data.reportDate);
  const staleThresholdMs = 45 * 60_000;
  const now = Date.now();
  const createdAlerts = [];

  for (const pollingUnit of status.pollingUnits) {
    const territory = getPollingUnitTerritory(pollingUnit, scope);
    if (pollingUnit.coordinatorUserId && !pollingUnit.checkedInAt) {
      const result = await upsertOpenAlert({
        type: "NO_CHECK_IN",
        pollingUnit,
        territory,
        actorUserId: request.authUser!.id,
        sourceType: "PollingUnit",
        sourceId: pollingUnit.pollingUnitId,
        metadata: { reportDate: parsed.data.reportDate || null },
      });
      if (result.created) {
        createdAlerts.push(result.alert);
      }
    }

    if (pollingUnit.checkedInAt && pollingUnit.reportStatus === "NOT_SUBMITTED") {
      const result = await upsertOpenAlert({
        type: "REPORT_OVERDUE",
        pollingUnit,
        territory,
        actorUserId: request.authUser!.id,
        sourceType: "PollingUnitReport",
        sourceId: `${pollingUnit.pollingUnitId}:${parsed.data.reportDate || todayUtcRange().day}`,
        metadata: { checkedInAt: pollingUnit.checkedInAt },
      });
      if (result.created) {
        createdAlerts.push(result.alert);
      }
    }

    if (pollingUnit.lastSeenAt && now - new Date(pollingUnit.lastSeenAt).getTime() > staleThresholdMs) {
      const result = await upsertOpenAlert({
        type: "LOCATION_STALE",
        pollingUnit,
        territory,
        actorUserId: request.authUser!.id,
        sourceType: "AgentActivity",
        sourceId: `${pollingUnit.pollingUnitId}:${pollingUnit.lastSeenAt}`,
        metadata: { lastSeenAt: pollingUnit.lastSeenAt, staleThresholdMinutes: 45 },
      });
      if (result.created) {
        createdAlerts.push(result.alert);
      }
    }
  }

  for (const alert of createdAlerts) {
    await persistAndPublishRealtimeEvent(
      createElectionDayRealtimeEvent({
        eventType: alert.type === "LOCATION_STALE" ? "election.tracking.stale" : "election.alert.created",
        actorUserId: request.authUser!.id,
        territory: {
          stateId: alert.stateId,
          senatorialDistrictId: alert.senatorialDistrictId,
          federalConstituencyId: alert.federalConstituencyId,
          stateConstituencyId: alert.stateConstituencyId,
          wardId: alert.wardId,
          pollingUnitId: alert.pollingUnitId,
        },
        idempotencyKey: `alert:${alert.id}`,
        payload: { alertId: alert.id, type: alert.type, status: alert.status, pollingUnitId: alert.pollingUnitId },
      }),
    );
  }

  return response.status(201).json({
    message: `Alert reconciliation complete. ${createdAlerts.length} new alert${createdAlerts.length === 1 ? "" : "s"} created.`,
    alerts: createdAlerts.map(serializeAlert),
  });
});

router.get("/alerts", requireAuth, async (request, response) => {
  const parsed = alertQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid alert query.", errors: parsed.error.flatten() });
  }

  const scope = await requireCommandScope(request.authUser!);
  if (!scope) {
    return response.status(403).json({ message: "Election Day command scope is required." });
  }

  const { start, end } = todayUtcRange(parsed.data.reportDate);
  const alerts = await prisma.operationalAlert.findMany({
    where: {
      ...territoryFilter(scope),
      status: parsed.data.status,
      type: parsed.data.type,
      detectedAt: { gte: start, lt: end },
    },
    orderBy: [{ status: "asc" }, { severity: "desc" }, { detectedAt: "desc" }],
    take: 100,
  });

  return response.json({ alerts: alerts.map(serializeAlert) });
});

router.patch("/alerts/:alertId", requireAuth, async (request, response) => {
  const parsed = alertLifecycleSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid alert lifecycle payload.", errors: parsed.error.flatten() });
  }

  const scope = await requireCommandScope(request.authUser!);
  if (!scope) {
    return response.status(403).json({ message: "Election Day command scope is required." });
  }

  const alertId = Array.isArray(request.params.alertId) ? request.params.alertId[0] : request.params.alertId;
  const alert = await prisma.operationalAlert.findUnique({ where: { id: alertId } });
  if (!alert) {
    return response.status(404).json({ message: "Operational alert was not found." });
  }

  const alertTerritory = await resolveOperationalTerritory(prisma, {
    stateId: alert.stateId,
    senatorialDistrictId: alert.senatorialDistrictId,
    federalConstituencyId: alert.federalConstituencyId,
    stateConstituencyId: alert.stateConstituencyId,
    wardId: alert.wardId,
    pollingUnitId: alert.pollingUnitId,
  });
  if (!authorizeAction(request.authUser!, "VIEW_TERRITORY", alertTerritory)) {
    return response.status(403).json({ message: "You cannot update an alert outside your command scope." });
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (transaction) => {
    const next = await transaction.operationalAlert.update({
      where: { id: alert.id },
      data: {
        status: parsed.data.status,
        acknowledgedByUserId: parsed.data.status === "ACKNOWLEDGED" ? request.authUser!.id : alert.acknowledgedByUserId,
        acknowledgedAt: parsed.data.status === "ACKNOWLEDGED" ? now : alert.acknowledgedAt,
        escalatedAt: parsed.data.status === "ESCALATED" ? now : alert.escalatedAt,
        resolvedByUserId: parsed.data.status === "RESOLVED" ? request.authUser!.id : alert.resolvedByUserId,
        resolvedAt: parsed.data.status === "RESOLVED" ? now : alert.resolvedAt,
        metadataJson: {
          ...((alert.metadataJson && typeof alert.metadataJson === "object" && !Array.isArray(alert.metadataJson)
            ? alert.metadataJson as Record<string, unknown>
            : {})),
          lifecycleNote: parsed.data.note || null,
          lifecycleUpdatedByUserId: request.authUser!.id,
        },
      },
    });
    await createAuditLog(transaction, {
      actorUserId: request.authUser!.id,
      action: "ELECTION_DAY_ALERT_STATUS_UPDATED",
      targetType: "OperationalAlert",
      targetId: next.id,
      territory: next,
      metadata: { status: next.status, note: parsed.data.note || null },
    });
    return next;
  });

  await persistAndPublishRealtimeEvent(
    createElectionDayRealtimeEvent({
      eventType: "election.alert.updated",
      actorUserId: request.authUser!.id,
      territory: {
        stateId: updated.stateId,
        senatorialDistrictId: updated.senatorialDistrictId,
        federalConstituencyId: updated.federalConstituencyId,
        stateConstituencyId: updated.stateConstituencyId,
        wardId: updated.wardId,
        pollingUnitId: updated.pollingUnitId,
      },
      idempotencyKey: `alert-updated:${updated.id}:${updated.updatedAt.toISOString()}`,
      payload: { alertId: updated.id, type: updated.type, status: updated.status, pollingUnitId: updated.pollingUnitId },
    }),
  );

  return response.json({ message: "Operational alert updated.", alert: serializeAlert(updated) });
});

router.get("/timeline", requireAuth, async (request, response) => {
  const parsed = timelineQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid timeline query.", errors: parsed.error.flatten() });
  }

  const scope = await requireCommandScope(request.authUser!);
  if (!scope) {
    return response.status(403).json({ message: "Election Day command scope is required." });
  }

  const { start, end } = todayUtcRange(parsed.data.reportDate);
  const baseFilter = territoryFilter(scope);
  const [activities, incidents, reports, alerts, messages, events] = await Promise.all([
    prisma.agentActivity.findMany({
      where: { ...baseFilter, createdAt: { gte: start, lt: end } },
      orderBy: { createdAt: "desc" },
      take: parsed.data.limit,
      include: { agentUser: { select: { name: true } } },
    }),
    prisma.incident.findMany({
      where: { ...baseFilter, createdAt: { gte: start, lt: end } },
      orderBy: { createdAt: "desc" },
      take: parsed.data.limit,
    }),
    prisma.electionDayReport.findMany({
      where: { ...baseFilter, createdAt: { gte: start, lt: end } },
      orderBy: { createdAt: "desc" },
      take: parsed.data.limit,
      include: { agentUser: { select: { name: true } } },
    }),
    prisma.operationalAlert.findMany({
      where: { ...baseFilter, detectedAt: { gte: start, lt: end } },
      orderBy: { detectedAt: "desc" },
      take: parsed.data.limit,
    }),
    prisma.message.findMany({
      where: {
        createdAt: { gte: start, lt: end },
        conversation: { ...baseFilter },
      },
      orderBy: { createdAt: "desc" },
      take: parsed.data.limit,
      include: { senderUser: { select: { name: true } } },
    }),
    prisma.realtimeEventOutbox.findMany({
      where: { ...baseFilter, committedAt: { gte: start, lt: end } },
      orderBy: { committedAt: "desc" },
      take: parsed.data.limit,
    }),
  ]);

  const items: ElectionDayTimelineItem[] = [
    ...activities.map((activity) => ({
      id: activity.id,
      type: "ACTIVITY" as const,
      title: `${activity.type.replaceAll("_", " ")} by ${activity.agentUser.name}`,
      detail: activity.note || activity.pollingUnitId || "Polling Unit activity",
      severity: null,
      pollingUnitId: activity.pollingUnitId,
      actorUserId: activity.agentUserId,
      occurredAt: activity.createdAt.toISOString(),
      metadata: { latitude: activity.latitude, longitude: activity.longitude, accuracyMeters: activity.accuracyMeters },
    })),
    ...incidents.map((incident) => ({
      id: incident.id,
      type: "INCIDENT" as const,
      title: incident.title,
      detail: `${incident.type} | ${incident.status}`,
      severity: incident.severity,
      pollingUnitId: incident.pollingUnitId,
      actorUserId: incident.reportedByUserId,
      occurredAt: incident.createdAt.toISOString(),
      metadata: { incidentId: incident.id },
    })),
    ...reports.map((report) => ({
      id: report.id,
      type: "REPORT" as const,
      title: `Report submitted by ${report.agentUser.name}`,
      detail: `${report.openingStatus} | ${report.status}`,
      severity: null,
      pollingUnitId: report.pollingUnitId,
      actorUserId: report.agentUserId,
      occurredAt: report.createdAt.toISOString(),
      metadata: { reportId: report.id, resultSubmitted: hasResult(report as ReportRow) },
    })),
    ...alerts.map((alert) => ({
      id: alert.id,
      type: "ALERT" as const,
      title: alert.type.replaceAll("_", " "),
      detail: alert.message,
      severity: alert.severity,
      pollingUnitId: alert.pollingUnitId,
      actorUserId: alert.actorUserId,
      occurredAt: alert.detectedAt.toISOString(),
      metadata: alert.metadataJson && typeof alert.metadataJson === "object" && !Array.isArray(alert.metadataJson)
        ? alert.metadataJson as Record<string, unknown>
        : null,
    })),
    ...messages.map((message) => ({
      id: message.id,
      type: "MESSAGE" as const,
      title: `Message from ${message.senderUser.name}`,
      detail: message.body,
      severity: null,
      pollingUnitId: null,
      actorUserId: message.senderUserId,
      occurredAt: message.createdAt.toISOString(),
      metadata: { conversationId: message.conversationId },
    })),
    ...events.map((event) => ({
      id: event.id,
      type: "REALTIME_EVENT" as const,
      title: event.eventType,
      detail: event.status,
      severity: null,
      pollingUnitId: event.pollingUnitId,
      actorUserId: null,
      occurredAt: event.committedAt.toISOString(),
      metadata: { eventId: event.eventId, publishedAt: event.publishedAt?.toISOString() || null },
    })),
  ].sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()).slice(0, parsed.data.limit);

  return response.json({ timeline: items });
});

router.get("/presence", requireAuth, async (request, response) => {
  const userIds = String(request.query.userIds || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 100);

  if (userIds.length === 0) {
    return response.json({ presence: [] });
  }

  const allowed: string[] = [];
  for (const userId of userIds) {
    if (await canMessageUser(request.authUser!, userId)) {
      allowed.push(userId);
    }
  }

  return response.json({ presence: getPresenceSnapshot(allowed) });
});

router.get("/webrtc/config", requireAuth, async (_request, response) => {
  const iceServers: ElectionDayWebrtcConfig["iceServers"] = env.WEBRTC_STUN_URLS.length
    ? [{ urls: env.WEBRTC_STUN_URLS }]
    : [];

  // TURN is advertised only when the URI is a usable turn:/turns: endpoint and
  // both credentials are present. A half-configured relay must never be
  // reported as configured: clients would assume field devices behind
  // carrier-grade NAT are reachable when they are not.
  const turnConfigured =
    /^turns?:[^\s:]+(:\d{1,5})?(\?transport=(udp|tcp))?$/i.test(env.TURN_URL.trim()) &&
    Boolean(env.TURN_USERNAME.trim()) &&
    Boolean(env.TURN_CREDENTIAL.trim());

  if (turnConfigured) {
    iceServers.push({
      urls: env.TURN_URL,
      username: env.TURN_USERNAME,
      credential: env.TURN_CREDENTIAL,
    });
  }

  const config: ElectionDayWebrtcConfig = {
    signalling: {
      transport: "socket.io",
      path: env.REALTIME_PATH,
      events: ELECTION_DAY_REALTIME_EVENT_TYPES.filter((eventType) => eventType.startsWith("call.")),
      restLifecyclePath: "/election-day/calls",
    },
    iceServers,
    turnConfigured,
    recording: "DISABLED",
    durableCallHistory: "AVAILABLE",
  };

  return response.json({ config });
});

type VoiceCallWithRelations = Prisma.VoiceCallGetPayload<{
  include: {
    initiatorUser: { select: { name: true } };
    participants: { include: { user: { select: { name: true; role: true } } } };
    events: true;
  };
}>;

const voiceCallInclude = {
  initiatorUser: { select: { name: true } },
  participants: { include: { user: { select: { name: true, role: true } } } },
  events: { orderBy: { occurredAt: "asc" } },
} satisfies Prisma.VoiceCallInclude;

function serializeCall(call: VoiceCallWithRelations, presence: RealtimePresenceEntry[]): ElectionDayCallItem {
  const presenceByUser = new Map(presence.map((entry) => [entry.userId, entry]));
  const participants: ElectionDayCallParticipantItem[] = call.participants.map((participant) => ({
    userId: participant.userId,
    name: participant.user.name,
    role: participant.user.role,
    isInitiator: participant.isInitiator,
    status: participant.status,
    invitedAt: participant.invitedAt.toISOString(),
    ringingAt: participant.ringingAt?.toISOString() || null,
    answeredAt: participant.answeredAt?.toISOString() || null,
    leftAt: participant.leftAt?.toISOString() || null,
    presence: presenceByUser.get(participant.userId)?.state || "OFFLINE",
  }));

  const events: ElectionDayCallEventItem[] = call.events.map((event) => ({
    id: event.id,
    type: event.type,
    actorUserId: event.actorUserId,
    targetUserId: event.targetUserId,
    signalType: event.signalType,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    occurredAt: event.occurredAt.toISOString(),
  }));

  return {
    id: call.id,
    conversationId: call.conversationId,
    initiatorUserId: call.initiatorUserId,
    initiatorName: call.initiatorUser.name,
    status: call.status,
    endReason: call.endReason,
    territory: {
      stateId: call.stateId,
      senatorialDistrictId: call.senatorialDistrictId,
      federalConstituencyId: call.federalConstituencyId,
      stateConstituencyId: call.stateConstituencyId,
      wardId: call.wardId,
      pollingUnitId: call.pollingUnitId,
    },
    startedAt: call.startedAt.toISOString(),
    ringingAt: call.ringingAt?.toISOString() || null,
    connectedAt: call.connectedAt?.toISOString() || null,
    endedAt: call.endedAt?.toISOString() || null,
    durationSeconds: call.durationSeconds,
    endedByUserId: call.endedByUserId,
    recording: "DISABLED",
    participants,
    events,
  };
}

async function loadCallForParticipant(callId: string, userId: string) {
  const call = await prisma.voiceCall.findUnique({ where: { id: callId }, include: voiceCallInclude });
  if (!call || !call.participants.some((participant) => participant.userId === userId)) {
    return null;
  }
  return call;
}

/** Publishes a call lifecycle event to the participants only, never to a territory room. */
async function publishCallEvent(
  eventType: "call.initiated" | "call.ringing" | "call.accepted" | "call.rejected" | "call.connected" | "call.ended" | "call.missed",
  call: VoiceCallWithRelations,
  actorUserId: string,
  extraPayload: Record<string, unknown> = {},
) {
  const event = createElectionDayRealtimeEvent({
    eventType,
    actorUserId,
    territory: {
      stateId: call.stateId,
      senatorialDistrictId: call.senatorialDistrictId,
      federalConstituencyId: call.federalConstituencyId,
      stateConstituencyId: call.stateConstituencyId,
      wardId: call.wardId,
      pollingUnitId: call.pollingUnitId,
    },
    idempotencyKey: `call:${call.id}:${eventType}`,
    payload: {
      callId: call.id,
      conversationId: call.conversationId,
      initiatorUserId: call.initiatorUserId,
      status: call.status,
      participantUserIds: call.participants.map((participant) => participant.userId),
      recording: "DISABLED",
      ...extraPayload,
    },
  });

  await prisma.realtimeEventOutbox
    .create({
      data: {
        eventId: event.eventId,
        eventType: event.eventType,
        eventVersion: event.eventVersion,
        idempotencyKey: event.idempotencyKey,
        payloadJson: event.payload as Prisma.InputJsonValue,
        territoryJson: event.territory as Prisma.InputJsonValue,
        stateId: call.stateId,
        senatorialDistrictId: call.senatorialDistrictId,
        federalConstituencyId: call.federalConstituencyId,
        stateConstituencyId: call.stateConstituencyId,
        wardId: call.wardId,
        pollingUnitId: call.pollingUnitId,
      },
    })
    .catch((error) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return null;
      }
      throw error;
    });

  const published = publishRealtimeEventToUsers(
    event,
    call.participants.map((participant) => participant.userId),
  );
  if (published) {
    await prisma.realtimeEventOutbox
      .update({
        where: { idempotencyKey: event.idempotencyKey },
        data: { status: "PUBLISHED", publishedAt: new Date(), attempts: { increment: 1 } },
      })
      .catch(() => undefined);
  }
  return published;
}

router.post("/calls", requireAuth, async (request, response) => {
  const parsed = callInitiateSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid call payload.", errors: parsed.error.flatten() });
  }

  if (parsed.data.targetUserId === request.authUser!.id) {
    return response.status(400).json({ message: "You cannot call yourself." });
  }

  if (!(await canContactUser(request.authUser!, parsed.data.targetUserId))) {
    return response.status(403).json({ message: "You cannot call this user outside your operational relationship." });
  }

  const callTerritory = (await contactTerritoryForUser(parsed.data.targetUserId)) || messagingCommandScope(request.authUser!);
  if (!callTerritory) {
    return response.status(403).json({ message: "Election Day call scope is required." });
  }

  if (parsed.data.conversationId) {
    const membership = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: parsed.data.conversationId, userId: request.authUser!.id } },
    });
    if (!membership || membership.leftAt) {
      return response.status(403).json({ message: "You are not a member of this conversation." });
    }
  }

  // One live call per pair keeps the durable lifecycle unambiguous.
  const existing = await prisma.voiceCall.findFirst({
    where: {
      status: { not: VoiceCallStatus.ENDED },
      participants: { some: { userId: request.authUser!.id } },
      AND: [{ participants: { some: { userId: parsed.data.targetUserId } } }],
    },
    select: { id: true },
  });
  if (existing) {
    return response.status(409).json({ message: "A call with this user is already in progress.", callId: existing.id });
  }

  const created = await prisma.$transaction(async (transaction) => {
    const call = await transaction.voiceCall.create({
      data: {
        conversationId: parsed.data.conversationId || null,
        initiatorUserId: request.authUser!.id,
        status: VoiceCallStatus.RINGING,
        ringingAt: new Date(),
        stateId: callTerritory.stateId,
        senatorialDistrictId: callTerritory.senatorialDistrictId || null,
        federalConstituencyId: callTerritory.federalConstituencyId || null,
        stateConstituencyId: callTerritory.stateConstituencyId || null,
        wardId: callTerritory.wardId || null,
        pollingUnitId: callTerritory.pollingUnitId || null,
        recordingPolicy: "DISABLED",
        participants: {
          create: [
            { userId: request.authUser!.id, isInitiator: true, status: VoiceCallParticipantStatus.CALLING },
            {
              userId: parsed.data.targetUserId,
              isInitiator: false,
              status: VoiceCallParticipantStatus.RINGING,
              ringingAt: new Date(),
            },
          ],
        },
        events: {
          create: [
            {
              type: VoiceCallEventType.INITIATED,
              actorUserId: request.authUser!.id,
              targetUserId: parsed.data.targetUserId,
              toStatus: VoiceCallStatus.INITIATED,
            },
            {
              type: VoiceCallEventType.RINGING,
              actorUserId: request.authUser!.id,
              targetUserId: parsed.data.targetUserId,
              fromStatus: VoiceCallStatus.INITIATED,
              toStatus: VoiceCallStatus.RINGING,
            },
          ],
        },
      },
      include: voiceCallInclude,
    });

    await createAuditLog(transaction, {
      actorUserId: request.authUser!.id,
      action: "ELECTION_DAY_CALL_INITIATED",
      targetType: "VoiceCall",
      targetId: call.id,
      territory: call,
      metadata: { targetUserId: parsed.data.targetUserId, recording: "DISABLED" },
    });
    return call;
  });

  await publishCallEvent("call.ringing", created, request.authUser!.id, { targetUserId: parsed.data.targetUserId });

  return response.status(201).json({
    message: "Election Day call initiated.",
    item: serializeCall(created, getPresenceSnapshot(created.participants.map((participant) => participant.userId))),
  });
});

router.post("/calls/:callId/accept", requireAuth, async (request, response) => {
  const callId = Array.isArray(request.params.callId) ? request.params.callId[0] : request.params.callId;
  const call = await loadCallForParticipant(callId, request.authUser!.id);
  if (!call) {
    return response.status(404).json({ message: "Call not found." });
  }

  const participant = call.participants.find((entry) => entry.userId === request.authUser!.id)!;
  if (participant.isInitiator) {
    return response.status(403).json({ message: "The initiator cannot accept their own call." });
  }

  if (!canTransitionVoiceCall(call.status, "CONNECTED")) {
    return response.status(409).json({ message: `A call in status ${call.status} cannot be accepted.` });
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (transaction) => {
    await transaction.voiceCallParticipant.update({
      where: { callId_userId: { callId: call.id, userId: request.authUser!.id } },
      data: { status: VoiceCallParticipantStatus.ACCEPTED, answeredAt: now },
    });
    await transaction.voiceCallParticipant.updateMany({
      where: { callId: call.id, isInitiator: true },
      data: { status: VoiceCallParticipantStatus.ACCEPTED, answeredAt: now },
    });
    const next = await transaction.voiceCall.update({
      where: { id: call.id },
      data: {
        status: VoiceCallStatus.CONNECTED,
        connectedAt: now,
        events: {
          create: [
            {
              type: VoiceCallEventType.ACCEPTED,
              actorUserId: request.authUser!.id,
              fromStatus: call.status,
              toStatus: VoiceCallStatus.CONNECTED,
            },
            {
              type: VoiceCallEventType.CONNECTED,
              actorUserId: request.authUser!.id,
              fromStatus: call.status,
              toStatus: VoiceCallStatus.CONNECTED,
            },
          ],
        },
      },
      include: voiceCallInclude,
    });
    await createAuditLog(transaction, {
      actorUserId: request.authUser!.id,
      action: "ELECTION_DAY_CALL_ACCEPTED",
      targetType: "VoiceCall",
      targetId: call.id,
      territory: next,
      metadata: { recording: "DISABLED" },
    });
    return next;
  });

  await publishCallEvent("call.connected", updated, request.authUser!.id);

  return response.json({
    message: "Election Day call connected.",
    item: serializeCall(updated, getPresenceSnapshot(updated.participants.map((entry) => entry.userId))),
  });
});

router.post("/calls/:callId/reject", requireAuth, async (request, response) => {
  const callId = Array.isArray(request.params.callId) ? request.params.callId[0] : request.params.callId;
  const call = await loadCallForParticipant(callId, request.authUser!.id);
  if (!call) {
    return response.status(404).json({ message: "Call not found." });
  }

  const participant = call.participants.find((entry) => entry.userId === request.authUser!.id)!;
  if (participant.isInitiator) {
    return response.status(403).json({ message: "The initiator cannot reject their own call; end it instead." });
  }

  if (!canTransitionVoiceCall(call.status, "ENDED") || call.status === VoiceCallStatus.CONNECTED) {
    return response.status(409).json({ message: `A call in status ${call.status} cannot be rejected.` });
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (transaction) => {
    await transaction.voiceCallParticipant.update({
      where: { callId_userId: { callId: call.id, userId: request.authUser!.id } },
      data: { status: VoiceCallParticipantStatus.REJECTED, leftAt: now },
    });
    await transaction.voiceCallParticipant.updateMany({
      where: { callId: call.id, isInitiator: true },
      data: { status: VoiceCallParticipantStatus.LEFT, leftAt: now },
    });
    const next = await transaction.voiceCall.update({
      where: { id: call.id },
      data: {
        status: VoiceCallStatus.ENDED,
        endReason: VoiceCallEndReason.REJECTED,
        endedAt: now,
        endedByUserId: request.authUser!.id,
        durationSeconds: 0,
        events: {
          create: {
            type: VoiceCallEventType.REJECTED,
            actorUserId: request.authUser!.id,
            fromStatus: call.status,
            toStatus: VoiceCallStatus.ENDED,
          },
        },
      },
      include: voiceCallInclude,
    });
    await createAuditLog(transaction, {
      actorUserId: request.authUser!.id,
      action: "ELECTION_DAY_CALL_REJECTED",
      targetType: "VoiceCall",
      targetId: call.id,
      territory: next,
      metadata: { endReason: "REJECTED" },
    });
    return next;
  });

  await publishCallEvent("call.rejected", updated, request.authUser!.id);

  return response.json({
    message: "Election Day call rejected.",
    item: serializeCall(updated, getPresenceSnapshot(updated.participants.map((entry) => entry.userId))),
  });
});

router.post("/calls/:callId/end", requireAuth, async (request, response) => {
  const parsed = callEndSchema.safeParse(request.body || {});
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid call end payload.", errors: parsed.error.flatten() });
  }

  const callId = Array.isArray(request.params.callId) ? request.params.callId[0] : request.params.callId;
  const call = await loadCallForParticipant(callId, request.authUser!.id);
  if (!call) {
    return response.status(404).json({ message: "Call not found." });
  }

  if (!canTransitionVoiceCall(call.status, "ENDED")) {
    return response.status(409).json({ message: `A call in status ${call.status} cannot be ended.` });
  }

  const now = new Date();
  // A call that never connected and is ended by the initiator was missed by the
  // recipient; ended by anyone else before connecting it was cancelled.
  const endReason: VoiceCallEndReason = call.connectedAt
    ? VoiceCallEndReason[parsed.data.reason || "COMPLETED"]
    : call.initiatorUserId === request.authUser!.id
      ? VoiceCallEndReason.MISSED
      : VoiceCallEndReason.CANCELLED;
  const durationSeconds = call.connectedAt ? Math.max(0, Math.round((now.getTime() - call.connectedAt.getTime()) / 1000)) : 0;

  const updated = await prisma.$transaction(async (transaction) => {
    await transaction.voiceCallParticipant.updateMany({
      where: { callId: call.id, leftAt: null },
      data: {
        status: endReason === VoiceCallEndReason.MISSED ? VoiceCallParticipantStatus.MISSED : VoiceCallParticipantStatus.LEFT,
        leftAt: now,
      },
    });
    const next = await transaction.voiceCall.update({
      where: { id: call.id },
      data: {
        status: VoiceCallStatus.ENDED,
        endReason,
        endedAt: now,
        endedByUserId: request.authUser!.id,
        durationSeconds,
        events: {
          create: {
            type: endReason === VoiceCallEndReason.MISSED ? VoiceCallEventType.MISSED : VoiceCallEventType.ENDED,
            actorUserId: request.authUser!.id,
            fromStatus: call.status,
            toStatus: VoiceCallStatus.ENDED,
            metadataJson: { endReason, durationSeconds } as Prisma.InputJsonObject,
          },
        },
      },
      include: voiceCallInclude,
    });
    await createAuditLog(transaction, {
      actorUserId: request.authUser!.id,
      action: "ELECTION_DAY_CALL_ENDED",
      targetType: "VoiceCall",
      targetId: call.id,
      territory: next,
      metadata: { endReason, durationSeconds },
    });
    return next;
  });

  await publishCallEvent(endReason === VoiceCallEndReason.MISSED ? "call.missed" : "call.ended", updated, request.authUser!.id, {
    endReason,
    durationSeconds,
  });

  return response.json({
    message: "Election Day call ended.",
    item: serializeCall(updated, getPresenceSnapshot(updated.participants.map((entry) => entry.userId))),
  });
});

router.post("/calls/:callId/signal", requireAuth, async (request, response) => {
  const parsed = callSignalSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid signal payload.", errors: parsed.error.flatten() });
  }

  const callId = Array.isArray(request.params.callId) ? request.params.callId[0] : request.params.callId;
  const call = await loadCallForParticipant(callId, request.authUser!.id);
  if (!call) {
    return response.status(404).json({ message: "Call not found." });
  }

  if (call.status === VoiceCallStatus.ENDED) {
    return response.status(409).json({ message: "This call has already ended." });
  }

  if (
    !call.participants.some((participant) => participant.userId === parsed.data.targetUserId) ||
    !(await canContactUser(request.authUser!, parsed.data.targetUserId))
  ) {
    return response.status(403).json({ message: "Signal denied for this call." });
  }

  // Only the signal type is recorded; the SDP/ICE body is relayed and discarded.
  await prisma.voiceCallEvent.create({
    data: {
      callId: call.id,
      type: VoiceCallEventType.SIGNAL_RELAYED,
      actorUserId: request.authUser!.id,
      targetUserId: parsed.data.targetUserId,
      signalType: parsed.data.signalType,
    },
  });

  const delivered = publishRealtimeEventToUsers(
    createElectionDayRealtimeEvent({
      eventType: "call.signal",
      actorUserId: request.authUser!.id,
      territory: {
        stateId: call.stateId,
        senatorialDistrictId: call.senatorialDistrictId,
        federalConstituencyId: call.federalConstituencyId,
        stateConstituencyId: call.stateConstituencyId,
        wardId: call.wardId,
        pollingUnitId: call.pollingUnitId,
      },
      payload: {
        callId: call.id,
        fromUserId: request.authUser!.id,
        targetUserId: parsed.data.targetUserId,
        signalType: parsed.data.signalType,
        signal: parsed.data.signal ?? null,
        recording: "DISABLED",
      },
    }),
    [parsed.data.targetUserId],
  );

  return response.status(202).json({
    message: "Signal relayed.",
    delivered,
    transport: delivered ? "socket.io" : "REST_ONLY_REALTIME_UNAVAILABLE",
  });
});

router.get("/calls", requireAuth, async (request, response) => {
  const parsed = callHistoryQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid call history query.", errors: parsed.error.flatten() });
  }

  const calls = await prisma.voiceCall.findMany({
    where: {
      participants: { some: { userId: request.authUser!.id } },
      status: parsed.data.status || undefined,
    },
    include: voiceCallInclude,
    orderBy: { startedAt: "desc" },
    take: parsed.data.limit,
  });

  const presence = getPresenceSnapshot(
    Array.from(new Set(calls.flatMap((call) => call.participants.map((participant) => participant.userId)))),
  );

  return response.json({ calls: calls.map((call) => serializeCall(call, presence)) });
});

router.get("/calls/:callId", requireAuth, async (request, response) => {
  const callId = Array.isArray(request.params.callId) ? request.params.callId[0] : request.params.callId;
  const call = await loadCallForParticipant(callId, request.authUser!.id);
  if (!call) {
    return response.status(404).json({ message: "Call not found." });
  }

  return response.json({
    item: serializeCall(call, getPresenceSnapshot(call.participants.map((participant) => participant.userId))),
  });
});

router.get("/conversations", requireAuth, async (request, response) => {
  const conversations = await prisma.conversation.findMany({
    where: { members: { some: { userId: request.authUser!.id, leftAt: null } } },
    include: {
      members: {
        where: { leftAt: null },
        include: { user: { select: { name: true, role: true } } },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          senderUser: { select: { name: true } },
          receipts: true,
          attachments: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const memberUserIds = Array.from(new Set(conversations.flatMap((conversation) => conversation.members.map((member) => member.userId))));
  const presence = getPresenceSnapshot(memberUserIds);
  return response.json({
    conversations: conversations.map((conversation) => serializeConversation(conversation, presence, request.authUser!.id)),
  });
});

router.post("/conversations", requireAuth, async (request, response) => {
  const parsed = conversationCreateSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid conversation payload.", errors: parsed.error.flatten() });
  }

  const actorScope =
    commandScopeForActor(request.authUser!) ||
    (request.authUser!.agentProfile?.stateId
      ? operationalTerritoryFromProfile({ ...request.authUser!.agentProfile, stateId: request.authUser!.agentProfile.stateId })
      : null);
  if (!actorScope) {
    return response.status(403).json({ message: "Election Day messaging scope is required." });
  }

  let conversationTerritory = actorScope;
  let memberUserIds: string[] = [request.authUser!.id];

  if (parsed.data.type === "DIRECT") {
    if (!parsed.data.recipientUserId || !(await canMessageUser(request.authUser!, parsed.data.recipientUserId))) {
      return response.status(403).json({ message: "You cannot message this user outside your operational relationship." });
    }
    const targetTerritory = await targetTerritoryForUser(parsed.data.recipientUserId);
    conversationTerritory = targetTerritory || actorScope;
    memberUserIds.push(parsed.data.recipientUserId);
  } else if (parsed.data.type === "GROUP") {
    const requestedMembers = parsed.data.memberUserIds || [];
    for (const userId of requestedMembers) {
      if (!(await canMessageUser(request.authUser!, userId))) {
        return response.status(403).json({ message: "Group contains a user outside your operational relationship." });
      }
    }
    memberUserIds.push(...requestedMembers);
  } else {
    const requestedTerritory = {
      stateId: parsed.data.territory?.stateId || actorScope.stateId,
      senatorialDistrictId: parsed.data.territory?.senatorialDistrictId || actorScope.senatorialDistrictId || null,
      federalConstituencyId: parsed.data.territory?.federalConstituencyId || actorScope.federalConstituencyId || null,
      stateConstituencyId: parsed.data.territory?.stateConstituencyId || actorScope.stateConstituencyId || null,
      wardId: parsed.data.territory?.wardId || actorScope.wardId || null,
      pollingUnitId: parsed.data.territory?.pollingUnitId || actorScope.pollingUnitId || null,
    };
    const resolved = await resolveOperationalTerritory(prisma, requestedTerritory);
    if (!authorizeAction(request.authUser!, "VIEW_TERRITORY", resolved)) {
      return response.status(403).json({ message: "You cannot create a territory conversation outside your command scope." });
    }
    conversationTerritory = requestedTerritory;
    const recipients = await prisma.agentProfile.findMany({
      where: { ...territoryFilter(conversationTerritory), pollingUnitId: { not: null }, user: { isActive: true, accountStatus: "ACTIVE" } },
      select: { userId: true },
      take: 500,
    });
    memberUserIds.push(...recipients.map((recipient) => recipient.userId));
  }

  memberUserIds = Array.from(new Set(memberUserIds));
  const conversation = await prisma.$transaction(async (transaction) => {
    const created = await transaction.conversation.create({
      data: {
        type: parsed.data.type as ConversationType,
        title: parsed.data.title || (parsed.data.type === "DIRECT" ? null : "Election Operations Chat"),
        createdByUserId: request.authUser!.id,
        stateId: conversationTerritory.stateId,
        senatorialDistrictId: conversationTerritory.senatorialDistrictId || null,
        federalConstituencyId: conversationTerritory.federalConstituencyId || null,
        stateConstituencyId: conversationTerritory.stateConstituencyId || null,
        wardId: conversationTerritory.wardId || null,
        pollingUnitId: conversationTerritory.pollingUnitId || null,
        members: {
          create: memberUserIds.map((userId) => ({
            userId,
            roleLabel: userId === request.authUser!.id ? "CREATOR" : null,
          })),
        },
      },
    });
    await createAuditLog(transaction, {
      actorUserId: request.authUser!.id,
      action: "ELECTION_DAY_CONVERSATION_CREATED",
      targetType: "Conversation",
      targetId: created.id,
      territory: created,
      metadata: { type: created.type, memberCount: memberUserIds.length },
    });
    return created;
  });

  return response.status(201).json({ message: "Election Day conversation created.", conversationId: conversation.id });
});

router.get("/conversations/:conversationId/messages", requireAuth, async (request, response) => {
  const conversationId = Array.isArray(request.params.conversationId) ? request.params.conversationId[0] : request.params.conversationId;
  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: request.authUser!.id } },
  });
  if (!membership || membership.leftAt) {
    return response.status(403).json({ message: "You are not a member of this conversation." });
  }

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: {
      senderUser: { select: { name: true } },
      receipts: true,
      attachments: true,
    },
  });

  await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId, userId: request.authUser!.id } },
    data: { lastReadAt: new Date() },
  });

  return response.json({ messages: messages.map(serializeMessage) });
});

router.post("/conversations/:conversationId/messages", requireAuth, async (request, response) => {
  const parsed = messageCreateSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid message payload.", errors: parsed.error.flatten() });
  }

  const conversationId = Array.isArray(request.params.conversationId) ? request.params.conversationId[0] : request.params.conversationId;
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { members: { where: { leftAt: null }, include: { user: { select: { name: true, role: true } } } } },
  });
  if (!conversation || !conversation.members.some((member) => member.userId === request.authUser!.id)) {
    return response.status(403).json({ message: "You are not a member of this conversation." });
  }

  const message = await prisma.$transaction(async (transaction) => {
    const created = await transaction.message.create({
      data: {
        conversationId,
        senderUserId: request.authUser!.id,
        body: parsed.data.body,
        metadataJson: (parsed.data.metadata || {}) as Prisma.InputJsonObject,
        stateId: conversation.stateId,
        receipts: {
          create: conversation.members
            .filter((member) => member.userId !== request.authUser!.id)
            .map((member) => ({
              userId: member.userId,
              status: MessageReceiptStatus.DELIVERED,
              deliveredAt: new Date(),
            })),
        },
      },
      include: {
        senderUser: { select: { name: true } },
        receipts: true,
        attachments: true,
      },
    });
    await transaction.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
    await transaction.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId: request.authUser!.id } },
      data: { lastReadAt: new Date() },
    });
    await createAuditLog(transaction, {
      actorUserId: request.authUser!.id,
      action: "ELECTION_DAY_MESSAGE_CREATED",
      targetType: "Message",
      targetId: created.id,
      territory: conversation,
      metadata: { conversationId, realtimeEvent: "message.created", attachmentCount: 0 },
    });
    return created;
  });

  await persistAndPublishRealtimeEvent(
    createElectionDayRealtimeEvent({
      eventType: "message.created",
      actorUserId: request.authUser!.id,
      territory: {
        stateId: conversation.stateId,
        senatorialDistrictId: conversation.senatorialDistrictId,
        federalConstituencyId: conversation.federalConstituencyId,
        stateConstituencyId: conversation.stateConstituencyId,
        wardId: conversation.wardId,
        pollingUnitId: conversation.pollingUnitId,
      },
      idempotencyKey: `message:${message.id}`,
      payload: {
        messageId: message.id,
        conversationId,
        senderUserId: message.senderUserId,
        createdAt: message.createdAt.toISOString(),
      },
    }),
  );

  return response.status(201).json({ message: "Election Day message sent.", item: serializeMessage(message) });
});

router.post("/conversations/:conversationId/read", requireAuth, async (request, response) => {
  const conversationId = Array.isArray(request.params.conversationId) ? request.params.conversationId[0] : request.params.conversationId;
  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: request.authUser!.id } },
  });
  if (!membership || membership.leftAt) {
    return response.status(403).json({ message: "You are not a member of this conversation." });
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId: request.authUser!.id } },
      data: { lastReadAt: now },
    }),
    prisma.messageReceipt.updateMany({
      where: { userId: request.authUser!.id, message: { conversationId }, status: MessageReceiptStatus.DELIVERED },
      data: { status: MessageReceiptStatus.READ, readAt: now },
    }),
  ]);

  return response.json({ message: "Conversation marked as read." });
});

router.post("/messages/territory", requireAuth, async (request, response) => {
  const parsed = territoryMessageSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid territory message payload.", errors: parsed.error.flatten() });
  }

  const scope = await requireCommandScope(request.authUser!);
  if (!scope) {
    return response.status(403).json({ message: "Election Day command scope is required to message a territory." });
  }

  const recipientCount = await prisma.agentProfile.count({
    where: {
      ...territoryFilter(scope),
      pollingUnitId: { not: null },
      user: { isActive: true, accountStatus: "ACTIVE" },
    },
  });

  const broadcast = await prisma.$transaction(async (transaction) => {
    const created = await transaction.broadcastMessage.create({
      data: {
        title: parsed.data.title,
        message: parsed.data.message,
        audience: BroadcastAudience.AGENTS,
        createdByUserId: request.authUser!.id,
        recipientCount,
        stateId: scope.stateId,
        senatorialDistrictId: scope.senatorialDistrictId || null,
        federalConstituencyId: scope.federalConstituencyId || null,
        stateConstituencyId: scope.stateConstituencyId || null,
        wardId: scope.wardId || null,
        pollingUnitId: scope.pollingUnitId || null,
      },
      include: { createdByUser: { select: { name: true } } },
    });

    await createAuditLog(transaction, {
      actorUserId: request.authUser!.id,
      action: "ELECTION_DAY_TERRITORY_MESSAGE_CREATED",
      targetType: "BroadcastMessage",
      targetId: created.id,
      territory: created,
      metadata: {
        recipientCount,
        realtimeEvent: "message.created",
        restFallback: true,
      },
    });

    return created;
  });

  await persistAndPublishRealtimeEvent(
    createElectionDayRealtimeEvent({
      eventType: "message.created",
      actorUserId: request.authUser!.id,
      territory: scope,
      idempotencyKey: broadcast.id,
      payload: {
        broadcastId: broadcast.id,
        title: broadcast.title,
        audience: broadcast.audience,
        recipientCount: broadcast.recipientCount,
        createdAt: broadcast.createdAt.toISOString(),
      },
    }),
  );

  return response.status(201).json({
    message: "Election Day territory message created.",
    broadcast: serializeBroadcastMessageItem(broadcast),
  });
});

router.get("/messages", requireAuth, requirePollingUnitFieldCapability, async (request, response) => {
  const agentProfile = await getAgentProfileOrError(request.authUser!.id);
  if (!agentProfile) {
    return response.status(404).json({ message: "Polling Unit Coordinator profile was not found." });
  }

  const broadcasts = await prisma.broadcastMessage.findMany({
    where: {
      audience: { in: [BroadcastAudience.ALL, BroadcastAudience.AGENTS] },
      OR: [
        { stateId: null },
        { stateId: agentProfile.stateId, pollingUnitId: agentProfile.pollingUnitId },
        { stateId: agentProfile.stateId, pollingUnitId: null, wardId: agentProfile.wardId },
        { stateId: agentProfile.stateId, pollingUnitId: null, wardId: null, stateConstituencyId: agentProfile.stateConstituencyId },
        { stateId: agentProfile.stateId, pollingUnitId: null, wardId: null, stateConstituencyId: null, federalConstituencyId: agentProfile.federalConstituencyId },
        { stateId: agentProfile.stateId, pollingUnitId: null, wardId: null, stateConstituencyId: null, federalConstituencyId: null, senatorialDistrictId: agentProfile.senatorialDistrictId },
        { stateId: agentProfile.stateId, pollingUnitId: null, wardId: null, stateConstituencyId: null, federalConstituencyId: null, senatorialDistrictId: null },
      ],
    },
    include: { createdByUser: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return response.json({
    broadcasts: broadcasts.map(serializeBroadcastMessageItem),
  });
});

router.post("/incidents/:incidentId/escalate", requireAuth, async (request, response) => {
  const parsed = z.object({ escalationNote: z.string().trim().min(3).max(500) }).safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid incident escalation payload.", errors: parsed.error.flatten() });
  }

  const scope = await requireCommandScope(request.authUser!);
  if (!scope) {
    return response.status(403).json({ message: "Election Day command scope is required." });
  }

  const incidentId = Array.isArray(request.params.incidentId) ? request.params.incidentId[0] : request.params.incidentId;
  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  if (!incident) {
    return response.status(404).json({ message: "Incident was not found." });
  }

  const incidentTerritory = await resolveOperationalTerritory(prisma, {
    stateId: incident.stateId,
    senatorialDistrictId: incident.senatorialDistrictId,
    wardId: incident.wardId,
    pollingUnitId: incident.pollingUnitId,
  });
  if (!authorizeAction(request.authUser!, "VIEW_TERRITORY", incidentTerritory)) {
    return response.status(403).json({ message: "You cannot escalate this incident outside your command scope." });
  }

  const updated = await prisma.$transaction(async (transaction) => {
    const next = await transaction.incident.update({
      where: { id: incident.id },
      data: {
        status: IncidentStatus.IN_PROGRESS,
        escalatedAt: new Date(),
        escalatedByUserId: request.authUser!.id,
        escalationNote: parsed.data.escalationNote,
      },
    });
    await createNotification(transaction, {
      userId: next.reportedByUserId,
      type: NotificationType.INCIDENT_UPDATED,
      title: "Incident escalated",
      message: `${next.title} has been escalated for operational review.`,
    });
    await createAuditLog(transaction, {
      actorUserId: request.authUser!.id,
      action: "ELECTION_DAY_INCIDENT_ESCALATED",
      targetType: "Incident",
      targetId: next.id,
      territory: next,
      metadata: { escalationNote: parsed.data.escalationNote, realtimeEvent: "election.incident.updated" },
    });
    return next;
  });

  const updatedTerritory = await resolveOperationalTerritory(prisma, {
    stateId: updated.stateId,
    senatorialDistrictId: updated.senatorialDistrictId,
    wardId: updated.wardId,
    pollingUnitId: updated.pollingUnitId,
  });
  publishRealtimeEvent(
    createElectionDayRealtimeEvent({
      eventType: "election.incident.updated",
      actorUserId: request.authUser!.id,
      territory: updatedTerritory,
      idempotencyKey: `incident-updated:${updated.id}:${updated.updatedAt.toISOString()}`,
      payload: {
        incidentId: updated.id,
        status: updated.status,
        escalatedAt: updated.escalatedAt?.toISOString() || null,
        pollingUnitId: updated.pollingUnitId,
      },
    }),
  );
  publishRealtimeEvent(
    createElectionDayRealtimeEvent({
      eventType: "election.situation.updated",
      actorUserId: request.authUser!.id,
      territory: updatedTerritory,
      idempotencyKey: `situation:${updated.id}:${updated.updatedAt.toISOString()}`,
      payload: { reason: "INCIDENT_UPDATED", pollingUnitId: updated.pollingUnitId },
    }),
  );

  return response.json({
    message: "Election Day incident escalated.",
    incident: serializeIncidentItem(updated),
  });
});

export default router;
