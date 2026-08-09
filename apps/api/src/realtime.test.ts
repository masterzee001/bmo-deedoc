import assert from "node:assert/strict";
import http from "node:http";
import type { Prisma } from "@prisma/client";
import { io as createSocketClient, type Socket as ClientSocket } from "socket.io-client";
import { OGUN_STATE_ID, type ElectionDayRealtimeEnvelope } from "@pics-nigeria/shared";
import { hashPassword } from "./auth/password";
import { signAccessToken } from "./auth/jwt";
import { getAuthUserProfile } from "./auth/profile";
import { createApp } from "./app";
import { prisma } from "./prisma";
import { createElectionDayRealtimeEvent } from "./realtime/events";
import { attachRealtimeGateway, closeRealtimeGateway, publishRealtimeEvent } from "./realtime/gateway";

type ApiResult = { status: number; payload: Record<string, unknown> };
type Branch = {
  senatorialDistrictId: string;
  federalConstituencyId: string;
  stateConstituencyId: string;
  wardId: string;
  pollingUnitId: string;
};

const password = "Realtime123!";
const lgaId = "realtime-test-lga";
let baseUrl = "";
let server: http.Server | null = null;
let stateOfficerEmail = "";
let wardAEmail = "";
let wardBEmail = "";
let memberEmail = "";
let branches: Branch[] = [];
let clients: ClientSocket[] = [];

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
  const result = await apiRequest("/auth/login", { method: "POST", body: { email, password } });
  assert.equal(result.status, 200, JSON.stringify(result.payload));
  assert.equal(typeof result.payload.token, "string");
  return result.payload.token as string;
}

async function tokenFor(email: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
  const profile = await getAuthUserProfile(user.id);
  assert.ok(profile);
  return signAccessToken(profile);
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
    create: { id: lgaId, name: "Realtime Test LGA", stateId: OGUN_STATE_ID },
  });
  await prisma.senatorialDistrict.upsert({
    where: { id: "realtime-test-senatorial" },
    update: {},
    create: { id: "realtime-test-senatorial", name: "Realtime Test Senatorial", stateId: OGUN_STATE_ID },
  });
  await prisma.federalConstituency.upsert({
    where: { id: "realtime-test-federal" },
    update: {},
    create: {
      id: "realtime-test-federal",
      name: "Realtime Test Federal",
      stateId: OGUN_STATE_ID,
      senatorialDistrictId: "realtime-test-senatorial",
    },
  });

  branches = [];
  for (let index = 1; index <= 2; index += 1) {
    const stateConstituencyId = `realtime-test-state-constituency-${index}`;
    const wardId = `realtime-test-ward-${index}`;
    const pollingUnitId = `realtime-test-pu-${index}`;
    await prisma.stateConstituency.upsert({
      where: { id: stateConstituencyId },
      update: { federalConstituencyId: "realtime-test-federal" },
      create: {
        id: stateConstituencyId,
        name: `Realtime Test State Constituency ${index}`,
        stateId: OGUN_STATE_ID,
        lgaId,
        federalConstituencyId: "realtime-test-federal",
      },
    });
    await prisma.ward.upsert({
      where: { id: wardId },
      update: { stateConstituencyId },
      create: {
        id: wardId,
        name: `Realtime Test Ward ${index}`,
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
        name: `Realtime Test PU ${index}`,
        stateId: OGUN_STATE_ID,
        lgaId,
        wardId,
      },
    });
    branches.push({
      senatorialDistrictId: "realtime-test-senatorial",
      federalConstituencyId: "realtime-test-federal",
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
      name: `Realtime Test ${label}`,
      email: `realtime-test-${label}@pics.ng`,
      passwordHash,
      ...data,
    },
  });
}

async function createFixtures() {
  const branchA = branches[0];
  const branchB = branches[1];
  stateOfficerEmail = (await createUser("state-officer", { role: "STATE_OFFICER" })).email;
  wardAEmail = (await createUser("ward-a", {
    role: "COORDINATOR",
    coordinatorProfile: {
      create: {
        level: "WARD",
        stateId: OGUN_STATE_ID,
        senatorialDistrictId: branchA.senatorialDistrictId,
        federalConstituencyId: branchA.federalConstituencyId,
        stateConstituencyId: branchA.stateConstituencyId,
        wardId: branchA.wardId,
      },
    },
  })).email;
  wardBEmail = (await createUser("ward-b", {
    role: "COORDINATOR",
    coordinatorProfile: {
      create: {
        level: "WARD",
        stateId: OGUN_STATE_ID,
        senatorialDistrictId: branchB.senatorialDistrictId,
        federalConstituencyId: branchB.federalConstituencyId,
        stateConstituencyId: branchB.stateConstituencyId,
        wardId: branchB.wardId,
      },
    },
  })).email;
  memberEmail = (await createUser("member", {
    role: "MEMBER",
    voterProfile: {
      create: {
        voterCardNumber: "REALTIME-TEST-MEMBER",
        referralCode: "RTTEST",
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

async function cleanupRealtimeFixtures() {
  await prisma.user.deleteMany({ where: { email: { startsWith: "realtime-test-" } } });
  await prisma.pollingUnit.deleteMany({ where: { id: { startsWith: "realtime-test-" } } });
  await prisma.ward.deleteMany({ where: { id: { startsWith: "realtime-test-" } } });
  await prisma.stateConstituency.deleteMany({ where: { id: { startsWith: "realtime-test-" } } });
  await prisma.federalConstituency.deleteMany({ where: { id: { startsWith: "realtime-test-" } } });
  await prisma.senatorialDistrict.deleteMany({ where: { id: { startsWith: "realtime-test-" } } });
  await prisma.lGA.deleteMany({ where: { id: { startsWith: "realtime-test-" } } });
}

async function connectSocket(token: string): Promise<ClientSocket> {
  const socket = createSocketClient(baseUrl, {
    path: "/socket.io",
    auth: { token },
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
  });
  clients.push(socket);

  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });

  return socket;
}

async function subscribe(socket: ClientSocket, territory: Branch | { stateId: string }) {
  return new Promise<Record<string, unknown>>((resolve) => {
    socket.emit("election.subscribe", { territory: { stateId: OGUN_STATE_ID, ...territory } }, resolve);
  });
}

function onceRealtimeEvent(socket: ClientSocket, timeoutMs = 500): Promise<ElectionDayRealtimeEnvelope | null> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      socket.off("realtime.event", handler);
      resolve(null);
    }, timeoutMs);
    const handler = (event: ElectionDayRealtimeEnvelope) => {
      clearTimeout(timeout);
      resolve(event);
    };
    socket.once("realtime.event", handler);
  });
}

const cases: Array<{ name: string; run: () => Promise<void> }> = [
  {
    name: "realtime contract reports degraded REST fallback when Redis is not configured",
    run: async () => {
      const token = await login(stateOfficerEmail);
      const result = await apiRequest("/election-day/realtime-contracts", { token });
      assert.equal(result.status, 200, JSON.stringify(result.payload));
      const realtime = result.payload.realtime as { runtimeStatus: string; redisAdapter: string; restFallbackAvailable: boolean };
      assert.equal(realtime.runtimeStatus, "DEGRADED_NO_REDIS");
      assert.equal(realtime.redisAdapter, "not_configured");
      assert.equal(realtime.restFallbackAvailable, true);
    },
  },
  {
    name: "socket subscriptions are authenticated and territory isolated",
    run: async () => {
      const [stateSocket, wardASocket, wardBSocket, memberSocket] = await Promise.all([
        connectSocket(await login(stateOfficerEmail)),
        connectSocket(await tokenFor(wardAEmail)),
        connectSocket(await tokenFor(wardBEmail)),
        connectSocket(await tokenFor(memberEmail)),
      ]);

      assert.equal((await subscribe(stateSocket, { stateId: OGUN_STATE_ID })).ok, true);
      assert.equal((await subscribe(wardASocket, branches[0])).ok, true);
      assert.equal((await subscribe(wardBSocket, branches[1])).ok, true);
      assert.equal((await subscribe(memberSocket, branches[0])).ok, false);

      const stateEvent = onceRealtimeEvent(stateSocket);
      const wardAEvent = onceRealtimeEvent(wardASocket);
      const wardBEvent = onceRealtimeEvent(wardBSocket, 150);
      publishRealtimeEvent(
        createElectionDayRealtimeEvent({
          eventType: "election.incident.created",
          actorUserId: null,
          territory: {
            stateId: OGUN_STATE_ID,
            senatorialDistrictId: branches[0].senatorialDistrictId,
            federalConstituencyId: branches[0].federalConstituencyId,
            stateConstituencyId: branches[0].stateConstituencyId,
            wardId: branches[0].wardId,
            pollingUnitId: branches[0].pollingUnitId,
          },
          idempotencyKey: "realtime-test-incident-1",
          payload: { incidentId: "realtime-test-incident-1", severity: "CRITICAL" },
        }),
      );

      assert.equal((await stateEvent)?.eventType, "election.incident.created");
      assert.equal((await wardAEvent)?.payload.incidentId, "realtime-test-incident-1");
      assert.equal(await wardBEvent, null);
    },
  },
];

async function setup() {
  server = http.createServer(createApp());
  await attachRealtimeGateway(server);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Realtime test server did not start.");
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
  await cleanupRealtimeFixtures();
  await createCommandHierarchy();
  await createFixtures();
}

async function teardown() {
  for (const client of clients) {
    client.disconnect();
  }
  clients = [];
  await cleanupRealtimeFixtures();
  await closeRealtimeGateway();

  if (server) {
    await new Promise<void>((resolve, reject) =>
      server!.close((error: NodeJS.ErrnoException | undefined) => {
        if (!error || error.code === "ERR_SERVER_NOT_RUNNING") {
          resolve();
          return;
        }
        reject(error);
      }),
    );
  }
}

export async function runRealtimeTests() {
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
