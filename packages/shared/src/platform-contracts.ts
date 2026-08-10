export const TARGET_AUTH_ROLES = [
  "SUPER_ADMIN",
  "STATE_OFFICER",
  "COORDINATOR",
  "VALIDATOR",
  "PAYOUT_OFFICER",
  "MEMBER",
] as const;

export const OGUN_STATE_ID = "ng-state-ogun";

export const TARGET_ACCOUNT_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"] as const;

export const COORDINATOR_LEVELS = [
  "SENATORIAL_DISTRICT",
  "FEDERAL_CONSTITUENCY",
  "STATE_CONSTITUENCY",
  "WARD",
  "POLLING_UNIT",
] as const;

export const TERRITORY_KINDS = [
  "STATE",
  "SENATORIAL_DISTRICT",
  "FEDERAL_CONSTITUENCY",
  "STATE_CONSTITUENCY",
  "LGA",
  "WARD",
  "POLLING_UNIT",
] as const;

export const PHASE_1_AUTH_ACTIONS = [
  "VIEW_TERRITORY",
  "MANAGE_USERS",
  "ASSIGN_TERRITORY",
  "MANAGE_CANDIDATES",
] as const;

export const VOTER_VERIFICATION_STATUSES = [
  "NOT_SUBMITTED",
  "PENDING",
  "UNDER_REVIEW",
  "RESUBMISSION_REQUIRED",
  "VERIFIED",
  "REJECTED",
] as const;

export const REFERRAL_STATUSES = [
  "REGISTERED",
  "PENDING_VERIFICATION",
  "QUALIFIED",
  "REJECTED",
  "FLAGGED",
  "REWARD_PROCESSED",
] as const;

export const REWARD_EVENT_TYPES = [
  "VERIFIED_REFERRAL",
  "FIELD_ACTIVITY",
  "TASK_COMPLETION",
  "APPROVED_PARTICIPATION",
  "BONUS",
  "MANUAL_ADJUSTMENT",
] as const;

export const REWARD_QUALIFYING_EVENTS = ["VOTER_VERIFICATION_APPROVED"] as const;

export const REWARD_EVENT_STATUSES = ["PENDING", "PROCESSED", "SKIPPED"] as const;

export const PAYOUT_STATUSES = [
  "PENDING",
  "ELIGIBLE",
  "APPROVED",
  "PROCESSING",
  "PAID",
  "HELD",
  "REJECTED",
] as const;

export const POLLING_UNIT_OPERATIONAL_STATUSES = [
  "NOT_CHECKED_IN",
  "CHECKED_IN",
  "OPENED",
  "REPORTING",
  "INCIDENT_REPORTED",
  "COUNTING",
  "RESULT_SUBMITTED",
  "UNDER_REVIEW",
  "COMPLETED",
] as const;

export const ELECTION_DAY_GEOFENCE_STATUSES = [
  "NOT_EVALUATED",
  "IN_RANGE",
  "OUT_OF_RANGE_REVIEW_REQUIRED",
  "LOCATION_UNKNOWN",
  "GATED_AUTHORITATIVE_PU_GEODATA_REQUIRED",
] as const;

export const ELECTION_DAY_ALERT_TYPES = [
  "NO_CHECK_IN",
  "TRACKING_STOPPED",
  "LOCATION_STALE",
  "LOCATION_MISMATCH",
  "GPS_PERMISSION_DISABLED",
  "DEVICE_SESSION_CHANGED",
  "REPORT_OVERDUE",
] as const;

export const ELECTION_DAY_ALERT_STATUSES = [
  "OPEN",
  "ACKNOWLEDGED",
  "ESCALATED",
  "RESOLVED",
] as const;

export const ELECTION_DAY_REALTIME_EVENT_TYPES = [
  "election.checkin.created",
  "election.location.updated",
  "election.tracking.stale",
  "election.location.mismatch",
  "election.alert.created",
  "election.alert.updated",
  "election.situation.updated",
  "election.incident.created",
  "election.incident.updated",
  "election.report.submitted",
  "election.report.reviewed",
  "election.result.submitted",
  "message.created",
  "call.initiated",
  "call.ringing",
  "call.accepted",
  "call.rejected",
  "call.connected",
  "call.ended",
  "call.missed",
  "call.signal",
] as const;

export const VOICE_CALL_STATUSES = ["INITIATED", "RINGING", "CONNECTED", "ENDED"] as const;

export const VOICE_CALL_END_REASONS = [
  "COMPLETED",
  "REJECTED",
  "MISSED",
  "CANCELLED",
  "FAILED",
] as const;

export const VOICE_CALL_PARTICIPANT_STATUSES = [
  "CALLING",
  "RINGING",
  "ACCEPTED",
  "REJECTED",
  "MISSED",
  "LEFT",
  "FAILED",
] as const;

export const VOICE_CALL_EVENT_TYPES = [
  "INITIATED",
  "RINGING",
  "ACCEPTED",
  "REJECTED",
  "CONNECTED",
  "ENDED",
  "MISSED",
  "FAILED",
  "SIGNAL_RELAYED",
] as const;

/** WebRTC signalling message kinds relayed between call participants. Signal bodies are relayed transiently and never persisted. */
export const VOICE_CALL_SIGNAL_TYPES = ["offer", "answer", "candidate"] as const;

export const REALTIME_RUNTIME_STATUSES = [
  "TARGET_NOT_RUNNING",
  "AVAILABLE",
  "DEGRADED_NO_REDIS",
  "DEGRADED_REDIS_UNAVAILABLE",
] as const;

export const EVIDENCE_TYPES = ["PHOTO", "VIDEO", "WRITTEN_REPORT"] as const;

export const EVIDENCE_CLASSIFICATIONS = [
  "ARRIVAL",
  "OPENING",
  "MATERIALS",
  "SECURITY",
  "INCIDENT",
  "VOTING_PROCESS",
  "COUNTING",
  "RESULT_SHEET",
  "POST_COUNTING",
  "OTHER",
] as const;

export const EVIDENCE_REVIEW_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "VERIFIED",
  "DISPUTED",
  "REQUIRES_CLARIFICATION",
  "ARCHIVED",
] as const;

export const EVIDENCE_CUSTODY_EVENT_TYPES = [
  "UPLOADED",
  "VIEWED",
  "REVIEWED",
  "CLASSIFIED",
  "DOWNLOADED",
  "EXPORTED",
  "ADDED_TO_CASE",
] as const;

export const LEGAL_CASE_STATUSES = ["OPEN", "LEGAL_HOLD", "CLOSED"] as const;

export type TargetAuthRole = (typeof TARGET_AUTH_ROLES)[number];
export type TargetAccountStatus = (typeof TARGET_ACCOUNT_STATUSES)[number];
export type CoordinatorLevel = (typeof COORDINATOR_LEVELS)[number];
export type TerritoryKind = (typeof TERRITORY_KINDS)[number];
export type Phase1AuthAction = (typeof PHASE_1_AUTH_ACTIONS)[number];
export type VoterVerificationStatus = (typeof VOTER_VERIFICATION_STATUSES)[number];
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];
export type RewardEventType = (typeof REWARD_EVENT_TYPES)[number];
export type RewardQualifyingEvent = (typeof REWARD_QUALIFYING_EVENTS)[number];
export type RewardEventStatus = (typeof REWARD_EVENT_STATUSES)[number];
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];
export type PollingUnitOperationalStatus = (typeof POLLING_UNIT_OPERATIONAL_STATUSES)[number];
export type ElectionDayGeofenceStatus = (typeof ELECTION_DAY_GEOFENCE_STATUSES)[number];
export type ElectionDayAlertType = (typeof ELECTION_DAY_ALERT_TYPES)[number];
export type ElectionDayAlertStatus = (typeof ELECTION_DAY_ALERT_STATUSES)[number];
export type ElectionDayRealtimeEventType = (typeof ELECTION_DAY_REALTIME_EVENT_TYPES)[number];
export type VoiceCallStatus = (typeof VOICE_CALL_STATUSES)[number];
export type VoiceCallEndReason = (typeof VOICE_CALL_END_REASONS)[number];
export type VoiceCallParticipantStatus = (typeof VOICE_CALL_PARTICIPANT_STATUSES)[number];
export type VoiceCallEventType = (typeof VOICE_CALL_EVENT_TYPES)[number];
export type VoiceCallSignalType = (typeof VOICE_CALL_SIGNAL_TYPES)[number];

/**
 * Permitted durable call-status transitions. Any transition not listed here is
 * rejected by the API so call lifecycle cannot be driven into an invalid state.
 */
export const VOICE_CALL_STATUS_TRANSITIONS: Record<VoiceCallStatus, readonly VoiceCallStatus[]> = {
  INITIATED: ["RINGING", "CONNECTED", "ENDED"],
  RINGING: ["CONNECTED", "ENDED"],
  CONNECTED: ["ENDED"],
  ENDED: [],
};

export function canTransitionVoiceCall(from: VoiceCallStatus, to: VoiceCallStatus): boolean {
  return VOICE_CALL_STATUS_TRANSITIONS[from].includes(to);
}
export type RealtimeRuntimeStatus = (typeof REALTIME_RUNTIME_STATUSES)[number];
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];
export type EvidenceClassification = (typeof EVIDENCE_CLASSIFICATIONS)[number];
export type EvidenceReviewStatus = (typeof EVIDENCE_REVIEW_STATUSES)[number];
export type EvidenceCustodyEventType = (typeof EVIDENCE_CUSTODY_EVENT_TYPES)[number];
export type LegalCaseStatus = (typeof LEGAL_CASE_STATUSES)[number];

export type OperationalTerritory = {
  stateId: string;
  senatorialDistrictId?: string | null;
  federalConstituencyId?: string | null;
  stateConstituencyId?: string | null;
  wardId?: string | null;
  pollingUnitId?: string | null;
};

export type CoordinatorProfileSummary = OperationalTerritory & {
  level: CoordinatorLevel;
};

export type CandidateDomainItem = OperationalTerritory & {
  id: string;
  legacyUserId: string | null;
  fullName: string;
  officeType:
    | "PRESIDENTIAL"
    | "GOVERNORSHIP"
    | "SENATE"
    | "HOUSE_OF_REP"
    | "STATE_ASSEMBLY"
    | "CHAIRMANSHIP"
    | "COUNCILLOR";
  politicalPartyId: string | null;
  portraitUrl: string | null;
  campaignSlogan: string | null;
  bio: string | null;
  isPublished: boolean;
  isActive: boolean;
};

export type OrganizationTreePollingUnit = {
  id: string;
  name: string;
  coordinators: Array<{ userId: string; name: string }>;
};

export type OrganizationTreeWard = {
  id: string;
  name: string;
  coordinators: Array<{ userId: string; name: string }>;
  pollingUnits: OrganizationTreePollingUnit[];
};

export type OrganizationTreeStateConstituency = {
  id: string;
  name: string;
  coordinators: Array<{ userId: string; name: string }>;
  wards: OrganizationTreeWard[];
};

export type OrganizationTreeFederalConstituency = {
  id: string;
  name: string;
  coordinators: Array<{ userId: string; name: string }>;
  stateConstituencies: OrganizationTreeStateConstituency[];
};

export type OrganizationTreeSenatorialDistrict = {
  id: string;
  name: string;
  coordinators: Array<{ userId: string; name: string }>;
  federalConstituencies: OrganizationTreeFederalConstituency[];
};

export type OgunOrganizationTree = {
  id: string;
  name: string;
  stateOfficers: Array<{ userId: string; name: string }>;
  senatorialDistricts: OrganizationTreeSenatorialDistrict[];
};

export type PlatformEventEnvelope<TType extends string, TPayload> = {
  eventId: string;
  eventType: TType;
  eventVersion: number;
  occurredAt: string;
  actorUserId: string | null;
  correlationId: string;
  idempotencyKey: string;
  territory: {
    stateId: string;
    senatorialDistrictId?: string | null;
    federalConstituencyId?: string | null;
    stateConstituencyId?: string | null;
    wardId?: string | null;
    pollingUnitId?: string | null;
  } | null;
  payload: TPayload;
};

export type ElectionDayRealtimePayload = Record<string, unknown>;

export type ElectionDayRealtimeEnvelope = PlatformEventEnvelope<
  ElectionDayRealtimeEventType,
  ElectionDayRealtimePayload
>;

export type RealtimePresenceState = "ONLINE" | "ACTIVE_RECENTLY" | "OFFLINE" | "IN_CALL";

export type RealtimePresenceEntry = {
  userId: string;
  state: RealtimePresenceState;
  lastSeenAt: string;
  socketCount: number;
};

export type RealtimeGatewayStatus = {
  runtimeStatus: RealtimeRuntimeStatus;
  restFallbackAvailable: boolean;
  transport: "socket.io";
  redisAdapter: "connected" | "not_configured" | "unavailable";
  contractVersion: 1;
  eventTypes: ElectionDayRealtimeEventType[];
};

export type ElectionDayLocationEvaluation = {
  status: ElectionDayGeofenceStatus;
  checkedAt: string;
  reason: string | null;
  distanceMeters: number | null;
  accuracyMeters: number | null;
};

export type ElectionDayPollingUnitStatus = {
  pollingUnitId: string;
  pollingUnitName: string | null;
  coordinatorUserId: string | null;
  coordinatorName: string | null;
  operationalStatus: PollingUnitOperationalStatus;
  checkedInAt: string | null;
  lastSeenAt: string | null;
  lastLocation: {
    latitude: number;
    longitude: number;
    accuracyMeters: number | null;
    capturedAt: string;
  } | null;
  openIncidentCount: number;
  reportStatus: "NOT_SUBMITTED" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
  resultSubmitted: boolean;
  evidenceReceived: boolean;
  geofence: ElectionDayLocationEvaluation;
};

export type ElectionDaySituationRoomStatus = {
  generatedAt: string;
  territory: OperationalTerritory;
  realtime: {
    runtimeStatus: RealtimeRuntimeStatus;
    restFallbackAvailable: boolean;
    contractVersion: 1;
    eventTypes: ElectionDayRealtimeEventType[];
  };
  totals: {
    expectedPollingUnits: number;
    assignedPollingUnits: number;
    checkedInPollingUnits: number;
    missingCheckIns: number;
    activeRecently: number;
    openIncidents: number;
    criticalIncidents: number;
    reportsReceived: number;
    reportsOutstanding: number;
    resultReportsReceived: number;
    evidenceReceived: number;
    completedPollingUnits: number;
    reportingPercentage: number;
  };
  byOpeningStatus: Record<string, number>;
  byReportStatus: Record<string, number>;
  alerts: Array<{
    type: ElectionDayAlertType;
    status: ElectionDayAlertStatus;
    pollingUnitId: string;
    message: string;
    detectedAt: string;
  }>;
  pollingUnits: ElectionDayPollingUnitStatus[];
};

export type ElectionDayOperationalAlertItem = {
  id: string;
  type: ElectionDayAlertType | string;
  status: ElectionDayAlertStatus;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  message: string;
  sourceType: string | null;
  sourceId: string | null;
  actorUserId: string | null;
  acknowledgedByUserId: string | null;
  resolvedByUserId: string | null;
  territory: OperationalTerritory;
  metadata: Record<string, unknown> | null;
  detectedAt: string;
  acknowledgedAt: string | null;
  escalatedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ElectionDayConversationItem = {
  id: string;
  type: "DIRECT" | "GROUP" | "TERRITORY" | "ELECTION_OPERATION";
  title: string | null;
  territory: OperationalTerritory;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  members: Array<{
    userId: string;
    name: string;
    role: string;
    roleLabel: string | null;
    presence: RealtimePresenceState;
    lastSeenAt: string | null;
    lastReadAt: string | null;
  }>;
  lastMessage: ElectionDayMessageItem | null;
  unreadCount: number;
};

export type ElectionDayMessageItem = {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderName: string;
  body: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  receipts: Array<{
    userId: string;
    status: "DELIVERED" | "READ";
    deliveredAt: string | null;
    readAt: string | null;
  }>;
  attachments: Array<{
    id: string;
    evidenceAssetId: string | null;
    fileName: string | null;
    mimeType: string | null;
    fileSize: number | null;
    sha256: string | null;
  }>;
};

export type ElectionDayCallParticipantItem = {
  userId: string;
  name: string;
  role: string;
  isInitiator: boolean;
  status: VoiceCallParticipantStatus;
  invitedAt: string;
  ringingAt: string | null;
  answeredAt: string | null;
  leftAt: string | null;
  presence: RealtimePresenceState;
};

export type ElectionDayCallEventItem = {
  id: string;
  type: VoiceCallEventType;
  actorUserId: string | null;
  targetUserId: string | null;
  signalType: string | null;
  fromStatus: VoiceCallStatus | null;
  toStatus: VoiceCallStatus | null;
  occurredAt: string;
};

/**
 * Durable Election Day call record. `recording` is always "DISABLED": call media
 * is never captured, so no media reference is ever present on this contract.
 */
export type ElectionDayCallItem = {
  id: string;
  conversationId: string | null;
  initiatorUserId: string;
  initiatorName: string;
  status: VoiceCallStatus;
  endReason: VoiceCallEndReason | null;
  territory: OperationalTerritory;
  startedAt: string;
  ringingAt: string | null;
  connectedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  endedByUserId: string | null;
  recording: "DISABLED";
  participants: ElectionDayCallParticipantItem[];
  events: ElectionDayCallEventItem[];
};

export type ElectionDayTimelineItem = {
  id: string;
  type: "ALERT" | "INCIDENT" | "REPORT" | "MESSAGE" | "ACTIVITY" | "REALTIME_EVENT";
  title: string;
  detail: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null;
  pollingUnitId: string | null;
  actorUserId: string | null;
  occurredAt: string;
  metadata: Record<string, unknown> | null;
};

export type ElectionDayWebrtcConfig = {
  signalling: {
    transport: "socket.io";
    path: string;
    events: ElectionDayRealtimeEventType[];
    /** REST endpoints that own durable lifecycle transitions. */
    restLifecyclePath: string;
  };
  iceServers: Array<{
    urls: string | string[];
    username?: string;
    credential?: string;
  }>;
  /**
   * TURN relay is required for field devices behind carrier-grade NAT. When
   * false, calls still work on permissive networks but must not be assumed
   * reachable; production deployment configures a Coturn-compatible TURN URL.
   */
  turnConfigured: boolean;
  /** Calls are never recorded automatically; no media is persisted. */
  recording: "DISABLED";
  durableCallHistory: "AVAILABLE";
};

export type PlatformAuditEnvelope = {
  auditId: string;
  action: string;
  occurredAt: string;
  actorUserId: string | null;
  accountRole: TargetAuthRole | null;
  requestId: string | null;
  sessionId: string | null;
  targetType: string;
  targetId: string;
  outcome: "ALLOWED" | "DENIED" | "FAILED";
  territoryKind: TerritoryKind | null;
  territoryId: string | null;
  metadata: Record<string, unknown>;
};
