-- AlterTable
ALTER TABLE "PayoutCycle" ADD COLUMN     "payoutConfigurationId" TEXT;

-- AddForeignKey
ALTER TABLE "PayoutCycle" ADD CONSTRAINT "PayoutCycle_payoutConfigurationId_fkey" FOREIGN KEY ("payoutConfigurationId") REFERENCES "PayoutConfiguration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

