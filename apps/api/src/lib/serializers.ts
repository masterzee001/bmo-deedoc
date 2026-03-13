import type {
  AdminDashboardSummary,
  AdminMapSummary,
  AgentActivitySummary,
  AuditLogItem,
  BroadcastMessageItem,
  CandidateListItem,
  FieldTaskItem,
  FeedbackListItem,
  IncidentListItem,
  NotificationItem,
  PostListItem,
  PollingUnitCoverageSummary,
  PollListItem,
  RewardBalanceSummary,
  RewardRedemptionItem,
  TerritorySummary,
  VoterEngagementTaskType,
  VoterEngagementTaskItem,
} from "@pics-nigeria/shared";
import { VOTER_ENGAGEMENT_TASK_TYPES } from "@pics-nigeria/shared";

function normalizeEngagementTaskType(value: string): VoterEngagementTaskType {
  if (VOTER_ENGAGEMENT_TASK_TYPES.includes(value as VoterEngagementTaskType)) {
    return value as VoterEngagementTaskType;
  }

  throw new Error(`Unsupported voter engagement task type: ${value}`);
}

export function serializeTerritory(source: {
  geoPoliticalZoneId?: string | null;
  stateId?: string | null;
  senatorialDistrictId?: string | null;
  federalConstituencyId?: string | null;
  lgaId?: string | null;
  wardId?: string | null;
  stateConstituencyId?: string | null;
  pollingUnitId?: string | null;
}): TerritorySummary {
  return {
    geoPoliticalZoneId: source.geoPoliticalZoneId ?? null,
    stateId: source.stateId ?? null,
    senatorialDistrictId: source.senatorialDistrictId ?? null,
    federalConstituencyId: source.federalConstituencyId ?? null,
    lgaId: source.lgaId ?? null,
    wardId: source.wardId ?? null,
    stateConstituencyId: source.stateConstituencyId ?? null,
    pollingUnitId: source.pollingUnitId ?? null,
  };
}

export function serializeCandidateListItem(candidate: {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  candidateProfile: {
    officeType: CandidateListItem["officeType"];
    politicalPartyId?: string | null;
    stateId?: string | null;
    senatorialDistrictId?: string | null;
    federalConstituencyId?: string | null;
    lgaId?: string | null;
    wardId?: string | null;
    stateConstituencyId?: string | null;
    pollingUnitId?: string | null;
  } | null;
  assignedAdminLinks?: Array<{ permissionType: CandidateListItem["assignmentPermissions"][number] }>;
}): CandidateListItem {
  if (!candidate.candidateProfile) {
    throw new Error("Candidate profile is required.");
  }

  return {
    userId: candidate.id,
    name: candidate.name,
    email: candidate.email,
    isActive: candidate.isActive,
    officeType: candidate.candidateProfile.officeType,
    politicalPartyId: candidate.candidateProfile.politicalPartyId ?? null,
    territory: serializeTerritory(candidate.candidateProfile),
    assignmentPermissions: candidate.assignedAdminLinks?.map((item) => item.permissionType) || [],
  };
}

export function serializeFeedbackItem(feedback: {
  id: string;
  type: string;
  message: string;
  createdAt: Date;
  stateId: string;
  senatorialDistrictId: string | null;
  lgaId: string;
  wardId: string | null;
  pollingUnitId: string | null;
  voterUserId: string | null;
  agentUserId: string | null;
  candidateUserId: string | null;
}): FeedbackListItem {
  return {
    id: feedback.id,
    type: feedback.type,
    message: feedback.message,
    createdAt: feedback.createdAt.toISOString(),
    stateId: feedback.stateId,
    senatorialDistrictId: feedback.senatorialDistrictId,
    lgaId: feedback.lgaId,
    wardId: feedback.wardId,
    pollingUnitId: feedback.pollingUnitId,
    voterUserId: feedback.voterUserId,
    agentUserId: feedback.agentUserId,
    candidateUserId: feedback.candidateUserId,
  };
}

export function serializePollListItem(poll: {
  id: string;
  title: string;
  description: string | null;
  isActive: boolean;
  candidateUserId: string | null;
  officeType: PollListItem["officeType"];
  options: Array<{ id: string; label: string }>;
}): PollListItem {
  return {
    id: poll.id,
    title: poll.title,
    description: poll.description,
    isActive: poll.isActive,
    candidateUserId: poll.candidateUserId,
    officeType: poll.officeType,
    options: poll.options.map((option) => ({ id: option.id, label: option.label })),
  };
}

export function serializePostListItem(post: {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  authorUserId: string;
  candidateUserId: string | null;
}): PostListItem {
  return {
    id: post.id,
    title: post.title,
    content: post.content,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    authorUserId: post.authorUserId,
    candidateUserId: post.candidateUserId,
  };
}

export function serializeAdminSummary(summary: AdminDashboardSummary): AdminDashboardSummary {
  return summary;
}

export function serializeAgentActivitySummary(input: AgentActivitySummary): AgentActivitySummary {
  return input;
}

export function serializeIncidentItem(incident: {
  id: string;
  reportedByUserId: string;
  type: IncidentListItem["type"];
  title: string;
  description: string;
  severity: IncidentListItem["severity"];
  status: IncidentListItem["status"];
  latitude: number | null;
  longitude: number | null;
  stateId: string;
  senatorialDistrictId: string | null;
  lgaId: string;
  wardId: string | null;
  pollingUnitId: string | null;
  assignedAdminUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): IncidentListItem {
  return {
    id: incident.id,
    reportedByUserId: incident.reportedByUserId,
    type: incident.type,
    title: incident.title,
    description: incident.description,
    severity: incident.severity,
    status: incident.status,
    latitude: incident.latitude,
    longitude: incident.longitude,
    stateId: incident.stateId,
    senatorialDistrictId: incident.senatorialDistrictId,
    lgaId: incident.lgaId,
    wardId: incident.wardId,
    pollingUnitId: incident.pollingUnitId,
    assignedAdminUserId: incident.assignedAdminUserId,
    createdAt: incident.createdAt.toISOString(),
    updatedAt: incident.updatedAt.toISOString(),
  };
}

export function serializePollingUnitCoverageSummary(
  summary: PollingUnitCoverageSummary,
): PollingUnitCoverageSummary {
  return summary;
}

export function serializeAdminMapSummary(summary: AdminMapSummary): AdminMapSummary {
  return summary;
}

export function serializeRewardRedemption(redemption: {
  id: string;
  voterUserId: string;
  pointsRequested: number;
  amountRequested: number | null;
  status: RewardRedemptionItem["status"];
  note: string | null;
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): RewardRedemptionItem {
  return {
    id: redemption.id,
    voterUserId: redemption.voterUserId,
    pointsRequested: redemption.pointsRequested,
    amountRequested: redemption.amountRequested,
    status: redemption.status,
    note: redemption.note,
    reviewedByUserId: redemption.reviewedByUserId,
    reviewedAt: redemption.reviewedAt ? redemption.reviewedAt.toISOString() : null,
    createdAt: redemption.createdAt.toISOString(),
    updatedAt: redemption.updatedAt.toISOString(),
  };
}

export function serializeRewardBalance(summary: RewardBalanceSummary): RewardBalanceSummary {
  return summary;
}

export function serializeNotificationItem(notification: {
  id: string;
  userId: string;
  type: NotificationItem["type"];
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}): NotificationItem {
  return {
    id: notification.id,
    userId: notification.userId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    isRead: notification.isRead,
    createdAt: notification.createdAt.toISOString(),
  };
}

export function serializeAuditLogItem(log: {
  id: string;
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadataJson: string | null;
  createdAt: Date;
}): AuditLogItem {
  return {
    id: log.id,
    actorUserId: log.actorUserId,
    action: log.action,
    targetType: log.targetType,
    targetId: log.targetId,
    metadataJson: log.metadataJson,
    createdAt: log.createdAt.toISOString(),
  };
}

export function serializeFieldTaskItem(task: {
  id: string;
  title: string;
  description: string;
  status: FieldTaskItem["status"];
  priority: FieldTaskItem["priority"];
  createdByUserId: string;
  assignedToUserId: string;
  incidentId: string | null;
  dueAt: Date | null;
  completedAt: Date | null;
  resolutionNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdByUser: { name: string };
  assignedToUser: { name: string };
  geoPoliticalZoneId?: string | null;
  stateId?: string | null;
  senatorialDistrictId?: string | null;
  federalConstituencyId?: string | null;
  lgaId?: string | null;
  wardId?: string | null;
  stateConstituencyId?: string | null;
  pollingUnitId?: string | null;
}): FieldTaskItem {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    createdByUserId: task.createdByUserId,
    assignedToUserId: task.assignedToUserId,
    incidentId: task.incidentId,
    dueAt: task.dueAt ? task.dueAt.toISOString() : null,
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    resolutionNote: task.resolutionNote,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    territory: serializeTerritory(task),
    assigneeName: task.assignedToUser.name,
    creatorName: task.createdByUser.name,
  };
}

export function serializeBroadcastMessageItem(broadcast: {
  id: string;
  title: string;
  message: string;
  audience: BroadcastMessageItem["audience"];
  taskStatus: BroadcastMessageItem["taskStatus"];
  createdByUserId: string;
  recipientCount: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUser: { name: string };
  geoPoliticalZoneId?: string | null;
  stateId?: string | null;
  senatorialDistrictId?: string | null;
  federalConstituencyId?: string | null;
  lgaId?: string | null;
  wardId?: string | null;
  stateConstituencyId?: string | null;
  pollingUnitId?: string | null;
}): BroadcastMessageItem {
  return {
    id: broadcast.id,
    title: broadcast.title,
    message: broadcast.message,
    audience: broadcast.audience,
    taskStatus: broadcast.taskStatus,
    createdByUserId: broadcast.createdByUserId,
    createdByName: broadcast.createdByUser.name,
    recipientCount: broadcast.recipientCount,
    createdAt: broadcast.createdAt.toISOString(),
    updatedAt: broadcast.updatedAt.toISOString(),
    territory: serializeTerritory(broadcast),
  };
}

export function serializeVoterEngagementTaskItem(task: {
  id: string;
  title: string;
  description: string;
  type: string;
  rewardPoints: number;
  targetCount: number | null;
  isActive: boolean;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  geoPoliticalZoneId?: string | null;
  stateId?: string | null;
  senatorialDistrictId?: string | null;
  federalConstituencyId?: string | null;
  lgaId?: string | null;
  wardId?: string | null;
  stateConstituencyId?: string | null;
  pollingUnitId?: string | null;
  progressCount: number;
  completed: boolean;
  claimed: boolean;
}): VoterEngagementTaskItem {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    type: normalizeEngagementTaskType(task.type),
    rewardPoints: task.rewardPoints,
    targetCount: task.targetCount,
    isActive: task.isActive,
    createdByUserId: task.createdByUserId,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    territory: serializeTerritory(task),
    progressCount: task.progressCount,
    completed: task.completed,
    claimed: task.claimed,
  };
}
