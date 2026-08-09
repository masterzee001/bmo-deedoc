import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

const workspaceRoot = path.resolve(__dirname, "..");
const configPath = "prisma.config.ts";
const schemaPath = path.join("prisma", "schema.prisma");
const migrationsDir = path.join(workspaceRoot, "prisma", "ogun-migrations");
const prismaCliPath = require.resolve("prisma/build/index.js");

dotenv.config({ path: path.resolve(workspaceRoot, "../../.env") });
dotenv.config({ path: path.resolve(workspaceRoot, ".env"), override: true });

type CommandResult = {
  status: number;
  output: string;
};

function runPrisma(args: string[]): CommandResult {
  const result = spawnSync(process.execPath, [prismaCliPath, ...args], {
    cwd: workspaceRoot,
    env: process.env,
    encoding: "utf8",
  });

  return {
    status: result.status ?? 1,
    output: `${result.stdout || ""}${result.stderr || ""}`,
  };
}

function printOutput(output: string) {
  const trimmed = output.trim();
  if (trimmed) {
    console.log(trimmed);
  }
}

function getMigrationNames(): string[] {
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function getBaselineName(migrations: string[]): string {

  if (migrations.length === 0) {
    throw new Error("The Ogun PostgreSQL migration stream has no baseline migration.");
  }

  return migrations[0];
}

async function databaseState(prisma: PrismaClient, migrationNames: string[], baselineName: string) {
  const tableRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM pg_catalog.pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
  `;
  const migrationTableRows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS exists
  `;
  const migrationTableExists = migrationTableRows[0]?.exists === true;

  let appliedOgunMigrations: string[] = [];
  if (migrationTableExists) {
    const rows = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name
      FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL
        AND rolled_back_at IS NULL
    `;
    const activeNames = new Set(migrationNames);
    appliedOgunMigrations = rows
      .map((row) => row.migration_name)
      .filter((migrationName) => activeNames.has(migrationName));
  }

  return {
    userTableCount: Number(tableRows[0]?.count || 0),
    baselineApplied: appliedOgunMigrations.includes(baselineName),
    appliedOgunMigrations,
  };
}

function deployMigrations() {
  const result = runPrisma(["migrate", "deploy", "--config", configPath]);
  printOutput(result.output);
  if (result.status !== 0) {
    throw new Error("PostgreSQL migration deployment failed.");
  }
}

function verifyLiveSchemaMatchesLatest() {
  const result = runPrisma([
    "migrate",
    "diff",
    "--from-schema-datasource",
    schemaPath,
    "--to-schema-datamodel",
    schemaPath,
    "--exit-code",
  ]);
  printOutput(result.output);
  return result.status === 0;
}

function assertSeparateShadowDatabase(databaseUrl: string, shadowDatabaseUrl: string) {
  const database = new URL(databaseUrl);
  const shadow = new URL(shadowDatabaseUrl);
  const databaseIdentity = `${database.hostname}:${database.port || "5432"}${database.pathname}`;
  const shadowIdentity = `${shadow.hostname}:${shadow.port || "5432"}${shadow.pathname}`;

  if (databaseIdentity === shadowIdentity) {
    throw new Error("BASELINE_SHADOW_DATABASE_URL must use a separate disposable database, not another schema in the live database.");
  }
}

function verifyLiveSchemaMatchesBaseline(databaseUrl: string, baselineName: string) {
  const shadowDatabaseUrl = process.env.BASELINE_SHADOW_DATABASE_URL;
  if (!shadowDatabaseUrl) {
    throw new Error(
      "BASELINE_SHADOW_DATABASE_URL is required to reconcile a non-empty database without the Ogun baseline marker.",
    );
  }
  assertSeparateShadowDatabase(databaseUrl, shadowDatabaseUrl);

  const snapshotRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ogun-baseline-migrations-"));
  const snapshotMigration = path.join(snapshotRoot, baselineName);
  fs.mkdirSync(snapshotMigration);
  fs.copyFileSync(path.join(migrationsDir, "migration_lock.toml"), path.join(snapshotRoot, "migration_lock.toml"));
  fs.copyFileSync(
    path.join(migrationsDir, baselineName, "migration.sql"),
    path.join(snapshotMigration, "migration.sql"),
  );

  try {
    const result = runPrisma([
      "migrate",
      "diff",
      "--from-url",
      databaseUrl,
      "--to-migrations",
      snapshotRoot,
      "--shadow-database-url",
      shadowDatabaseUrl,
      "--exit-code",
    ]);
    printOutput(result.output);
    if (result.status === 1) {
      throw new Error("Unable to compare the live database with the Ogun baseline migration.");
    }
    return result.status === 0;
  } finally {
    fs.rmSync(snapshotRoot, { recursive: true, force: true });
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || (!databaseUrl.startsWith("postgresql://") && !databaseUrl.startsWith("postgres://"))) {
    throw new Error("DATABASE_URL must identify a PostgreSQL database.");
  }

  const migrationNames = getMigrationNames();
  const baselineName = getBaselineName(migrationNames);
  const prisma = new PrismaClient();

  try {
    await prisma.$queryRaw`SELECT 1`;
    const state = await databaseState(prisma, migrationNames, baselineName);

    if (state.baselineApplied) {
      deployMigrations();
    } else if (state.userTableCount === 0) {
      deployMigrations();
    } else {
      if (state.appliedOgunMigrations.length > 0) {
        throw new Error(
          `Automatic baseline refused: Ogun migrations are recorded without ${baselineName}. Reconcile migration history manually.`,
        );
      }
      if (!verifyLiveSchemaMatchesBaseline(databaseUrl, baselineName)) {
        throw new Error(
          "Automatic baseline refused: the non-empty database does not exactly match the immutable Ogun baseline. Run the documented production reconciliation procedure.",
        );
      }

      const resolveResult = runPrisma(["migrate", "resolve", "--applied", baselineName, "--config", configPath]);
      printOutput(resolveResult.output);
      if (resolveResult.status !== 0 && !resolveResult.output.includes("already recorded as applied")) {
        throw new Error(`Failed to mark ${baselineName} as applied.`);
      }

      deployMigrations();
    }

    if (!verifyLiveSchemaMatchesLatest()) {
      throw new Error("Migration deployment completed, but the live schema still differs from prisma/schema.prisma.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
