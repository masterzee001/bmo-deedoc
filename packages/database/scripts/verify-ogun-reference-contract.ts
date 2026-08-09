import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  OGUN_REFERENCE_IMPORT_CONTRACT_VERSION,
  OGUN_STATE_ID,
  type OgunReferenceReleaseManifest,
} from "@pics-nigeria/shared";
import { validateGeodataRelease, validateIdentityRelease } from "./import-ogun-reference-release";

function sha256(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

function csv(headers: string[], rows: string[][]) {
  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n") + "\n";
}

function writeRelease(files: Record<string, string>) {
  const dir = mkdtempSync(path.join(tmpdir(), "ogun-reference-contract-"));
  for (const [fileName, content] of Object.entries(files)) {
    writeFileSync(path.join(dir, fileName), content, "utf8");
  }
  return dir;
}

function identityManifest(files: Record<string, string>): OgunReferenceReleaseManifest {
  return {
    contractVersion: OGUN_REFERENCE_IMPORT_CONTRACT_VERSION,
    releaseId: "test-ogun-identity",
    kind: "OGUN_IDENTITY",
    stateId: OGUN_STATE_ID,
    publisher: "Test",
    retrievedAt: "2026-08-09T00:00:00.000Z",
    approvedBy: "Test Reviewer",
    approvedAt: "2026-08-09T00:00:00.000Z",
    sourceCodeNamespaces: ["INEC_TEST"],
    declaredCounts: { stateConstituencies: 1, lgas: 1, wards: 1, pollingUnits: 1 },
    files: {
      territories: { path: "territories.csv", sha256: sha256(files["territories.csv"]) },
      commandRelationships: { path: "command-relationships.csv", sha256: sha256(files["command-relationships.csv"]) },
      lgaMemberships: { path: "lga-memberships.csv", sha256: sha256(files["lga-memberships.csv"]) },
    },
  };
}

function geodataManifest(files: Record<string, string>): OgunReferenceReleaseManifest {
  return {
    contractVersion: OGUN_REFERENCE_IMPORT_CONTRACT_VERSION,
    releaseId: "test-ogun-geodata",
    kind: "OGUN_POLLING_UNIT_GEODATA",
    stateId: OGUN_STATE_ID,
    publisher: "Test",
    retrievedAt: "2026-08-09T00:00:00.000Z",
    approvedBy: "Test Reviewer",
    approvedAt: "2026-08-09T00:00:00.000Z",
    sourceCodeNamespaces: ["INEC_TEST"],
    declaredCounts: { geocodedPollingUnits: 1 },
    files: {
      pollingUnitGeodata: { path: "polling-unit-geodata.csv", sha256: sha256(files["polling-unit-geodata.csv"]) },
    },
  };
}

function validIdentityFiles() {
  return {
    "territories.csv": csv(
      [
        "kind",
        "canonicalId",
        "stateId",
        "name",
        "sourceCodeNamespace",
        "sourceCode",
        "aliases",
        "lgaId",
        "federalConstituencyId",
        "stateConstituencyId",
        "wardId",
      ],
      [
        ["LGA", "test-lga", OGUN_STATE_ID, "Test LGA", "INEC_TEST", "LGA-1", "", "", "", "", ""],
        ["STATE_CONSTITUENCY", "test-state-constituency", OGUN_STATE_ID, "Test State Constituency", "INEC_TEST", "SC-1", "", "test-lga", "test-federal", "", ""],
        ["WARD", "test-ward", OGUN_STATE_ID, "Test Ward", "INEC_TEST", "WARD-1", "", "test-lga", "", "test-state-constituency", ""],
        ["POLLING_UNIT", "test-pu", OGUN_STATE_ID, "Test PU", "INEC_TEST", "PU-1", "", "test-lga", "", "", "test-ward"],
      ],
    ),
    "command-relationships.csv": csv(
      ["parentKind", "parentId", "childKind", "childId"],
      [
        ["FEDERAL_CONSTITUENCY", "test-federal", "STATE_CONSTITUENCY", "test-state-constituency"],
        ["STATE_CONSTITUENCY", "test-state-constituency", "WARD", "test-ward"],
        ["WARD", "test-ward", "POLLING_UNIT", "test-pu"],
      ],
    ),
    "lga-memberships.csv": csv(
      ["territoryKind", "territoryId", "lgaId"],
      [["STATE_CONSTITUENCY", "test-state-constituency", "test-lga"]],
    ),
  };
}

function assertIdentityFailure(label: string, files: Record<string, string>, pattern: RegExp) {
  const dir = writeRelease(files);
  try {
    const result = validateIdentityRelease(dir, identityManifest(files));
    assert.equal(result.value, null, label);
    assert.match(result.failures.join("\n"), pattern, label);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function main() {
  const validFiles = validIdentityFiles();
  const validDir = writeRelease(validFiles);
  try {
    const valid = validateIdentityRelease(validDir, identityManifest(validFiles));
    assert.deepEqual(valid.failures, []);
    assert.ok(valid.value);
  } finally {
    rmSync(validDir, { recursive: true, force: true });
  }

  assertIdentityFailure(
    "LGA cannot be a command parent",
    {
      ...validFiles,
      "command-relationships.csv": csv(
        ["parentKind", "parentId", "childKind", "childId"],
        [
          ["FEDERAL_CONSTITUENCY", "test-federal", "STATE_CONSTITUENCY", "test-state-constituency"],
          ["LGA", "test-lga", "WARD", "test-ward"],
          ["WARD", "test-ward", "POLLING_UNIT", "test-pu"],
        ],
      ),
    },
    /LGA is reference-only/,
  );

  assertIdentityFailure(
    "conflicting command parents are blocked",
    {
      ...validFiles,
      "command-relationships.csv": csv(
        ["parentKind", "parentId", "childKind", "childId"],
        [
          ["FEDERAL_CONSTITUENCY", "test-federal", "STATE_CONSTITUENCY", "test-state-constituency"],
          ["FEDERAL_CONSTITUENCY", "test-federal-other", "STATE_CONSTITUENCY", "test-state-constituency"],
          ["STATE_CONSTITUENCY", "test-state-constituency", "WARD", "test-ward"],
          ["WARD", "test-ward", "POLLING_UNIT", "test-pu"],
        ],
      ),
    },
    /exactly one FEDERAL_CONSTITUENCY command parent/,
  );

  assertIdentityFailure(
    "unknown relationship children are blocked",
    {
      ...validFiles,
      "command-relationships.csv": csv(
        ["parentKind", "parentId", "childKind", "childId"],
        [
          ["FEDERAL_CONSTITUENCY", "test-federal", "STATE_CONSTITUENCY", "test-state-constituency"],
          ["STATE_CONSTITUENCY", "test-state-constituency", "WARD", "missing-ward"],
          ["WARD", "test-ward", "POLLING_UNIT", "test-pu"],
        ],
      ),
    },
    /unknown child territory missing-ward/,
  );

  assertIdentityFailure(
    "duplicate LGA memberships are blocked",
    {
      ...validFiles,
      "lga-memberships.csv": csv(
        ["territoryKind", "territoryId", "lgaId"],
        [
          ["STATE_CONSTITUENCY", "test-state-constituency", "test-lga"],
          ["STATE_CONSTITUENCY", "test-state-constituency", "test-lga"],
        ],
      ),
    },
    /Duplicate LGA membership row/,
  );

  const geodataFiles = {
    "polling-unit-geodata.csv": csv(
      ["pollingUnitId", "latitude", "longitude", "accuracyMeters", "captureMethod", "capturedAt", "source", "geofenceRadiusMeters"],
      [
        ["test-pu", "7.1", "3.4", "10", "GPS_SURVEY", "2026-08-09T00:00:00.000Z", "INEC_TEST", "100"],
        ["test-pu", "7.1", "3.4", "10", "GPS_SURVEY", "2026-08-09T00:00:00.000Z", "INEC_TEST", "100"],
      ],
    ),
  };
  const geodataDir = writeRelease(geodataFiles);
  try {
    const result = validateGeodataRelease(geodataDir, geodataManifest(geodataFiles));
    assert.equal(result.value, null);
    assert.match(result.failures.join("\n"), /Duplicate geodata pollingUnitId/);
  } finally {
    rmSync(geodataDir, { recursive: true, force: true });
  }

  console.log("ogun_reference_contract_tests=passed");
}

main();
