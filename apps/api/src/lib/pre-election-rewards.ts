import {
  ReferralStatus,
  RewardEventStatus,
  RewardLedgerCategory,
  RewardQualifyingEvent,
  type Prisma,
} from "@prisma/client";

export async function processVerifiedReferralReward(
  transaction: Prisma.TransactionClient,
  input: {
    referredUserId: string;
  },
) {
  const referral = await transaction.referral.findUnique({
    where: { referredUserId: input.referredUserId },
    include: {
      referrerUser: {
        include: {
          coordinatorProfile: true,
        },
      },
    },
  });

  if (!referral || referral.status === ReferralStatus.REJECTED || referral.status === ReferralStatus.FLAGGED) {
    return { processed: false, reason: "NO_QUALIFYING_REFERRAL" as const };
  }

  if (!referral.qualifiedAt) {
    await transaction.referral.update({
      where: { id: referral.id },
      data: {
        status: ReferralStatus.QUALIFIED,
        qualifiedAt: new Date(),
      },
    });
  }

  const now = new Date();
  const level = referral.referrerUser.coordinatorProfile?.level || null;
  const ruleVersion = await transaction.rewardRuleVersion.findFirst({
    where: {
      effectiveFrom: { lte: now },
      rewardRule: {
        qualifyingEvent: RewardQualifyingEvent.VOTER_VERIFICATION_APPROVED,
        active: true,
        effectiveFrom: { lte: now },
        eligibleRole: referral.referrerUser.role,
        AND: [
          { OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }] },
          {
            OR: level
              ? [{ eligibleCoordinatorLevel: null }, { eligibleCoordinatorLevel: level }]
              : [{ eligibleCoordinatorLevel: null }],
          },
        ],
      },
    },
    include: {
      rewardRule: true,
    },
    orderBy: [{ effectiveFrom: "desc" }, { version: "desc" }],
  });

  const idempotencyKey = `verified-referral:${referral.id}`;
  const rewardEvent = await transaction.rewardEvent.upsert({
    where: {
      eventType_sourceType_sourceId: {
        eventType: RewardQualifyingEvent.VOTER_VERIFICATION_APPROVED,
        sourceType: "Referral",
        sourceId: referral.id,
      },
    },
    create: {
      eventType: RewardQualifyingEvent.VOTER_VERIFICATION_APPROVED,
      sourceType: "Referral",
      sourceId: referral.id,
      referralId: referral.id,
      rewardRuleVersionId: ruleVersion?.id || null,
      status: ruleVersion ? RewardEventStatus.PENDING : RewardEventStatus.SKIPPED,
      idempotencyKey,
    },
    update: {
      rewardRuleVersionId: ruleVersion?.id || undefined,
    },
  });

  if (!ruleVersion || ruleVersion.directPoints <= 0) {
    return { processed: false, reason: "NO_ACTIVE_RULE" as const, rewardEventId: rewardEvent.id };
  }

  await transaction.rewardLedgerEntry.upsert({
    where: {
      userId_sourceEventId_category: {
        userId: referral.referrerUserId,
        sourceEventId: rewardEvent.id,
        category: RewardLedgerCategory.VERIFIED_REFERRAL,
      },
    },
    create: {
      userId: referral.referrerUserId,
      points: ruleVersion.directPoints,
      category: RewardLedgerCategory.VERIFIED_REFERRAL,
      sourceEventType: RewardQualifyingEvent.VOTER_VERIFICATION_APPROVED,
      sourceEventId: rewardEvent.id,
      rewardRuleVersionId: ruleVersion.id,
      relatedUserId: referral.referredUserId,
      description: `Verified referral reward for ${referral.referredUserId}`,
    },
    update: {},
  });

  await transaction.rewardEvent.update({
    where: { id: rewardEvent.id },
    data: {
      status: RewardEventStatus.PROCESSED,
      processedAt: new Date(),
      rewardRuleVersionId: ruleVersion.id,
    },
  });

  await transaction.referral.update({
    where: { id: referral.id },
    data: {
      status: ReferralStatus.REWARD_PROCESSED,
      rewardProcessedAt: new Date(),
    },
  });

  const bonuses = await processReferralMilestoneBonuses(transaction, { userId: referral.referrerUserId });

  return { processed: true, rewardEventId: rewardEvent.id, ruleVersionId: ruleVersion.id, bonuses };
}

/**
 * Awards system-controlled bonus points (Feature 043).
 *
 * Bonus points exist only through this path. There is no endpoint that accepts a
 * bonus amount, so no operator — Payout Officer included — can invent one. The
 * amount always comes from a versioned rule that only a Super Admin can create,
 * and the trigger is a count the system computes from qualified referrals rather
 * than a figure anyone types in.
 *
 * Idempotency is keyed on (user, threshold), so re-running verification or
 * replaying a reward never pays the same milestone twice, and crossing several
 * thresholds at once awards each exactly once.
 */
export async function processReferralMilestoneBonuses(
  transaction: Prisma.TransactionClient,
  input: { userId: string },
) {
  const user = await transaction.user.findUnique({
    where: { id: input.userId },
    include: { coordinatorProfile: true },
  });
  if (!user) {
    return { awarded: [] as Array<{ threshold: number; points: number }> };
  }

  // Only referrals that actually qualified count toward a milestone.
  const qualifiedReferrals = await transaction.referral.count({
    where: {
      referrerUserId: input.userId,
      status: { in: [ReferralStatus.QUALIFIED, ReferralStatus.REWARD_PROCESSED] },
    },
  });
  if (qualifiedReferrals === 0) {
    return { awarded: [] as Array<{ threshold: number; points: number }> };
  }

  const now = new Date();
  const level = user.coordinatorProfile?.level || null;
  const milestoneVersions = await transaction.rewardRuleVersion.findMany({
    where: {
      effectiveFrom: { lte: now },
      milestoneThreshold: { not: null, lte: qualifiedReferrals },
      rewardRule: {
        qualifyingEvent: RewardQualifyingEvent.REFERRAL_MILESTONE_REACHED,
        active: true,
        effectiveFrom: { lte: now },
        eligibleRole: user.role,
        AND: [
          { OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }] },
          {
            OR: level
              ? [{ eligibleCoordinatorLevel: null }, { eligibleCoordinatorLevel: level }]
              : [{ eligibleCoordinatorLevel: null }],
          },
        ],
      },
    },
    orderBy: [{ milestoneThreshold: "asc" }, { effectiveFrom: "desc" }, { version: "desc" }],
  });

  // One award per threshold: if several rule versions target the same
  // threshold, the most recent effective version wins.
  const versionByThreshold = new Map<number, (typeof milestoneVersions)[number]>();
  for (const version of milestoneVersions) {
    const threshold = version.milestoneThreshold!;
    if (!versionByThreshold.has(threshold)) {
      versionByThreshold.set(threshold, version);
    }
  }

  const awarded: Array<{ threshold: number; points: number }> = [];

  for (const [threshold, version] of [...versionByThreshold.entries()].sort((left, right) => left[0] - right[0])) {
    if (version.directPoints <= 0) {
      continue;
    }

    const sourceId = `${input.userId}:${threshold}`;
    const existing = await transaction.rewardEvent.findUnique({
      where: {
        eventType_sourceType_sourceId: {
          eventType: RewardQualifyingEvent.REFERRAL_MILESTONE_REACHED,
          sourceType: "ReferralMilestone",
          sourceId,
        },
      },
    });
    if (existing?.status === RewardEventStatus.PROCESSED) {
      continue;
    }

    const bonusEvent = await transaction.rewardEvent.upsert({
      where: {
        eventType_sourceType_sourceId: {
          eventType: RewardQualifyingEvent.REFERRAL_MILESTONE_REACHED,
          sourceType: "ReferralMilestone",
          sourceId,
        },
      },
      create: {
        eventType: RewardQualifyingEvent.REFERRAL_MILESTONE_REACHED,
        sourceType: "ReferralMilestone",
        sourceId,
        rewardRuleVersionId: version.id,
        status: RewardEventStatus.PENDING,
        idempotencyKey: `referral-milestone:${sourceId}`,
      },
      update: { rewardRuleVersionId: version.id },
    });

    await transaction.rewardLedgerEntry.upsert({
      where: {
        userId_sourceEventId_category: {
          userId: input.userId,
          sourceEventId: bonusEvent.id,
          category: RewardLedgerCategory.BONUS,
        },
      },
      create: {
        userId: input.userId,
        points: version.directPoints,
        category: RewardLedgerCategory.BONUS,
        sourceEventType: RewardQualifyingEvent.REFERRAL_MILESTONE_REACHED,
        sourceEventId: bonusEvent.id,
        rewardRuleVersionId: version.id,
        description: `System bonus for reaching ${threshold} qualified referrals`,
      },
      update: {},
    });

    await transaction.rewardEvent.update({
      where: { id: bonusEvent.id },
      data: { status: RewardEventStatus.PROCESSED, processedAt: new Date() },
    });

    awarded.push({ threshold, points: version.directPoints });
  }

  return { awarded };
}
