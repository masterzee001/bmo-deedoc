import assert from "node:assert/strict";
import http from "node:http";
import type { Prisma } from "@prisma/client";
import { OGUN_STATE_ID } from "@pics-nigeria/shared";
import { hashPassword } from "./auth/password";
import { getAuthUserProfile } from "./auth/profile";
import { signAccessToken } from "./auth/jwt";
import { createApp } from "./app";
import { prisma } from "./prisma";

type ApiResult = { status: number; payload: Record<string, unknown> };
type Branch = {
  senatorialDistrictId: string;
  federalConstituencyId: string;
  stateConstituencyId: string;
  wardId: string;
  pollingUnitId: string;
};

const password = "ElectionDay123!";
const lgaId = "election-day-test-lga";
const today = new Date().toISOString().slice(0, 10);
let baseUrl = "";
let server: http.Server | null = null;
let stateOfficerEmail = "";
let pucEmail = "";
let noConsentPucEmail = "";
let memberEmail = "";
let branches: Branch[] = [];

async function apiRequest(path: string, options?: { token?: string; method?: string; body?: unknown }): Promise<ApiResult> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options?.method || "GET",
    headers: {
      ...(options?.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  return { status: response.status, payload: (await response.json()) as Record<string, unknown> };
}

async function login(email: string) {
  const result = await apiRequest("/auth/login", { method: "POST", body: { email, password, agentGpsConsent: true } });
  assert.equal(result.status, 200, JSON.stringify(result.payload));
  assert.equal(typeof result.payload.token, "string");
  return result.payload.token as string;
}

async function tokenWithoutGpsConsent(email: string, sessionNonce: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
  await prisma.agentProfile.update({
    where: { userId: user.id },
    data: { gpsTrackingConsentAt: null, activeSessionNonce: sessionNonce },
  });
  const profile = await getAuthUserProfile(user.id);
  assert.ok(profile);
  return signAccessToken(profile, { sessionNonce });
}

async function createCommandHierarchy() {
  await prisma.state.upsert({
    where: { id: OGUN_STATE_ID },
    update: {},
    create: { id: OGUN_STATE_ID, name: "Ogun" },
  });
  await prisma.lGA.upsert({
    where: { id: lgaId },
    update: { stateId: OGUN_STATE_ID },
    create: { id: lgaId, name: "Election Day Test LGA", stateId: OGUN_STATE_ID },
  });
  await prisma.senatorialDistrict.upsert({
    where: { id: "election-day-test-senatorial" },
    update: {},
    create: {
      id: "election-day-test-senatorial",
      name: "Election Day Test Senatorial",
      stateId: OGUN_STATE_ID,
    },
  });
  await prisma.federalConstituency.upsert({
    where: { id: "election-day-test-federal" },
    update: {},
    create: {
      id: "election-day-test-federal",
      name: "Election Day Test Federal",
      stateId: OGUN_STATE_ID,
      senatorialDistrictId: "election-day-test-senatorial",
    },
  });

  branches = [];
  for (let index = 1; index <= 2; index += 1) {
    const stateConstituencyId = `election-day-test-state-constituency-${index}`;
    const wardId = `election-day-test-ward-${index}`;
    const pollingUnitId = `election-day-test-pu-${index}`;
    await prisma.stateConstituency.upsert({
      where: { id: stateConstituencyId },
      update: { federalConstituencyId: "election-day-test-federal" },
      create: {
        id: stateConstituencyId,
        name: `Election Day Test State Constituency ${index}`,
        stateId: OGUN_STATE_ID,
        lgaId,
        federalConstituencyId: "election-day-test-federal",
      },
    });
    await prisma.ward.upsert({
      where: { id: wardId },
      update: { stateConstituencyId },
      create: {
        id: wardId,
        name: `Election Day Test Ward ${index}`,
        stateId: OGUN_STATE_ID,
        lgaId,
        stateConstituencyId,
      },
    });
    await prisma.pollingUnit.upsert({
      where: { id: pollingUnitId },
      update: {},
      create: {
        id: pollingUnitId,
        name: `Election Day Test PU ${index}`,
        stateId: OGUN_STATE_ID,
        lgaId,
        wardId,
      },
    });
    branches.push({
      senatorialDistrictId: "election-day-test-senatorial",
      federalConstituencyId: "election-day-test-federal",
      stateConstituencyId,
      wardId,
      pollingUnitId,
    });
  }
}

async function createUser(label: string, data: Omit<Prisma.UserCreateInput, "name" | "email" | "passwordHash">) {
  const passwordHash = await hashPassword(password);
  return prisma.user.create({
    data: {
      name: `Election Day Test ${label}`,
      email: `election-day-test-${label}@pics.ng`,
      passwordHash,
      ...data,
    },
  });
}

function coordinatorProfile(branch: Branch) {
  return {
    level: "POLLING_UNIT" as const,
    stateId: OGUN_STATE_ID,
    senatorialDistrictId: branch.senatorialDistrictId,
    federalConstituencyId: branch.federalConstituencyId,
    stateConstituencyId: branch.stateConstituencyId,
    wardId: branch.wardId,
    pollingUnitId: branch.pollingUnitId,
  };
}

function agentProfile(branch: Branch, gpsTrackingConsentAt: Date | null) {
  return {
    stateId: OGUN_STATE_ID,
    senatorialDistrictId: branch.senatorialDistrictId,
    federalConstituencyId: branch.federalConstituencyId,
    stateConstituencyId: branch.stateConstituencyId,
    lgaId,
    wardId: branch.wardId,
    pollingUnitId: branch.pollingUnitId,
    gpsTrackingConsentAt,
  };
}

async function createFixtures() {
  const branchA = branches[0];
  const branchB = branches[1];

  stateOfficerEmail = (await createUser("state-officer", { role: "STATE_OFFICER" })).email;
  pucEmail = (await createUser("puc", {
    role: "COORDINATOR",
    coordinatorProfile: { create: coordinatorProfile(branchA) },
    agentProfile: { create: agentProfile(branchA, new Date()) },
  })).email;
  noConsentPucEmail = (await createUser("no-consent-puc", {
    role: "COORDINATOR",
    coordinatorProfile: { create: coordinatorProfile(branchB) },
    agentProfile: { create: agentProfile(branchB, null) },
  })).email;
  memberEmail = (await createUser("member", {
    role: "MEMBER",
    voterProfile: {
      create: {
        voterCardNumber: "ELECTION-DAY-TEST-MEMBER",
        referralCode: "EDAYTEST",
        stateId: OGUN_STATE_ID,
        senatorialDistrictId: branchA.senatorialDistrictId,
        federalConstituencyId: branchA.federalConstituencyId,
        stateConstituencyId: branchA.stateConstituencyId,
        lgaId,
        wardId: branchA.wardId,
        pollingUnitId: branchA.pollingUnitId,
      },
    },
  })).email;
}

const cases: Array<{ name: string; run: () => Promise<void> }> = [
  {
    name: "PUC check-in is idempotent and geofence evaluation remains gated without authoritative PU geodata",
    run: async () => {
      const token = await login(pucEmail);
      const first = await apiRequest("/election-day/check-in", {
        token,
        method: "POST",
        body: { latitude: 7.1601, longitude: 3.3483, accuracyMeters: 15, idempotencyKey: "eday-checkin-1" },
      });
      assert.equal(first.status, 201, JSON.stringify(first.payload));
      assert.equal((first.payload.geofence as { status: string }).status, "GATED_AUTHORITATIVE_PU_GEODATA_REQUIRED");

      const duplicate = await apiRequest("/election-day/check-in", {
        token,
        method: "POST",
        body: { latitude: 7.1601, longitude: 3.3483, accuracyMeters: 15, idempotencyKey: "eday-checkin-1" },
      });
      assert.equal(duplicate.status, 200, JSON.stringify(duplicate.payload));
      assert.equal(duplicate.payload.alreadyRecorded, true);

      const status = await apiRequest(`/election-day/my-status?reportDate=${today}`, { token });
      assert.equal(status.status, 200, JSON.stringify(status.payload));
      const pollingUnitStatus = status.payload.status as { checkedInAt: string | null; geofence: { status: string } };
      assert.ok(pollingUnitStatus.checkedInAt);
      assert.equal(pollingUnitStatus.geofence.status, "GATED_AUTHORITATIVE_PU_GEODATA_REQUIRED");
    },
  },
  {
    name: "location pings fail closed without GPS tracking consent",
    run: async () => {
      const token = await tokenWithoutGpsConsent(noConsentPucEmail, "election-day-no-consent-session");
      const result = await apiRequest("/election-day/location-pings", {
        token,
        method: "POST",
        body: { latitude: 7.1601, longitude: 3.3483, accuracyMeters: 20 },
      });
      assert.equal(result.status, 400);
      assert.match(String(result.payload.message), /GPS tracking consent is required/);
    },
  },
  {
    name: "Situation Room status is durable, territory scoped, and denies members",
    run: async () => {
      const stateToken = await login(stateOfficerEmail);
      const status = await apiRequest(`/election-day/situation-room/status?reportDate=${today}`, { token: stateToken });
      assert.equal(status.status, 200, JSON.stringify(status.payload));
      const situation = status.payload.status as {
        totals: { expectedPollingUnits: number; assignedPollingUnits: number; checkedInPollingUnits: number; missingCheckIns: number };
        alerts: Array<{ type: string }>;
        realtime: { runtimeStatus: string; restFallbackAvailable: boolean };
      };
      assert.equal(situation.totals.expectedPollingUnits, 2);
      assert.equal(situation.totals.assignedPollingUnits, 2);
      assert.equal(situation.totals.checkedInPollingUnits, 1);
      assert.equal(situation.totals.missingCheckIns, 1);
      assert.ok(situation.alerts.some((alert) => alert.type === "NO_CHECK_IN"));
      assert.equal(situation.realtime.runtimeStatus, "TARGET_NOT_RUNNING");
      assert.equal(situation.realtime.restFallbackAvailable, true);

      const memberToken = await login(memberEmail);
      const denied = await apiRequest("/election-day/situation-room/status", { token: memberToken });
      assert.equal(denied.status, 403);
    },
  },
  {
    name: "territory messaging foundation persists REST fallback messages for PUC recipients",
    run: async () => {
      const stateToken = await login(stateOfficerEmail);
      const created = await apiRequest("/election-day/messages/territory", {
        token: stateToken,
        method: "POST",
        body: { title: "Missing reports", message: "Submit Election Day status updates immediately." },
      });
      assert.equal(created.status, 201, JSON.stringify(created.payload));

      const pucToken = await login(pucEmail);
      const messages = await apiRequest("/election-day/messages", { token: pucToken });
      assert.equal(messages.status, 200, JSON.stringify(messages.payload));
      const broadcasts = messages.payload.broadcasts as Array<{ title: string }>;
      assert.ok(broadcasts.some((broadcast) => broadcast.title === "Missing reports"));
    },
  },
  {
    name: "alert reconciliation creates durable alert lifecycle events",
    run: async () => {
      const stateToken = await login(stateOfficerEmail);
      const reconciled = await apiRequest("/election-day/alerts/reconcile", {
        token: stateToken,
        method: "POST",
        body: { reportDate: today },
      });
      assert.equal(reconciled.status, 201, JSON.stringify(reconciled.payload));

      const alerts = await apiRequest(`/election-day/alerts?reportDate=${today}`, { token: stateToken });
      assert.equal(alerts.status, 200, JSON.stringify(alerts.payload));
      const visibleAlerts = alerts.payload.alerts as Array<{ id: string; type: string; status: string }>;
      const noCheckIn = visibleAlerts.find((alert) => alert.type === "NO_CHECK_IN");
      assert.ok(noCheckIn);

      const updated = await apiRequest(`/election-day/alerts/${noCheckIn.id}`, {
        token: stateToken,
        method: "PATCH",
        body: { status: "ACKNOWLEDGED", note: "Calling coordinator now." },
      });
      assert.equal(updated.status, 200, JSON.stringify(updated.payload));
      assert.equal((updated.payload.alert as { status: string }).status, "ACKNOWLEDGED");

      const outboxCount = await prisma.realtimeEventOutbox.count({
        where: { eventType: { in: ["election.alert.created", "election.alert.updated"] } },
      });
      assert.ok(outboxCount >= 2);
    },
  },
  {
    name: "direct Election Operations messaging is permission scoped and durable",
    run: async () => {
      const stateToken = await login(stateOfficerEmail);
      const puc = await prisma.user.findUniqueOrThrow({ where: { email: pucEmail }, select: { id: true } });
      const created = await apiRequest("/election-day/conversations", {
        token: stateToken,
        method: "POST",
        body: { type: "DIRECT", recipientUserId: puc.id, title: "PU check-in desk" },
      });
      assert.equal(created.status, 201, JSON.stringify(created.payload));
      const conversationId = created.payload.conversationId as string;

      const sent = await apiRequest(`/election-day/conversations/${conversationId}/messages`, {
        token: stateToken,
        method: "POST",
        body: { body: "Confirm PU status and report ETA." },
      });
      assert.equal(sent.status, 201, JSON.stringify(sent.payload));

      const pucToken = await login(pucEmail);
      const conversations = await apiRequest("/election-day/conversations", { token: pucToken });
      assert.equal(conversations.status, 200, JSON.stringify(conversations.payload));
      assert.ok((conversations.payload.conversations as Array<{ id: string }>).some((item) => item.id === conversationId));

      const messages = await apiRequest(`/election-day/conversations/${conversationId}/messages`, { token: pucToken });
      assert.equal(messages.status, 200, JSON.stringify(messages.payload));
      assert.equal((messages.payload.messages as Array<{ body: string }>)[0].body, "Confirm PU status and report ETA.");

      const memberToken = await login(memberEmail);
      const denied = await apiRequest(`/election-day/conversations/${conversationId}/messages`, {
        token: memberToken,
        method: "POST",
        body: { body: "Unauthorized message" },
      });
      assert.equal(denied.status, 403);
    },
  },
];

async function setup() {
  server = http.createServer(createApp());
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Election Day test server did not start.");
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
  await createCommandHierarchy();
  await createFixtures();
}

async function teardown() {
  await prisma.auditLog.deleteMany({ where: { actorUser: { email: { startsWith: "election-day-test-" } } } });
  await prisma.notification.deleteMany({ where: { user: { email: { startsWith: "election-day-test-" } } } });
  await prisma.messageReceipt.deleteMany({ where: { user: { email: { startsWith: "election-day-test-" } } } });
  await prisma.message.deleteMany({ where: { senderUser: { email: { startsWith: "election-day-test-" } } } });
  await prisma.conversationMember.deleteMany({ where: { user: { email: { startsWith: "election-day-test-" } } } });
  await prisma.conversation.deleteMany({ where: { createdByUser: { email: { startsWith: "election-day-test-" } } } });
  await prisma.operationalAlert.deleteMany({ where: { pollingUnitId: { startsWith: "election-day-test-" } } });
  await prisma.realtimeEventOutbox.deleteMany({ where: { OR: [{ idempotencyKey: { startsWith: "alert:" } }, { idempotencyKey: { startsWith: "alert-updated:" } }, { idempotencyKey: { startsWith: "message:" } }] } });
  await prisma.broadcastMessage.deleteMany({ where: { createdByUser: { email: { startsWith: "election-day-test-" } } } });
  await prisma.agentActivity.deleteMany({ where: { agentUser: { email: { startsWith: "election-day-test-" } } } });
  await prisma.incident.deleteMany({ where: { reportedByUser: { email: { startsWith: "election-day-test-" } } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: "election-day-test-" } } });
  await prisma.pollingUnit.deleteMany({ where: { id: { startsWith: "election-day-test-" } } });
  await prisma.ward.deleteMany({ where: { id: { startsWith: "election-day-test-" } } });
  await prisma.stateConstituency.deleteMany({ where: { id: { startsWith: "election-day-test-" } } });
  await prisma.federalConstituency.deleteMany({ where: { id: { startsWith: "election-day-test-" } } });
  await prisma.senatorialDistrict.deleteMany({ where: { id: { startsWith: "election-day-test-" } } });
  await prisma.lGA.deleteMany({ where: { id: { startsWith: "election-day-test-" } } });

  if (server) {
    await new Promise<void>((resolve, reject) => server!.close((error) => (error ? reject(error) : resolve())));
  }
}

export async function runElectionDayTests() {
  const failures: string[] = [];
  await setup();
  try {
    for (const testCase of cases) {
      try {
        await testCase.run();
        console.log(`PASS ${testCase.name}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${testCase.name}: ${message}`);
        console.error(`FAIL ${testCase.name}: ${message}`);
      }
    }
  } finally {
    await teardown();
  }
  if (failures.length > 0) {
    throw new Error(failures.join("\n"));
  }
}
