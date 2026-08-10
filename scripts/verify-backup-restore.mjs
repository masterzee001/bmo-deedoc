/**
 * Backup and restore rehearsal.
 *
 * An untested backup is not a backup. This proves the documented procedure can
 * recreate the database after total loss: seed, dump, DROP the database, create
 * an empty one, restore into it, and compare both the data and the schema.
 *
 *   node scripts/verify-backup-restore.mjs
 *
 * Fails closed. A non-zero pg_restore is a failure, full stop — it is never
 * excused because the fingerprints happened to match afterwards. pg_restore runs
 * with --exit-on-error so a partial restore aborts instead of limping to the end
 * and reporting success on a half-populated database.
 *
 * Runs entirely against a disposable PostgreSQL container. It never touches a
 * real database and never writes into the repository.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
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
const databaseName = "ogun_phase0_test";
const databaseUser = "ogun_test";
const databaseUrl = `postgresql://${databaseUser}:ogun_test_local_only@127.0.0.1:${port}/${databaseName}?schema=public`;
const composeFile = path.join(repoRoot, "docker-compose.dev.yml");
const env = { ...process.env, NODE_ENV: "test", DATABASE_URL: databaseUrl, OGUN_POSTGRES_PORT: port };
const workDirectory = mkdtempSync(path.join(os.tmpdir(), "bmo-backup-"));
const dumpPath = path.join(workDirectory, "rehearsal.dump");

/**
 * Runs a compose subcommand. Every caller must handle a non-zero status: there
 * is no allowFailure escape hatch, because that is exactly how a restore
 * failure previously became a passing test. Teardown uses `tolerateFailure`,
 * which is scoped to cleanup only and can never affect the verdict.
 */
function compose(args, options = {}) {
  const result = spawnSync(dockerCommand, ["compose", "-p", project, "-f", composeFile, ...args], {
    cwd: repoRoot,
    env,
    encoding: options.binary ? "buffer" : "utf8",
    input: options.input,
    maxBuffer: 1024 * 1024 * 1024,
  });
  if (result.status !== 0 && !options.tolerateFailure) {
    const stderr = options.binary ? String(result.stderr || "") : result.stderr || "";
    throw new Error(`docker compose ${args.join(" ")} exited ${result.status}: ${stderr.trim()}`);
  }
  return result;
}

/** psql against a named database, returning trimmed stdout. Throws on failure. */
function psql(sql, database = databaseName) {
  return compose(["exec", "-T", "postgres", "psql", "-U", databaseUser, "-d", database, "-t", "-A", "-v", "ON_ERROR_STOP=1", "-c", sql]).stdout.trim();
}

function digest(lines) {
  return createHash("sha256").update(lines.join("\n")).digest("hex");
}

/**
 * Content fingerprint: per-table row count plus an md5 over the ordered row set.
 * Row counts alone would pass a restore that returned the right number of rows
 * with every value wrong.
 */
function contentFingerprint() {
  const tables = psql(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' " +
      "AND table_type='BASE TABLE' ORDER BY table_name;",
  )
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const entries = [];
  for (const table of tables) {
    const count = psql(`SELECT count(*) FROM "${table}";`);
    const rows = psql(`SELECT coalesce(md5(string_agg(t::text, '|' ORDER BY t::text)), 'empty') FROM "${table}" t;`);
    entries.push(`${table}|rows=${count}|md5=${rows}`);
  }
  return { entries, tableCount: tables.length, hash: digest(entries) };
}

/**
 * Schema fingerprint.
 *
 * Deterministic structural metadata that must survive a restore: columns with
 * their types, nullability and defaults; primary, foreign and unique
 * constraints; indexes; and sequences.
 *
 * Deliberately excludes PostgreSQL noise that is not expected to be
 * byte-identical between two freshly created databases — OIDs, physical sizes,
 * planner statistics, and the auto-generated NOT NULL check constraints whose
 * names embed OIDs. This is a targeted structural comparison, not a claim of
 * complete catalog equivalence.
 */
function schemaFingerprint() {
  const columns = psql(
    `SELECT table_name||'.'||column_name
       ||' type='||data_type
       ||' udt='||udt_name
       ||' nullable='||is_nullable
       ||' default='||coalesce(column_default,'<none>')
       ||' maxlen='||coalesce(character_maximum_length::text,'-')
       ||' precision='||coalesce(numeric_precision::text,'-')
       ||' scale='||coalesce(numeric_scale::text,'-')
     FROM information_schema.columns
     WHERE table_schema='public'
     ORDER BY table_name, column_name;`,
  );

  // pg_constraint rather than information_schema: it gives a stable, complete
  // definition via pg_get_constraintdef and lets us select constraint kinds.
  const constraints = psql(
    `SELECT c.conrelid::regclass::text||' '||c.conname||' '||pg_get_constraintdef(c.oid)
     FROM pg_constraint c
     JOIN pg_namespace n ON n.oid = c.connamespace
     WHERE n.nspname='public' AND c.contype IN ('p','f','u')
     ORDER BY 1;`,
  );

  const indexes = psql(
    `SELECT schemaname||'.'||tablename||' '||indexname||' '||indexdef
     FROM pg_indexes WHERE schemaname='public' ORDER BY 1;`,
  );

  const sequences = psql(
    `SELECT sequence_name||' type='||data_type||' start='||start_value||' increment='||increment
     FROM information_schema.sequences WHERE sequence_schema='public' ORDER BY sequence_name;`,
  );

  const sections = {
    columns: columns.split("\n").map((line) => line.trim()).filter(Boolean).sort(),
    constraints: constraints.split("\n").map((line) => line.trim()).filter(Boolean).sort(),
    indexes: indexes.split("\n").map((line) => line.trim()).filter(Boolean).sort(),
    sequences: sequences.split("\n").map((line) => line.trim()).filter(Boolean).sort(),
  };

  const flattened = [
    ...sections.columns.map((entry) => `column:${entry}`),
    ...sections.constraints.map((entry) => `constraint:${entry}`),
    ...sections.indexes.map((entry) => `index:${entry}`),
    ...sections.sequences.map((entry) => `sequence:${entry}`),
  ];

  return { sections, flattened, hash: digest(flattened) };
}

function firstDifference(before, after) {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  const missing = before.filter((entry) => !afterSet.has(entry)).slice(0, 5);
  const added = after.filter((entry) => !beforeSet.has(entry)).slice(0, 5);
  return { missing, added };
}

let started = false;
const failures = [];

try {
  compose(["up", "-d", "--wait", "postgres"]);
  started = true;

  // ---- 2. Full migration stream -------------------------------------------
  const migrate = spawnSync(process.execPath, [prismaCli, "migrate", "deploy", "--config", "prisma.config.ts"], {
    cwd: databaseWorkspace,
    env,
    stdio: "inherit",
  });
  if (migrate.status !== 0) {
    throw new Error(`prisma migrate deploy exited ${migrate.status}; cannot rehearse a backup of an unmigrated database.`);
  }

  // ---- 3. Representative data ---------------------------------------------
  // Restoring an empty database proves nothing.
  psql(
    "INSERT INTO \"State\" (id,name,\"createdAt\",\"updatedAt\") VALUES ('ng-state-ogun','Ogun',now(),now()) ON CONFLICT (id) DO NOTHING; " +
      "INSERT INTO \"User\" (id,name,email,\"passwordHash\",role,\"isActive\",\"accountStatus\",\"createdAt\",\"updatedAt\") " +
      "SELECT 'backup-'||g,'Backup Subject '||g,'backup-'||g||'@example.test','hash','MEMBER',true,'ACTIVE',now(),now() " +
      "FROM generate_series(1,750) g ON CONFLICT (id) DO NOTHING; " +
      "INSERT INTO \"BackgroundJob\" (id,queue,\"jobName\",\"idempotencyKey\",\"payloadJson\",status,\"availableAt\",\"createdAt\",\"updatedAt\") " +
      "SELECT 'bkp-'||g,'maintenance','maintenance.jobs.sweep','backup-rehearsal:'||g,'{}','COMPLETED',now(),now(),now() " +
      "FROM generate_series(1,50) g ON CONFLICT (id) DO NOTHING;",
  );

  // ---- 4/5. Pre-backup fingerprints ---------------------------------------
  const contentBefore = contentFingerprint();
  const schemaBefore = schemaFingerprint();
  const userCountBefore = psql('SELECT count(*) FROM "User";');
  console.log(`backup_seed_users=${userCountBefore}`);
  console.log(`backup_tables=${contentBefore.tableCount}`);
  console.log(`backup_schema_objects=${schemaBefore.flattened.length}`);

  // ---- 6/7. Dump -----------------------------------------------------------
  const dump = compose(
    ["exec", "-T", "postgres", "pg_dump", "-U", databaseUser, "-d", databaseName, "--format=custom", "--no-owner", "--no-privileges"],
    { binary: true },
  );
  writeFileSync(dumpPath, dump.stdout);
  const dumpBytes = statSync(dumpPath).size;
  if (dumpBytes < 4096) {
    throw new Error(`Dump is implausibly small (${dumpBytes} bytes); refusing to call this a valid backup.`);
  }
  // Custom-format dumps begin with the "PGDMP" magic.
  const magic = readFileSync(dumpPath).subarray(0, 5).toString("latin1");
  if (magic !== "PGDMP") {
    throw new Error(`Dump does not carry the PostgreSQL custom-format header (found ${JSON.stringify(magic)}).`);
  }
  console.log(`backup_dump_bytes=${dumpBytes}`);
  console.log("backup_dump_format=custom");

  // ---- 8. Destroy the database completely ---------------------------------
  // Not a TRUNCATE of a few tables over a surviving schema. The whole database
  // is dropped, so the restore has to rebuild tables, constraints, indexes and
  // sequences from the dump alone — which is the scenario a backup exists for.
  psql(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${databaseName}' AND pid <> pg_backend_pid();`,
    "postgres",
  );
  psql(`DROP DATABASE "${databaseName}";`, "postgres");
  const survived = psql(`SELECT count(*) FROM pg_database WHERE datname='${databaseName}';`, "postgres");
  if (survived !== "0") {
    throw new Error("Database was not dropped; the restore test would be meaningless.");
  }
  console.log("backup_database_dropped=ok");

  // ---- 9. Recreate an empty database --------------------------------------
  psql(`CREATE DATABASE "${databaseName}" OWNER "${databaseUser}";`, "postgres");
  const emptyTables = psql(
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';",
  );
  if (emptyTables !== "0") {
    throw new Error(`Recreated database is not empty (${emptyTables} tables); the restore would not be proving anything.`);
  }
  console.log("backup_database_recreated=empty");

  // ---- 10/11/12/13. Restore, failing closed --------------------------------
  // --exit-on-error so a partial restore aborts rather than completing with
  // missing objects. No tolerateFailure: a non-zero status is a failed test.
  const restore = compose(
    ["exec", "-T", "postgres", "pg_restore", "-U", databaseUser, "-d", databaseName, "--exit-on-error", "--no-owner", "--no-privileges"],
    { input: readFileSync(dumpPath) },
  );
  console.log(`pg_restore_exit=${restore.status}`);
  if (restore.status !== 0) {
    throw new Error(`pg_restore exited ${restore.status}: ${(restore.stderr || "").trim()}`);
  }

  // ---- 14/15/16. Re-fingerprint and require equality ----------------------
  const contentAfter = contentFingerprint();
  const schemaAfter = schemaFingerprint();

  if (contentAfter.hash === contentBefore.hash) {
    console.log("restore_content_fingerprint=ok");
  } else {
    const difference = firstDifference(contentBefore.entries, contentAfter.entries);
    failures.push(
      `Content fingerprint changed across restore. Missing: ${JSON.stringify(difference.missing)}; unexpected: ${JSON.stringify(difference.added)}`,
    );
  }

  if (schemaAfter.hash === schemaBefore.hash) {
    console.log("restore_schema_fingerprint=ok");
  } else {
    const difference = firstDifference(schemaBefore.flattened, schemaAfter.flattened);
    failures.push(
      `Schema fingerprint changed across restore. Missing: ${JSON.stringify(difference.missing)}; unexpected: ${JSON.stringify(difference.added)}`,
    );
  }

  const userCountAfter = psql('SELECT count(*) FROM "User";');
  if (userCountAfter !== userCountBefore) {
    failures.push(`User row count changed across restore: ${userCountBefore} -> ${userCountAfter}`);
  }
  if (contentAfter.tableCount !== contentBefore.tableCount) {
    failures.push(`Table count changed across restore: ${contentBefore.tableCount} -> ${contentAfter.tableCount}`);
  }

  console.log(`restore_users=${userCountAfter}`);
  console.log(`restore_tables_verified=${contentAfter.tableCount}`);
  console.log(`restore_schema_objects_verified=${schemaAfter.flattened.length}`);

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`FAIL ${failure}`);
    }
    process.exitCode = 1;
  } else {
    console.log("backup_restore_rehearsal=ok");
  }
} catch (error) {
  // The success marker is only ever printed on the happy path above, so a throw
  // here can never be mistaken for a pass.
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  rmSync(workDirectory, { recursive: true, force: true });
  if (started) {
    // Cleanup must not mask the real verdict, so its failure is reported but
    // never clears an exit code already set above.
    const teardown = compose(["down", "--volumes", "--remove-orphans"], { tolerateFailure: true });
    if (teardown.status !== 0) {
      console.error("WARN rehearsal teardown failed; inspect the Docker project manually.");
      process.exitCode = process.exitCode || 1;
    }
  }
}
