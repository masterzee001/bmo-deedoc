-- CreateEnum
CREATE TYPE "LegacyReconciliationPolicyStatus" AS ENUM ('DRAFT', 'APPROVED', 'RETIRED');

-- AlterTable
ALTER TABLE "LegacyBalanceCarryover" ADD COLUMN     "reconciliationPolicyId" TEXT;

-- CreateTable
CREATE TABLE "LegacyReconciliationPolicy" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "conversionRatio" DECIMAL(12,6) NOT NULL,
    "status" "LegacyReconciliationPolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "rationale" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegacyReconciliationPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LegacyReconciliationPolicy_version_key" ON "LegacyReconciliationPolicy"("version");

-- CreateIndex
CREATE INDEX "LegacyReconciliationPolicy_status_idx" ON "LegacyReconciliationPolicy"("status");

-- AddForeignKey
ALTER TABLE "LegacyReconciliationPolicy" ADD CONSTRAINT "LegacyReconciliationPolicy_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegacyReconciliationPolicy" ADD CONSTRAINT "LegacyReconciliationPolicy_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegacyBalanceCarryover" ADD CONSTRAINT "LegacyBalanceCarryover_reconciliationPolicyId_fkey" FOREIGN KEY ("reconciliationPolicyId") REFERENCES "LegacyReconciliationPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- At most one approved policy at a time. Prisma cannot express a filtered
-- unique index, so it is created here directly. This is the real guarantee that
-- reconciliation can never face an ambiguous choice of ratio; the application
-- retires the previous policy in the same transaction, and this refuses the
-- write if it ever fails to.
CREATE UNIQUE INDEX "LegacyReconciliationPolicy_single_approved_key"
  ON "LegacyReconciliationPolicy" ((status = 'APPROVED'))
  WHERE status = 'APPROVED';
