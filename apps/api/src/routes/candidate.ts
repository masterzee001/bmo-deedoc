import express, { Router } from "express";
import type { Request, Response } from "express";
import { AssignmentPermissionType, BroadcastAudience, NotificationType, Prisma, UserRole } from "@prisma/client";
import { z } from "zod";
import { CAMPAIGN_MEDIA_TYPES } from "@pics-nigeria/shared";
import { requireAuth, requireRole } from "../middleware/auth";
import { createNotification } from "../lib/notifications";
import { prisma } from "../prisma";
import {
  serializeAdminMapSummary,
  serializeAgentActivitySummary,
  serializeBroadcastMessageItem,
  serializeCampaignEventItem,
  serializeCandidateProfileEditorItem,
  serializeCandidatePublicListItem,
  serializeCandidatePublicProfile,
  serializeFeedbackItem,
  serializeIncidentItem,
  serializePoliticalPartyItem,
  serializePoliticalPartyPublicProfile,
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
  portraitAssetId: z.string().trim().optional().or(z.literal("")),
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
  partyId: z.string().trim().optional(),
  officeType: z.enum(["PRESIDENTIAL", "GOVERNORSHIP", "SENATE", "HOUSE_OF_REP", "STATE_ASSEMBLY", "CHAIRMANSHIP", "COUNCILLOR"]).optional(),
});

const publicPartyQuerySchema = z.object({
  search: z.string().trim().optional(),
});

const candidateBroadcastSchema = z.object({
  title: z.string().trim().min(3),
  message: z.string().trim().min(10),
});

const candidateEventSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(2000),
  venue: z.string().trim().min(3).max(160),
  coverImageAssetId: z.string().trim().optional().or(z.literal("")),
  stateId: z.string().trim().optional(),
  lgaId: z.string().trim().optional(),
  wardId: z.string().trim().optional(),
  pollingUnitId: z.string().trim().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional().or(z.literal("")),
  isPublished: z.boolean().optional(),
}).superRefine((data, context) => {
  if (data.endsAt && data.endsAt !== "" && new Date(data.endsAt) < new Date(data.startsAt)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "endsAt must be after startsAt.",
      path: ["endsAt"],
    });
  }
});

const candidateEventUpdateSchema = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  description: z.string().trim().min(10).max(2000).optional(),
  venue: z.string().trim().min(3).max(160).optional(),
  coverImageAssetId: z.string().trim().optional().or(z.literal("")),
  stateId: z.string().trim().optional().or(z.literal("")),
  lgaId: z.string().trim().optional().or(z.literal("")),
  wardId: z.string().trim().optional().or(z.literal("")),
  pollingUnitId: z.string().trim().optional().or(z.literal("")),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional().or(z.literal("")).nullable(),
  isPublished: z.boolean().optional(),
}).superRefine((data, context) => {
  if (data.startsAt && data.endsAt && data.endsAt !== "" && new Date(data.endsAt) < new Date(data.startsAt)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "endsAt must be after startsAt.",
      path: ["endsAt"],
    });
  }
});

type CandidateAuthProfile = NonNullable<NonNullable<Request["authUser"]>["candidateProfile"]>;

function buildCandidateScope(candidateProfile: CandidateAuthProfile) {
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

function getCandidatePartyScopedIncidentWhere(
  candidateProfile: CandidateAuthProfile,
): Prisma.IncidentWhereInput {
  const partyId = candidateProfile.politicalPartyId || null;
  const voterIncidentScope: Prisma.IncidentWhereInput = {
    reportedByUser: {
      is: {
        role: UserRole.VOTER,
      },
    },
  };

  if (!partyId) {
    return voterIncidentScope;
  }

  return {
    OR: [
      voterIncidentScope,
      {
        reportedByUser: {
          is: {
            role: UserRole.ADMIN,
            adminProfile: { is: { politicalPartyId: partyId } },
          },
        },
      },
      {
        reportedByUser: {
          is: {
            role: UserRole.AGENT,
            agentProfile: { is: { politicalPartyId: partyId } },
          },
        },
      },
      {
        reportedByUser: {
          is: {
            role: UserRole.CANDIDATE,
            candidateProfile: { is: { politicalPartyId: partyId } },
          },
        },
      },
    ],
  };
}

function getCandidatePartyScopedFeedbackWhere(
  candidateProfile: CandidateAuthProfile,
): Prisma.FeedbackWhereInput {
  const partyId = candidateProfile.politicalPartyId || null;
  const voterFeedbackScope: Prisma.FeedbackWhereInput = {
    voterUserId: { not: null },
  };

  if (!partyId) {
    return voterFeedbackScope;
  }

  return {
    OR: [
      voterFeedbackScope,
      {
        agentUser: {
          is: {
            agentProfile: { is: { politicalPartyId: partyId } },
          },
        },
      },
      {
        candidateUser: {
          is: {
            candidateProfile: { is: { politicalPartyId: partyId } },
          },
        },
      },
    ],
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

function buildAssetUrl(request: Request, assetId: string | null | undefined) {
  if (!assetId) {
    return null;
  }

  const protocol = request.get("x-forwarded-proto") || request.protocol;
  const host = request.get("x-forwarded-host") || request.get("host");

  if (!host) {
    return null;
  }

  return `${protocol}://${host}/candidate/assets/${assetId}`;
}

function resolveCandidateProfileImage(request: Request, profile: { portraitAssetId?: string | null; portraitUrl?: string | null }) {
  return buildAssetUrl(request, profile.portraitAssetId) || profile.portraitUrl || null;
}

function resolveEventCoverImage(request: Request, event: { coverImageAssetId?: string | null; coverImageUrl?: string | null }) {
  return buildAssetUrl(request, event.coverImageAssetId) || event.coverImageUrl || null;
}

async function assertAssetOwnership(ownerUserId: string, assetId?: string | null) {
  if (!assetId) {
    return true;
  }

  const asset = await prisma.candidateMediaAsset.findUnique({
    where: { id: assetId },
    select: { id: true, ownerUserId: true },
  });

  return asset?.ownerUserId === ownerUserId;
}

function validateCandidateTargetScope(
  candidateProfile: CandidateScopedProfile & {
    geoPoliticalZoneId?: string | null;
    senatorialDistrictId?: string | null;
    federalConstituencyId?: string | null;
    stateConstituencyId?: string | null;
  },
  input: { stateId?: string; lgaId?: string; wardId?: string; pollingUnitId?: string },
) {
  if (
    (candidateProfile.senatorialDistrictId || candidateProfile.federalConstituencyId || candidateProfile.stateConstituencyId) &&
    (input.stateId || input.lgaId || input.wardId || input.pollingUnitId)
  ) {
    return "Candidates assigned to senatorial, federal-constituency, or state-constituency offices cannot narrow event discovery below their assigned office territory yet.";
  }

  if (candidateProfile.stateId && input.stateId && input.stateId !== candidateProfile.stateId) {
    return "Target state must remain inside your assigned territory.";
  }

  if (candidateProfile.lgaId && input.lgaId && input.lgaId !== candidateProfile.lgaId) {
    return "Target LGA must remain inside your assigned territory.";
  }

  if (candidateProfile.wardId && input.wardId && input.wardId !== candidateProfile.wardId) {
    return "Target ward must remain inside your assigned territory.";
  }

  if (candidateProfile.pollingUnitId && input.pollingUnitId && input.pollingUnitId !== candidateProfile.pollingUnitId) {
    return "Target polling unit must remain inside your assigned territory.";
  }

  return null;
}

function buildCandidateEventTerritory(
  candidateProfile: CandidateScopedProfile & {
    geoPoliticalZoneId?: string | null;
    senatorialDistrictId?: string | null;
    federalConstituencyId?: string | null;
    stateConstituencyId?: string | null;
  },
  input: { stateId?: string; lgaId?: string; wardId?: string; pollingUnitId?: string },
) {
  return {
    geoPoliticalZoneId: candidateProfile.geoPoliticalZoneId || null,
    stateId: input.stateId || candidateProfile.stateId || null,
    senatorialDistrictId: candidateProfile.senatorialDistrictId || null,
    federalConstituencyId: candidateProfile.federalConstituencyId || null,
    lgaId: input.lgaId || candidateProfile.lgaId || null,
    wardId: input.wardId || candidateProfile.wardId || null,
    stateConstituencyId: candidateProfile.stateConstituencyId || null,
    pollingUnitId: input.pollingUnitId || candidateProfile.pollingUnitId || null,
  };
}

const candidatePublicInclude = {
  candidateProfile: {
    include: {
      politicalParty: {
        select: { id: true, name: true, code: true, logoUrl: true, isApprovedByInec: true, inecSourceUrl: true },
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

const campaignEventInclude = {
  candidateUser: {
    include: {
      candidateProfile: {
        include: {
          politicalParty: { select: { name: true } },
        },
      },
    },
  },
  geoPoliticalZone: { select: { name: true } },
  state: { select: { name: true } },
  senatorialDistrict: { select: { name: true } },
  federalConstituency: { select: { name: true } },
  lga: { select: { name: true } },
  ward: { select: { name: true } },
  stateConstituency: { select: { name: true } },
  pollingUnit: { select: { name: true } },
  _count: {
    select: { rsvps: true },
  },
} satisfies Prisma.CampaignEventInclude;

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

async function getAuthorizedCandidateForPublishing(actor: NonNullable<Request["authUser"]>, candidateUserId: string) {
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

const imageUploadMiddleware = express.raw({
  type: ["image/jpeg", "image/png", "image/webp"],
  limit: "2mb",
});

router.post("/assets/profile-photo", requireAuth, requireRole("CANDIDATE"), imageUploadMiddleware, async (request, response) => {
  if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
    return response.status(400).json({ message: "Image upload is required." });
  }
  const fileBytes = Uint8Array.from(request.body);

  const mimeType = request.header("content-type");
  if (!mimeType || !["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
    return response.status(400).json({ message: "Only JPEG, PNG, and WebP profile photos are supported." });
  }

  const fileName = request.header("x-file-name")?.trim() || `profile-${Date.now()}`;
  const asset = await prisma.candidateMediaAsset.create({
    data: {
      ownerUserId: request.authUser!.id,
      kind: "PROFILE_PHOTO",
      fileName,
      mimeType,
      data: fileBytes,
      sizeBytes: fileBytes.byteLength,
    },
  });

  return response.status(201).json({
    message: "Profile photo uploaded successfully.",
    asset: {
      id: asset.id,
      fileName: asset.fileName,
      fileUrl: buildAssetUrl(request, asset.id),
    },
  });
});

router.post("/assets/event-cover", requireAuth, requireRole("CANDIDATE"), imageUploadMiddleware, async (request, response) => {
  if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
    return response.status(400).json({ message: "Image upload is required." });
  }
  const fileBytes = Uint8Array.from(request.body);

  const mimeType = request.header("content-type");
  if (!mimeType || !["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
    return response.status(400).json({ message: "Only JPEG, PNG, and WebP cover images are supported." });
  }

  const fileName = request.header("x-file-name")?.trim() || `event-cover-${Date.now()}`;
  const asset = await prisma.candidateMediaAsset.create({
    data: {
      ownerUserId: request.authUser!.id,
      kind: "EVENT_COVER",
      fileName,
      mimeType,
      data: fileBytes,
      sizeBytes: fileBytes.byteLength,
    },
  });

  return response.status(201).json({
    message: "Event cover uploaded successfully.",
    asset: {
      id: asset.id,
      fileName: asset.fileName,
      fileUrl: buildAssetUrl(request, asset.id),
    },
  });
});

router.get("/assets/:assetId", async (request, response) => {
  const assetId = readRouteId(response, request.params.assetId, "asset id");
  if (!assetId) {
    return;
  }

  const asset = await prisma.candidateMediaAsset.findUnique({
    where: { id: assetId },
    select: { mimeType: true, data: true, updatedAt: true },
  });

  if (!asset) {
    return response.status(404).json({ message: "Asset was not found." });
  }

  response.setHeader("Content-Type", asset.mimeType);
  response.setHeader("Cache-Control", "public, max-age=3600");
  response.setHeader("Last-Modified", asset.updatedAt.toUTCString());
  response.send(Buffer.from(asset.data));
});

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
          politicalPartyId:
            parsed.data.partyId === "independent"
              ? null
              : parsed.data.partyId || undefined,
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
          portraitAssetId: candidate.candidateProfile!.portraitAssetId,
          portraitUrl: resolveCandidateProfileImage(request, candidate.candidateProfile!),
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

router.get("/public/parties", async (request, response) => {
  const parsed = publicPartyQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid political party discovery query.", errors: parsed.error.flatten() });
  }

  const parties = await prisma.politicalParty.findMany({
    where: {
      name: parsed.data.search ? { contains: parsed.data.search, mode: "insensitive" } : undefined,
    },
    include: {
      candidateProfiles: {
        where: {
          isProfilePublished: true,
          user: {
            is: { isActive: true },
          },
        },
        select: { userId: true },
      },
    },
    orderBy: [{ isApprovedByInec: "desc" }, { name: "asc" }],
  });

  return response.json({
    parties: parties.map((party) =>
      serializePoliticalPartyItem({
        ...party,
        _count: { candidateProfiles: party.candidateProfiles.length },
      }),
    ),
  });
});

router.get("/public/parties/:partyId", async (request, response) => {
  const partyId = readRouteId(response, request.params.partyId, "party id");
  if (!partyId) {
    return;
  }

  const party = await prisma.politicalParty.findUnique({
    where: { id: partyId },
    include: {
      candidateProfiles: {
        where: {
          isProfilePublished: true,
          user: {
            is: { isActive: true },
          },
        },
        include: {
          user: true,
          politicalParty: {
            select: { id: true, name: true, code: true, logoUrl: true, isApprovedByInec: true, inecSourceUrl: true },
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
    },
  });

  if (!party) {
    return response.status(404).json({ message: "Political party was not found." });
  }

  return response.json({
    party: serializePoliticalPartyPublicProfile({
      id: party.id,
      code: party.code,
      name: party.name,
      logoUrl: party.logoUrl,
      description: party.description,
      officialWebsite: party.officialWebsite,
      isApprovedByInec: party.isApprovedByInec,
      inecSourceUrl: party.inecSourceUrl,
      candidates: party.candidateProfiles.map((profile) =>
        serializeCandidatePublicListItem({
          userId: profile.user.id,
          name: profile.user.name,
          officeType: profile.officeType,
          portraitAssetId: profile.portraitAssetId,
          portraitUrl: resolveCandidateProfileImage(request, profile),
          campaignSlogan: profile.campaignSlogan,
          bio: profile.bio,
          isProfilePublished: profile.isProfilePublished,
          politicalParty: profile.politicalParty,
          geoPoliticalZoneId: profile.geoPoliticalZoneId,
          stateId: profile.stateId,
          senatorialDistrictId: profile.senatorialDistrictId,
          federalConstituencyId: profile.federalConstituencyId,
          lgaId: profile.lgaId,
          wardId: profile.wardId,
          stateConstituencyId: profile.stateConstituencyId,
          pollingUnitId: profile.pollingUnitId,
          geoPoliticalZone: profile.geoPoliticalZone,
          state: profile.state,
          senatorialDistrict: profile.senatorialDistrict,
          federalConstituency: profile.federalConstituency,
          lga: profile.lga,
          ward: profile.ward,
          stateConstituency: profile.stateConstituency,
          pollingUnit: profile.pollingUnit,
        }),
      ),
    }),
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
  const upcomingEvents = await prisma.campaignEvent.findMany({
    where: {
      candidateUserId,
      isPublished: true,
      startsAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
    },
    include: campaignEventInclude,
    orderBy: { startsAt: "asc" },
    take: 12,
  });

  return response.json({
    candidate: serializeCandidatePublicProfile({
      userId: candidate.id,
      name: candidate.name,
      officeType: candidate.candidateProfile.officeType,
      portraitAssetId: candidate.candidateProfile.portraitAssetId,
      portraitUrl: resolveCandidateProfileImage(request, candidate.candidateProfile),
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
      upcomingEvents: upcomingEvents.map((event) => ({
        ...event,
        coverImageUrl: resolveEventCoverImage(request, event),
      })),
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
      portraitAssetId: candidate.candidateProfile.portraitAssetId,
      portraitUrl: resolveCandidateProfileImage(request, candidate.candidateProfile),
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

  if (!(await assertAssetOwnership(request.authUser!.id, parsed.data.portraitAssetId))) {
    return response.status(403).json({ message: "You can only use your own uploaded profile photo." });
  }

  const updated = await prisma.candidateProfile.update({
    where: { userId: request.authUser!.id },
    data: {
      portraitAssetId: parsed.data.portraitAssetId === undefined ? undefined : toNullableString(parsed.data.portraitAssetId),
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
      portraitAssetId: updated.portraitAssetId,
      portraitUrl: resolveCandidateProfileImage(request, updated),
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

router.get("/events", requireAuth, requireRole("CANDIDATE"), async (request, response) => {
  const events = await prisma.campaignEvent.findMany({
    where: { candidateUserId: request.authUser!.id },
    include: campaignEventInclude,
    orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
  });

  return response.json({
    events: events.map((event) => serializeCampaignEventItem({
      ...event,
      coverImageUrl: resolveEventCoverImage(request, event),
    })),
  });
});

router.post("/events", requireAuth, requireRole("CANDIDATE"), async (request, response) => {
  const parsed = candidateEventSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid campaign event payload.", errors: parsed.error.flatten() });
  }

  const candidateProfile = request.authUser?.candidateProfile;
  if (!candidateProfile) {
    return response.status(403).json({ message: "Candidate profile is required." });
  }

  if (!(await assertAssetOwnership(request.authUser!.id, parsed.data.coverImageAssetId))) {
    return response.status(403).json({ message: "You can only use your own uploaded event cover." });
  }

  const targetScopeError = validateCandidateTargetScope(candidateProfile, parsed.data);
  if (targetScopeError) {
    return response.status(400).json({ message: targetScopeError });
  }

  const eventTerritory = buildCandidateEventTerritory(candidateProfile, parsed.data);
  const territoryReferenceError = await validateTerritoryReferences(eventTerritory);
  if (territoryReferenceError) {
    return response.status(400).json({ message: territoryReferenceError });
  }

  const created = await prisma.$transaction(async (transaction) => {
    const event = await transaction.campaignEvent.create({
      data: {
        candidateUserId: request.authUser!.id,
        createdByUserId: request.authUser!.id,
        title: parsed.data.title,
        description: parsed.data.description,
        venue: parsed.data.venue,
        coverImageAssetId: toNullableString(parsed.data.coverImageAssetId),
        coverImageUrl: null,
        registrationUrl: null,
        startsAt: new Date(parsed.data.startsAt),
        endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
        isPublished: parsed.data.isPublished ?? false,
        ...eventTerritory,
      },
      include: campaignEventInclude,
    });

    if (event.isPublished) {
      const recipients = await transaction.user.findMany({
        where: {
          role: UserRole.VOTER,
          isActive: true,
          voterProfile: {
            is: {
              ...Object.fromEntries(Object.entries(eventTerritory).filter(([, value]) => value)),
              contactConsent: true,
            },
          },
        },
        select: { id: true },
        take: 500,
      });

      for (const recipient of recipients) {
        await createNotification(transaction, {
          userId: recipient.id,
          type: NotificationType.SYSTEM,
          title: `New event from ${request.authUser!.name}`,
          message: event.title,
        });
      }
    }

    return event;
  });

  return response.status(201).json({
    message: created.isPublished ? "Campaign event created and published." : "Campaign event saved as draft.",
    event: serializeCampaignEventItem({
      ...created,
      coverImageUrl: resolveEventCoverImage(request, created),
    }),
  });
});

router.patch("/events/:eventId", requireAuth, requireRole("CANDIDATE"), async (request, response) => {
  const parsed = candidateEventUpdateSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid campaign event update payload.", errors: parsed.error.flatten() });
  }

  const eventId = readRouteId(response, request.params.eventId, "event id");
  if (!eventId) {
    return;
  }

  const existingEvent = await prisma.campaignEvent.findUnique({
    where: { id: eventId },
  });

  if (!existingEvent || existingEvent.candidateUserId !== request.authUser!.id || !request.authUser!.candidateProfile) {
    return response.status(404).json({ message: "Campaign event was not found." });
  }

  if (!(await assertAssetOwnership(request.authUser!.id, parsed.data.coverImageAssetId))) {
    return response.status(403).json({ message: "You can only use your own uploaded event cover." });
  }

  const targetScopeError = validateCandidateTargetScope(request.authUser!.candidateProfile, {
    stateId: parsed.data.stateId || undefined,
    lgaId: parsed.data.lgaId || undefined,
    wardId: parsed.data.wardId || undefined,
    pollingUnitId: parsed.data.pollingUnitId || undefined,
  });
  if (targetScopeError) {
    return response.status(400).json({ message: targetScopeError });
  }

  const nextStartsAt = parsed.data.startsAt ? new Date(parsed.data.startsAt) : existingEvent.startsAt;
  const nextEndsAtRaw = parsed.data.endsAt === undefined ? existingEvent.endsAt : parsed.data.endsAt === null || parsed.data.endsAt === "" ? null : new Date(parsed.data.endsAt);
  if (nextEndsAtRaw && nextEndsAtRaw < nextStartsAt) {
    return response.status(400).json({ message: "endsAt must be after startsAt." });
  }

  const updated = await prisma.campaignEvent.update({
    where: { id: eventId },
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      venue: parsed.data.venue,
      coverImageAssetId: parsed.data.coverImageAssetId === undefined ? undefined : toNullableString(parsed.data.coverImageAssetId),
      coverImageUrl: null,
      registrationUrl: null,
      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : undefined,
      endsAt: parsed.data.endsAt === undefined ? undefined : nextEndsAtRaw,
      isPublished: parsed.data.isPublished,
      ...buildCandidateEventTerritory(request.authUser!.candidateProfile, {
        stateId: parsed.data.stateId || undefined,
        lgaId: parsed.data.lgaId || undefined,
        wardId: parsed.data.wardId || undefined,
        pollingUnitId: parsed.data.pollingUnitId || undefined,
      }),
    },
    include: campaignEventInclude,
  });

  return response.json({
    message: "Campaign event updated successfully.",
    event: serializeCampaignEventItem({
      ...updated,
      coverImageUrl: resolveEventCoverImage(request, updated),
    }),
  });
});

router.delete("/events/:eventId", requireAuth, requireRole("CANDIDATE"), async (request, response) => {
  const eventId = readRouteId(response, request.params.eventId, "event id");
  if (!eventId) {
    return;
  }

  const existingEvent = await prisma.campaignEvent.findUnique({
    where: { id: eventId },
    select: { candidateUserId: true },
  });

  if (!existingEvent || existingEvent.candidateUserId !== request.authUser!.id) {
    return response.status(404).json({ message: "Campaign event was not found." });
  }

  await prisma.campaignEvent.delete({ where: { id: eventId } });

  return response.json({ message: "Campaign event deleted successfully." });
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
      ...getCandidatePartyScopedFeedbackWhere(candidateProfile),
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
      ...getCandidatePartyScopedIncidentWhere(candidateProfile),
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

router.get("/agent-activity-summaries", requireAuth, requireRole("CANDIDATE"), async (request, response) => {
  const candidateProfile = request.authUser?.candidateProfile;
  if (!candidateProfile) {
    return response.status(403).json({ message: "Candidate profile is required." });
  }

  const scope = buildCandidateScope(candidateProfile);
  const agents = await prisma.user.findMany({
    where: {
      role: UserRole.AGENT,
      isActive: true,
      agentProfile: {
        is: {
          ...scope,
          politicalPartyId: candidateProfile.politicalPartyId || undefined,
        },
      },
    },
    include: {
      agentProfile: true,
      agentActivities: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return response.json({
    agentActivitySummaries: agents
      .filter((agent) => agent.agentProfile)
      .map((agent) => {
        const latest = agent.agentActivities[0];
        return serializeAgentActivitySummary({
          agentUserId: agent.id,
          name: agent.name,
          email: agent.email,
          territory: serializeTerritory(agent.agentProfile!),
          latestActivityType: latest?.type || null,
          latestActivityAt: latest?.createdAt.toISOString() || null,
          latestLatitude: latest?.latitude ?? null,
          latestLongitude: latest?.longitude ?? null,
          pollingUnitId: latest?.pollingUnitId || agent.agentProfile?.pollingUnitId || null,
        });
      }),
  });
});

router.get("/map-summary", requireAuth, requireRole("CANDIDATE"), async (request, response) => {
  const candidateProfile = request.authUser?.candidateProfile;
  if (!candidateProfile) {
    return response.status(403).json({ message: "Candidate profile is required." });
  }

  const scope = buildCandidateScope(candidateProfile);
  const [agents, incidents, pollingUnits] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: UserRole.AGENT,
        isActive: true,
        agentProfile: {
          is: {
            ...scope,
            politicalPartyId: candidateProfile.politicalPartyId || undefined,
          },
        },
      },
      include: {
        agentProfile: true,
        agentActivities: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      take: 150,
    }),
    prisma.incident.findMany({
      where: {
        ...scope,
        ...getCandidatePartyScopedIncidentWhere(candidateProfile),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.pollingUnit.findMany({
      where: {
        stateId: candidateProfile.stateId || undefined,
        lgaId: candidateProfile.lgaId || undefined,
        wardId: candidateProfile.wardId || undefined,
      },
      orderBy: { name: "asc" },
      take: 200,
    }),
  ]);

  const activeAgents = agents
    .filter((agent) => agent.agentProfile)
    .map((agent) => {
      const latest = agent.agentActivities[0];
      return serializeAgentActivitySummary({
        agentUserId: agent.id,
        name: agent.name,
        email: agent.email,
        territory: serializeTerritory(agent.agentProfile!),
        latestActivityType: latest?.type || null,
        latestActivityAt: latest?.createdAt.toISOString() || null,
        latestLatitude: latest?.latitude ?? null,
        latestLongitude: latest?.longitude ?? null,
        pollingUnitId: latest?.pollingUnitId || agent.agentProfile?.pollingUnitId || null,
      });
    })
    .filter((item) => item.latestLatitude !== null && item.latestLongitude !== null);

  const counts = {
    byStatus: incidents.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {}),
    bySeverity: incidents.reduce<Record<string, number>>((acc, item) => {
      acc[item.severity] = (acc[item.severity] || 0) + 1;
      return acc;
    }, {}),
    byType: incidents.reduce<Record<string, number>>((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {}),
  };

  return response.json({
    mapSummary: serializeAdminMapSummary({
      activeAgents,
      incidents: incidents.filter((item) => item.latitude !== null && item.longitude !== null).map(serializeIncidentItem),
      pollingUnits: pollingUnits.map((unit) => ({
        id: unit.id,
        name: unit.name,
        stateId: unit.stateId,
        lgaId: unit.lgaId,
        wardId: unit.wardId,
      })),
      counts,
    }),
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
        voterRegistrationRecorded: Boolean(voter.voterProfile!.voterCardNumber),
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
