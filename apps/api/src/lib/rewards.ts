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

/**
 * @deprecated The legacy `RewardLedger` is read-only.
 *
 * It is retained so historical balances stay auditable and so migrated
 * carryover records can be traced to the rows they summarise, but it must never
 * gain new earnings. Two writable ledgers meant two balances, and the money-out
 * paths disagreed about which was true: the payout module valued
 * `RewardLedgerEntry` while redemption paid against `RewardLedger`.
 *
 * New earnings belong in `RewardLedgerEntry` through a `RewardEvent`. This
 * throws rather than writing, so a future caller cannot quietly reintroduce the
 * split.
 */
export async function createRewardEntryWithNotification(
  transaction: Prisma.TransactionClient,
  input: {
    voterUserId: string;
    type: RewardType;
    points: number;
    description: string;
    relatedUserId?: string | null;
  },
): Promise<never> {
  void transaction;
  void NotificationType;
  throw new Error(
    `The legacy RewardLedger is read-only and cannot accept a ${input.type} credit of ${input.points} points. ` +
      "Post new earnings to RewardLedgerEntry through a RewardEvent so one balance governs every money-out path.",
  );
}
