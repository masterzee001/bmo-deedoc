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

  return { processed: true, rewardEventId: rewardEvent.id, ruleVersionId: ruleVersion.id };
}
