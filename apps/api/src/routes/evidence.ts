import crypto from "node:crypto";
import { Router } from "express";
import {
  EvidenceClassification,
  EvidenceCustodyEventType,
  EvidenceReviewStatus,
  EvidenceType,
  LegalCaseStatus,
  Prisma,
} from "@prisma/client";
import {
  EVIDENCE_CLASSIFICATIONS,
  EVIDENCE_CUSTODY_EVENT_TYPES,
  EVIDENCE_REVIEW_STATUSES,
  EVIDENCE_TYPES,
  OGUN_STATE_ID,
  type AuthUserProfile,
  type OperationalTerritory,
} from "@pics-nigeria/shared";
import { z } from "zod";
import { authorizeAction, resolveOperationalTerritory } from "../authorization";
import { createAuditLog } from "../lib/audit";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../prisma";
import { EvidenceObjectAlreadyExistsError, getEvidenceObjectStorage } from "../storage/evidence-storage";

const router = Router();

const metadataSchema = z.record(z.unknown()).optional();

const uploadFinalizeSchema = z
  .object({
    evidenceType: z.enum(EVIDENCE_TYPES),
    classification: z.enum(EVIDENCE_CLASSIFICATIONS).default("OTHER"),
    originalFileName: z.string().trim().min(1).max(240),
    mimeType: z.string().trim().min(3).max(120),
    contentBase64: z.string().min(1),
    capturedAt: z.string().datetime().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    accuracyMeters: z.number().positive().max(5000).optional(),
    pollingUnitId: z.string().trim().optional(),
    incidentId: z.string().trim().optional(),
    electionReportId: z.string().trim().optional(),
    metadata: metadataSchema,
    derivatives: z.record(z.unknown()).optional(),
  })
  .superRefine((data, context) => {
    if (!data.pollingUnitId && !data.incidentId && !data.electionReportId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Evidence must be linked to a polling unit, incident, or election report.",
      });
    }
  });

const accessSchema = z.object({
  action: z.enum(["VIEW", "DOWNLOAD"]).default("VIEW"),
  expiresInSeconds: z.number().int().min(60).max(900).default(300),
});

const reviewSchema = z.object({
  status: z.enum(EVIDENCE_REVIEW_STATUSES),
  classification: z.enum(EVIDENCE_CLASSIFICATIONS).optional(),
  note: z.string().trim().max(1000).optional(),
});

const custodySchema = z.object({
  eventType: z.enum(EVIDENCE_CUSTODY_EVENT_TYPES),
  metadata: metadataSchema,
});

const legalCaseSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(2000).optional(),
  pollingUnitId: z.string().trim().optional(),
  evidenceAssetIds: z.array(z.string().trim().min(1)).default([]),
  note: z.string().trim().max(1000).optional(),
});

const addCaseEvidenceSchema = z.object({
  evidenceAssetId: z.string().trim().min(1),
  note: z.string().trim().max(1000).optional(),
});

const manifestExportSchema = z.object({
  evidenceAssetIds: z.array(z.string().trim().min(1)).min(1),
  legalCaseId: z.string().trim().optional(),
  purpose: z.string().trim().min(3).max(500),
});

type EvidenceTerritory = {
  geoPoliticalZoneId: string | null;
  stateId: string;
  senatorialDistrictId: string | null;
  federalConstituencyId: string | null;
  lgaId: string | null;
  wardId: string | null;
  stateConstituencyId: string | null;
  pollingUnitId: string | null;
};

function paramValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

function stateWideTerritory(): EvidenceTerritory {
  return {
    geoPoliticalZoneId: null,
    stateId: OGUN_STATE_ID,
    senatorialDistrictId: null,
    federalConstituencyId: null,
    lgaId: null,
    wardId: null,
    stateConstituencyId: null,
    pollingUnitId: null,
  };
}

function isPrivilegedEvidenceReviewer(actor: AuthUserProfile) {
  return actor.role === "SUPER_ADMIN" || actor.role === "STATE_OFFICER" || actor.role === "VALIDATOR";
}

function commandTerritory(territory: EvidenceTerritory): OperationalTerritory {
  return {
    stateId: territory.stateId,
    senatorialDistrictId: territory.senatorialDistrictId,
    federalConstituencyId: territory.federalConstituencyId,
    stateConstituencyId: territory.stateConstituencyId,
    wardId: territory.wardId,
    pollingUnitId: territory.pollingUnitId,
  };
}

async function canAccessTerritory(actor: AuthUserProfile, territory: EvidenceTerritory) {
  if (!actor.isActive || actor.accountStatus !== "ACTIVE" || territory.stateId !== OGUN_STATE_ID) {
    return false;
  }

  if (isPrivilegedEvidenceReviewer(actor)) {
    return true;
  }

  if (actor.role === "AGENT" && actor.agentProfile?.pollingUnitId) {
    return actor.agentProfile.pollingUnitId === territory.pollingUnitId;
  }

  if (actor.role === "COORDINATOR" && actor.coordinatorProfile) {
    const resolved = await resolveOperationalTerritory(prisma, commandTerritory(territory));
    return authorizeAction(actor, "VIEW_TERRITORY", resolved);
  }

  return false;
}

function evidenceWhereForActor(actor: AuthUserProfile): Prisma.EvidenceAssetWhereInput {
  if (isPrivilegedEvidenceReviewer(actor)) {
    return { stateId: OGUN_STATE_ID };
  }
  if (actor.role === "AGENT" && actor.agentProfile?.pollingUnitId) {
    return { uploaderUserId: actor.id, pollingUnitId: actor.agentProfile.pollingUnitId };
  }
  if (actor.role === "COORDINATOR" && actor.coordinatorProfile) {
    return {
      stateId: actor.coordinatorProfile.stateId || OGUN_STATE_ID,
      senatorialDistrictId: actor.coordinatorProfile.senatorialDistrictId || undefined,
      federalConstituencyId: actor.coordinatorProfile.federalConstituencyId || undefined,
      stateConstituencyId: actor.coordinatorProfile.stateConstituencyId || undefined,
      wardId: actor.coordinatorProfile.wardId || undefined,
      pollingUnitId: actor.coordinatorProfile.pollingUnitId || undefined,
    };
  }
  return { id: "__deny__" };
}

function sanitizeFileName(fileName: string) {
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").slice(0, 120);
  return sanitized || "evidence.bin";
}

function objectKey(id: string, fileName: string, now: Date) {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `election-evidence/original/${yyyy}/${mm}/${dd}/${id}-${sanitizeFileName(fileName)}`;
}

function serializeEvidence(asset: Prisma.EvidenceAssetGetPayload<{ include: { custodyEvents: true } }> | Prisma.EvidenceAssetGetPayload<object>) {
  const custodyEvents = "custodyEvents" in asset ? asset.custodyEvents : undefined;
  return {
    id: asset.id,
    evidenceType: asset.evidenceType,
    classification: asset.classification,
    reviewStatus: asset.reviewStatus,
    originalStorageKey: asset.originalStorageKey,
    storageBucket: asset.storageBucket,
    originalFileName: asset.originalFileName,
    mimeType: asset.mimeType,
    fileSize: asset.fileSize,
    sha256: asset.sha256,
    capturedAt: asset.capturedAt?.toISOString() || null,
    uploadedAt: asset.uploadedAt.toISOString(),
    serverReceivedAt: asset.serverReceivedAt.toISOString(),
    latitude: asset.latitude,
    longitude: asset.longitude,
    accuracyMeters: asset.accuracyMeters,
    metadata: asset.metadataJson,
    derivatives: asset.derivativesJson,
    uploaderUserId: asset.uploaderUserId,
    incidentId: asset.incidentId,
    electionReportId: asset.electionReportId,
    territory: {
      geoPoliticalZoneId: asset.geoPoliticalZoneId,
      stateId: asset.stateId,
      senatorialDistrictId: asset.senatorialDistrictId,
      federalConstituencyId: asset.federalConstituencyId,
      lgaId: asset.lgaId,
      wardId: asset.wardId,
      stateConstituencyId: asset.stateConstituencyId,
      pollingUnitId: asset.pollingUnitId,
    },
    custodyEvents: custodyEvents?.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      actorUserId: event.actorUserId,
      metadata: event.metadataJson,
      createdAt: event.createdAt.toISOString(),
    })),
    originalAccess: {
      publicUrl: null,
      signedAccessRequired: true,
    },
  };
}

async function territoryForPollingUnit(pollingUnitId: string): Promise<EvidenceTerritory | null> {
  const pollingUnit = await prisma.pollingUnit.findUnique({
    where: { id: pollingUnitId },
    include: {
      ward: {
        include: {
          stateConstituency: {
            include: { federalConstituency: true },
          },
        },
      },
    },
  });

  if (!pollingUnit) {
    return null;
  }

  return {
    geoPoliticalZoneId: null,
    stateId: pollingUnit.stateId,
    senatorialDistrictId: pollingUnit.ward.stateConstituency?.federalConstituency?.senatorialDistrictId || null,
    federalConstituencyId: pollingUnit.ward.stateConstituency?.federalConstituencyId || null,
    lgaId: pollingUnit.lgaId,
    wardId: pollingUnit.wardId,
    stateConstituencyId: pollingUnit.ward.stateConstituencyId,
    pollingUnitId: pollingUnit.id,
  };
}

async function resolveUploadTarget(actor: AuthUserProfile, data: z.infer<typeof uploadFinalizeSchema>) {
  let territory: EvidenceTerritory | null = null;
  let incidentId: string | null = null;
  let electionReportId: string | null = null;

  if (data.incidentId) {
    const incident = await prisma.incident.findUnique({ where: { id: data.incidentId } });
    if (!incident) {
      throw new Error("Linked incident was not found.");
    }
    territory = {
      geoPoliticalZoneId: incident.geoPoliticalZoneId,
      stateId: incident.stateId,
      senatorialDistrictId: incident.senatorialDistrictId,
      federalConstituencyId: null,
      lgaId: incident.lgaId,
      wardId: incident.wardId,
      stateConstituencyId: null,
      pollingUnitId: incident.pollingUnitId,
    };
    if (incident.pollingUnitId) {
      territory = (await territoryForPollingUnit(incident.pollingUnitId)) || territory;
    }
    incidentId = incident.id;
  }

  if (data.electionReportId) {
    const report = await prisma.electionDayReport.findUnique({ where: { id: data.electionReportId } });
    if (!report) {
      throw new Error("Linked election report was not found.");
    }
    const reportTerritory = {
      geoPoliticalZoneId: report.geoPoliticalZoneId,
      stateId: report.stateId,
      senatorialDistrictId: report.senatorialDistrictId,
      federalConstituencyId: report.federalConstituencyId,
      lgaId: report.lgaId,
      wardId: report.wardId,
      stateConstituencyId: report.stateConstituencyId,
      pollingUnitId: report.pollingUnitId,
    };
    if (territory?.pollingUnitId && territory.pollingUnitId !== reportTerritory.pollingUnitId) {
      throw new Error("Evidence links must resolve to the same Polling Unit.");
    }
    territory = reportTerritory;
    electionReportId = report.id;
  }

  if (data.pollingUnitId) {
    const pollingUnitTerritory = await territoryForPollingUnit(data.pollingUnitId);
    if (!pollingUnitTerritory) {
      throw new Error("Linked Polling Unit was not found.");
    }
    if (territory?.pollingUnitId && territory.pollingUnitId !== pollingUnitTerritory.pollingUnitId) {
      throw new Error("Evidence links must resolve to the same Polling Unit.");
    }
    territory = pollingUnitTerritory;
  }

  if (!territory) {
    throw new Error("Evidence target could not be resolved.");
  }

  if (!(await canAccessTerritory(actor, territory))) {
    throw new Error("You cannot attach evidence outside your authorized territory.");
  }

  return { territory, incidentId, electionReportId };
}

function validateEvidenceContent(evidenceType: EvidenceType, mimeType: string, body: Buffer) {
  if (body.byteLength > 8 * 1024 * 1024) {
    return "Evidence finalization payload exceeds the API foundation limit.";
  }
  if (evidenceType === "PHOTO" && !["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
    return "PHOTO evidence must be JPEG, PNG, or WebP.";
  }
  if (evidenceType === "VIDEO" && !["video/mp4", "video/webm", "video/quicktime"].includes(mimeType)) {
    return "VIDEO evidence must be MP4, WebM, or QuickTime.";
  }
  if (
    evidenceType === "WRITTEN_REPORT" &&
    !["text/plain", "application/json", "application/pdf"].includes(mimeType)
  ) {
    return "WRITTEN_REPORT evidence must be text, JSON, or PDF.";
  }
  return null;
}

async function loadEvidenceForActor(actor: AuthUserProfile, evidenceAssetId: string) {
  const asset = await prisma.evidenceAsset.findUnique({ where: { id: evidenceAssetId }, include: { custodyEvents: true } });
  if (!asset) {
    return null;
  }
  const territory = {
    geoPoliticalZoneId: asset.geoPoliticalZoneId,
    stateId: asset.stateId,
    senatorialDistrictId: asset.senatorialDistrictId,
    federalConstituencyId: asset.federalConstituencyId,
    lgaId: asset.lgaId,
    wardId: asset.wardId,
    stateConstituencyId: asset.stateConstituencyId,
    pollingUnitId: asset.pollingUnitId,
  };
  return (await canAccessTerritory(actor, territory)) ? asset : null;
}

router.get("/storage/health", requireAuth, async (request, response) => {
  if (!isPrivilegedEvidenceReviewer(request.authUser!)) {
    return response.status(403).json({ message: "Evidence storage health requires reviewer access." });
  }
  const storage = getEvidenceObjectStorage();
  return response.json({
    storage: {
      runtime: storage.runtime,
      bucket: storage.bucket,
      authoritativeEvidenceFilesystem: false,
      originalOverwritePolicy: "DENY_IF_OBJECT_EXISTS",
      signedAccessRequired: true,
    },
  });
});

router.post("/uploads/finalize", requireAuth, async (request, response) => {
  const parsed = uploadFinalizeSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid evidence upload finalization payload.", errors: parsed.error.flatten() });
  }

  let body: Buffer;
  try {
    body = Buffer.from(parsed.data.contentBase64, "base64");
  } catch {
    return response.status(400).json({ message: "Evidence content must be valid base64." });
  }
  if (body.byteLength === 0) {
    return response.status(400).json({ message: "Evidence content is empty." });
  }

  const contentError = validateEvidenceContent(parsed.data.evidenceType as EvidenceType, parsed.data.mimeType, body);
  if (contentError) {
    return response.status(400).json({ message: contentError });
  }

  try {
    const { territory, incidentId, electionReportId } = await resolveUploadTarget(request.authUser!, parsed.data);
    const now = new Date();
    const evidenceId = crypto.randomUUID();
    const key = objectKey(evidenceId, parsed.data.originalFileName, now);
    const sha256 = crypto.createHash("sha256").update(body).digest("hex");
    const storage = getEvidenceObjectStorage();
    const stored = await storage.putObjectIfAbsent({
      key,
      body,
      contentType: parsed.data.mimeType,
      metadata: {
        evidenceId,
        sha256,
        uploaderUserId: request.authUser!.id,
      },
    });

    if (stored.sha256 !== sha256) {
      return response.status(500).json({ message: "Stored object hash did not match server hash." });
    }

    const asset = await prisma.$transaction(async (transaction) => {
      const created = await transaction.evidenceAsset.create({
        data: {
          id: evidenceId,
          evidenceType: parsed.data.evidenceType as EvidenceType,
          classification: parsed.data.classification as EvidenceClassification,
          reviewStatus: EvidenceReviewStatus.SUBMITTED,
          originalStorageKey: key,
          storageBucket: storage.bucket,
          originalFileName: parsed.data.originalFileName,
          mimeType: parsed.data.mimeType,
          fileSize: body.byteLength,
          sha256,
          capturedAt: parsed.data.capturedAt ? new Date(parsed.data.capturedAt) : null,
          uploadedAt: now,
          serverReceivedAt: now,
          latitude: parsed.data.latitude ?? null,
          longitude: parsed.data.longitude ?? null,
          accuracyMeters: parsed.data.accuracyMeters ?? null,
          metadataJson: toInputJson({
            ...(parsed.data.metadata || {}),
            storageRuntime: storage.runtime,
            authoritativeOriginalLocation: "private-object-storage",
          }),
          derivativesJson: toInputJson(parsed.data.derivatives || {
            derivativeWorkerStatus: "TARGET_LATER",
            derivatives: [],
          }),
          uploaderUserId: request.authUser!.id,
          incidentId,
          electionReportId,
          ...territory,
        },
      });
      await transaction.evidenceCustodyEvent.create({
        data: {
          evidenceAssetId: created.id,
          actorUserId: request.authUser!.id,
          eventType: EvidenceCustodyEventType.UPLOADED,
          metadataJson: {
            originalStorageKey: key,
            sha256,
            serverReceivedAt: now.toISOString(),
            noSilentOverwrite: true,
          },
        },
      });
      await createAuditLog(transaction, {
        actorUserId: request.authUser!.id,
        action: "EVIDENCE_UPLOADED",
        targetType: "EvidenceAsset",
        targetId: created.id,
        territory,
        metadata: { evidenceType: created.evidenceType, sha256, storageRuntime: storage.runtime },
      });
      return created;
    });

    return response.status(201).json({ message: "Evidence original accepted into private storage.", evidence: serializeEvidence(asset) });
  } catch (error) {
    if (error instanceof EvidenceObjectAlreadyExistsError) {
      return response.status(409).json({ message: "Evidence object key already exists; silent overwrite denied." });
    }
    return response.status(400).json({ message: error instanceof Error ? error.message : "Evidence upload finalization failed." });
  }
});

router.get("/:evidenceAssetId", requireAuth, async (request, response) => {
  const evidenceAssetId = paramValue(request.params.evidenceAssetId);
  const asset = await loadEvidenceForActor(request.authUser!, evidenceAssetId);
  if (!asset) {
    return response.status(404).json({ message: "Evidence asset was not found." });
  }
  return response.json({ evidence: serializeEvidence(asset) });
});

router.post("/:evidenceAssetId/access", requireAuth, async (request, response) => {
  const parsed = accessSchema.safeParse(request.body || {});
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid evidence access payload.", errors: parsed.error.flatten() });
  }

  const evidenceAssetId = paramValue(request.params.evidenceAssetId);
  const asset = await loadEvidenceForActor(request.authUser!, evidenceAssetId);
  if (!asset) {
    return response.status(404).json({ message: "Evidence asset was not found." });
  }

  const storage = getEvidenceObjectStorage();
  const stored = await storage.getObject(asset.originalStorageKey);
  if (!stored || stored.sha256 !== asset.sha256) {
    return response.status(409).json({ message: "Evidence original failed storage integrity verification." });
  }
  const signed = await storage.createSignedGetUrl(asset.originalStorageKey, parsed.data.expiresInSeconds);
  const eventType = parsed.data.action === "DOWNLOAD" ? EvidenceCustodyEventType.DOWNLOADED : EvidenceCustodyEventType.VIEWED;

  await prisma.$transaction(async (transaction) => {
    await transaction.evidenceCustodyEvent.create({
      data: {
        evidenceAssetId: asset.id,
        actorUserId: request.authUser!.id,
        eventType,
        metadataJson: {
          action: parsed.data.action,
          expiresAt: signed.expiresAt.toISOString(),
          verifiedSha256: stored.sha256,
        },
      },
    });
    await createAuditLog(transaction, {
      actorUserId: request.authUser!.id,
      action: `EVIDENCE_${parsed.data.action}`,
      targetType: "EvidenceAsset",
      targetId: asset.id,
      territory: asset,
      metadata: { expiresAt: signed.expiresAt.toISOString(), custodyEventType: eventType },
    });
  });

  return response.json({
    access: {
      signedUrl: signed.url,
      expiresAt: signed.expiresAt.toISOString(),
      publicUrl: null,
      storageKey: asset.originalStorageKey,
    },
  });
});

router.post("/:evidenceAssetId/review", requireAuth, async (request, response) => {
  if (!isPrivilegedEvidenceReviewer(request.authUser!)) {
    return response.status(403).json({ message: "Evidence review requires reviewer access." });
  }
  const parsed = reviewSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid evidence review payload.", errors: parsed.error.flatten() });
  }
  const evidenceAssetId = paramValue(request.params.evidenceAssetId);
  const existing = await loadEvidenceForActor(request.authUser!, evidenceAssetId);
  if (!existing) {
    return response.status(404).json({ message: "Evidence asset was not found." });
  }

  const updated = await prisma.$transaction(async (transaction) => {
    const asset = await transaction.evidenceAsset.update({
      where: { id: existing.id },
      data: {
        reviewStatus: parsed.data.status as EvidenceReviewStatus,
        classification: parsed.data.classification as EvidenceClassification | undefined,
      },
    });
    await transaction.evidenceCustodyEvent.create({
      data: {
        evidenceAssetId: asset.id,
        actorUserId: request.authUser!.id,
        eventType: parsed.data.classification ? EvidenceCustodyEventType.CLASSIFIED : EvidenceCustodyEventType.REVIEWED,
        metadataJson: {
          previousStatus: existing.reviewStatus,
          nextStatus: asset.reviewStatus,
          classification: asset.classification,
          note: parsed.data.note || null,
        },
      },
    });
    await createAuditLog(transaction, {
      actorUserId: request.authUser!.id,
      action: "EVIDENCE_REVIEWED",
      targetType: "EvidenceAsset",
      targetId: asset.id,
      territory: asset,
      metadata: { status: asset.reviewStatus, classification: asset.classification },
    });
    return asset;
  });

  return response.json({ message: "Evidence review state updated.", evidence: serializeEvidence(updated) });
});

router.post("/:evidenceAssetId/custody-events", requireAuth, async (request, response) => {
  if (!isPrivilegedEvidenceReviewer(request.authUser!)) {
    return response.status(403).json({ message: "Manual custody events require reviewer access." });
  }
  const parsed = custodySchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid custody event payload.", errors: parsed.error.flatten() });
  }
  const evidenceAssetId = paramValue(request.params.evidenceAssetId);
  const asset = await loadEvidenceForActor(request.authUser!, evidenceAssetId);
  if (!asset) {
    return response.status(404).json({ message: "Evidence asset was not found." });
  }
  const event = await prisma.evidenceCustodyEvent.create({
    data: {
      evidenceAssetId: asset.id,
      actorUserId: request.authUser!.id,
      eventType: parsed.data.eventType as EvidenceCustodyEventType,
      metadataJson: toInputJson(parsed.data.metadata || {}),
    },
  });
  return response.status(201).json({ custodyEvent: event });
});

router.get("/polling-units/:pollingUnitId/timeline", requireAuth, async (request, response) => {
  const pollingUnitId = paramValue(request.params.pollingUnitId);
  const territory = await territoryForPollingUnit(pollingUnitId);
  if (!territory || !(await canAccessTerritory(request.authUser!, territory))) {
    return response.status(404).json({ message: "Polling Unit evidence timeline was not found." });
  }
  if (!territory.pollingUnitId) {
    return response.status(404).json({ message: "Polling Unit evidence timeline was not found." });
  }

  const [activities, incidents, reports, evidence] = await Promise.all([
    prisma.agentActivity.findMany({ where: { pollingUnitId: territory.pollingUnitId }, orderBy: { createdAt: "asc" }, take: 200 }),
    prisma.incident.findMany({ where: { pollingUnitId: territory.pollingUnitId }, orderBy: { createdAt: "asc" }, take: 200 }),
    prisma.electionDayReport.findMany({ where: { pollingUnitId: territory.pollingUnitId }, orderBy: { createdAt: "asc" }, take: 200 }),
    prisma.evidenceAsset.findMany({ where: { pollingUnitId: territory.pollingUnitId }, orderBy: { serverReceivedAt: "asc" }, take: 200 }),
  ]);

  const timeline = [
    ...activities.map((item) => ({ type: "ACTIVITY", occurredAt: item.createdAt.toISOString(), id: item.id, label: item.type })),
    ...incidents.map((item) => ({ type: "INCIDENT", occurredAt: item.createdAt.toISOString(), id: item.id, label: item.title })),
    ...reports.map((item) => ({ type: "ELECTION_REPORT", occurredAt: item.createdAt.toISOString(), id: item.id, label: item.status })),
    ...evidence.map((item) => ({ type: "EVIDENCE", occurredAt: item.serverReceivedAt.toISOString(), id: item.id, label: item.classification, sha256: item.sha256 })),
  ].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));

  return response.json({ pollingUnitId, timeline });
});

router.get("/polling-units/:pollingUnitId/dossier", requireAuth, async (request, response) => {
  const pollingUnitId = paramValue(request.params.pollingUnitId);
  const territory = await territoryForPollingUnit(pollingUnitId);
  if (!territory || !(await canAccessTerritory(request.authUser!, territory))) {
    return response.status(404).json({ message: "Polling Unit evidence dossier was not found." });
  }
  if (!territory.pollingUnitId) {
    return response.status(404).json({ message: "Polling Unit evidence dossier was not found." });
  }

  const [pollingUnit, evidence, incidents, reports, custodyEvents] = await Promise.all([
    prisma.pollingUnit.findUnique({ where: { id: pollingUnitId } }),
    prisma.evidenceAsset.findMany({ where: { pollingUnitId }, orderBy: { serverReceivedAt: "asc" } }),
    prisma.incident.findMany({ where: { pollingUnitId }, orderBy: { createdAt: "asc" } }),
    prisma.electionDayReport.findMany({ where: { pollingUnitId }, orderBy: { createdAt: "asc" } }),
    prisma.evidenceCustodyEvent.findMany({
      where: { evidenceAsset: { pollingUnitId } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return response.json({
    dossier: {
      pollingUnit,
      territory,
      completeness: {
        evidenceCount: evidence.length,
        photoCount: evidence.filter((item) => item.evidenceType === "PHOTO").length,
        videoCount: evidence.filter((item) => item.evidenceType === "VIDEO").length,
        writtenReportCount: evidence.filter((item) => item.evidenceType === "WRITTEN_REPORT").length,
        incidentCount: incidents.length,
        reportCount: reports.length,
        custodyEventCount: custodyEvents.length,
      },
      evidence: evidence.map(serializeEvidence),
      incidents,
      reports,
      custodyEvents,
      legalConclusion: null,
    },
  });
});

router.post("/legal-cases", requireAuth, async (request, response) => {
  if (!isPrivilegedEvidenceReviewer(request.authUser!)) {
    return response.status(403).json({ message: "Legal-support workspaces require reviewer access." });
  }
  const parsed = legalCaseSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid legal case payload.", errors: parsed.error.flatten() });
  }
  const territory = parsed.data.pollingUnitId ? await territoryForPollingUnit(parsed.data.pollingUnitId) : stateWideTerritory();
  if (!territory || !(await canAccessTerritory(request.authUser!, territory))) {
    return response.status(400).json({ message: "Legal case territory is invalid or unauthorized." });
  }
  const evidence = parsed.data.evidenceAssetIds.length
    ? await prisma.evidenceAsset.findMany({ where: { id: { in: parsed.data.evidenceAssetIds }, ...evidenceWhereForActor(request.authUser!) } })
    : [];
  if (evidence.length !== parsed.data.evidenceAssetIds.length) {
    return response.status(400).json({ message: "One or more evidence assets are unavailable for this legal case." });
  }

  const legalCase = await prisma.$transaction(async (transaction) => {
    const created = await transaction.legalCase.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description || null,
        status: LegalCaseStatus.OPEN,
        createdByUserId: request.authUser!.id,
        ...territory,
        evidenceLinks: {
          create: evidence.map((asset) => ({
            evidenceAssetId: asset.id,
            addedByUserId: request.authUser!.id,
            note: parsed.data.note || null,
          })),
        },
      },
      include: { evidenceLinks: true },
    });
    for (const asset of evidence) {
      await transaction.evidenceCustodyEvent.create({
        data: {
          evidenceAssetId: asset.id,
          actorUserId: request.authUser!.id,
          eventType: EvidenceCustodyEventType.ADDED_TO_CASE,
          metadataJson: { legalCaseId: created.id, note: parsed.data.note || null },
        },
      });
    }
    await createAuditLog(transaction, {
      actorUserId: request.authUser!.id,
      action: "LEGAL_CASE_CREATED",
      targetType: "LegalCase",
      targetId: created.id,
      territory,
      metadata: { evidenceCount: evidence.length },
    });
    return created;
  });

  return response.status(201).json({ legalCase, noLegalConclusion: true });
});

router.post("/legal-cases/:legalCaseId/evidence", requireAuth, async (request, response) => {
  if (!isPrivilegedEvidenceReviewer(request.authUser!)) {
    return response.status(403).json({ message: "Legal-support evidence association requires reviewer access." });
  }
  const parsed = addCaseEvidenceSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid legal evidence payload.", errors: parsed.error.flatten() });
  }
  const legalCaseId = paramValue(request.params.legalCaseId);
  const legalCase = await prisma.legalCase.findUnique({ where: { id: legalCaseId } });
  const asset = await loadEvidenceForActor(request.authUser!, parsed.data.evidenceAssetId);
  if (!legalCase || !asset) {
    return response.status(404).json({ message: "Legal case or evidence asset was not found." });
  }
  const link = await prisma.$transaction(async (transaction) => {
    const created = await transaction.caseEvidence.create({
      data: {
        legalCaseId: legalCase.id,
        evidenceAssetId: asset.id,
        addedByUserId: request.authUser!.id,
        note: parsed.data.note || null,
      },
    });
    await transaction.evidenceCustodyEvent.create({
      data: {
        evidenceAssetId: asset.id,
        actorUserId: request.authUser!.id,
        eventType: EvidenceCustodyEventType.ADDED_TO_CASE,
        metadataJson: { legalCaseId: legalCase.id, note: parsed.data.note || null },
      },
    });
    return created;
  });
  return response.status(201).json({ caseEvidence: link });
});

router.post("/exports/manifest", requireAuth, async (request, response) => {
  if (!isPrivilegedEvidenceReviewer(request.authUser!)) {
    return response.status(403).json({ message: "Evidence manifest export requires reviewer access." });
  }
  const parsed = manifestExportSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid manifest export payload.", errors: parsed.error.flatten() });
  }
  const evidence = await prisma.evidenceAsset.findMany({
    where: { id: { in: parsed.data.evidenceAssetIds }, ...evidenceWhereForActor(request.authUser!) },
    orderBy: { serverReceivedAt: "asc" },
  });
  if (evidence.length !== new Set(parsed.data.evidenceAssetIds).size) {
    return response.status(400).json({ message: "One or more evidence assets are unavailable for export." });
  }
  const legalCase = parsed.data.legalCaseId
    ? await prisma.legalCase.findUnique({ where: { id: parsed.data.legalCaseId } })
    : null;
  if (parsed.data.legalCaseId && !legalCase) {
    return response.status(404).json({ message: "Legal case was not found." });
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    purpose: parsed.data.purpose,
    legalCaseId: legalCase?.id || null,
    archivePackagingStatus: "TARGET_LATER_MANIFEST_ONLY",
    items: evidence.map((asset) => ({
      evidenceAssetId: asset.id,
      evidenceType: asset.evidenceType,
      classification: asset.classification,
      reviewStatus: asset.reviewStatus,
      sha256: asset.sha256,
      originalStorageKey: asset.originalStorageKey,
      storageBucket: asset.storageBucket,
      originalFileName: asset.originalFileName,
      mimeType: asset.mimeType,
      fileSize: asset.fileSize,
      serverReceivedAt: asset.serverReceivedAt.toISOString(),
      pollingUnitId: asset.pollingUnitId,
      incidentId: asset.incidentId,
      electionReportId: asset.electionReportId,
      uploaderUserId: asset.uploaderUserId,
    })),
  };
  const manifestText = JSON.stringify(manifest);
  const manifestSha256 = crypto.createHash("sha256").update(manifestText).digest("hex");

  const evidencePackage = await prisma.$transaction(async (transaction) => {
    const created = await transaction.evidencePackage.create({
      data: {
        legalCaseId: legalCase?.id || null,
        createdByUserId: request.authUser!.id,
        manifestJson: manifest,
        manifestSha256,
        itemCount: evidence.length,
        items: {
          create: evidence.map((asset) => ({
            evidenceAssetId: asset.id,
            manifestEntryJson: manifest.items.find((item) => item.evidenceAssetId === asset.id) || {},
          })),
        },
      },
      include: { items: true },
    });
    for (const asset of evidence) {
      await transaction.evidenceCustodyEvent.create({
        data: {
          evidenceAssetId: asset.id,
          actorUserId: request.authUser!.id,
          eventType: EvidenceCustodyEventType.EXPORTED,
          metadataJson: { evidencePackageId: created.id, manifestSha256, purpose: parsed.data.purpose },
        },
      });
    }
    await createAuditLog(transaction, {
      actorUserId: request.authUser!.id,
      action: "EVIDENCE_MANIFEST_EXPORTED",
      targetType: "EvidencePackage",
      targetId: created.id,
      territory: { stateId: OGUN_STATE_ID },
      metadata: { itemCount: evidence.length, manifestSha256, legalCaseId: legalCase?.id || null },
    });
    return created;
  });

  return response.status(201).json({
    evidencePackage: {
      id: evidencePackage.id,
      itemCount: evidencePackage.itemCount,
      manifestSha256: evidencePackage.manifestSha256,
      createdAt: evidencePackage.createdAt.toISOString(),
    },
    manifest,
  });
});

export default router;
