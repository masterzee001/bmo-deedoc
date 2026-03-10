import { AgentActivityType, IncidentSeverity, IncidentStatus, IncidentType } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth";
import { prisma } from "../prisma";
import { validateTerritoryReferences } from "../lib/territory";
import { serializeFeedbackItem, serializeIncidentItem } from "../lib/serializers";

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

async function getAgentProfileOrError(userId: string) {
  return prisma.agentProfile.findUnique({
    where: { userId },
    select: {
      userId: true,
      stateId: true,
      lgaId: true,
      wardId: true,
      pollingUnitId: true,
    },
  });
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

router.post("/check-in", requireAuth, requireRole("AGENT"), async (request, response) => {
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

router.post("/check-out", requireAuth, requireRole("AGENT"), async (request, response) => {
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

router.post("/location", requireAuth, requireRole("AGENT"), async (request, response) => {
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

router.get("/activities", requireAuth, requireRole("AGENT"), async (request, response) => {
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

router.post("/incidents", requireAuth, requireRole("AGENT"), async (request, response) => {
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

router.get("/incident-feedback", requireAuth, requireRole("AGENT"), async (request, response) => {
  const feedback = await prisma.feedback.findMany({
    where: { agentUserId: request.authUser!.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return response.json({
    feedback: feedback.map(serializeFeedbackItem),
  });
});

export default router;
