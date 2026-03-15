import type {
  AdminUserItem,
  AgentUserItem,
  AdminDashboardSummary,
  AdminMapSummary,
  AgentActivitySummary,
  AuthUserProfile,
  AuditLogItem,
  BroadcastMessageItem,
  BroadcastAudiencePreview,
  CampaignEventItem,
  CandidateProfileEditorItem,
  CandidatePublicListItem,
  CandidatePublicProfile,
  CandidateVoterItem,
  CandidateListItem,
  FieldTaskItem,
  FeedbackListItem,
  GeoPoliticalZoneItem,
  IncidentListItem,
  IncidentGovernanceSummary,
  LgaItem,
  ManagedUserItem,
  NotificationItem,
  PollingUnitItem,
  PollingUnitCoverageSummary,
  CoverageInsights,
  PoliticalPartyItem,
  PoliticalPartyPublicProfile,
  PollListItem,
  PostListItem,
  RewardBalanceSummary,
  RewardHistoryItem,
  RewardLedgerItem,
  RewardRedemptionItem,
  RewardsSummary,
  SenatorialDistrictItem,
  StateItem,
  StateConstituencyItem,
  FederalConstituencyItem,
  VoterEngagementTaskItem,
  VoterUserItem,
  WardItem,
} from "@pics-nigeria/shared";

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function getApiBaseUrl(): string {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

  if (configuredBaseUrl) {
    return normalizeBaseUrl(configuredBaseUrl);
  }

  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:4000";
  }

  throw new Error("Missing NEXT_PUBLIC_API_BASE_URL for production build.");
}

const API_BASE_URL = getApiBaseUrl();

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json();
  if (!response.ok) {
    throw new ApiError(payload.message || "Request failed.", response.status, payload);
  }
  return payload as T;
}

export async function loginUser(email: string, password: string): Promise<{ token: string; user: AuthUserProfile }> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  return readJson<{ token: string; user: AuthUserProfile }>(response);
}

export async function registerVoterUser(body: {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  voterCardNumber: string;
  stateId: string;
  lgaId: string;
  wardId: string;
  pollingUnitId: string;
  referredByCode?: string;
  acceptTerms: true;
  contactConsent: true;
  confirmAdult: true;
}): Promise<{ message: string; user: AuthUserProfile }> {
  const response = await fetch(`${API_BASE_URL}/auth/register-voter`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return readJson<{ message: string; user: AuthUserProfile }>(response);
}

export async function fetchPublicStates(): Promise<StateItem[]> {
  const response = await fetch(`${API_BASE_URL}/auth/territories/states`, {
    cache: "no-store",
  });

  const payload = await readJson<{ states: StateItem[] }>(response);
  return payload.states;
}

export async function fetchPublicLgas(stateId: string): Promise<LgaItem[]> {
  const response = await fetch(`${API_BASE_URL}/auth/territories/lgas?stateId=${encodeURIComponent(stateId)}`, {
    cache: "no-store",
  });

  const payload = await readJson<{ lgas: LgaItem[] }>(response);
  return payload.lgas;
}

export async function fetchPublicWards(stateId: string, lgaId: string): Promise<WardItem[]> {
  const query = new URLSearchParams({ stateId, lgaId });
  const response = await fetch(`${API_BASE_URL}/auth/territories/wards?${query.toString()}`, {
    cache: "no-store",
  });

  const payload = await readJson<{ wards: WardItem[] }>(response);
  return payload.wards;
}

export async function fetchPublicPollingUnits(stateId: string, lgaId: string, wardId: string): Promise<PollingUnitItem[]> {
  const query = new URLSearchParams({ stateId, lgaId, wardId });
  const response = await fetch(`${API_BASE_URL}/auth/territories/polling-units?${query.toString()}`, {
    cache: "no-store",
  });

  const payload = await readJson<{ pollingUnits: PollingUnitItem[] }>(response);
  return payload.pollingUnits;
}

export async function fetchCurrentUser(token: string): Promise<AuthUserProfile> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ user: AuthUserProfile }>(response);
  return payload.user;
}

export async function updateCurrentUserProfile(
  token: string,
  body: { name: string; email: string; phone?: string },
): Promise<{ message: string; user: AuthUserProfile }> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return readJson<{ message: string; user: AuthUserProfile }>(response);
}

export async function updateCurrentUserPassword(
  token: string,
  body: { currentPassword: string; newPassword: string },
): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/password`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return readJson<{ message: string }>(response);
}

export async function fetchVoterRewards(token: string): Promise<RewardsSummary> {
  const response = await fetch(`${API_BASE_URL}/voter/rewards`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  return readJson(response);
}

export async function fetchVoterRewardLedger(
  token: string,
): Promise<{ rewardLedger: RewardLedgerItem[]; rewardHistory: RewardHistoryItem[] }> {
  const response = await fetch(`${API_BASE_URL}/voter/reward-ledger`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  return readJson<{ rewardLedger: RewardLedgerItem[]; rewardHistory: RewardHistoryItem[] }>(response);
}

export async function fetchAdminSummary(token: string): Promise<AdminDashboardSummary> {
  const response = await fetch(`${API_BASE_URL}/admin/summary`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ summary: AdminDashboardSummary }>(response);
  return payload.summary;
}

export async function fetchAdminCandidates(token: string): Promise<CandidateListItem[]> {
  const response = await fetch(`${API_BASE_URL}/admin/candidates`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ candidates: CandidateListItem[] }>(response);
  return payload.candidates;
}

export async function fetchAdminFeedback(token: string): Promise<FeedbackListItem[]> {
  const response = await fetch(`${API_BASE_URL}/admin/feedback`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ feedback: FeedbackListItem[] }>(response);
  return payload.feedback;
}

export async function fetchAdminIncidents(token: string): Promise<IncidentListItem[]> {
  const response = await fetch(`${API_BASE_URL}/admin/incidents`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ incidents: IncidentListItem[] }>(response);
  return payload.incidents;
}

export async function fetchAdminIncidentReview(
  token: string,
  query?: { status?: string; type?: string; reviewPriority?: "ROUTINE" | "PRIORITY" | "CRITICAL"; flaggedOnly?: boolean },
): Promise<{ incidents: IncidentListItem[]; governance: IncidentGovernanceSummary }> {
  const params = new URLSearchParams();
  if (query?.status) {
    params.set("status", query.status);
  }
  if (query?.type) {
    params.set("type", query.type);
  }
  if (query?.reviewPriority) {
    params.set("reviewPriority", query.reviewPriority);
  }
  if (query?.flaggedOnly !== undefined) {
    params.set("flaggedOnly", String(query.flaggedOnly));
  }

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`${API_BASE_URL}/admin/incidents${suffix}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  return readJson<{ incidents: IncidentListItem[]; governance: IncidentGovernanceSummary }>(response);
}

export async function fetchAdminAgentActivitySummaries(token: string): Promise<AgentActivitySummary[]> {
  const response = await fetch(`${API_BASE_URL}/admin/agent-activity-summaries`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ agentActivitySummaries: AgentActivitySummary[] }>(response);
  return payload.agentActivitySummaries;
}

export async function fetchAdminPollingUnitCoverage(token: string): Promise<PollingUnitCoverageSummary> {
  const response = await fetch(`${API_BASE_URL}/admin/polling-unit-coverage`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ coverage: PollingUnitCoverageSummary }>(response);
  return payload.coverage;
}

export async function fetchAdminCoverageInsights(token: string): Promise<CoverageInsights> {
  const response = await fetch(`${API_BASE_URL}/admin/coverage-insights`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ insights: CoverageInsights }>(response);
  return payload.insights;
}

export async function fetchAdminMapSummary(token: string): Promise<AdminMapSummary> {
  const response = await fetch(`${API_BASE_URL}/admin/map-summary`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ mapSummary: AdminMapSummary }>(response);
  return payload.mapSummary;
}

export async function fetchAdminAnalytics(token: string) {
  const response = await fetch(`${API_BASE_URL}/admin/analytics`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ analytics: {
    incidentCountsByType: Record<string, number>;
    incidentCountsBySeverity: Record<string, number>;
    incidentCountsByStatus: Record<string, number>;
    agentActivitiesByType: Record<string, number>;
    rewardTotalsByType: Record<string, number>;
    pollResponseTotalsByPoll: Array<{ pollId: string; title: string; responses: number }>;
    voterRegistrationsOverTime: Record<string, number>;
  } }>(response);
  return payload.analytics;
}

export async function fetchAdminRedemptions(token: string): Promise<RewardRedemptionItem[]> {
  const response = await fetch(`${API_BASE_URL}/admin/redemptions`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ redemptions: RewardRedemptionItem[] }>(response);
  return payload.redemptions;
}

export async function fetchAdminRewardLedger(
  token: string,
): Promise<{ rewardLedger: RewardLedgerItem[]; rewardHistory: RewardHistoryItem[] }> {
  const response = await fetch(`${API_BASE_URL}/admin/reward-ledger`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  return readJson<{ rewardLedger: RewardLedgerItem[]; rewardHistory: RewardHistoryItem[] }>(response);
}

export async function fetchAdminTasks(token: string): Promise<FieldTaskItem[]> {
  const response = await fetch(`${API_BASE_URL}/admin/tasks`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ tasks: FieldTaskItem[] }>(response);
  return payload.tasks;
}

export async function fetchAdminBroadcasts(token: string): Promise<BroadcastMessageItem[]> {
  const response = await fetch(`${API_BASE_URL}/admin/broadcasts`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ broadcasts: BroadcastMessageItem[] }>(response);
  return payload.broadcasts;
}

export async function fetchAdminEngagementTasks(token: string): Promise<VoterEngagementTaskItem[]> {
  const response = await fetch(`${API_BASE_URL}/admin/engagement-tasks`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ tasks: VoterEngagementTaskItem[] }>(response);
  return payload.tasks;
}

export async function fetchGeoPoliticalZones(token: string): Promise<GeoPoliticalZoneItem[]> {
  const response = await fetch(`${API_BASE_URL}/admin/geo-political-zones`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ zones: GeoPoliticalZoneItem[] }>(response);
  return payload.zones;
}

export async function fetchStates(token: string, geoPoliticalZoneId?: string): Promise<StateItem[]> {
  const query = geoPoliticalZoneId ? `?geoPoliticalZoneId=${encodeURIComponent(geoPoliticalZoneId)}` : "";
  const response = await fetch(`${API_BASE_URL}/admin/states${query}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ states: StateItem[] }>(response);
  return payload.states;
}

export async function fetchSenatorialDistricts(token: string, stateId: string): Promise<SenatorialDistrictItem[]> {
  const response = await fetch(`${API_BASE_URL}/admin/senatorial-districts?stateId=${encodeURIComponent(stateId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ districts: SenatorialDistrictItem[] }>(response);
  return payload.districts;
}

export async function fetchFederalConstituencies(
  token: string,
  stateId: string,
  senatorialDistrictId?: string,
): Promise<FederalConstituencyItem[]> {
  const query = new URLSearchParams({ stateId });
  if (senatorialDistrictId) {
    query.set("senatorialDistrictId", senatorialDistrictId);
  }

  const response = await fetch(`${API_BASE_URL}/admin/federal-constituencies?${query.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ constituencies: FederalConstituencyItem[] }>(response);
  return payload.constituencies;
}

export async function fetchLgas(token: string, stateId: string): Promise<LgaItem[]> {
  const response = await fetch(`${API_BASE_URL}/admin/lgas?stateId=${encodeURIComponent(stateId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ lgas: LgaItem[] }>(response);
  return payload.lgas;
}

export async function fetchWards(token: string, stateId: string, lgaId?: string): Promise<WardItem[]> {
  const query = new URLSearchParams({ stateId });
  if (lgaId) {
    query.set("lgaId", lgaId);
  }

  const response = await fetch(`${API_BASE_URL}/admin/wards?${query.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ wards: WardItem[] }>(response);
  return payload.wards;
}

export async function fetchStateConstituencies(token: string, stateId: string, lgaId?: string): Promise<StateConstituencyItem[]> {
  const query = new URLSearchParams({ stateId });
  if (lgaId) {
    query.set("lgaId", lgaId);
  }

  const response = await fetch(`${API_BASE_URL}/admin/state-constituencies?${query.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ constituencies: StateConstituencyItem[] }>(response);
  return payload.constituencies;
}

export async function fetchPollingUnits(token: string, stateId: string, lgaId: string, wardId?: string): Promise<PollingUnitItem[]> {
  const query = new URLSearchParams({ stateId, lgaId });
  if (wardId) {
    query.set("wardId", wardId);
  }

  const response = await fetch(`${API_BASE_URL}/admin/polling-units?${query.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ pollingUnits: PollingUnitItem[] }>(response);
  return payload.pollingUnits;
}

export async function fetchAdminUsers(token: string, stateId: string, lgaId?: string): Promise<AdminUserItem[]> {
  const query = new URLSearchParams();
  if (stateId) {
    query.set("stateId", stateId);
  }
  if (lgaId) {
    query.set("lgaId", lgaId);
  }

  const response = await fetch(`${API_BASE_URL}/admin/admin-users?${query.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ adminUsers: AdminUserItem[] }>(response);
  return payload.adminUsers;
}

export async function fetchManagedUsers(
  token: string,
  query?: {
    role?: "ADMIN" | "CANDIDATE" | "AGENT" | "VOTER";
    isActive?: boolean;
    search?: string;
    stateId?: string;
    lgaId?: string;
    wardId?: string;
    limit?: number;
  },
): Promise<ManagedUserItem[]> {
  const params = new URLSearchParams();
  if (query?.role) {
    params.set("role", query.role);
  }
  if (query?.isActive !== undefined) {
    params.set("isActive", String(query.isActive));
  }
  if (query?.search) {
    params.set("search", query.search);
  }
  if (query?.stateId) {
    params.set("stateId", query.stateId);
  }
  if (query?.lgaId) {
    params.set("lgaId", query.lgaId);
  }
  if (query?.wardId) {
    params.set("wardId", query.wardId);
  }
  if (query?.limit) {
    params.set("limit", String(query.limit));
  }

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`${API_BASE_URL}/admin/users/manage${suffix}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ users: ManagedUserItem[] }>(response);
  return payload.users;
}

export async function fetchAgents(token: string): Promise<AgentUserItem[]> {
  const response = await fetch(`${API_BASE_URL}/admin/agents`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ agents: AgentUserItem[] }>(response);
  return payload.agents;
}

export async function fetchVoters(token: string): Promise<VoterUserItem[]> {
  const response = await fetch(`${API_BASE_URL}/admin/voters`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ voters: VoterUserItem[] }>(response);
  return payload.voters;
}

export async function downloadSuperAdminVoterContacts(token: string): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/admin/voters/export`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    let message = "Request failed.";

    try {
      const payload = await response.json();
      message = payload.message || message;
      throw new ApiError(message, response.status, payload);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(message, response.status);
    }
  }

  return response.blob();
}

export async function createGeoPoliticalZone(token: string, body: { id: string; name: string }) {
  const response = await fetch(`${API_BASE_URL}/admin/geo-political-zones`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return readJson(response);
}

export async function updateGeoPoliticalZone(token: string, zoneId: string, body: { name: string }) {
  const response = await fetch(`${API_BASE_URL}/admin/geo-political-zones/${zoneId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return readJson(response);
}

export async function deleteGeoPoliticalZone(token: string, zoneId: string) {
  const response = await fetch(`${API_BASE_URL}/admin/geo-political-zones/${zoneId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  return readJson(response);
}

export async function fetchPoliticalParties(token: string): Promise<PoliticalPartyItem[]> {
  const response = await fetch(`${API_BASE_URL}/admin/political-parties`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ parties: PoliticalPartyItem[] }>(response);
  return payload.parties;
}

export async function createAdminUser(token: string, body: {
  name: string;
  email: string;
  password: string;
  adminLevel: "NATIONAL" | "GEO_POLITICAL_ZONE" | "STATE" | "SENATORIAL" | "FEDERAL_CONSTITUENCY" | "STATE_CONSTITUENCY" | "LGA" | "WARD";
  politicalPartyId?: string;
  geoPoliticalZoneId?: string;
  stateId?: string;
  senatorialDistrictId?: string;
  federalConstituencyId?: string;
  lgaId?: string;
  wardId?: string;
  stateConstituencyId?: string;
}) {
  const response = await fetch(`${API_BASE_URL}/admin/users`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return readJson<{ message: string; user: AuthUserProfile | null }>(response);
}

export async function createPoliticalParty(token: string, body: {
  id: string;
  code: string;
  name: string;
  logoUrl?: string;
  description?: string;
  officialWebsite?: string;
  isApprovedByInec?: boolean;
  inecSourceUrl?: string;
}) {
  const response = await fetch(`${API_BASE_URL}/admin/political-parties`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return readJson(response);
}

export async function createCandidate(token: string, body: {
  name: string;
  email: string;
  password: string;
  officeType: "PRESIDENTIAL" | "GOVERNORSHIP" | "SENATE" | "HOUSE_OF_REP" | "STATE_ASSEMBLY" | "CHAIRMANSHIP" | "COUNCILLOR";
  politicalPartyId?: string;
  geoPoliticalZoneId?: string;
  stateId?: string;
  senatorialDistrictId?: string;
  federalConstituencyId?: string;
  lgaId?: string;
  wardId?: string;
  stateConstituencyId?: string;
}) {
  const response = await fetch(`${API_BASE_URL}/admin/candidates`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return readJson<{ message: string; user: AuthUserProfile | null }>(response);
}

export async function createAgent(token: string, body: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  politicalPartyId?: string;
  stateId: string;
  senatorialDistrictId?: string;
  federalConstituencyId?: string;
  lgaId: string;
  wardId: string;
  stateConstituencyId?: string;
  pollingUnitId?: string;
  assignedAdminUserId?: string;
}) {
  const response = await fetch(`${API_BASE_URL}/admin/agents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return readJson<{ message: string; user: AuthUserProfile | null }>(response);
}

export async function createAdminTask(token: string, body: {
  title: string;
  description: string;
  assignedToUserId: string;
  incidentId?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  dueAt?: string;
}) {
  const response = await fetch(`${API_BASE_URL}/admin/tasks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return readJson<{ message: string; task: FieldTaskItem }>(response);
}

export async function createAdminBulkTasks(token: string, body: {
  title: string;
  description: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  dueAt?: string;
  agentUserIds?: string[];
  stateId?: string;
  senatorialDistrictId?: string;
  federalConstituencyId?: string;
  lgaId?: string;
  wardId?: string;
  stateConstituencyId?: string;
  pollingUnitId?: string;
}) {
  const response = await fetch(`${API_BASE_URL}/admin/tasks/bulk`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return readJson<{ message: string; count: number; tasks: FieldTaskItem[] }>(response);
}

export async function createAdminBroadcast(token: string, body: {
  title: string;
  message: string;
  audience: "ALL" | "ADMINS" | "AGENTS" | "VOTERS" | "CANDIDATES";
  taskStatus?: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
  politicalPartyId?: string;
  adminLevel?: "NATIONAL" | "GEO_POLITICAL_ZONE" | "STATE" | "SENATORIAL" | "FEDERAL_CONSTITUENCY" | "STATE_CONSTITUENCY" | "LGA" | "WARD";
  officeType?: "PRESIDENTIAL" | "GOVERNORSHIP" | "SENATE" | "HOUSE_OF_REP" | "STATE_ASSEMBLY" | "CHAIRMANSHIP" | "COUNCILLOR";
  geoPoliticalZoneId?: string;
  stateId?: string;
  senatorialDistrictId?: string;
  federalConstituencyId?: string;
  lgaId?: string;
  wardId?: string;
  stateConstituencyId?: string;
  pollingUnitId?: string;
}) {
  const response = await fetch(`${API_BASE_URL}/admin/broadcasts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return readJson<{ message: string; broadcast: BroadcastMessageItem }>(response);
}

export async function previewAdminBroadcast(token: string, body: {
  title: string;
  message: string;
  audience: "ALL" | "ADMINS" | "AGENTS" | "VOTERS" | "CANDIDATES";
  taskStatus?: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
  politicalPartyId?: string;
  adminLevel?: "NATIONAL" | "GEO_POLITICAL_ZONE" | "STATE" | "SENATORIAL" | "FEDERAL_CONSTITUENCY" | "STATE_CONSTITUENCY" | "LGA" | "WARD";
  officeType?: "PRESIDENTIAL" | "GOVERNORSHIP" | "SENATE" | "HOUSE_OF_REP" | "STATE_ASSEMBLY" | "CHAIRMANSHIP" | "COUNCILLOR";
  geoPoliticalZoneId?: string;
  stateId?: string;
  senatorialDistrictId?: string;
  federalConstituencyId?: string;
  lgaId?: string;
  wardId?: string;
  stateConstituencyId?: string;
  pollingUnitId?: string;
}) {
  const response = await fetch(`${API_BASE_URL}/admin/broadcasts/preview`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return readJson<{ preview: BroadcastAudiencePreview }>(response);
}

export async function createAdminEngagementTask(token: string, body: {
  title: string;
  description: string;
  type: "REGISTRATION" | "REFERRAL" | "POLL_RESPONSE";
  rewardPoints: number;
  targetCount?: number;
  geoPoliticalZoneId?: string;
  stateId?: string;
  senatorialDistrictId?: string;
  federalConstituencyId?: string;
  lgaId?: string;
  wardId?: string;
  stateConstituencyId?: string;
  pollingUnitId?: string;
}) {
  const response = await fetch(`${API_BASE_URL}/admin/engagement-tasks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return readJson<{ message: string; task: VoterEngagementTaskItem }>(response);
}

export async function updateAdminTask(token: string, taskId: string, body: {
  status?: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
  priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  dueAt?: string | null;
  resolutionNote?: string | null;
}) {
  const response = await fetch(`${API_BASE_URL}/admin/tasks/${taskId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return readJson<{ message: string; task: FieldTaskItem }>(response);
}

export async function updateAdminUser(token: string, userId: string, body: {
  name: string;
  adminLevel: "NATIONAL" | "GEO_POLITICAL_ZONE" | "STATE" | "SENATORIAL" | "FEDERAL_CONSTITUENCY" | "STATE_CONSTITUENCY" | "LGA" | "WARD";
  politicalPartyId?: string;
  geoPoliticalZoneId?: string;
  stateId?: string;
  senatorialDistrictId?: string;
  federalConstituencyId?: string;
  lgaId?: string;
  wardId?: string;
  stateConstituencyId?: string;
}) {
  const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return readJson<{ message: string; user: AuthUserProfile | null }>(response);
}

export async function updateCandidate(token: string, userId: string, body: {
  name: string;
  officeType: "PRESIDENTIAL" | "GOVERNORSHIP" | "SENATE" | "HOUSE_OF_REP" | "STATE_ASSEMBLY" | "CHAIRMANSHIP" | "COUNCILLOR";
  politicalPartyId?: string;
  geoPoliticalZoneId?: string;
  stateId?: string;
  senatorialDistrictId?: string;
  federalConstituencyId?: string;
  lgaId?: string;
  wardId?: string;
  stateConstituencyId?: string;
}) {
  const response = await fetch(`${API_BASE_URL}/admin/candidates/${userId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return readJson<{ message: string; user: AuthUserProfile | null }>(response);
}

export async function updateAgent(token: string, userId: string, body: {
  name: string;
  phone?: string;
  politicalPartyId?: string;
  stateId: string;
  senatorialDistrictId?: string;
  federalConstituencyId?: string;
  lgaId: string;
  wardId: string;
  stateConstituencyId?: string;
  pollingUnitId?: string;
  assignedAdminUserId?: string;
}) {
  const response = await fetch(`${API_BASE_URL}/admin/agents/${userId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return readJson<{ message: string; user: AuthUserProfile | null }>(response);
}

export async function setUserActivation(
  token: string,
  userId: string,
  isActive: boolean,
): Promise<{ message: string; user: AuthUserProfile | null }> {
  const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/deactivation`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ isActive }),
  });

  return readJson(response);
}

export async function updatePoliticalParty(token: string, partyId: string, body: {
  code: string;
  name: string;
  logoUrl?: string;
  description?: string;
  officialWebsite?: string;
  isApprovedByInec?: boolean;
  inecSourceUrl?: string;
}) {
  const response = await fetch(`${API_BASE_URL}/admin/political-parties/${partyId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return readJson(response);
}

export async function deletePoliticalParty(token: string, partyId: string) {
  const response = await fetch(`${API_BASE_URL}/admin/political-parties/${partyId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  return readJson(response);
}

export async function fetchAuditLogs(
  token: string,
  query?: { actorUserId?: string; action?: string; targetType?: string },
): Promise<AuditLogItem[]> {
  const params = new URLSearchParams();
  if (query?.actorUserId) {
    params.set("actorUserId", query.actorUserId);
  }
  if (query?.action) {
    params.set("action", query.action);
  }
  if (query?.targetType) {
    params.set("targetType", query.targetType);
  }

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`${API_BASE_URL}/admin/audit-logs${suffix}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ auditLogs: AuditLogItem[] }>(response);
  return payload.auditLogs;
}

export async function fetchCandidatePosts(token: string): Promise<PostListItem[]> {
  const response = await fetch(`${API_BASE_URL}/candidate/posts`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ posts: PostListItem[] }>(response);
  return payload.posts;
}

export async function fetchCandidateProfileEditor(token: string): Promise<CandidateProfileEditorItem> {
  const response = await fetch(`${API_BASE_URL}/candidate/profile`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ profile: CandidateProfileEditorItem }>(response);
  return payload.profile;
}

export async function updateCandidateProfile(
  token: string,
  body: {
    portraitAssetId?: string;
    portraitUrl?: string;
    campaignSlogan?: string;
    bio?: string;
    websiteUrl?: string;
    facebookUrl?: string;
    instagramUrl?: string;
    xUrl?: string;
    isProfilePublished: boolean;
  },
) {
  const response = await fetch(`${API_BASE_URL}/candidate/profile`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return readJson<{ message: string; profile: CandidateProfileEditorItem }>(response);
}

export async function uploadCandidateImage(
  token: string,
  kind: "profile-photo" | "event-cover",
  file: File,
): Promise<{ message: string; asset: { id: string; fileName: string; fileUrl: string | null } }> {
  const response = await fetch(`${API_BASE_URL}/candidate/assets/${kind}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": file.type,
      "X-File-Name": file.name,
    },
    body: file,
  });

  return readJson<{ message: string; asset: { id: string; fileName: string; fileUrl: string | null } }>(response);
}

export async function deleteManagedUser(
  token: string,
  userId: string,
): Promise<{ message: string; dependencyCounts?: Record<string, number> }> {
  const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  return readJson<{ message: string; dependencyCounts?: Record<string, number> }>(response);
}

export async function fetchCandidateVoters(token: string): Promise<CandidateVoterItem[]> {
  const response = await fetch(`${API_BASE_URL}/candidate/voters`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ voters: CandidateVoterItem[] }>(response);
  return payload.voters;
}

export async function fetchCandidateBroadcasts(token: string): Promise<BroadcastMessageItem[]> {
  const response = await fetch(`${API_BASE_URL}/candidate/broadcasts`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ broadcasts: BroadcastMessageItem[] }>(response);
  return payload.broadcasts;
}

export async function fetchCandidateEvents(token: string): Promise<CampaignEventItem[]> {
  const response = await fetch(`${API_BASE_URL}/candidate/events`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ events: CampaignEventItem[] }>(response);
  return payload.events;
}

export async function createCandidateBroadcast(
  token: string,
  body: { title: string; message: string },
): Promise<{ message: string; broadcast: BroadcastMessageItem }> {
  const response = await fetch(`${API_BASE_URL}/candidate/broadcasts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return readJson<{ message: string; broadcast: BroadcastMessageItem }>(response);
}

export async function createCandidatePost(
  token: string,
  body: {
    title: string;
    content: string;
    mediaType?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
    mediaUrl?: string;
    thumbnailUrl?: string;
    isPublished?: boolean;
    audience?: "VOTERS" | "AGENTS" | "ALL";
  },
): Promise<{ message: string; post: PostListItem }> {
  const response = await fetch(`${API_BASE_URL}/candidate/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return readJson<{ message: string; post: PostListItem }>(response);
}

export async function createCandidateEvent(
  token: string,
  body: {
    title: string;
    description: string;
    venue: string;
    coverImageAssetId?: string;
    stateId?: string;
    lgaId?: string;
    wardId?: string;
    pollingUnitId?: string;
    startsAt: string;
    endsAt?: string;
    isPublished?: boolean;
  },
) {
  const response = await fetch(`${API_BASE_URL}/candidate/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return readJson<{ message: string; event: CampaignEventItem }>(response);
}

export async function updateCandidateEvent(
  token: string,
  eventId: string,
  body: {
    title?: string;
    description?: string;
    venue?: string;
    coverImageAssetId?: string;
    stateId?: string;
    lgaId?: string;
    wardId?: string;
    pollingUnitId?: string;
    startsAt?: string;
    endsAt?: string | null;
    isPublished?: boolean;
  },
) {
  const response = await fetch(`${API_BASE_URL}/candidate/events/${eventId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return readJson<{ message: string; event: CampaignEventItem }>(response);
}

export async function deleteCandidateEvent(token: string, eventId: string) {
  const response = await fetch(`${API_BASE_URL}/candidate/events/${eventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  return readJson<{ message: string }>(response);
}

export async function updateCandidatePost(
  token: string,
  postId: string,
  body: {
    title?: string;
    content?: string;
    mediaType?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
    mediaUrl?: string;
    thumbnailUrl?: string;
    isPublished?: boolean;
  },
) {
  const response = await fetch(`${API_BASE_URL}/candidate/posts/${postId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return readJson<{ message: string; post: PostListItem }>(response);
}

export async function deleteCandidatePost(token: string, postId: string) {
  const response = await fetch(`${API_BASE_URL}/candidate/posts/${postId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  return readJson<{ message: string }>(response);
}

export async function fetchCandidateFeedback(
  token: string,
): Promise<{ totalFeedback: number; feedback: FeedbackListItem[] }> {
  const response = await fetch(`${API_BASE_URL}/candidate/feedback`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  return readJson(response);
}

export async function fetchCandidateIncidents(
  token: string,
): Promise<{ totalIncidents: number; incidents: IncidentListItem[] }> {
  const response = await fetch(`${API_BASE_URL}/candidate/incidents`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  return readJson<{ totalIncidents: number; incidents: IncidentListItem[] }>(response);
}

export async function fetchCandidateAgentActivitySummaries(token: string): Promise<AgentActivitySummary[]> {
  const response = await fetch(`${API_BASE_URL}/candidate/agent-activity-summaries`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ agentActivitySummaries: AgentActivitySummary[] }>(response);
  return payload.agentActivitySummaries;
}

export async function fetchCandidateMapSummary(token: string): Promise<AdminMapSummary> {
  const response = await fetch(`${API_BASE_URL}/candidate/map-summary`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ mapSummary: AdminMapSummary }>(response);
  return payload.mapSummary;
}

export async function fetchNotifications(token: string): Promise<NotificationItem[]> {
  const response = await fetch(`${API_BASE_URL}/notifications`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ notifications: NotificationItem[] }>(response);
  return payload.notifications;
}

export async function markAllNotificationsRead(token: string) {
  const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });

  return readJson(response);
}

export async function fetchVoterPolls(token: string): Promise<PollListItem[]> {
  const response = await fetch(`${API_BASE_URL}/voter/polls`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ polls: PollListItem[] }>(response);
  return payload.polls;
}

export async function fetchVoterPosts(token: string): Promise<PostListItem[]> {
  const response = await fetch(`${API_BASE_URL}/voter/posts`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ posts: PostListItem[] }>(response);
  return payload.posts;
}

export async function fetchVoterEvents(token: string): Promise<CampaignEventItem[]> {
  const response = await fetch(`${API_BASE_URL}/voter/events`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ events: CampaignEventItem[] }>(response);
  return payload.events;
}

export async function fetchPublicCandidates(query?: {
  search?: string;
  stateId?: string;
  partyId?: string;
  officeType?: "PRESIDENTIAL" | "GOVERNORSHIP" | "SENATE" | "HOUSE_OF_REP" | "STATE_ASSEMBLY" | "CHAIRMANSHIP" | "COUNCILLOR";
}): Promise<CandidatePublicListItem[]> {
  const params = new URLSearchParams();
  if (query?.search) {
    params.set("search", query.search);
  }
  if (query?.stateId) {
    params.set("stateId", query.stateId);
  }
  if (query?.partyId) {
    params.set("partyId", query.partyId);
  }
  if (query?.officeType) {
    params.set("officeType", query.officeType);
  }

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`${API_BASE_URL}/candidate/public${suffix}`, {
    cache: "no-store",
  });

  const payload = await readJson<{ candidates: CandidatePublicListItem[] }>(response);
  return payload.candidates;
}

export async function fetchPublicCandidateProfile(candidateUserId: string): Promise<CandidatePublicProfile> {
  const response = await fetch(`${API_BASE_URL}/candidate/public/${candidateUserId}`, {
    cache: "no-store",
  });

  const payload = await readJson<{ candidate: CandidatePublicProfile }>(response);
  return payload.candidate;
}

export async function fetchPublicParties(query?: { search?: string }): Promise<PoliticalPartyItem[]> {
  const params = new URLSearchParams();
  if (query?.search) {
    params.set("search", query.search);
  }

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`${API_BASE_URL}/candidate/public/parties${suffix}`, {
    cache: "no-store",
  });

  const payload = await readJson<{ parties: PoliticalPartyItem[] }>(response);
  return payload.parties;
}

export async function fetchPublicPartyProfile(partyId: string): Promise<PoliticalPartyPublicProfile> {
  const response = await fetch(`${API_BASE_URL}/candidate/public/parties/${partyId}`, {
    cache: "no-store",
  });

  const payload = await readJson<{ party: PoliticalPartyPublicProfile }>(response);
  return payload.party;
}

export async function fetchVoterEngagementTasks(token: string): Promise<VoterEngagementTaskItem[]> {
  const response = await fetch(`${API_BASE_URL}/voter/engagement-tasks`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ tasks: VoterEngagementTaskItem[] }>(response);
  return payload.tasks;
}

export async function rsvpToCampaignEvent(
  token: string,
  eventId: string,
  body: { status: "INTERESTED" | "GOING" },
) {
  const response = await fetch(`${API_BASE_URL}/voter/events/${eventId}/rsvp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return readJson<{ message: string; event: CampaignEventItem | null }>(response);
}

export async function claimVoterEngagementTask(token: string, taskId: string) {
  const response = await fetch(`${API_BASE_URL}/voter/engagement-tasks/${taskId}/claim`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  return readJson<{ message: string }>(response);
}

export async function fetchVoterRedemptions(
  token: string,
): Promise<{ balance: RewardBalanceSummary; redemptions: RewardRedemptionItem[] }> {
  const response = await fetch(`${API_BASE_URL}/voter/redemptions`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  return readJson(response);
}

export async function createVoterRedemption(
  token: string,
  body: { pointsRequested: number; amountRequested?: number; note?: string },
) {
  const response = await fetch(`${API_BASE_URL}/voter/redemptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return readJson(response);
}

export async function fetchAgentActivities(token: string): Promise<Array<{
  id: string;
  type: string;
  note: string | null;
  createdAt: string;
  latitude: number | null;
  longitude: number | null;
  pollingUnitId: string | null;
}>> {
  const response = await fetch(`${API_BASE_URL}/agent/activities`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ activities: Array<{
    id: string;
    type: string;
    note: string | null;
    createdAt: string;
    latitude: number | null;
    longitude: number | null;
    pollingUnitId: string | null;
  }> }>(response);
  return payload.activities;
}

export async function fetchAgentTasks(token: string): Promise<FieldTaskItem[]> {
  const response = await fetch(`${API_BASE_URL}/agent/tasks`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await readJson<{ tasks: FieldTaskItem[] }>(response);
  return payload.tasks;
}

export async function createAgentActivity(
  token: string,
  path: "check-in" | "check-out" | "location",
  body: {
    latitude?: number;
    longitude?: number;
    accuracyMeters?: number;
    note?: string;
    pollingUnitId?: string;
  },
) {
  const response = await fetch(`${API_BASE_URL}/agent/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return readJson(response);
}

export async function createAgentIncident(
  token: string,
  body: {
    type: string;
    title: string;
    description: string;
    severity: string;
    pollingUnitId?: string;
    latitude?: number;
    longitude?: number;
  },
) {
  const response = await fetch(`${API_BASE_URL}/agent/incidents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return readJson(response);
}

export async function updateAgentTask(token: string, taskId: string, body: {
  status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
  resolutionNote?: string;
}) {
  const response = await fetch(`${API_BASE_URL}/agent/tasks/${taskId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return readJson<{ message: string; task: FieldTaskItem }>(response);
}
