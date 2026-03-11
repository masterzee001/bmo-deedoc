import { Router } from "express";
import type { Response } from "express";
import { IncidentSeverity, IncidentStatus, IncidentType, NotificationType, RewardRedemptionStatus, RewardType } from "@prisma/client";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth";
import { createNotification } from "../lib/notifications";
import { prisma } from "../prisma";
import { recordParticipationAndReward } from "../lib/participation";
import {
  serializeFeedbackItem,
  serializeIncidentItem,
  serializePollListItem,
  serializePostListItem,
  serializeRewardBalance,
  serializeRewardRedemption,
} from "../lib/serializers";
import { getRewardBalance } from "../lib/rewards";
import { validateTerritoryReferences } from "../lib/territory";

const router = Router();

const feedbackSchema = z.object({
  type: z.string().trim().min(2),
  message: z.string().trim().min(5),
  candidateUserId: z.string().trim().optional(),
  stateId: z.string().trim().min(1),
  senatorialDistrictId: z.string().trim().optional(),
  lgaId: z.string().trim().min(1),
  wardId: z.string().trim().optional(),
  pollingUnitId: z.string().trim().optional(),
});

const pollResponseSchema = z.object({
  optionId: z.string().trim().min(1),
});

const incidentSchema = z.object({
  type: z.nativeEnum(IncidentType),
  title: z.string().trim().min(3),
  description: z.string().trim().min(10),
  severity: z.nativeEnum(IncidentSeverity),
  stateId: z.string().trim().min(1),
  senatorialDistrictId: z.string().trim().optional(),
  lgaId: z.string().trim().min(1),
  wardId: z.string().trim().optional(),
  pollingUnitId: z.string().trim().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

const redemptionSchema = z.object({
  pointsRequested: z.number().int().min(1),
  amountRequested: z.number().positive().optional(),
  note: z.string().trim().max(500).optional(),
});

function readRouteId(response: Response, value: string | string[] | undefined, label: string): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    response.status(400).json({ message: `Invalid ${label}.` });
    return null;
  }

  return value;
}

router.get("/rewards", requireAuth, requireRole("VOTER"), async (request, response) => {
  const voterUserId = request.authUser?.id;

  const [recentRewards, groupedRewards] = await Promise.all([
    prisma.rewardLedger.findMany({
      where: { voterUserId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.rewardLedger.groupBy({
      by: ["type"],
      where: { voterUserId },
      _sum: { points: true },
    }),
  ]);

  const totals = new Map(groupedRewards.map((entry) => [entry.type, entry._sum.points || 0]));
  const totalPoints = Array.from(totals.values()).reduce((sum, value) => sum + value, 0);

  const balance = await getRewardBalance(prisma, voterUserId!);

  return response.json({
    totalPoints,
    totalParticipationPoints: totals.get(RewardType.PARTICIPATION) || 0,
    totalReferralPoints: totals.get(RewardType.REFERRAL) || 0,
    availablePoints: balance.availablePoints,
    reservedPoints: balance.reservedPoints,
    recentRewards: recentRewards.map((reward) => ({
      id: reward.id,
      type: reward.type,
      points: reward.points,
      amount: reward.amount,
      description: reward.description,
      createdAt: reward.createdAt.toISOString(),
    })),
  });
});

router.post("/redemptions", requireAuth, requireRole("VOTER"), async (request, response) => {
  const parsed = redemptionSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid redemption payload.", errors: parsed.error.flatten() });
  }

  const voterUserId = request.authUser!.id;
  const redemption = await prisma.$transaction(async (transaction) => {
    const balance = await getRewardBalance(transaction, voterUserId);

    if (parsed.data.pointsRequested > balance.availablePoints) {
      throw new Error("Requested redemption points exceed available balance.");
    }

    const created = await transaction.rewardRedemption.create({
      data: {
        voterUserId,
        pointsRequested: parsed.data.pointsRequested,
        amountRequested: parsed.data.amountRequested || null,
        status: RewardRedemptionStatus.PENDING,
        note: parsed.data.note || null,
      },
    });

    await createNotification(transaction, {
      userId: voterUserId,
      type: NotificationType.REWARD_REDEMPTION,
      title: "Redemption requested",
      message: `${parsed.data.pointsRequested} points redemption submitted for review.`,
    });

    return created;
  }).catch((error: unknown) => {
    throw error;
  });

  return response.status(201).json({
    message: "Redemption request submitted successfully.",
    redemption: serializeRewardRedemption(redemption),
  });
});

router.get("/redemptions", requireAuth, requireRole("VOTER"), async (request, response) => {
  const [redemptions, balance] = await Promise.all([
    prisma.rewardRedemption.findMany({
      where: { voterUserId: request.authUser!.id },
      orderBy: { createdAt: "desc" },
    }),
    getRewardBalance(prisma, request.authUser!.id),
  ]);

  return response.json({
    balance: serializeRewardBalance(balance),
    redemptions: redemptions.map(serializeRewardRedemption),
  });
});

router.get("/polls", requireAuth, requireRole("VOTER"), async (request, response) => {
  const voterProfile = request.authUser?.voterProfile;
  const polls = await prisma.poll.findMany({
    where: { isActive: true },
    include: { options: true },
    orderBy: { createdAt: "desc" },
  });

  const visiblePolls = polls.filter((poll) => {
    if (!voterProfile) {
      return false;
    }

    if (poll.stateId && poll.stateId !== voterProfile.stateId) {
      return false;
    }

    if (poll.senatorialDistrictId && poll.senatorialDistrictId !== voterProfile.senatorialDistrictId) {
      return false;
    }

    if (poll.federalConstituencyId && poll.federalConstituencyId !== voterProfile.federalConstituencyId) {
      return false;
    }

    if (poll.lgaId && poll.lgaId !== voterProfile.lgaId) {
      return false;
    }

    if (poll.wardId && poll.wardId !== voterProfile.wardId) {
      return false;
    }

    if (poll.stateConstituencyId && poll.stateConstituencyId !== voterProfile.stateConstituencyId) {
      return false;
    }

    return true;
  });

  return response.json({
    polls: visiblePolls.map(serializePollListItem),
  });
});

router.post("/polls/:pollId/respond", requireAuth, requireRole("VOTER"), async (request, response) => {
  const parsed = pollResponseSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid poll response payload.", errors: parsed.error.flatten() });
  }

  const pollId = readRouteId(response, request.params.pollId, "poll id");
  if (!pollId) {
    return;
  }

  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: { options: true },
  });

  if (!poll || !poll.isActive) {
    return response.status(404).json({ message: "Poll was not found." });
  }

  const selectedOption = poll.options.find((option) => option.id === parsed.data.optionId);
  if (!selectedOption) {
    return response.status(400).json({ message: "Selected option does not belong to this poll." });
  }

  const existingResponse = await prisma.pollResponse.findUnique({
    where: {
      pollId_voterUserId: {
        pollId: poll.id,
        voterUserId: request.authUser!.id,
      },
    },
    select: { id: true },
  });

  if (existingResponse) {
    return response.status(409).json({ message: "You have already responded to this poll." });
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.pollResponse.create({
      data: {
        pollId: poll.id,
        voterUserId: request.authUser!.id,
        optionId: parsed.data.optionId,
      },
    });

    await recordParticipationAndReward(transaction, {
      voterUserId: request.authUser!.id,
      type: "POLL_RESPONSE",
      description: `Poll response recorded for ${poll.title}`,
      pointsAwarded: 5,
      relatedPollId: poll.id,
    });
  });

  return response.status(201).json({ message: "Poll response submitted successfully." });
});

router.get("/posts", requireAuth, requireRole("VOTER"), async (request, response) => {
  const voterProfile = request.authUser?.voterProfile;
  const posts = await prisma.post.findMany({
    where: { isPublished: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const visiblePosts = posts.filter((post) => {
    if (!voterProfile) {
      return false;
    }

    if (post.stateId && post.stateId !== voterProfile.stateId) {
      return false;
    }

    if (post.senatorialDistrictId && post.senatorialDistrictId !== voterProfile.senatorialDistrictId) {
      return false;
    }

    if (post.federalConstituencyId && post.federalConstituencyId !== voterProfile.federalConstituencyId) {
      return false;
    }

    if (post.lgaId && post.lgaId !== voterProfile.lgaId) {
      return false;
    }

    if (post.wardId && post.wardId !== voterProfile.wardId) {
      return false;
    }

    if (post.stateConstituencyId && post.stateConstituencyId !== voterProfile.stateConstituencyId) {
      return false;
    }

    return true;
  });

  return response.json({
    posts: visiblePosts.map(serializePostListItem),
  });
});

router.post("/feedback", requireAuth, requireRole("VOTER"), async (request, response) => {
  const parsed = feedbackSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid feedback payload.", errors: parsed.error.flatten() });
  }

  const territoryReferenceError = await validateTerritoryReferences(parsed.data);
  if (territoryReferenceError) {
    return response.status(400).json({ message: territoryReferenceError });
  }

  if (parsed.data.candidateUserId) {
    const candidate = await prisma.user.findUnique({
      where: { id: parsed.data.candidateUserId },
      include: { candidateProfile: true },
    });

    if (!candidate?.candidateProfile) {
      return response.status(400).json({ message: "Candidate user does not exist." });
    }
  }

  const feedback = await prisma.feedback.create({
    data: {
      voterUserId: request.authUser!.id,
      candidateUserId: parsed.data.candidateUserId || null,
      type: parsed.data.type,
      message: parsed.data.message,
      stateId: parsed.data.stateId,
      senatorialDistrictId: parsed.data.senatorialDistrictId || null,
      lgaId: parsed.data.lgaId,
      wardId: parsed.data.wardId || null,
      pollingUnitId: parsed.data.pollingUnitId || null,
    },
  });

  return response.status(201).json({
    message: "Feedback submitted successfully.",
    feedback: serializeFeedbackItem(feedback),
  });
});

router.post("/incidents", requireAuth, requireRole("VOTER"), async (request, response) => {
  const parsed = incidentSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid incident payload.", errors: parsed.error.flatten() });
  }

  const territoryReferenceError = await validateTerritoryReferences(parsed.data);
  if (territoryReferenceError) {
    return response.status(400).json({ message: territoryReferenceError });
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
      stateId: parsed.data.stateId,
      senatorialDistrictId: parsed.data.senatorialDistrictId || null,
      lgaId: parsed.data.lgaId,
      wardId: parsed.data.wardId || null,
      pollingUnitId: parsed.data.pollingUnitId || null,
      assignedAdminUserId: null,
    },
  });

  await prisma.feedback.create({
    data: {
      voterUserId: request.authUser!.id,
      type: `INCIDENT:${parsed.data.type}`,
      message: `${parsed.data.title}: ${parsed.data.description}`,
      stateId: parsed.data.stateId,
      senatorialDistrictId: parsed.data.senatorialDistrictId || null,
      lgaId: parsed.data.lgaId,
      wardId: parsed.data.wardId || null,
      pollingUnitId: parsed.data.pollingUnitId || null,
    },
  });

  return response.status(201).json({
    message: "Incident submitted successfully.",
    incident: serializeIncidentItem(incident),
  });
});

export default router;
