-- System-controlled bonus reward rules (Feature 043).
-- Additive only: adds one enum value and one nullable column.
-- No existing table, column, or migration is modified.
--
-- Bonus points may only originate from a versioned rule that a Super Admin
-- created, triggered by a system-computed referral milestone. No operator,
-- including a Payout Officer, can mint a bonus amount.

-- AlterEnum
ALTER TYPE "RewardQualifyingEvent" ADD VALUE 'REFERRAL_MILESTONE_REACHED';

-- AlterTable
ALTER TABLE "RewardRuleVersion" ADD COLUMN     "milestoneThreshold" INTEGER;

