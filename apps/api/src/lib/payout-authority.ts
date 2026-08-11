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
  /**
   * Reserving redemptions raised at or before this member's cutover. Reported
   * so a legacy-era claim against the authoritative balance is visible; it is
   * fully counted in `reservedPoints` and is deliberately not netted off.
   */
  preCutoverReservedPoints: number;
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
  preCutoverReservedPoints: 0,
};

/**
 * Reserving redemptions a member raised at or before their cutover.
 *
 * **Reported, never subtracted.** An earlier version of this code netted these
 * off the authoritative reservation, on the reasoning that legacy value had
 * funded them so authoritative earnings should not be charged twice. That
 * reasoning silently priced a preserved balance at parity: releasing a
 * reservation of N points because a pending carryover of N legacy points exists
 * *is* paying out that carryover at 1:1, which is the single assumption this
 * whole cutover exists to refuse. It also disagreed with reconciliation, which
 * applies the approved ratio — so at any ratio below parity the member could
 * receive more than the organisation had valued the balance at.
 *
 * What to do about a pre-cutover redemption is a reconciliation policy question
 * and no approved policy exists. Until one does, the conservative reading
 * applies: the reservation stands, so the platform can never over-pay, and the
 * figure is surfaced separately so the situation is visible rather than silent.
 * Such a redemption is also refused at execution while its carryover is pending
 * (see `isUnreconciledLegacyClaim`), so nothing is settled on a guess.
 */
async function getPreCutoverReservations(
  client: Client,
  userIds?: string[],
  excludeRedemptionIds?: string[],
): Promise<Map<string, number>> {
  const scope = userIds ? { in: userIds } : undefined;

  const carryovers = await client.legacyBalanceCarryover.findMany({
    where: { ...(scope ? { userId: scope } : {}), status: { not: "LEGACY_CARRYOVER_VOID" } },
    select: { userId: true, migrationBatch: { select: { executedAt: true } } },
  });
  if (carryovers.length === 0) {
    return new Map();
  }

  // One cutover instant per member — the latest — so a member carried in two
  // batches is counted once rather than once per batch.
  const cutoverByUser = new Map<string, number>();
  for (const carryover of carryovers) {
    const cutoverAt = carryover.migrationBatch.executedAt.getTime();
    cutoverByUser.set(carryover.userId, Math.max(cutoverByUser.get(carryover.userId) || 0, cutoverAt));
  }

  const usersByCutover = new Map<number, string[]>();
  for (const [userId, cutoverAt] of cutoverByUser) {
    usersByCutover.set(cutoverAt, [...(usersByCutover.get(cutoverAt) || []), userId]);
  }

  const perCutover = await Promise.all(
    [...usersByCutover.entries()].map(([cutoverAt, users]) =>
      client.rewardRedemption.groupBy({
        by: ["voterUserId"],
        where: {
          voterUserId: { in: users },
          status: { in: [...RESERVING_REDEMPTION_STATUSES] },
          createdAt: { lte: new Date(cutoverAt) },
          ...(excludeRedemptionIds?.length ? { id: { notIn: excludeRedemptionIds } } : {}),
        },
        _sum: { pointsRequested: true },
      }),
    ),
  );

  const preCutover = new Map<string, number>();
  for (const rows of perCutover) {
    for (const row of rows) {
      preCutover.set(row.voterUserId, row._sum.pointsRequested || 0);
    }
  }
  return preCutover;
}

/**
 * Whether a redemption is a claim on a legacy balance that is still preserved
 * and unreconciled — raised at or before the member's cutover, against a
 * carryover no approved ratio has converted yet.
 *
 * Such a redemption must not be paid. The value behind it is deliberately
 * non-spendable, so executing it would disburse carryover at an equivalence
 * nobody approved.
 */
export async function isUnreconciledLegacyClaim(
  client: Client,
  redemption: { voterUserId: string; createdAt: Date },
): Promise<boolean> {
  const carryovers = await client.legacyBalanceCarryover.findMany({
    where: { userId: redemption.voterUserId, status: { not: "LEGACY_CARRYOVER_VOID" } },
    select: { status: true, migrationBatch: { select: { executedAt: true } } },
  });
  return carryovers.some(
    (carryover) =>
      carryover.status === "LEGACY_CARRYOVER_PENDING" &&
      carryover.migrationBatch.executedAt.getTime() >= redemption.createdAt.getTime(),
  );
}

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
  /**
   * Redemptions to leave out of the reservation entirely, used when re-valuing
   * one of them. Excluding the row is exact; adding its points back afterwards
   * is not, because a pre-cutover redemption is already netted out by the
   * legacy offset and would then be credited twice — once as a reservation that
   * was never charged, once as an add-back — turning unreconciled carryover
   * into spendable points.
   */
  excludeRedemptionIds?: string[],
): Promise<Map<string, AuthoritativeBalance>> {
  if (userIds && userIds.length === 0) {
    return new Map();
  }
  const scope = userIds ? { in: userIds } : undefined;
  const redemptionExclusion = excludeRedemptionIds?.length ? { id: { notIn: excludeRedemptionIds } } : {};

  const [
    earned,
    reservedAssignments,
    reservedRedemptions,
    pendingCarryover,
    confirmedCarryover,
    preCutoverReservations,
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
      where: {
        ...(scope ? { voterUserId: scope } : {}),
        ...redemptionExclusion,
        status: { in: [...RESERVING_REDEMPTION_STATUSES] },
      },
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
    getPreCutoverReservations(client, userIds, excludeRedemptionIds),
  ]);

  const assignmentPoints = new Map(reservedAssignments.map((row) => [row.beneficiaryUserId, row._sum.points || 0]));
  const redemptionPoints = new Map(reservedRedemptions.map((row) => [row.voterUserId, row._sum.pointsRequested || 0]));
  const pendingPoints = new Map(pendingCarryover.map((row) => [row.userId, row._sum.legacyPointBalance || 0]));
  const confirmedPointsByUser = new Map(confirmedCarryover.map((row) => [row.userId, row._sum.creditedPoints || 0]));
  const preCutoverReserved = preCutoverReservations;

  // Every member touched by any of the five queries, so a member who holds only
  // a carryover or only a reservation is not silently dropped.
  const everyUserId = new Set<string>([
    ...earned.map((row) => row.userId),
    ...assignmentPoints.keys(),
    ...redemptionPoints.keys(),
    ...pendingPoints.keys(),
    ...confirmedPointsByUser.keys(),
    ...preCutoverReserved.keys(),
  ]);
  const earnedPoints = new Map(earned.map((row) => [row.userId, row._sum.points || 0]));

  const balances = new Map<string, AuthoritativeBalance>();
  for (const userId of everyUserId) {
    const confirmedPoints = earnedPoints.get(userId) || 0;
    // Every reserving redemption is charged, including one raised before the
    // cutover. Releasing that reservation because a carryover exists would
    // price the preserved balance at parity, which no approved ratio has
    // authorised. The pre-cutover figure is reported instead, so the situation
    // is visible without being valued.
    const reservedPoints = (assignmentPoints.get(userId) || 0) + (redemptionPoints.get(userId) || 0);
    balances.set(userId, {
      confirmedPoints,
      reservedPoints,
      eligiblePoints: Math.max(confirmedPoints - reservedPoints, 0),
      legacyCarryoverPendingPoints: pendingPoints.get(userId) || 0,
      legacyCarryoverConfirmedPoints: confirmedPointsByUser.get(userId) || 0,
      preCutoverReservedPoints: preCutoverReserved.get(userId) || 0,
    });
  }
  return balances;
}

/** A single member's authoritative balance. One implementation, shared above. */
export async function getAuthoritativeBalance(
  client: Client,
  userId: string,
  excludeRedemptionIds?: string[],
): Promise<AuthoritativeBalance> {
  const balances = await getAuthoritativeBalances(client, [userId], excludeRedemptionIds);
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
  input: {
    userId: string;
    requestedPoints: number;
    /**
     * The redemption being re-valued, if any. It is excluded from the balance
     * rather than added back to it: re-valuing must not charge a redemption
     * against a balance it is itself reserving, and excluding the row is the
     * only form of that correction which stays right for a pre-cutover
     * redemption the legacy offset has already removed.
     */
    excludeRedemptionId?: string;
  },
): Promise<PayoutValuation> {
  const terms = await resolveActivePayoutTerms(client);
  const balance = await getAuthoritativeBalance(
    client,
    input.userId,
    input.excludeRedemptionId ? [input.excludeRedemptionId] : undefined,
  );
  const requestedPoints = Math.trunc(input.requestedPoints);
  const eligiblePoints = balance.eligiblePoints;

  let reason: string | null = null;
  if (requestedPoints <= 0) {
    reason = "Requested points must be a positive whole number.";
  } else if (requestedPoints > eligiblePoints) {
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
    eligiblePoints,
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
export async function valueLegacyCarryover(
  client: Client,
  carryover: {
    userId: string;
    legacyPointBalance: number;
    conversionRatio: Prisma.Decimal | number | string;
  },
) {
  // The whole preserved balance converts. Nothing was released against it —
  // pre-cutover redemptions still reserve in full — so netting a "committed"
  // portion off here would write that value off twice: once as a standing
  // reservation and again as a reduced credit.
  const preCutover = await getPreCutoverReservations(client, [carryover.userId]);
  return {
    preCutoverReservedPoints: preCutover.get(carryover.userId) || 0,
    convertedPoints: carryover.legacyPointBalance,
    creditedPoints: new Prisma.Decimal(carryover.legacyPointBalance)
      .mul(new Prisma.Decimal(carryover.conversionRatio))
      .floor()
      .toNumber(),
  };
}
