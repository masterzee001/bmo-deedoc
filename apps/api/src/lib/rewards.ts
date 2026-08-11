import { NotificationType, RewardRedemptionStatus, RewardType, type Prisma, type PrismaClient } from "@prisma/client";
import { getAuthoritativeBalance } from "./payout-authority";

/**
 * A member's balance, as served to the member.
 *
 * This used to sum the legacy `RewardLedger`. After the cutover those rows are
 * precisely the member's preserved carryover, so it served a non-spendable
 * balance as `availablePoints` on the redemption screen itself — a member with
 * 350 pending carryover points and no authoritative earnings was shown 350
 * spendable. It now delegates to the payout authority, which is the only place
 * a spendable figure is computed.
 *
 * The legacy figures remain available, clearly separated and clearly labelled
 * as not payable, so a member can still see value that was preserved for them.
 */
export async function getRewardBalance(
  transaction: Prisma.TransactionClient | PrismaClient,
  voterUserId: string,
) {
  const balance = await getAuthoritativeBalance(transaction, voterUserId);

  return {
    earnedPoints: balance.confirmedPoints,
    reservedPoints: balance.reservedPoints,
    availablePoints: balance.eligiblePoints,
    legacyCarryoverPendingPoints: balance.legacyCarryoverPendingPoints,
    legacyCarryoverConfirmedPoints: balance.legacyCarryoverConfirmedPoints,
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
