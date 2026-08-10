/**
 * Backup and restore rehearsal.
 *
 * An untested backup is not a backup. This proves the documented procedure
 * actually round-trips: take a dump, destroy the data, restore it, and confirm
 * the database is byte-for-byte equivalent on the rows that matter.
 *
 *   node scripts/verify-backup-restore.mjs
 *
 * Runs entirely against a disposable PostgreSQL container. It never touches a
 * real database and never writes into the repository.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databaseWorkspace = path.join(repoRoot, "packages", "database");
const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");
const dockerCommand = process.platform === "win32" ? "docker.exe" : "docker";

const project = `bmo-backup-rehearsal-${process.pid}`;
const port = process.env.BACKUP_REHEARSAL_PORT || "55471";
const databaseUrl = `postgresql://ogun_test:ogun_test_local_only@127.0.0.1:${port}/ogun_phase0_test?schema=public`;
const composeFile = path.join(repoRoot, "docker-compose.dev.yml");
const env = { ...process.env, NODE_ENV: "test", DATABASE_URL: databaseUrl, OGUN_POSTGRES_PORT: port };
const workDirectory = mkdtempSync(path.join(os.tmpdir(), "bmo-backup-"));
const dumpPath = path.join(workDirectory, "rehearsal.dump");

function compose(args, options = {}) {
  const result = spawnSync(dockerCommand, ["compose", "-p", project, "-f", composeFile, ...args], {
    cwd: repoRoot,
    env,
    encoding: options.binary ? "buffer" : "utf8",
    input: options.input,
    maxBuffer: 512 * 1024 * 1024,
  });
  if (result.status !== 0 && !options.allowFailure) {
    const stderr = options.binary ? String(result.stderr) : result.stderr;
    throw new Error(`docker compose ${args.join(" ")} failed: ${stderr}`);
  }
  return result;
}

function psql(sql) {
  const result = compose(["exec", "-T", "postgres", "psql", "-U", "ogun_test", "-d", "ogun_phase0_test", "-t", "-A", "-c", sql]);
  return result.stdout.trim();
}

/**
 * A content fingerprint across the tables a restore must preserve. Comparing
 * row counts alone would pass even if every row's contents were wrong.
 */
function contentFingerprint() {
  const tables = psql(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' " +
      "AND table_type='BASE TABLE' AND table_name NOT LIKE '\\_prisma%' ORDER BY 1;",
  )
    .split("\n")
    .filter(Boolean);

  const parts = [];
  for (const table of tables) {
    // md5 over the ordered row set: detects altered values, not just counts.
    const digest = psql(
      `SELECT coalesce(md5(string_agg(t::text, '|' ORDER BY t::text)), 'empty') FROM "${table}" t;`,
    );
    const count = psql(`SELECT count(*) FROM "${table}";`);
    parts.push(`${table}:${count}:${digest}`);
  }
  return parts;
}

let started = false;
try {
  compose(["up", "-d", "--wait", "postgres"]);
  started = true;

  spawnSync(process.execPath, [prismaCli, "migrate", "deploy", "--config", "prisma.config.ts"], {
    cwd: databaseWorkspace,
    env,
    stdio: "inherit",
  });

  // Representative data. Restoring an empty database proves nothing.
  psql(
    "INSERT INTO \"State\" (id,name,\"createdAt\",\"updatedAt\") VALUES ('ng-state-ogun','Ogun',now(),now()) ON CONFLICT (id) DO NOTHING; " +
      "INSERT INTO \"User\" (id,name,email,\"passwordHash\",role,\"isActive\",\"accountStatus\",\"createdAt\",\"updatedAt\") " +
      "SELECT 'backup-'||g,'Backup Subject '||g,'backup-'||g||'@example.test','hash','MEMBER',true,'ACTIVE',now(),now() " +
      "FROM generate_series(1,750) g ON CONFLICT (id) DO NOTHING; " +
      "INSERT INTO \"BackgroundJob\" (id,queue,\"jobName\",\"idempotencyKey\",\"payloadJson\",status,\"availableAt\",\"createdAt\",\"updatedAt\") " +
      "SELECT 'bkp-'||g,'maintenance','maintenance.jobs.sweep','backup-rehearsal:'||g,'{}','COMPLETED',now(),now(),now() " +
      "FROM generate_series(1,50) g ON CONFLICT (id) DO NOTHING;",
  );

  const before = contentFingerprint();
  const userCountBefore = psql('SELECT count(*) FROM "User";');
  console.log(`backup_seed_users=${userCountBefore}`);

  // ---- Backup (the exact command documented in the runbook) ----------------
  const dump = compose(["exec", "-T", "postgres", "pg_dump", "-U", "ogun_test", "-d", "ogun_phase0_test", "--format=custom"], {
    binary: true,
  });
  writeFileSync(dumpPath, dump.stdout);
  const dumpBytes = statSync(dumpPath).size;
  if (dumpBytes < 1024) {
    throw new Error(`Dump is implausibly small (${dumpBytes} bytes); refusing to call this a valid backup.`);
  }
  console.log(`backup_dump_bytes=${dumpBytes}`);

  // ---- Destroy -------------------------------------------------------------
  // Simulates the disaster the backup exists for.
  psql('TRUNCATE TABLE "BackgroundJob", "User", "State" RESTART IDENTITY CASCADE;');
  const afterDestroy = psql('SELECT count(*) FROM "User";');
  if (afterDestroy !== "0") {
    throw new Error(`Destroy step did not empty the table (found ${afterDestroy}); the restore test would be meaningless.`);
  }
  console.log("backup_destroy=ok");

  // ---- Restore -------------------------------------------------------------
  compose(["exec", "-T", "postgres", "pg_restore", "-U", "ogun_test", "-d", "ogun_phase0_test", "--clean", "--if-exists"], {
    input: readFileSync(dumpPath),
    allowFailure: true, // pg_restore warns on absent objects during --clean
  });

  const after = contentFingerprint();
  const userCountAfter = psql('SELECT count(*) FROM "User";');
  console.log(`restore_users=${userCountAfter}`);

  const failures = [];
  if (userCountAfter !== userCountBefore) {
    failures.push(`User row count changed across restore: ${userCountBefore} -> ${userCountAfter}`);
  }

  const beforeMap = new Map(before.map((entry) => [entry.split(":")[0], entry]));
  const afterMap = new Map(after.map((entry) => [entry.split(":")[0], entry]));
  for (const [table, signature] of beforeMap) {
    const restored = afterMap.get(table);
    if (!restored) {
      failures.push(`Table missing after restore: ${table}`);
    } else if (restored !== signature) {
      failures.push(`Content differs after restore: ${table}`);
    }
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`FAIL ${failure}`);
    }
    process.exitCode = 1;
  } else {
    console.log(`restore_tables_verified=${beforeMap.size}`);
    console.log("backup_restore_rehearsal=ok");
  }
} finally {
  rmSync(workDirectory, { recursive: true, force: true });
  if (started) {
    compose(["down", "--volumes", "--remove-orphans"], { allowFailure: true });
  }
}
