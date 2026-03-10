import { Router } from "express";
import type { Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../prisma";
import { isAdminOrSuperAdmin, isWithinAdminScope } from "../scope";

const router = Router();

const mediaSchema = z.object({
  fileName: z.string().trim().min(1),
  mimeType: z.string().trim().min(3),
  fileUrl: z.string().url(),
});

function readRouteId(response: Response, value: string | string[] | undefined, label: string): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    response.status(400).json({ message: `Invalid ${label}.` });
    return null;
  }

  return value;
}

router.post("/incidents/:incidentId", requireAuth, async (request, response) => {
  const parsed = mediaSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid incident media payload.", errors: parsed.error.flatten() });
  }

  const incidentId = readRouteId(response, request.params.incidentId, "incident id");
  if (!incidentId) {
    return;
  }

  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
  });

  if (!incident) {
    return response.status(404).json({ message: "Incident was not found." });
  }

  const actor = request.authUser!;
  const ownsIncident = incident.reportedByUserId === actor.id;
  const canManage = isAdminOrSuperAdmin(actor) && isWithinAdminScope(actor, incident);

  if (!ownsIncident && !canManage) {
    return response.status(403).json({ message: "You cannot attach media to this incident." });
  }

  const attachment = await prisma.mediaAttachment.create({
    data: {
      uploaderUserId: actor.id,
      incidentId: incident.id,
      fileName: parsed.data.fileName,
      mimeType: parsed.data.mimeType,
      fileUrl: parsed.data.fileUrl,
    },
  });

  return response.status(201).json({ message: "Incident media metadata attached.", attachment });
});

router.post("/feedback/:feedbackId", requireAuth, async (request, response) => {
  const parsed = mediaSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid feedback media payload.", errors: parsed.error.flatten() });
  }

  const feedbackId = readRouteId(response, request.params.feedbackId, "feedback id");
  if (!feedbackId) {
    return;
  }

  const feedback = await prisma.feedback.findUnique({
    where: { id: feedbackId },
  });

  if (!feedback) {
    return response.status(404).json({ message: "Feedback was not found." });
  }

  const actor = request.authUser!;
  const ownsFeedback = feedback.voterUserId === actor.id || feedback.agentUserId === actor.id;
  const canManage = isAdminOrSuperAdmin(actor) && isWithinAdminScope(actor, feedback);

  if (!ownsFeedback && !canManage) {
    return response.status(403).json({ message: "You cannot attach media to this feedback item." });
  }

  const attachment = await prisma.mediaAttachment.create({
    data: {
      uploaderUserId: actor.id,
      feedbackId: feedback.id,
      fileName: parsed.data.fileName,
      mimeType: parsed.data.mimeType,
      fileUrl: parsed.data.fileUrl,
    },
  });

  return response.status(201).json({ message: "Feedback media metadata attached.", attachment });
});

export default router;
