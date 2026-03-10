import { NotificationType, RewardRedemptionStatus, RewardType, type Prisma, type PrismaClient } from "@prisma/client";

export async function getRewardBalance(
  transaction: Prisma.TransactionClient | PrismaClient,
  voterUserId: string,
) {
  const [earned, reserved] = await Promise.all([
    transaction.rewardLedger.aggregate({
      where: { voterUserId },
      _sum: { points: true },
    }),
    transaction.rewardRedemption.aggregate({
      where: {
        voterUserId,
        status: {
          in: [
            RewardRedemptionStatus.PENDING,
            RewardRedemptionStatus.APPROVED,
            RewardRedemptionStatus.PAID,
          ],
        },
      },
      _sum: { pointsRequested: true },
    }),
  ]);

  const earnedPoints = earned._sum.points || 0;
  const reservedPoints = reserved._sum.pointsRequested || 0;

  return {
    earnedPoints,
    reservedPoints,
    availablePoints: Math.max(earnedPoints - reservedPoints, 0),
  };
}

export async function createRewardEntryWithNotification(
  transaction: Prisma.TransactionClient,
  input: {
    voterUserId: string;
    type: RewardType;
    points: number;
    description: string;
    relatedUserId?: string | null;
  },
) {
  const reward = await transaction.rewardLedger.create({
    data: {
      voterUserId: input.voterUserId,
      type: input.type,
      points: input.points,
      description: input.description,
      relatedUserId: input.relatedUserId || null,
    },
  });

  await transaction.notification.create({
    data: {
      userId: input.voterUserId,
      type: NotificationType.REWARD_EARNED,
      title: "Reward earned",
      message: `${input.points} points added to your account.`,
    },
  });

  return reward;
}
