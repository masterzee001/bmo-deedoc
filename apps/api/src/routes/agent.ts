import express, { Router } from "express";
import {
  AgentActivityType,
  ElectionDayOpeningStatus,
  ElectionDayReportAssetKind,
  ElectionDayReportStatus,
  FieldTaskStatus,
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
  NotificationType,
} from "@prisma/client";
import { z } from "zod";
import { requireAuth, requirePollingUnitFieldCapability } from "../middleware/auth";
import { prisma } from "../prisma";
import { validateTerritoryReferences } from "../lib/territory";
import {
  serializeElectionDayReportAssetItem,
  serializeElectionDayReportItem,
  serializeFeedbackItem,
  serializeFieldTaskItem,
  serializeIncidentItem,
} from "../lib/serializers";
import { createAuditLog } from "../lib/audit";
import { createNotification } from "../lib/notifications";
import { createElectionDayRealtimeEvent } from "../realtime/events";
import { publishRealtimeEvent } from "../realtime/gateway";

const router = Router();

const activityPayloadSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracyMeters: z.number().positive().max(5000).optional(),
  note: z.string().trim().max(500).optional(),
  pollingUnitId: z.string().trim().optional(),
});

const incidentSchema = z.object({
  type: z.nativeEnum(IncidentType),
  title: z.string().trim().min(3),
  description: z.string().trim().min(10),
  severity: z.nativeEnum(IncidentSeverity),
  senatorialDistrictId: z.string().trim().optional(),
  pollingUnitId: z.string().trim().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

const activityQuerySchema = z.object({
  type: z.nativeEnum(AgentActivityType).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
});

const taskStatusSchema = z.object({
  status: z.nativeEnum(FieldTaskStatus),
  resolutionNote: z.string().trim().max(1000).optional(),
});

const electionDayReportUploadMiddleware = express.raw({
  type: ["image/jpeg", "image/png", "image/webp"],
  limit: "2mb",
});

const electionDayVoteEntrySchema = z.object({
  politicalPartyId: z.string().trim().min(1),
  votes: z.number().int().min(0).max(1_000_000),
});

const electionDayReportSchema = z.object({
  reportDate: z.string().date(),
  openingStatus: z.nativeEnum(ElectionDayOpeningStatus),
  arrivalConfirmedAt: z.string().datetime(),
  turnoutObservation: z.string().trim().min(10).max(1000),
  incidentNotes: z.string().trim().max(1000).optional(),
  remarks: z.string().trim().max(1000).optional(),
  arrivalPhotoAssetId: z.string().trim().min(1),
  postCountingPhotoAssetId: z.string().trim().min(1),
  voteEntries: z.array(electionDayVoteEntrySchema).length(5),
}).superRefine((data, context) => {
  const uniquePartyIds = new Set(data.voteEntries.map((entry) => entry.politicalPartyId));
  if (uniquePartyIds.size !== data.voteEntries.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Each vote entry must use a different political party.",
      path: ["voteEntries"],
    });
  }
});

function buildElectionReportAssetUrl(request: express.Request, assetId: string) {
  return `${request.protocol}://${request.get("host")}/agent/election-report-assets/${assetId}`;
}

async function getAgentProfileOrError(userId: string) {
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
    },
  });
}

async function ensureElectionReportAssetOwnership(
  ownerUserId: string,
  assetId: string,
  kind: ElectionDayReportAssetKind,
) {
  return prisma.electionDayReportAsset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      ownerUserId: true,
      kind: true,
    },
  }).then((asset) => {
    if (!asset || asset.ownerUserId !== ownerUserId || asset.kind !== kind) {
      return null;
    }

    return asset;
  });
}

async function resolveElectionReportVotes(voteEntries: z.infer<typeof electionDayReportSchema>["voteEntries"]) {
  const parties = await prisma.politicalParty.findMany({
    where: {
      id: { in: voteEntries.map((entry) => entry.politicalPartyId) },
      isApprovedByInec: true,
    },
    select: { id: true, name: true },
  });

  if (parties.length !== voteEntries.length) {
    return null;
  }

  const partyMap = new Map(parties.map((party) => [party.id, party.name]));
  return voteEntries.map((entry) => ({
    politicalPartyId: entry.politicalPartyId,
    politicalPartyName: partyMap.get(entry.politicalPartyId) || null,
    votes: entry.votes,
  }));
}

async function createAgentActivity(
  agentUserId: string,
  type: AgentActivityType,
  payload: z.infer<typeof activityPayloadSchema>,
) {
  const agentProfile = await getAgentProfileOrError(agentUserId);

  if (!agentProfile) {
    throw new Error("Agent profile was not found.");
  }

  if (payload.pollingUnitId && agentProfile.pollingUnitId && payload.pollingUnitId !== agentProfile.pollingUnitId) {
    throw new Error("You can only submit activity for your assigned polling unit.");
  }

  if (payload.pollingUnitId) {
    const territoryError = await validateTerritoryReferences({
      stateId: agentProfile.stateId,
      senatorialDistrictId: undefined,
      lgaId: agentProfile.lgaId,
      wardId: agentProfile.wardId,
      pollingUnitId: payload.pollingUnitId,
    });

    if (territoryError) {
      throw new Error(territoryError);
    }
  }

  if (
    type === AgentActivityType.LOCATION_PING &&
    (typeof payload.latitude !== "number" || typeof payload.longitude !== "number")
  ) {
    throw new Error("Live tracking requires device GPS coordinates.");
  }

  return prisma.agentActivity.create({
    data: {
      agentUserId,
      type,
      latitude: payload.latitude ?? null,
      longitude: payload.longitude ?? null,
      accuracyMeters: payload.accuracyMeters ?? null,
      note: payload.note?.trim() || null,
      stateId: agentProfile.stateId,
      lgaId: agentProfile.lgaId,
      wardId: agentProfile.wardId,
      pollingUnitId: payload.pollingUnitId || agentProfile.pollingUnitId || null,
    },
  });
}

router.post("/check-in", requireAuth, requirePollingUnitFieldCapability, async (request, response) => {
  const parsed = activityPayloadSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid check-in payload.", errors: parsed.error.flatten() });
  }

  try {
    const activity = await createAgentActivity(request.authUser!.id, AgentActivityType.CHECK_IN, parsed.data);
    return response.status(201).json({ message: "Check-in recorded successfully.", activity });
  } catch (error) {
    return response.status(400).json({ message: error instanceof Error ? error.message : "Check-in failed." });
  }
});

router.post("/check-out", requireAuth, requirePollingUnitFieldCapability, async (request, response) => {
  const parsed = activityPayloadSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid check-out payload.", errors: parsed.error.flatten() });
  }

  try {
    const activity = await createAgentActivity(request.authUser!.id, AgentActivityType.CHECK_OUT, parsed.data);
    return response.status(201).json({ message: "Check-out recorded successfully.", activity });
  } catch (error) {
    return response.status(400).json({ message: error instanceof Error ? error.message : "Check-out failed." });
  }
});

router.post("/location", requireAuth, requirePollingUnitFieldCapability, async (request, response) => {
  const parsed = activityPayloadSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid location payload.", errors: parsed.error.flatten() });
  }

  try {
    const activity = await createAgentActivity(request.authUser!.id, AgentActivityType.LOCATION_PING, parsed.data);
    return response.status(201).json({ message: "Location ping recorded successfully.", activity });
  } catch (error) {
    return response.status(400).json({ message: error instanceof Error ? error.message : "Location update failed." });
  }
});

router.get("/activities", requireAuth, requirePollingUnitFieldCapability, async (request, response) => {
  const parsed = activityQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid activity query.", errors: parsed.error.flatten() });
  }

  const page = parsed.data.page || 1;
  const pageSize = parsed.data.pageSize || 20;
  const createdAtFilter =
    parsed.data.dateFrom || parsed.data.dateTo
      ? {
          gte: parsed.data.dateFrom ? new Date(parsed.data.dateFrom) : undefined,
          lte: parsed.data.dateTo ? new Date(parsed.data.dateTo) : undefined,
        }
      : undefined;

  const activities = await prisma.agentActivity.findMany({
    where: {
      agentUserId: request.authUser!.id,
      type: parsed.data.type,
      createdAt: createdAtFilter,
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return response.json({
    page,
    pageSize,
    activities,
  });
});

router.post("/incidents", requireAuth, requirePollingUnitFieldCapability, async (request, response) => {
  const parsed = incidentSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid incident payload.", errors: parsed.error.flatten() });
  }

  const agentProfile = await getAgentProfileOrError(request.authUser!.id);
  if (!agentProfile) {
    return response.status(404).json({ message: "Agent profile was not found." });
  }

  if (parsed.data.pollingUnitId && agentProfile.pollingUnitId && parsed.data.pollingUnitId !== agentProfile.pollingUnitId) {
    return response.status(400).json({ message: "You can only report incidents for your assigned polling unit." });
  }

  const territoryError = await validateTerritoryReferences({
    stateId: agentProfile.stateId,
    senatorialDistrictId: parsed.data.senatorialDistrictId,
    lgaId: agentProfile.lgaId,
    wardId: agentProfile.wardId,
    pollingUnitId: parsed.data.pollingUnitId,
  });

  if (territoryError) {
    return response.status(400).json({ message: territoryError });
  }

  const incident = await prisma.incident.create({
    data: {
      reportedByUserId: request.authUser!.id,
      type: parsed.data.type,
      title: parsed.data.title,
      description: parsed.data.description,
      severity: parsed.data.severity,
      status: IncidentStatus.OPEN,
      latitude: parsed.data.latitude ?? null,
      longitude: parsed.data.longitude ?? null,
      stateId: agentProfile.stateId,
      senatorialDistrictId: parsed.data.senatorialDistrictId || null,
      lgaId: agentProfile.lgaId,
      wardId: agentProfile.wardId,
      pollingUnitId: parsed.data.pollingUnitId || agentProfile.pollingUnitId || null,
      assignedAdminUserId: null,
    },
  });

  await prisma.feedback.create({
    data: {
      agentUserId: request.authUser!.id,
      type: `INCIDENT:${parsed.data.type}`,
      message: `${parsed.data.title}: ${parsed.data.description}`,
      stateId: agentProfile.stateId,
      lgaId: agentProfile.lgaId,
      wardId: agentProfile.wardId,
      pollingUnitId: parsed.data.pollingUnitId || agentProfile.pollingUnitId || null,
    },
  });

  return response.status(201).json({
    message: "Incident reported successfully.",
    incident: serializeIncidentItem(incident),
  });
});

router.post("/election-report-assets/:kind", requireAuth, requirePollingUnitFieldCapability, electionDayReportUploadMiddleware, async (request, response) => {
  const rawKind = Array.isArray(request.params.kind) ? request.params.kind[0] : request.params.kind;
  const kind =
    rawKind === "arrival-photo"
      ? ElectionDayReportAssetKind.ARRIVAL_PHOTO
      : rawKind === "post-counting-photo"
        ? ElectionDayReportAssetKind.POST_COUNTING_PHOTO
        : null;

  if (!kind) {
    return response.status(400).json({ message: "Invalid election report asset kind." });
  }

  if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
    return response.status(400).json({ message: "Image upload is required." });
  }

  const mimeType = request.header("content-type");
  if (!mimeType || !["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
    return response.status(400).json({ message: "Only JPEG, PNG, and WebP election report photos are supported." });
  }

  const fileBytes = Uint8Array.from(request.body);
  const fileName = request.header("x-file-name")?.trim() || `${kind.toLowerCase()}-${Date.now()}`;
  const asset = await prisma.electionDayReportAsset.create({
    data: {
      ownerUserId: request.authUser!.id,
      kind,
      fileName,
      mimeType,
      data: fileBytes,
      sizeBytes: fileBytes.byteLength,
    },
  });

  return response.status(201).json({
    message: kind === ElectionDayReportAssetKind.ARRIVAL_PHOTO
      ? "Arrival photo uploaded successfully."
      : "Post-counting photo uploaded successfully.",
    asset: serializeElectionDayReportAssetItem({
      id: asset.id,
      fileName: asset.fileName,
      fileUrl: buildElectionReportAssetUrl(request, asset.id),
    }),
  });
});

router.get("/election-report-assets/:assetId", requireAuth, requirePollingUnitFieldCapability, async (request, response) => {
  const assetId = Array.isArray(request.params.assetId) ? request.params.assetId[0] : request.params.assetId;
  if (!assetId) {
    return response.status(400).json({ message: "Invalid election report asset id." });
  }

  const asset = await prisma.electionDayReportAsset.findUnique({
    where: { id: assetId },
    select: {
      ownerUserId: true,
      mimeType: true,
      data: true,
      updatedAt: true,
    },
  });

  if (!asset || asset.ownerUserId !== request.authUser!.id) {
    return response.status(404).json({ message: "Election report asset was not found." });
  }

  response.setHeader("Content-Type", asset.mimeType);
  response.setHeader("Content-Length", asset.data.length.toString());
  response.setHeader("Cache-Control", "private, max-age=300");
  response.setHeader("Last-Modified", asset.updatedAt.toUTCString());
  return response.send(Buffer.from(asset.data));
});

router.get("/election-reports", requireAuth, requirePollingUnitFieldCapability, async (request, response) => {
  const reports = await prisma.electionDayReport.findMany({
    where: { agentUserId: request.authUser!.id },
    include: {
      agentUser: { select: { name: true } },
      reviewedByUser: { select: { name: true } },
    },
    orderBy: [{ reportDate: "desc" }, { createdAt: "desc" }],
    take: 20,
  });

  return response.json({
    reports: reports.map((report) =>
      serializeElectionDayReportItem({
        ...report,
        voteEntries: Array.isArray(report.voteEntriesJson) ? report.voteEntriesJson as Array<{ politicalPartyId: string; politicalPartyName: string | null; votes: number }> : [],
      }),
    ),
  });
});

router.post("/election-reports", requireAuth, requirePollingUnitFieldCapability, async (request, response) => {
  const parsed = electionDayReportSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid election report payload.", errors: parsed.error.flatten() });
  }

  const agentProfile = await getAgentProfileOrError(request.authUser!.id);
  if (!agentProfile) {
    return response.status(404).json({ message: "Agent profile was not found." });
  }

  if (!agentProfile.pollingUnitId || !agentProfile.wardId) {
    return response.status(400).json({ message: "You need an assigned polling unit before submitting an election report." });
  }
  const pollingUnitId = agentProfile.pollingUnitId;

  const territoryError = await validateTerritoryReferences({
    geoPoliticalZoneId: agentProfile.geoPoliticalZoneId || undefined,
    stateId: agentProfile.stateId,
    senatorialDistrictId: agentProfile.senatorialDistrictId || undefined,
    federalConstituencyId: agentProfile.federalConstituencyId || undefined,
    lgaId: agentProfile.lgaId,
    wardId: agentProfile.wardId,
    stateConstituencyId: agentProfile.stateConstituencyId || undefined,
    pollingUnitId,
  });

  if (territoryError) {
    return response.status(400).json({ message: territoryError });
  }

  const [arrivalAsset, postCountingAsset, voteEntries] = await Promise.all([
    ensureElectionReportAssetOwnership(request.authUser!.id, parsed.data.arrivalPhotoAssetId, ElectionDayReportAssetKind.ARRIVAL_PHOTO),
    ensureElectionReportAssetOwnership(request.authUser!.id, parsed.data.postCountingPhotoAssetId, ElectionDayReportAssetKind.POST_COUNTING_PHOTO),
    resolveElectionReportVotes(parsed.data.voteEntries),
  ]);

  if (!arrivalAsset) {
    return response.status(400).json({ message: "Arrival photo asset is invalid or unavailable." });
  }

  if (!postCountingAsset) {
    return response.status(400).json({ message: "Post-counting photo asset is invalid or unavailable." });
  }

  if (!voteEntries) {
    return response.status(400).json({ message: "Vote entries must use approved political parties only." });
  }

  const reportDate = new Date(`${parsed.data.reportDate}T00:00:00.000Z`);
  const arrivalConfirmedAt = new Date(parsed.data.arrivalConfirmedAt);

  try {
    const report = await prisma.$transaction(async (transaction) => {
      const createdReport = await transaction.electionDayReport.create({
        data: {
          agentUserId: request.authUser!.id,
          reportDate,
          status: ElectionDayReportStatus.SUBMITTED,
          openingStatus: parsed.data.openingStatus,
          arrivalConfirmedAt,
          turnoutObservation: parsed.data.turnoutObservation,
          incidentNotes: parsed.data.incidentNotes?.trim() || null,
          remarks: parsed.data.remarks?.trim() || null,
          voteEntriesJson: voteEntries,
          arrivalPhotoAssetId: parsed.data.arrivalPhotoAssetId,
          postCountingPhotoAssetId: parsed.data.postCountingPhotoAssetId,
          geoPoliticalZoneId: agentProfile.geoPoliticalZoneId,
          stateId: agentProfile.stateId,
          senatorialDistrictId: agentProfile.senatorialDistrictId,
          federalConstituencyId: agentProfile.federalConstituencyId,
          lgaId: agentProfile.lgaId,
          wardId: agentProfile.wardId,
          stateConstituencyId: agentProfile.stateConstituencyId,
          pollingUnitId,
        },
        include: {
          agentUser: { select: { name: true } },
          reviewedByUser: { select: { name: true } },
        },
      });

      await createAuditLog(transaction, {
        actorUserId: request.authUser!.id,
        action: "ELECTION_DAY_REPORT_SUBMITTED",
        targetType: "ElectionDayReport",
        targetId: createdReport.id,
        territory: createdReport,
        metadata: {
          status: createdReport.status,
          reportDate: createdReport.reportDate.toISOString(),
        },
      });

      return createdReport;
    });

    const reportTerritory = {
      stateId: report.stateId,
      senatorialDistrictId: report.senatorialDistrictId,
      federalConstituencyId: report.federalConstituencyId,
      stateConstituencyId: report.stateConstituencyId,
      wardId: report.wardId,
      pollingUnitId: report.pollingUnitId,
    };
    publishRealtimeEvent(
      createElectionDayRealtimeEvent({
        eventType: "election.report.submitted",
        actorUserId: request.authUser!.id,
        territory: reportTerritory,
        idempotencyKey: report.id,
        payload: {
          reportId: report.id,
          status: report.status,
          openingStatus: report.openingStatus,
          pollingUnitId: report.pollingUnitId,
          reportDate: report.reportDate.toISOString(),
          resultSubmitted: voteEntries.length > 0,
          evidenceReceived: Boolean(report.arrivalPhotoAssetId && report.postCountingPhotoAssetId),
        },
      }),
    );
    if (voteEntries.length > 0) {
      publishRealtimeEvent(
        createElectionDayRealtimeEvent({
          eventType: "election.result.submitted",
          actorUserId: request.authUser!.id,
          territory: reportTerritory,
          idempotencyKey: `result:${report.id}`,
          payload: {
            reportId: report.id,
            pollingUnitId: report.pollingUnitId,
            reportDate: report.reportDate.toISOString(),
          },
        }),
      );
    }
    publishRealtimeEvent(
      createElectionDayRealtimeEvent({
        eventType: "election.situation.updated",
        actorUserId: request.authUser!.id,
        territory: reportTerritory,
        idempotencyKey: `situation:${report.id}`,
        payload: { reason: "REPORT_SUBMITTED", pollingUnitId: report.pollingUnitId },
      }),
    );

    return response.status(201).json({
      message: "Election-day report submitted successfully.",
      report: serializeElectionDayReportItem({
        ...report,
        voteEntries,
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("ElectionDayReport_agentUserId_pollingUnitId_reportDate_key")) {
      return response.status(409).json({ message: "An election-day report has already been submitted for this polling unit and date." });
    }

    return response.status(400).json({ message: error instanceof Error ? error.message : "Election-day report submission failed." });
  }
});

router.get("/incident-feedback", requireAuth, requirePollingUnitFieldCapability, async (request, response) => {
  const feedback = await prisma.feedback.findMany({
    where: { agentUserId: request.authUser!.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return response.json({
    feedback: feedback.map(serializeFeedbackItem),
  });
});

router.get("/tasks", requireAuth, requirePollingUnitFieldCapability, async (request, response) => {
  const tasks = await prisma.fieldTask.findMany({
    where: { assignedToUserId: request.authUser!.id },
    include: {
      createdByUser: { select: { name: true } },
      assignedToUser: { select: { name: true } },
    },
    orderBy: [
      { status: "asc" },
      { priority: "desc" },
      { createdAt: "desc" },
    ],
    take: 50,
  });

  return response.json({
    tasks: tasks.map(serializeFieldTaskItem),
  });
});

router.patch("/tasks/:taskId", requireAuth, requirePollingUnitFieldCapability, async (request, response) => {
  const parsed = taskStatusSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid task update payload.", errors: parsed.error.flatten() });
  }

  const taskId = Array.isArray(request.params.taskId) ? request.params.taskId[0] : request.params.taskId;
  if (!taskId) {
    return response.status(400).json({ message: "Invalid task id." });
  }

  const task = await prisma.fieldTask.findUnique({
    where: { id: taskId },
    include: {
      createdByUser: { select: { name: true } },
      assignedToUser: { select: { name: true } },
    },
  });

  if (!task || task.assignedToUserId !== request.authUser!.id) {
    return response.status(404).json({ message: "Task was not found." });
  }

  const updatedTask = await prisma.$transaction(async (transaction) => {
    const nextTask = await transaction.fieldTask.update({
      where: { id: task.id },
      data: {
        status: parsed.data.status,
        resolutionNote: parsed.data.resolutionNote || null,
        completedAt: parsed.data.status === FieldTaskStatus.DONE ? new Date() : null,
      },
      include: {
        createdByUser: { select: { name: true } },
        assignedToUser: { select: { name: true } },
      },
    });

    await createNotification(transaction, {
      userId: nextTask.createdByUserId,
      type: NotificationType.SYSTEM,
      title: "Field task status updated",
      message: `${nextTask.title} is now ${nextTask.status}.`,
    });

    await createAuditLog(transaction, {
      actorUserId: request.authUser!.id,
      action: "FIELD_TASK_STATUS_UPDATED",
      targetType: "FieldTask",
      targetId: nextTask.id,
      metadata: { status: nextTask.status },
    });

    return nextTask;
  });

  return response.json({
    message: "Task updated successfully.",
    task: serializeFieldTaskItem(updatedTask),
  });
});

export default router;
