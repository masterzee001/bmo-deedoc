import { Router } from "express";
import type { Response } from "express";
import { AssignmentPermissionType, BroadcastAudience, NotificationType, Prisma, UserRole } from "@prisma/client";
import { z } from "zod";
import { CAMPAIGN_MEDIA_TYPES, type CampaignMediaType } from "@pics-nigeria/shared";
import { requireAuth, requireRole } from "../middleware/auth";
import { createNotification } from "../lib/notifications";
import { prisma } from "../prisma";
import {
  serializeBroadcastMessageItem,
  serializeCandidateProfileEditorItem,
  serializeCandidatePublicListItem,
  serializeCandidatePublicProfile,
  serializeFeedbackItem,
  serializeIncidentItem,
  serializePostListItem,
  serializeTerritory,
} from "../lib/serializers";
import { canViewCandidate, isAdminUser, isCandidateUser } from "../scope";
import { validateTerritoryReferences } from "../lib/territory";

const router = Router();

const campaignMediaTypeSchema = z.enum(CAMPAIGN_MEDIA_TYPES);

const candidatePostBaseSchema = z.object({
  candidateUserId: z.string().trim().optional(),
  title: z.string().trim().min(3),
  content: z.string().trim().min(3),
  mediaType: campaignMediaTypeSchema.optional(),
  mediaUrl: z.string().url().optional().or(z.literal("")),
  thumbnailUrl: z.string().url().optional().or(z.literal("")),
  isPublished: z.boolean().optional(),
  audience: z.enum(["VOTERS", "AGENTS", "ALL"]).optional(),
});

const postSchema = candidatePostBaseSchema.superRefine((data, context) => {
  const mediaUrl = typeof data.mediaUrl === "string" ? data.mediaUrl.trim() : "";
  if ((data.mediaType === "IMAGE" || data.mediaType === "VIDEO" || data.mediaType === "DOCUMENT") && !mediaUrl) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "mediaUrl is required for image, video, and document campaign materials.",
      path: ["mediaUrl"],
    });
  }
});

const candidateProfileSchema = z.object({
  portraitUrl: z.string().url().optional().or(z.literal("")),
  campaignSlogan: z.string().trim().max(160).optional().or(z.literal("")),
  bio: z.string().trim().max(2000).optional().or(z.literal("")),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  facebookUrl: z.string().url().optional().or(z.literal("")),
  instagramUrl: z.string().url().optional().or(z.literal("")),
  xUrl: z.string().url().optional().or(z.literal("")),
  isProfilePublished: z.boolean(),
});

const candidatePostUpdateSchema = z.object({
  title: z.string().trim().min(3).optional(),
  content: z.string().trim().min(3).optional(),
  mediaType: campaignMediaTypeSchema.optional(),
  mediaUrl: z.string().url().optional().or(z.literal("")),
  thumbnailUrl: z.string().url().optional().or(z.literal("")),
  isPublished: z.boolean().optional(),
}).superRefine((data, context) => {
  const mediaUrl = typeof data.mediaUrl === "string" ? data.mediaUrl.trim() : "";
  if ((data.mediaType === "IMAGE" || data.mediaType === "VIDEO" || data.mediaType === "DOCUMENT") && !mediaUrl) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "mediaUrl is required for image, video, and document campaign materials.",
      path: ["mediaUrl"],
    });
  }
});

const publicCandidateQuerySchema = z.object({
  search: z.string().trim().optional(),
  stateId: z.string().trim().optional(),
  officeType: z.enum(["PRESIDENTIAL", "GOVERNORSHIP", "SENATE", "HOUSE_OF_REP", "STATE_ASSEMBLY", "CHAIRMANSHIP", "COUNCILLOR"]).optional(),
});

const candidateBroadcastSchema = z.object({
  title: z.string().trim().min(3),
  message: z.string().trim().min(10),
});

function buildCandidateScope(candidateProfile: NonNullable<Express.Request["authUser"]>["candidateProfile"]) {
  return {
    geoPoliticalZoneId: candidateProfile?.geoPoliticalZoneId || undefined,
    stateId: candidateProfile?.stateId || undefined,
    senatorialDistrictId: candidateProfile?.senatorialDistrictId || undefined,
    federalConstituencyId: candidateProfile?.federalConstituencyId || undefined,
    lgaId: candidateProfile?.lgaId || undefined,
    wardId: candidateProfile?.wardId || undefined,
    stateConstituencyId: candidateProfile?.stateConstituencyId || undefined,
    pollingUnitId: candidateProfile?.pollingUnitId || undefined,
  };
}

function readRouteId(response: Response, value: string | string[] | undefined, label: string): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    response.status(400).json({ message: `Invalid ${label}.` });
    return null;
  }

  return value;
}

function maskEmail(value: string): string {
  const [localPart, domain] = value.split("@");
  if (!localPart || !domain) {
    return value;
  }

  return `${localPart.slice(0, 2)}${"*".repeat(Math.max(localPart.length - 2, 2))}@${domain}`;
}

function maskPhone(value: string | null): string {
  if (!value) {
    return "Not provided";
  }

  const digits = value.replace(/\s+/g, "");
  if (digits.length <= 4) {
    return "*".repeat(digits.length);
  }

  return `${"*".repeat(Math.max(digits.length - 4, 4))}${digits.slice(-4)}`;
}

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

function toNullableString(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

const candidatePublicInclude = {
  candidateProfile: {
    include: {
      politicalParty: {
        select: { id: true, name: true, code: true, logoUrl: true },
      },
      geoPoliticalZone: { select: { name: true } },
      state: { select: { name: true } },
      senatorialDistrict: { select: { name: true } },
      federalConstituency: { select: { name: true } },
      lga: { select: { name: true } },
      ward: { select: { name: true } },
      stateConstituency: { select: { name: true } },
      pollingUnit: { select: { name: true } },
    },
  },
} satisfies Prisma.UserInclude;

type CandidateScopedProfile = {
  geoPoliticalZoneId: string | null;
  stateId: string | null;
  senatorialDistrictId: string | null;
  federalConstituencyId: string | null;
  lgaId: string | null;
  wardId: string | null;
  stateConstituencyId: string | null;
  pollingUnitId: string | null;
};

function buildCandidateMaterialTerritory(candidateProfile: CandidateScopedProfile) {
  return {
    geoPoliticalZoneId: candidateProfile.geoPoliticalZoneId || null,
    stateId: candidateProfile.stateId || null,
    senatorialDistrictId: candidateProfile.senatorialDistrictId || null,
    federalConstituencyId: candidateProfile.federalConstituencyId || null,
    lgaId: candidateProfile.lgaId || null,
    wardId: candidateProfile.wardId || null,
    stateConstituencyId: candidateProfile.stateConstituencyId || null,
    pollingUnitId: candidateProfile.pollingUnitId || null,
  };
}

async function getAuthorizedCandidateForPublishing(actor: NonNullable<Express.Request["authUser"]>, candidateUserId: string) {
  const candidate = await prisma.user.findUnique({
    where: { id: candidateUserId },
    include: { candidateProfile: true },
  });

  if (!candidate?.candidateProfile) {
    return { error: "Candidate was not found." as const };
  }

  if (isCandidateUser(actor) && actor.id !== candidateUserId) {
    return { error: "You can only manage your own candidate profile." as const };
  }

  if (isAdminUser(actor)) {
    const hasPermission = await canAdminPublishForCandidate(actor.id, candidateUserId);
    if (!hasPermission || !canViewCandidate(actor, { ...candidate.candidateProfile, userId: candidate.id })) {
      return { error: "You are not authorized to manage this candidate." as const };
    }
  }

  return { candidate };
}

router.get("/public", async (request, response) => {
  const parsed = publicCandidateQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid candidate discovery query.", errors: parsed.error.flatten() });
  }

  const candidates = await prisma.user.findMany({
    where: {
      role: UserRole.CANDIDATE,
      isActive: true,
      name: parsed.data.search
        ? {
            contains: parsed.data.search,
            mode: "insensitive",
          }
        : undefined,
      candidateProfile: {
        is: {
          isProfilePublished: true,
          stateId: parsed.data.stateId || undefined,
          officeType: parsed.data.officeType || undefined,
        },
      },
    },
    include: candidatePublicInclude,
    orderBy: { name: "asc" },
    take: 100,
  });

  return response.json({
    candidates: candidates
      .filter((candidate) => candidate.candidateProfile)
      .map((candidate) =>
        serializeCandidatePublicListItem({
          userId: candidate.id,
          name: candidate.name,
          officeType: candidate.candidateProfile!.officeType,
          portraitUrl: candidate.candidateProfile!.portraitUrl,
          campaignSlogan: candidate.candidateProfile!.campaignSlogan,
          bio: candidate.candidateProfile!.bio,
          isProfilePublished: candidate.candidateProfile!.isProfilePublished,
          politicalParty: candidate.candidateProfile!.politicalParty,
          geoPoliticalZoneId: candidate.candidateProfile!.geoPoliticalZoneId,
          stateId: candidate.candidateProfile!.stateId,
          senatorialDistrictId: candidate.candidateProfile!.senatorialDistrictId,
          federalConstituencyId: candidate.candidateProfile!.federalConstituencyId,
          lgaId: candidate.candidateProfile!.lgaId,
          wardId: candidate.candidateProfile!.wardId,
          stateConstituencyId: candidate.candidateProfile!.stateConstituencyId,
          pollingUnitId: candidate.candidateProfile!.pollingUnitId,
          geoPoliticalZone: candidate.candidateProfile!.geoPoliticalZone,
          state: candidate.candidateProfile!.state,
          senatorialDistrict: candidate.candidateProfile!.senatorialDistrict,
          federalConstituency: candidate.candidateProfile!.federalConstituency,
          lga: candidate.candidateProfile!.lga,
          ward: candidate.candidateProfile!.ward,
          stateConstituency: candidate.candidateProfile!.stateConstituency,
          pollingUnit: candidate.candidateProfile!.pollingUnit,
        }),
      ),
  });
});

router.get("/public/:candidateUserId", async (request, response) => {
  const candidateUserId = readRouteId(response, request.params.candidateUserId, "candidate user id");
  if (!candidateUserId) {
    return;
  }

  const candidate = await prisma.user.findUnique({
    where: { id: candidateUserId },
    include: candidatePublicInclude,
  });

  if (!candidate?.candidateProfile || !candidate.isActive || !candidate.candidateProfile.isProfilePublished) {
    return response.status(404).json({ message: "Published candidate profile was not found." });
  }

  const materials = await prisma.post.findMany({
    where: {
      candidateUserId,
      isPublished: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return response.json({
    candidate: serializeCandidatePublicProfile({
      userId: candidate.id,
      name: candidate.name,
      officeType: candidate.candidateProfile.officeType,
      portraitUrl: candidate.candidateProfile.portraitUrl,
      campaignSlogan: candidate.candidateProfile.campaignSlogan,
      bio: candidate.candidateProfile.bio,
      websiteUrl: candidate.candidateProfile.websiteUrl,
      facebookUrl: candidate.candidateProfile.facebookUrl,
      instagramUrl: candidate.candidateProfile.instagramUrl,
      xUrl: candidate.candidateProfile.xUrl,
      isProfilePublished: candidate.candidateProfile.isProfilePublished,
      politicalParty: candidate.candidateProfile.politicalParty,
      geoPoliticalZoneId: candidate.candidateProfile.geoPoliticalZoneId,
      stateId: candidate.candidateProfile.stateId,
      senatorialDistrictId: candidate.candidateProfile.senatorialDistrictId,
      federalConstituencyId: candidate.candidateProfile.federalConstituencyId,
      lgaId: candidate.candidateProfile.lgaId,
      wardId: candidate.candidateProfile.wardId,
      stateConstituencyId: candidate.candidateProfile.stateConstituencyId,
      pollingUnitId: candidate.candidateProfile.pollingUnitId,
      geoPoliticalZone: candidate.candidateProfile.geoPoliticalZone,
      state: candidate.candidateProfile.state,
      senatorialDistrict: candidate.candidateProfile.senatorialDistrict,
      federalConstituency: candidate.candidateProfile.federalConstituency,
      lga: candidate.candidateProfile.lga,
      ward: candidate.candidateProfile.ward,
      stateConstituency: candidate.candidateProfile.stateConstituency,
      pollingUnit: candidate.candidateProfile.pollingUnit,
      materials,
    }),
  });
});

router.get("/profile", requireAuth, requireRole("CANDIDATE"), async (request, response) => {
  const candidate = await prisma.user.findUnique({
    where: { id: request.authUser!.id },
    include: { candidateProfile: true },
  });

  if (!candidate?.candidateProfile) {
    return response.status(404).json({ message: "Candidate profile was not found." });
  }

  return response.json({
    profile: serializeCandidateProfileEditorItem({
      userId: candidate.id,
      name: candidate.name,
      officeType: candidate.candidateProfile.officeType,
      politicalPartyId: candidate.candidateProfile.politicalPartyId,
      portraitUrl: candidate.candidateProfile.portraitUrl,
      campaignSlogan: candidate.candidateProfile.campaignSlogan,
      bio: candidate.candidateProfile.bio,
      websiteUrl: candidate.candidateProfile.websiteUrl,
      facebookUrl: candidate.candidateProfile.facebookUrl,
      instagramUrl: candidate.candidateProfile.instagramUrl,
      xUrl: candidate.candidateProfile.xUrl,
      isProfilePublished: candidate.candidateProfile.isProfilePublished,
      geoPoliticalZoneId: candidate.candidateProfile.geoPoliticalZoneId,
      stateId: candidate.candidateProfile.stateId,
      senatorialDistrictId: candidate.candidateProfile.senatorialDistrictId,
      federalConstituencyId: candidate.candidateProfile.federalConstituencyId,
      lgaId: candidate.candidateProfile.lgaId,
      wardId: candidate.candidateProfile.wardId,
      stateConstituencyId: candidate.candidateProfile.stateConstituencyId,
      pollingUnitId: candidate.candidateProfile.pollingUnitId,
    }),
  });
});

router.patch("/profile", requireAuth, requireRole("CANDIDATE"), async (request, response) => {
  const parsed = candidateProfileSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid candidate profile payload.", errors: parsed.error.flatten() });
  }

  const updated = await prisma.candidateProfile.update({
    where: { userId: request.authUser!.id },
    data: {
      portraitUrl: toNullableString(parsed.data.portraitUrl),
      campaignSlogan: toNullableString(parsed.data.campaignSlogan),
      bio: toNullableString(parsed.data.bio),
      websiteUrl: toNullableString(parsed.data.websiteUrl),
      facebookUrl: toNullableString(parsed.data.facebookUrl),
      instagramUrl: toNullableString(parsed.data.instagramUrl),
      xUrl: toNullableString(parsed.data.xUrl),
      isProfilePublished: parsed.data.isProfilePublished,
    },
  });

  return response.json({
    message: "Candidate profile updated successfully.",
    profile: serializeCandidateProfileEditorItem({
      userId: request.authUser!.id,
      name: request.authUser!.name,
      officeType: updated.officeType,
      politicalPartyId: updated.politicalPartyId,
      portraitUrl: updated.portraitUrl,
      campaignSlogan: updated.campaignSlogan,
      bio: updated.bio,
      websiteUrl: updated.websiteUrl,
      facebookUrl: updated.facebookUrl,
      instagramUrl: updated.instagramUrl,
      xUrl: updated.xUrl,
      isProfilePublished: updated.isProfilePublished,
      geoPoliticalZoneId: updated.geoPoliticalZoneId,
      stateId: updated.stateId,
      senatorialDistrictId: updated.senatorialDistrictId,
      federalConstituencyId: updated.federalConstituencyId,
      lgaId: updated.lgaId,
      wardId: updated.wardId,
      stateConstituencyId: updated.stateConstituencyId,
      pollingUnitId: updated.pollingUnitId,
    }),
  });
});

router.post("/posts", requireAuth, requireRole("CANDIDATE", "ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const parsed = postSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid post payload.", errors: parsed.error.flatten() });
  }

  const actor = request.authUser!;
  let candidateUserId = parsed.data.candidateUserId || null;

  if (isCandidateUser(actor)) {
    candidateUserId = actor.id;
  }

  if (!candidateUserId) {
    return response.status(400).json({ message: "candidateUserId is required for admin-authored candidate posts." });
  }

  const access = await getAuthorizedCandidateForPublishing(actor, candidateUserId);
  if ("error" in access) {
    return response.status(access.error === "Candidate was not found." ? 404 : 403).json({ message: access.error });
  }

  const candidateProfile = access.candidate.candidateProfile!;

  const audience = parsed.data.audience || "ALL";
  const postTerritory = buildCandidateMaterialTerritory(candidateProfile);

  const territoryReferenceError = await validateTerritoryReferences(postTerritory);
  if (territoryReferenceError) {
    return response.status(400).json({ message: territoryReferenceError });
  }

  const post = await prisma.$transaction(async (transaction) => {
    const createdPost = await transaction.post.create({
      data: {
        authorUserId: actor.id,
        candidateUserId,
        title: parsed.data.title,
        content: parsed.data.content,
        mediaType: parsed.data.mediaType || "TEXT",
        mediaUrl: toNullableString(parsed.data.mediaUrl),
        thumbnailUrl: toNullableString(parsed.data.thumbnailUrl),
        ...postTerritory,
        isPublished: parsed.data.isPublished ?? true,
      },
    });

    if (isCandidateUser(actor) && createdPost.isPublished && parsed.data.audience) {
      const recipientWhere = {
        ...(createdPost.geoPoliticalZoneId ? { geoPoliticalZoneId: createdPost.geoPoliticalZoneId } : {}),
        ...(createdPost.stateId ? { stateId: createdPost.stateId } : {}),
        ...(createdPost.senatorialDistrictId ? { senatorialDistrictId: createdPost.senatorialDistrictId } : {}),
        ...(createdPost.federalConstituencyId ? { federalConstituencyId: createdPost.federalConstituencyId } : {}),
        ...(createdPost.lgaId ? { lgaId: createdPost.lgaId } : {}),
        ...(createdPost.wardId ? { wardId: createdPost.wardId } : {}),
        ...(createdPost.stateConstituencyId ? { stateConstituencyId: createdPost.stateConstituencyId } : {}),
        ...(createdPost.pollingUnitId ? { pollingUnitId: createdPost.pollingUnitId } : {}),
      };

      const recipientIds = new Set<string>();

      if (audience === "ALL" || audience === "VOTERS") {
        const voters = await transaction.user.findMany({
          where: {
            role: UserRole.VOTER,
            voterProfile: {
              is: {
                ...recipientWhere,
                contactConsent: true,
              },
            },
          },
          select: { id: true },
        });

        for (const voter of voters) {
          recipientIds.add(voter.id);
        }
      }

      if (audience === "ALL" || audience === "AGENTS") {
        const agents = await transaction.user.findMany({
          where: {
            role: UserRole.AGENT,
            agentProfile: {
              is: recipientWhere,
            },
          },
          select: { id: true },
        });

        for (const agentUser of agents) {
          recipientIds.add(agentUser.id);
        }
      }

      for (const userId of recipientIds) {
        await createNotification(transaction, {
          userId,
          type: NotificationType.POST_PUBLISHED,
          title: `Campaign update from ${actor.name}`,
          message: createdPost.title,
        });
      }
    }

    return createdPost;
  });

  return response.status(201).json({
    message: "Post created successfully.",
    post: serializePostListItem(post),
  });
});

router.get("/posts", requireAuth, requireRole("CANDIDATE"), async (request, response) => {
  const posts = await prisma.post.findMany({
    where: { candidateUserId: request.authUser!.id },
    orderBy: { createdAt: "desc" },
  });

  return response.json({
    posts: posts.map(serializePostListItem),
  });
});

router.patch("/posts/:postId", requireAuth, requireRole("CANDIDATE", "ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const parsed = candidatePostUpdateSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid post update payload.", errors: parsed.error.flatten() });
  }

  const postId = readRouteId(response, request.params.postId, "post id");
  if (!postId) {
    return;
  }

  const existingPost = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      candidateUser: {
        include: { candidateProfile: true },
      },
    },
  });

  if (!existingPost?.candidateUser?.candidateProfile || !existingPost.candidateUserId) {
    return response.status(404).json({ message: "Campaign material was not found." });
  }

  const access = await getAuthorizedCandidateForPublishing(request.authUser!, existingPost.candidateUserId);
  if ("error" in access) {
    return response.status(403).json({ message: access.error });
  }

  const nextMediaType = parsed.data.mediaType || existingPost.mediaType;
  if (
    (nextMediaType === "IMAGE" || nextMediaType === "VIDEO" || nextMediaType === "DOCUMENT") &&
    !toNullableString(parsed.data.mediaUrl === undefined ? existingPost.mediaUrl || "" : parsed.data.mediaUrl)
  ) {
    return response.status(400).json({ message: "mediaUrl is required for image, video, and document campaign materials." });
  }

  const territory = buildCandidateMaterialTerritory(existingPost.candidateUser.candidateProfile);
  const updatedPost = await prisma.post.update({
    where: { id: postId },
    data: {
      title: parsed.data.title,
      content: parsed.data.content,
      mediaType: parsed.data.mediaType,
      mediaUrl: parsed.data.mediaUrl === undefined ? undefined : toNullableString(parsed.data.mediaUrl),
      thumbnailUrl: parsed.data.thumbnailUrl === undefined ? undefined : toNullableString(parsed.data.thumbnailUrl),
      isPublished: parsed.data.isPublished,
      ...territory,
    },
  });

  return response.json({
    message: "Campaign material updated successfully.",
    post: serializePostListItem(updatedPost),
  });
});

router.delete("/posts/:postId", requireAuth, requireRole("CANDIDATE", "ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const postId = readRouteId(response, request.params.postId, "post id");
  if (!postId) {
    return;
  }

  const existingPost = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, candidateUserId: true },
  });

  if (!existingPost?.candidateUserId) {
    return response.status(404).json({ message: "Campaign material was not found." });
  }

  const access = await getAuthorizedCandidateForPublishing(request.authUser!, existingPost.candidateUserId);
  if ("error" in access) {
    return response.status(403).json({ message: access.error });
  }

  await prisma.post.delete({ where: { id: postId } });

  return response.json({ message: "Campaign material deleted successfully." });
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

router.get("/voters", requireAuth, requireRole("CANDIDATE"), async (request, response) => {
  const candidateProfile = request.authUser?.candidateProfile;

  if (!candidateProfile) {
    return response.status(403).json({ message: "Candidate profile is required." });
  }

  const scope = buildCandidateScope(candidateProfile);
  const voters = await prisma.user.findMany({
    where: {
      role: UserRole.VOTER,
      isActive: true,
      voterProfile: {
        is: {
          ...scope,
          contactConsent: true,
        },
      },
    },
    include: { voterProfile: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return response.json({
    voters: voters
      .filter((voter) => voter.voterProfile)
      .map((voter) => ({
        userId: voter.id,
        name: voter.name,
        emailMask: maskEmail(voter.email),
        phoneMask: maskPhone(voter.phone),
        voterCardNumber: voter.voterProfile!.voterCardNumber,
        contactConsent: voter.voterProfile!.contactConsent,
        termsAcceptedAt: voter.voterProfile!.termsAcceptedAt?.toISOString() || null,
        territory: serializeTerritory(voter.voterProfile!),
      })),
  });
});

router.get("/broadcasts", requireAuth, requireRole("CANDIDATE"), async (request, response) => {
  const broadcasts = await prisma.broadcastMessage.findMany({
    where: {
      createdByUserId: request.authUser!.id,
      audience: BroadcastAudience.VOTERS,
    },
    include: {
      createdByUser: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return response.json({
    broadcasts: broadcasts.map(serializeBroadcastMessageItem),
  });
});

router.post("/broadcasts", requireAuth, requireRole("CANDIDATE"), async (request, response) => {
  const parsed = candidateBroadcastSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid broadcast payload.", errors: parsed.error.flatten() });
  }

  const candidateProfile = request.authUser?.candidateProfile;

  if (!candidateProfile) {
    return response.status(403).json({ message: "Candidate profile is required." });
  }

  const scope = buildCandidateScope(candidateProfile);
  const recipients = await prisma.user.findMany({
    where: {
      role: UserRole.VOTER,
      isActive: true,
      voterProfile: {
        is: {
          ...scope,
          contactConsent: true,
        },
      },
    },
    select: { id: true },
    take: 500,
  });

  const recipientIds = recipients.map((recipient) => recipient.id);
  const broadcastId = await prisma.$transaction(async (transaction) => {
    const broadcast = await transaction.broadcastMessage.create({
      data: {
        title: parsed.data.title,
        message: parsed.data.message,
        audience: BroadcastAudience.VOTERS,
        createdByUserId: request.authUser!.id,
        recipientCount: recipientIds.length,
        geoPoliticalZoneId: scope.geoPoliticalZoneId || null,
        stateId: scope.stateId || null,
        senatorialDistrictId: scope.senatorialDistrictId || null,
        federalConstituencyId: scope.federalConstituencyId || null,
        lgaId: scope.lgaId || null,
        wardId: scope.wardId || null,
        stateConstituencyId: scope.stateConstituencyId || null,
        pollingUnitId: scope.pollingUnitId || null,
      },
    });

    for (const recipientId of recipientIds) {
      await createNotification(transaction, {
        userId: recipientId,
        type: NotificationType.SYSTEM,
        title: parsed.data.title,
        message: parsed.data.message,
      });
    }

    return broadcast.id;
  });

  const broadcast = await prisma.broadcastMessage.findUnique({
    where: { id: broadcastId },
    include: {
      createdByUser: { select: { name: true } },
    },
  });

  if (!broadcast) {
    return response.status(500).json({ message: "Broadcast was created but could not be loaded." });
  }

  return response.status(201).json({
    message: "Campaign message sent to consented voters.",
    broadcast: serializeBroadcastMessageItem(broadcast),
  });
});

export default router;
