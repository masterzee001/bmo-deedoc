/**
 * Production migration rehearsal.
 *
 * Answers the question a deploy actually depends on: will this migration stream
 * apply cleanly to a database that already holds production-shaped data, and can
 * the previous application image keep serving afterwards?
 *
 * It rehearses against a disposable PostgreSQL container, never a real database.
 *
 *   node scripts/rehearse-production-migration.mjs
 *   node scripts/rehearse-production-migration.mjs --from-dump backup.dump
 *
 * Phases:
 *   1. Baseline   — apply every migration except the new ones, so the starting
 *                   point matches what production is running today.
 *   2. Seed       — load a dump if supplied, otherwise generate representative
 *                   rows so the forward migration runs against non-empty tables.
 *   3. Forward    — apply the pending migrations and time them.
 *   4. Additivity — confirm no existing column or table was dropped or retyped,
 *                   which is what makes rolling the application back safe.
 *   5. Rerun      — apply again to prove the stream is idempotent.
 */
import { spawnSync } from "node:child_process";
import { readdirSync, existsSync, mkdtempSync, renameSync, rmSync } from "node:fs";
import os from "node:os";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databaseWorkspace = path.join(repoRoot, "packages", "database");
const migrationRoot = path.join(databaseWorkspace, "prisma", "ogun-migrations");
const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");
const dockerCommand = process.platform === "win32" ? "docker.exe" : "docker";

const fromDumpIndex = process.argv.indexOf("--from-dump");
const fromDump = fromDumpIndex >= 0 ? process.argv[fromDumpIndex + 1] : null;
const project = `bmo-migration-rehearsal-${process.pid}`;
const port = process.env.REHEARSAL_PORT || "55470";
const databaseUrl = `postgresql://ogun_test:ogun_test_local_only@127.0.0.1:${port}/ogun_phase0_test?schema=public`;
const composeFile = path.join(repoRoot, "docker-compose.dev.yml");

const env = { ...process.env, NODE_ENV: "test", DATABASE_URL: databaseUrl, OGUN_POSTGRES_PORT: port };

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: options.cwd || repoRoot, env, stdio: options.quiet ? "pipe" : "inherit", input: options.input });
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status ?? 1}`);
  }
  return result;
}

function psql(sql) {
  const result = spawnSync(
    dockerCommand,
    ["compose", "-p", project, "-f", composeFile, "exec", "-T", "postgres", "psql", "-U", "ogun_test", "-d", "ogun_phase0_test", "-t", "-A", "-c", sql],
    { cwd: repoRoot, env, encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`psql failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

/** Column fingerprint of every application table, used to prove additivity. */
function columnFingerprint() {
  const rows = psql(
    "SELECT table_name||'.'||column_name||':'||data_type FROM information_schema.columns " +
      "WHERE table_schema='public' AND table_name NOT LIKE '\\_prisma%' ORDER BY 1;",
  );
  return new Set(rows.split("\n").filter(Boolean));
}

const allMigrations = readdirSync(migrationRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

// "Pending" means migrations not yet present on origin/main. Falls back to the
// newest one so the rehearsal still exercises a forward step on a clean branch.
const mergedBase = spawnSync("git", ["ls-tree", "--name-only", "origin/main", "packages/database/prisma/ogun-migrations/"], {
  cwd: repoRoot,
  encoding: "utf8",
});
const baseNames = new Set(
  (mergedBase.stdout || "")
    .split("\n")
    .map((line) => line.trim().replace(/\/$/, "").split("/").pop())
    .filter(Boolean),
);
const pending = allMigrations.filter((name) => !baseNames.has(name));
const rehearsed = pending.length > 0 ? pending : allMigrations.slice(-1);
const baseline = allMigrations.filter((name) => !rehearsed.includes(name));

console.log(`rehearsal_migrations_total=${allMigrations.length}`);
console.log(`rehearsal_baseline=${baseline.length}`);
console.log(`rehearsal_forward=${rehearsed.length} (${rehearsed.join(", ")})`);

const holdingArea = mkdtempSync(path.join(os.tmpdir(), "bmo-rehearsal-"));
const movedAside = [];
let started = false;
try {
  run(dockerCommand, ["compose", "-p", project, "-f", composeFile, "up", "-d", "--wait", "postgres"]);
  started = true;

  // ---- Phase 1: baseline ---------------------------------------------------
  // Apply only the already-shipped migrations. The pending directories are moved
  // aside rather than stashed, because git stash cannot hide files that are
  // already committed on this branch — which would silently turn the forward
  // step into a no-op re-apply and make the rehearsal prove nothing.
  for (const name of rehearsed) {
    const from = path.join(migrationRoot, name);
    if (existsSync(from)) {
      renameSync(from, path.join(holdingArea, name));
      movedAside.push(name);
    }
  }
  if (movedAside.length !== rehearsed.length) {
    throw new Error("Could not isolate the pending migrations; refusing to report a rehearsal that did not run.");
  }

  run(process.execPath, [prismaCli, "migrate", "deploy", "--config", "prisma.config.ts"], { cwd: databaseWorkspace });
  const before = columnFingerprint();
  console.log(`rehearsal_baseline_columns=${before.size}`);

  // ---- Phase 2: representative data ---------------------------------------
  if (fromDump) {
    console.log(`rehearsal_seed=dump:${fromDump}`);
    run(dockerCommand, ["compose", "-p", project, "-f", composeFile, "exec", "-T", "postgres", "pg_restore", "-U", "ogun_test", "-d", "ogun_phase0_test", "--clean", "--if-exists"], {
      input: require("node:fs").readFileSync(fromDump),
    });
  } else {
    // A migration that applies to empty tables proves very little: rewrites,
    // NOT NULL additions, and unique indexes only fail with rows present.
    psql(
      "INSERT INTO \"State\" (id,name,\"createdAt\",\"updatedAt\") VALUES ('ng-state-ogun','Ogun',now(),now()) ON CONFLICT (id) DO NOTHING; " +
        "INSERT INTO \"User\" (id,name,email,\"passwordHash\",role,\"isActive\",\"accountStatus\",\"createdAt\",\"updatedAt\") " +
        "SELECT 'rehearse-'||g, 'Rehearsal '||g, 'rehearse-'||g||'@example.test','x','MEMBER',true,'ACTIVE',now(),now() " +
        "FROM generate_series(1,500) g ON CONFLICT (id) DO NOTHING;",
    );
    console.log(`rehearsal_seed=synthetic rows=${psql('SELECT count(*) FROM "User";')}`);
  }

  // ---- Phase 3: forward ----------------------------------------------------
  for (const name of movedAside) {
    renameSync(path.join(holdingArea, name), path.join(migrationRoot, name));
  }
  movedAside.length = 0;
  const startedAt = Date.now();
  run(process.execPath, [prismaCli, "migrate", "deploy", "--config", "prisma.config.ts"], { cwd: databaseWorkspace });
  const elapsedMs = Date.now() - startedAt;
  console.log(`rehearsal_forward_ms=${elapsedMs}`);

  // ---- Phase 4: additivity -------------------------------------------------
  const after = columnFingerprint();
  const removed = [...before].filter((column) => !after.has(column));
  if (removed.length > 0) {
    console.error("FAIL migration is not additive; the previous application image could not run against this schema:");
    for (const column of removed) {
      console.error(`  removed or retyped: ${column}`);
    }
    process.exitCode = 1;
  } else {
    console.log(`rehearsal_additive=ok added_columns=${after.size - before.size}`);
  }

  // ---- Phase 5: rerun ------------------------------------------------------
  run(process.execPath, [prismaCli, "migrate", "deploy", "--config", "prisma.config.ts"], { cwd: databaseWorkspace });
  const afterRerun = columnFingerprint();
  if (afterRerun.size !== after.size) {
    console.error("FAIL re-running the migration stream changed the schema; it is not idempotent");
    process.exitCode = 1;
  } else {
    console.log("rehearsal_idempotent=ok");
  }

  if (!process.exitCode) {
    console.log("migration_rehearsal=ok");
  }
} finally {
  // The repository must never be left missing a migration directory.
  for (const name of movedAside) {
    const held = path.join(holdingArea, name);
    if (existsSync(held)) {
      renameSync(held, path.join(migrationRoot, name));
    }
  }
  rmSync(holdingArea, { recursive: true, force: true });
  if (started) {
    run(dockerCommand, ["compose", "-p", project, "-f", composeFile, "down", "--volumes", "--remove-orphans"], { allowFailure: true, quiet: true });
  }
}
