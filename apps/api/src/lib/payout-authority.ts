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

/** Payout statuses that hold points against a member's balance. */
const RESERVING_PAYOUT_STATUSES = [
  PayoutStatus.PENDING,
  PayoutStatus.ELIGIBLE,
  PayoutStatus.APPROVED,
  PayoutStatus.PROCESSING,
  PayoutStatus.PAID,
  PayoutStatus.HELD,
] as const;

/** Redemption statuses that hold points against the same balance. */
const RESERVING_REDEMPTION_STATUSES = ["PENDING", "APPROVED", "PAID"] as const;

const EMPTY_BALANCE: AuthoritativeBalance = {
  confirmedPoints: 0,
  reservedPoints: 0,
  eligiblePoints: 0,
  legacyCarryoverPendingPoints: 0,
  legacyCarryoverConfirmedPoints: 0,
};

/**
 * Authoritative balances for many members in one set of queries.
 *
 * The payout-cycle path values every eligible member at once and cannot afford
 * a query per member, so this exists rather than a loop over the single-member
 * function — which is itself implemented in terms of this one, so the two can
 * never drift. That drift was the original defect: a hand-rolled cycle query
 * subtracted only payout-assignment reservations and not redemptions, letting
 * the same points be spent through both money-out paths.
 *
 * `legacyCarryoverPendingPoints` is reported separately and deliberately
 * excluded from `eligiblePoints`, so a preserved balance is visible to the
 * member without being spendable. Surfacing it inside the eligible figure would
 * create monetary value from an unverified conversion assumption.
 */
export async function getAuthoritativeBalances(
  client: Client,
  userIds?: string[],
): Promise<Map<string, AuthoritativeBalance>> {
  if (userIds && userIds.length === 0) {
    return new Map();
  }
  const scope = userIds ? { in: userIds } : undefined;

  const [
    earned,
    reservedAssignments,
    reservedRedemptions,
    pendingCarryover,
    confirmedCarryover,
    legacyFundedReservations,
  ] = await Promise.all([
    client.rewardLedgerEntry.groupBy({
      by: ["userId"],
      where: scope ? { userId: scope } : {},
      _sum: { points: true },
    }),
    client.payoutAssignment.groupBy({
      by: ["beneficiaryUserId"],
      where: { ...(scope ? { beneficiaryUserId: scope } : {}), status: { in: [...RESERVING_PAYOUT_STATUSES] } },
      _sum: { points: true },
    }),
    // Redemptions reserve against the same balance, so a member cannot spend
    // the same points through both money-out paths.
    client.rewardRedemption.groupBy({
      by: ["voterUserId"],
      where: { ...(scope ? { voterUserId: scope } : {}), status: { in: [...RESERVING_REDEMPTION_STATUSES] } },
      _sum: { pointsRequested: true },
    }),
    client.legacyBalanceCarryover.groupBy({
      by: ["userId"],
      where: { ...(scope ? { userId: scope } : {}), status: "LEGACY_CARRYOVER_PENDING" },
      _sum: { legacyPointBalance: true },
    }),
    client.legacyBalanceCarryover.groupBy({
      by: ["userId"],
      where: { ...(scope ? { userId: scope } : {}), status: "LEGACY_CARRYOVER_CONFIRMED" },
      _sum: { creditedPoints: true },
    }),
    // How much of each member's legacy balance was already committed to a
    // redemption at cutover time, across every carryover regardless of status.
    client.legacyBalanceCarryover.groupBy({
      by: ["userId"],
      where: scope ? { userId: scope } : {},
      _sum: { legacyReservedPoints: true },
    }),
  ]);

  const assignmentPoints = new Map(reservedAssignments.map((row) => [row.beneficiaryUserId, row._sum.points || 0]));
  const redemptionPoints = new Map(reservedRedemptions.map((row) => [row.voterUserId, row._sum.pointsRequested || 0]));
  const pendingPoints = new Map(pendingCarryover.map((row) => [row.userId, row._sum.legacyPointBalance || 0]));
  const confirmedPointsByUser = new Map(confirmedCarryover.map((row) => [row.userId, row._sum.creditedPoints || 0]));
  const legacyReserved = new Map(legacyFundedReservations.map((row) => [row.userId, row._sum.legacyReservedPoints || 0]));

  // Every member touched by any of the five queries, so a member who holds only
  // a carryover or only a reservation is not silently dropped.
  const everyUserId = new Set<string>([
    ...earned.map((row) => row.userId),
    ...assignmentPoints.keys(),
    ...redemptionPoints.keys(),
    ...pendingPoints.keys(),
    ...confirmedPointsByUser.keys(),
    ...legacyReserved.keys(),
  ]);
  const earnedPoints = new Map(earned.map((row) => [row.userId, row._sum.points || 0]));

  const balances = new Map<string, AuthoritativeBalance>();
  for (const userId of everyUserId) {
    const confirmedPoints = earnedPoints.get(userId) || 0;
    // A redemption raised before the cutover was funded by the legacy ledger,
    // whose value is held as carryover and deliberately excluded from
    // confirmedPoints. Charging it against authoritative earnings too would let
    // an already-paid redemption consume points the member earned afterwards,
    // so the portion the cutover recorded as legacy-funded is netted off.
    const redemptionReservation = Math.max(
      (redemptionPoints.get(userId) || 0) - (legacyReserved.get(userId) || 0),
      0,
    );
    const reservedPoints = (assignmentPoints.get(userId) || 0) + redemptionReservation;
    balances.set(userId, {
      confirmedPoints,
      reservedPoints,
      eligiblePoints: Math.max(confirmedPoints - reservedPoints, 0),
      legacyCarryoverPendingPoints: pendingPoints.get(userId) || 0,
      legacyCarryoverConfirmedPoints: confirmedPointsByUser.get(userId) || 0,
    });
  }
  return balances;
}

/** A single member's authoritative balance. One implementation, shared above. */
export async function getAuthoritativeBalance(client: Client, userId: string): Promise<AuthoritativeBalance> {
  const balances = await getAuthoritativeBalances(client, [userId]);
  return balances.get(userId) || EMPTY_BALANCE;
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

export type PayoutTerms = {
  payoutConfigurationId: string;
  minimumThreshold: number;
  conversionRate: Prisma.Decimal;
};

/**
 * The active threshold and conversion rate, read from versioned configuration.
 *
 * This is the only place either figure enters the system. A payout cycle
 * snapshots these at creation instead of accepting them in a request body, so a
 * cycle's terms are both immutable for its lifetime and server-derived — before
 * this, a client could post its own `conversionRate` when creating a cycle, and
 * that rate was what every assignment in it was paid at.
 */
export async function resolveActivePayoutTerms(client: Client): Promise<PayoutTerms> {
  const configuration = await client.payoutConfiguration.findFirst({
    where: { active: true },
    orderBy: { createdAt: "desc" },
  });

  if (!configuration) {
    throw new Error("No active payout configuration exists; a Super Admin must configure minimum points and conversion rate.");
  }

  return {
    payoutConfigurationId: configuration.id,
    minimumThreshold: configuration.minimumPoints,
    conversionRate: configuration.pointConversionRate,
  };
}

export type BeneficiaryValuation = {
  userId: string;
  availablePoints: number;
  amount: Prisma.Decimal;
};

/**
 * Values every member who qualifies under the given terms.
 *
 * The payout-cycle path used to do this itself: its own aggregation, its own
 * reservation subtraction, its own multiply and its own threshold filter. It
 * now computes nothing — the balance comes from the authority, so both money-out
 * paths agree on what a member is owed, and the terms are a snapshot this module
 * produced rather than a figure a caller chose.
 */
export async function valueEligibleBeneficiaries(
  client: Client,
  terms: Pick<PayoutTerms, "minimumThreshold" | "conversionRate">,
  userIds?: string[],
): Promise<BeneficiaryValuation[]> {
  const balances = await getAuthoritativeBalances(client, userIds);

  return [...balances.entries()]
    .map(([userId, balance]) => ({
      userId,
      availablePoints: balance.eligiblePoints,
      amount: new Prisma.Decimal(balance.eligiblePoints).mul(terms.conversionRate).toDecimalPlaces(2),
    }))
    .filter((item) => item.availablePoints >= terms.minimumThreshold && item.amount.greaterThan(0));
}

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
  const terms = await resolveActivePayoutTerms(client);
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
  } else if (requestedPoints < terms.minimumThreshold) {
    reason = `Requested points are below the configured minimum payout threshold of ${terms.minimumThreshold}.`;
  }

  const meetsThreshold = reason === null;
  const payableAmount = meetsThreshold
    ? new Prisma.Decimal(requestedPoints).mul(terms.conversionRate).toDecimalPlaces(2)
    : new Prisma.Decimal(0);

  return {
    eligiblePoints: balance.eligiblePoints,
    requestedPoints,
    meetsThreshold,
    minimumThreshold: terms.minimumThreshold,
    conversionRate: terms.conversionRate.toString(),
    payableAmount,
    payoutConfigurationId: terms.payoutConfigurationId,
    reason,
  };
}

/**
 * Converts a preserved legacy balance under an approved equivalence ratio.
 *
 * Credits the **unspent** portion. A carryover records both the gross legacy
 * balance and how much of it a redemption had already committed at cutover; the
 * committed portion was paid out of legacy value, so converting it again would
 * pay for it twice. `getAuthoritativeBalances` nets that same figure off the
 * redemption reservation, and the two must agree or the member is either
 * credited for value they already received or charged for it twice.
 *
 * Exact decimal arithmetic, deliberately: in binary floating point 100 × 0.29
 * evaluates to 28.999999999999996 and floors to 28. Money is never a double.
 */
export function valueLegacyCarryover(carryover: {
  legacyPointBalance: number;
  legacyReservedPoints: number;
  conversionRatio: Prisma.Decimal | number | string;
}) {
  const unspent = Math.max(carryover.legacyPointBalance - carryover.legacyReservedPoints, 0);
  return new Prisma.Decimal(unspent).mul(new Prisma.Decimal(carryover.conversionRatio)).floor().toNumber();
}
