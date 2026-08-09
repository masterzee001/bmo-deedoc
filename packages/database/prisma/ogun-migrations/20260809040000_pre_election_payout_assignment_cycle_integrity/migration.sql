-- Add cycle-level payout assignment integrity so one beneficiary cannot be
-- assigned more than once in the same payout cycle.
ALTER TABLE "PayoutAssignment" ADD COLUMN "payoutCycleId" TEXT;

UPDATE "PayoutAssignment" AS assignment
SET "payoutCycleId" = batch."payoutCycleId"
FROM "PayoutBatch" AS batch
WHERE assignment."payoutBatchId" = batch."id";

ALTER TABLE "PayoutAssignment" ALTER COLUMN "payoutCycleId" SET NOT NULL;

CREATE INDEX "PayoutAssignment_payoutCycleId_idx" ON "PayoutAssignment"("payoutCycleId");
CREATE UNIQUE INDEX "PayoutAssignment_payoutCycleId_beneficiaryUserId_key" ON "PayoutAssignment"("payoutCycleId", "beneficiaryUserId");

ALTER TABLE "PayoutAssignment" ADD CONSTRAINT "PayoutAssignment_payoutCycleId_fkey"
FOREIGN KEY ("payoutCycleId") REFERENCES "PayoutCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
