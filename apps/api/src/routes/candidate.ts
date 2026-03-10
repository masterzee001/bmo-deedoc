import { Router } from "express";
import { AssignmentPermissionType } from "@prisma/client";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth";
import { prisma } from "../prisma";
import { serializeFeedbackItem, serializeIncidentItem, serializePostListItem } from "../lib/serializers";
import { canViewCandidate, isAdminUser, isCandidateUser } from "../scope";
import { validateTerritoryReferences } from "../lib/territory";

const router = Router();

const postSchema = z.object({
  candidateUserId: z.string().trim().optional(),
  title: z.string().trim().min(3),
  content: z.string().trim().min(10),
  stateId: z.string().trim().optional(),
  senatorialDistrictId: z.string().trim().optional(),
  federalConstituencyId: z.string().trim().optional(),
  lgaId: z.string().trim().optional(),
  wardId: z.string().trim().optional(),
  stateConstituencyId: z.string().trim().optional(),
  pollingUnitId: z.string().trim().optional(),
  isPublished: z.boolean().optional(),
});

async function canAdminPublishForCandidate(actorId: string, candidateUserId: string) {
  const assignment = await prisma.adminCandidateAssignment.findFirst({
    where: {
      adminUserId: actorId,
      candidateUserId,
      permissionType: {
        in: [AssignmentPermissionType.MANAGE, AssignmentPermissionType.PUBLISH],
      },
    },
    select: { id: true },
  });

  return Boolean(assignment);
}

router.post("/posts", requireAuth, requireRole("CANDIDATE", "ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const parsed = postSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid post payload.", errors: parsed.error.flatten() });
  }

  const territoryReferenceError = await validateTerritoryReferences(parsed.data);
  if (territoryReferenceError) {
    return response.status(400).json({ message: territoryReferenceError });
  }

  const actor = request.authUser!;
  let candidateUserId = parsed.data.candidateUserId || null;

  if (isCandidateUser(actor)) {
    candidateUserId = actor.id;
  }

  if (!candidateUserId) {
    return response.status(400).json({ message: "candidateUserId is required for admin-authored candidate posts." });
  }

  const candidate = await prisma.user.findUnique({
    where: { id: candidateUserId },
    include: { candidateProfile: true },
  });

  if (!candidate?.candidateProfile) {
    return response.status(404).json({ message: "Candidate was not found." });
  }

  if (isCandidateUser(actor) && actor.id !== candidateUserId) {
    return response.status(403).json({ message: "You can only create posts for your own candidate profile." });
  }

  if (isAdminUser(actor)) {
    const hasPermission = await canAdminPublishForCandidate(actor.id, candidateUserId);
    if (!hasPermission || !canViewCandidate(actor, { ...candidate.candidateProfile, userId: candidate.id })) {
      return response.status(403).json({ message: "You are not authorized to publish for this candidate." });
    }
  }

  const post = await prisma.post.create({
    data: {
      authorUserId: actor.id,
      candidateUserId,
      title: parsed.data.title,
      content: parsed.data.content,
      stateId: parsed.data.stateId || candidate.candidateProfile.stateId || null,
      senatorialDistrictId: parsed.data.senatorialDistrictId || candidate.candidateProfile.senatorialDistrictId || null,
      federalConstituencyId: parsed.data.federalConstituencyId || candidate.candidateProfile.federalConstituencyId || null,
      lgaId: parsed.data.lgaId || candidate.candidateProfile.lgaId || null,
      wardId: parsed.data.wardId || candidate.candidateProfile.wardId || null,
      stateConstituencyId: parsed.data.stateConstituencyId || candidate.candidateProfile.stateConstituencyId || null,
      pollingUnitId: parsed.data.pollingUnitId || candidate.candidateProfile.pollingUnitId || null,
      isPublished: parsed.data.isPublished ?? true,
    },
  });

  return response.status(201).json({
    message: "Post created successfully.",
    post: serializePostListItem(post),
  });
});

router.get("/posts", requireAuth, requireRole("CANDIDATE"), async (request, response) => {
  const posts = await prisma.post.findMany({
    where: { authorUserId: request.authUser!.id },
    orderBy: { createdAt: "desc" },
  });

  return response.json({
    posts: posts.map(serializePostListItem),
  });
});

router.get("/feedback", requireAuth, requireRole("CANDIDATE"), async (request, response) => {
  const actor = request.authUser!;
  const candidateProfile = actor.candidateProfile;

  if (!candidateProfile) {
    return response.status(404).json({ message: "Candidate profile was not found." });
  }

  const feedback = await prisma.feedback.findMany({
    where: {
      OR: [
        { candidateUserId: actor.id },
        {
          stateId: candidateProfile.stateId || undefined,
          senatorialDistrictId: candidateProfile.senatorialDistrictId || undefined,
          lgaId: candidateProfile.lgaId || undefined,
          wardId: candidateProfile.wardId || undefined,
          pollingUnitId: candidateProfile.pollingUnitId || undefined,
        },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return response.json({
    totalFeedback: feedback.length,
    feedback: feedback.map(serializeFeedbackItem),
  });
});

router.get("/incidents", requireAuth, requireRole("CANDIDATE"), async (request, response) => {
  const actor = request.authUser!;
  const candidateProfile = actor.candidateProfile;

  if (!candidateProfile) {
    return response.status(404).json({ message: "Candidate profile was not found." });
  }

  const incidents = await prisma.incident.findMany({
    where: {
      stateId: candidateProfile.stateId || undefined,
      senatorialDistrictId: candidateProfile.senatorialDistrictId || undefined,
      lgaId: candidateProfile.lgaId || undefined,
      wardId: candidateProfile.wardId || undefined,
      pollingUnitId: candidateProfile.pollingUnitId || undefined,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return response.json({
    totalIncidents: incidents.length,
    incidents: incidents.map(serializeIncidentItem),
  });
});

export default router;
