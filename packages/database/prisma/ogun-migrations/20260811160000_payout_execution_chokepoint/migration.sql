-- CreateEnum
CREATE TYPE "PayoutExecutionKind" AS ENUM ('ASSIGNMENT', 'REDEMPTION');

-- CreateTable
CREATE TABLE "PayoutExecution" (
    "id" TEXT NOT NULL,
    "kind" "PayoutExecutionKind" NOT NULL,
    "payoutAssignmentId" TEXT,
    "rewardRedemptionId" TEXT,
    "beneficiaryUserId" TEXT NOT NULL,
    "executedByUserId" TEXT NOT NULL,
    "paymentReference" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "proofStorageKey" TEXT,
    "note" TEXT,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayoutExecution_payoutAssignmentId_key" ON "PayoutExecution"("payoutAssignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutExecution_rewardRedemptionId_key" ON "PayoutExecution"("rewardRedemptionId");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutExecution_paymentReference_key" ON "PayoutExecution"("paymentReference");

-- CreateIndex
CREATE INDEX "PayoutExecution_beneficiaryUserId_executedAt_idx" ON "PayoutExecution"("beneficiaryUserId", "executedAt");

-- CreateIndex
CREATE INDEX "PayoutExecution_kind_executedAt_idx" ON "PayoutExecution"("kind", "executedAt");

-- AddForeignKey
ALTER TABLE "PayoutExecution" ADD CONSTRAINT "PayoutExecution_payoutAssignmentId_fkey" FOREIGN KEY ("payoutAssignmentId") REFERENCES "PayoutAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutExecution" ADD CONSTRAINT "PayoutExecution_rewardRedemptionId_fkey" FOREIGN KEY ("rewardRedemptionId") REFERENCES "RewardRedemption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutExecution" ADD CONSTRAINT "PayoutExecution_beneficiaryUserId_fkey" FOREIGN KEY ("beneficiaryUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutExecution" ADD CONSTRAINT "PayoutExecution_executedByUserId_fkey" FOREIGN KEY ("executedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

