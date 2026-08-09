import { randomUUID } from "node:crypto";
import {
  ELECTION_DAY_REALTIME_EVENT_TYPES,
  type ElectionDayRealtimeEnvelope,
  type ElectionDayRealtimeEventType,
  type ElectionDayRealtimePayload,
  type OperationalTerritory,
} from "@pics-nigeria/shared";

export function createElectionDayRealtimeEvent(input: {
  eventType: ElectionDayRealtimeEventType;
  actorUserId: string | null;
  territory: OperationalTerritory | null;
  payload: ElectionDayRealtimePayload;
  idempotencyKey?: string | null;
  correlationId?: string | null;
}): ElectionDayRealtimeEnvelope {
  if (!ELECTION_DAY_REALTIME_EVENT_TYPES.includes(input.eventType)) {
    throw new Error(`Unsupported Election Day realtime event type: ${input.eventType}`);
  }

  return {
    eventId: randomUUID(),
    eventType: input.eventType,
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    actorUserId: input.actorUserId,
    correlationId: input.correlationId || randomUUID(),
    idempotencyKey: input.idempotencyKey || randomUUID(),
    territory: input.territory,
    payload: input.payload,
  };
}
