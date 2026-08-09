import {
  TARGET_AUTH_ROLES,
  type CoordinatorLevel,
  type EvidenceClassification,
  type EvidenceCustodyEventType,
  type EvidenceReviewStatus,
  type EvidenceType,
  type LegalCaseStatus,
  type TargetAccountStatus,
  type TerritoryKind,
} from "./platform-contracts";

export const LEGACY_AUTH_ROLES = [
  "ADMIN",
  "CANDIDATE",
  "AGENT",
  "VOTER",
] as const;

export const USER_ROLES = [...TARGET_AUTH_ROLES, ...LEGACY_AUTH_ROLES] as const;

export * from "./platform-contracts";

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

export {
  NIGERIA_EXPECTED_LGA_TOTAL,
  NIGERIA_EXPECTED_STATE_TOTAL,
  NIGERIA_GEO_POLITICAL_ZONES,
  NIGERIA_STATE_EXPECTED_LGA_COUNTS,
  NIGERIA_STATE_REFERENCE,
} from "./nigeria-reference-data";
export * from "./ogun-reference-contracts";

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

export const CAMPAIGN_EVENT_RSVP_STATUSES = [
  "INTERESTED",
  "GOING",
] as const;

export const ELECTION_DAY_OPENING_STATUSES = [
  "OPENED_ON_TIME",
  "OPENED_LATE",
  "NOT_OPEN",
] as const;

export const ELECTION_DAY_REPORT_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
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
export type CampaignEventRsvpStatus = (typeof CAMPAIGN_EVENT_RSVP_STATUSES)[number];
export type ElectionDayOpeningStatus = (typeof ELECTION_DAY_OPENING_STATUSES)[number];
export type ElectionDayReportStatus = (typeof ELECTION_DAY_REPORT_STATUSES)[number];

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
  accountStatus: TargetAccountStatus;
  coordinatorProfile: ({
    level: CoordinatorLevel;
  } & TerritorySummary) | null;
  adminProfile: ({
    adminLevel: AdminLevel;
    politicalPartyId: string | null;
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
    politicalPartyId: string | null;
    gpsTrackingConsentAt: string | null;
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
  portraitAssetId: string | null;
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
    isApprovedByInec: boolean;
    inecSourceUrl: string | null;
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
  upcomingEvents: CampaignEventItem[];
};

export type CandidateProfileEditorItem = {
  userId: string;
  name: string;
  officeType: CandidateOfficeType;
  politicalPartyId: string | null;
  portraitAssetId: string | null;
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
  politicalPartyId: string | null;
  territory: TerritorySummary;
};

export type AgentUserItem = {
  userId: string;
  name: string;
  email: string;
  isActive: boolean;
  phone: string | null;
  politicalPartyId: string | null;
  territory: TerritorySummary;
};

export type VoterUserItem = {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  voterRegistrationRecorded: boolean;
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
  voterRegistrationRecorded: boolean;
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
  politicalPartyId: string | null;
  voterRegistrationRecorded: boolean;
};

export type PoliticalPartyItem = {
  id: string;
  name: string;
  code: string;
  logoUrl: string | null;
  description: string | null;
  officialWebsite: string | null;
  isApprovedByInec: boolean;
  inecSourceUrl: string | null;
  candidateCount?: number;
};

export type PoliticalPartyPublicProfile = PoliticalPartyItem & {
  candidates: CandidatePublicListItem[];
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

export type CampaignEventItem = {
  id: string;
  candidateUserId: string;
  createdByUserId: string;
  title: string;
  description: string;
  venue: string;
  coverImageAssetId: string | null;
  coverImageUrl: string | null;
  registrationUrl: string | null;
  startsAt: string;
  endsAt: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
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
  candidate: {
    userId: string;
    name: string;
    portraitUrl: string | null;
    officeType: CandidateOfficeType;
    partyName: string | null;
  } | null;
  rsvp: {
    status: CampaignEventRsvpStatus;
    createdAt: string;
  } | null;
  rsvpCount: number;
};

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
  governance?: {
    reporterRole: UserRole;
    escalationStatus: "NOT_ESCALATED" | "ESCALATED";
    reviewPriority: "ROUTINE" | "PRIORITY" | "CRITICAL";
    flags: Array<{
      code:
        | "DUPLICATE_REPORT_WINDOW"
        | "REPORTER_TERRITORY_MISMATCH"
        | "MISSING_LOCATION_DATA"
        | "REPEATED_REPORTER_VOLUME"
        | "UNASSIGNED_OPEN_INCIDENT";
      severity: "INFO" | "WARNING" | "HIGH";
      message: string;
    }>;
  };
  createdAt: string;
  updatedAt: string;
};

export type IncidentGovernanceSummary = {
  totalIncidents: number;
  escalatedIncidents: number;
  flaggedIncidents: number;
  criticalReviewIncidents: number;
  byFlagCode: Record<string, number>;
};

export type PollingUnitCoverageSummary = {
  totalStatesInScope: number;
  totalLgasInScope: number;
  totalWardsInScope: number;
  totalPollingUnitsInScope: number;
  pollingUnitsWithAssignedAgents: number;
  pollingUnitsWithRecentActivity: number;
  pollingUnitsWithIncidents: number;
  pollingUnitsWithoutActivity: number;
  scopeWarning?: string | null;
};

export type ReferenceDataReadinessSummary = {
  loadedStates: number;
  loadedLgas: number;
  loadedWards: number;
  loadedPollingUnits: number;
  loadedWardsWithoutPollingUnits: number;
  authoritativeStates: number;
  authoritativeLgas: number;
  syntheticBootstrapLgas: number;
  wardAndPollingUnitInventoryComplete: boolean;
  inventoryWarning: string | null;
};

export type ReferenceCompletenessStateItem = {
  stateId: string;
  stateName: string;
  expectedLgas: number;
  loadedLgas: number;
  missingLgas: number;
  loadedWards: number;
  lgasWithoutWards: number;
  loadedPollingUnits: number;
  wardsWithoutPollingUnits: number;
  isComplete: boolean;
};

export type ReferenceCompletenessReport = {
  generatedAt: string;
  manualBootstrapCommand: string;
  summary: {
    expectedStates: number;
    loadedStates: number;
    expectedLgas: number;
    loadedLgas: number;
    loadedWards: number;
    loadedPollingUnits: number;
    statesWithMissingLgas: number;
    lgasWithoutWards: number;
    wardsWithoutPollingUnits: number;
  };
  states: ReferenceCompletenessStateItem[];
};

export type WardCoverageInsight = {
  wardId: string;
  wardName: string;
  lgaId: string;
  lgaName: string;
  pollingUnitCount: number;
  assignedAgentCount: number;
  targetAgentCount: number;
  remainingAgentCount: number;
  pollingUnitsWithoutAgents: number;
  pollingUnitsWithoutRecentActivity: number;
  openIncidentCount: number;
};

export type PollingUnitCoverageInsight = {
  pollingUnitId: string;
  pollingUnitName: string;
  stateId: string;
  stateName: string;
  wardId: string;
  wardName: string;
  lgaId: string;
  lgaName: string;
  assignedAgentCount: number;
  targetAgentCount: number;
  remainingAgentCount: number;
  recentActivityCount: number;
  openIncidentCount: number;
  hasAssignedAgent: boolean;
  hasRecentActivity: boolean;
  requiresAttention: boolean;
};

export type AgentPollingUnitGapItem = {
  userId: string;
  name: string;
  email: string;
  politicalPartyId: string | null;
  territory: TerritorySummary;
};

export type StateCoverageTargetItem = {
  stateId: string;
  stateName: string;
  targetAgentsPerPollingUnit: number;
  pollingUnitCount: number;
  assignedAgentCount: number;
  targetAgentCount: number;
  remainingAgentCount: number;
};

export type CoverageInsights = {
  summary: PollingUnitCoverageSummary & {
    wardsInScope: number;
    weakCoveragePollingUnits: number;
    pollingUnitsWithoutAssignedAgents: number;
    agentsWithoutPollingUnitAssignments: number;
    assignedAgentsInScope: number;
    targetAgentsInScope: number;
    remainingAgentsToTarget: number;
  };
  scopeWarning?: string | null;
  referenceData: ReferenceDataReadinessSummary;
  stateTargets: StateCoverageTargetItem[];
  wards: WardCoverageInsight[];
  pollingUnits: PollingUnitCoverageInsight[];
  agentsWithoutPollingUnitAssignments: AgentPollingUnitGapItem[];
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

export type RewardLedgerItem = {
  id: string;
  voterUserId: string;
  type: RewardType;
  points: number;
  amount: number | null;
  description: string;
  relatedUserId: string | null;
  createdAt: string;
};

export type RewardHistoryItem = {
  id: string;
  kind: "EARNED" | "REDEMPTION";
  status: "POSTED" | "PENDING" | "APPROVED" | "REJECTED" | "PAID";
  title: string;
  description: string;
  points: number;
  amount: number | null;
  createdAt: string;
  reviewedAt: string | null;
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
  actorName: string;
  action: string;
  targetType: string;
  targetId: string;
  metadataJson: string | null;
  createdAt: string;
};

export type ElectionDayVoteEntry = {
  politicalPartyId: string;
  politicalPartyName: string | null;
  votes: number;
};

export type ElectionDayReportItem = {
  id: string;
  agentUserId: string;
  agentName: string;
  reviewedByUserId: string | null;
  reviewedByName: string | null;
  reportDate: string;
  status: ElectionDayReportStatus;
  openingStatus: ElectionDayOpeningStatus;
  arrivalConfirmedAt: string;
  turnoutObservation: string;
  incidentNotes: string | null;
  remarks: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  voteEntries: ElectionDayVoteEntry[];
  arrivalPhotoAssetId: string;
  postCountingPhotoAssetId: string;
  territory: TerritorySummary;
  createdAt: string;
  updatedAt: string;
};

export type ElectionDayReportAssetItem = {
  id: string;
  fileName: string;
  fileUrl: string;
};

export type EvidenceCustodyEventItem = {
  id: string;
  eventType: EvidenceCustodyEventType;
  actorUserId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type EvidenceAssetItem = {
  id: string;
  evidenceType: EvidenceType;
  classification: EvidenceClassification;
  reviewStatus: EvidenceReviewStatus;
  originalStorageKey: string;
  storageBucket: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  sha256: string;
  capturedAt: string | null;
  uploadedAt: string;
  serverReceivedAt: string;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  metadata: Record<string, unknown> | null;
  derivatives: Record<string, unknown> | null;
  uploaderUserId: string;
  incidentId: string | null;
  electionReportId: string | null;
  territory: TerritorySummary;
  custodyEvents?: EvidenceCustodyEventItem[];
  originalAccess: {
    publicUrl: null;
    signedAccessRequired: boolean;
  };
  preservation: {
    originalImmutable: boolean;
    authoritativeStorage: "private-object-storage";
    derivativeStatus: string;
    retentionPolicy: string;
  };
};

export type EvidenceExplorerSummary = {
  total: number;
  returned: number;
  byType: Record<string, number>;
  byReviewStatus: Record<string, number>;
  byClassification: Record<string, number>;
};

export type EvidenceAggregationItem = {
  territoryKind: Exclude<TerritoryKind, "STATE" | "LGA">;
  territoryId: string;
  evidenceCount: number;
  latestServerReceivedAt: string | null;
  byType: Record<string, number>;
  byReviewStatus: Record<string, number>;
  byClassification: Record<string, number>;
};

export type EvidenceTimelineItem = {
  type: "ACTIVITY" | "INCIDENT" | "ELECTION_REPORT" | "EVIDENCE";
  occurredAt: string;
  id: string;
  label: string;
  sha256?: string;
};

export type EvidenceDossier = {
  pollingUnit: PollingUnitItem | null;
  territory: TerritorySummary;
  completeness: {
    evidenceCount: number;
    photoCount: number;
    videoCount: number;
    writtenReportCount: number;
    incidentCount: number;
    reportCount: number;
    custodyEventCount: number;
  };
  evidence: EvidenceAssetItem[];
  incidents: IncidentListItem[];
  reports: ElectionDayReportItem[];
  custodyEvents: EvidenceCustodyEventItem[];
  legalConclusion: null;
};

export type LegalCaseItem = {
  id: string;
  title: string;
  description: string | null;
  status: LegalCaseStatus;
  createdByUserId: string;
  territory: TerritorySummary;
  evidenceCount: number;
  packageCount: number;
  noteCount: number;
  createdAt: string;
  updatedAt: string;
  legalConclusion: null;
};

export type EvidenceManifest = {
  generatedAt: string;
  purpose: string;
  legalCaseId: string | null;
  archivePackagingStatus: string;
  items: Array<{
    evidenceAssetId: string;
    evidenceType: EvidenceType;
    classification: EvidenceClassification;
    reviewStatus: EvidenceReviewStatus;
    sha256: string;
    originalStorageKey: string;
    storageBucket: string;
    originalFileName: string;
    mimeType: string;
    fileSize: number;
    serverReceivedAt: string;
    pollingUnitId: string | null;
    incidentId: string | null;
    electionReportId: string | null;
    uploaderUserId: string;
  }>;
};

export type EvidencePackageItem = {
  id: string;
  itemCount: number;
  manifestSha256: string;
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

export type BroadcastAudiencePreview = {
  recipientCount: number;
  breakdown: {
    admins: number;
    agents: number;
    voters: number;
    candidates: number;
  };
  filters: {
    audience: BroadcastAudience;
    taskStatus: FieldTaskStatus | null;
    politicalPartyId: string | null;
    adminLevel: AdminLevel | null;
    officeType: CandidateOfficeType | null;
  };
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
export * from "./inec-political-parties";
