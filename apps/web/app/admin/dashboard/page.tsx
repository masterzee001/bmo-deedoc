"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  ADMIN_LEVELS,
  CANDIDATE_OFFICE_TYPES,
} from "@pics-nigeria/shared";
import type {
  AdminUserItem,
  AdminDashboardSummary,
  AgentActivitySummary,
  AgentUserItem,
  AuthUserProfile,
  CandidateListItem,
  FeedbackListItem,
  FederalConstituencyItem,
  GeoPoliticalZoneItem,
  IncidentListItem,
  LgaItem,
  ManagedUserItem,
  NotificationItem,
  PollingUnitItem,
  PollingUnitCoverageSummary,
  PoliticalPartyItem,
  RewardRedemptionItem,
  SenatorialDistrictItem,
  StateItem,
  StateConstituencyItem,
  VoterUserItem,
  WardItem,
} from "@pics-nigeria/shared";
import {
  ApiError,
  createAdminUser,
  createAgent,
  createCandidate,
  createGeoPoliticalZone,
  createPoliticalParty,
  deleteGeoPoliticalZone,
  deletePoliticalParty,
  fetchAdminAgentActivitySummaries,
  fetchAdminAnalytics,
  fetchAdminUsers,
  fetchAdminCandidates,
  fetchAdminFeedback,
  fetchAdminIncidents,
  fetchAdminPollingUnitCoverage,
  fetchAdminRedemptions,
  fetchAdminSummary,
  fetchCurrentUser,
  fetchManagedUsers,
  fetchAgents,
  fetchFederalConstituencies,
  fetchGeoPoliticalZones,
  fetchLgas,
  fetchNotifications,
  fetchPollingUnits,
  fetchPoliticalParties,
  fetchSenatorialDistricts,
  fetchStates,
  fetchStateConstituencies,
  fetchVoters,
  fetchWards,
  setUserActivation,
  updateAdminUser,
  updateAgent,
  updateCandidate,
  updateGeoPoliticalZone,
  updatePoliticalParty,
} from "../../../lib/api";

type DependencyCounts = Record<string, number>;

function formatDependencyCounts(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "";
  }

  const entries = Object.entries(value as DependencyCounts).filter(([, count]) => typeof count === "number" && count > 0);
  if (entries.length === 0) {
    return "";
  }

  return entries
    .map(([key, count]) => `${key.replace(/([A-Z])/g, " $1").toLowerCase()}: ${count}`)
    .join(", ");
}

export default function AdminDashboardPage() {
  const adminLevelOptions: Array<(typeof ADMIN_LEVELS)[number]> = [
    "NATIONAL",
    "GEO_POLITICAL_ZONE",
    "STATE",
    "SENATORIAL",
    "FEDERAL_CONSTITUENCY",
    "STATE_CONSTITUENCY",
    "LGA",
    "WARD",
  ];
  const candidateOfficeOptions: Array<(typeof CANDIDATE_OFFICE_TYPES)[number]> = [
    "PRESIDENTIAL",
    "GOVERNORSHIP",
    "SENATE",
    "HOUSE_OF_REP",
    "STATE_ASSEMBLY",
    "CHAIRMANSHIP",
    "COUNCILLOR",
  ];
  const [user, setUser] = useState<AuthUserProfile | null>(null);
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [candidates, setCandidates] = useState<CandidateListItem[]>([]);
  const [feedback, setFeedback] = useState<FeedbackListItem[]>([]);
  const [incidents, setIncidents] = useState<IncidentListItem[]>([]);
  const [agentSummaries, setAgentSummaries] = useState<AgentActivitySummary[]>([]);
  const [coverage, setCoverage] = useState<PollingUnitCoverageSummary | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [redemptions, setRedemptions] = useState<RewardRedemptionItem[]>([]);
  const [zones, setZones] = useState<GeoPoliticalZoneItem[]>([]);
  const [parties, setParties] = useState<PoliticalPartyItem[]>([]);
  const [states, setStates] = useState<StateItem[]>([]);
  const [districts, setDistricts] = useState<SenatorialDistrictItem[]>([]);
  const [federalConstituencies, setFederalConstituencies] = useState<FederalConstituencyItem[]>([]);
  const [lgas, setLgas] = useState<LgaItem[]>([]);
  const [wards, setWards] = useState<WardItem[]>([]);
  const [pollingUnits, setPollingUnits] = useState<PollingUnitItem[]>([]);
  const [stateConstituencies, setStateConstituencies] = useState<StateConstituencyItem[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUserItem[]>([]);
  const [agents, setAgents] = useState<AgentUserItem[]>([]);
  const [managedUsers, setManagedUsers] = useState<ManagedUserItem[]>([]);
  const [voters, setVoters] = useState<VoterUserItem[]>([]);
  const [analytics, setAnalytics] = useState<{
    incidentCountsByType: Record<string, number>;
    incidentCountsBySeverity: Record<string, number>;
    incidentCountsByStatus: Record<string, number>;
    agentActivitiesByType: Record<string, number>;
    rewardTotalsByType: Record<string, number>;
    pollResponseTotalsByPoll: Array<{ pollId: string; title: string; responses: number }>;
    voterRegistrationsOverTime: Record<string, number>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adminMessage, setAdminMessage] = useState("");
  const [zoneForm, setZoneForm] = useState({ id: "", name: "" });
  const [partyForm, setPartyForm] = useState({ id: "", code: "", name: "" });
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [editingPartyId, setEditingPartyId] = useState<string | null>(null);
  const [zoneEditForm, setZoneEditForm] = useState({ name: "" });
  const [partyEditForm, setPartyEditForm] = useState({ code: "", name: "" });
  const [adminCreateForm, setAdminCreateForm] = useState({
    name: "",
    email: "",
    password: "",
    adminLevel: "STATE" as (typeof ADMIN_LEVELS)[number],
    geoPoliticalZoneId: "",
    stateId: "",
    senatorialDistrictId: "",
    federalConstituencyId: "",
    lgaId: "",
    wardId: "",
    stateConstituencyId: "",
  });
  const [candidateCreateForm, setCandidateCreateForm] = useState({
    name: "",
    email: "",
    password: "",
    officeType: "GOVERNORSHIP" as (typeof CANDIDATE_OFFICE_TYPES)[number],
    politicalPartyId: "",
    geoPoliticalZoneId: "",
    stateId: "",
    senatorialDistrictId: "",
    federalConstituencyId: "",
    lgaId: "",
    wardId: "",
    stateConstituencyId: "",
  });
  const [agentCreateForm, setAgentCreateForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    stateId: "",
    lgaId: "",
    wardId: "",
    pollingUnitId: "",
    assignedAdminUserId: "",
  });
  const [editingAdminUserId, setEditingAdminUserId] = useState<string | null>(null);
  const [editingCandidateUserId, setEditingCandidateUserId] = useState<string | null>(null);
  const [editingAgentUserId, setEditingAgentUserId] = useState<string | null>(null);
  const partyNames = new Map(parties.map((party) => [party.id, party.name]));

  useEffect(() => {
    const token = localStorage.getItem("picsNigeriaAdminToken");

    if (!token) {
      window.location.href = "/admin/login";
      return;
    }
    const authToken = token;

    async function loadDashboard() {
      try {
        const [
          currentUser,
          nextSummary,
          nextAdminUsers,
          nextCandidates,
          nextAgentsList,
          nextManagedUsers,
          nextVoters,
          nextFeedback,
          nextIncidents,
          nextAgents,
          nextCoverage,
          nextNotifications,
          nextRedemptions,
          nextAnalytics,
          nextZones,
          nextParties,
          nextStates,
        ] = await Promise.all([
          fetchCurrentUser(authToken),
          fetchAdminSummary(authToken),
          fetchAdminUsers(authToken, ""),
          fetchAdminCandidates(authToken),
          fetchAgents(authToken),
          fetchManagedUsers(authToken, { limit: 16 }),
          fetchVoters(authToken),
          fetchAdminFeedback(authToken),
          fetchAdminIncidents(authToken),
          fetchAdminAgentActivitySummaries(authToken),
          fetchAdminPollingUnitCoverage(authToken),
          fetchNotifications(authToken),
          fetchAdminRedemptions(authToken),
          fetchAdminAnalytics(authToken),
          fetchGeoPoliticalZones(authToken),
          fetchPoliticalParties(authToken),
          fetchStates(authToken),
        ]);

        if (currentUser.role !== "ADMIN" && currentUser.role !== "SUPER_ADMIN") {
          throw new ApiError("This dashboard is available to admins only.", 403);
        }

        setUser(currentUser);
        setSummary(nextSummary);
        setAdminUsers(nextAdminUsers);
        setCandidates(nextCandidates);
        setAgents(nextAgentsList);
        setManagedUsers(nextManagedUsers);
        setVoters(nextVoters);
        setFeedback(nextFeedback);
        setIncidents(nextIncidents);
        setAgentSummaries(nextAgents);
        setCoverage(nextCoverage);
        setNotifications(nextNotifications);
        setRedemptions(nextRedemptions);
        setAnalytics(nextAnalytics);
        setZones(nextZones);
        setParties(nextParties);
        setStates(nextStates);
      } catch (caughtError) {
        localStorage.removeItem("picsNigeriaAdminToken");
        setError(caughtError instanceof Error ? caughtError.message : "Could not load your admin dashboard.");
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();
  }, []);

  if (loading) {
    return (
      <main className="shell">
        <section className="panel hero">
          <h1>Loading admin dashboard...</h1>
          <p>Please wait while scoped data is being prepared.</p>
        </section>
      </main>
    );
  }

  if (error || !user || !summary || !coverage || !analytics) {
    return (
      <main className="shell">
        <section className="panel card">
          <h1>Unable to load dashboard</h1>
          <p className="error">{error || "Authentication is required."}</p>
          <p>
            <Link href="/admin/login">Return to admin login</Link>
          </p>
        </section>
      </main>
    );
  }

  async function handleCreateZone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = localStorage.getItem("picsNigeriaAdminToken");
    if (!token) {
      setError("Authentication is required.");
      return;
    }

    try {
      setError("");
      await createGeoPoliticalZone(token, zoneForm);
      setZones(await fetchGeoPoliticalZones(token));
      setZoneForm({ id: "", name: "" });
      setAdminMessage("Geo-political zone created.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not create geo-political zone.");
    }
  }

  async function handleCreateParty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = localStorage.getItem("picsNigeriaAdminToken");
    if (!token) {
      setError("Authentication is required.");
      return;
    }

    try {
      setError("");
      await createPoliticalParty(token, partyForm);
      setParties(await fetchPoliticalParties(token));
      setPartyForm({ id: "", code: "", name: "" });
      setAdminMessage("Political party created.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not create political party.");
    }
  }

  function startZoneEdit(zone: GeoPoliticalZoneItem) {
    setEditingZoneId(zone.id);
    setZoneEditForm({ name: zone.name });
    setAdminMessage("");
    setError("");
  }

  function startPartyEdit(party: PoliticalPartyItem) {
    setEditingPartyId(party.id);
    setPartyEditForm({ code: party.code, name: party.name });
    setAdminMessage("");
    setError("");
  }

  async function handleUpdateZone(zoneId: string) {
    const token = localStorage.getItem("picsNigeriaAdminToken");
    if (!token) {
      setError("Authentication is required.");
      return;
    }

    try {
      setError("");
      await updateGeoPoliticalZone(token, zoneId, zoneEditForm);
      setZones(await fetchGeoPoliticalZones(token));
      setEditingZoneId(null);
      setZoneEditForm({ name: "" });
      setAdminMessage("Geo-political zone updated.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not update geo-political zone.");
    }
  }

  async function handleDeleteZone(zoneId: string) {
    const token = localStorage.getItem("picsNigeriaAdminToken");
    if (!token) {
      setError("Authentication is required.");
      return;
    }

    if (!window.confirm("Delete this geo-political zone? This only works when nothing depends on it.")) {
      return;
    }

    try {
      setError("");
      await deleteGeoPoliticalZone(token, zoneId);
      setZones(await fetchGeoPoliticalZones(token));
      if (editingZoneId === zoneId) {
        setEditingZoneId(null);
        setZoneEditForm({ name: "" });
      }
      setAdminMessage("Geo-political zone deleted.");
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        const details = formatDependencyCounts((caughtError.details as { dependencyCounts?: DependencyCounts } | undefined)?.dependencyCounts);
        setError(details ? `${caughtError.message} ${details}` : caughtError.message);
        return;
      }

      setError(caughtError instanceof Error ? caughtError.message : "Could not delete geo-political zone.");
    }
  }

  async function handleUpdateParty(partyId: string) {
    const token = localStorage.getItem("picsNigeriaAdminToken");
    if (!token) {
      setError("Authentication is required.");
      return;
    }

    try {
      setError("");
      await updatePoliticalParty(token, partyId, partyEditForm);
      setParties(await fetchPoliticalParties(token));
      setEditingPartyId(null);
      setPartyEditForm({ code: "", name: "" });
      setAdminMessage("Political party updated.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not update political party.");
    }
  }

  async function handleDeleteParty(partyId: string) {
    const token = localStorage.getItem("picsNigeriaAdminToken");
    if (!token) {
      setError("Authentication is required.");
      return;
    }

    if (!window.confirm("Delete this political party? This only works when no candidate is attached to it.")) {
      return;
    }

    try {
      setError("");
      await deletePoliticalParty(token, partyId);
      setParties(await fetchPoliticalParties(token));
      if (editingPartyId === partyId) {
        setEditingPartyId(null);
        setPartyEditForm({ code: "", name: "" });
      }
      setAdminMessage("Political party deleted.");
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        const details = formatDependencyCounts((caughtError.details as { dependencyCounts?: DependencyCounts } | undefined)?.dependencyCounts);
        setError(details ? `${caughtError.message} ${details}` : caughtError.message);
        return;
      }

      setError(caughtError instanceof Error ? caughtError.message : "Could not delete political party.");
    }
  }

  async function refreshStatesForZone(zoneId?: string) {
    const token = localStorage.getItem("picsNigeriaAdminToken");
    if (!token) {
      return;
    }

    setStates(await fetchStates(token, zoneId || undefined));
  }

  async function refreshTerritoryOptions(input: {
    stateId?: string;
    senatorialDistrictId?: string;
    lgaId?: string;
    wardId?: string;
  }) {
    const token = localStorage.getItem("picsNigeriaAdminToken");
    if (!token) {
      return;
    }

    if (!input.stateId) {
      setDistricts([]);
      setFederalConstituencies([]);
      setLgas([]);
      setWards([]);
      setPollingUnits([]);
      setStateConstituencies([]);
      setAdminUsers([]);
      return;
    }

    const [nextDistricts, nextFederalConstituencies, nextLgas, nextWards, nextStateConstituencies, nextAdminUsers] = await Promise.all([
      fetchSenatorialDistricts(token, input.stateId),
      fetchFederalConstituencies(token, input.stateId, input.senatorialDistrictId || undefined),
      fetchLgas(token, input.stateId),
      fetchWards(token, input.stateId, input.lgaId || undefined),
      fetchStateConstituencies(token, input.stateId, input.lgaId || undefined),
      fetchAdminUsers(token, input.stateId, input.lgaId || undefined),
    ]);

    setDistricts(nextDistricts);
    setFederalConstituencies(nextFederalConstituencies);
    setLgas(nextLgas);
    setWards(nextWards);
    setStateConstituencies(nextStateConstituencies);
    setAdminUsers(nextAdminUsers);

    if (input.lgaId) {
      setPollingUnits(await fetchPollingUnits(token, input.stateId, input.lgaId, input.wardId || undefined));
      return;
    }

    setPollingUnits([]);
  }

  function resetAdminTerritoryFields(overrides?: Partial<typeof adminCreateForm>) {
    return {
      ...adminCreateForm,
      stateId: "",
      senatorialDistrictId: "",
      federalConstituencyId: "",
      lgaId: "",
      wardId: "",
      stateConstituencyId: "",
      ...overrides,
    };
  }

  function resetCandidateTerritoryFields(overrides?: Partial<typeof candidateCreateForm>) {
    return {
      ...candidateCreateForm,
      stateId: "",
      senatorialDistrictId: "",
      federalConstituencyId: "",
      lgaId: "",
      wardId: "",
      stateConstituencyId: "",
      ...overrides,
    };
  }

  function resetAgentTerritoryFields(overrides?: Partial<typeof agentCreateForm>) {
    return {
      ...agentCreateForm,
      lgaId: "",
      wardId: "",
      pollingUnitId: "",
      assignedAdminUserId: "",
      ...overrides,
    };
  }

  async function handleCreateAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = localStorage.getItem("picsNigeriaAdminToken");
    if (!token) {
      setError("Authentication is required.");
      return;
    }

    try {
      setError("");
      const payload = {
        name: adminCreateForm.name,
        adminLevel: adminCreateForm.adminLevel as "NATIONAL" | "GEO_POLITICAL_ZONE" | "STATE" | "SENATORIAL" | "FEDERAL_CONSTITUENCY" | "STATE_CONSTITUENCY" | "LGA" | "WARD",
        geoPoliticalZoneId: adminCreateForm.adminLevel !== "NATIONAL" ? adminCreateForm.geoPoliticalZoneId || undefined : undefined,
        stateId: ["STATE", "SENATORIAL", "FEDERAL_CONSTITUENCY", "STATE_CONSTITUENCY", "LGA", "WARD"].includes(adminCreateForm.adminLevel)
          ? adminCreateForm.stateId || undefined
          : undefined,
        senatorialDistrictId: adminCreateForm.adminLevel === "SENATORIAL" ? adminCreateForm.senatorialDistrictId || undefined : undefined,
        federalConstituencyId: adminCreateForm.adminLevel === "FEDERAL_CONSTITUENCY" ? adminCreateForm.federalConstituencyId || undefined : undefined,
        lgaId: ["LGA", "WARD", "STATE_CONSTITUENCY"].includes(adminCreateForm.adminLevel) ? adminCreateForm.lgaId || undefined : undefined,
        wardId: adminCreateForm.adminLevel === "WARD" ? adminCreateForm.wardId || undefined : undefined,
        stateConstituencyId: adminCreateForm.adminLevel === "STATE_CONSTITUENCY" ? adminCreateForm.stateConstituencyId || undefined : undefined,
      };

      if (editingAdminUserId) {
        await updateAdminUser(token, editingAdminUserId, payload);
      } else {
        await createAdminUser(token, {
          ...payload,
          email: adminCreateForm.email,
          password: adminCreateForm.password,
        });
      }
      setAdminUsers(await fetchAdminUsers(token, ""));
      setManagedUsers(await fetchManagedUsers(token, { limit: 16 }));
      setAdminCreateForm({
        name: "",
        email: "",
        password: "",
        adminLevel: "STATE",
        geoPoliticalZoneId: "",
        stateId: "",
        senatorialDistrictId: "",
        federalConstituencyId: "",
        lgaId: "",
        wardId: "",
        stateConstituencyId: "",
      });
      setEditingAdminUserId(null);
      setAdminMessage(editingAdminUserId ? "Admin updated." : "Admin created.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not create admin.");
    }
  }

  async function handleCreateCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = localStorage.getItem("picsNigeriaAdminToken");
    if (!token) {
      setError("Authentication is required.");
      return;
    }

    try {
      setError("");
      const payload = {
        name: candidateCreateForm.name,
        officeType: candidateCreateForm.officeType as "PRESIDENTIAL" | "GOVERNORSHIP" | "SENATE" | "HOUSE_OF_REP" | "STATE_ASSEMBLY" | "CHAIRMANSHIP" | "COUNCILLOR",
        politicalPartyId: candidateCreateForm.politicalPartyId || undefined,
        geoPoliticalZoneId: candidateCreateForm.officeType !== "PRESIDENTIAL" ? candidateCreateForm.geoPoliticalZoneId || undefined : undefined,
        stateId: candidateCreateForm.officeType !== "PRESIDENTIAL" ? candidateCreateForm.stateId || undefined : undefined,
        senatorialDistrictId: candidateCreateForm.officeType === "SENATE" ? candidateCreateForm.senatorialDistrictId || undefined : undefined,
        federalConstituencyId: candidateCreateForm.officeType === "HOUSE_OF_REP" ? candidateCreateForm.federalConstituencyId || undefined : undefined,
        lgaId: ["CHAIRMANSHIP", "COUNCILLOR", "STATE_ASSEMBLY"].includes(candidateCreateForm.officeType) ? candidateCreateForm.lgaId || undefined : undefined,
        wardId: candidateCreateForm.officeType === "COUNCILLOR" ? candidateCreateForm.wardId || undefined : undefined,
        stateConstituencyId: candidateCreateForm.officeType === "STATE_ASSEMBLY" ? candidateCreateForm.stateConstituencyId || undefined : undefined,
      };

      if (editingCandidateUserId) {
        await updateCandidate(token, editingCandidateUserId, payload);
      } else {
        await createCandidate(token, {
          ...payload,
          email: candidateCreateForm.email,
          password: candidateCreateForm.password,
        });
      }
      setCandidates(await fetchAdminCandidates(token));
      setManagedUsers(await fetchManagedUsers(token, { limit: 16 }));
      setCandidateCreateForm({
        name: "",
        email: "",
        password: "",
        officeType: "GOVERNORSHIP",
        politicalPartyId: "",
        geoPoliticalZoneId: "",
        stateId: "",
        senatorialDistrictId: "",
        federalConstituencyId: "",
        lgaId: "",
        wardId: "",
        stateConstituencyId: "",
      });
      setEditingCandidateUserId(null);
      setAdminMessage(editingCandidateUserId ? "Candidate updated." : "Candidate created.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not create candidate.");
    }
  }

  async function handleCreateAgent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = localStorage.getItem("picsNigeriaAdminToken");
    if (!token) {
      setError("Authentication is required.");
      return;
    }

    try {
      setError("");
      const payload = {
        name: agentCreateForm.name,
        phone: agentCreateForm.phone || undefined,
        stateId: agentCreateForm.stateId,
        lgaId: agentCreateForm.lgaId,
        wardId: agentCreateForm.wardId,
        pollingUnitId: agentCreateForm.pollingUnitId || undefined,
        assignedAdminUserId: agentCreateForm.assignedAdminUserId || undefined,
      };

      if (editingAgentUserId) {
        await updateAgent(token, editingAgentUserId, payload);
      } else {
        await createAgent(token, {
          ...payload,
          email: agentCreateForm.email,
          password: agentCreateForm.password,
        });
      }
      setAgents(await fetchAgents(token));
      setManagedUsers(await fetchManagedUsers(token, { limit: 16 }));
      setAgentCreateForm({
        name: "",
        email: "",
        password: "",
        phone: "",
        stateId: "",
        lgaId: "",
        wardId: "",
        pollingUnitId: "",
        assignedAdminUserId: "",
      });
      setEditingAgentUserId(null);
      setAdminMessage(editingAgentUserId ? "Agent updated." : "Agent created.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not create agent.");
    }
  }

  async function beginEditAdmin(adminUser: AdminUserItem) {
    setEditingAdminUserId(adminUser.userId);
    setAdminCreateForm({
      name: adminUser.name,
      email: adminUser.email,
      password: "",
      adminLevel: adminUser.adminLevel,
      geoPoliticalZoneId: adminUser.territory.geoPoliticalZoneId || "",
      stateId: adminUser.territory.stateId || "",
      senatorialDistrictId: adminUser.territory.senatorialDistrictId || "",
      federalConstituencyId: adminUser.territory.federalConstituencyId || "",
      lgaId: adminUser.territory.lgaId || "",
      wardId: adminUser.territory.wardId || "",
      stateConstituencyId: adminUser.territory.stateConstituencyId || "",
    });
    await refreshStatesForZone(adminUser.territory.geoPoliticalZoneId || undefined);
    await refreshTerritoryOptions({
      stateId: adminUser.territory.stateId || undefined,
      senatorialDistrictId: adminUser.territory.senatorialDistrictId || undefined,
      lgaId: adminUser.territory.lgaId || undefined,
      wardId: adminUser.territory.wardId || undefined,
    });
  }

  async function beginEditCandidate(candidate: CandidateListItem) {
    setEditingCandidateUserId(candidate.userId);
    setCandidateCreateForm({
      name: candidate.name,
      email: candidate.email,
      password: "",
      officeType: candidate.officeType,
      politicalPartyId: candidate.politicalPartyId || "",
      geoPoliticalZoneId: candidate.territory.geoPoliticalZoneId || "",
      stateId: candidate.territory.stateId || "",
      senatorialDistrictId: candidate.territory.senatorialDistrictId || "",
      federalConstituencyId: candidate.territory.federalConstituencyId || "",
      lgaId: candidate.territory.lgaId || "",
      wardId: candidate.territory.wardId || "",
      stateConstituencyId: candidate.territory.stateConstituencyId || "",
    });
    await refreshStatesForZone(candidate.territory.geoPoliticalZoneId || undefined);
    await refreshTerritoryOptions({
      stateId: candidate.territory.stateId || undefined,
      senatorialDistrictId: candidate.territory.senatorialDistrictId || undefined,
      lgaId: candidate.territory.lgaId || undefined,
      wardId: candidate.territory.wardId || undefined,
    });
  }

  async function beginEditAgent(agent: AgentUserItem) {
    setEditingAgentUserId(agent.userId);
    setAgentCreateForm({
      name: agent.name,
      email: agent.email,
      password: "",
      phone: agent.phone || "",
      stateId: agent.territory.stateId || "",
      lgaId: agent.territory.lgaId || "",
      wardId: agent.territory.wardId || "",
      pollingUnitId: agent.territory.pollingUnitId || "",
      assignedAdminUserId: agent.assignedAdminUserId || "",
    });
    await refreshTerritoryOptions({
      stateId: agent.territory.stateId || undefined,
      lgaId: agent.territory.lgaId || undefined,
      wardId: agent.territory.wardId || undefined,
    });
  }

  async function handleToggleUserActivation(userId: string, isActive: boolean, kind: "admin" | "candidate" | "agent" | "voter") {
    const token = localStorage.getItem("picsNigeriaAdminToken");
    if (!token) {
      setError("Authentication is required.");
      return;
    }

    const actionLabel = isActive ? "reactivate" : "deactivate";
    if (!window.confirm(`Do you want to ${actionLabel} this ${kind}?`)) {
      return;
    }

    try {
      setError("");
      await setUserActivation(token, userId, isActive);

      if (kind === "admin") {
        setAdminUsers(await fetchAdminUsers(token, ""));
      }

      if (kind === "candidate") {
        setCandidates(await fetchAdminCandidates(token));
      }

      if (kind === "agent") {
        setAgents(await fetchAgents(token));
      }

      if (kind === "voter") {
        setVoters(await fetchVoters(token));
      }

      setManagedUsers(await fetchManagedUsers(token, { limit: 16 }));

      setAdminMessage(isActive ? "User reactivated." : "User deactivated.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not change activation status.");
    }
  }

  return (
    <main className="shell">
      <section className="panel hero">
        <h1>{user.name}</h1>
        <p>
          Role: <strong>{user.role}</strong>
        </p>
        <p>
          Admin level: <strong>{user.adminProfile?.adminLevel || "N/A"}</strong>
        </p>
        <p className="muted">
          Territory: {user.adminProfile?.stateId || "nationwide"} | {user.adminProfile?.lgaId || "all LGAs"} |{" "}
          {user.adminProfile?.wardId || "all wards"}
        </p>
      </section>

      <section className="grid stats">
        <article className="panel card">
          <h2>Voters</h2>
          <div className="value">{summary.totalVotersInScope}</div>
        </article>
        <article className="panel card">
          <h2>Agents</h2>
          <div className="value">{summary.totalAgentsInScope}</div>
        </article>
        <article className="panel card">
          <h2>Feedback</h2>
          <div className="value">{summary.totalFeedbackItemsInScope}</div>
        </article>
        <article className="panel card">
          <h2>Active Polls</h2>
          <div className="value">{summary.totalActivePollsInScope}</div>
        </article>
        <article className="panel card">
          <h2>Check-ins Today</h2>
          <div className="value">{summary.totalAgentCheckInsToday}</div>
        </article>
        <article className="panel card">
          <h2>Active Agents Today</h2>
          <div className="value">{summary.totalActiveAgentsToday}</div>
        </article>
        <article className="panel card">
          <h2>Open Incidents</h2>
          <div className="value">{summary.totalIncidentsOpen}</div>
        </article>
        <article className="panel card">
          <h2>Critical Incidents</h2>
          <div className="value">{summary.totalIncidentsCritical}</div>
        </article>
      </section>

      <section className="grid stats" style={{ marginTop: 24 }}>
        <article className="panel card">
          <h2>Poll Responses</h2>
          <div className="value">{summary.totalPollResponsesInScope}</div>
        </article>
        <article className="panel card">
          <h2>Voter Feedback</h2>
          <div className="value">{summary.totalVoterFeedbackItemsInScope}</div>
        </article>
        <article className="panel card">
          <h2>Units With Agents</h2>
          <div className="value">{coverage.pollingUnitsWithAssignedAgents}</div>
        </article>
        <article className="panel card">
          <h2>Units Without Activity</h2>
          <div className="value">{coverage.pollingUnitsWithoutActivity}</div>
        </article>
      </section>

      <section className="panel card" style={{ marginTop: 24 }}>
        <h2>Map Panel Placeholder</h2>
        <p className="muted">
          This panel is reserved for future live map rendering. Current backend data already supports markers for
          agent locations, incidents, and polling units.
        </p>
      </section>

      <section className="panel card" style={{ marginTop: 24 }}>
        <h2>Visible Candidates</h2>
        {candidates.length === 0 ? (
          <p className="muted">No visible candidates yet.</p>
        ) : (
          <div className="reward-list">
            {candidates.map((candidate) => (
              <article key={candidate.userId} className="reward-item">
                <strong>{candidate.name}</strong>
                <p>{candidate.officeType}</p>
                <p className="muted">Status: {candidate.isActive ? "Active" : "Inactive"}</p>
                <p className="muted">Party: {candidate.politicalPartyId ? partyNames.get(candidate.politicalPartyId) || candidate.politicalPartyId : "Independent"}</p>
                <p className="muted">
                  {candidate.territory.geoPoliticalZoneId || "all zones"} | {candidate.territory.stateId || "national"} | {candidate.territory.lgaId || "all LGAs"}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      {user.role === "SUPER_ADMIN" ? (
        <section className="grid" style={{ marginTop: 24, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
          <section className="panel card">
            <h2>{editingAdminUserId ? "Edit Admin" : "Create Admin"}</h2>
            <p className="muted">This form currently supports national, geo-political-zone, and state admins.</p>
            <form className="form" onSubmit={handleCreateAdmin}>
              <label className="field">
                <span>Name</span>
                <input value={adminCreateForm.name} onChange={(event) => setAdminCreateForm({ ...adminCreateForm, name: event.target.value })} required />
              </label>
              <label className="field">
                <span>Email</span>
                <input type="email" value={adminCreateForm.email} onChange={(event) => setAdminCreateForm({ ...adminCreateForm, email: event.target.value })} required={!editingAdminUserId} disabled={Boolean(editingAdminUserId)} />
              </label>
              <label className="field">
                <span>Password</span>
                <input type="password" value={adminCreateForm.password} onChange={(event) => setAdminCreateForm({ ...adminCreateForm, password: event.target.value })} required={!editingAdminUserId} disabled={Boolean(editingAdminUserId)} />
              </label>
              <label className="field">
                <span>Admin Level</span>
                <select
                  value={adminCreateForm.adminLevel}
                  onChange={async (event) => {
                    const adminLevel = event.target.value as (typeof ADMIN_LEVELS)[number];
                    const nextForm = resetAdminTerritoryFields({ adminLevel });
                    setAdminCreateForm(nextForm);
                    await refreshStatesForZone(nextForm.geoPoliticalZoneId);
                    await refreshTerritoryOptions({});
                  }}
                >
                  {adminLevelOptions.map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </label>
              {adminCreateForm.adminLevel !== "NATIONAL" ? (
                <label className="field">
                  <span>Geo-Political Zone</span>
                  <select
                    value={adminCreateForm.geoPoliticalZoneId}
                    onChange={async (event) => {
                      const geoPoliticalZoneId = event.target.value;
                      setAdminCreateForm(resetAdminTerritoryFields({ geoPoliticalZoneId }));
                      await refreshStatesForZone(geoPoliticalZoneId);
                      await refreshTerritoryOptions({});
                    }}
                    required
                  >
                    <option value="">Select zone</option>
                    {zones.map((zone) => (
                      <option key={zone.id} value={zone.id}>{zone.name}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              {adminCreateForm.adminLevel === "STATE" ? (
                <label className="field">
                  <span>State</span>
                  <select
                    value={adminCreateForm.stateId}
                    onChange={async (event) => {
                      const stateId = event.target.value;
                      setAdminCreateForm(resetAdminTerritoryFields({ stateId, geoPoliticalZoneId: adminCreateForm.geoPoliticalZoneId }));
                      await refreshTerritoryOptions({ stateId });
                    }}
                    required
                  >
                    <option value="">Select state</option>
                    {states.map((state) => (
                      <option key={state.id} value={state.id}>{state.name}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              {["SENATORIAL", "FEDERAL_CONSTITUENCY", "STATE_CONSTITUENCY", "LGA", "WARD"].includes(adminCreateForm.adminLevel) ? (
                <label className="field">
                  <span>State</span>
                  <select
                    value={adminCreateForm.stateId}
                    onChange={async (event) => {
                      const stateId = event.target.value;
                      setAdminCreateForm(resetAdminTerritoryFields({ stateId, geoPoliticalZoneId: adminCreateForm.geoPoliticalZoneId }));
                      await refreshTerritoryOptions({ stateId });
                    }}
                    required
                  >
                    <option value="">Select state</option>
                    {states.map((state) => (
                      <option key={state.id} value={state.id}>{state.name}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              {adminCreateForm.adminLevel === "SENATORIAL" ? (
                <label className="field">
                  <span>Senatorial District</span>
                  <select
                    value={adminCreateForm.senatorialDistrictId}
                    onChange={(event) => setAdminCreateForm({ ...adminCreateForm, senatorialDistrictId: event.target.value })}
                    required
                  >
                    <option value="">Select district</option>
                    {districts.map((district) => (
                      <option key={district.id} value={district.id}>{district.name}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              {adminCreateForm.adminLevel === "FEDERAL_CONSTITUENCY" ? (
                <>
                  <label className="field">
                    <span>Senatorial District</span>
                    <select
                      value={adminCreateForm.senatorialDistrictId}
                      onChange={async (event) => {
                        const senatorialDistrictId = event.target.value;
                        setAdminCreateForm({ ...adminCreateForm, senatorialDistrictId, federalConstituencyId: "" });
                        await refreshTerritoryOptions({ stateId: adminCreateForm.stateId, senatorialDistrictId });
                      }}
                    >
                      <option value="">All districts</option>
                      {districts.map((district) => (
                        <option key={district.id} value={district.id}>{district.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Federal Constituency</span>
                    <select
                      value={adminCreateForm.federalConstituencyId}
                      onChange={(event) => setAdminCreateForm({ ...adminCreateForm, federalConstituencyId: event.target.value })}
                      required
                    >
                      <option value="">Select constituency</option>
                      {federalConstituencies.map((constituency) => (
                        <option key={constituency.id} value={constituency.id}>{constituency.name}</option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}
              {["STATE_CONSTITUENCY", "LGA", "WARD"].includes(adminCreateForm.adminLevel) ? (
                <label className="field">
                  <span>LGA</span>
                  <select
                    value={adminCreateForm.lgaId}
                    onChange={async (event) => {
                      const lgaId = event.target.value;
                      setAdminCreateForm({ ...adminCreateForm, lgaId, wardId: "", stateConstituencyId: "" });
                      await refreshTerritoryOptions({ stateId: adminCreateForm.stateId, lgaId });
                    }}
                    required
                  >
                    <option value="">Select LGA</option>
                    {lgas.map((lga) => (
                      <option key={lga.id} value={lga.id}>{lga.name}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              {adminCreateForm.adminLevel === "STATE_CONSTITUENCY" ? (
                <label className="field">
                  <span>State Constituency</span>
                  <select
                    value={adminCreateForm.stateConstituencyId}
                    onChange={(event) => setAdminCreateForm({ ...adminCreateForm, stateConstituencyId: event.target.value })}
                    required
                  >
                    <option value="">Select constituency</option>
                    {stateConstituencies.map((constituency) => (
                      <option key={constituency.id} value={constituency.id}>{constituency.name}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              {adminCreateForm.adminLevel === "WARD" ? (
                <label className="field">
                  <span>Ward</span>
                  <select
                    value={adminCreateForm.wardId}
                    onChange={(event) => setAdminCreateForm({ ...adminCreateForm, wardId: event.target.value })}
                    required
                  >
                    <option value="">Select ward</option>
                    {wards.map((ward) => (
                      <option key={ward.id} value={ward.id}>{ward.name}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="button" type="submit">{editingAdminUserId ? "Save admin" : "Create admin"}</button>
                {editingAdminUserId ? <button className="button secondary" type="button" onClick={() => setEditingAdminUserId(null)}>Cancel edit</button> : null}
              </div>
            </form>
          </section>

          <section className="panel card">
            <h2>{editingCandidateUserId ? "Edit Candidate" : "Create Candidate"}</h2>
            <p className="muted">This form supports the full office list, with party optional for independent candidates.</p>
            <form className="form" onSubmit={handleCreateCandidate}>
              <label className="field">
                <span>Name</span>
                <input value={candidateCreateForm.name} onChange={(event) => setCandidateCreateForm({ ...candidateCreateForm, name: event.target.value })} required />
              </label>
              <label className="field">
                <span>Email</span>
                <input type="email" value={candidateCreateForm.email} onChange={(event) => setCandidateCreateForm({ ...candidateCreateForm, email: event.target.value })} required={!editingCandidateUserId} disabled={Boolean(editingCandidateUserId)} />
              </label>
              <label className="field">
                <span>Password</span>
                <input type="password" value={candidateCreateForm.password} onChange={(event) => setCandidateCreateForm({ ...candidateCreateForm, password: event.target.value })} required={!editingCandidateUserId} disabled={Boolean(editingCandidateUserId)} />
              </label>
              <label className="field">
                <span>Office</span>
                <select
                  value={candidateCreateForm.officeType}
                  onChange={async (event) => {
                    const officeType = event.target.value as (typeof CANDIDATE_OFFICE_TYPES)[number];
                    const nextForm = resetCandidateTerritoryFields({ officeType });
                    setCandidateCreateForm(nextForm);
                    await refreshTerritoryOptions({});
                  }}
                >
                  {candidateOfficeOptions.map((officeType) => (
                    <option key={officeType} value={officeType}>{officeType}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Party</span>
                <select
                  value={candidateCreateForm.politicalPartyId}
                  onChange={(event) => setCandidateCreateForm({ ...candidateCreateForm, politicalPartyId: event.target.value })}
                >
                  <option value="">Independent</option>
                  {parties.map((party) => (
                    <option key={party.id} value={party.id}>{party.name}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Geo-Political Zone</span>
                <select
                  value={candidateCreateForm.geoPoliticalZoneId}
                  onChange={async (event) => {
                    const geoPoliticalZoneId = event.target.value;
                    setCandidateCreateForm(resetCandidateTerritoryFields({ geoPoliticalZoneId }));
                    await refreshStatesForZone(geoPoliticalZoneId);
                    await refreshTerritoryOptions({});
                  }}
                >
                  <option value="">Select zone</option>
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>{zone.name}</option>
                  ))}
                </select>
              </label>
              {candidateCreateForm.officeType !== "PRESIDENTIAL" ? (
                <label className="field">
                  <span>State</span>
                  <select
                    value={candidateCreateForm.stateId}
                    onChange={async (event) => {
                      const stateId = event.target.value;
                      setCandidateCreateForm(resetCandidateTerritoryFields({ stateId, geoPoliticalZoneId: candidateCreateForm.geoPoliticalZoneId, officeType: candidateCreateForm.officeType, politicalPartyId: candidateCreateForm.politicalPartyId }));
                      await refreshTerritoryOptions({ stateId });
                    }}
                    required
                  >
                    <option value="">Select state</option>
                    {states.map((state) => (
                      <option key={state.id} value={state.id}>{state.name}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              {candidateCreateForm.officeType === "SENATE" ? (
                <label className="field">
                  <span>Senatorial District</span>
                  <select
                    value={candidateCreateForm.senatorialDistrictId}
                    onChange={(event) => setCandidateCreateForm({ ...candidateCreateForm, senatorialDistrictId: event.target.value })}
                    required
                  >
                    <option value="">Select district</option>
                    {districts.map((district) => (
                      <option key={district.id} value={district.id}>{district.name}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              {candidateCreateForm.officeType === "HOUSE_OF_REP" ? (
                <>
                  <label className="field">
                    <span>Senatorial District</span>
                    <select
                      value={candidateCreateForm.senatorialDistrictId}
                      onChange={async (event) => {
                        const senatorialDistrictId = event.target.value;
                        setCandidateCreateForm({ ...candidateCreateForm, senatorialDistrictId, federalConstituencyId: "" });
                        await refreshTerritoryOptions({ stateId: candidateCreateForm.stateId, senatorialDistrictId });
                      }}
                    >
                      <option value="">All districts</option>
                      {districts.map((district) => (
                        <option key={district.id} value={district.id}>{district.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Federal Constituency</span>
                    <select
                      value={candidateCreateForm.federalConstituencyId}
                      onChange={(event) => setCandidateCreateForm({ ...candidateCreateForm, federalConstituencyId: event.target.value })}
                      required
                    >
                      <option value="">Select constituency</option>
                      {federalConstituencies.map((constituency) => (
                        <option key={constituency.id} value={constituency.id}>{constituency.name}</option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}
              {["STATE_ASSEMBLY", "CHAIRMANSHIP", "COUNCILLOR"].includes(candidateCreateForm.officeType) ? (
                <label className="field">
                  <span>LGA</span>
                  <select
                    value={candidateCreateForm.lgaId}
                    onChange={async (event) => {
                      const lgaId = event.target.value;
                      setCandidateCreateForm({ ...candidateCreateForm, lgaId, wardId: "", stateConstituencyId: "" });
                      await refreshTerritoryOptions({ stateId: candidateCreateForm.stateId, lgaId });
                    }}
                    required
                  >
                    <option value="">Select LGA</option>
                    {lgas.map((lga) => (
                      <option key={lga.id} value={lga.id}>{lga.name}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              {candidateCreateForm.officeType === "STATE_ASSEMBLY" ? (
                <label className="field">
                  <span>State Constituency</span>
                  <select
                    value={candidateCreateForm.stateConstituencyId}
                    onChange={(event) => setCandidateCreateForm({ ...candidateCreateForm, stateConstituencyId: event.target.value })}
                    required
                  >
                    <option value="">Select constituency</option>
                    {stateConstituencies.map((constituency) => (
                      <option key={constituency.id} value={constituency.id}>{constituency.name}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              {candidateCreateForm.officeType === "COUNCILLOR" ? (
                <label className="field">
                  <span>Ward</span>
                  <select
                    value={candidateCreateForm.wardId}
                    onChange={(event) => setCandidateCreateForm({ ...candidateCreateForm, wardId: event.target.value })}
                    required
                  >
                    <option value="">Select ward</option>
                    {wards.map((ward) => (
                      <option key={ward.id} value={ward.id}>{ward.name}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="button" type="submit">{editingCandidateUserId ? "Save candidate" : "Create candidate"}</button>
                {editingCandidateUserId ? <button className="button secondary" type="button" onClick={() => setEditingCandidateUserId(null)}>Cancel edit</button> : null}
              </div>
            </form>
          </section>

          <section className="panel card">
            <h2>{editingAgentUserId ? "Edit Agent" : "Create Agent"}</h2>
            <p className="muted">Agents are created within a state, LGA, and ward, with optional polling unit and admin assignment.</p>
            <form className="form" onSubmit={handleCreateAgent}>
              <label className="field">
                <span>Name</span>
                <input value={agentCreateForm.name} onChange={(event) => setAgentCreateForm({ ...agentCreateForm, name: event.target.value })} required />
              </label>
              <label className="field">
                <span>Email</span>
                <input type="email" value={agentCreateForm.email} onChange={(event) => setAgentCreateForm({ ...agentCreateForm, email: event.target.value })} required={!editingAgentUserId} disabled={Boolean(editingAgentUserId)} />
              </label>
              <label className="field">
                <span>Password</span>
                <input type="password" value={agentCreateForm.password} onChange={(event) => setAgentCreateForm({ ...agentCreateForm, password: event.target.value })} required={!editingAgentUserId} disabled={Boolean(editingAgentUserId)} />
              </label>
              <label className="field">
                <span>Phone</span>
                <input value={agentCreateForm.phone} onChange={(event) => setAgentCreateForm({ ...agentCreateForm, phone: event.target.value })} />
              </label>
              <label className="field">
                <span>State</span>
                <select
                  value={agentCreateForm.stateId}
                  onChange={async (event) => {
                    const stateId = event.target.value;
                    setAgentCreateForm(resetAgentTerritoryFields({ stateId }));
                    await refreshTerritoryOptions({ stateId });
                  }}
                  required
                >
                  <option value="">Select state</option>
                  {states.map((state) => (
                    <option key={state.id} value={state.id}>{state.name}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>LGA</span>
                <select
                  value={agentCreateForm.lgaId}
                  onChange={async (event) => {
                    const lgaId = event.target.value;
                    setAgentCreateForm(resetAgentTerritoryFields({ stateId: agentCreateForm.stateId, lgaId }));
                    await refreshTerritoryOptions({ stateId: agentCreateForm.stateId, lgaId });
                  }}
                  required
                >
                  <option value="">Select LGA</option>
                  {lgas.map((lga) => (
                    <option key={lga.id} value={lga.id}>{lga.name}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Ward</span>
                <select
                  value={agentCreateForm.wardId}
                  onChange={async (event) => {
                    const wardId = event.target.value;
                    setAgentCreateForm({ ...agentCreateForm, wardId, pollingUnitId: "" });
                    await refreshTerritoryOptions({ stateId: agentCreateForm.stateId, lgaId: agentCreateForm.lgaId, wardId });
                  }}
                  required
                >
                  <option value="">Select ward</option>
                  {wards.map((ward) => (
                    <option key={ward.id} value={ward.id}>{ward.name}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Polling Unit</span>
                <select
                  value={agentCreateForm.pollingUnitId}
                  onChange={(event) => setAgentCreateForm({ ...agentCreateForm, pollingUnitId: event.target.value })}
                >
                  <option value="">Any polling unit</option>
                  {pollingUnits.map((pollingUnit) => (
                    <option key={pollingUnit.id} value={pollingUnit.id}>{pollingUnit.name}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Assigned Admin</span>
                <select
                  value={agentCreateForm.assignedAdminUserId}
                  onChange={(event) => setAgentCreateForm({ ...agentCreateForm, assignedAdminUserId: event.target.value })}
                >
                  <option value="">Unassigned</option>
                  {adminUsers.map((adminUser) => (
                    <option key={adminUser.userId} value={adminUser.userId}>{adminUser.name} ({adminUser.adminLevel})</option>
                  ))}
                </select>
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="button" type="submit">{editingAgentUserId ? "Save agent" : "Create agent"}</button>
                {editingAgentUserId ? <button className="button secondary" type="button" onClick={() => setEditingAgentUserId(null)}>Cancel edit</button> : null}
              </div>
            </form>
          </section>
        </section>
      ) : null}

      {user.role === "SUPER_ADMIN" ? (
        <section className="grid" style={{ marginTop: 24, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          <section className="panel card management-console" style={{ gridColumn: "1 / -1" }}>
            <div className="section-head">
              <div>
                <h2>Unified User Management</h2>
                <p className="muted">Admins, candidates, agents, and voters in one scoped control surface.</p>
              </div>
              <div className="status-pill">{managedUsers.length} users loaded</div>
            </div>
            <div className="management-grid">
              {managedUsers.map((managedUser) => (
                <article key={managedUser.userId} className="reward-item management-card">
                  <div className="section-head compact">
                    <div>
                      <strong>{managedUser.name}</strong>
                      <p className="muted">{managedUser.email}</p>
                    </div>
                    <span className={`status-pill ${managedUser.isActive ? "active" : "inactive"}`}>{managedUser.isActive ? "Active" : "Inactive"}</span>
                  </div>
                  <p>
                    <strong>{managedUser.role}</strong>
                    {managedUser.adminLevel ? ` | ${managedUser.adminLevel}` : ""}
                    {managedUser.officeType ? ` | ${managedUser.officeType}` : ""}
                    {managedUser.voterCardNumber ? ` | ${managedUser.voterCardNumber}` : ""}
                  </p>
                  <p className="muted">
                    {managedUser.territory.geoPoliticalZoneId || "all zones"} | {managedUser.territory.stateId || "national"} | {managedUser.territory.lgaId || "all LGAs"} | {managedUser.territory.wardId || "all wards"}
                  </p>
                  <div className="action-row">
                    {managedUser.role === "ADMIN" ? <button className="button" type="button" onClick={() => void beginEditAdmin(adminUsers.find((item) => item.userId === managedUser.userId)!)}>Edit</button> : null}
                    {managedUser.role === "CANDIDATE" ? <button className="button" type="button" onClick={() => void beginEditCandidate(candidates.find((item) => item.userId === managedUser.userId)!)}>Edit</button> : null}
                    {managedUser.role === "AGENT" ? <button className="button" type="button" onClick={() => void beginEditAgent(agents.find((item) => item.userId === managedUser.userId)!)}>Edit</button> : null}
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() =>
                        void handleToggleUserActivation(
                          managedUser.userId,
                          !managedUser.isActive,
                          managedUser.role === "ADMIN" ? "admin" : managedUser.role === "CANDIDATE" ? "candidate" : managedUser.role === "AGENT" ? "agent" : "voter",
                        )
                      }
                    >
                      {managedUser.isActive ? "Deactivate" : "Reactivate"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>
      ) : null}

      <section className="grid" style={{ marginTop: 24, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <section className="panel card">
          <h2>Geo-Political Zones</h2>
          {adminMessage ? <p className="muted">{adminMessage}</p> : null}
          <div className="reward-list">
            {zones.map((zone) => (
              <article key={zone.id} className="reward-item">
                {editingZoneId === zone.id ? (
                  <>
                    <label className="field">
                      <span>Zone Name</span>
                      <input
                        value={zoneEditForm.name}
                        onChange={(event) => setZoneEditForm({ name: event.target.value })}
                        required
                      />
                    </label>
                    <p className="muted">{zone.id}</p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button className="button" type="button" onClick={() => handleUpdateZone(zone.id)}>Save</button>
                      <button className="button secondary" type="button" onClick={() => setEditingZoneId(null)}>Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <strong>{zone.name}</strong>
                    <p className="muted">{zone.id}</p>
                    {user.role === "SUPER_ADMIN" ? (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button className="button" type="button" onClick={() => startZoneEdit(zone)}>Edit</button>
                        <button className="button secondary" type="button" onClick={() => handleDeleteZone(zone.id)}>Delete</button>
                      </div>
                    ) : null}
                  </>
                )}
              </article>
            ))}
          </div>
          {user.role === "SUPER_ADMIN" ? (
            <form className="form" onSubmit={handleCreateZone}>
              <label className="field">
                <span>Zone Id</span>
                <input value={zoneForm.id} onChange={(event) => setZoneForm({ ...zoneForm, id: event.target.value })} required />
              </label>
              <label className="field">
                <span>Zone Name</span>
                <input value={zoneForm.name} onChange={(event) => setZoneForm({ ...zoneForm, name: event.target.value })} required />
              </label>
              <button className="button" type="submit">Add zone</button>
            </form>
          ) : null}
        </section>

        <section className="panel card">
          <h2>Political Parties</h2>
          <div className="reward-list">
            {parties.map((party) => (
              <article key={party.id} className="reward-item">
                {editingPartyId === party.id ? (
                  <>
                    <label className="field">
                      <span>Party Code</span>
                      <input
                        value={partyEditForm.code}
                        onChange={(event) => setPartyEditForm({ ...partyEditForm, code: event.target.value })}
                        required
                      />
                    </label>
                    <label className="field">
                      <span>Party Name</span>
                      <input
                        value={partyEditForm.name}
                        onChange={(event) => setPartyEditForm({ ...partyEditForm, name: event.target.value })}
                        required
                      />
                    </label>
                    <p className="muted">{party.id}</p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button className="button" type="button" onClick={() => handleUpdateParty(party.id)}>Save</button>
                      <button className="button secondary" type="button" onClick={() => setEditingPartyId(null)}>Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <strong>{party.name}</strong>
                    <p>{party.code}</p>
                    <p className="muted">{party.id}</p>
                    {user.role === "SUPER_ADMIN" ? (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button className="button" type="button" onClick={() => startPartyEdit(party)}>Edit</button>
                        <button className="button secondary" type="button" onClick={() => handleDeleteParty(party.id)}>Delete</button>
                      </div>
                    ) : null}
                  </>
                )}
              </article>
            ))}
          </div>
          {user.role === "SUPER_ADMIN" ? (
            <form className="form" onSubmit={handleCreateParty}>
              <label className="field">
                <span>Party Id</span>
                <input value={partyForm.id} onChange={(event) => setPartyForm({ ...partyForm, id: event.target.value })} required />
              </label>
              <label className="field">
                <span>Party Code</span>
                <input value={partyForm.code} onChange={(event) => setPartyForm({ ...partyForm, code: event.target.value })} required />
              </label>
              <label className="field">
                <span>Party Name</span>
                <input value={partyForm.name} onChange={(event) => setPartyForm({ ...partyForm, name: event.target.value })} required />
              </label>
              <button className="button" type="submit">Add party</button>
            </form>
          ) : null}
        </section>
      </section>

      <section className="panel card" style={{ marginTop: 24 }}>
        <h2>Feedback Preview</h2>
        {feedback.length === 0 ? (
          <p className="muted">No feedback in scope.</p>
        ) : (
          <div className="reward-list">
            {feedback.slice(0, 5).map((item) => (
              <article key={item.id} className="reward-item">
                <strong>{item.type}</strong>
                <p>{item.message}</p>
                <p className="muted">
                  {item.stateId} | {item.lgaId} | {new Date(item.createdAt).toLocaleString()}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="grid" style={{ marginTop: 24, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <section className="panel card">
          <h2>Recent Incidents</h2>
          {incidents.length === 0 ? (
            <p className="muted">No incidents in scope.</p>
          ) : (
            <div className="reward-list">
              {incidents.slice(0, 5).map((item) => (
                <article key={item.id} className="reward-item">
                  <strong>{item.title}</strong>
                  <p>{item.type} | {item.severity} | {item.status}</p>
                  <p className="muted">{new Date(item.createdAt).toLocaleString()}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel card">
          <h2>Active Agents</h2>
          {agentSummaries.length === 0 ? (
            <p className="muted">No agent activity available.</p>
          ) : (
            <div className="reward-list">
              {agentSummaries.slice(0, 5).map((item) => (
                <article key={item.agentUserId} className="reward-item">
                  <strong>{item.name}</strong>
                  <p>{item.latestActivityType || "No recent activity"}</p>
                  <p className="muted">
                    {item.pollingUnitId || "No polling unit"} | {item.latestActivityAt ? new Date(item.latestActivityAt).toLocaleString() : "No timestamp"}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      <section className="grid" style={{ marginTop: 24, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <section className="panel card">
          <h2>Incident Analytics</h2>
          <div className="reward-list">
            {Object.entries(analytics.incidentCountsByStatus).slice(0, 4).map(([key, value]) => (
              <article key={key} className="reward-item">
                <strong>{key}</strong>
                <p>{value}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel card">
          <h2>Reward Analytics</h2>
          <div className="reward-list">
            {Object.entries(analytics.rewardTotalsByType).slice(0, 4).map(([key, value]) => (
              <article key={key} className="reward-item">
                <strong>{key}</strong>
                <p>{value} points</p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel card">
          <h2>Poll Responses</h2>
          <div className="reward-list">
            {analytics.pollResponseTotalsByPoll.slice(0, 4).map((item) => (
              <article key={item.pollId} className="reward-item">
                <strong>{item.title}</strong>
                <p>{item.responses} responses</p>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="grid" style={{ marginTop: 24, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <section className="panel card">
          <h2>Notifications</h2>
          {notifications.length === 0 ? (
            <p className="muted">No notifications yet.</p>
          ) : (
            <div className="reward-list">
              {notifications.slice(0, 5).map((item) => (
                <article key={item.id} className="reward-item">
                  <strong>{item.title}</strong>
                  <p>{item.message}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel card">
          <h2>Redemption Requests</h2>
          {redemptions.length === 0 ? (
            <p className="muted">No redemption requests in scope.</p>
          ) : (
            <div className="reward-list">
              {redemptions.slice(0, 5).map((item) => (
                <article key={item.id} className="reward-item">
                  <strong>{item.status}</strong>
                  <p>{item.pointsRequested} points</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
