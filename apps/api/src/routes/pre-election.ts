import { Router } from "express";
import type { Request } from "express";
import crypto from "node:crypto";
import {
  ReferralStatus,
  RewardQualifyingEvent,
  UserRole,
  VoterVerificationDecision,
  VoterVerificationStatus,
  type CoordinatorLevel,
} from "@prisma/client";
import { z } from "zod";
import { generateUniqueReferralCode } from "../auth/referral";
import { createAuditLog } from "../lib/audit";
import { processVerifiedReferralReward } from "../lib/pre-election-rewards";
import { requireAuth, requireRole } from "../middleware/auth";
import { prisma } from "../prisma";

const router = Router();

const verificationQueueQuerySchema = z.object({
  status: z.nativeEnum(VoterVerificationStatus).optional(),
  flagged: z.coerce.boolean().optional(),
});

const verificationDecisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT", "REQUEST_RESUBMISSION"]),
  note: z.string().trim().max(1000).optional(),
});

const rewardRuleSchema = z.object({
  name: z.string().trim().min(3).max(120),
  directPoints: z.number().int().min(0).max(100000),
  eligibleRole: z.nativeEnum(UserRole).default(UserRole.COORDINATOR),
  eligibleCoordinatorLevel: z
    .enum(["SENATORIAL_DISTRICT", "FEDERAL_CONSTITUENCY", "STATE_CONSTITUENCY", "WARD", "POLLING_UNIT"])
    .optional(),
  effectiveFrom: z.string().datetime().optional(),
  effectiveUntil: z.string().datetime().optional(),
});

function serializeVerificationCase(verification: {
  id: string;
  memberUserId: string;
  voterIdentifier: string;
  status: VoterVerificationStatus;
  isFlagged: boolean;
  fraudReason: string | null;
  submittedAt: Date | null;
  reviewStartedAt: Date | null;
  reviewedAt: Date | null;
  reviewedByUserId: string | null;
  reviewNote: string | null;
  memberUser: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    voterProfile: {
      stateId: string;
      senatorialDistrictId: string | null;
      federalConstituencyId: string | null;
      stateConstituencyId: string | null;
      lgaId: string;
      wardId: string;
      pollingUnitId: string | null;
    } | null;
  };
  documents: Array<{
    id: string;
    originalFileName: string;
    mimeType: string;
    fileSize: number;
    sha256: string;
    storageProvider: string;
    uploadedAt: Date;
  }>;
  history: Array<{
    id: string;
    fromStatus: VoterVerificationStatus | null;
    toStatus: VoterVerificationStatus;
    decision: VoterVerificationDecision;
    note: string | null;
    createdAt: Date;
    actorUser: { name: string } | null;
  }>;
}) {
  return {
    id: verification.id,
    memberUserId: verification.memberUserId,
    memberName: verification.memberUser.name,
    memberEmail: verification.memberUser.email,
    memberPhone: verification.memberUser.phone,
    voterIdentifier: verification.voterIdentifier,
    status: verification.status,
    isFlagged: verification.isFlagged,
    fraudReason: verification.fraudReason,
    submittedAt: verification.submittedAt?.toISOString() || null,
    reviewStartedAt: verification.reviewStartedAt?.toISOString() || null,
    reviewedAt: verification.reviewedAt?.toISOString() || null,
    reviewedByUserId: verification.reviewedByUserId,
    reviewNote: verification.reviewNote,
    territory: verification.memberUser.voterProfile
      ? {
          stateId: verification.memberUser.voterProfile.stateId,
          senatorialDistrictId: verification.memberUser.voterProfile.senatorialDistrictId,
          federalConstituencyId: verification.memberUser.voterProfile.federalConstituencyId,
          stateConstituencyId: verification.memberUser.voterProfile.stateConstituencyId,
          lgaId: verification.memberUser.voterProfile.lgaId,
          wardId: verification.memberUser.voterProfile.wardId,
          pollingUnitId: verification.memberUser.voterProfile.pollingUnitId,
        }
      : null,
    documents: verification.documents.map((document) => ({
      id: document.id,
      originalFileName: document.originalFileName,
      mimeType: document.mimeType,
      fileSize: document.fileSize,
      sha256: document.sha256,
      storageProvider: document.storageProvider,
      uploadedAt: document.uploadedAt.toISOString(),
    })),
    history: verification.history.map((entry) => ({
      id: entry.id,
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      decision: entry.decision,
      note: entry.note,
      actorName: entry.actorUser?.name || null,
      createdAt: entry.createdAt.toISOString(),
    })),
  };
}

function canUseReferralCode(user: NonNullable<Request["authUser"]>) {
  return user.role === "COORDINATOR" && Boolean(user.coordinatorProfile);
}

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

router.get("/referral-code", requireAuth, async (request, response) => {
  if (!request.authUser || !canUseReferralCode(request.authUser)) {
    return response.status(403).json({ message: "Coordinator referral capability is required." });
  }

  const referralCode = await prisma.$transaction(async (transaction) => {
    const existing = await transaction.referralCode.findFirst({
      where: { ownerUserId: request.authUser!.id, isActive: true },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      return existing;
    }

    return transaction.referralCode.create({
      data: {
        ownerUserId: request.authUser!.id,
        code: await generateUniqueReferralCode(transaction),
      },
    });
  });

  return response.json({
    referralCode: referralCode.code,
    referralLink: `/register?ref=${referralCode.code}`,
  });
});

router.get("/verifications", requireAuth, requireRole("VALIDATOR", "SUPER_ADMIN"), async (request, response) => {
  const parsed = verificationQueueQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid verification queue query.", errors: parsed.error.flatten() });
  }

  const statuses = parsed.data.status
    ? [parsed.data.status]
    : [
        VoterVerificationStatus.PENDING,
        VoterVerificationStatus.UNDER_REVIEW,
        VoterVerificationStatus.RESUBMISSION_REQUIRED,
        VoterVerificationStatus.VERIFIED,
        VoterVerificationStatus.REJECTED,
      ];

  const verifications = await prisma.voterVerification.findMany({
    where: {
      status: { in: statuses },
      isFlagged: parsed.data.flagged === undefined ? undefined : parsed.data.flagged,
    },
    include: {
      memberUser: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          voterProfile: {
            select: {
              stateId: true,
              senatorialDistrictId: true,
              federalConstituencyId: true,
              stateConstituencyId: true,
              lgaId: true,
              wardId: true,
              pollingUnitId: true,
            },
          },
        },
      },
      documents: { orderBy: { uploadedAt: "desc" } },
      history: {
        include: { actorUser: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: [{ isFlagged: "desc" }, { submittedAt: "asc" }],
    take: 100,
  });

  return response.json({ verifications: verifications.map(serializeVerificationCase) });
});

router.post("/verifications/:verificationId/claim", requireAuth, requireRole("VALIDATOR"), async (request, response) => {
  const verificationId = readParam(request.params.verificationId);
  if (!verificationId) {
    return response.status(400).json({ message: "Invalid verification id." });
  }

  const updated = await prisma.$transaction(async (transaction) => {
    const verification = await transaction.voterVerification.findUnique({ where: { id: verificationId } });
    if (!verification) {
      throw new Error("NOT_FOUND");
    }
    if (verification.status === VoterVerificationStatus.UNDER_REVIEW && verification.reviewedByUserId !== request.authUser!.id) {
      throw new Error("ALREADY_CLAIMED");
    }
    if (verification.status !== VoterVerificationStatus.PENDING && verification.status !== VoterVerificationStatus.UNDER_REVIEW) {
      throw new Error("NOT_CLAIMABLE");
    }

    const claimed = await transaction.voterVerification.update({
      where: { id: verification.id },
      data: {
        status: VoterVerificationStatus.UNDER_REVIEW,
        reviewStartedAt: verification.reviewStartedAt || new Date(),
        reviewedByUserId: request.authUser!.id,
      },
    });

    await transaction.voterVerificationHistory.create({
      data: {
        verificationId: verification.id,
        actorUserId: request.authUser!.id,
        fromStatus: verification.status,
        toStatus: VoterVerificationStatus.UNDER_REVIEW,
        decision: VoterVerificationDecision.CLAIMED,
        note: "Verification case claimed by validator.",
      },
    });

    await createAuditLog(transaction, {
      actorUserId: request.authUser!.id,
      action: "VERIFICATION_CLAIMED",
      targetType: "VoterVerification",
      targetId: verification.id,
    });

    return claimed;
  }).catch((error: unknown) => {
    if (error instanceof Error) {
      return error;
    }
    throw error;
  });

  if (updated instanceof Error) {
    if (updated.message === "NOT_FOUND") {
      return response.status(404).json({ message: "Verification case was not found." });
    }
    if (updated.message === "ALREADY_CLAIMED") {
      return response.status(409).json({ message: "Verification case is already claimed by another validator." });
    }
    if (updated.message === "NOT_CLAIMABLE") {
      return response.status(400).json({ message: "Only pending cases can be claimed." });
    }
    throw updated;
  }

  return response.json({ message: "Verification case claimed.", verificationId });
});

router.get(
  "/verifications/:verificationId/documents/:documentId/access",
  requireAuth,
  requireRole("VALIDATOR", "SUPER_ADMIN"),
  async (request, response) => {
    const verificationId = readParam(request.params.verificationId);
    const documentId = readParam(request.params.documentId);
    if (!verificationId || !documentId) {
      return response.status(400).json({ message: "Invalid verification document id." });
    }

    const document = await prisma.voterVerificationDocument.findFirst({
      where: {
        id: documentId,
        verificationId,
      },
      include: {
        verification: {
          select: { id: true, memberUserId: true },
        },
      },
    });

    if (!document) {
      return response.status(404).json({ message: "Verification document was not found." });
    }

    await createAuditLog(prisma, {
      actorUserId: request.authUser!.id,
      action: "VERIFICATION_DOCUMENT_ACCESS_GRANTED",
      targetType: "VoterVerificationDocument",
      targetId: document.id,
      metadata: {
        verificationId: document.verification.id,
        memberUserId: document.verification.memberUserId,
        expiresInSeconds: 300,
      },
    });

    return response.json({
      storageProvider: document.storageProvider,
      storageKey: document.originalStorageKey,
      accessToken: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });
  },
);

router.patch("/verifications/:verificationId/decision", requireAuth, requireRole("VALIDATOR"), async (request, response) => {
  const parsed = verificationDecisionSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid verification decision.", errors: parsed.error.flatten() });
  }

  const verificationId = readParam(request.params.verificationId);
  if (!verificationId) {
    return response.status(400).json({ message: "Invalid verification id." });
  }

  const result = await prisma.$transaction(async (transaction) => {
    const verification = await transaction.voterVerification.findUnique({ where: { id: verificationId } });
    if (!verification) {
      throw new Error("NOT_FOUND");
    }
    if (verification.status === VoterVerificationStatus.VERIFIED || verification.status === VoterVerificationStatus.REJECTED) {
      throw new Error("FINALIZED");
    }
    if (verification.reviewedByUserId && verification.reviewedByUserId !== request.authUser!.id) {
      throw new Error("CLAIMED_BY_OTHER");
    }

    const toStatus =
      parsed.data.decision === "APPROVE"
        ? VoterVerificationStatus.VERIFIED
        : parsed.data.decision === "REJECT"
          ? VoterVerificationStatus.REJECTED
          : VoterVerificationStatus.RESUBMISSION_REQUIRED;
    const historyDecision =
      parsed.data.decision === "APPROVE"
        ? VoterVerificationDecision.APPROVED
        : parsed.data.decision === "REJECT"
          ? VoterVerificationDecision.REJECTED
          : VoterVerificationDecision.RESUBMISSION_REQUIRED;

    const updated = await transaction.voterVerification.update({
      where: { id: verification.id },
      data: {
        status: toStatus,
        reviewedByUserId: request.authUser!.id,
        reviewedAt: new Date(),
        reviewNote: parsed.data.note || null,
      },
    });

    await transaction.voterVerificationHistory.create({
      data: {
        verificationId: verification.id,
        actorUserId: request.authUser!.id,
        fromStatus: verification.status,
        toStatus,
        decision: historyDecision,
        note: parsed.data.note || null,
      },
    });

    if (toStatus === VoterVerificationStatus.VERIFIED) {
      await processVerifiedReferralReward(transaction, { referredUserId: verification.memberUserId });
    } else if (toStatus === VoterVerificationStatus.REJECTED) {
      await transaction.referral.updateMany({
        where: {
          referredUserId: verification.memberUserId,
          status: { in: [ReferralStatus.REGISTERED, ReferralStatus.PENDING_VERIFICATION, ReferralStatus.FLAGGED] },
        },
        data: { status: ReferralStatus.REJECTED },
      });
    }

    await createAuditLog(transaction, {
      actorUserId: request.authUser!.id,
      action: `VERIFICATION_${historyDecision}`,
      targetType: "VoterVerification",
      targetId: verification.id,
      metadata: { fromStatus: verification.status, toStatus },
    });

    return updated;
  }).catch((error: unknown) => {
    if (error instanceof Error) {
      return error;
    }
    throw error;
  });

  if (result instanceof Error) {
    if (result.message === "NOT_FOUND") {
      return response.status(404).json({ message: "Verification case was not found." });
    }
    if (result.message === "FINALIZED") {
      return response.status(409).json({ message: "Finalized verification cases cannot be changed." });
    }
    if (result.message === "CLAIMED_BY_OTHER") {
      return response.status(409).json({ message: "Verification case is claimed by another validator." });
    }
    throw result;
  }

  return response.json({
    message: "Verification decision recorded.",
    verificationId,
    status: result.status,
  });
});

router.post("/reward-rules", requireAuth, requireRole("SUPER_ADMIN"), async (request, response) => {
  const parsed = rewardRuleSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid reward rule payload.", errors: parsed.error.flatten() });
  }

  if (parsed.data.eligibleRole !== UserRole.COORDINATOR && parsed.data.eligibleCoordinatorLevel) {
    return response.status(400).json({ message: "Coordinator level can only be set for coordinator reward rules." });
  }

  const effectiveFrom = parsed.data.effectiveFrom ? new Date(parsed.data.effectiveFrom) : new Date();
  const effectiveUntil = parsed.data.effectiveUntil ? new Date(parsed.data.effectiveUntil) : null;
  if (effectiveUntil && effectiveUntil <= effectiveFrom) {
    return response.status(400).json({ message: "effectiveUntil must be after effectiveFrom." });
  }

  const rule = await prisma.$transaction(async (transaction) => {
    const created = await transaction.rewardRule.create({
      data: {
        name: parsed.data.name,
        qualifyingEvent: RewardQualifyingEvent.VOTER_VERIFICATION_APPROVED,
        eligibleRole: parsed.data.eligibleRole,
        eligibleCoordinatorLevel: (parsed.data.eligibleCoordinatorLevel as CoordinatorLevel | undefined) || null,
        effectiveFrom,
        effectiveUntil,
        createdByUserId: request.authUser!.id,
        versions: {
          create: {
            version: 1,
            directPoints: parsed.data.directPoints,
            effectiveFrom,
          },
        },
      },
      include: { versions: true },
    });

    await createAuditLog(transaction, {
      actorUserId: request.authUser!.id,
      action: "REWARD_RULE_CREATED",
      targetType: "RewardRule",
      targetId: created.id,
      metadata: {
        qualifyingEvent: RewardQualifyingEvent.VOTER_VERIFICATION_APPROVED,
        directPoints: parsed.data.directPoints,
      },
    });

    return created;
  });

  return response.status(201).json({
    message: "Reward rule created.",
    rewardRule: rule,
  });
});

router.get("/reward-rules", requireAuth, requireRole("SUPER_ADMIN"), async (_request, response) => {
  const rules = await prisma.rewardRule.findMany({
    include: { versions: { orderBy: { version: "desc" } } },
    orderBy: { createdAt: "desc" },
  });
  return response.json({ rewardRules: rules });
});

export default router;
