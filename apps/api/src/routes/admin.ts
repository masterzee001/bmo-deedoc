import { Router } from "express";
import type { Response } from "express";
import {
  AdminLevel,
  AgentActivityType,
  AssignmentPermissionType,
  BroadcastAudience,
  CandidateOfficeType,
  FieldTaskPriority,
  FieldTaskStatus,
  IncidentSeverity,
  IncidentStatus,
  NotificationType,
  RewardRedemptionStatus,
  RewardType,
  UserRole,
} from "@prisma/client";
import { z } from "zod";
import { normalizeEmail } from "@pics-nigeria/shared";
import { getAuthUserProfile } from "../auth/profile";
import { hashPassword } from "../auth/password";
import { createAuditLog } from "../lib/audit";
import { createNotification } from "../lib/notifications";
import { requireAuth, requireRole } from "../middleware/auth";
import { prisma } from "../prisma";
import { recordParticipationAndReward } from "../lib/participation";
import { ensureNationalReferenceStates, syncLgasForState, syncPollingUnitsForWard, syncWardsForLga } from "../lib/inec-reference";
import {
  serializeAdminMapSummary,
  serializeAdminSummary,
  serializeAgentActivitySummary,
  serializeBroadcastMessageItem,
  serializeCandidateListItem,
  serializeFeedbackItem,
  serializeIncidentItem,
  serializePollingUnitCoverageSummary,
  serializeAuditLogItem,
  serializeFieldTaskItem,
  serializeNotificationItem,
  serializeRewardRedemption,
  serializeTerritory,
  serializeVoterEngagementTaskItem,
} from "../lib/serializers";
import { toScopeFilter, validateCandidateOfficeTerritory, validateTerritoryReferences } from "../lib/territory";
import {
  canCreateAgentInScope,
  canManageUser,
  canManageAdmin,
  canViewCandidate,
  isAdminUser,
  isSuperAdmin,
  isWithinAdminScope,
} from "../scope";
import { getRewardBalance } from "../lib/rewards";

const router = Router();

const adminCreationSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  adminLevel: z.nativeEnum(AdminLevel),
  geoPoliticalZoneId: z.string().trim().optional(),
  stateId: z.string().trim().optional(),
  senatorialDistrictId: z.string().trim().optional(),
  federalConstituencyId: z.string().trim().optional(),
  lgaId: z.string().trim().optional(),
  wardId: z.string().trim().optional(),
  stateConstituencyId: z.string().trim().optional(),
  pollingUnitId: z.string().trim().optional(),
});

const candidateCreationSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  officeType: z.nativeEnum(CandidateOfficeType),
  politicalPartyId: z.string().trim().optional(),
  geoPoliticalZoneId: z.string().trim().optional(),
  stateId: z.string().trim().optional(),
  senatorialDistrictId: z.string().trim().optional(),
  federalConstituencyId: z.string().trim().optional(),
  lgaId: z.string().trim().optional(),
  wardId: z.string().trim().optional(),
  stateConstituencyId: z.string().trim().optional(),
  pollingUnitId: z.string().trim().optional(),
});

const assignmentSchema = z.object({
  adminUserId: z.string().trim().min(1),
  candidateUserId: z.string().trim().min(1),
  permissionType: z.nativeEnum(AssignmentPermissionType),
});

const geoPoliticalZoneSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(2),
});

const geoPoliticalZoneUpdateSchema = z.object({
  name: z.string().trim().min(2),
});

const politicalPartySchema = z.object({
  id: z.string().trim().min(1),
  code: z.string().trim().min(2).max(10),
  name: z.string().trim().min(2),
  logoUrl: z.string().url().optional().or(z.literal("")),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  officialWebsite: z.string().url().optional().or(z.literal("")),
  isApprovedByInec: z.boolean().optional(),
  inecSourceUrl: z.string().url().optional().or(z.literal("")),
});

const politicalPartyUpdateSchema = z.object({
  code: z.string().trim().min(2).max(10),
  name: z.string().trim().min(2),
  logoUrl: z.string().url().optional().or(z.literal("")),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  officialWebsite: z.string().url().optional().or(z.literal("")),
  isApprovedByInec: z.boolean().optional(),
  inecSourceUrl: z.string().url().optional().or(z.literal("")),
});

const agentCreationSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().trim().min(7).optional(),
  stateId: z.string().trim().min(1),
  senatorialDistrictId: z.string().trim().optional(),
  federalConstituencyId: z.string().trim().optional(),
  lgaId: z.string().trim().min(1),
  wardId: z.string().trim().min(1),
  stateConstituencyId: z.string().trim().optional(),
  pollingUnitId: z.string().trim().optional(),
  assignedAdminUserId: z.string().trim().optional(),
});

const adminUpdateSchema = z.object({
  name: z.string().trim().min(2),
  adminLevel: z.nativeEnum(AdminLevel),
  geoPoliticalZoneId: z.string().trim().optional(),
  stateId: z.string().trim().optional(),
  senatorialDistrictId: z.string().trim().optional(),
  federalConstituencyId: z.string().trim().optional(),
  lgaId: z.string().trim().optional(),
  wardId: z.string().trim().optional(),
  stateConstituencyId: z.string().trim().optional(),
  pollingUnitId: z.string().trim().optional(),
});

const candidateUpdateSchema = z.object({
  name: z.string().trim().min(2),
  officeType: z.nativeEnum(CandidateOfficeType),
  politicalPartyId: z.string().trim().optional(),
  geoPoliticalZoneId: z.string().trim().optional(),
  stateId: z.string().trim().optional(),
  senatorialDistrictId: z.string().trim().optional(),
  federalConstituencyId: z.string().trim().optional(),
  lgaId: z.string().trim().optional(),
  wardId: z.string().trim().optional(),
  stateConstituencyId: z.string().trim().optional(),
  pollingUnitId: z.string().trim().optional(),
});

const agentUpdateSchema = z.object({
  name: z.string().trim().min(2),
  phone: z.string().trim().min(7).optional(),
  stateId: z.string().trim().min(1),
  senatorialDistrictId: z.string().trim().optional(),
  federalConstituencyId: z.string().trim().optional(),
  lgaId: z.string().trim().min(1),
  wardId: z.string().trim().min(1),
  stateConstituencyId: z.string().trim().optional(),
  pollingUnitId: z.string().trim().optional(),
  assignedAdminUserId: z.string().trim().optional(),
});

const userDeactivationSchema = z.object({
  isActive: z.boolean(),
});

const participationSchema = z.object({
  voterUserId: z.string().trim().min(1),
  type: z.string().trim().min(2),
  description: z.string().trim().min(2),
  pointsAwarded: z.number().int().min(1).max(100),
  relatedPollId: z.string().trim().optional(),
  relatedPostId: z.string().trim().optional(),
});

const pollCreationSchema = z.object({
  title: z.string().trim().min(3),
  description: z.string().trim().optional(),
  candidateUserId: z.string().trim().optional(),
  officeType: z.nativeEnum(CandidateOfficeType).optional(),
  stateId: z.string().trim().optional(),
  senatorialDistrictId: z.string().trim().optional(),
  federalConstituencyId: z.string().trim().optional(),
  lgaId: z.string().trim().optional(),
  wardId: z.string().trim().optional(),
  stateConstituencyId: z.string().trim().optional(),
  pollingUnitId: z.string().trim().optional(),
  options: z.array(z.string().trim().min(1)).min(2),
});

const agentActivityQuerySchema = z.object({
  agentUserId: z.string().trim().optional(),
  type: z.nativeEnum(AgentActivityType).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
});

const incidentQuerySchema = z.object({
  status: z.nativeEnum(IncidentStatus).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
});

const incidentStatusUpdateSchema = z.object({
  status: z.nativeEnum(IncidentStatus),
});

const incidentAssignSchema = z.object({
  assignedAdminUserId: z.string().trim().min(1),
});

const redemptionReviewSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

const auditLogQuerySchema = z.object({
  actorUserId: z.string().trim().optional(),
  action: z.string().trim().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

const recentChangesQuerySchema = z.object({
  since: z.string().datetime(),
});

const analyticsQuerySchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

const stateLookupQuerySchema = z.object({
  geoPoliticalZoneId: z.string().trim().optional(),
});

const stateScopedLookupQuerySchema = z.object({
  stateId: z.string().trim().min(1),
});

const federalConstituencyLookupQuerySchema = z.object({
  stateId: z.string().trim().min(1),
  senatorialDistrictId: z.string().trim().optional(),
});

const lgaScopedLookupQuerySchema = z.object({
  stateId: z.string().trim().optional(),
  lgaId: z.string().trim().optional(),
});

const managedUsersQuerySchema = z.object({
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.enum(["true", "false"]).optional(),
  search: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const wardScopedLookupQuerySchema = z.object({
  stateId: z.string().trim().min(1),
  lgaId: z.string().trim().min(1),
  wardId: z.string().trim().optional(),
});

const escalationSchema = z.object({
  escalationNote: z.string().trim().min(3).max(500),
});

const fieldTaskCreationSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(5).max(1000),
  assignedToUserId: z.string().trim().min(1),
  incidentId: z.string().trim().optional(),
  priority: z.nativeEnum(FieldTaskPriority).default(FieldTaskPriority.MEDIUM),
  dueAt: z.string().datetime().optional(),
});

const fieldTaskUpdateSchema = z.object({
  status: z.nativeEnum(FieldTaskStatus).optional(),
  priority: z.nativeEnum(FieldTaskPriority).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  resolutionNote: z.string().trim().max(1000).nullable().optional(),
});

const broadcastCreationSchema = z.object({
  title: z.string().trim().min(3).max(120),
  message: z.string().trim().min(5).max(1500),
  audience: z.nativeEnum(BroadcastAudience),
  taskStatus: z.nativeEnum(FieldTaskStatus).optional(),
  geoPoliticalZoneId: z.string().trim().optional(),
  stateId: z.string().trim().optional(),
  senatorialDistrictId: z.string().trim().optional(),
  federalConstituencyId: z.string().trim().optional(),
  lgaId: z.string().trim().optional(),
  wardId: z.string().trim().optional(),
  stateConstituencyId: z.string().trim().optional(),
  pollingUnitId: z.string().trim().optional(),
});

const engagementTaskCreationSchema = z.object({
  title: z.string().trim().min(3),
  description: z.string().trim().min(10),
  type: z.enum(["REGISTRATION", "REFERRAL", "POLL_RESPONSE"]),
  rewardPoints: z.number().int().min(1).max(1000),
  targetCount: z.number().int().min(1).max(100).optional(),
  geoPoliticalZoneId: z.string().trim().optional(),
  stateId: z.string().trim().optional(),
  senatorialDistrictId: z.string().trim().optional(),
  federalConstituencyId: z.string().trim().optional(),
  lgaId: z.string().trim().optional(),
  wardId: z.string().trim().optional(),
  stateConstituencyId: z.string().trim().optional(),
  pollingUnitId: z.string().trim().optional(),
});

function readRouteId(response: Response, value: string | string[] | undefined, label: string): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    response.status(400).json({ message: `Invalid ${label}.` });
    return null;
  }

  return value;
}

function enforceStateScope(
  actor: Express.Request["authUser"],
  requestedStateId?: string,
): string | null {
  if (!actor || actor.role === UserRole.SUPER_ADMIN || !actor.adminProfile?.stateId || !requestedStateId) {
    return null;
  }

  return actor.adminProfile.stateId === requestedStateId ? null : "You cannot view territory outside your state.";
}

function enforceLgaScope(
  actor: Express.Request["authUser"],
  requestedLgaId?: string,
): string | null {
  if (!actor || actor.role === UserRole.SUPER_ADMIN || !actor.adminProfile?.lgaId || !requestedLgaId) {
    return null;
  }

  return actor.adminProfile.lgaId === requestedLgaId ? null : "You cannot view territory outside your LGA.";
}

function validateAdminTerritoryPayload(data: {
  adminLevel: AdminLevel;
  geoPoliticalZoneId?: string;
  stateId?: string;
  senatorialDistrictId?: string;
  federalConstituencyId?: string;
  lgaId?: string;
  wardId?: string;
  stateConstituencyId?: string;
  pollingUnitId?: string;
}): string | null {
  if (data.adminLevel === "NATIONAL") {
    return data.geoPoliticalZoneId ||
      data.stateId ||
      data.senatorialDistrictId ||
      data.federalConstituencyId ||
      data.lgaId ||
      data.wardId ||
      data.stateConstituencyId ||
      data.pollingUnitId
      ? "NATIONAL admin must not include lower territory ids."
      : null;
  }

  if (data.adminLevel === "GEO_POLITICAL_ZONE" && !data.geoPoliticalZoneId) {
    return "GEO_POLITICAL_ZONE admin requires geoPoliticalZoneId.";
  }

  if (data.adminLevel === "STATE" && !data.stateId) {
    return "STATE admin requires stateId.";
  }

  if (data.adminLevel === "SENATORIAL" && (!data.stateId || !data.senatorialDistrictId)) {
    return "SENATORIAL admin requires stateId and senatorialDistrictId.";
  }

  if (data.adminLevel === "FEDERAL_CONSTITUENCY" && (!data.stateId || !data.federalConstituencyId)) {
    return "FEDERAL_CONSTITUENCY admin requires stateId and federalConstituencyId.";
  }

  if (data.adminLevel === "STATE_CONSTITUENCY" && (!data.stateId || !data.stateConstituencyId)) {
    return "STATE_CONSTITUENCY admin requires stateId and stateConstituencyId.";
  }

  if (data.adminLevel === "LGA" && (!data.stateId || !data.lgaId)) {
    return "LGA admin requires stateId and lgaId.";
  }

  if (data.adminLevel === "WARD" && (!data.stateId || !data.lgaId || !data.wardId)) {
    return "WARD admin requires stateId, lgaId, and wardId.";
  }

  return null;
}

async function enrichCandidateScope(data: {
  geoPoliticalZoneId?: string;
  stateId?: string;
  senatorialDistrictId?: string;
  federalConstituencyId?: string;
  lgaId?: string;
  wardId?: string;
  stateConstituencyId?: string;
  pollingUnitId?: string;
}) {
  const result = {
    geoPoliticalZoneId: data.geoPoliticalZoneId || null,
    stateId: data.stateId || null,
    senatorialDistrictId: data.senatorialDistrictId || null,
    federalConstituencyId: data.federalConstituencyId || null,
    lgaId: data.lgaId || null,
    wardId: data.wardId || null,
    stateConstituencyId: data.stateConstituencyId || null,
    pollingUnitId: data.pollingUnitId || null,
  };

  if (data.federalConstituencyId) {
    const constituency = await prisma.federalConstituency.findUnique({
      where: { id: data.federalConstituencyId },
      select: { senatorialDistrictId: true },
    });

    result.senatorialDistrictId = constituency?.senatorialDistrictId || result.senatorialDistrictId;
  }

  if (data.stateConstituencyId) {
    const constituency = await prisma.stateConstituency.findUnique({
      where: { id: data.stateConstituencyId },
      select: { lgaId: true },
    });

    result.lgaId = constituency?.lgaId || result.lgaId;
  }

  return result;
}

function getAgentScopeFilter(actor: Express.Request["authUser"]) {
  if (!actor || isSuperAdmin(actor)) {
    return {};
  }

  if (!actor.adminProfile) {
    return {};
  }

  return {
    geoPoliticalZoneId: actor.adminProfile.geoPoliticalZoneId || undefined,
    stateId: actor.adminProfile.stateId || undefined,
    lgaId: actor.adminProfile.lgaId || undefined,
    wardId: actor.adminProfile.wardId || undefined,
    pollingUnitId: actor.adminProfile.pollingUnitId || undefined,
  };
}

function getAgentActivityScopeFilter(actor: Express.Request["authUser"]) {
  if (!actor || isSuperAdmin(actor)) {
    return {};
  }

  if (!actor.adminProfile) {
    return {};
  }

  return {
    geoPoliticalZoneId: actor.adminProfile.geoPoliticalZoneId || undefined,
    stateId: actor.adminProfile.stateId || undefined,
    lgaId: actor.adminProfile.lgaId || undefined,
    wardId: actor.adminProfile.wardId || undefined,
    pollingUnitId: actor.adminProfile.pollingUnitId || undefined,
  };
}

function getFeedbackScopeFilter(actor: Express.Request["authUser"]) {
  if (!actor || isSuperAdmin(actor)) {
    return {};
  }

  if (!actor.adminProfile) {
    return {};
  }

  return {
    geoPoliticalZoneId: actor.adminProfile.geoPoliticalZoneId || undefined,
    stateId: actor.adminProfile.stateId || undefined,
    senatorialDistrictId: actor.adminProfile.senatorialDistrictId || undefined,
    lgaId: actor.adminProfile.lgaId || undefined,
    wardId: actor.adminProfile.wardId || undefined,
    pollingUnitId: actor.adminProfile.pollingUnitId || undefined,
  };
}

function getPollScopeFilter(actor: Express.Request["authUser"]) {
  if (!actor || isSuperAdmin(actor)) {
    return {};
  }

  if (!actor.adminProfile) {
    return {};
  }

  return {
    geoPoliticalZoneId: actor.adminProfile.geoPoliticalZoneId || undefined,
    stateId: actor.adminProfile.stateId || undefined,
    senatorialDistrictId: actor.adminProfile.senatorialDistrictId || undefined,
    federalConstituencyId: actor.adminProfile.federalConstituencyId || undefined,
    lgaId: actor.adminProfile.lgaId || undefined,
    wardId: actor.adminProfile.wardId || undefined,
    stateConstituencyId: actor.adminProfile.stateConstituencyId || undefined,
    pollingUnitId: actor.adminProfile.pollingUnitId || undefined,
  };
}

function getVoterScopeFilter(actor: Express.Request["authUser"]) {
  if (!actor || isSuperAdmin(actor)) {
    return {};
  }

  if (!actor.adminProfile) {
    return {};
  }

  return {
    geoPoliticalZoneId: actor.adminProfile.geoPoliticalZoneId || undefined,
    stateId: actor.adminProfile.stateId || undefined,
    lgaId: actor.adminProfile.lgaId || undefined,
    wardId: actor.adminProfile.wardId || undefined,
  };
}

function getFieldTaskScopeFilter(actor: Express.Request["authUser"]) {
  if (!actor || isSuperAdmin(actor)) {
    return {};
  }

  if (!actor.adminProfile) {
    return {};
  }

  return {
    geoPoliticalZoneId: actor.adminProfile.geoPoliticalZoneId || undefined,
    stateId: actor.adminProfile.stateId || undefined,
    senatorialDistrictId: actor.adminProfile.senatorialDistrictId || undefined,
    federalConstituencyId: actor.adminProfile.federalConstituencyId || undefined,
    lgaId: actor.adminProfile.lgaId || undefined,
    wardId: actor.adminProfile.wardId || undefined,
    stateConstituencyId: actor.adminProfile.stateConstituencyId || undefined,
    pollingUnitId: actor.adminProfile.pollingUnitId || undefined,
  };
}

function buildBroadcastScope(data: z.infer<typeof broadcastCreationSchema>) {
  return {
    geoPoliticalZoneId: data.geoPoliticalZoneId || undefined,
    stateId: data.stateId || undefined,
    senatorialDistrictId: data.senatorialDistrictId || undefined,
    federalConstituencyId: data.federalConstituencyId || undefined,
    lgaId: data.lgaId || undefined,
    wardId: data.wardId || undefined,
    stateConstituencyId: data.stateConstituencyId || undefined,
    pollingUnitId: data.pollingUnitId || undefined,
  };
}

function buildEngagementTaskScope(data: z.infer<typeof engagementTaskCreationSchema>) {
  return {
    geoPoliticalZoneId: data.geoPoliticalZoneId || undefined,
    stateId: data.stateId || undefined,
    senatorialDistrictId: data.senatorialDistrictId || undefined,
    federalConstituencyId: data.federalConstituencyId || undefined,
    lgaId: data.lgaId || undefined,
    wardId: data.wardId || undefined,
    stateConstituencyId: data.stateConstituencyId || undefined,
    pollingUnitId: data.pollingUnitId || undefined,
  };
}

function buildBroadcastRecipientWhere(
  audience: BroadcastAudience,
  scope: ReturnType<typeof buildBroadcastScope>,
  taskStatus?: FieldTaskStatus,
) {
  const adminClause = {
    role: UserRole.ADMIN,
    adminProfile: { is: scope },
  };
  const agentClause = {
    role: UserRole.AGENT,
    agentProfile: { is: scope },
    ...(taskStatus ? { assignedTasks: { some: { status: taskStatus } } } : {}),
  };
  const voterClause = {
    role: UserRole.VOTER,
    voterProfile: {
      is: {
        ...scope,
        contactConsent: true,
      },
    },
  };
  const candidateClause = {
    role: UserRole.CANDIDATE,
    candidateProfile: { is: scope },
  };

  if (audience === BroadcastAudience.ADMINS) {
    return adminClause;
  }
  if (audience === BroadcastAudience.AGENTS) {
    return agentClause;
  }
  if (audience === BroadcastAudience.VOTERS) {
    return voterClause;
  }
  if (audience === BroadcastAudience.CANDIDATES) {
    return candidateClause;
  }

  return {
    OR: [adminClause, agentClause, voterClause, candidateClause],
  };
}

function getTodayStart() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function escapeCsvValue(value: string | null | undefined): string {
  const normalized = value ?? "";
  return `"${normalized.replace(/"/g, "\"\"")}"`;
}

function getDateRange(input: { dateFrom?: string; dateTo?: string }) {
  if (!input.dateFrom && !input.dateTo) {
    return undefined;
  }

  return {
    gte: input.dateFrom ? new Date(input.dateFrom) : undefined,
    lte: input.dateTo ? new Date(input.dateTo) : undefined,
  };
}

function getPollingUnitScopeFilter(actor: Express.Request["authUser"]) {
  if (!actor || isSuperAdmin(actor) || !actor.adminProfile) {
    return {};
  }

  return {
    stateId: actor.adminProfile.stateId || undefined,
    lgaId: actor.adminProfile.lgaId || undefined,
    wardId: actor.adminProfile.wardId || undefined,
    id: actor.adminProfile.pollingUnitId || undefined,
  };
}

function applyActorAdminScope<T extends {
  geoPoliticalZoneId?: string;
  stateId?: string;
  senatorialDistrictId?: string;
  federalConstituencyId?: string;
  lgaId?: string;
  wardId?: string;
  stateConstituencyId?: string;
  pollingUnitId?: string;
}>(actor: Express.Request["authUser"], payload: T): T {
  if (!actor || actor.role !== UserRole.ADMIN || !actor.adminProfile) {
    return payload;
  }

  const scope = actor.adminProfile;

  return {
    ...payload,
    geoPoliticalZoneId: scope.geoPoliticalZoneId || payload.geoPoliticalZoneId,
    stateId: scope.stateId || payload.stateId,
    senatorialDistrictId: scope.senatorialDistrictId || payload.senatorialDistrictId,
    federalConstituencyId: scope.federalConstituencyId || payload.federalConstituencyId,
    lgaId: scope.lgaId || payload.lgaId,
    wardId: scope.wardId || payload.wardId,
    stateConstituencyId: scope.stateConstituencyId || payload.stateConstituencyId,
    pollingUnitId: scope.pollingUnitId || payload.pollingUnitId,
  };
}

router.post("/users", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const parsed = adminCreationSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid admin creation payload.", errors: parsed.error.flatten() });
  }

  const scopedPayload = applyActorAdminScope(request.authUser, parsed.data);

  const territoryError = validateAdminTerritoryPayload(scopedPayload);
  if (territoryError) {
    return response.status(400).json({ message: territoryError });
  }

  const territoryReferenceError = await validateTerritoryReferences(scopedPayload);
  if (territoryReferenceError) {
    return response.status(400).json({ message: territoryReferenceError });
  }

  if (!request.authUser || !canManageAdmin(request.authUser, scopedPayload)) {
    return response.status(403).json({ message: "You cannot create an admin at this level or territory." });
  }

  const email = normalizeEmail(scopedPayload.email);
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    return response.status(409).json({ message: "Email is already registered." });
  }

  const createdUser = await prisma.user.create({
    data: {
      name: parsed.data.name.trim(),
      email,
      passwordHash: await hashPassword(parsed.data.password),
      role: UserRole.ADMIN,
      adminProfile: {
        create: {
          adminLevel: scopedPayload.adminLevel,
          geoPoliticalZoneId: scopedPayload.geoPoliticalZoneId || null,
          stateId: scopedPayload.stateId || null,
          senatorialDistrictId: scopedPayload.senatorialDistrictId || null,
          federalConstituencyId: scopedPayload.federalConstituencyId || null,
          lgaId: scopedPayload.lgaId || null,
          wardId: scopedPayload.wardId || null,
          stateConstituencyId: scopedPayload.stateConstituencyId || null,
          pollingUnitId: scopedPayload.pollingUnitId || null,
        },
      },
    },
  });

  await createAuditLog(prisma, {
    actorUserId: request.authUser!.id,
    action: "ADMIN_CREATED",
    targetType: "User",
    targetId: createdUser.id,
      metadata: {
        adminLevel: scopedPayload.adminLevel,
        geoPoliticalZoneId: scopedPayload.geoPoliticalZoneId || null,
        stateId: scopedPayload.stateId || null,
      lgaId: scopedPayload.lgaId || null,
      wardId: scopedPayload.wardId || null,
    },
  });

  return response.status(201).json({
    message: "Admin created successfully.",
    user: await getAuthUserProfile(createdUser.id),
  });
});

router.post("/candidates", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const parsed = candidateCreationSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid candidate creation payload.", errors: parsed.error.flatten() });
  }

  const scopedPayload = applyActorAdminScope(request.authUser, parsed.data);

  const territoryError = validateCandidateOfficeTerritory(scopedPayload.officeType, scopedPayload);
  if (territoryError) {
    return response.status(400).json({ message: territoryError });
  }

  const territoryReferenceError = await validateTerritoryReferences(scopedPayload);
  if (territoryReferenceError) {
    return response.status(400).json({ message: territoryReferenceError });
  }

  if (scopedPayload.politicalPartyId) {
    const party = await prisma.politicalParty.findUnique({
      where: { id: scopedPayload.politicalPartyId },
      select: { id: true },
    });

    if (!party) {
      return response.status(400).json({ message: "Selected political party does not exist." });
    }
  }

  const scope = await enrichCandidateScope(scopedPayload);

  if (!request.authUser || !canViewCandidate(request.authUser, scope)) {
    return response.status(403).json({ message: "You cannot create a candidate outside your admin territory." });
  }

  const email = normalizeEmail(scopedPayload.email);
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    return response.status(409).json({ message: "Email is already registered." });
  }

  const createdUser = await prisma.user.create({
    data: {
      name: scopedPayload.name.trim(),
      email,
      passwordHash: await hashPassword(scopedPayload.password),
      role: UserRole.CANDIDATE,
      candidateProfile: {
        create: {
          officeType: scopedPayload.officeType,
          politicalPartyId: scopedPayload.politicalPartyId || null,
          ...scope,
        },
      },
    },
  });

  await createAuditLog(prisma, {
    actorUserId: request.authUser!.id,
    action: "CANDIDATE_CREATED",
    targetType: "User",
    targetId: createdUser.id,
      metadata: {
        officeType: scopedPayload.officeType,
        politicalPartyId: scopedPayload.politicalPartyId || null,
        geoPoliticalZoneId: scope.geoPoliticalZoneId,
        stateId: scope.stateId,
      lgaId: scope.lgaId,
      wardId: scope.wardId,
    },
  });

  return response.status(201).json({
    message: "Candidate created successfully.",
    user: await getAuthUserProfile(createdUser.id),
  });
});

router.post("/candidates/assign", requireAuth, requireRole("SUPER_ADMIN"), async (request, response) => {
  const parsed = assignmentSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid candidate assignment payload.", errors: parsed.error.flatten() });
  }

  const [adminUser, candidateUser] = await Promise.all([
    prisma.user.findUnique({
      where: { id: parsed.data.adminUserId },
      include: { adminProfile: true },
    }),
    prisma.user.findUnique({
      where: { id: parsed.data.candidateUserId },
      include: { candidateProfile: true },
    }),
  ]);

  if (!adminUser?.adminProfile) {
    return response.status(404).json({ message: "Admin user was not found." });
  }

  if (!candidateUser?.candidateProfile) {
    return response.status(404).json({ message: "Candidate user was not found." });
  }

  const adminAuth = await getAuthUserProfile(adminUser.id);
  if (!adminAuth || !canViewCandidate(adminAuth, { ...candidateUser.candidateProfile, userId: candidateUser.id })) {
    return response.status(400).json({ message: "Admin territory is not compatible with the candidate territory." });
  }

  const existingAssignment = await prisma.adminCandidateAssignment.findUnique({
    where: {
      adminUserId_candidateUserId_permissionType: {
        adminUserId: parsed.data.adminUserId,
        candidateUserId: parsed.data.candidateUserId,
        permissionType: parsed.data.permissionType,
      },
    },
    select: { id: true },
  });

  if (existingAssignment) {
    return response.status(409).json({ message: "This assignment already exists." });
  }

  const assignment = await prisma.adminCandidateAssignment.create({
    data: parsed.data,
  });

  await createAuditLog(prisma, {
    actorUserId: request.authUser!.id,
    action: "CANDIDATE_ASSIGNED",
    targetType: "AdminCandidateAssignment",
    targetId: assignment.id,
    metadata: {
      adminUserId: parsed.data.adminUserId,
      candidateUserId: parsed.data.candidateUserId,
      permissionType: parsed.data.permissionType,
    },
  });

  return response.status(201).json({
    message: "Candidate assigned successfully.",
    assignment,
  });
});

router.get("/geo-political-zones", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (_request, response) => {
  const zones = await prisma.geoPoliticalZone.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return response.json({ zones });
});

router.get("/states", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const parsed = stateLookupQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid state lookup query.", errors: parsed.error.flatten() });
  }

  if ((await prisma.state.count()) < 37) {
    await ensureNationalReferenceStates(prisma);
  }

  const actor = request.authUser;
  const requestedZoneId = parsed.data.geoPoliticalZoneId;
  const actorZoneId = actor?.adminProfile?.geoPoliticalZoneId || null;

  if (actor?.role === "ADMIN" && actorZoneId && requestedZoneId && requestedZoneId !== actorZoneId) {
    return response.status(403).json({ message: "You cannot view states outside your geo-political zone." });
  }

  const states = await prisma.state.findMany({
    where: {
      geoPoliticalZoneId: requestedZoneId || actorZoneId || undefined,
      id: actor?.role === "ADMIN" ? actor.adminProfile?.stateId || undefined : undefined,
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, geoPoliticalZoneId: true },
  });

  return response.json({ states });
});

router.get("/senatorial-districts", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const parsed = stateScopedLookupQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid senatorial district lookup query.", errors: parsed.error.flatten() });
  }

  const scopeError = enforceStateScope(request.authUser, parsed.data.stateId);
  if (scopeError) {
    return response.status(403).json({ message: scopeError });
  }

  const districts = await prisma.senatorialDistrict.findMany({
    where: { stateId: parsed.data.stateId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, stateId: true },
  });

  return response.json({ districts });
});

router.get("/federal-constituencies", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const parsed = federalConstituencyLookupQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid federal constituency lookup query.", errors: parsed.error.flatten() });
  }

  const scopeError = enforceStateScope(request.authUser, parsed.data.stateId);
  if (scopeError) {
    return response.status(403).json({ message: scopeError });
  }

  const constituencies = await prisma.federalConstituency.findMany({
    where: {
      stateId: parsed.data.stateId,
      senatorialDistrictId: parsed.data.senatorialDistrictId || undefined,
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, stateId: true, senatorialDistrictId: true },
  });

  return response.json({ constituencies });
});

router.get("/lgas", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const parsed = stateScopedLookupQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid LGA lookup query.", errors: parsed.error.flatten() });
  }

  const scopeError = enforceStateScope(request.authUser, parsed.data.stateId);
  if (scopeError) {
    return response.status(403).json({ message: scopeError });
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

router.get("/wards", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const parsed = lgaScopedLookupQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid ward lookup query.", errors: parsed.error.flatten() });
  }

  const stateScopeError = enforceStateScope(request.authUser, parsed.data.stateId);
  if (stateScopeError) {
    return response.status(403).json({ message: stateScopeError });
  }

  const lgaScopeError = enforceLgaScope(request.authUser, parsed.data.lgaId);
  if (lgaScopeError) {
    return response.status(403).json({ message: lgaScopeError });
  }

  let wards = await prisma.ward.findMany({
    where: {
      stateId: parsed.data.stateId,
      lgaId: parsed.data.lgaId || undefined,
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, stateId: true, lgaId: true },
  });

  if (wards.length === 0 && parsed.data.stateId && parsed.data.lgaId) {
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

router.get("/state-constituencies", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const parsed = lgaScopedLookupQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid state constituency lookup query.", errors: parsed.error.flatten() });
  }

  const stateScopeError = enforceStateScope(request.authUser, parsed.data.stateId);
  if (stateScopeError) {
    return response.status(403).json({ message: stateScopeError });
  }

  const lgaScopeError = enforceLgaScope(request.authUser, parsed.data.lgaId);
  if (lgaScopeError) {
    return response.status(403).json({ message: lgaScopeError });
  }

  const constituencies = await prisma.stateConstituency.findMany({
    where: {
      stateId: parsed.data.stateId,
      lgaId: parsed.data.lgaId || undefined,
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, stateId: true, lgaId: true },
  });

  return response.json({ constituencies });
});

router.get("/polling-units", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const parsed = wardScopedLookupQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid polling unit lookup query.", errors: parsed.error.flatten() });
  }

  const stateScopeError = enforceStateScope(request.authUser, parsed.data.stateId);
  if (stateScopeError) {
    return response.status(403).json({ message: stateScopeError });
  }

  const lgaScopeError = enforceLgaScope(request.authUser, parsed.data.lgaId);
  if (lgaScopeError) {
    return response.status(403).json({ message: lgaScopeError });
  }

  let pollingUnits = await prisma.pollingUnit.findMany({
    where: {
      stateId: parsed.data.stateId,
      lgaId: parsed.data.lgaId,
      wardId: parsed.data.wardId || undefined,
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, stateId: true, lgaId: true, wardId: true },
  });

  if (pollingUnits.length === 0 && parsed.data.stateId && parsed.data.wardId) {
    await syncPollingUnitsForWard(prisma, parsed.data.stateId, parsed.data.lgaId, parsed.data.wardId);
    pollingUnits = await prisma.pollingUnit.findMany({
      where: {
        stateId: parsed.data.stateId,
        lgaId: parsed.data.lgaId,
        wardId: parsed.data.wardId,
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, stateId: true, lgaId: true, wardId: true },
    });
  }

  return response.json({ pollingUnits });
});

router.get("/admin-users", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const parsed = lgaScopedLookupQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid admin user lookup query.", errors: parsed.error.flatten() });
  }

  const stateScopeError = enforceStateScope(request.authUser, parsed.data.stateId);
  if (stateScopeError) {
    return response.status(403).json({ message: stateScopeError });
  }

  const lgaScopeError = enforceLgaScope(request.authUser, parsed.data.lgaId);
  if (lgaScopeError) {
    return response.status(403).json({ message: lgaScopeError });
  }

  const admins = await prisma.user.findMany({
    where: {
      role: UserRole.ADMIN,
      adminProfile: {
        is: {
          stateId: parsed.data.stateId || undefined,
          lgaId: parsed.data.lgaId || undefined,
        },
      },
    },
    include: { adminProfile: true },
    orderBy: { name: "asc" },
  });

  const adminUsers = admins
    .filter((admin) => admin.adminProfile)
    .map((admin) => ({
      userId: admin.id,
      name: admin.name,
      email: admin.email,
      isActive: admin.isActive,
      adminLevel: admin.adminProfile!.adminLevel,
      territory: serializeTerritory(admin.adminProfile!),
    }));

  return response.json({ adminUsers });
});

router.get("/users/manage", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const parsed = managedUsersQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid managed users query.", errors: parsed.error.flatten() });
  }

  const actor = request.authUser;
  const users = await prisma.user.findMany({
    where: {
      role: parsed.data.role || undefined,
      isActive: parsed.data.isActive === undefined ? undefined : parsed.data.isActive === "true",
      OR: parsed.data.search
        ? [
            { name: { contains: parsed.data.search } },
            { email: { contains: parsed.data.search } },
          ]
        : undefined,
    },
    include: {
      adminProfile: true,
      candidateProfile: true,
      agentProfile: true,
      voterProfile: true,
    },
    orderBy: { createdAt: "desc" },
    take: parsed.data.limit || 24,
  });

  const managedUsers = [];
  for (const user of users) {
    const targetAuth = await getAuthUserProfile(user.id);
    if (!actor || !targetAuth || !canManageUser(actor, targetAuth)) {
      continue;
    }

    managedUsers.push({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      territory: serializeTerritory(user.adminProfile || user.candidateProfile || user.agentProfile || user.voterProfile || {}),
      adminLevel: user.adminProfile?.adminLevel || null,
      officeType: user.candidateProfile?.officeType || null,
      voterCardNumber: user.voterProfile?.voterCardNumber || null,
      assignedAdminUserId: user.agentProfile?.assignedAdminUserId || null,
    });
  }

  return response.json({ users: managedUsers });
});

router.post("/geo-political-zones", requireAuth, requireRole("SUPER_ADMIN"), async (request, response) => {
  const parsed = geoPoliticalZoneSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid geo-political zone payload.", errors: parsed.error.flatten() });
  }

  const existing = await prisma.geoPoliticalZone.findFirst({
    where: {
      OR: [
        { id: parsed.data.id },
        { name: parsed.data.name.trim() },
      ],
    },
    select: { id: true },
  });

  if (existing) {
    return response.status(409).json({ message: "Geo-political zone already exists." });
  }

  const zone = await prisma.geoPoliticalZone.create({
    data: {
      id: parsed.data.id,
      name: parsed.data.name.trim(),
    },
  });

  await createAuditLog(prisma, {
    actorUserId: request.authUser!.id,
    action: "GEO_POLITICAL_ZONE_CREATED",
    targetType: "GeoPoliticalZone",
    targetId: zone.id,
  });

  return response.status(201).json({ message: "Geo-political zone created successfully.", zone });
});

router.patch("/geo-political-zones/:zoneId", requireAuth, requireRole("SUPER_ADMIN"), async (request, response) => {
  const zoneId = readRouteId(response, request.params.zoneId, "zone id");
  if (!zoneId) {
    return;
  }

  const parsed = geoPoliticalZoneUpdateSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid geo-political zone payload.", errors: parsed.error.flatten() });
  }

  const name = parsed.data.name.trim();
  const zone = await prisma.geoPoliticalZone.findUnique({
    where: { id: zoneId },
    select: { id: true },
  });

  if (!zone) {
    return response.status(404).json({ message: "Geo-political zone not found." });
  }

  const duplicate = await prisma.geoPoliticalZone.findFirst({
    where: {
      name,
      NOT: { id: zoneId },
    },
    select: { id: true },
  });

  if (duplicate) {
    return response.status(409).json({ message: "Geo-political zone already exists." });
  }

  const updatedZone = await prisma.geoPoliticalZone.update({
    where: { id: zoneId },
    data: { name },
    select: { id: true, name: true },
  });

  await createAuditLog(prisma, {
    actorUserId: request.authUser!.id,
    action: "GEO_POLITICAL_ZONE_UPDATED",
    targetType: "GeoPoliticalZone",
    targetId: updatedZone.id,
    metadata: { name: updatedZone.name },
  });

  return response.json({ message: "Geo-political zone updated successfully.", zone: updatedZone });
});

router.delete("/geo-political-zones/:zoneId", requireAuth, requireRole("SUPER_ADMIN"), async (request, response) => {
  const zoneId = readRouteId(response, request.params.zoneId, "zone id");
  if (!zoneId) {
    return;
  }

  const zone = await prisma.geoPoliticalZone.findUnique({
    where: { id: zoneId },
    select: { id: true, name: true },
  });

  if (!zone) {
    return response.status(404).json({ message: "Geo-political zone not found." });
  }

  const [
    stateCount,
    adminProfileCount,
    candidateProfileCount,
    agentProfileCount,
    voterProfileCount,
    pollCount,
    postCount,
    feedbackCount,
    agentActivityCount,
    incidentCount,
  ] = await prisma.$transaction([
    prisma.state.count({ where: { geoPoliticalZoneId: zoneId } }),
    prisma.adminProfile.count({ where: { geoPoliticalZoneId: zoneId } }),
    prisma.candidateProfile.count({ where: { geoPoliticalZoneId: zoneId } }),
    prisma.agentProfile.count({ where: { geoPoliticalZoneId: zoneId } }),
    prisma.voterProfile.count({ where: { geoPoliticalZoneId: zoneId } }),
    prisma.poll.count({ where: { geoPoliticalZoneId: zoneId } }),
    prisma.post.count({ where: { geoPoliticalZoneId: zoneId } }),
    prisma.feedback.count({ where: { geoPoliticalZoneId: zoneId } }),
    prisma.agentActivity.count({ where: { geoPoliticalZoneId: zoneId } }),
    prisma.incident.count({ where: { geoPoliticalZoneId: zoneId } }),
  ]);

  const dependencyCounts = {
    states: stateCount,
    adminProfiles: adminProfileCount,
    candidateProfiles: candidateProfileCount,
    agentProfiles: agentProfileCount,
    voterProfiles: voterProfileCount,
    polls: pollCount,
    posts: postCount,
    feedbackItems: feedbackCount,
    agentActivities: agentActivityCount,
    incidents: incidentCount,
  };
  const totalDependencies = Object.values(dependencyCounts).reduce((sum, count) => sum + count, 0);

  if (totalDependencies > 0) {
    return response.status(409).json({
      message: "Geo-political zone cannot be deleted because it is in use.",
      dependencyCounts,
    });
  }

  await prisma.geoPoliticalZone.delete({ where: { id: zoneId } });

  await createAuditLog(prisma, {
    actorUserId: request.authUser!.id,
    action: "GEO_POLITICAL_ZONE_DELETED",
    targetType: "GeoPoliticalZone",
    targetId: zone.id,
    metadata: { name: zone.name },
  });

  return response.json({ message: "Geo-political zone deleted successfully." });
});

router.get("/political-parties", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (_request, response) => {
  const parties = await prisma.politicalParty.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      logoUrl: true,
      description: true,
      officialWebsite: true,
      isApprovedByInec: true,
      inecSourceUrl: true,
    },
  });

  return response.json({ parties });
});

router.post("/political-parties", requireAuth, requireRole("SUPER_ADMIN"), async (request, response) => {
  const parsed = politicalPartySchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid political party payload.", errors: parsed.error.flatten() });
  }

  const code = parsed.data.code.trim().toUpperCase();
  const name = parsed.data.name.trim();
  const existing = await prisma.politicalParty.findFirst({
    where: {
      OR: [
        { id: parsed.data.id },
        { code },
        { name },
      ],
    },
    select: { id: true },
  });

  if (existing) {
    return response.status(409).json({ message: "Political party already exists." });
  }

  const party = await prisma.politicalParty.create({
    data: {
      id: parsed.data.id,
      code,
      name,
      logoUrl: parsed.data.logoUrl || null,
      description: parsed.data.description || null,
      officialWebsite: parsed.data.officialWebsite || null,
      isApprovedByInec: parsed.data.isApprovedByInec ?? false,
      inecSourceUrl: parsed.data.inecSourceUrl || null,
    },
  });

  await createAuditLog(prisma, {
    actorUserId: request.authUser!.id,
    action: "POLITICAL_PARTY_CREATED",
    targetType: "PoliticalParty",
    targetId: party.id,
  });

  return response.status(201).json({ message: "Political party created successfully.", party });
});

router.patch("/political-parties/:partyId", requireAuth, requireRole("SUPER_ADMIN"), async (request, response) => {
  const partyId = readRouteId(response, request.params.partyId, "party id");
  if (!partyId) {
    return;
  }

  const parsed = politicalPartyUpdateSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid political party payload.", errors: parsed.error.flatten() });
  }

  const code = parsed.data.code.trim().toUpperCase();
  const name = parsed.data.name.trim();
  const party = await prisma.politicalParty.findUnique({
    where: { id: partyId },
    select: { id: true },
  });

  if (!party) {
    return response.status(404).json({ message: "Political party not found." });
  }

  const duplicate = await prisma.politicalParty.findFirst({
    where: {
      OR: [{ code }, { name }],
      NOT: { id: partyId },
    },
    select: { id: true },
  });

  if (duplicate) {
    return response.status(409).json({ message: "Political party already exists." });
  }

  const updatedParty = await prisma.politicalParty.update({
    where: { id: partyId },
    data: {
      code,
      name,
      logoUrl: parsed.data.logoUrl === undefined ? undefined : parsed.data.logoUrl || null,
      description: parsed.data.description === undefined ? undefined : parsed.data.description || null,
      officialWebsite: parsed.data.officialWebsite === undefined ? undefined : parsed.data.officialWebsite || null,
      isApprovedByInec: parsed.data.isApprovedByInec,
      inecSourceUrl: parsed.data.inecSourceUrl === undefined ? undefined : parsed.data.inecSourceUrl || null,
    },
    select: {
      id: true,
      code: true,
      name: true,
      logoUrl: true,
      description: true,
      officialWebsite: true,
      isApprovedByInec: true,
      inecSourceUrl: true,
    },
  });

  await createAuditLog(prisma, {
    actorUserId: request.authUser!.id,
    action: "POLITICAL_PARTY_UPDATED",
    targetType: "PoliticalParty",
    targetId: updatedParty.id,
    metadata: { code: updatedParty.code, name: updatedParty.name },
  });

  return response.json({ message: "Political party updated successfully.", party: updatedParty });
});

router.delete("/political-parties/:partyId", requireAuth, requireRole("SUPER_ADMIN"), async (request, response) => {
  const partyId = readRouteId(response, request.params.partyId, "party id");
  if (!partyId) {
    return;
  }

  const party = await prisma.politicalParty.findUnique({
    where: { id: partyId },
    select: { id: true, name: true, code: true },
  });

  if (!party) {
    return response.status(404).json({ message: "Political party not found." });
  }

  const candidateProfileCount = await prisma.candidateProfile.count({
    where: { politicalPartyId: partyId },
  });

  if (candidateProfileCount > 0) {
    return response.status(409).json({
      message: "Political party cannot be deleted because it is in use.",
      dependencyCounts: { candidateProfiles: candidateProfileCount },
    });
  }

  await prisma.politicalParty.delete({ where: { id: partyId } });

  await createAuditLog(prisma, {
    actorUserId: request.authUser!.id,
    action: "POLITICAL_PARTY_DELETED",
    targetType: "PoliticalParty",
    targetId: party.id,
    metadata: { code: party.code, name: party.name },
  });

  return response.json({ message: "Political party deleted successfully." });
});

router.get("/candidates", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const actor = request.authUser;
  const candidates = await prisma.user.findMany({
    where: { role: UserRole.CANDIDATE },
    include: {
      candidateProfile: true,
      assignedAdminLinks: actor
        ? {
            where: { adminUserId: actor.id },
            select: { permissionType: true },
          }
        : false,
    },
    orderBy: { createdAt: "desc" },
  });

  const visibleCandidates = candidates
    .filter((candidate) => {
      if (!candidate.candidateProfile || !actor) {
        return false;
      }

      return (
        canViewCandidate(actor, { ...candidate.candidateProfile, userId: candidate.id }) ||
        candidate.assignedAdminLinks.length > 0
      );
    })
    .map((candidate) => serializeCandidateListItem(candidate));

  return response.json({ candidates: visibleCandidates });
});

router.post("/agents", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const parsed = agentCreationSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid agent creation payload.", errors: parsed.error.flatten() });
  }

  const scopedPayload = applyActorAdminScope(request.authUser, parsed.data);

  const territoryReferenceError = await validateTerritoryReferences(scopedPayload);
  if (territoryReferenceError) {
    return response.status(400).json({ message: territoryReferenceError });
  }

  const state = await prisma.state.findUnique({
    where: { id: scopedPayload.stateId },
    select: { geoPoliticalZoneId: true },
  });

  const agentTerritory = {
    geoPoliticalZoneId: state?.geoPoliticalZoneId || undefined,
    stateId: scopedPayload.stateId,
    senatorialDistrictId: scopedPayload.senatorialDistrictId || undefined,
    federalConstituencyId: scopedPayload.federalConstituencyId || undefined,
    lgaId: scopedPayload.lgaId,
    wardId: scopedPayload.wardId,
    stateConstituencyId: scopedPayload.stateConstituencyId || undefined,
    pollingUnitId: scopedPayload.pollingUnitId || undefined,
  };

  if (
    request.authUser?.role === UserRole.ADMIN &&
    request.authUser.adminProfile?.adminLevel === AdminLevel.LGA &&
    (request.authUser.adminProfile.stateId !== scopedPayload.stateId || request.authUser.adminProfile.lgaId !== scopedPayload.lgaId)
  ) {
    return response.status(403).json({ message: "LGA admins can only create ward agents inside their assigned LGA." });
  }

  if (!request.authUser || !canCreateAgentInScope(request.authUser, agentTerritory)) {
    return response.status(403).json({ message: "You cannot create an agent in this territory." });
  }

  if (scopedPayload.assignedAdminUserId) {
    const assignedAdmin = await prisma.user.findUnique({
      where: { id: scopedPayload.assignedAdminUserId },
      include: { adminProfile: true },
    });

    if (!assignedAdmin?.adminProfile) {
      return response.status(400).json({ message: "Assigned admin does not exist." });
    }

    const assignedAdminAuth = await getAuthUserProfile(assignedAdmin.id);
    if (!assignedAdminAuth || !canCreateAgentInScope(assignedAdminAuth, agentTerritory)) {
      return response.status(400).json({ message: "Assigned admin cannot manage this agent territory." });
    }
  }

  const email = normalizeEmail(scopedPayload.email);
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    return response.status(409).json({ message: "Email is already registered." });
  }

  const createdUser = await prisma.user.create({
    data: {
      name: scopedPayload.name.trim(),
      email,
      phone: scopedPayload.phone?.trim() || null,
      passwordHash: await hashPassword(scopedPayload.password),
      role: UserRole.AGENT,
      agentProfile: {
        create: {
          geoPoliticalZoneId: state?.geoPoliticalZoneId || null,
          stateId: scopedPayload.stateId,
          senatorialDistrictId: scopedPayload.senatorialDistrictId || null,
          federalConstituencyId: scopedPayload.federalConstituencyId || null,
          lgaId: scopedPayload.lgaId,
          wardId: scopedPayload.wardId,
          stateConstituencyId: scopedPayload.stateConstituencyId || null,
          pollingUnitId: scopedPayload.pollingUnitId || null,
          assignedAdminUserId: scopedPayload.assignedAdminUserId || null,
        },
      },
    },
  });

  await createAuditLog(prisma, {
    actorUserId: request.authUser!.id,
    action: "AGENT_CREATED",
    targetType: "User",
    targetId: createdUser.id,
    metadata: {
      stateId: scopedPayload.stateId,
      senatorialDistrictId: scopedPayload.senatorialDistrictId || null,
      federalConstituencyId: scopedPayload.federalConstituencyId || null,
      lgaId: scopedPayload.lgaId,
      wardId: scopedPayload.wardId,
      stateConstituencyId: scopedPayload.stateConstituencyId || null,
      pollingUnitId: scopedPayload.pollingUnitId || null,
    },
  });

  return response.status(201).json({
    message: "Agent created successfully.",
    user: await getAuthUserProfile(createdUser.id),
  });
});

router.get("/agents", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const actor = request.authUser;
  const agents = await prisma.user.findMany({
    where: {
      role: UserRole.AGENT,
      agentProfile: {
        is: getAgentScopeFilter(actor),
      },
    },
    include: { agentProfile: true },
    orderBy: { createdAt: "desc" },
  });

  const agentUsers = agents
    .filter((agent) => agent.agentProfile)
    .map((agent) => ({
      userId: agent.id,
      name: agent.name,
      email: agent.email,
      isActive: agent.isActive,
      phone: agent.phone || null,
      assignedAdminUserId: agent.agentProfile!.assignedAdminUserId || null,
      territory: serializeTerritory(agent.agentProfile!),
    }));

  return response.json({ agents: agentUsers });
});

router.get("/voters", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const actor = request.authUser;
  const voters = await prisma.user.findMany({
    where: {
      role: UserRole.VOTER,
      voterProfile: actor && !isSuperAdmin(actor) ? { is: getVoterScopeFilter(actor) } : undefined,
    },
    include: { voterProfile: true },
    orderBy: { createdAt: "desc" },
  });

  const voterUsers = voters
    .filter((voter) => voter.voterProfile)
    .map((voter) => ({
      userId: voter.id,
      name: voter.name,
      email: voter.email,
      phone: voter.phone,
      isActive: voter.isActive,
      voterCardNumber: voter.voterProfile!.voterCardNumber,
      referralCode: voter.voterProfile!.referralCode,
      contactConsent: voter.voterProfile!.contactConsent,
      termsAcceptedAt: voter.voterProfile!.termsAcceptedAt?.toISOString() || null,
      territory: serializeTerritory(voter.voterProfile!),
    }));

  return response.json({ voters: voterUsers });
});

router.get("/voters/export", requireAuth, requireRole("SUPER_ADMIN"), async (request, response) => {
  const voters = await prisma.user.findMany({
    where: {
      role: UserRole.VOTER,
      isActive: true,
      voterProfile: {
        is: {
          contactConsent: true,
        },
      },
    },
    include: { voterProfile: true },
    orderBy: { createdAt: "desc" },
  });

  const rows = [
    [
      "name",
      "email",
      "phone",
      "voterCardNumber",
      "referralCode",
      "termsAcceptedAt",
      "stateId",
      "lgaId",
      "wardId",
      "pollingUnitId",
    ].join(","),
    ...voters
      .filter((voter) => voter.voterProfile)
      .map((voter) =>
        [
          escapeCsvValue(voter.name),
          escapeCsvValue(voter.email),
          escapeCsvValue(voter.phone),
          escapeCsvValue(voter.voterProfile!.voterCardNumber),
          escapeCsvValue(voter.voterProfile!.referralCode),
          escapeCsvValue(voter.voterProfile!.termsAcceptedAt?.toISOString() || ""),
          escapeCsvValue(voter.voterProfile!.stateId),
          escapeCsvValue(voter.voterProfile!.lgaId),
          escapeCsvValue(voter.voterProfile!.wardId),
          escapeCsvValue(voter.voterProfile!.pollingUnitId || ""),
        ].join(","),
      ),
  ];

  response.setHeader("Content-Type", "text/csv; charset=utf-8");
  response.setHeader("Content-Disposition", `attachment; filename="voters-consented-${new Date().toISOString().slice(0, 10)}.csv"`);
  return response.status(200).send(rows.join("\n"));
});

router.patch("/users/:userId", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const userId = readRouteId(response, request.params.userId, "user id");
  if (!userId) {
    return;
  }

  const parsed = adminUpdateSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid admin update payload.", errors: parsed.error.flatten() });
  }

  const scopedPayload = applyActorAdminScope(request.authUser, parsed.data);

  const territoryError = validateAdminTerritoryPayload(scopedPayload);
  if (territoryError) {
    return response.status(400).json({ message: territoryError });
  }

  const territoryReferenceError = await validateTerritoryReferences(scopedPayload);
  if (territoryReferenceError) {
    return response.status(400).json({ message: territoryReferenceError });
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { adminProfile: true },
  });

  if (!targetUser?.adminProfile) {
    return response.status(404).json({ message: "Admin user not found." });
  }

  const targetAuth = await getAuthUserProfile(targetUser.id);
  if (!request.authUser || !targetAuth || !canManageUser(request.authUser, targetAuth) || !canManageAdmin(request.authUser, scopedPayload)) {
    return response.status(403).json({ message: "You cannot update an admin at this level or territory." });
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      name: scopedPayload.name.trim(),
      adminProfile: {
        update: {
          adminLevel: scopedPayload.adminLevel,
          geoPoliticalZoneId: scopedPayload.geoPoliticalZoneId || null,
          stateId: scopedPayload.stateId || null,
          senatorialDistrictId: scopedPayload.senatorialDistrictId || null,
          federalConstituencyId: scopedPayload.federalConstituencyId || null,
          lgaId: scopedPayload.lgaId || null,
          wardId: scopedPayload.wardId || null,
          stateConstituencyId: scopedPayload.stateConstituencyId || null,
          pollingUnitId: scopedPayload.pollingUnitId || null,
        },
      },
    },
  });

  await createAuditLog(prisma, {
    actorUserId: request.authUser!.id,
    action: "ADMIN_UPDATED",
    targetType: "User",
    targetId: updatedUser.id,
  });

  return response.json({ message: "Admin updated successfully.", user: await getAuthUserProfile(updatedUser.id) });
});

router.patch("/candidates/:userId", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const userId = readRouteId(response, request.params.userId, "user id");
  if (!userId) {
    return;
  }

  const parsed = candidateUpdateSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid candidate update payload.", errors: parsed.error.flatten() });
  }

  const scopedPayload = applyActorAdminScope(request.authUser, parsed.data);

  const territoryError = validateCandidateOfficeTerritory(scopedPayload.officeType, scopedPayload);
  if (territoryError) {
    return response.status(400).json({ message: territoryError });
  }

  const territoryReferenceError = await validateTerritoryReferences(scopedPayload);
  if (territoryReferenceError) {
    return response.status(400).json({ message: territoryReferenceError });
  }

  if (scopedPayload.politicalPartyId) {
    const party = await prisma.politicalParty.findUnique({
      where: { id: scopedPayload.politicalPartyId },
      select: { id: true },
    });

    if (!party) {
      return response.status(400).json({ message: "Selected political party does not exist." });
    }
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { candidateProfile: true },
  });

  if (!targetUser?.candidateProfile) {
    return response.status(404).json({ message: "Candidate user not found." });
  }

  const scope = await enrichCandidateScope(scopedPayload);
  if (!request.authUser || !canViewCandidate(request.authUser, { ...targetUser.candidateProfile, userId }) || !canViewCandidate(request.authUser, scope)) {
    return response.status(403).json({ message: "You cannot update a candidate outside your admin territory." });
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      name: scopedPayload.name.trim(),
      candidateProfile: {
        update: {
          officeType: scopedPayload.officeType,
          politicalPartyId: scopedPayload.politicalPartyId || null,
          ...scope,
        },
      },
    },
  });

  await createAuditLog(prisma, {
    actorUserId: request.authUser!.id,
    action: "CANDIDATE_UPDATED",
    targetType: "User",
    targetId: updatedUser.id,
  });

  return response.json({ message: "Candidate updated successfully.", user: await getAuthUserProfile(updatedUser.id) });
});

router.patch("/agents/:userId", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const userId = readRouteId(response, request.params.userId, "user id");
  if (!userId) {
    return;
  }

  const parsed = agentUpdateSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid agent update payload.", errors: parsed.error.flatten() });
  }

  const scopedPayload = applyActorAdminScope(request.authUser, parsed.data);

  const territoryReferenceError = await validateTerritoryReferences(scopedPayload);
  if (territoryReferenceError) {
    return response.status(400).json({ message: territoryReferenceError });
  }

  const state = await prisma.state.findUnique({
    where: { id: scopedPayload.stateId },
    select: { geoPoliticalZoneId: true },
  });

  const agentTerritory = {
    geoPoliticalZoneId: state?.geoPoliticalZoneId || undefined,
    stateId: scopedPayload.stateId,
    senatorialDistrictId: scopedPayload.senatorialDistrictId || undefined,
    federalConstituencyId: scopedPayload.federalConstituencyId || undefined,
    lgaId: scopedPayload.lgaId,
    wardId: scopedPayload.wardId,
    stateConstituencyId: scopedPayload.stateConstituencyId || undefined,
    pollingUnitId: scopedPayload.pollingUnitId || undefined,
  };

  if (!request.authUser || !canCreateAgentInScope(request.authUser, agentTerritory)) {
    return response.status(403).json({ message: "You cannot update an agent in this territory." });
  }

  if (scopedPayload.assignedAdminUserId) {
    const assignedAdmin = await prisma.user.findUnique({
      where: { id: scopedPayload.assignedAdminUserId },
      include: { adminProfile: true },
    });

    if (!assignedAdmin?.adminProfile) {
      return response.status(400).json({ message: "Assigned admin does not exist." });
    }

    const assignedAdminAuth = await getAuthUserProfile(assignedAdmin.id);
    if (!assignedAdminAuth || !canCreateAgentInScope(assignedAdminAuth, agentTerritory)) {
      return response.status(400).json({ message: "Assigned admin cannot manage this agent territory." });
    }
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { agentProfile: true },
  });

  if (!targetUser?.agentProfile) {
    return response.status(404).json({ message: "Agent user not found." });
  }

  const targetAuth = await getAuthUserProfile(targetUser.id);
  if (!request.authUser || !targetAuth || !canManageUser(request.authUser, targetAuth) || !canCreateAgentInScope(request.authUser, agentTerritory)) {
    return response.status(403).json({ message: "You cannot update an agent in this territory." });
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      name: scopedPayload.name.trim(),
      phone: scopedPayload.phone?.trim() || null,
      agentProfile: {
        update: {
          geoPoliticalZoneId: state?.geoPoliticalZoneId || null,
          stateId: scopedPayload.stateId,
          senatorialDistrictId: scopedPayload.senatorialDistrictId || null,
          federalConstituencyId: scopedPayload.federalConstituencyId || null,
          lgaId: scopedPayload.lgaId,
          wardId: scopedPayload.wardId,
          stateConstituencyId: scopedPayload.stateConstituencyId || null,
          pollingUnitId: scopedPayload.pollingUnitId || null,
          assignedAdminUserId: scopedPayload.assignedAdminUserId || null,
        },
      },
    },
  });

  await createAuditLog(prisma, {
    actorUserId: request.authUser!.id,
    action: "AGENT_UPDATED",
    targetType: "User",
    targetId: updatedUser.id,
  });

  return response.json({ message: "Agent updated successfully.", user: await getAuthUserProfile(updatedUser.id) });
});

router.patch("/users/:userId/deactivation", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const userId = readRouteId(response, request.params.userId, "user id");
  if (!userId) {
    return;
  }

  const parsed = userDeactivationSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid user deactivation payload.", errors: parsed.error.flatten() });
  }

  if (request.authUser?.id === userId) {
    return response.status(400).json({ message: "You cannot change your own activation status." });
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      adminProfile: true,
      candidateProfile: true,
      agentProfile: true,
      voterProfile: true,
    },
  });

  if (!targetUser) {
    return response.status(404).json({ message: "User not found." });
  }

  const targetAuth = await getAuthUserProfile(targetUser.id);
  if (!request.authUser || !targetAuth || !canManageUser(request.authUser, targetAuth)) {
    return response.status(403).json({ message: "You cannot change this user's activation status." });
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { isActive: parsed.data.isActive },
  });

  await createAuditLog(prisma, {
    actorUserId: request.authUser.id,
    action: parsed.data.isActive ? "USER_REACTIVATED" : "USER_DEACTIVATED",
    targetType: "User",
    targetId: updatedUser.id,
  });

  return response.json({
    message: parsed.data.isActive ? "User reactivated successfully." : "User deactivated successfully.",
    user: await getAuthUserProfile(updatedUser.id),
  });
});

router.get("/agent-activity-summaries", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const scopeFilter = getAgentScopeFilter(request.authUser);
  const agents = await prisma.user.findMany({
    where: { role: UserRole.AGENT },
    include: {
      agentProfile: true,
      agentActivities: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const summaries = agents
    .filter((agent) => {
      if (!agent.agentProfile || !request.authUser) {
        return false;
      }

      return canCreateAgentInScope(request.authUser, agent.agentProfile);
    })
    .map((agent) => {
      const latest = agent.agentActivities[0];

      return serializeAgentActivitySummary({
        agentUserId: agent.id,
        name: agent.name,
        email: agent.email,
        territory: serializeTerritory(agent.agentProfile!),
        latestActivityType: latest?.type || null,
        latestActivityAt: latest?.createdAt.toISOString() || null,
        latestLatitude: latest?.latitude ?? null,
        latestLongitude: latest?.longitude ?? null,
        pollingUnitId: latest?.pollingUnitId || agent.agentProfile?.pollingUnitId || null,
      });
    });

  return response.json({ agentActivitySummaries: summaries, scope: scopeFilter });
});

router.get("/agent-activities", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const parsed = agentActivityQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid activity query.", errors: parsed.error.flatten() });
  }

  const page = parsed.data.page || 1;
  const pageSize = parsed.data.pageSize || 20;
  const createdAtFilter =
    parsed.data.dateFrom || parsed.data.dateTo
      ? {
          gte: parsed.data.dateFrom ? new Date(parsed.data.dateFrom) : undefined,
          lte: parsed.data.dateTo ? new Date(parsed.data.dateTo) : undefined,
        }
      : undefined;

  const scopeFilter = getAgentActivityScopeFilter(request.authUser);
  const activities = await prisma.agentActivity.findMany({
    where: {
      ...scopeFilter,
      agentUserId: parsed.data.agentUserId,
      type: parsed.data.type,
      createdAt: createdAtFilter,
    },
    include: {
      agentUser: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return response.json({
    page,
    pageSize,
    activities,
  });
});

router.post("/participation", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const parsed = participationSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid participation payload.", errors: parsed.error.flatten() });
  }

  const voter = await prisma.user.findUnique({
    where: { id: parsed.data.voterUserId },
    include: { voterProfile: true },
  });

  if (!voter?.voterProfile) {
    return response.status(404).json({ message: "Voter was not found." });
  }

  if (request.authUser && !isSuperAdmin(request.authUser) && !canCreateAgentInScope(request.authUser, voter.voterProfile)) {
    return response.status(403).json({ message: "You cannot record participation for this voter." });
  }

  const result = await prisma.$transaction((transaction) =>
    recordParticipationAndReward(transaction, parsed.data),
  );

  if (!result.created) {
    return response.status(409).json({ message: "This participation action was already recorded." });
  }

  return response.status(201).json({
    message: "Participation recorded successfully.",
    eventId: result.eventId,
  });
});

router.post("/polls", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const parsed = pollCreationSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid poll payload.", errors: parsed.error.flatten() });
  }

  const territoryReferenceError = await validateTerritoryReferences(parsed.data);
  if (territoryReferenceError) {
    return response.status(400).json({ message: territoryReferenceError });
  }

  if (request.authUser && isAdminUser(request.authUser) && !canCreateAgentInScope(request.authUser, parsed.data)) {
    return response.status(403).json({ message: "You cannot create a poll outside your territory." });
  }

  if (parsed.data.candidateUserId) {
    const candidate = await prisma.user.findUnique({
      where: { id: parsed.data.candidateUserId },
      include: { candidateProfile: true },
    });

    if (!candidate?.candidateProfile) {
      return response.status(400).json({ message: "Candidate user does not exist." });
    }
  }

  const poll = await prisma.poll.create({
    data: {
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() || null,
      candidateUserId: parsed.data.candidateUserId || null,
      officeType: parsed.data.officeType || null,
      stateId: parsed.data.stateId || null,
      senatorialDistrictId: parsed.data.senatorialDistrictId || null,
      federalConstituencyId: parsed.data.federalConstituencyId || null,
      lgaId: parsed.data.lgaId || null,
      wardId: parsed.data.wardId || null,
      stateConstituencyId: parsed.data.stateConstituencyId || null,
      pollingUnitId: parsed.data.pollingUnitId || null,
      createdByUserId: request.authUser!.id,
      options: {
        create: parsed.data.options.map((label) => ({ label })),
      },
    },
    include: { options: true },
  });

  return response.status(201).json({
    message: "Poll created successfully.",
    poll,
  });
});

router.get("/polls/:pollId/results", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const pollId = readRouteId(response, request.params.pollId, "poll id");
  if (!pollId) {
    return;
  }

  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: {
      options: {
        include: {
          _count: {
            select: { responses: true },
          },
        },
      },
    },
  });

  if (!poll) {
    return response.status(404).json({ message: "Poll was not found." });
  }

  if (request.authUser && isAdminUser(request.authUser) && !canCreateAgentInScope(request.authUser, poll)) {
    return response.status(403).json({ message: "You cannot view this poll result." });
  }

  return response.json({
    poll: {
      id: poll.id,
      title: poll.title,
      totalResponses: poll.options.reduce((sum, option) => sum + option._count.responses, 0),
      options: poll.options.map((option) => ({
        id: option.id,
        label: option.label,
        responses: option._count.responses,
      })),
    },
  });
});

router.get("/feedback", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const actorScope = getFeedbackScopeFilter(request.authUser);
  const feedback = await prisma.feedback.findMany({
    where: actorScope,
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return response.json({
    feedback: feedback.map(serializeFeedbackItem),
  });
});

router.get("/incidents", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const parsed = incidentQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid incident query.", errors: parsed.error.flatten() });
  }

  const page = parsed.data.page || 1;
  const pageSize = parsed.data.pageSize || 20;
  const incidents = await prisma.incident.findMany({
    where: {
      ...getFeedbackScopeFilter(request.authUser),
      status: parsed.data.status,
      createdAt: getDateRange(parsed.data),
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return response.json({
    page,
    pageSize,
    incidents: incidents.map(serializeIncidentItem),
  });
});

router.patch("/incidents/:incidentId/status", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const parsed = incidentStatusUpdateSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid incident status payload.", errors: parsed.error.flatten() });
  }

  const incidentId = readRouteId(response, request.params.incidentId, "incident id");
  if (!incidentId) {
    return;
  }

  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  if (!incident) {
    return response.status(404).json({ message: "Incident was not found." });
  }

  if (request.authUser && !isWithinAdminScope(request.authUser, incident)) {
    return response.status(403).json({ message: "You cannot update this incident." });
  }

  const updatedIncident = await prisma.incident.update({
    where: { id: incident.id },
    data: { status: parsed.data.status },
  });

  await prisma.$transaction(async (transaction) => {
    if (updatedIncident.assignedAdminUserId) {
      await createNotification(transaction, {
        userId: updatedIncident.assignedAdminUserId,
        type: NotificationType.INCIDENT_UPDATED,
        title: "Incident status updated",
        message: `${updatedIncident.title} is now ${updatedIncident.status}.`,
      });
    }

    await createAuditLog(transaction, {
      actorUserId: request.authUser!.id,
      action: "INCIDENT_STATUS_UPDATED",
      targetType: "Incident",
      targetId: updatedIncident.id,
      metadata: { status: updatedIncident.status },
    });
  });

  return response.json({
    message: "Incident status updated successfully.",
    incident: serializeIncidentItem(updatedIncident),
  });
});

router.patch("/incidents/:incidentId/assign", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const parsed = incidentAssignSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid incident assignment payload.", errors: parsed.error.flatten() });
  }

  const incidentId = readRouteId(response, request.params.incidentId, "incident id");
  if (!incidentId) {
    return;
  }

  const [incident, assignedAdmin] = await Promise.all([
    prisma.incident.findUnique({ where: { id: incidentId } }),
    prisma.user.findUnique({
      where: { id: parsed.data.assignedAdminUserId },
      include: { adminProfile: true },
    }),
  ]);

  if (!incident) {
    return response.status(404).json({ message: "Incident was not found." });
  }

  if (request.authUser && !isWithinAdminScope(request.authUser, incident)) {
    return response.status(403).json({ message: "You cannot assign this incident." });
  }

  if (!assignedAdmin?.adminProfile) {
    return response.status(400).json({ message: "Assigned admin was not found." });
  }

  const assignedAdminAuth = await getAuthUserProfile(assignedAdmin.id);
  if (!assignedAdminAuth || !isWithinAdminScope(assignedAdminAuth, incident)) {
    return response.status(400).json({ message: "Assigned admin is outside the incident scope." });
  }

  const updatedIncident = await prisma.incident.update({
    where: { id: incident.id },
    data: { assignedAdminUserId: assignedAdmin.id },
  });

  await prisma.$transaction(async (transaction) => {
    await createNotification(transaction, {
      userId: assignedAdmin.id,
      type: NotificationType.INCIDENT_ASSIGNED,
      title: "Incident assigned to you",
      message: `${updatedIncident.title} has been assigned for follow-up.`,
    });

    await createAuditLog(transaction, {
      actorUserId: request.authUser!.id,
      action: "INCIDENT_ASSIGNED",
      targetType: "Incident",
      targetId: updatedIncident.id,
      metadata: { assignedAdminUserId: assignedAdmin.id },
    });
  });

  return response.json({
    message: "Incident assigned successfully.",
    incident: serializeIncidentItem(updatedIncident),
  });
});

router.patch("/incidents/:incidentId/escalate", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const parsed = escalationSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid escalation payload.", errors: parsed.error.flatten() });
  }

  const incidentId = readRouteId(response, request.params.incidentId, "incident id");
  if (!incidentId) {
    return;
  }

  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  if (!incident) {
    return response.status(404).json({ message: "Incident was not found." });
  }

  if (request.authUser && !isWithinAdminScope(request.authUser, incident)) {
    return response.status(403).json({ message: "You cannot escalate this incident." });
  }

  const updatedIncident = await prisma.incident.update({
    where: { id: incident.id },
    data: {
      escalatedAt: new Date(),
      escalatedByUserId: request.authUser!.id,
      escalationNote: parsed.data.escalationNote,
    },
  });

  await prisma.$transaction(async (transaction) => {
    if (updatedIncident.assignedAdminUserId) {
      await createNotification(transaction, {
        userId: updatedIncident.assignedAdminUserId,
        type: NotificationType.INCIDENT_UPDATED,
        title: "Incident escalated",
        message: `${updatedIncident.title} has been escalated.`,
      });
    }

    await createAuditLog(transaction, {
      actorUserId: request.authUser!.id,
      action: "INCIDENT_ESCALATED",
      targetType: "Incident",
      targetId: updatedIncident.id,
      metadata: { escalationNote: parsed.data.escalationNote },
    });
  });

  return response.json({
    message: "Incident escalated successfully.",
    incident: serializeIncidentItem(updatedIncident),
  });
});

router.get("/tasks", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const tasks = await prisma.fieldTask.findMany({
    where: getFieldTaskScopeFilter(request.authUser),
    include: {
      createdByUser: { select: { name: true } },
      assignedToUser: { select: { name: true } },
    },
    orderBy: [
      { status: "asc" },
      { priority: "desc" },
      { createdAt: "desc" },
    ],
    take: 100,
  });

  return response.json({
    tasks: tasks.map(serializeFieldTaskItem),
  });
});

router.post("/tasks", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const parsed = fieldTaskCreationSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid task payload.", errors: parsed.error.flatten() });
  }

  const assignedAgent = await prisma.user.findUnique({
    where: { id: parsed.data.assignedToUserId },
    include: { agentProfile: true },
  });

  if (!assignedAgent?.agentProfile) {
    return response.status(400).json({ message: "Assigned user must be an agent." });
  }

  if (request.authUser && !canCreateAgentInScope(request.authUser, assignedAgent.agentProfile)) {
    return response.status(403).json({ message: "You cannot assign tasks outside your agent scope." });
  }

  let linkedIncident: Awaited<ReturnType<typeof prisma.incident.findUnique>> | null = null;
  if (parsed.data.incidentId) {
    linkedIncident = await prisma.incident.findUnique({ where: { id: parsed.data.incidentId } });
    if (!linkedIncident) {
      return response.status(404).json({ message: "Linked incident was not found." });
    }

    if (request.authUser && !isWithinAdminScope(request.authUser, linkedIncident)) {
      return response.status(403).json({ message: "You cannot create tasks for this incident." });
    }
  }

  const territory = linkedIncident
    ? {
        geoPoliticalZoneId: linkedIncident.geoPoliticalZoneId ?? assignedAgent.agentProfile.geoPoliticalZoneId,
        stateId: linkedIncident.stateId,
        senatorialDistrictId: linkedIncident.senatorialDistrictId ?? assignedAgent.agentProfile.senatorialDistrictId,
        federalConstituencyId: assignedAgent.agentProfile.federalConstituencyId,
        lgaId: linkedIncident.lgaId,
        wardId: linkedIncident.wardId ?? assignedAgent.agentProfile.wardId,
        stateConstituencyId: assignedAgent.agentProfile.stateConstituencyId,
        pollingUnitId: linkedIncident.pollingUnitId ?? assignedAgent.agentProfile.pollingUnitId,
      }
    : {
        geoPoliticalZoneId: assignedAgent.agentProfile.geoPoliticalZoneId,
        stateId: assignedAgent.agentProfile.stateId,
        senatorialDistrictId: assignedAgent.agentProfile.senatorialDistrictId,
        federalConstituencyId: assignedAgent.agentProfile.federalConstituencyId,
        lgaId: assignedAgent.agentProfile.lgaId,
        wardId: assignedAgent.agentProfile.wardId,
        stateConstituencyId: assignedAgent.agentProfile.stateConstituencyId,
        pollingUnitId: assignedAgent.agentProfile.pollingUnitId,
      };

  const taskId = await prisma.$transaction(async (transaction) => {
    const createdTask = await transaction.fieldTask.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        assignedToUserId: assignedAgent.id,
        createdByUserId: request.authUser!.id,
        incidentId: parsed.data.incidentId || null,
        priority: parsed.data.priority,
        dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
        geoPoliticalZoneId: territory.geoPoliticalZoneId || undefined,
        stateId: territory.stateId,
        senatorialDistrictId: territory.senatorialDistrictId || undefined,
        federalConstituencyId: territory.federalConstituencyId || undefined,
        lgaId: territory.lgaId,
        wardId: territory.wardId,
        stateConstituencyId: territory.stateConstituencyId || undefined,
        pollingUnitId: territory.pollingUnitId || undefined,
      },
    });

    await createNotification(transaction, {
      userId: assignedAgent.id,
      type: NotificationType.SYSTEM,
      title: "New field task assigned",
      message: `${createdTask.title} has been assigned to you.`,
    });

    await createAuditLog(transaction, {
      actorUserId: request.authUser!.id,
      action: "FIELD_TASK_CREATED",
      targetType: "FieldTask",
      targetId: createdTask.id,
      metadata: {
        assignedToUserId: assignedAgent.id,
        incidentId: parsed.data.incidentId || null,
        priority: parsed.data.priority,
      },
    });

    return createdTask.id;
  });

  const task = await prisma.fieldTask.findUnique({
    where: { id: taskId },
    include: {
      createdByUser: { select: { name: true } },
      assignedToUser: { select: { name: true } },
    },
  });

  if (!task) {
    return response.status(500).json({ message: "Field task was created but could not be loaded." });
  }

  return response.status(201).json({
    message: "Field task created successfully.",
    task: serializeFieldTaskItem(task),
  });
});

router.patch("/tasks/:taskId", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const parsed = fieldTaskUpdateSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid task update payload.", errors: parsed.error.flatten() });
  }

  const taskId = readRouteId(response, request.params.taskId, "task id");
  if (!taskId) {
    return;
  }

  const task = await prisma.fieldTask.findUnique({
    where: { id: taskId },
    include: {
      createdByUser: { select: { name: true } },
      assignedToUser: { select: { name: true } },
    },
  });

  if (!task) {
    return response.status(404).json({ message: "Task was not found." });
  }

  if (request.authUser && !isWithinAdminScope(request.authUser, task)) {
    return response.status(403).json({ message: "You cannot update this task." });
  }

  const updatedTask = await prisma.$transaction(async (transaction) => {
    const nextTask = await transaction.fieldTask.update({
      where: { id: task.id },
      data: {
        status: parsed.data.status,
        priority: parsed.data.priority,
        dueAt: parsed.data.dueAt === undefined ? undefined : parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
        resolutionNote: parsed.data.resolutionNote === undefined ? undefined : parsed.data.resolutionNote,
        completedAt:
          parsed.data.status === undefined
            ? undefined
            : parsed.data.status === FieldTaskStatus.DONE
              ? new Date()
              : null,
      },
      include: {
        createdByUser: { select: { name: true } },
        assignedToUser: { select: { name: true } },
      },
    });

    await createNotification(transaction, {
      userId: nextTask.assignedToUserId,
      type: NotificationType.SYSTEM,
      title: "Field task updated",
      message: `${nextTask.title} is now ${nextTask.status}.`,
    });

    await createAuditLog(transaction, {
      actorUserId: request.authUser!.id,
      action: "FIELD_TASK_UPDATED",
      targetType: "FieldTask",
      targetId: nextTask.id,
      metadata: {
        status: nextTask.status,
        priority: nextTask.priority,
      },
    });

    return nextTask;
  });

  return response.json({
    message: "Field task updated successfully.",
    task: serializeFieldTaskItem(updatedTask),
  });
});

router.get("/broadcasts", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const broadcasts = await prisma.broadcastMessage.findMany({
    where: getFieldTaskScopeFilter(request.authUser),
    include: {
      createdByUser: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return response.json({
    broadcasts: broadcasts.map(serializeBroadcastMessageItem),
  });
});

router.post("/broadcasts", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const parsed = broadcastCreationSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid broadcast payload.", errors: parsed.error.flatten() });
  }

  const targetScope = buildBroadcastScope(parsed.data);
  const territoryReferenceError = await validateTerritoryReferences(targetScope);
  if (territoryReferenceError) {
    return response.status(400).json({ message: territoryReferenceError });
  }

  if (request.authUser && !isWithinAdminScope(request.authUser, targetScope)) {
    return response.status(403).json({ message: "You cannot broadcast outside your territory scope." });
  }

  if (parsed.data.taskStatus && !["AGENTS", "ALL"].includes(parsed.data.audience)) {
    return response.status(400).json({ message: "Task-status targeting is only available for agent-inclusive broadcasts." });
  }

  const recipients = await prisma.user.findMany({
    where: {
      isActive: true,
      ...buildBroadcastRecipientWhere(parsed.data.audience, targetScope, parsed.data.taskStatus),
    },
    select: { id: true },
    take: 500,
  });

  const recipientIds = recipients.map((recipient) => recipient.id);

  const broadcastId = await prisma.$transaction(async (transaction) => {
    const broadcast = await transaction.broadcastMessage.create({
      data: {
        title: parsed.data.title,
        message: parsed.data.message,
        audience: parsed.data.audience,
        taskStatus: parsed.data.taskStatus || null,
        createdByUserId: request.authUser!.id,
        recipientCount: recipientIds.length,
        geoPoliticalZoneId: targetScope.geoPoliticalZoneId,
        stateId: targetScope.stateId,
        senatorialDistrictId: targetScope.senatorialDistrictId,
        federalConstituencyId: targetScope.federalConstituencyId,
        lgaId: targetScope.lgaId,
        wardId: targetScope.wardId,
        stateConstituencyId: targetScope.stateConstituencyId,
        pollingUnitId: targetScope.pollingUnitId,
      },
    });

    for (const recipientId of recipientIds) {
      await createNotification(transaction, {
        userId: recipientId,
        type: NotificationType.SYSTEM,
        title: parsed.data.title,
        message: parsed.data.message,
      });
    }

    await createAuditLog(transaction, {
      actorUserId: request.authUser!.id,
      action: "BROADCAST_CREATED",
      targetType: "BroadcastMessage",
      targetId: broadcast.id,
      metadata: {
        audience: parsed.data.audience,
        recipientCount: recipientIds.length,
        taskStatus: parsed.data.taskStatus || null,
      },
    });

    return broadcast.id;
  });

  const broadcast = await prisma.broadcastMessage.findUnique({
    where: { id: broadcastId },
    include: {
      createdByUser: { select: { name: true } },
    },
  });

  if (!broadcast) {
    return response.status(500).json({ message: "Broadcast was created but could not be loaded." });
  }

  return response.status(201).json({
    message: "Broadcast sent successfully.",
    broadcast: serializeBroadcastMessageItem(broadcast),
  });
});

router.get("/engagement-tasks", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const tasks = await prisma.voterEngagementTask.findMany({
    where: getFieldTaskScopeFilter(request.authUser),
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return response.json({
    tasks: tasks.map((task) =>
      serializeVoterEngagementTaskItem({
        ...task,
        progressCount: 0,
        completed: false,
        claimed: false,
      }),
    ),
  });
});

router.post("/engagement-tasks", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const parsed = engagementTaskCreationSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid engagement task payload.", errors: parsed.error.flatten() });
  }

  const targetScope = buildEngagementTaskScope(parsed.data);
  const territoryReferenceError = await validateTerritoryReferences(targetScope);
  if (territoryReferenceError) {
    return response.status(400).json({ message: territoryReferenceError });
  }

  if (request.authUser && !isWithinAdminScope(request.authUser, targetScope)) {
    return response.status(403).json({ message: "You cannot create voter engagement tasks outside your territory scope." });
  }

  const task = await prisma.voterEngagementTask.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      type: parsed.data.type,
      rewardPoints: parsed.data.rewardPoints,
      targetCount: parsed.data.targetCount || 1,
      createdByUserId: request.authUser!.id,
      geoPoliticalZoneId: targetScope.geoPoliticalZoneId || null,
      stateId: targetScope.stateId || null,
      senatorialDistrictId: targetScope.senatorialDistrictId || null,
      federalConstituencyId: targetScope.federalConstituencyId || null,
      lgaId: targetScope.lgaId || null,
      wardId: targetScope.wardId || null,
      stateConstituencyId: targetScope.stateConstituencyId || null,
      pollingUnitId: targetScope.pollingUnitId || null,
    },
  });

  await createAuditLog(prisma, {
    actorUserId: request.authUser!.id,
    action: "VOTER_ENGAGEMENT_TASK_CREATED",
    targetType: "VoterEngagementTask",
    targetId: task.id,
    metadata: {
      type: task.type,
      rewardPoints: task.rewardPoints,
      targetCount: task.targetCount,
    },
  });

  return response.status(201).json({
    message: "Voter engagement task created successfully.",
    task: serializeVoterEngagementTaskItem({
      ...task,
      progressCount: 0,
      completed: false,
      claimed: false,
    }),
  });
});

router.get("/map-summary", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const [agents, incidents, pollingUnits] = await Promise.all([
    prisma.user.findMany({
      where: { role: UserRole.AGENT },
      include: {
        agentProfile: true,
        agentActivities: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
    prisma.incident.findMany({
      where: getFeedbackScopeFilter(request.authUser),
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.pollingUnit.findMany({
      where: getPollingUnitScopeFilter(request.authUser),
      orderBy: { name: "asc" },
    }),
  ]);

  const activeAgents = agents
    .filter((agent) => agent.agentProfile && request.authUser && canCreateAgentInScope(request.authUser, agent.agentProfile))
    .map((agent) => {
      const latest = agent.agentActivities[0];
      return serializeAgentActivitySummary({
        agentUserId: agent.id,
        name: agent.name,
        email: agent.email,
        territory: serializeTerritory(agent.agentProfile!),
        latestActivityType: latest?.type || null,
        latestActivityAt: latest?.createdAt.toISOString() || null,
        latestLatitude: latest?.latitude ?? null,
        latestLongitude: latest?.longitude ?? null,
        pollingUnitId: latest?.pollingUnitId || agent.agentProfile?.pollingUnitId || null,
      });
    })
    .filter((item) => item.latestLatitude !== null && item.latestLongitude !== null);

  const counts = {
    byStatus: incidents.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {}),
    bySeverity: incidents.reduce<Record<string, number>>((acc, item) => {
      acc[item.severity] = (acc[item.severity] || 0) + 1;
      return acc;
    }, {}),
    byType: incidents.reduce<Record<string, number>>((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {}),
  };

  return response.json({
    mapSummary: serializeAdminMapSummary({
      activeAgents,
      incidents: incidents.filter((item) => item.latitude !== null && item.longitude !== null).map(serializeIncidentItem),
      pollingUnits: pollingUnits.map((unit) => ({
        id: unit.id,
        name: unit.name,
        stateId: unit.stateId,
        lgaId: unit.lgaId,
        wardId: unit.wardId,
      })),
      counts,
    }),
  });
});

router.get("/redemptions", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const voterProfiles = await prisma.voterProfile.findMany({
    where: getVoterScopeFilter(request.authUser),
    select: { userId: true },
  });

  const redemptions = await prisma.rewardRedemption.findMany({
    where: {
      voterUserId: {
        in: voterProfiles.map((item) => item.userId),
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return response.json({
    redemptions: redemptions.map(serializeRewardRedemption),
  });
});

router.patch("/redemptions/:redemptionId/approve", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const parsed = redemptionReviewSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid redemption review payload.", errors: parsed.error.flatten() });
  }

  const redemptionId = readRouteId(response, request.params.redemptionId, "redemption id");
  if (!redemptionId) {
    return;
  }

  const redemption = await prisma.rewardRedemption.findUnique({ where: { id: redemptionId } });
  if (!redemption) {
    return response.status(404).json({ message: "Redemption was not found." });
  }

  const voterProfile = await prisma.voterProfile.findUnique({ where: { userId: redemption.voterUserId } });
  if (!voterProfile || (request.authUser && !isWithinAdminScope(request.authUser, voterProfile))) {
    return response.status(403).json({ message: "You cannot review this redemption." });
  }

  if (redemption.status !== RewardRedemptionStatus.PENDING) {
    return response.status(400).json({ message: "Only pending redemptions can be approved." });
  }

  const updated = await prisma.$transaction(async (transaction) => {
    const balance = await getRewardBalance(transaction, redemption.voterUserId);
    if (redemption.pointsRequested > balance.availablePoints + redemption.pointsRequested) {
      throw new Error("Redemption balance validation failed.");
    }

    const next = await transaction.rewardRedemption.update({
      where: { id: redemption.id },
      data: {
        status: RewardRedemptionStatus.APPROVED,
        note: parsed.data.note || redemption.note,
        reviewedByUserId: request.authUser!.id,
        reviewedAt: new Date(),
      },
    });

    await createNotification(transaction, {
      userId: redemption.voterUserId,
      type: NotificationType.REWARD_REDEMPTION,
      title: "Redemption approved",
      message: `${redemption.pointsRequested} points redemption has been approved.`,
    });

    await createAuditLog(transaction, {
      actorUserId: request.authUser!.id,
      action: "REWARD_REDEMPTION_APPROVED",
      targetType: "RewardRedemption",
      targetId: redemption.id,
      metadata: { note: parsed.data.note || null },
    });

    return next;
  }).catch((error: unknown) => {
    throw error;
  });

  return response.json({
    message: "Redemption approved successfully.",
    redemption: serializeRewardRedemption(updated),
  });
});

router.patch("/redemptions/:redemptionId/reject", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const parsed = redemptionReviewSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid redemption review payload.", errors: parsed.error.flatten() });
  }

  const redemptionId = readRouteId(response, request.params.redemptionId, "redemption id");
  if (!redemptionId) {
    return;
  }

  const redemption = await prisma.rewardRedemption.findUnique({ where: { id: redemptionId } });
  if (!redemption) {
    return response.status(404).json({ message: "Redemption was not found." });
  }

  const voterProfile = await prisma.voterProfile.findUnique({ where: { userId: redemption.voterUserId } });
  if (!voterProfile || (request.authUser && !isWithinAdminScope(request.authUser, voterProfile))) {
    return response.status(403).json({ message: "You cannot review this redemption." });
  }

  if (redemption.status !== RewardRedemptionStatus.PENDING) {
    return response.status(400).json({ message: "Only pending redemptions can be rejected." });
  }

  const updated = await prisma.$transaction(async (transaction) => {
    const next = await transaction.rewardRedemption.update({
      where: { id: redemption.id },
      data: {
        status: RewardRedemptionStatus.REJECTED,
        note: parsed.data.note || redemption.note,
        reviewedByUserId: request.authUser!.id,
        reviewedAt: new Date(),
      },
    });

    await createNotification(transaction, {
      userId: redemption.voterUserId,
      type: NotificationType.REWARD_REDEMPTION,
      title: "Redemption rejected",
      message: `${redemption.pointsRequested} points redemption was rejected.`,
    });

    await createAuditLog(transaction, {
      actorUserId: request.authUser!.id,
      action: "REWARD_REDEMPTION_REJECTED",
      targetType: "RewardRedemption",
      targetId: redemption.id,
      metadata: { note: parsed.data.note || null },
    });

    return next;
  });

  return response.json({
    message: "Redemption rejected successfully.",
    redemption: serializeRewardRedemption(updated),
  });
});

router.patch("/redemptions/:redemptionId/paid", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const redemptionId = readRouteId(response, request.params.redemptionId, "redemption id");
  if (!redemptionId) {
    return;
  }

  const redemption = await prisma.rewardRedemption.findUnique({ where: { id: redemptionId } });
  if (!redemption) {
    return response.status(404).json({ message: "Redemption was not found." });
  }

  const voterProfile = await prisma.voterProfile.findUnique({ where: { userId: redemption.voterUserId } });
  if (!voterProfile || (request.authUser && !isWithinAdminScope(request.authUser, voterProfile))) {
    return response.status(403).json({ message: "You cannot update this redemption." });
  }

  if (redemption.status !== RewardRedemptionStatus.APPROVED) {
    return response.status(400).json({ message: "Only approved redemptions can be marked as paid." });
  }

  const updated = await prisma.$transaction(async (transaction) => {
    const next = await transaction.rewardRedemption.update({
      where: { id: redemption.id },
      data: {
        status: RewardRedemptionStatus.PAID,
        reviewedByUserId: request.authUser!.id,
        reviewedAt: new Date(),
      },
    });

    await createNotification(transaction, {
      userId: redemption.voterUserId,
      type: NotificationType.REWARD_REDEMPTION,
      title: "Redemption paid",
      message: `${redemption.pointsRequested} points redemption has been marked as paid.`,
    });

    await createAuditLog(transaction, {
      actorUserId: request.authUser!.id,
      action: "REWARD_REDEMPTION_PAID",
      targetType: "RewardRedemption",
      targetId: redemption.id,
    });

    return next;
  });

  return response.json({
    message: "Redemption marked as paid successfully.",
    redemption: serializeRewardRedemption(updated),
  });
});

router.get("/polling-unit-coverage", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const recentActivitySince = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const pollingUnitScope = getPollingUnitScopeFilter(request.authUser);
  const [pollingUnits, agents, recentActivities, incidents] = await Promise.all([
    prisma.pollingUnit.findMany({
      where: pollingUnitScope,
      select: { id: true },
    }),
    prisma.agentProfile.findMany({
      where: {
        ...toScopeFilter(getAgentScopeFilter(request.authUser)),
        pollingUnitId: { not: null },
      },
      select: { pollingUnitId: true },
    }),
    prisma.agentActivity.findMany({
      where: {
        ...toScopeFilter(getAgentActivityScopeFilter(request.authUser)),
        pollingUnitId: { not: null },
        createdAt: { gte: recentActivitySince },
      },
      select: { pollingUnitId: true },
    }),
    prisma.incident.findMany({
      where: {
        ...getFeedbackScopeFilter(request.authUser),
        pollingUnitId: { not: null },
      },
      select: { pollingUnitId: true },
    }),
  ]);

  const totalPollingUnitsInScope = pollingUnits.length;
  const assignedSet = new Set(agents.map((item) => item.pollingUnitId).filter(Boolean));
  const recentSet = new Set(recentActivities.map((item) => item.pollingUnitId).filter(Boolean));
  const incidentSet = new Set(incidents.map((item) => item.pollingUnitId).filter(Boolean));

  return response.json({
    coverage: serializePollingUnitCoverageSummary({
      totalPollingUnitsInScope,
      pollingUnitsWithAssignedAgents: assignedSet.size,
      pollingUnitsWithRecentActivity: recentSet.size,
      pollingUnitsWithIncidents: incidentSet.size,
      pollingUnitsWithoutActivity: Math.max(totalPollingUnitsInScope - recentSet.size, 0),
    }),
  });
});

router.get("/recent-changes", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const parsed = recentChangesQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid recent changes query.", errors: parsed.error.flatten() });
  }

  const since = new Date(parsed.data.since);
  const [newIncidents, newAgentActivities, updatedIncidentStatuses] = await Promise.all([
    prisma.incident.findMany({
      where: {
        ...getFeedbackScopeFilter(request.authUser),
        createdAt: { gt: since },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.agentActivity.findMany({
      where: {
        ...toScopeFilter(getAgentActivityScopeFilter(request.authUser)),
        createdAt: { gt: since },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.incident.findMany({
      where: {
        ...getFeedbackScopeFilter(request.authUser),
        updatedAt: { gt: since },
        NOT: { createdAt: { gt: since } },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
  ]);

  return response.json({
    newIncidents: newIncidents.map(serializeIncidentItem),
    newAgentActivities,
    updatedIncidentStatuses: updatedIncidentStatuses.map(serializeIncidentItem),
  });
});

router.get("/analytics", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const parsed = analyticsQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid analytics query.", errors: parsed.error.flatten() });
  }

  const dateRange = getDateRange(parsed.data);
  const [incidents, agentActivities, rewards, polls, voterRegistrations] = await Promise.all([
    prisma.incident.findMany({
      where: {
        ...getFeedbackScopeFilter(request.authUser),
        createdAt: dateRange,
      },
      select: { type: true, severity: true, status: true },
    }),
    prisma.agentActivity.findMany({
      where: {
        ...toScopeFilter(getAgentActivityScopeFilter(request.authUser)),
        createdAt: dateRange,
      },
      select: { type: true },
    }),
    prisma.rewardLedger.findMany({
      where: {
        voterUser: {
          is: {
            voterProfile: {
              is: getVoterScopeFilter(request.authUser),
            },
          },
        },
        createdAt: dateRange,
      },
      select: { type: true, points: true },
    }),
    prisma.poll.findMany({
      where: {
        ...getPollScopeFilter(request.authUser),
        createdAt: dateRange,
      },
      include: {
        _count: {
          select: { responses: true },
        },
      },
    }),
    prisma.user.findMany({
      where: {
        role: UserRole.VOTER,
        voterProfile: {
          is: getVoterScopeFilter(request.authUser),
        },
        createdAt: dateRange,
      },
      select: { createdAt: true },
    }),
  ]);

  return response.json({
    analytics: {
      incidentCountsByType: incidents.reduce<Record<string, number>>((acc, item) => {
        acc[item.type] = (acc[item.type] || 0) + 1;
        return acc;
      }, {}),
      incidentCountsBySeverity: incidents.reduce<Record<string, number>>((acc, item) => {
        acc[item.severity] = (acc[item.severity] || 0) + 1;
        return acc;
      }, {}),
      incidentCountsByStatus: incidents.reduce<Record<string, number>>((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      }, {}),
      agentActivitiesByType: agentActivities.reduce<Record<string, number>>((acc, item) => {
        acc[item.type] = (acc[item.type] || 0) + 1;
        return acc;
      }, {}),
      rewardTotalsByType: rewards.reduce<Record<string, number>>((acc, item) => {
        acc[item.type] = (acc[item.type] || 0) + item.points;
        return acc;
      }, {}),
      pollResponseTotalsByPoll: polls.map((poll) => ({
        pollId: poll.id,
        title: poll.title,
        responses: poll._count.responses,
      })),
      voterRegistrationsOverTime: voterRegistrations.reduce<Record<string, number>>((acc, item) => {
        const day = item.createdAt.toISOString().slice(0, 10);
        acc[day] = (acc[day] || 0) + 1;
        return acc;
      }, {}),
    },
  });
});

router.get("/audit-logs", requireAuth, requireRole("SUPER_ADMIN"), async (request, response) => {
  const parsed = auditLogQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid audit log query.", errors: parsed.error.flatten() });
  }

  const logs = await prisma.auditLog.findMany({
    where: {
      actorUserId: parsed.data.actorUserId,
      action: parsed.data.action,
      createdAt: getDateRange(parsed.data),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return response.json({
    auditLogs: logs.map(serializeAuditLogItem),
  });
});

router.get("/summary", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), async (request, response) => {
  const actor = request.authUser;
  const voterScopeFilter = getVoterScopeFilter(actor);
  const agentScopeFilter = getAgentScopeFilter(actor);
  const feedbackScopeFilter = getFeedbackScopeFilter(actor);
  const pollScopeFilter = getPollScopeFilter(actor);
  const todayStart = getTodayStart();

  const [
    totalVotersInScope,
    totalAgentsInScope,
    totalFeedbackItemsInScope,
    totalActivePollsInScope,
    totalAgentCheckInsToday,
    activeAgentRows,
    totalIncidentsOpen,
    totalIncidentsCritical,
    totalPollResponsesInScope,
    totalVoterFeedbackItemsInScope,
    candidates,
  ] =
    await Promise.all([
      prisma.voterProfile.count({ where: voterScopeFilter }),
      prisma.agentProfile.count({ where: agentScopeFilter }),
      prisma.feedback.count({ where: feedbackScopeFilter }),
      prisma.poll.count({ where: { ...pollScopeFilter, isActive: true } }),
      prisma.agentActivity.count({
        where: {
          ...toScopeFilter(getAgentActivityScopeFilter(actor)),
          type: AgentActivityType.CHECK_IN,
          createdAt: { gte: todayStart },
        },
      }),
      prisma.agentActivity.findMany({
        where: {
          ...toScopeFilter(getAgentActivityScopeFilter(actor)),
          createdAt: { gte: todayStart },
        },
        select: { agentUserId: true },
        distinct: ["agentUserId"],
      }),
      prisma.incident.count({
        where: {
          ...getFeedbackScopeFilter(actor),
          status: IncidentStatus.OPEN,
        },
      }),
      prisma.incident.count({
        where: {
          ...getFeedbackScopeFilter(actor),
          severity: IncidentSeverity.CRITICAL,
        },
      }),
      prisma.pollResponse.count({
        where: {
          poll: {
            is: pollScopeFilter,
          },
        },
      }),
      prisma.feedback.count({
        where: {
          ...feedbackScopeFilter,
          voterUserId: { not: null },
        },
      }),
      prisma.user.findMany({
        where: { role: UserRole.CANDIDATE },
        include: {
          candidateProfile: true,
          assignedAdminLinks: actor
            ? {
                where: { adminUserId: actor.id },
                select: { permissionType: true },
              }
            : false,
        },
      }),
    ]);

  const totalCandidatesVisibleInScope = candidates.filter((candidate) => {
    if (!candidate.candidateProfile || !actor) {
      return false;
    }

    return (
      canViewCandidate(actor, { ...candidate.candidateProfile, userId: candidate.id }) ||
      candidate.assignedAdminLinks.length > 0
    );
  }).length;

  return response.json({
    summary: serializeAdminSummary({
      totalVotersInScope,
      totalAgentsInScope,
      totalFeedbackItemsInScope,
      totalActivePollsInScope,
      totalCandidatesVisibleInScope,
      totalAgentCheckInsToday,
      totalActiveAgentsToday: activeAgentRows.length,
      totalIncidentsOpen,
      totalIncidentsCritical,
      totalPollResponsesInScope,
      totalVoterFeedbackItemsInScope,
    }),
  });
});

export default router;
