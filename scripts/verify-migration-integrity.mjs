import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const prismaRoot = path.join(repoRoot, "packages", "database", "prisma");
const legacyRoot = path.join(prismaRoot, "migrations");
const ogunRoot = path.join(prismaRoot, "ogun-migrations");
const manifest = JSON.parse(readFileSync(path.join(prismaRoot, "legacy-migration-manifest.json"), "utf8"));
const ogunManifest = JSON.parse(readFileSync(path.join(prismaRoot, "ogun-migration-manifest.json"), "utf8"));
const failures = [];

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

const expectedLegacyNames = new Set(manifest.migrations.map((migration) => migration.name));

for (const migration of manifest.migrations) {
  const migrationPath = path.join(legacyRoot, migration.name, "migration.sql");
  if (!existsSync(migrationPath)) {
    failures.push(`Missing legacy migration: ${migration.name}`);
    continue;
  }

  const actualHash = sha256(migrationPath);
  if (actualHash !== migration.sha256) {
    failures.push(`Legacy migration was modified: ${migration.name}`);
  }
}

for (const entry of readdirSync(legacyRoot, { withFileTypes: true })) {
  if (entry.isDirectory() && !expectedLegacyNames.has(entry.name)) {
    failures.push(`Unexpected directory in legacy migration stream: ${entry.name}`);
  }
}

const ogunMigrations = readdirSync(ogunRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (ogunMigrations.length === 0) {
  failures.push("The Ogun PostgreSQL migration stream has no baseline.");
}

const expectedOgunNames = new Set(ogunManifest.migrations.map((migration) => migration.name));
for (const migration of ogunManifest.migrations) {
  const migrationPath = path.join(ogunRoot, migration.name, "migration.sql");
  if (!existsSync(migrationPath)) {
    failures.push(`Missing locked Ogun migration: ${migration.name}`);
    continue;
  }
  if (sha256(migrationPath) !== migration.sha256) {
    failures.push(`Locked Ogun migration was modified: ${migration.name}`);
  }
}
for (const migrationName of ogunMigrations) {
  if (!expectedOgunNames.has(migrationName)) {
    failures.push(`Ogun migration is not checksum-locked in the manifest: ${migrationName}`);
  }
}

for (const migrationName of ogunMigrations) {
  if (!/^\d{14}_[a-z0-9_]+$/.test(migrationName)) {
    failures.push(`Invalid Ogun migration name: ${migrationName}`);
  }

  const migrationPath = path.join(ogunRoot, migrationName, "migration.sql");
  if (!existsSync(migrationPath)) {
    failures.push(`Missing migration.sql in Ogun migration: ${migrationName}`);
    continue;
  }

  const sql = readFileSync(migrationPath, "utf8");
  if (/\b(PRAGMA|DATETIME|AUTOINCREMENT)\b/i.test(sql)) {
    failures.push(`SQLite-only SQL found in Ogun migration: ${migrationName}`);
  }

  if (/\b(DROP\s+TABLE|DROP\s+COLUMN|TRUNCATE\s+TABLE)\b/i.test(sql) && !sql.includes("DESTRUCTIVE-MIGRATION-APPROVED:")) {
    failures.push(`Unapproved destructive SQL found in Ogun migration: ${migrationName}`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`FAIL ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(`legacy_migrations_verified=${manifest.migrations.length}`);
  console.log(`ogun_migrations_verified=${ogunMigrations.length}`);
  console.log("migration_integrity=ok");
}
