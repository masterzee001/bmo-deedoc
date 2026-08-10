import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  configureEvidenceObjectStorage,
  getEvidenceObjectStorage,
  InMemoryEvidenceObjectStorage,
  setEvidenceObjectStorageForTests,
} from "@pics-nigeria/object-storage";
import { EVIDENCE_DERIVATIVE_VIDEO_DEFERRED_REASON, OGUN_STATE_ID } from "@pics-nigeria/shared";
import sharp from "sharp";
import { generateEvidenceDerivatives } from "./jobs/evidence-derivatives";
import { prisma } from "./prisma";

const prefix = "worker-derivative-test-";
const lgaId = `${prefix}lga`;
const pollingUnitId = `${prefix}pu`;
const wardId = `${prefix}ward`;
let uploaderUserId = "";

async function createReferenceData() {
  await prisma.state.upsert({ where: { id: OGUN_STATE_ID }, update: {}, create: { id: OGUN_STATE_ID, name: "Ogun" } });
  await prisma.lGA.upsert({
    where: { id: lgaId },
    update: {},
    create: { id: lgaId, name: "Worker Derivative Test LGA", stateId: OGUN_STATE_ID },
  });
  await prisma.senatorialDistrict.upsert({
    where: { id: `${prefix}senatorial` },
    update: {},
    create: { id: `${prefix}senatorial`, name: "Worker Derivative Senatorial", stateId: OGUN_STATE_ID },
  });
  await prisma.federalConstituency.upsert({
    where: { id: `${prefix}federal` },
    update: {},
    create: {
      id: `${prefix}federal`,
      name: "Worker Derivative Federal",
      stateId: OGUN_STATE_ID,
      senatorialDistrictId: `${prefix}senatorial`,
    },
  });
  await prisma.stateConstituency.upsert({
    where: { id: `${prefix}state-constituency` },
    update: {},
    create: {
      id: `${prefix}state-constituency`,
      name: "Worker Derivative State Constituency",
      stateId: OGUN_STATE_ID,
      lgaId,
      federalConstituencyId: `${prefix}federal`,
    },
  });
  await prisma.ward.upsert({
    where: { id: wardId },
    update: {},
    create: {
      id: wardId,
      name: "Worker Derivative Ward",
      stateId: OGUN_STATE_ID,
      lgaId,
      stateConstituencyId: `${prefix}state-constituency`,
    },
  });
  await prisma.pollingUnit.upsert({
    where: { id: pollingUnitId },
    update: {},
    create: { id: pollingUnitId, name: "Worker Derivative PU", stateId: OGUN_STATE_ID, lgaId, wardId },
  });

  const user = await prisma.user.create({
    data: {
      name: "Worker Derivative Uploader",
      email: `${prefix}uploader@pics.ng`,
      passwordHash: "not-used-in-this-suite",
      role: "STATE_OFFICER",
    },
  });
  uploaderUserId = user.id;
}

async function createEvidenceAsset(input: { evidenceType: "PHOTO" | "VIDEO" | "WRITTEN_REPORT"; body: Buffer; key: string; mimeType: string }) {
  const storage = getEvidenceObjectStorage();
  await storage.putObjectIfAbsent({ key: input.key, body: input.body, contentType: input.mimeType });
  const sha256 = crypto.createHash("sha256").update(input.body).digest("hex");

  return prisma.evidenceAsset.create({
    data: {
      evidenceType: input.evidenceType,
      classification: "INCIDENT",
      originalStorageKey: input.key,
      storageBucket: storage.bucket,
      originalFileName: `${input.evidenceType.toLowerCase()}-original`,
      mimeType: input.mimeType,
      fileSize: input.body.byteLength,
      sha256,
      uploaderUserId,
      stateId: OGUN_STATE_ID,
      lgaId,
      wardId,
      pollingUnitId,
    },
  });
}

const cases: Array<{ name: string; run: () => Promise<void> }> = [
  {
    name: "photo evidence produces thumbnail and preview renditions without altering the original",
    run: async () => {
      const original = await sharp({
        create: { width: 2000, height: 1200, channels: 3, background: { r: 12, g: 90, b: 140 } },
      })
        .jpeg()
        .toBuffer();
      const key = "election-evidence/original/worker-test/photo.jpg";
      const asset = await createEvidenceAsset({ evidenceType: "PHOTO", body: original, key, mimeType: "image/jpeg" });

      const result = await generateEvidenceDerivatives({ evidenceAssetId: asset.id });
      assert.ok("generated" in result && result.generated?.length === 2, JSON.stringify(result));

      const rows = await prisma.evidenceDerivative.findMany({ where: { evidenceAssetId: asset.id }, orderBy: { kind: "asc" } });
      assert.equal(rows.length, 2);
      for (const row of rows) {
        assert.equal(row.status, "READY");
        assert.equal(row.mimeType, "image/jpeg");
        assert.ok(row.storageKey && row.storageKey.startsWith("derivatives/"), "derivatives must use a separate key prefix");
        assert.ok(row.sha256 && /^[a-f0-9]{64}$/.test(row.sha256));
        assert.ok(row.generatedAt);
      }

      const preview = rows.find((row) => row.kind === "PREVIEW")!;
      const thumbnail = rows.find((row) => row.kind === "THUMBNAIL")!;
      assert.equal(preview.width, 1280);
      assert.equal(thumbnail.width, 320);
      // Aspect ratio is preserved rather than cropped, so a derivative never
      // silently removes content from the evidentiary frame.
      assert.equal(thumbnail.height, Math.round((1200 / 2000) * 320));

      // The authoritative original must be byte-identical after derivation.
      const storage = getEvidenceObjectStorage();
      const stored = await storage.getObject(key);
      assert.ok(stored);
      assert.equal(crypto.createHash("sha256").update(stored.body).digest("hex"), asset.sha256);
    },
  },
  {
    name: "derivative generation is idempotent and safe to retry",
    run: async () => {
      const original = await sharp({
        create: { width: 800, height: 600, channels: 3, background: { r: 200, g: 40, b: 40 } },
      })
        .jpeg()
        .toBuffer();
      const key = "election-evidence/original/worker-test/retry.jpg";
      const asset = await createEvidenceAsset({ evidenceType: "PHOTO", body: original, key, mimeType: "image/jpeg" });

      await generateEvidenceDerivatives({ evidenceAssetId: asset.id });
      // A retry hits the storage overwrite denial; it must be treated as success
      // rather than surfacing as a failed derivative.
      const second = await generateEvidenceDerivatives({ evidenceAssetId: asset.id });
      assert.ok("generated" in second && second.generated?.length === 2);

      const rows = await prisma.evidenceDerivative.findMany({ where: { evidenceAssetId: asset.id } });
      assert.equal(rows.length, 2, "retry must not create duplicate rendition rows");
      assert.ok(rows.every((row) => row.status === "READY"));
    },
  },
  {
    name: "video evidence records an explicit deferral instead of a false failure",
    run: async () => {
      const body = Buffer.from("not-a-real-video-payload");
      const key = "election-evidence/original/worker-test/clip.mp4";
      const asset = await createEvidenceAsset({ evidenceType: "VIDEO", body, key, mimeType: "video/mp4" });

      const result = await generateEvidenceDerivatives({ evidenceAssetId: asset.id });
      assert.ok("deferred" in result);

      const rows = await prisma.evidenceDerivative.findMany({ where: { evidenceAssetId: asset.id } });
      assert.equal(rows.length, 1);
      assert.equal(rows[0].kind, "POSTER");
      assert.equal(rows[0].status, "DEFERRED");
      assert.equal(rows[0].deferredReason, EVIDENCE_DERIVATIVE_VIDEO_DEFERRED_REASON);
      assert.equal(rows[0].lastError, null, "a deferral is not an error");
    },
  },
  {
    name: "written report evidence produces no derivative",
    run: async () => {
      const body = Buffer.from("A written field report.");
      const key = "election-evidence/original/worker-test/report.txt";
      const asset = await createEvidenceAsset({ evidenceType: "WRITTEN_REPORT", body, key, mimeType: "text/plain" });

      const result = await generateEvidenceDerivatives({ evidenceAssetId: asset.id });
      assert.ok("skipped" in result);
      assert.equal(await prisma.evidenceDerivative.count({ where: { evidenceAssetId: asset.id } }), 0);
    },
  },
  {
    name: "derivation refuses to run when the stored original does not match its recorded hash",
    run: async () => {
      const original = await sharp({
        create: { width: 400, height: 400, channels: 3, background: { r: 5, g: 5, b: 5 } },
      })
        .jpeg()
        .toBuffer();
      const key = "election-evidence/original/worker-test/tampered.jpg";
      const asset = await createEvidenceAsset({ evidenceType: "PHOTO", body: original, key, mimeType: "image/jpeg" });

      // Simulate a substituted or corrupted object: the recorded hash no longer
      // describes the bytes in storage.
      await prisma.evidenceAsset.update({
        where: { id: asset.id },
        data: { sha256: crypto.createHash("sha256").update("different bytes").digest("hex") },
      });

      await assert.rejects(() => generateEvidenceDerivatives({ evidenceAssetId: asset.id }), /hash mismatch/i);
      assert.equal(await prisma.evidenceDerivative.count({ where: { evidenceAssetId: asset.id, status: "READY" } }), 0);
    },
  },
  {
    name: "a job for a removed evidence asset is skipped rather than dead-lettered",
    run: async () => {
      const result = await generateEvidenceDerivatives({ evidenceAssetId: "worker-derivative-test-missing-asset" });
      assert.deepEqual(result, { skipped: "EVIDENCE_ASSET_NOT_FOUND" });
    },
  },
];

async function setup() {
  configureEvidenceObjectStorage({
    driver: "memory",
    endpoint: "",
    region: "",
    bucket: "worker-derivative-test-bucket",
    accessKey: "",
    secretKey: "",
    forcePathStyle: false,
    isTest: true,
  });
  setEvidenceObjectStorageForTests(new InMemoryEvidenceObjectStorage("worker-derivative-test-bucket"));
  await teardown();
  await createReferenceData();
}

async function teardown() {
  await prisma.evidenceDerivative.deleteMany({ where: { evidenceAsset: { uploaderUser: { email: { startsWith: prefix } } } } });
  await prisma.evidenceAsset.deleteMany({ where: { uploaderUser: { email: { startsWith: prefix } } } });
  await prisma.backgroundJob.deleteMany({ where: { idempotencyKey: { startsWith: "worker-derivative-test" } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: prefix } } });
  await prisma.pollingUnit.deleteMany({ where: { id: { startsWith: prefix } } });
  await prisma.ward.deleteMany({ where: { id: { startsWith: prefix } } });
  await prisma.stateConstituency.deleteMany({ where: { id: { startsWith: prefix } } });
  await prisma.federalConstituency.deleteMany({ where: { id: { startsWith: prefix } } });
  await prisma.senatorialDistrict.deleteMany({ where: { id: { startsWith: prefix } } });
  await prisma.lGA.deleteMany({ where: { id: { startsWith: prefix } } });
}

export async function runWorkerDerivativeTests() {
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
    await prisma.$disconnect();
  }
  if (failures.length > 0) {
    throw new Error(failures.join("\n"));
  }
}
