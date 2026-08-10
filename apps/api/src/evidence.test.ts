import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import type { Prisma } from "@prisma/client";
import { OGUN_STATE_ID } from "@pics-nigeria/shared";
import { signAccessToken } from "./auth/jwt";
import { hashPassword } from "./auth/password";
import { getAuthUserProfile } from "./auth/profile";
import { createApp } from "./app";
import { prisma } from "./prisma";
import {
  EvidenceObjectAlreadyExistsError,
  InMemoryEvidenceObjectStorage,
  setEvidenceObjectStorageForTests,
} from "./storage/evidence-storage";

type ApiResult = { status: number; payload: Record<string, unknown> };
type Branch = {
  senatorialDistrictId: string;
  federalConstituencyId: string;
  stateConstituencyId: string;
  wardId: string;
  pollingUnitId: string;
};

const password = "EvidenceTest123!";
const lgaId = "evidence-test-lga";
let baseUrl = "";
let server: http.Server | null = null;
let stateOfficerEmail = "";
let pucEmail = "";
let memberEmail = "";
let branch: Branch;
let storage: InMemoryEvidenceObjectStorage;
let uploadedEvidenceId = "";
let uploadedIncidentId = "";

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
  return result.payload.token as string;
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
    create: { id: lgaId, name: "Evidence Test LGA", stateId: OGUN_STATE_ID },
  });
  await prisma.senatorialDistrict.upsert({
    where: { id: "evidence-test-senatorial" },
    update: {},
    create: { id: "evidence-test-senatorial", name: "Evidence Test Senatorial", stateId: OGUN_STATE_ID },
  });
  await prisma.federalConstituency.upsert({
    where: { id: "evidence-test-federal" },
    update: {},
    create: {
      id: "evidence-test-federal",
      name: "Evidence Test Federal",
      stateId: OGUN_STATE_ID,
      senatorialDistrictId: "evidence-test-senatorial",
    },
  });
  await prisma.stateConstituency.upsert({
    where: { id: "evidence-test-state-constituency" },
    update: { federalConstituencyId: "evidence-test-federal" },
    create: {
      id: "evidence-test-state-constituency",
      name: "Evidence Test State Constituency",
      stateId: OGUN_STATE_ID,
      lgaId,
      federalConstituencyId: "evidence-test-federal",
    },
  });
  await prisma.ward.upsert({
    where: { id: "evidence-test-ward" },
    update: { stateConstituencyId: "evidence-test-state-constituency" },
    create: {
      id: "evidence-test-ward",
      name: "Evidence Test Ward",
      stateId: OGUN_STATE_ID,
      lgaId,
      stateConstituencyId: "evidence-test-state-constituency",
    },
  });
  await prisma.pollingUnit.upsert({
    where: { id: "evidence-test-pu" },
    update: {},
    create: {
      id: "evidence-test-pu",
      name: "Evidence Test PU",
      stateId: OGUN_STATE_ID,
      lgaId,
      wardId: "evidence-test-ward",
    },
  });

  branch = {
    senatorialDistrictId: "evidence-test-senatorial",
    federalConstituencyId: "evidence-test-federal",
    stateConstituencyId: "evidence-test-state-constituency",
    wardId: "evidence-test-ward",
    pollingUnitId: "evidence-test-pu",
  };
}

async function createUser(label: string, data: Omit<Prisma.UserCreateInput, "name" | "email" | "passwordHash">) {
  const passwordHash = await hashPassword(password);
  return prisma.user.create({
    data: {
      name: `Evidence Test ${label}`,
      email: `evidence-test-${label}@pics.ng`,
      passwordHash,
      ...data,
    },
  });
}

function coordinatorProfile() {
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

function agentProfile() {
  return {
    stateId: OGUN_STATE_ID,
    senatorialDistrictId: branch.senatorialDistrictId,
    federalConstituencyId: branch.federalConstituencyId,
    stateConstituencyId: branch.stateConstituencyId,
    lgaId,
    wardId: branch.wardId,
    pollingUnitId: branch.pollingUnitId,
    gpsTrackingConsentAt: new Date(),
  };
}

async function createFixtures() {
  stateOfficerEmail = (await createUser("state-officer", { role: "STATE_OFFICER" })).email;
  pucEmail = (await createUser("puc", {
    role: "COORDINATOR",
    coordinatorProfile: { create: coordinatorProfile() },
    agentProfile: { create: agentProfile() },
  })).email;
  memberEmail = (await createUser("member", {
    role: "MEMBER",
    voterProfile: {
      create: {
        voterCardNumber: "EVIDENCE-TEST-MEMBER",
        referralCode: "EVITEST",
        stateId: OGUN_STATE_ID,
        senatorialDistrictId: branch.senatorialDistrictId,
        federalConstituencyId: branch.federalConstituencyId,
        stateConstituencyId: branch.stateConstituencyId,
        lgaId,
        wardId: branch.wardId,
        pollingUnitId: branch.pollingUnitId,
      },
    },
  })).email;
}

const cases: Array<{ name: string; run: () => Promise<void> }> = [
  {
    name: "storage test double denies overwrites and never uses filesystem authority",
    run: async () => {
      const object = await storage.putObjectIfAbsent({
        key: "election-evidence/original/test/no-overwrite.txt",
        body: Buffer.from("original"),
        contentType: "text/plain",
      });
      assert.equal(object.sha256, crypto.createHash("sha256").update("original").digest("hex"));
      await assert.rejects(
        () =>
          storage.putObjectIfAbsent({
            key: "election-evidence/original/test/no-overwrite.txt",
            body: Buffer.from("replacement"),
            contentType: "text/plain",
          }),
        EvidenceObjectAlreadyExistsError,
      );

      const token = await login(stateOfficerEmail);
      const health = await apiRequest("/evidence/storage/health", { token });
      assert.equal(health.status, 200, JSON.stringify(health.payload));
      const storageHealth = health.payload.storage as {
        runtime: string;
        authoritativeEvidenceFilesystem: boolean;
        originalOverwritePolicy: string;
      };
      assert.equal(storageHealth.runtime, "memory");
      assert.equal(storageHealth.authoritativeEvidenceFilesystem, false);
      assert.equal(storageHealth.originalOverwritePolicy, "DENY_IF_OBJECT_EXISTS");
    },
  },
  {
    name: "PUC uploads incident evidence with server SHA-256, unique object key, metadata, and custody",
    run: async () => {
      const token = await login(pucEmail);
      const incident = await apiRequest("/election-day/incidents", {
        token,
        method: "POST",
        body: {
          type: "SECURITY_CONCERN",
          title: "Queue disruption",
          description: "A disruption was reported near the queue entrance.",
          severity: "HIGH",
          pollingUnitId: branch.pollingUnitId,
          latitude: 7.1,
          longitude: 3.2,
        },
      });
      assert.equal(incident.status, 201, JSON.stringify(incident.payload));
      uploadedIncidentId = (incident.payload.incident as { id: string }).id;

      const original = Buffer.from("authoritative photo bytes");
      const upload = await apiRequest("/evidence/uploads/finalize", {
        token,
        method: "POST",
        body: {
          evidenceType: "PHOTO",
          classification: "INCIDENT",
          originalFileName: "incident-photo.jpg",
          mimeType: "image/jpeg",
          contentBase64: original.toString("base64"),
          pollingUnitId: branch.pollingUnitId,
          incidentId: uploadedIncidentId,
          latitude: 7.1,
          longitude: 3.2,
          metadata: { deviceId: "field-device-1" },
        },
      });
      assert.equal(upload.status, 201, JSON.stringify(upload.payload));
      const evidence = upload.payload.evidence as {
        id: string;
        sha256: string;
        originalStorageKey: string;
        storageBucket: string;
        originalAccess: { publicUrl: string | null; signedAccessRequired: boolean };
        custodyEvents: Array<{ eventType: string }>;
      };
      uploadedEvidenceId = evidence.id;
      assert.equal(evidence.sha256, crypto.createHash("sha256").update(original).digest("hex"));
      assert.match(evidence.originalStorageKey, /^election-evidence\/original\/\d{4}\/\d{2}\/\d{2}\//);
      assert.equal(evidence.storageBucket, "evidence-test-bucket");
      assert.equal(evidence.originalAccess.publicUrl, null);
      assert.equal(evidence.originalAccess.signedAccessRequired, true);

      const row = await prisma.evidenceAsset.findUniqueOrThrow({
        where: { id: uploadedEvidenceId },
        include: { custodyEvents: true },
      });
      assert.equal(row.fileSize, original.byteLength);
      assert.equal(row.incidentId, uploadedIncidentId);
      assert.equal(row.pollingUnitId, branch.pollingUnitId);
      assert.equal(row.custodyEvents.some((event) => event.eventType === "UPLOADED"), true);
      assert.equal(await storage.getObject(row.originalStorageKey).then((item) => item?.sha256), row.sha256);
    },
  },
  {
    name: "private signed access verifies storage hash and writes access audit/custody",
    run: async () => {
      const token = await login(stateOfficerEmail);
      const access = await apiRequest(`/evidence/${uploadedEvidenceId}/access`, {
        token,
        method: "POST",
        body: { action: "DOWNLOAD", expiresInSeconds: 120 },
      });
      assert.equal(access.status, 200, JSON.stringify(access.payload));
      const signed = access.payload.access as { signedUrl: string; publicUrl: string | null; storageKey: string };
      assert.match(signed.signedUrl, /^memory:\/\/evidence\//);
      assert.equal(signed.publicUrl, null);
      assert.ok(signed.storageKey.includes(uploadedEvidenceId));

      const custodyCount = await prisma.evidenceCustodyEvent.count({
        where: { evidenceAssetId: uploadedEvidenceId, eventType: "DOWNLOADED" },
      });
      assert.equal(custodyCount, 1);
      const auditCount = await prisma.auditLog.count({
        where: { targetId: uploadedEvidenceId, action: "EVIDENCE_DOWNLOAD" },
      });
      assert.equal(auditCount, 1);

      const memberToken = await login(memberEmail);
      const denied = await apiRequest(`/evidence/${uploadedEvidenceId}/access`, {
        token: memberToken,
        method: "POST",
        body: { action: "VIEW" },
      });
      assert.equal(denied.status, 404);
    },
  },
  {
    name: "review transitions and manual custody events are preserved",
    run: async () => {
      const token = await login(stateOfficerEmail);
      const review = await apiRequest(`/evidence/${uploadedEvidenceId}/review`, {
        token,
        method: "POST",
        body: { status: "VERIFIED", classification: "SECURITY", note: "Reviewed against incident record." },
      });
      assert.equal(review.status, 200, JSON.stringify(review.payload));
      const evidence = review.payload.evidence as { reviewStatus: string; classification: string };
      assert.equal(evidence.reviewStatus, "VERIFIED");
      assert.equal(evidence.classification, "SECURITY");

      const custody = await apiRequest(`/evidence/${uploadedEvidenceId}/custody-events`, {
        token,
        method: "POST",
        body: { eventType: "REVIEWED", metadata: { reviewDesk: "state" } },
      });
      assert.equal(custody.status, 201, JSON.stringify(custody.payload));
      const custodyEvents = await prisma.evidenceCustodyEvent.findMany({ where: { evidenceAssetId: uploadedEvidenceId } });
      assert.ok(custodyEvents.some((event) => event.eventType === "CLASSIFIED"));
      assert.ok(custodyEvents.some((event) => event.eventType === "REVIEWED"));
    },
  },
  {
    name: "PU timeline and dossier include evidence, incidents, hashes, and no legal conclusion",
    run: async () => {
      const token = await login(stateOfficerEmail);
      const timeline = await apiRequest(`/evidence/polling-units/${branch.pollingUnitId}/timeline`, { token });
      assert.equal(timeline.status, 200, JSON.stringify(timeline.payload));
      const events = timeline.payload.timeline as Array<{ type: string; id: string; sha256?: string }>;
      assert.ok(events.some((event) => event.type === "INCIDENT" && event.id === uploadedIncidentId));
      assert.ok(events.some((event) => event.type === "EVIDENCE" && event.id === uploadedEvidenceId && event.sha256));

      const dossier = await apiRequest(`/evidence/polling-units/${branch.pollingUnitId}/dossier`, { token });
      assert.equal(dossier.status, 200, JSON.stringify(dossier.payload));
      const payload = dossier.payload.dossier as {
        completeness: { evidenceCount: number; incidentCount: number; custodyEventCount: number };
        evidence: Array<{ id: string; sha256: string }>;
        legalConclusion: null;
      };
      assert.equal(payload.completeness.evidenceCount, 1);
      assert.equal(payload.completeness.incidentCount, 1);
      assert.ok(payload.completeness.custodyEventCount >= 4);
      assert.ok(payload.evidence.some((item) => item.id === uploadedEvidenceId && item.sha256));
      assert.equal(payload.legalConclusion, null);
    },
  },
  {
    name: "evidence explorer and ward aggregation expose scoped post-election discovery",
    run: async () => {
      const token = await login(stateOfficerEmail);
      const explorer = await apiRequest(`/evidence?search=${encodeURIComponent(uploadedEvidenceId)}&limit=25`, { token });
      assert.equal(explorer.status, 200, JSON.stringify(explorer.payload));
      const evidence = explorer.payload.evidence as Array<{ id: string; sha256: string; originalAccess: { signedAccessRequired: boolean } }>;
      const summary = explorer.payload.summary as { total: number; byType: Record<string, number>; byReviewStatus: Record<string, number> };
      assert.ok(evidence.some((item) => item.id === uploadedEvidenceId && item.sha256));
      assert.equal(evidence[0].originalAccess.signedAccessRequired, true);
      assert.ok(summary.total >= 1);
      assert.ok(summary.byType.PHOTO >= 1);
      assert.ok(summary.byReviewStatus.VERIFIED >= 1);

      const aggregation = await apiRequest("/evidence/aggregation?groupBy=WARD", { token });
      assert.equal(aggregation.status, 200, JSON.stringify(aggregation.payload));
      const groups = aggregation.payload.aggregation as Array<{ territoryKind: string; territoryId: string; evidenceCount: number }>;
      assert.ok(groups.some((item) => item.territoryKind === "WARD" && item.territoryId === branch.wardId && item.evidenceCount >= 1));
    },
  },
  {
    name: "legal-support association and controlled manifest export are audited",
    run: async () => {
      const token = await login(stateOfficerEmail);
      const legal = await apiRequest("/evidence/legal-cases", {
        token,
        method: "POST",
        body: {
          title: "Evidence review workspace",
          description: "Workspace for controlled legal support organization.",
          pollingUnitId: branch.pollingUnitId,
          evidenceAssetIds: [uploadedEvidenceId],
          note: "Initial association.",
        },
      });
      assert.equal(legal.status, 201, JSON.stringify(legal.payload));
      const legalCaseId = (legal.payload.legalCase as { id: string }).id;
      assert.equal(legal.payload.noLegalConclusion, true);

      const manifestExport = await apiRequest("/evidence/exports/manifest", {
        token,
        method: "POST",
        body: {
          legalCaseId,
          evidenceAssetIds: [uploadedEvidenceId],
          purpose: "Controlled legal-support manifest test",
        },
      });
      assert.equal(manifestExport.status, 201, JSON.stringify(manifestExport.payload));
      const evidencePackage = manifestExport.payload.evidencePackage as { id: string; itemCount: number; manifestSha256: string };
      const manifest = manifestExport.payload.manifest as { archivePackagingStatus: string; items: Array<{ evidenceAssetId: string; sha256: string }> };
      assert.equal(evidencePackage.itemCount, 1);
      assert.equal(manifest.archivePackagingStatus, "TARGET_LATER_MANIFEST_ONLY");
      assert.equal(manifest.items[0].evidenceAssetId, uploadedEvidenceId);
      assert.match(evidencePackage.manifestSha256, /^[a-f0-9]{64}$/);

      const cases = await apiRequest("/evidence/legal-cases", { token });
      assert.equal(cases.status, 200, JSON.stringify(cases.payload));
      const legalCases = cases.payload.legalCases as Array<{ id: string; evidenceCount: number; legalConclusion: null }>;
      assert.ok(legalCases.some((item) => item.id === legalCaseId && item.evidenceCount === 1 && item.legalConclusion === null));

      const verification = await apiRequest("/evidence/exports/verify-manifest", {
        token,
        method: "POST",
        body: {
          manifest,
          manifestSha256: evidencePackage.manifestSha256,
        },
      });
      assert.equal(verification.status, 200, JSON.stringify(verification.payload));
      assert.equal((verification.payload as { verified: boolean }).verified, true);

      const exportedEvents = await prisma.evidenceCustodyEvent.count({
        where: { evidenceAssetId: uploadedEvidenceId, eventType: "EXPORTED" },
      });
      assert.equal(exportedEvents, 1);
      const packageItems = await prisma.evidencePackageItem.count({ where: { evidencePackageId: evidencePackage.id } });
      assert.equal(packageItems, 1);
    },
  },
];

async function setup() {
  storage = new InMemoryEvidenceObjectStorage("evidence-test-bucket");
  setEvidenceObjectStorageForTests(storage);
  server = http.createServer(createApp());
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Evidence test server did not start.");
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
  await createCommandHierarchy();
  await createFixtures();
}

async function teardown() {
  await prisma.evidencePackageItem.deleteMany({ where: { evidenceAsset: { uploaderUser: { email: { startsWith: "evidence-test-" } } } } });
  await prisma.evidencePackage.deleteMany({ where: { createdByUser: { email: { startsWith: "evidence-test-" } } } });
  await prisma.caseEvidence.deleteMany({ where: { evidenceAsset: { uploaderUser: { email: { startsWith: "evidence-test-" } } } } });
  await prisma.legalCaseNote.deleteMany({ where: { authorUser: { email: { startsWith: "evidence-test-" } } } });
  await prisma.legalCase.deleteMany({ where: { createdByUser: { email: { startsWith: "evidence-test-" } } } });
  await prisma.evidenceCustodyEvent.deleteMany({ where: { evidenceAsset: { uploaderUser: { email: { startsWith: "evidence-test-" } } } } });
  await prisma.evidenceAsset.deleteMany({ where: { uploaderUser: { email: { startsWith: "evidence-test-" } } } });
  await prisma.auditLog.deleteMany({ where: { actorUser: { email: { startsWith: "evidence-test-" } } } });
  await prisma.incident.deleteMany({ where: { reportedByUser: { email: { startsWith: "evidence-test-" } } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: "evidence-test-" } } });
  await prisma.pollingUnit.deleteMany({ where: { id: { startsWith: "evidence-test-" } } });
  await prisma.ward.deleteMany({ where: { id: { startsWith: "evidence-test-" } } });
  await prisma.stateConstituency.deleteMany({ where: { id: { startsWith: "evidence-test-" } } });
  await prisma.federalConstituency.deleteMany({ where: { id: { startsWith: "evidence-test-" } } });
  await prisma.senatorialDistrict.deleteMany({ where: { id: { startsWith: "evidence-test-" } } });
  await prisma.lGA.deleteMany({ where: { id: { startsWith: "evidence-test-" } } });
  setEvidenceObjectStorageForTests(null);

  if (server) {
    await new Promise<void>((resolve, reject) => server!.close((error) => (error ? reject(error) : resolve())));
  }
}

export async function runEvidenceTests() {
  const failures: string[] = [];
  await setup();
  try {
    const profile = await getAuthUserProfile((await prisma.user.findUniqueOrThrow({ where: { email: stateOfficerEmail } })).id);
    assert.ok(profile);
    signAccessToken(profile);

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
