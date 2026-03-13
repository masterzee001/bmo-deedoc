export const USER_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "CANDIDATE",
  "AGENT",
  "VOTER",
] as const;

export const ADMIN_LEVELS = [
  "NATIONAL",
  "GEO_POLITICAL_ZONE",
  "STATE",
  "SENATORIAL",
  "FEDERAL_CONSTITUENCY",
  "STATE_CONSTITUENCY",
  "LGA",
  "WARD",
] as const;

export const CANDIDATE_OFFICE_TYPES = [
  "PRESIDENTIAL",
  "GOVERNORSHIP",
  "SENATE",
  "HOUSE_OF_REP",
  "STATE_ASSEMBLY",
  "CHAIRMANSHIP",
  "COUNCILLOR",
] as const;

export const REWARD_TYPES = [
  "PARTICIPATION",
  "REFERRAL",
  "BONUS",
  "MANUAL_ADJUSTMENT",
] as const;

export const ASSIGNMENT_PERMISSION_TYPES = [
  "VIEW",
  "MANAGE",
  "PUBLISH",
  "MODERATE",
] as const;

export const AGENT_ACTIVITY_TYPES = [
  "CHECK_IN",
  "CHECK_OUT",
  "LOCATION_PING",
  "INCIDENT_RESPONSE",
  "VOTER_OUTREACH",
  "MATERIAL_DISTRIBUTION",
  "OBSERVATION",
] as const;

export const INCIDENT_TYPES = [
  "VIOLENCE",
  "INTIMIDATION",
  "VOTE_BUYING",
  "MATERIAL_SHORTAGE",
  "LOGISTICS_DELAY",
  "MALFUNCTION",
  "SECURITY_CONCERN",
  "OTHER",
] as const;

export const INCIDENT_SEVERITIES = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
] as const;

export const INCIDENT_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
] as const;

export const REWARD_REDEMPTION_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "PAID",
] as const;

export const NOTIFICATION_TYPES = [
  "REWARD_EARNED",
  "REWARD_REDEMPTION",
  "INCIDENT_ASSIGNED",
  "INCIDENT_UPDATED",
  "POLL_CREATED",
  "POST_PUBLISHED",
  "SYSTEM",
] as const;

export const FIELD_TASK_STATUSES = [
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "DONE",
] as const;

export const FIELD_TASK_PRIORITIES = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
] as const;

export const BROADCAST_AUDIENCES = [
  "ALL",
  "ADMINS",
  "AGENTS",
  "VOTERS",
  "CANDIDATES",
] as const;

export const VOTER_ENGAGEMENT_TASK_TYPES = [
  "REGISTRATION",
  "REFERRAL",
  "POLL_RESPONSE",
] as const;

export const CAMPAIGN_MEDIA_TYPES = [
  "TEXT",
  "IMAGE",
  "VIDEO",
  "DOCUMENT",
] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type AdminLevel = (typeof ADMIN_LEVELS)[number];
export type CandidateOfficeType = (typeof CANDIDATE_OFFICE_TYPES)[number];
export type RewardType = (typeof REWARD_TYPES)[number];
export type AssignmentPermissionType = (typeof ASSIGNMENT_PERMISSION_TYPES)[number];
export type AgentActivityType = (typeof AGENT_ACTIVITY_TYPES)[number];
export type IncidentType = (typeof INCIDENT_TYPES)[number];
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];
export type RewardRedemptionStatus = (typeof REWARD_REDEMPTION_STATUSES)[number];
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export type FieldTaskStatus = (typeof FIELD_TASK_STATUSES)[number];
export type FieldTaskPriority = (typeof FIELD_TASK_PRIORITIES)[number];
export type BroadcastAudience = (typeof BROADCAST_AUDIENCES)[number];
export type VoterEngagementTaskType = (typeof VOTER_ENGAGEMENT_TASK_TYPES)[number];
export type CampaignMediaType = (typeof CAMPAIGN_MEDIA_TYPES)[number];

export type TerritoryScope = {
  geoPoliticalZoneId?: string | null;
  stateId?: string | null;
  senatorialDistrictId?: string | null;
  federalConstituencyId?: string | null;
  lgaId?: string | null;
  wardId?: string | null;
  stateConstituencyId?: string | null;
  pollingUnitId?: string | null;
};

export type TerritorySummary = {
  geoPoliticalZoneId: string | null;
  stateId: string | null;
  senatorialDistrictId: string | null;
  federalConstituencyId: string | null;
  lgaId: string | null;
  wardId: string | null;
  stateConstituencyId: string | null;
  pollingUnitId: string | null;
};

export type AuthUserProfile = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  isActive: boolean;
  adminProfile: ({
    adminLevel: AdminLevel;
  } & TerritorySummary) | null;
  candidateProfile: ({
    officeType: CandidateOfficeType;
    politicalPartyId: string | null;
  } & TerritorySummary) | null;
  voterProfile: ({
    voterCardNumber: string;
    referralCode: string;
    referredByUserId: string | null;
  } & TerritorySummary) | null;
  agentProfile: ({
    assignedAdminUserId: string | null;
  } & TerritorySummary) | null;
};

export type RewardsSummary = {
  totalPoints: number;
  totalParticipationPoints: number;
  totalReferralPoints: number;
  availablePoints: number;
  reservedPoints: number;
  recentRewards: Array<{
    id: string;
    type: RewardType;
    points: number;
    amount: number | null;
    description: string;
    createdAt: string;
  }>;
};

export type CandidateListItem = {
  userId: string;
  name: string;
  email: string;
  isActive: boolean;
  officeType: CandidateOfficeType;
  politicalPartyId: string | null;
  territory: TerritorySummary;
  assignmentPermissions: AssignmentPermissionType[];
};

export type CandidatePublicListItem = {
  userId: string;
  name: string;
  portraitUrl: string | null;
  officeType: CandidateOfficeType;
  campaignSlogan: string | null;
  bio: string | null;
  isProfilePublished: boolean;
  party: {
    id: string;
    name: string;
    code: string;
    logoUrl: string | null;
  } | null;
  territory: TerritorySummary;
  territoryLabels: {
    geoPoliticalZone: string | null;
    state: string | null;
    senatorialDistrict: string | null;
    federalConstituency: string | null;
    lga: string | null;
    ward: string | null;
    stateConstituency: string | null;
    pollingUnit: string | null;
  };
};

export type CandidatePublicProfile = CandidatePublicListItem & {
  websiteUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  xUrl: string | null;
  materials: CampaignMaterialItem[];
};

export type CandidateProfileEditorItem = {
  userId: string;
  name: string;
  officeType: CandidateOfficeType;
  politicalPartyId: string | null;
  portraitUrl: string | null;
  campaignSlogan: string | null;
  bio: string | null;
  websiteUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  xUrl: string | null;
  isProfilePublished: boolean;
  territory: TerritorySummary;
};

export type GeoPoliticalZoneItem = {
  id: string;
  name: string;
};

export type StateItem = {
  id: string;
  name: string;
  geoPoliticalZoneId: string | null;
};

export type SenatorialDistrictItem = {
  id: string;
  name: string;
  stateId: string;
};

export type FederalConstituencyItem = {
  id: string;
  name: string;
  stateId: string;
  senatorialDistrictId: string;
};

export type LgaItem = {
  id: string;
  name: string;
  stateId: string;
};

export type WardItem = {
  id: string;
  name: string;
  stateId: string;
  lgaId: string;
};

export type PollingUnitItem = {
  id: string;
  name: string;
  stateId: string;
  lgaId: string;
  wardId: string;
};

export type StateConstituencyItem = {
  id: string;
  name: string;
  stateId: string;
  lgaId: string;
};

export type AdminUserItem = {
  userId: string;
  name: string;
  email: string;
  isActive: boolean;
  adminLevel: AdminLevel;
  territory: TerritorySummary;
};

export type AgentUserItem = {
  userId: string;
  name: string;
  email: string;
  isActive: boolean;
  phone: string | null;
  assignedAdminUserId: string | null;
  territory: TerritorySummary;
};

export type VoterUserItem = {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  voterCardNumber: string;
  referralCode: string;
  contactConsent: boolean;
  termsAcceptedAt: string | null;
  territory: TerritorySummary;
};

export type CandidateVoterItem = {
  userId: string;
  name: string;
  emailMask: string;
  phoneMask: string;
  voterCardNumber: string;
  contactConsent: boolean;
  termsAcceptedAt: string | null;
  territory: TerritorySummary;
};

export type ManagedUserItem = {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  territory: TerritorySummary;
  adminLevel: AdminLevel | null;
  officeType: CandidateOfficeType | null;
  voterCardNumber: string | null;
  assignedAdminUserId: string | null;
};

export type PoliticalPartyItem = {
  id: string;
  name: string;
  code: string;
};

export type FeedbackListItem = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  stateId: string;
  senatorialDistrictId: string | null;
  lgaId: string;
  wardId: string | null;
  pollingUnitId: string | null;
  voterUserId: string | null;
  agentUserId: string | null;
  candidateUserId: string | null;
};

export type PollListItem = {
  id: string;
  title: string;
  description: string | null;
  isActive: boolean;
  candidateUserId: string | null;
  officeType: CandidateOfficeType | null;
  options: Array<{ id: string; label: string }>;
};

export type PostListItem = {
  id: string;
  title: string;
  content: string;
  mediaType: CampaignMediaType;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
  authorUserId: string;
  candidateUserId: string | null;
  isPublished: boolean;
  territory: TerritorySummary;
};

export type CampaignMaterialItem = PostListItem;

export type AdminDashboardSummary = {
  totalVotersInScope: number;
  totalAgentsInScope: number;
  totalFeedbackItemsInScope: number;
  totalActivePollsInScope: number;
  totalCandidatesVisibleInScope: number;
  totalAgentCheckInsToday: number;
  totalActiveAgentsToday: number;
  totalIncidentsOpen: number;
  totalIncidentsCritical: number;
  totalPollResponsesInScope: number;
  totalVoterFeedbackItemsInScope: number;
};

export type AgentActivitySummary = {
  agentUserId: string;
  name: string;
  email: string;
  territory: TerritorySummary;
  latestActivityType: AgentActivityType | null;
  latestActivityAt: string | null;
  latestLatitude: number | null;
  latestLongitude: number | null;
  pollingUnitId: string | null;
};

export type IncidentListItem = {
  id: string;
  reportedByUserId: string;
  type: IncidentType;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  latitude: number | null;
  longitude: number | null;
  stateId: string;
  senatorialDistrictId: string | null;
  lgaId: string;
  wardId: string | null;
  pollingUnitId: string | null;
  assignedAdminUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PollingUnitCoverageSummary = {
  totalPollingUnitsInScope: number;
  pollingUnitsWithAssignedAgents: number;
  pollingUnitsWithRecentActivity: number;
  pollingUnitsWithIncidents: number;
  pollingUnitsWithoutActivity: number;
};

export type AdminMapSummary = {
  activeAgents: AgentActivitySummary[];
  incidents: IncidentListItem[];
  pollingUnits: Array<{
    id: string;
    name: string;
    stateId: string;
    lgaId: string;
    wardId: string;
  }>;
  counts: {
    byStatus: Record<string, number>;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
  };
};

export type RewardRedemptionItem = {
  id: string;
  voterUserId: string;
  pointsRequested: number;
  amountRequested: number | null;
  status: RewardRedemptionStatus;
  note: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RewardBalanceSummary = {
  earnedPoints: number;
  reservedPoints: number;
  availablePoints: number;
};

export type NotificationItem = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export type AuditLogItem = {
  id: string;
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadataJson: string | null;
  createdAt: string;
};

export type FieldTaskItem = {
  id: string;
  title: string;
  description: string;
  status: FieldTaskStatus;
  priority: FieldTaskPriority;
  createdByUserId: string;
  assignedToUserId: string;
  incidentId: string | null;
  dueAt: string | null;
  completedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
  territory: TerritorySummary;
  assigneeName: string;
  creatorName: string;
};

export type BroadcastMessageItem = {
  id: string;
  title: string;
  message: string;
  audience: BroadcastAudience;
  taskStatus: FieldTaskStatus | null;
  createdByUserId: string;
  createdByName: string;
  recipientCount: number;
  createdAt: string;
  updatedAt: string;
  territory: TerritorySummary;
};

export type VoterEngagementTaskItem = {
  id: string;
  title: string;
  description: string;
  type: VoterEngagementTaskType;
  rewardPoints: number;
  targetCount: number | null;
  isActive: boolean;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  territory: TerritorySummary;
  progressCount: number;
  completed: boolean;
  claimed: boolean;
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emptyTerritorySummary(): TerritorySummary {
  return {
    geoPoliticalZoneId: null,
    stateId: null,
    senatorialDistrictId: null,
    federalConstituencyId: null,
    lgaId: null,
    wardId: null,
    stateConstituencyId: null,
    pollingUnitId: null,
  };
}

export * from "./nigeria-reference-data";
