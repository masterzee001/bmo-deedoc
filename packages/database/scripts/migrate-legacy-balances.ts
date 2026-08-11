import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

/**
 * Legacy balance cutover.
 *
 * Migrates every member's legacy `RewardLedger` balance into an immutable
 * carryover record attached to the authoritative ledger. The balance is
 * **preserved**, not credited: a carryover is created
 * `LEGACY_CARRYOVER_PENDING`, is excluded from the eligible balance, and cannot
 * be spent or paid until an approved equivalence ratio is applied.
 *
 * The rule this enforces: preserve the balance, but do not create monetary
 * value from an unverified conversion assumption. Retiring the legacy ledger
 * would lose member value; assuming 1 legacy point equals 1 current point would
 * invent it.
 *
 *   npm run migrate:legacy-balances -- --dry-run
 *   npm run migrate:legacy-balances
 *
 * Re-running is safe. A member already carried over in any batch is skipped, so
 * a second run cannot double-count.
 */

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

type MemberSnapshot = {
  userId: string;
  legacyPointBalance: number;
  legacyReservedPoints: number;
  sourceRowIds: string[];
  rowChecksum: string;
};

async function buildSnapshot(): Promise<MemberSnapshot[]> {
  const rows = await prisma.rewardLedger.findMany({
    select: { id: true, voterUserId: true, points: true, type: true, createdAt: true },
    orderBy: [{ voterUserId: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });

  const reservations = await prisma.rewardRedemption.groupBy({
    by: ["voterUserId"],
    where: { status: { in: ["PENDING", "APPROVED", "PAID"] } },
    _sum: { pointsRequested: true },
  });
  const reservedByUser = new Map(reservations.map((entry) => [entry.voterUserId, entry._sum.pointsRequested || 0]));

  const byUser = new Map<string, { points: number; ids: string[]; digestInput: string[] }>();
  for (const row of rows) {
    const bucket = byUser.get(row.voterUserId) || { points: 0, ids: [], digestInput: [] };
    bucket.points += row.points;
    bucket.ids.push(row.id);
    // Deterministic per-row fingerprint so the carryover can be proven to
    // describe the exact rows it summarises.
    bucket.digestInput.push(`${row.id}|${row.type}|${row.points}|${row.createdAt.toISOString()}`);
    byUser.set(row.voterUserId, bucket);
  }

  return [...byUser.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([userId, bucket]) => ({
      userId,
      legacyPointBalance: bucket.points,
      legacyReservedPoints: reservedByUser.get(userId) || 0,
      sourceRowIds: bucket.ids,
      rowChecksum: createHash("sha256").update(bucket.digestInput.join("\n")).digest("hex"),
    }));
}

async function main() {
  const snapshot = await buildSnapshot();

  // Members already carried over in an earlier batch are excluded. This is the
  // primary double-counting guard: a balance may exist as legacy value or as
  // carried value, never as both.
  const existing = await prisma.legacyBalanceCarryover.findMany({ select: { userId: true } });
  const alreadyCarried = new Set(existing.map((entry) => entry.userId));
  const pending = snapshot.filter((entry) => !alreadyCarried.has(entry.userId));

  const beforeTotalPoints = snapshot.reduce((total, entry) => total + entry.legacyPointBalance, 0);
  const migratedTotalPoints = pending.reduce((total, entry) => total + entry.legacyPointBalance, 0);
  const snapshotChecksum = createHash("sha256")
    .update(pending.map((entry) => `${entry.userId}:${entry.legacyPointBalance}:${entry.rowChecksum}`).join("\n"))
    .digest("hex");

  console.log(`legacy_members_total=${snapshot.length}`);
  console.log(`legacy_members_already_carried=${alreadyCarried.size}`);
  console.log(`legacy_members_to_migrate=${pending.length}`);
  console.log(`legacy_before_total_points=${beforeTotalPoints}`);
  console.log(`legacy_migrating_total_points=${migratedTotalPoints}`);
  console.log(`legacy_snapshot_checksum=${snapshotChecksum}`);

  if (dryRun) {
    console.log("legacy_migration=dry-run (nothing written)");
    return;
  }

  if (pending.length === 0) {
    console.log("legacy_migration=nothing-to-migrate");
    return;
  }

  const batch = await prisma.$transaction(async (transaction) => {
    const created = await transaction.legacyMigrationBatch.create({
      data: {
        sourceLedger: "RewardLedger",
        memberCount: pending.length,
        beforeTotalPoints: migratedTotalPoints,
        migratedTotalPoints,
        pendingTotalPoints: migratedTotalPoints,
        reconciledTotalPoints: 0,
        snapshotChecksum,
        notes:
          "Balances preserved as non-spendable carryover. No equivalence ratio applied; nothing credited to the authoritative ledger.",
      },
    });

    for (const entry of pending) {
      await transaction.legacyBalanceCarryover.create({
        data: {
          userId: entry.userId,
          migrationBatchId: created.id,
          sourceLedger: "RewardLedger",
          sourceRowIdsJson: entry.sourceRowIds,
          legacyPointBalance: entry.legacyPointBalance,
          legacyReservedPoints: entry.legacyReservedPoints,
          rowChecksum: entry.rowChecksum,
          status: "LEGACY_CARRYOVER_PENDING",
        },
      });
    }

    return created;
  });

  // Re-read rather than trusting the write: the audit total must come from what
  // is actually stored.
  const stored = await prisma.legacyBalanceCarryover.aggregate({
    where: { migrationBatchId: batch.id },
    _sum: { legacyPointBalance: true },
    _count: { _all: true },
  });

  if ((stored._sum.legacyPointBalance || 0) !== migratedTotalPoints || stored._count._all !== pending.length) {
    throw new Error(
      `Cutover did not balance: expected ${pending.length} members / ${migratedTotalPoints} points, ` +
        `stored ${stored._count._all} / ${stored._sum.legacyPointBalance || 0}.`,
    );
  }

  console.log(`legacy_migration_batch_id=${batch.id}`);
  console.log(`legacy_migrated_members=${stored._count._all}`);
  console.log(`legacy_migrated_points=${stored._sum.legacyPointBalance || 0}`);
  console.log(`legacy_pending_points=${migratedTotalPoints}`);
  console.log("legacy_reconciled_points=0");
  console.log("legacy_migration=ok");
  console.log(
    "NOTE: carried balances are NOT payable. Apply an approved equivalence ratio through the reconciliation endpoint before any payout.",
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
