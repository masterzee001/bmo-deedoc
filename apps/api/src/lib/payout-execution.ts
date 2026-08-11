import {
  PayoutExecutionKind,
  PayoutStatus,
  Prisma,
  RewardRedemptionStatus,
  type PrismaClient,
} from "@prisma/client";
import { createAuditLog } from "./audit";
import { assertPayoutExecutionEnabled, isUnreconciledLegacyClaim, valuePayout } from "./payout-authority";

/**
 * The single execution authority: the only code in the platform that may mark
 * money as paid.
 *
 * `payout-authority.ts` decides what a member is owed. This decides whether that
 * money may actually leave, and records that it did. The two were previously one
 * concern spread across two route handlers: each opened its own transaction,
 * hand-copied its own kill-switch check, and wrote its own PAID mutation. Those
 * checks were correct, but nothing made them inevitable — a third money-out
 * route would have inherited none of them, and the guarantee rested on the next
 * author remembering. Enforcement here is structural: there is no other way to
 * reach the PAID transition, so a new caller gets every invariant by
 * construction rather than by convention.
 *
 * Every execution, whichever path it came from:
 *   - refuses unless PAYOUT_EXECUTION_ENABLED is on,
 *   - refuses unless the target is in a legal pre-PAID state,
 *   - refuses a payment reference that already identifies another execution,
 *   - is valued from server-side terms, never from a stored or supplied amount,
 *   - claims its transition atomically, so a double submit pays once,
 *   - writes an immutable execution record and an audit row in the same
 *     transaction as the transition, so all three commit or none do.
 */

export type ExecutePayoutInput =
  | {
      kind: "ASSIGNMENT";
      assignmentId: string;
      actorUserId: string;
      paymentReference: string;
      proofStorageKey?: string | null;
      note?: string | null;
    }
  | {
      kind: "REDEMPTION";
      redemptionId: string;
      actorUserId: string;
      paymentReference: string;
      proofStorageKey?: string | null;
      note?: string | null;
    };

/**
 * Why an execution was refused. Carried as a code rather than a message so the
 * route layer maps it to a status without string matching, and so a new refusal
 * reason cannot silently fall through as a 500.
 */
export type PayoutExecutionFailure =
  | "EXECUTION_DISABLED"
  | "NOT_FOUND"
  | "NOT_ASSIGNED"
  | "INVALID_STATE"
  | "ALREADY_EXECUTED"
  | "DUPLICATE_PAYMENT_REFERENCE"
  | "AMOUNT_NOT_AUTHORITATIVE";

export class PayoutExecutionError extends Error {
  constructor(
    readonly code: PayoutExecutionFailure,
    message: string,
  ) {
    super(message);
    this.name = "PayoutExecutionError";
  }
}

/** Assignment states from which a payment may legally proceed. */
const PAYABLE_ASSIGNMENT_STATUSES = [PayoutStatus.APPROVED, PayoutStatus.PROCESSING];

export type PayoutExecutionResult = {
  executionId: string;
  kind: PayoutExecutionKind;
  beneficiaryUserId: string;
  points: number;
  amount: Prisma.Decimal;
  paymentReference: string;
};

export async function executePayout(
  prisma: PrismaClient,
  input: ExecutePayoutInput,
): Promise<PayoutExecutionResult> {
  const paymentReference = input.paymentReference.trim();
  if (!paymentReference) {
    throw new PayoutExecutionError("INVALID_STATE", "A payment reference is required to execute a payout.");
  }

  // Checked before the switch so a disabled system reports that, rather than
  // reporting a state problem it never got far enough to have.
  assertPayoutExecutionEnabled();

  try {
    return await prisma.$transaction(async (transaction) => {
      // Re-asserted inside the transaction. The check above answers the caller
      // quickly; this one is what the guarantee rests on, because it can abort a
      // transition that is already in flight.
      assertPayoutExecutionEnabled();

      // A reference may identify exactly one payment, across both kinds. The
      // unique index is the real guard — this read only turns a constraint
      // violation into an explained refusal.
      const referenceHolder = await transaction.payoutExecution.findUnique({
        where: { paymentReference },
        select: { id: true },
      });
      if (referenceHolder) {
        throw new PayoutExecutionError(
          "DUPLICATE_PAYMENT_REFERENCE",
          "That payment reference already identifies a completed payout.",
        );
      }

      return input.kind === "ASSIGNMENT"
        ? await executeAssignment(transaction, input, paymentReference)
        : await executeRedemption(transaction, input, paymentReference);
    });
  } catch (error) {
    // A concurrent execution that won the race trips a unique index rather than
    // the read above. Reported as the same refusal, so a duplicate submit is
    // never a 500 and never reads as a second successful payment.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = String((error.meta as { target?: string })?.target || "");
      throw new PayoutExecutionError(
        target.includes("paymentReference") ? "DUPLICATE_PAYMENT_REFERENCE" : "ALREADY_EXECUTED",
        target.includes("paymentReference")
          ? "That payment reference already identifies a completed payout."
          : "This payout has already been executed.",
      );
    }
    throw error;
  }
}

async function executeAssignment(
  transaction: Prisma.TransactionClient,
  input: Extract<ExecutePayoutInput, { kind: "ASSIGNMENT" }>,
  paymentReference: string,
): Promise<PayoutExecutionResult> {
  const assignment = await transaction.payoutAssignment.findUnique({ where: { id: input.assignmentId } });
  if (!assignment) {
    throw new PayoutExecutionError("NOT_FOUND", "Payout assignment was not found.");
  }

  // The assignment's amount was computed by the payout authority when the batch
  // was built, from the cycle's snapshotted terms. It is re-read here rather
  // than recomputed: a cycle's terms are deliberately immutable for its
  // lifetime, so re-valuing against today's configuration would pay a different
  // amount than the one that was approved.
  if (assignment.amount.lessThanOrEqualTo(0)) {
    throw new PayoutExecutionError(
      "AMOUNT_NOT_AUTHORITATIVE",
      "This assignment carries no positive authoritative amount and cannot be paid.",
    );
  }

  // The atomic claim. Filtering on the payable states means two simultaneous
  // requests cannot both transition it: the loser updates zero rows.
  const claimed = await transaction.payoutAssignment.updateMany({
    where: { id: assignment.id, status: { in: PAYABLE_ASSIGNMENT_STATUSES } },
    data: { status: PayoutStatus.PAID, processedAt: new Date(), note: input.note || assignment.note },
  });
  if (claimed.count === 0) {
    throw new PayoutExecutionError(
      assignment.status === PayoutStatus.PAID ? "ALREADY_EXECUTED" : "INVALID_STATE",
      assignment.status === PayoutStatus.PAID
        ? "This payout assignment has already been paid."
        : "Only an approved or processing payout assignment can be paid.",
    );
  }

  const execution = await transaction.payoutExecution.create({
    data: {
      kind: PayoutExecutionKind.ASSIGNMENT,
      payoutAssignmentId: assignment.id,
      beneficiaryUserId: assignment.beneficiaryUserId,
      executedByUserId: input.actorUserId,
      paymentReference,
      points: assignment.points,
      amount: assignment.amount,
      proofStorageKey: input.proofStorageKey || null,
      note: input.note || null,
    },
  });

  // The assignment path's existing detail row, kept because it carries the
  // officer-facing payout record other views already read. The uniform
  // execution record above is what both paths share.
  await transaction.payoutTransaction.create({
    data: {
      payoutAssignmentId: assignment.id,
      payoutOfficerUserId: input.actorUserId,
      paymentReference,
      pointsRedeemed: assignment.points,
      amountPaid: assignment.amount,
      status: PayoutStatus.PAID,
      proofStorageKey: input.proofStorageKey || null,
      note: input.note || null,
    },
  });

  await createAuditLog(transaction, {
    actorUserId: input.actorUserId,
    action: "PAYOUT_ASSIGNMENT_PAID",
    targetType: "PayoutAssignment",
    targetId: assignment.id,
    metadata: {
      fromStatus: assignment.status,
      toStatus: PayoutStatus.PAID,
      executionId: execution.id,
      paymentReference,
      points: assignment.points,
      amountPaid: assignment.amount.toString(),
    },
  });

  return {
    executionId: execution.id,
    kind: PayoutExecutionKind.ASSIGNMENT,
    beneficiaryUserId: assignment.beneficiaryUserId,
    points: assignment.points,
    amount: assignment.amount,
    paymentReference,
  };
}

async function executeRedemption(
  transaction: Prisma.TransactionClient,
  input: Extract<ExecutePayoutInput, { kind: "REDEMPTION" }>,
  paymentReference: string,
): Promise<PayoutExecutionResult> {
  const redemption = await transaction.rewardRedemption.findUnique({ where: { id: input.redemptionId } });
  if (!redemption) {
    throw new PayoutExecutionError("NOT_FOUND", "Redemption was not found.");
  }

  // A redemption raised before the cutover is a claim on preserved legacy
  // value. Until an approved ratio converts that value it is not spendable, so
  // paying the claim would disburse carryover at an equivalence nobody approved.
  if (await isUnreconciledLegacyClaim(transaction, redemption)) {
    throw new PayoutExecutionError(
      "AMOUNT_NOT_AUTHORITATIVE",
      "This redemption is funded by a preserved legacy balance that has not been reconciled, and cannot be paid.",
    );
  }

  // Re-valued at execution, not trusted from storage. `amountRequested` was
  // client-supplied for every row raised before the payout authority existed,
  // and this is the last point at which a wrong figure can still be caught.
  // The redemption is excluded from its own balance rather than added back to
  // it, so a pre-cutover row the legacy offset already removed is not credited
  // twice.
  const valuation = await valuePayout(transaction, {
    userId: redemption.voterUserId,
    requestedPoints: redemption.pointsRequested,
    excludeRedemptionId: redemption.id,
  });
  if (!valuation.meetsThreshold) {
    throw new PayoutExecutionError(
      "AMOUNT_NOT_AUTHORITATIVE",
      valuation.reason || "This redemption cannot be valued against the member's authoritative balance.",
    );
  }

  const claimed = await transaction.rewardRedemption.updateMany({
    where: { id: redemption.id, status: RewardRedemptionStatus.APPROVED },
    data: {
      status: RewardRedemptionStatus.PAID,
      // The authoritative figure wins over whatever was stored.
      amountRequested: Number(valuation.payableAmount),
      reviewedByUserId: input.actorUserId,
      reviewedAt: new Date(),
    },
  });
  if (claimed.count === 0) {
    throw new PayoutExecutionError(
      redemption.status === RewardRedemptionStatus.PAID ? "ALREADY_EXECUTED" : "INVALID_STATE",
      redemption.status === RewardRedemptionStatus.PAID
        ? "This redemption has already been paid."
        : "Only an approved redemption can be marked as paid.",
    );
  }

  const execution = await transaction.payoutExecution.create({
    data: {
      kind: PayoutExecutionKind.REDEMPTION,
      rewardRedemptionId: redemption.id,
      beneficiaryUserId: redemption.voterUserId,
      executedByUserId: input.actorUserId,
      paymentReference,
      points: redemption.pointsRequested,
      amount: valuation.payableAmount,
      proofStorageKey: input.proofStorageKey || null,
      note: input.note || null,
    },
  });

  await createAuditLog(transaction, {
    actorUserId: input.actorUserId,
    action: "REWARD_REDEMPTION_PAID",
    targetType: "RewardRedemption",
    targetId: redemption.id,
    metadata: {
      voterUserId: redemption.voterUserId,
      pointsRequested: redemption.pointsRequested,
      executionId: execution.id,
      paymentReference,
      storedAmountBeforeExecution: redemption.amountRequested,
      amountPaid: valuation.payableAmount.toString(),
    },
  });

  return {
    executionId: execution.id,
    kind: PayoutExecutionKind.REDEMPTION,
    beneficiaryUserId: redemption.voterUserId,
    points: redemption.pointsRequested,
    amount: valuation.payableAmount,
    paymentReference,
  };
}

/** Maps a refusal to the HTTP status that expresses it. */
export function payoutExecutionStatusCode(code: PayoutExecutionFailure): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "NOT_ASSIGNED":
      return 403;
    case "AMOUNT_NOT_AUTHORITATIVE":
      return 400;
    default:
      return 409;
  }
}
