import { Router } from "express";
import { NotificationType, RewardType, UserRole } from "@prisma/client";
import { z } from "zod";
import { normalizeEmail } from "@pics-nigeria/shared";
import { signAccessToken } from "../auth/jwt";
import { hashPassword, verifyPassword } from "../auth/password";
import { getAuthUserProfile } from "../auth/profile";
import { generateUniqueReferralCode } from "../auth/referral";
import { createRewardEntryWithNotification } from "../lib/rewards";
import { validateTerritoryReferences } from "../lib/territory";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../prisma";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const registerVoterSchema = z.object({
  fullName: z.string().trim().min(2),
  email: z.string().email(),
  phone: z.string().trim().min(7),
  password: z.string().min(8),
  voterCardNumber: z.string().trim().min(5),
  stateId: z.string().trim().min(1),
  senatorialDistrictId: z.string().trim().optional(),
  federalConstituencyId: z.string().trim().optional(),
  lgaId: z.string().trim().min(1),
  wardId: z.string().trim().min(1),
  stateConstituencyId: z.string().trim().optional(),
  referredByCode: z.string().trim().min(4).optional(),
});

router.post("/login", async (request, response) => {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid login payload.", errors: parsed.error.flatten() });
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(parsed.data.email) },
  });

  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return response.status(401).json({ message: "Invalid email or password." });
  }

  if (!user.isActive) {
    return response.status(403).json({ message: "This account has been deactivated." });
  }

  const authUser = await getAuthUserProfile(user.id);
  if (!authUser) {
    return response.status(404).json({ message: "User profile not found." });
  }

  return response.json({
    token: signAccessToken(authUser),
    user: authUser,
  });
});

router.get("/me", requireAuth, async (request, response) => {
  return response.json({ user: request.authUser });
});

router.post("/register-voter", async (request, response) => {
  const parsed = registerVoterSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid voter registration payload.", errors: parsed.error.flatten() });
  }

  const email = normalizeEmail(parsed.data.email);
  const voterCardNumber = parsed.data.voterCardNumber.trim().toUpperCase();

  const [existingUser, existingVoterCard] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.voterProfile.findUnique({ where: { voterCardNumber }, select: { id: true } }),
  ]);

  if (existingUser) {
    return response.status(409).json({ message: "Email is already registered." });
  }

  if (existingVoterCard) {
    return response.status(409).json({ message: "Voter card number is already registered." });
  }

  const territoryReferenceError = await validateTerritoryReferences(parsed.data);
  if (territoryReferenceError) {
    return response.status(400).json({ message: territoryReferenceError });
  }

  const ward = await prisma.ward.findUnique({
    where: { id: parsed.data.wardId },
    include: { lga: true },
  });

  if (!ward) {
    return response.status(400).json({ message: "Selected ward does not exist." });
  }

  if (ward.lgaId !== parsed.data.lgaId) {
    return response.status(400).json({ message: "Ward does not belong to the selected LGA." });
  }

  if (ward.stateId !== parsed.data.stateId || ward.lga.stateId !== parsed.data.stateId) {
    return response.status(400).json({ message: "Territory selection is inconsistent." });
  }

  let referrer: { id: string; email: string } | null = null;
  const referralCodeInput = parsed.data.referredByCode?.trim().toUpperCase();

  if (referralCodeInput) {
    const referrerProfile = await prisma.voterProfile.findUnique({
      where: { referralCode: referralCodeInput },
      include: {
        user: {
          select: { id: true, email: true },
        },
      },
    });

    if (!referrerProfile) {
      return response.status(400).json({ message: "Referral code is invalid." });
    }

    if (normalizeEmail(referrerProfile.user.email) === email) {
      return response.status(400).json({ message: "You cannot refer yourself." });
    }

    referrer = referrerProfile.user;
  }

  const referralCode = await generateUniqueReferralCode();
  const passwordHash = await hashPassword(parsed.data.password);

  const createdUser = await prisma.$transaction(async (transaction) => {
    const user = await transaction.user.create({
      data: {
        name: parsed.data.fullName.trim(),
        email,
        phone: parsed.data.phone.trim(),
        passwordHash,
        role: UserRole.VOTER,
        voterProfile: {
          create: {
            voterCardNumber,
            referralCode,
            referredByUserId: referrer?.id || null,
            stateId: parsed.data.stateId,
            senatorialDistrictId: parsed.data.senatorialDistrictId || null,
            federalConstituencyId: parsed.data.federalConstituencyId || null,
            lgaId: parsed.data.lgaId,
            wardId: parsed.data.wardId,
            stateConstituencyId: parsed.data.stateConstituencyId || null,
          },
        },
      },
    });

    if (referrer) {
      const existingReward = await transaction.rewardLedger.findFirst({
        where: {
          voterUserId: referrer.id,
          type: RewardType.REFERRAL,
          relatedUserId: user.id,
        },
        select: { id: true },
      });

      if (!existingReward) {
        await createRewardEntryWithNotification(transaction, {
          voterUserId: referrer.id,
          type: RewardType.REFERRAL,
          points: 10,
          description: `Referral reward for ${parsed.data.fullName.trim()}`,
          relatedUserId: user.id,
        });
      }
    }

    return user;
  });

  const authUser = await getAuthUserProfile(createdUser.id);

  return response.status(201).json({
    message: "Voter registration successful.",
    user: authUser,
  });
});

export default router;
