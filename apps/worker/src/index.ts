import http from "node:http";
import {
  BACKGROUND_QUEUES,
  BACKGROUND_JOB_QUEUE_BY_NAME,
  type BackgroundJobName,
  type BackgroundQueue,
} from "@pics-nigeria/shared";
import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { env } from "./env";
import { generateEvidenceDerivatives } from "./jobs/evidence-derivatives";
import { replayRealtimeOutbox } from "./jobs/realtime-outbox";
import { prisma } from "./prisma";

type QueuedJobData = { backgroundJobId: string };

// BullMQ requires this setting: a blocking connection must not cap retries.
const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
const publisher = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

const queues = new Map<BackgroundQueue, Queue<QueuedJobData>>();
for (const queue of BACKGROUND_QUEUES) {
  queues.set(queue, new Queue<QueuedJobData>(queue, { connection }));
}

let shuttingDown = false;

function log(event: string, detail: Record<string, unknown> = {}) {
  process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), component: "worker", event, ...detail })}\n`);
}

/**
 * Executes one durable job.
 *
 * The BullMQ job carries only a `backgroundJobId`; the authoritative payload and
 * status live in PostgreSQL. The row is claimed with a conditional update, so if
 * the same job is delivered twice — a duplicate sweep, a retry after a crash —
 * only one runner proceeds.
 */
async function runBackgroundJob(job: Job<QueuedJobData>) {
  const claimed = await prisma.backgroundJob.updateMany({
    where: { id: job.data.backgroundJobId, status: { in: ["PENDING", "FAILED"] } },
    data: { status: "PROCESSING", startedAt: new Date(), attempts: { increment: 1 } },
  });

  if (claimed.count === 0) {
    // Another runner owns it, or it already completed. Not an error.
    return { skipped: "NOT_CLAIMABLE" };
  }

  const record = await prisma.backgroundJob.findUnique({ where: { id: job.data.backgroundJobId } });
  if (!record) {
    return { skipped: "NOT_FOUND" };
  }

  try {
    const payload = (record.payloadJson || {}) as Record<string, unknown>;
    let result: unknown;

    switch (record.jobName as BackgroundJobName) {
      case "evidence.derivatives.generate":
        result = await generateEvidenceDerivatives({ evidenceAssetId: String(payload.evidenceAssetId) });
        break;
      case "realtime.outbox.replay":
        result = await replayRealtimeOutbox({ limit: payload.limit as number | undefined }, publisher);
        break;
      case "maintenance.jobs.sweep":
        result = await sweepStuckJobs();
        break;
      default:
        throw new Error(`Unsupported background job name: ${record.jobName}`);
    }

    await prisma.backgroundJob.update({
      where: { id: record.id },
      data: { status: "COMPLETED", completedAt: new Date(), lastError: null },
    });
    log("job.completed", { jobName: record.jobName, backgroundJobId: record.id });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const exhausted = record.attempts >= record.maxAttempts;

    await prisma.backgroundJob.update({
      where: { id: record.id },
      data: {
        // A job that has burned its attempts is dead-lettered rather than retried
        // forever, so a poison payload cannot occupy the queue indefinitely.
        status: exhausted ? "DEAD_LETTER" : "FAILED",
        lastError: message.slice(0, 500),
        // Exponential backoff, capped, so transient failures retry sensibly.
        availableAt: new Date(Date.now() + Math.min(2 ** record.attempts, 60) * 1000),
      },
    });

    log(exhausted ? "job.dead_letter" : "job.failed", {
      jobName: record.jobName,
      backgroundJobId: record.id,
      attempts: record.attempts,
      error: message,
    });

    if (exhausted) {
      // Swallowed deliberately: the durable row records the dead letter, and
      // re-throwing would only add a BullMQ failure for work that will not run
      // again without operator action.
      return { deadLetter: true };
    }
    throw error;
  }
}

/**
 * Returns abandoned work to the queue.
 *
 * A worker killed mid-job leaves its row in PROCESSING forever. Anything older
 * than the configured threshold is reset to PENDING so it can be retried.
 */
async function sweepStuckJobs() {
  const cutoff = new Date(Date.now() - env.WORKER_STALE_PROCESSING_MINUTES * 60_000);
  const recovered = await prisma.backgroundJob.updateMany({
    where: { status: "PROCESSING", startedAt: { lt: cutoff } },
    data: { status: "PENDING", startedAt: null },
  });

  if (recovered.count > 0) {
    log("jobs.recovered_from_stale_processing", { count: recovered.count, staleMinutes: env.WORKER_STALE_PROCESSING_MINUTES });
  }
  return { recovered: recovered.count };
}

/**
 * Moves durable PENDING work into BullMQ.
 *
 * This is the only path from PostgreSQL into Redis, which is what lets the API
 * enqueue without a Redis dependency. It also self-heals: jobs written while
 * Redis or the worker was down are picked up on the next sweep.
 */
async function sweepPendingJobsIntoQueues() {
  const due = await prisma.backgroundJob.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      availableAt: { lte: new Date() },
      attempts: { lt: env.WORKER_MAX_ATTEMPTS },
    },
    orderBy: { availableAt: "asc" },
    take: 200,
    select: { id: true, jobName: true },
  });

  for (const record of due) {
    const queueName = BACKGROUND_JOB_QUEUE_BY_NAME[record.jobName as BackgroundJobName];
    const queue = queues.get(queueName);
    if (!queue) {
      log("job.unroutable", { backgroundJobId: record.id, jobName: record.jobName });
      continue;
    }

    await queue.add(
      record.jobName,
      { backgroundJobId: record.id },
      {
        // Keyed by the durable row id so a repeated sweep cannot double-enqueue
        // the same job while it is still waiting.
        jobId: record.id,
        removeOnComplete: 500,
        removeOnFail: 500,
        attempts: 1,
      },
    );
  }

  return due.length;
}

async function ensureRecurringMaintenance() {
  const now = new Date();
  const bucket = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}-${now.getUTCHours()}-${Math.floor(now.getUTCMinutes() / 5)}`;
  for (const jobName of ["maintenance.jobs.sweep", "realtime.outbox.replay"] as const) {
    await prisma.backgroundJob
      .create({
        data: {
          queue: BACKGROUND_JOB_QUEUE_BY_NAME[jobName],
          jobName,
          // One row per 5-minute bucket keeps the recurring schedule idempotent
          // across multiple worker replicas without a distributed lock.
          idempotencyKey: `${jobName}:${bucket}`,
          payloadJson: {},
        },
      })
      .catch(() => undefined);
  }
}

const workers = BACKGROUND_QUEUES.map(
  (queueName) =>
    new Worker<QueuedJobData>(queueName, runBackgroundJob, {
      connection,
      concurrency: env.WORKER_CONCURRENCY,
    }),
);

for (const worker of workers) {
  worker.on("failed", (job, error) => {
    log("bullmq.job.failed", { queue: worker.name, jobId: job?.id, error: error?.message });
  });
}

const healthServer = http.createServer(async (request, response) => {
  if (request.url !== "/health") {
    response.writeHead(404).end();
    return;
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    const [pending, processing, deadLetter] = await Promise.all([
      prisma.backgroundJob.count({ where: { status: "PENDING" } }),
      prisma.backgroundJob.count({ where: { status: "PROCESSING" } }),
      prisma.backgroundJob.count({ where: { status: "DEAD_LETTER" } }),
    ]);
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ status: "ok", redis: connection.status, pending, processing, deadLetter }));
  } catch (error) {
    response.writeHead(503, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ status: "unhealthy", error: error instanceof Error ? error.message : String(error) }));
  }
});

let pollTimer: NodeJS.Timeout | null = null;

async function tick() {
  if (shuttingDown) {
    return;
  }
  try {
    await ensureRecurringMaintenance();
    const enqueued = await sweepPendingJobsIntoQueues();
    if (enqueued > 0) {
      log("jobs.swept", { count: enqueued });
    }
  } catch (error) {
    log("sweep.failed", { error: error instanceof Error ? error.message : String(error) });
  }
}

async function shutdown(signal: string) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  log("shutdown.started", { signal });

  if (pollTimer) {
    clearInterval(pollTimer);
  }
  // Workers are closed before the connections so in-flight jobs finish and
  // record their outcome instead of being abandoned in PROCESSING.
  await Promise.allSettled(workers.map((worker) => worker.close()));
  await Promise.allSettled([...queues.values()].map((queue) => queue.close()));
  await Promise.allSettled([connection.quit(), publisher.quit()]);
  await prisma.$disconnect();
  healthServer.close();
  log("shutdown.complete", {});
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

healthServer.listen(env.WORKER_HEALTH_PORT, () => {
  log("worker.started", {
    queues: [...BACKGROUND_QUEUES],
    concurrency: env.WORKER_CONCURRENCY,
    healthPort: env.WORKER_HEALTH_PORT,
    storageDriver: env.STORAGE_DRIVER,
  });
});

pollTimer = setInterval(() => void tick(), env.WORKER_POLL_INTERVAL_MS);
void tick();
