import { Router } from "express";
import {
  AgentActivityType,
  BroadcastAudience,
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
  NotificationType,
  Prisma,
} from "@prisma/client";
import {
  ELECTION_DAY_REALTIME_EVENT_TYPES,
  OGUN_STATE_ID,
  type AuthUserProfile,
  type ElectionDayLocationEvaluation,
  type ElectionDayPollingUnitStatus,
  type ElectionDaySituationRoomStatus,
  type OperationalTerritory,
  type PollingUnitOperationalStatus,
} from "@pics-nigeria/shared";
import { z } from "zod";
import { authorizeAction, resolveOperationalTerritory } from "../authorization";
import { createAuditLog } from "../lib/audit";
import { createNotification } from "../lib/notifications";
import { serializeBroadcastMessageItem, serializeIncidentItem } from "../lib/serializers";
import { validateTerritoryReferences } from "../lib/territory";
import { requireAuth, requirePollingUnitFieldCapability } from "../middleware/auth";
import { prisma } from "../prisma";

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
      return { activity: existing, alreadyRecorded: true };
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

  return { activity, alreadyRecorded: false };
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

  const alerts = pollingUnitStatuses
    .filter((item) => item.coordinatorUserId && !item.checkedInAt)
    .map((item) => ({
      type: "NO_CHECK_IN" as const,
      status: "OPEN" as const,
      pollingUnitId: item.pollingUnitId,
      message: `${item.pollingUnitName || "Polling Unit"} has an assigned coordinator but no check-in for the selected date.`,
      detectedAt: new Date().toISOString(),
    }));

  return {
    generatedAt: new Date().toISOString(),
    territory: scope,
    realtime: {
      runtimeStatus: "TARGET_NOT_RUNNING",
      restFallbackAvailable: true,
      contractVersion: 1,
      eventTypes: [...ELECTION_DAY_REALTIME_EVENT_TYPES],
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
  return response.json({
    realtime: {
      runtimeStatus: "TARGET_NOT_RUNNING",
      restFallbackAvailable: true,
      transport: "Socket.IO/WebSocket target; REST endpoints are authoritative fallback in this branch.",
      contractVersion: 1,
      eventTypes: ELECTION_DAY_REALTIME_EVENT_TYPES,
    },
  });
});

router.post("/check-in", requireAuth, requirePollingUnitFieldCapability, async (request, response) => {
  const parsed = operationPayloadSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid Election Day check-in payload.", errors: parsed.error.flatten() });
  }

  try {
    const { activity, alreadyRecorded } = await createFieldActivity(request.authUser!, AgentActivityType.CHECK_IN, parsed.data);
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
    const { activity } = await createFieldActivity(request.authUser!, AgentActivityType.CHECK_OUT, parsed.data);
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
    const { activity } = await createFieldActivity(request.authUser!, AgentActivityType.LOCATION_PING, parsed.data);
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

  return response.json({
    message: "Election Day incident escalated.",
    incident: serializeIncidentItem(updated),
  });
});

export default router;
