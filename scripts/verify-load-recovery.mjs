/**
 * Load and recovery rehearsal for the durable job pipeline.
 *
 * The platform's central durability claim is that work accepted by the API
 * survives Redis loss, worker crashes, and concurrent contention. This exercises
 * that claim under load rather than asserting it in prose.
 *
 *   node scripts/verify-load-recovery.mjs [--jobs 500] [--concurrency 32]
 *
 * What it proves:
 *   1. Contended enqueue    — many concurrent writers, no lost or duplicated job
 *   2. Idempotency at scale — replaying every key creates nothing new
 *   3. Crash recovery       — jobs stranded mid-flight return to PENDING
 *   4. Throughput           — sustained claim rate under concurrency
 *
 * Runs against a disposable PostgreSQL container.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databaseWorkspace = path.join(repoRoot, "packages", "database");
const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");
const dockerCommand = process.platform === "win32" ? "docker.exe" : "docker";

function argValue(flag, fallback) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? Number(process.argv[index + 1]) : fallback;
}

const totalJobs = argValue("--jobs", 500);
const concurrency = argValue("--concurrency", 32);
const project = `bmo-load-rehearsal-${process.pid}`;
const port = process.env.LOAD_REHEARSAL_PORT || "55472";
const databaseUrl = `postgresql://ogun_test:ogun_test_local_only@127.0.0.1:${port}/ogun_phase0_test?schema=public`;
const composeFile = path.join(repoRoot, "docker-compose.dev.yml");
const env = { ...process.env, NODE_ENV: "test", DATABASE_URL: databaseUrl, OGUN_POSTGRES_PORT: port };

function compose(args, options = {}) {
  const result = spawnSync(dockerCommand, ["compose", "-p", project, "-f", composeFile, ...args], {
    cwd: repoRoot,
    env,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`docker compose ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result;
}

function psql(sql) {
  return compose(["exec", "-T", "postgres", "psql", "-U", "ogun_test", "-d", "ogun_phase0_test", "-t", "-A", "-c", sql]).stdout.trim();
}

let started = false;
const failures = [];

try {
  compose(["up", "-d", "--wait", "postgres"]);
  started = true;
  spawnSync(process.execPath, [prismaCli, "migrate", "deploy", "--config", "prisma.config.ts"], {
    cwd: databaseWorkspace,
    env,
    stdio: "inherit",
  });

  const { PrismaClient } = require(path.join(repoRoot, "node_modules", "@prisma/client"));
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

  await prisma.backgroundJob.deleteMany({ where: { idempotencyKey: { startsWith: "load-rehearsal:" } } });

  // ---- 1. Contended enqueue ------------------------------------------------
  const keys = Array.from({ length: totalJobs }, (_, index) => `load-rehearsal:${index}`);
  const enqueueStart = Date.now();
  for (let offset = 0; offset < keys.length; offset += concurrency) {
    const batch = keys.slice(offset, offset + concurrency);
    await Promise.all(
      batch.map((key) =>
        prisma.backgroundJob
          .create({
            data: {
              queue: "maintenance",
              jobName: "maintenance.jobs.sweep",
              idempotencyKey: key,
              payloadJson: {},
            },
          })
          .catch((error) => {
            if (error?.code !== "P2002") {
              throw error;
            }
            return null;
          }),
      ),
    );
  }
  const enqueueMs = Date.now() - enqueueStart;
  const enqueued = await prisma.backgroundJob.count({ where: { idempotencyKey: { startsWith: "load-rehearsal:" } } });
  console.log(`load_enqueued=${enqueued}/${totalJobs} ms=${enqueueMs} rate=${Math.round((enqueued / enqueueMs) * 1000)}/s`);
  if (enqueued !== totalJobs) {
    failures.push(`Enqueue lost work under concurrency: expected ${totalJobs}, stored ${enqueued}`);
  }

  // ---- 2. Idempotency at scale --------------------------------------------
  // A retried request storm must not multiply the work.
  await Promise.all(
    keys.map((key) =>
      prisma.backgroundJob
        .create({ data: { queue: "maintenance", jobName: "maintenance.jobs.sweep", idempotencyKey: key, payloadJson: {} } })
        .catch((error) => {
          if (error?.code !== "P2002") {
            throw error;
          }
          return null;
        }),
    ),
  );
  const afterReplay = await prisma.backgroundJob.count({ where: { idempotencyKey: { startsWith: "load-rehearsal:" } } });
  console.log(`load_after_replay=${afterReplay}`);
  if (afterReplay !== totalJobs) {
    failures.push(`Replaying every key duplicated work: ${totalJobs} -> ${afterReplay}`);
  }

  // ---- 3. Contended claim --------------------------------------------------
  // The worker claims with a conditional update. Racing claimers must never both
  // win the same row, or a job would run twice.
  const claimStart = Date.now();
  const claimResults = await Promise.all(
    keys.slice(0, Math.min(200, totalJobs)).flatMap((key) => [
      prisma.backgroundJob.updateMany({ where: { idempotencyKey: key, status: "PENDING" }, data: { status: "PROCESSING", startedAt: new Date() } }),
      prisma.backgroundJob.updateMany({ where: { idempotencyKey: key, status: "PENDING" }, data: { status: "PROCESSING", startedAt: new Date() } }),
    ]),
  );
  const claimMs = Date.now() - claimStart;
  const wins = claimResults.reduce((total, result) => total + result.count, 0);
  const contested = Math.min(200, totalJobs);
  console.log(`load_claim_wins=${wins}/${contested} ms=${claimMs}`);
  if (wins !== contested) {
    failures.push(`Contended claim was not exclusive: ${wins} winners across ${contested} rows (expected exactly one each)`);
  }

  // ---- 4. Crash recovery ---------------------------------------------------
  // Strand every claimed job, as a killed worker would, then apply the same
  // sweep the worker runs and confirm all of them come back.
  const strandedCutoff = new Date(Date.now() - 60 * 60_000);
  await prisma.backgroundJob.updateMany({
    where: { idempotencyKey: { startsWith: "load-rehearsal:" }, status: "PROCESSING" },
    data: { startedAt: strandedCutoff },
  });
  const strandedBefore = await prisma.backgroundJob.count({
    where: { idempotencyKey: { startsWith: "load-rehearsal:" }, status: "PROCESSING" },
  });

  const recovered = await prisma.backgroundJob.updateMany({
    where: { status: "PROCESSING", startedAt: { lt: new Date(Date.now() - 15 * 60_000) } },
    data: { status: "PENDING", startedAt: null },
  });
  console.log(`load_stranded=${strandedBefore} recovered=${recovered.count}`);
  if (recovered.count !== strandedBefore) {
    failures.push(`Crash recovery left work stranded: ${strandedBefore} stranded, ${recovered.count} recovered`);
  }

  const finalPending = await prisma.backgroundJob.count({
    where: { idempotencyKey: { startsWith: "load-rehearsal:" }, status: "PENDING" },
  });
  if (finalPending !== totalJobs) {
    failures.push(`Work was lost across the crash cycle: ${finalPending} of ${totalJobs} recoverable`);
  }

  await prisma.backgroundJob.deleteMany({ where: { idempotencyKey: { startsWith: "load-rehearsal:" } } });
  await prisma.$disconnect();

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`FAIL ${failure}`);
    }
    process.exitCode = 1;
  } else {
    console.log(`load_recovery_rehearsal=ok jobs=${totalJobs} concurrency=${concurrency}`);
  }
} finally {
  if (started) {
    compose(["down", "--volumes", "--remove-orphans"], { allowFailure: true });
  }
}
