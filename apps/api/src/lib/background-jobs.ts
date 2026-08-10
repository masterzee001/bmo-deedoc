import { Prisma } from "@prisma/client";
import {
  BACKGROUND_JOB_QUEUE_BY_NAME,
  type BackgroundJobName,
  type BackgroundJobPayloadByName,
} from "@pics-nigeria/shared";
import { prisma } from "../prisma";

type TransactionClient = Prisma.TransactionClient | typeof prisma;

/**
 * Records durable background work.
 *
 * The API never talks to Redis to accept a job: it writes a `BackgroundJob` row
 * and returns. The worker sweeps PENDING rows into BullMQ. That means an outage
 * in Redis, or a worker that is not running at all, delays background work
 * instead of losing it, and the API stays available either way.
 *
 * `idempotencyKey` makes enqueueing safe to retry. A duplicate key is treated as
 * "already scheduled" rather than an error, so callers inside a retried request
 * do not create duplicate work.
 */
export async function enqueueBackgroundJob<TName extends BackgroundJobName>(
  client: TransactionClient,
  input: {
    jobName: TName;
    idempotencyKey: string;
    payload: BackgroundJobPayloadByName[TName];
    availableAt?: Date;
    maxAttempts?: number;
  },
): Promise<{ scheduled: boolean }> {
  try {
    await client.backgroundJob.create({
      data: {
        queue: BACKGROUND_JOB_QUEUE_BY_NAME[input.jobName],
        jobName: input.jobName,
        idempotencyKey: input.idempotencyKey,
        payloadJson: input.payload as Prisma.InputJsonObject,
        availableAt: input.availableAt || new Date(),
        ...(input.maxAttempts ? { maxAttempts: input.maxAttempts } : {}),
      },
    });
    return { scheduled: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { scheduled: false };
    }
    throw error;
  }
}
