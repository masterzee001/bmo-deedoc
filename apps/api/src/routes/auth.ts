import { Router } from "express";
import crypto from "node:crypto";
import { NotificationType, Prisma, RewardType, UserRole } from "@prisma/client";
import { z } from "zod";
import { normalizeEmail } from "@pics-nigeria/shared";
import { signAccessToken } from "../auth/jwt";
import { hashPassword, verifyPassword } from "../auth/password";
import { getAuthUserProfile } from "../auth/profile";
import { generateUniqueReferralCode } from "../auth/referral";
import { createRewardEntryWithNotification } from "../lib/rewards";
import { recordParticipationAndReward } from "../lib/participation";
import { ensureNationalReferenceStates, syncLgasForState, syncPollingUnitsForWard, syncWardsForLga } from "../lib/inec-reference";
import { validateTerritoryReferences } from "../lib/territory";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../prisma";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  agentGpsConsent: z.boolean().optional(),
});

const territoryQuerySchema = z.object({
  stateId: z.string().trim().min(1).optional(),
  lgaId: z.string().trim().min(1).optional(),
  wardId: z.string().trim().min(1).optional(),
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().email(),
  phone: z.string().trim().min(7).max(30).optional().or(z.literal("")),
});

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8),
});

const registerVoterSchema = z.object({
  fullName: z.string().trim().min(2),
  email: z.string().email(),
  phone: z.string().trim().regex(/^\d{7,15}$/),
  password: z.string().min(8),
  voterCardNumber: z.string().trim().min(5),
  stateId: z.string().trim().min(1),
  senatorialDistrictId: z.string().trim().optional(),
  federalConstituencyId: z.string().trim().optional(),
  lgaId: z.string().trim().min(1),
  wardId: z.string().trim().min(1),
  stateConstituencyId: z.string().trim().optional(),
  pollingUnitId: z.string().trim().min(1),
  referredByCode: z.string().trim().min(4).optional(),
  acceptTerms: z.boolean().optional(),
  contactConsent: z.boolean().optional(),
  confirmAdult: z.boolean().optional(),
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

  let sessionNonce: string | undefined;
  if (user.role === UserRole.AGENT) {
    const agentProfile = await prisma.agentProfile.findUnique({
      where: { userId: user.id },
      select: { userId: true, gpsTrackingConsentAt: true },
    });

    if (!agentProfile) {
      return response.status(404).json({ message: "Agent profile not found." });
    }

    if (!agentProfile.gpsTrackingConsentAt && parsed.data.agentGpsConsent !== true) {
      return response.status(400).json({
        message: "Agent sign-in requires GPS consent before access can be granted.",
      });
    }

    sessionNonce = crypto.randomUUID();
    await prisma.agentProfile.update({
      where: { userId: user.id },
      data: {
        gpsTrackingConsentAt: agentProfile.gpsTrackingConsentAt || new Date(),
        activeSessionNonce: sessionNonce,
      },
    });
  }

  const authUser = await getAuthUserProfile(user.id);
  if (!authUser) {
    return response.status(404).json({ message: "User profile not found." });
  }

  return response.json({
    token: signAccessToken(authUser, { sessionNonce }),
    user: authUser,
  });
});

router.get("/me", requireAuth, async (request, response) => {
  return response.json({ user: request.authUser });
});

router.patch("/me", requireAuth, async (request, response) => {
  const parsed = updateProfileSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid profile update payload.", errors: parsed.error.flatten() });
  }

  const email = normalizeEmail(parsed.data.email);
  const phone = parsed.data.phone?.trim() ? parsed.data.phone.trim() : null;
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser && existingUser.id !== request.authUser!.id) {
    return response.status(409).json({ message: "Email is already registered." });
  }

  await prisma.user.update({
    where: { id: request.authUser!.id },
    data: {
      name: parsed.data.name.trim(),
      email,
      phone,
    },
  });

  const authUser = await getAuthUserProfile(request.authUser!.id);
  return response.json({
    message: "Profile updated successfully.",
    user: authUser,
  });
});

router.get("/territories/states", async (_request, response) => {
  if ((await prisma.state.count()) < 37) {
    await ensureNationalReferenceStates(prisma);
  }

  const states = await prisma.state.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return response.json({ states });
});

router.get("/territories/lgas", async (request, response) => {
  const parsed = territoryQuerySchema.safeParse(request.query);
  if (!parsed.success || !parsed.data.stateId) {
    return response.status(400).json({ message: "stateId is required." });
  }

  let lgas = await prisma.lGA.findMany({
    where: { stateId: parsed.data.stateId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, stateId: true },
  });

  if (lgas.length === 0) {
    await syncLgasForState(prisma, parsed.data.stateId);
    lgas = await prisma.lGA.findMany({
      where: { stateId: parsed.data.stateId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, stateId: true },
    });
  }

  return response.json({ lgas });
});

router.get("/territories/wards", async (request, response) => {
  const parsed = territoryQuerySchema.safeParse(request.query);
  if (!parsed.success || !parsed.data.stateId || !parsed.data.lgaId) {
    return response.status(400).json({ message: "stateId and lgaId are required." });
  }

  let wards = await prisma.ward.findMany({
    where: {
      stateId: parsed.data.stateId,
      lgaId: parsed.data.lgaId,
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, stateId: true, lgaId: true },
  });

  if (wards.length === 0) {
    await syncWardsForLga(prisma, parsed.data.stateId, parsed.data.lgaId);
    wards = await prisma.ward.findMany({
      where: {
        stateId: parsed.data.stateId,
        lgaId: parsed.data.lgaId,
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, stateId: true, lgaId: true },
    });
  }

  return response.json({ wards });
});

router.get("/territories/polling-units", async (request, response) => {
  const parsed = territoryQuerySchema.safeParse(request.query);
  if (!parsed.success || !parsed.data.stateId || !parsed.data.lgaId || !parsed.data.wardId) {
    return response.status(400).json({ message: "stateId, lgaId, and wardId are required." });
  }

  await syncPollingUnitsForWard(prisma, parsed.data.stateId, parsed.data.lgaId, parsed.data.wardId);

  const pollingUnits = await prisma.pollingUnit.findMany({
    where: {
      stateId: parsed.data.stateId,
      lgaId: parsed.data.lgaId,
      wardId: parsed.data.wardId,
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, stateId: true, lgaId: true, wardId: true },
  });

  return response.json({ pollingUnits });
});

router.patch("/password", requireAuth, async (request, response) => {
  const parsed = updatePasswordSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid password update payload.", errors: parsed.error.flatten() });
  }

  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return response.status(400).json({ message: "New password must be different from the current password." });
  }

  const user = await prisma.user.findUnique({
    where: { id: request.authUser!.id },
    select: { id: true, passwordHash: true },
  });

  if (!user || !(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
    return response.status(401).json({ message: "Current password is incorrect." });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(parsed.data.newPassword),
    },
  });

  return response.json({ message: "Password updated successfully." });
});

router.post("/register-voter", async (request, response) => {
  const parsed = registerVoterSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid voter registration payload.", errors: parsed.error.flatten() });
  }

  // Legacy frontend bundles may omit these fields until all public clients refresh.
  if (parsed.data.acceptTerms === false || parsed.data.contactConsent === false) {
    return response.status(400).json({
      message: "You must accept the terms and consent agreement to register.",
    });
  }

  if (parsed.data.confirmAdult === false) {
    return response.status(400).json({
      message: "You must confirm that you are 18 years or older to register.",
    });
  }

  const email = normalizeEmail(parsed.data.email);
  const voterCardNumber = parsed.data.voterCardNumber.trim().toUpperCase();

  const [existingUser, existingVoterCard] = await Promise.all([
    prisma.user.findUnique({
      where: { email },
      include: {
        voterProfile: {
          select: { id: true },
        },
      },
    }),
    prisma.voterProfile.findUnique({ where: { voterCardNumber }, select: { id: true } }),
  ]);

  if (existingUser?.voterProfile) {
    return response.status(409).json({ message: "Voter details already exist for this email." });
  }

  if (existingVoterCard) {
    return response.status(409).json({ message: "Voter card number is already registered." });
  }

  if (existingUser && !(await verifyPassword(parsed.data.password, existingUser.passwordHash))) {
    return response.status(401).json({
      message: "This email already belongs to an existing account. Use the same account password to add voter details.",
    });
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

  const pollingUnit = await prisma.pollingUnit.findUnique({
    where: { id: parsed.data.pollingUnitId },
    include: { ward: true },
  });

  if (!pollingUnit) {
    return response.status(400).json({ message: "Selected polling unit does not exist." });
  }

  if (
    pollingUnit.wardId !== parsed.data.wardId ||
    pollingUnit.lgaId !== parsed.data.lgaId ||
    pollingUnit.stateId !== parsed.data.stateId ||
    pollingUnit.ward.lgaId !== parsed.data.lgaId
  ) {
    return response.status(400).json({ message: "Polling unit does not belong to the selected ward." });
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
  const voterProfileData: Prisma.VoterProfileUncheckedCreateWithoutUserInput = {
    voterCardNumber,
    referralCode,
    referredByUserId: referrer?.id || null,
    contactConsent: parsed.data.contactConsent ?? true,
    termsAcceptedAt: new Date(),
    stateId: parsed.data.stateId,
    senatorialDistrictId: parsed.data.senatorialDistrictId || null,
    federalConstituencyId: parsed.data.federalConstituencyId || null,
    lgaId: parsed.data.lgaId,
    wardId: parsed.data.wardId,
    stateConstituencyId: parsed.data.stateConstituencyId || null,
    pollingUnitId: parsed.data.pollingUnitId,
  };

  const createdUser = await prisma.$transaction(async (transaction) => {
    const user = existingUser
      ? await transaction.user.update({
          where: { id: existingUser.id },
          data: {
            phone: existingUser.phone || parsed.data.phone.trim(),
            voterProfile: {
              create: voterProfileData,
            },
          },
        })
      : await transaction.user.create({
          data: {
            name: parsed.data.fullName.trim(),
            email,
            phone: parsed.data.phone.trim(),
            passwordHash,
            role: UserRole.VOTER,
            voterProfile: {
              create: voterProfileData,
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

    await recordParticipationAndReward(transaction, {
      voterUserId: user.id,
      type: "VOTER_REGISTRATION",
      description: "Completed voter registration",
      pointsAwarded: 10,
    });

    return user;
  });

  const authUser = await getAuthUserProfile(createdUser.id);

  return response.status(201).json({
    message: "Voter registration successful.",
    user: authUser,
  });
});

export default router;
