import crypto from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../prisma";

type ReferralCodeDatabase = PrismaClient | Prisma.TransactionClient;

export async function generateUniqueReferralCode(database: ReferralCodeDatabase = prisma): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = `OGUN${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const [existingMemberCode, existingCoordinatorCode] = await Promise.all([
      database.voterProfile.findUnique({
        where: { referralCode: code },
        select: { id: true },
      }),
      database.referralCode.findUnique({
        where: { code },
        select: { id: true },
      }),
    ]);

    if (!existingMemberCode && !existingCoordinatorCode) {
      return code;
    }
  }

  throw new Error("Unable to generate a unique referral code.");
}
