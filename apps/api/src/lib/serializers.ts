import type {
  AdminDashboardSummary,
  AdminMapSummary,
  AgentActivitySummary,
  AuditLogItem,
  BroadcastMessageItem,
  CampaignEventItem,
  CampaignEventRsvpStatus,
  CampaignMediaType,
  CampaignMaterialItem,
  CandidateListItem,
  CandidateProfileEditorItem,
  CandidatePublicListItem,
  CandidatePublicProfile,
  FieldTaskItem,
  FeedbackListItem,
  IncidentListItem,
  NotificationItem,
  PoliticalPartyItem,
  PoliticalPartyPublicProfile,
  PostListItem,
  PollingUnitCoverageSummary,
  PollListItem,
  RewardBalanceSummary,
  RewardRedemptionItem,
  TerritorySummary,
  VoterEngagementTaskType,
  VoterEngagementTaskItem,
} from "@pics-nigeria/shared";
import { CAMPAIGN_EVENT_RSVP_STATUSES, CAMPAIGN_MEDIA_TYPES, VOTER_ENGAGEMENT_TASK_TYPES } from "@pics-nigeria/shared";

function normalizeEngagementTaskType(value: string): VoterEngagementTaskType {
  if (VOTER_ENGAGEMENT_TASK_TYPES.includes(value as VoterEngagementTaskType)) {
    return value as VoterEngagementTaskType;
  }

  throw new Error(`Unsupported voter engagement task type: ${value}`);
}

function normalizeCampaignMediaType(value: string): CampaignMediaType {
  if (CAMPAIGN_MEDIA_TYPES.includes(value as CampaignMediaType)) {
    return value as CampaignMediaType;
  }

  throw new Error(`Unsupported campaign media type: ${value}`);
}

function normalizeCampaignEventRsvpStatus(value: string): CampaignEventRsvpStatus {
  if (CAMPAIGN_EVENT_RSVP_STATUSES.includes(value as CampaignEventRsvpStatus)) {
    return value as CampaignEventRsvpStatus;
  }

  throw new Error(`Unsupported campaign event RSVP status: ${value}`);
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
  mediaType?: string | null;
  mediaUrl?: string | null;
  thumbnailUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
  authorUserId: string;
  candidateUserId: string | null;
  isPublished: boolean;
  geoPoliticalZoneId?: string | null;
  stateId?: string | null;
  senatorialDistrictId?: string | null;
  federalConstituencyId?: string | null;
  lgaId?: string | null;
  wardId?: string | null;
  stateConstituencyId?: string | null;
  pollingUnitId?: string | null;
}): PostListItem {
  return {
    id: post.id,
    title: post.title,
    content: post.content,
    mediaType: normalizeCampaignMediaType(post.mediaType || "TEXT"),
    mediaUrl: post.mediaUrl ?? null,
    thumbnailUrl: post.thumbnailUrl ?? null,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    authorUserId: post.authorUserId,
    candidateUserId: post.candidateUserId,
    isPublished: post.isPublished,
    territory: serializeTerritory(post),
  };
}

export function serializeCampaignMaterialItem(post: Parameters<typeof serializePostListItem>[0]): CampaignMaterialItem {
  return serializePostListItem(post);
}

export function serializeCandidateProfileEditorItem(candidate: {
  userId: string;
  name: string;
  officeType: CandidateProfileEditorItem["officeType"];
  politicalPartyId: string | null;
  portraitUrl: string | null;
  campaignSlogan: string | null;
  bio: string | null;
  websiteUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  xUrl: string | null;
  isProfilePublished: boolean;
  geoPoliticalZoneId?: string | null;
  stateId?: string | null;
  senatorialDistrictId?: string | null;
  federalConstituencyId?: string | null;
  lgaId?: string | null;
  wardId?: string | null;
  stateConstituencyId?: string | null;
  pollingUnitId?: string | null;
}): CandidateProfileEditorItem {
  return {
    userId: candidate.userId,
    name: candidate.name,
    officeType: candidate.officeType,
    politicalPartyId: candidate.politicalPartyId,
    portraitUrl: candidate.portraitUrl,
    campaignSlogan: candidate.campaignSlogan,
    bio: candidate.bio,
    websiteUrl: candidate.websiteUrl,
    facebookUrl: candidate.facebookUrl,
    instagramUrl: candidate.instagramUrl,
    xUrl: candidate.xUrl,
    isProfilePublished: candidate.isProfilePublished,
    territory: serializeTerritory(candidate),
  };
}

export function serializeCandidatePublicListItem(candidate: {
  userId: string;
  name: string;
  officeType: CandidatePublicListItem["officeType"];
  portraitUrl: string | null;
  campaignSlogan: string | null;
  bio: string | null;
  isProfilePublished: boolean;
  geoPoliticalZoneId?: string | null;
  stateId?: string | null;
  senatorialDistrictId?: string | null;
  federalConstituencyId?: string | null;
  lgaId?: string | null;
  wardId?: string | null;
  stateConstituencyId?: string | null;
  pollingUnitId?: string | null;
  geoPoliticalZone?: { name: string } | null;
  state?: { name: string } | null;
  senatorialDistrict?: { name: string } | null;
  federalConstituency?: { name: string } | null;
  lga?: { name: string } | null;
  ward?: { name: string } | null;
  stateConstituency?: { name: string } | null;
  pollingUnit?: { name: string } | null;
  politicalParty?: {
    id: string;
    name: string;
    code: string;
    logoUrl: string | null;
    isApprovedByInec?: boolean;
    inecSourceUrl?: string | null;
  } | null;
}): CandidatePublicListItem {
  return {
    userId: candidate.userId,
    name: candidate.name,
    portraitUrl: candidate.portraitUrl,
    officeType: candidate.officeType,
    campaignSlogan: candidate.campaignSlogan,
    bio: candidate.bio,
    isProfilePublished: candidate.isProfilePublished,
    party: candidate.politicalParty
      ? {
          id: candidate.politicalParty.id,
          name: candidate.politicalParty.name,
          code: candidate.politicalParty.code,
          logoUrl: candidate.politicalParty.logoUrl,
          isApprovedByInec: candidate.politicalParty.isApprovedByInec ?? false,
          inecSourceUrl: candidate.politicalParty.inecSourceUrl ?? null,
        }
      : null,
    territory: serializeTerritory(candidate),
    territoryLabels: {
      geoPoliticalZone: candidate.geoPoliticalZone?.name || null,
      state: candidate.state?.name || null,
      senatorialDistrict: candidate.senatorialDistrict?.name || null,
      federalConstituency: candidate.federalConstituency?.name || null,
      lga: candidate.lga?.name || null,
      ward: candidate.ward?.name || null,
      stateConstituency: candidate.stateConstituency?.name || null,
      pollingUnit: candidate.pollingUnit?.name || null,
    },
  };
}

export function serializeCandidatePublicProfile(candidate: {
  userId: string;
  name: string;
  officeType: CandidatePublicProfile["officeType"];
  portraitUrl: string | null;
  campaignSlogan: string | null;
  bio: string | null;
  websiteUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  xUrl: string | null;
  isProfilePublished: boolean;
  geoPoliticalZoneId?: string | null;
  stateId?: string | null;
  senatorialDistrictId?: string | null;
  federalConstituencyId?: string | null;
  lgaId?: string | null;
  wardId?: string | null;
  stateConstituencyId?: string | null;
  pollingUnitId?: string | null;
  geoPoliticalZone?: { name: string } | null;
  state?: { name: string } | null;
  senatorialDistrict?: { name: string } | null;
  federalConstituency?: { name: string } | null;
  lga?: { name: string } | null;
  ward?: { name: string } | null;
  stateConstituency?: { name: string } | null;
  pollingUnit?: { name: string } | null;
  politicalParty?: {
    id: string;
    name: string;
    code: string;
    logoUrl: string | null;
    isApprovedByInec?: boolean;
    inecSourceUrl?: string | null;
  } | null;
  materials: Parameters<typeof serializeCampaignMaterialItem>[0][];
  upcomingEvents: Parameters<typeof serializeCampaignEventItem>[0][];
}): CandidatePublicProfile {
  return {
    ...serializeCandidatePublicListItem(candidate),
    websiteUrl: candidate.websiteUrl,
    facebookUrl: candidate.facebookUrl,
    instagramUrl: candidate.instagramUrl,
    xUrl: candidate.xUrl,
    materials: candidate.materials.map(serializeCampaignMaterialItem),
    upcomingEvents: candidate.upcomingEvents.map(serializeCampaignEventItem),
  };
}

export function serializePoliticalPartyItem(party: {
  id: string;
  name: string;
  code: string;
  logoUrl: string | null;
  description?: string | null;
  officialWebsite?: string | null;
  isApprovedByInec?: boolean;
  inecSourceUrl?: string | null;
  _count?: { candidateProfiles?: number };
}): PoliticalPartyItem {
  return {
    id: party.id,
    name: party.name,
    code: party.code,
    logoUrl: party.logoUrl ?? null,
    description: party.description ?? null,
    officialWebsite: party.officialWebsite ?? null,
    isApprovedByInec: party.isApprovedByInec ?? false,
    inecSourceUrl: party.inecSourceUrl ?? null,
    candidateCount: party._count?.candidateProfiles,
  };
}

export function serializePoliticalPartyPublicProfile(party: {
  id: string;
  name: string;
  code: string;
  logoUrl: string | null;
  description?: string | null;
  officialWebsite?: string | null;
  isApprovedByInec?: boolean;
  inecSourceUrl?: string | null;
  candidates: Parameters<typeof serializeCandidatePublicListItem>[0][];
}): PoliticalPartyPublicProfile {
  return {
    ...serializePoliticalPartyItem(party),
    candidates: party.candidates.map(serializeCandidatePublicListItem),
  };
}

export function serializeCampaignEventItem(event: {
  id: string;
  candidateUserId: string;
  createdByUserId: string;
  title: string;
  description: string;
  venue: string;
  coverImageUrl: string | null;
  registrationUrl: string | null;
  startsAt: Date;
  endsAt: Date | null;
  isPublished: boolean;
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
  geoPoliticalZone?: { name: string } | null;
  state?: { name: string } | null;
  senatorialDistrict?: { name: string } | null;
  federalConstituency?: { name: string } | null;
  lga?: { name: string } | null;
  ward?: { name: string } | null;
  stateConstituency?: { name: string } | null;
  pollingUnit?: { name: string } | null;
  candidateUser?: {
    id: string;
    name: string;
    candidateProfile?: {
      officeType: CandidatePublicProfile["officeType"];
      portraitUrl: string | null;
      politicalParty?: { name: string } | null;
    } | null;
  } | null;
  rsvps?: Array<{ status: string; createdAt: Date; voterUserId?: string }>;
  _count?: { rsvps?: number };
}): CampaignEventItem {
  const firstRsvp = event.rsvps?.[0] || null;

  return {
    id: event.id,
    candidateUserId: event.candidateUserId,
    createdByUserId: event.createdByUserId,
    title: event.title,
    description: event.description,
    venue: event.venue,
    coverImageUrl: event.coverImageUrl ?? null,
    registrationUrl: event.registrationUrl ?? null,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt ? event.endsAt.toISOString() : null,
    isPublished: event.isPublished,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
    territory: serializeTerritory(event),
    territoryLabels: {
      geoPoliticalZone: event.geoPoliticalZone?.name || null,
      state: event.state?.name || null,
      senatorialDistrict: event.senatorialDistrict?.name || null,
      federalConstituency: event.federalConstituency?.name || null,
      lga: event.lga?.name || null,
      ward: event.ward?.name || null,
      stateConstituency: event.stateConstituency?.name || null,
      pollingUnit: event.pollingUnit?.name || null,
    },
    candidate: event.candidateUser
      ? {
          userId: event.candidateUser.id,
          name: event.candidateUser.name,
          portraitUrl: event.candidateUser.candidateProfile?.portraitUrl ?? null,
          officeType: event.candidateUser.candidateProfile?.officeType || "PRESIDENTIAL",
          partyName: event.candidateUser.candidateProfile?.politicalParty?.name ?? null,
        }
      : null,
    rsvp: firstRsvp
      ? {
          status: normalizeCampaignEventRsvpStatus(firstRsvp.status),
          createdAt: firstRsvp.createdAt.toISOString(),
        }
      : null,
    rsvpCount: event._count?.rsvps || 0,
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
