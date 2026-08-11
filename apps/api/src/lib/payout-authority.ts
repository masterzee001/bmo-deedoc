import { PayoutStatus, Prisma, type PrismaClient } from "@prisma/client";
import { env } from "../env";

type Client = Prisma.TransactionClient | PrismaClient;

/**
 * The single authority for what a member is owed.
 *
 * Every money-out path in the platform must compute value here. Before this
 * existed there were two: the payout-cycle path read `RewardLedgerEntry` and
 * applied the configured threshold and conversion rate, while the redemption
 * path read the legacy `RewardLedger`, applied neither, and accepted a
 * client-supplied monetary amount. A member holding one point could be paid.
 *
 * Rules enforced here, and nowhere else:
 *   - `RewardLedgerEntry` is financial truth.
 *   - A migrated legacy balance is preserved but never spendable until an
 *     approved equivalence ratio credits it.
 *   - The client never supplies a monetary amount.
 *   - The minimum threshold and the conversion rate come from versioned
 *     configuration, server-side.
 */

export class PayoutExecutionDisabledError extends Error {
  constructor() {
    super(
      "Payout execution is disabled. Set PAYOUT_EXECUTION_ENABLED=true only after reconciliation and readiness gates have passed.",
    );
    this.name = "PayoutExecutionDisabledError";
  }
}

/**
 * The kill switch.
 *
 * Defaults to disabled in **every** environment, production included. Enabling
 * it is a deliberate operator action taken after reconciliation completes, not
 * a consequence of deploying to production. This means an authorization slip or
 * a UI mistake cannot move money on its own.
 */
let payoutExecutionOverride: boolean | null = null;

export function isPayoutExecutionEnabled() {
  return payoutExecutionOverride ?? env.PAYOUT_EXECUTION_ENABLED;
}

/**
 * Test-only override, so the suite can prove both states of the switch: that
 * execution is refused by default, and that it proceeds once an operator
 * enables it. Refuses to run outside NODE_ENV=test, so it can never be used to
 * enable payouts in a deployed environment.
 */
export function setPayoutExecutionEnabledForTests(value: boolean | null) {
  if (env.NODE_ENV !== "test") {
    throw new Error("Payout execution override is only available in test mode.");
  }
  payoutExecutionOverride = value;
}

export function assertPayoutExecutionEnabled() {
  if (!isPayoutExecutionEnabled()) {
    throw new PayoutExecutionDisabledError();
  }
}

export type AuthoritativeBalance = {
  /** Points earned in the authoritative ledger. */
  confirmedPoints: number;
  /** Points already committed to a payout assignment or redemption. */
  reservedPoints: number;
  /** confirmedPoints - reservedPoints, floored at zero. The only spendable figure. */
  eligiblePoints: number;
  /** Preserved legacy balance awaiting an approved equivalence ratio. Never spendable. */
  legacyCarryoverPendingPoints: number;
  /** Legacy points already credited under an approved rule; included in confirmedPoints. */
  legacyCarryoverConfirmedPoints: number;
};

/**
 * Computes a member's authoritative balance.
 *
 * `legacyCarryoverPendingPoints` is reported separately and deliberately
 * excluded from `eligiblePoints`, so a preserved balance is visible to the
 * member without being spendable. Surfacing it inside the eligible figure would
 * create monetary value from an unverified conversion assumption.
 */
export async function getAuthoritativeBalance(client: Client, userId: string): Promise<AuthoritativeBalance> {
  const [earned, reservedAssignments, reservedRedemptions, pendingCarryover, confirmedCarryover] = await Promise.all([
    client.rewardLedgerEntry.aggregate({ where: { userId }, _sum: { points: true } }),
    client.payoutAssignment.aggregate({
      where: {
        beneficiaryUserId: userId,
        status: {
          in: [
            PayoutStatus.PENDING,
            PayoutStatus.ELIGIBLE,
            PayoutStatus.APPROVED,
            PayoutStatus.PROCESSING,
            PayoutStatus.PAID,
            PayoutStatus.HELD,
          ],
        },
      },
      _sum: { points: true },
    }),
    // Redemptions reserve against the same balance, so a member cannot spend
    // the same points through both money-out paths.
    client.rewardRedemption.aggregate({
      where: { voterUserId: userId, status: { in: ["PENDING", "APPROVED", "PAID"] } },
      _sum: { pointsRequested: true },
    }),
    client.legacyBalanceCarryover.aggregate({
      where: { userId, status: "LEGACY_CARRYOVER_PENDING" },
      _sum: { legacyPointBalance: true },
    }),
    client.legacyBalanceCarryover.aggregate({
      where: { userId, status: "LEGACY_CARRYOVER_CONFIRMED" },
      _sum: { creditedPoints: true },
    }),
  ]);

  const confirmedPoints = earned._sum.points || 0;
  const reservedPoints = (reservedAssignments._sum.points || 0) + (reservedRedemptions._sum.pointsRequested || 0);

  return {
    confirmedPoints,
    reservedPoints,
    eligiblePoints: Math.max(confirmedPoints - reservedPoints, 0),
    legacyCarryoverPendingPoints: pendingCarryover._sum.legacyPointBalance || 0,
    legacyCarryoverConfirmedPoints: confirmedCarryover._sum.creditedPoints || 0,
  };
}

export type PayoutValuation = {
  eligiblePoints: number;
  requestedPoints: number;
  meetsThreshold: boolean;
  minimumThreshold: number;
  conversionRate: string;
  payableAmount: Prisma.Decimal;
  payoutConfigurationId: string;
  reason: string | null;
};

/**
 * Converts points to money using the active configuration.
 *
 * The caller may request a number of points; it may never assert the amount.
 * The rate and threshold are read here from the stored configuration, so the
 * monetary figure is always server-derived and always traceable to the
 * configuration row that produced it.
 */
export async function valuePayout(
  client: Client,
  input: { userId: string; requestedPoints: number },
): Promise<PayoutValuation> {
  const configuration = await client.payoutConfiguration.findFirst({
    where: { active: true },
    orderBy: { createdAt: "desc" },
  });

  if (!configuration) {
    throw new Error("No active payout configuration exists; a Super Admin must configure minimum points and conversion rate.");
  }

  const balance = await getAuthoritativeBalance(client, input.userId);
  const requestedPoints = Math.trunc(input.requestedPoints);

  let reason: string | null = null;
  if (requestedPoints <= 0) {
    reason = "Requested points must be a positive whole number.";
  } else if (requestedPoints > balance.eligiblePoints) {
    reason =
      balance.legacyCarryoverPendingPoints > 0
        ? "Requested points exceed the eligible balance. A legacy balance is preserved but is not payable until reconciliation is approved."
        : "Requested points exceed the eligible balance.";
  } else if (requestedPoints < configuration.minimumPoints) {
    reason = `Requested points are below the configured minimum payout threshold of ${configuration.minimumPoints}.`;
  }

  const meetsThreshold = reason === null;
  const payableAmount = meetsThreshold
    ? new Prisma.Decimal(requestedPoints).mul(configuration.pointConversionRate).toDecimalPlaces(2)
    : new Prisma.Decimal(0);

  return {
    eligiblePoints: balance.eligiblePoints,
    requestedPoints,
    meetsThreshold,
    minimumThreshold: configuration.minimumPoints,
    conversionRate: configuration.pointConversionRate.toString(),
    payableAmount,
    payoutConfigurationId: configuration.id,
    reason,
  };
}
