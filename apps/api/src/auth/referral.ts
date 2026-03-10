import crypto from "node:crypto";
import { prisma } from "../prisma";

export async function generateUniqueReferralCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = `PICS${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const existing = await prisma.voterProfile.findUnique({
      where: { referralCode: code },
      select: { id: true },
    });

    if (!existing) {
      return code;
    }
  }

  throw new Error("Unable to generate a unique referral code.");
}
