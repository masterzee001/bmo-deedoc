import { Router, type Response } from "express";
import { COORDINATOR_LEVELS, OGUN_STATE_ID, TARGET_ACCOUNT_STATUSES, normalizeEmail } from "@pics-nigeria/shared";
import { z } from "zod";
import {
  TerritoryAuthorizationError,
  authorizeAction,
  canAssignTerritory,
  canCreateCoordinator,
  canManageTargetUser,
  resolveOperationalTerritory,
  validateCoordinatorAssignment,
} from "../authorization";
import { hashPassword } from "../auth/password";
import { getAuthUserProfile } from "../auth/profile";
import { createAuditLog } from "../lib/audit";
import {
  OrganizationTreeReferenceError,
  loadOgunOrganizationTree,
  scopeOrganizationTree,
} from "../lib/organization-tree";
import { requireAuth, requireRole } from "../middleware/auth";
import { prisma } from "../prisma";

const router = Router();

const territorySchema = z.object({
  stateId: z.literal(OGUN_STATE_ID),
  senatorialDistrictId: z.string().trim().min(1).optional(),
  federalConstituencyId: z.string().trim().min(1).optional(),
  stateConstituencyId: z.string().trim().min(1).optional(),
  wardId: z.string().trim().min(1).optional(),
  pollingUnitId: z.string().trim().min(1).optional(),
});

const coordinatorAssignmentSchema = z.object({
  level: z.enum(COORDINATOR_LEVELS),
  territory: territorySchema,
});

const createCoordinatorSchema = coordinatorAssignmentSchema.extend({
  name: z.string().trim().min(2).max(120),
  email: z.string().email(),
  phone: z.string().trim().min(7).max(30).optional(),
  password: z.string().min(8),
});

const accountStatusSchema = z.object({
  status: z.enum(TARGET_ACCOUNT_STATUSES),
});

const candidateSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  officeType: z.enum(["GOVERNORSHIP", "SENATE", "HOUSE_OF_REP", "STATE_ASSEMBLY"]),
  politicalPartyId: z.string().trim().min(1).optional(),
  portraitUrl: z.string().url().optional(),
  campaignSlogan: z.string().trim().max(240).optional(),
  bio: z.string().trim().max(10_000).optional(),
  isPublished: z.boolean().optional(),
  territory: territorySchema,
});

function serializeCandidate(candidate: {
  id: string;
  legacyUserId: string | null;
  fullName: string;
  officeType: string;
  politicalPartyId: string | null;
  portraitUrl: string | null;
  campaignSlogan: string | null;
  bio: string | null;
  isPublished: boolean;
  isActive: boolean;
  stateId: string;
  senatorialDistrictId: string | null;
  federalConstituencyId: string | null;
  stateConstituencyId: string | null;
  wardId: string | null;
  pollingUnitId: string | null;
}) {
  return candidate;
}

function territoryInputFromProfile(profile: NonNullable<ReturnType<typeof readOperationalProfile>>) {
  return {
    stateId: profile.stateId,
    senatorialDistrictId: profile.senatorialDistrictId,
    federalConstituencyId: profile.federalConstituencyId,
    stateConstituencyId: profile.stateConstituencyId,
    wardId: profile.wardId,
    pollingUnitId: profile.pollingUnitId,
  };
}

function readOperationalProfile(user: NonNullable<Awaited<ReturnType<typeof getAuthUserProfile>>>) {
  const profile = user.coordinatorProfile || (user.role === "MEMBER" ? user.voterProfile : null);
  if (!profile?.stateId) {
    return null;
  }
  return {
    stateId: profile.stateId,
    senatorialDistrictId: profile.senatorialDistrictId,
    federalConstituencyId: profile.federalConstituencyId,
    stateConstituencyId: profile.stateConstituencyId,
    wardId: profile.wardId,
    pollingUnitId: profile.pollingUnitId,
  };
}

function candidateScopeIsExact(
  officeType: z.infer<typeof candidateSchema>["officeType"],
  territory: z.infer<typeof territorySchema>,
) {
  if (officeType === "GOVERNORSHIP") {
    return !territory.senatorialDistrictId && !territory.federalConstituencyId && !territory.stateConstituencyId && !territory.wardId && !territory.pollingUnitId;
  }
  if (officeType === "SENATE") {
    return Boolean(territory.senatorialDistrictId) && !territory.federalConstituencyId && !territory.stateConstituencyId && !territory.wardId && !territory.pollingUnitId;
  }
  if (officeType === "HOUSE_OF_REP") {
    return Boolean(territory.federalConstituencyId) && !territory.stateConstituencyId && !territory.wardId && !territory.pollingUnitId;
  }
  return Boolean(territory.stateConstituencyId) && !territory.wardId && !territory.pollingUnitId;
}

function territoryErrorResponse(response: Response, error: unknown) {
  if (error instanceof TerritoryAuthorizationError) {
    return response.status(409).json({ message: error.message, code: error.code });
  }
  throw error;
}

router.get("/candidates", async (_request, response) => {
  const candidates = await prisma.candidate.findMany({
    where: { stateId: OGUN_STATE_ID, isActive: true, isPublished: true },
    orderBy: [{ officeType: "asc" }, { fullName: "asc" }],
  });
  return response.json({ candidates: candidates.map(serializeCandidate) });
});

router.get("/candidates/:candidateId", async (request, response) => {
  const candidateId = Array.isArray(request.params.candidateId) ? request.params.candidateId[0] : request.params.candidateId;
  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, stateId: OGUN_STATE_ID, isActive: true, isPublished: true },
    include: {
      politicalParty: { select: { id: true, name: true, code: true, logoUrl: true } },
      posts: { where: { isPublished: true }, orderBy: { createdAt: "desc" } },
      campaignEvents: { where: { isPublished: true }, orderBy: { startsAt: "asc" } },
    },
  });
  if (!candidate) {
    return response.status(404).json({ message: "Candidate not found." });
  }
  return response.json({ candidate });
});

router.post(
  "/candidates",
  requireAuth,
  requireRole("SUPER_ADMIN", "STATE_OFFICER", "COORDINATOR"),
  async (request, response) => {
    const parsed = candidateSchema.safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({ message: "Invalid candidate payload.", errors: parsed.error.flatten() });
    }
    if (!candidateScopeIsExact(parsed.data.officeType, parsed.data.territory)) {
      return response.status(400).json({ message: "Candidate office and operational territory do not match." });
    }

    try {
      const territory = await resolveOperationalTerritory(prisma, parsed.data.territory);
      if (!authorizeAction(request.authUser!, "MANAGE_CANDIDATES", territory)) {
        return response.status(403).json({ message: "Candidate territory is outside your authorized command scope." });
      }

      const candidate = await prisma.$transaction(async (transaction) => {
        const created = await transaction.candidate.create({
          data: {
            fullName: parsed.data.fullName,
            officeType: parsed.data.officeType,
            politicalPartyId: parsed.data.politicalPartyId || null,
            portraitUrl: parsed.data.portraitUrl || null,
            campaignSlogan: parsed.data.campaignSlogan || null,
            bio: parsed.data.bio || null,
            isPublished: parsed.data.isPublished ?? false,
            stateId: territory.stateId,
            senatorialDistrictId: territory.senatorialDistrictId,
            federalConstituencyId: territory.federalConstituencyId,
            stateConstituencyId: territory.stateConstituencyId,
            wardId: territory.wardId,
            pollingUnitId: territory.pollingUnitId,
          },
        });
        await createAuditLog(transaction, {
          actorUserId: request.authUser!.id,
          action: "CANDIDATE_DOMAIN_CREATED",
          targetType: "Candidate",
          targetId: created.id,
          territory,
          metadata: { officeType: created.officeType },
        });
        return created;
      });
      return response.status(201).json({ candidate: serializeCandidate(candidate) });
    } catch (error) {
      return territoryErrorResponse(response, error);
    }
  },
);

router.get(
  "/organization-tree",
  requireAuth,
  requireRole("SUPER_ADMIN", "STATE_OFFICER", "COORDINATOR"),
  async (request, response) => {
    try {
      const tree = await loadOgunOrganizationTree(prisma);
      if (request.authUser!.role === "COORDINATOR") {
        if (!request.authUser!.coordinatorProfile) {
          return response.status(403).json({ message: "Coordinator profile is required." });
        }
        return response.json({ tree: scopeOrganizationTree(tree, request.authUser!.coordinatorProfile) });
      }
      return response.json({ tree });
    } catch (error) {
      if (error instanceof OrganizationTreeReferenceError) {
        return response.status(409).json({ message: error.message, blockers: error.blockers });
      }
      throw error;
    }
  },
);

router.post(
  "/coordinators",
  requireAuth,
  requireRole("SUPER_ADMIN", "STATE_OFFICER", "COORDINATOR"),
  async (request, response) => {
    const parsed = createCoordinatorSchema.safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({ message: "Invalid coordinator payload.", errors: parsed.error.flatten() });
    }

    try {
      const assignment = await validateCoordinatorAssignment(prisma, parsed.data.level, parsed.data.territory);
      const proposedTerritory = await resolveOperationalTerritory(prisma, assignment);
      if (!canCreateCoordinator(request.authUser!, proposedTerritory, assignment.level)) {
        return response.status(403).json({ message: "Coordinator assignment exceeds your command authority." });
      }

      const email = normalizeEmail(parsed.data.email);
      if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
        return response.status(409).json({ message: "Email is already registered." });
      }

      const user = await prisma.$transaction(async (transaction) => {
        const created = await transaction.user.create({
          data: {
            name: parsed.data.name,
            email,
            phone: parsed.data.phone || null,
            passwordHash: await hashPassword(parsed.data.password),
            role: "COORDINATOR",
            coordinatorProfile: { create: assignment },
          },
          select: { id: true, name: true, email: true, role: true, accountStatus: true },
        });
        await createAuditLog(transaction, {
          actorUserId: request.authUser!.id,
          action: "COORDINATOR_CREATED",
          targetType: "User",
          targetId: created.id,
          territory: assignment,
          metadata: { coordinatorLevel: assignment.level },
        });
        return created;
      });
      return response.status(201).json({ user });
    } catch (error) {
      return territoryErrorResponse(response, error);
    }
  },
);

router.patch(
  "/coordinators/:userId/assignment",
  requireAuth,
  requireRole("SUPER_ADMIN", "STATE_OFFICER", "COORDINATOR"),
  async (request, response) => {
    const userId = Array.isArray(request.params.userId) ? request.params.userId[0] : request.params.userId;
    const parsed = coordinatorAssignmentSchema.safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({ message: "Invalid assignment payload.", errors: parsed.error.flatten() });
    }
    if (userId === request.authUser!.id) {
      return response.status(403).json({ message: "Coordinators cannot change their own territory or level." });
    }

    const target = await getAuthUserProfile(userId);
    if (!target || target.role !== "COORDINATOR" || !target.coordinatorProfile) {
      return response.status(404).json({ message: "Coordinator not found." });
    }

    try {
      const assignment = await validateCoordinatorAssignment(prisma, parsed.data.level, parsed.data.territory);
      const proposedTerritory = await resolveOperationalTerritory(prisma, assignment);
      let currentTerritory;
      try {
        currentTerritory = await resolveOperationalTerritory(prisma, territoryInputFromProfile(readOperationalProfile(target)!));
      } catch (error) {
        if (request.authUser!.role !== "SUPER_ADMIN" && request.authUser!.role !== "STATE_OFFICER") {
          throw error;
        }
        currentTerritory = proposedTerritory;
      }
      if (!canAssignTerritory(request.authUser!, target, currentTerritory, proposedTerritory, assignment.level)) {
        return response.status(403).json({ message: "Territory reassignment exceeds your command authority." });
      }

      const before = { ...target.coordinatorProfile };
      await prisma.$transaction(async (transaction) => {
        await transaction.coordinatorProfile.update({ where: { userId }, data: assignment });
        await createAuditLog(transaction, {
          actorUserId: request.authUser!.id,
          action: "COORDINATOR_ASSIGNMENT_CHANGED",
          targetType: "User",
          targetId: userId,
          territory: assignment,
          metadata: { before, after: assignment },
        });
      });
      return response.json({ message: "Coordinator assignment updated.", assignment });
    } catch (error) {
      return territoryErrorResponse(response, error);
    }
  },
);

router.patch(
  "/users/:userId/status",
  requireAuth,
  requireRole("SUPER_ADMIN", "STATE_OFFICER", "COORDINATOR"),
  async (request, response) => {
    const userId = Array.isArray(request.params.userId) ? request.params.userId[0] : request.params.userId;
    const parsed = accountStatusSchema.safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({ message: "Invalid account status payload.", errors: parsed.error.flatten() });
    }
    const target = await getAuthUserProfile(userId);
    if (!target) {
      return response.status(404).json({ message: "User not found." });
    }

    let targetTerritory = null;
    const operationalProfile = readOperationalProfile(target);
    if (operationalProfile) {
      try {
        targetTerritory = await resolveOperationalTerritory(prisma, territoryInputFromProfile(operationalProfile));
      } catch (error) {
        if (request.authUser!.role !== "SUPER_ADMIN") {
          return territoryErrorResponse(response, error);
        }
      }
    }
    if (!canManageTargetUser(request.authUser!, target, targetTerritory)) {
      return response.status(403).json({ message: "Account status change exceeds your management authority." });
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: userId },
        data: { accountStatus: parsed.data.status, isActive: parsed.data.status === "ACTIVE" },
      });
      await createAuditLog(transaction, {
        actorUserId: request.authUser!.id,
        action: "ACCOUNT_STATUS_CHANGED",
        targetType: "User",
        targetId: userId,
        territory: targetTerritory || undefined,
        metadata: { before: target.accountStatus, after: parsed.data.status },
      });
    });
    return response.json({ message: "Account status updated.", status: parsed.data.status });
  },
);

export default router;
