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

export const EVIDENCE_TYPES = ["PHOTO", "VIDEO", "WRITTEN_REPORT"] as const;

export const EVIDENCE_REVIEW_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "VERIFIED",
  "DISPUTED",
  "REQUIRES_CLARIFICATION",
  "ARCHIVED",
] as const;

export type TargetAuthRole = (typeof TARGET_AUTH_ROLES)[number];
export type TargetAccountStatus = (typeof TARGET_ACCOUNT_STATUSES)[number];
export type CoordinatorLevel = (typeof COORDINATOR_LEVELS)[number];
export type TerritoryKind = (typeof TERRITORY_KINDS)[number];
export type Phase1AuthAction = (typeof PHASE_1_AUTH_ACTIONS)[number];
export type VoterVerificationStatus = (typeof VOTER_VERIFICATION_STATUSES)[number];
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];
export type RewardEventType = (typeof REWARD_EVENT_TYPES)[number];
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];
export type PollingUnitOperationalStatus = (typeof POLLING_UNIT_OPERATIONAL_STATUSES)[number];
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];
export type EvidenceReviewStatus = (typeof EVIDENCE_REVIEW_STATUSES)[number];

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
