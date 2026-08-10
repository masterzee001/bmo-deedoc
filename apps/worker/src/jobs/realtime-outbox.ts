import type { RealtimeOutboxReplayJobPayload } from "@pics-nigeria/shared";
import type Redis from "ioredis";
import { env } from "../env";
import { prisma } from "../prisma";

/**
 * Redis channel used to hand durable events back to whichever API instance owns
 * the Socket.IO server. The worker has no socket server of its own, so it
 * republishes through Redis rather than trying to emit directly.
 */
export const REALTIME_OUTBOX_CHANNEL = "realtime:outbox";

/**
 * Republishes durable realtime events that were never delivered.
 *
 * An event is written to `RealtimeEventOutbox` inside the same transaction as
 * the business change, so a realtime outage cannot lose it. This job drains
 * anything still PENDING — for example events produced while no API instance was
 * connected to Redis.
 *
 * Delivery here remains best effort by design: PostgreSQL is authoritative, and
 * a reconnecting client additionally reconciles through the REST replay endpoint
 * rather than trusting that every live event arrived.
 */
export async function replayRealtimeOutbox(payload: RealtimeOutboxReplayJobPayload, publisher: Redis) {
  const limit = Math.min(payload.limit || env.WORKER_OUTBOX_BATCH_SIZE, env.WORKER_OUTBOX_BATCH_SIZE);

  const pending = await prisma.realtimeEventOutbox.findMany({
    where: { status: { in: ["PENDING", "FAILED"] }, attempts: { lt: env.WORKER_MAX_ATTEMPTS } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let published = 0;
  let failed = 0;

  for (const event of pending) {
    try {
      await publisher.publish(
        REALTIME_OUTBOX_CHANNEL,
        JSON.stringify({
          eventId: event.eventId,
          eventType: event.eventType,
          eventVersion: event.eventVersion,
          idempotencyKey: event.idempotencyKey,
          occurredAt: event.createdAt.toISOString(),
          territory: event.territoryJson,
          payload: event.payloadJson,
        }),
      );
      await prisma.realtimeEventOutbox.update({
        where: { id: event.id },
        data: { status: "PUBLISHED", publishedAt: new Date(), attempts: { increment: 1 } },
      });
      published += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const attempts = event.attempts + 1;
      await prisma.realtimeEventOutbox.update({
        where: { id: event.id },
        data: {
          status: "FAILED",
          attempts,
          lastError: message.slice(0, 500),
        },
      });
      failed += 1;
    }
  }

  return { considered: pending.length, published, failed };
}
