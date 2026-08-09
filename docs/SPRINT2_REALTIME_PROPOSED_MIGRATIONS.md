# Sprint 2 Election Realtime Proposed Migrations

## Status

Proposed for Platform Lead integration. This branch does not modify existing migrations and does not add a Prisma migration file.

## Durable Boundary

PostgreSQL remains the durable source of truth. Redis is used only for transient Socket.IO adapter traffic and presence state. If Redis is flushed or unavailable, clients reconcile over REST Situation Room endpoints and durable Election Day records remain intact.

## Operational Alerts

The current schema has no durable `OperationalAlert` table. This branch keeps missing check-in and missing report indicators as recomputed Situation Room projections and does not persist them in Redis.

Proposed additive model:

```prisma
model OperationalAlert {
  id                    String   @id @default(cuid())
  type                  String
  status                String
  severity              String
  message               String
  sourceType            String?
  sourceId              String?
  actorUserId           String?
  acknowledgedByUserId  String?
  resolvedByUserId      String?
  stateId               String
  senatorialDistrictId  String?
  federalConstituencyId String?
  stateConstituencyId   String?
  wardId                String?
  pollingUnitId         String?
  detectedAt            DateTime @default(now())
  acknowledgedAt        DateTime?
  escalatedAt           DateTime?
  resolvedAt            DateTime?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([type, status])
  @@index([stateId])
  @@index([senatorialDistrictId])
  @@index([federalConstituencyId])
  @@index([stateConstituencyId])
  @@index([wardId])
  @@index([pollingUnitId])
  @@index([detectedAt])
}
```

## Messaging

The current durable foundation is `BroadcastMessage` for territory messages. One-to-one and conversation messaging require additive tables before read receipts, unread counts, and direct-message retention can be completed.

Proposed additive models: `Conversation`, `ConversationMember`, `Message`, `MessageReceipt`, and optional `MessageAttachment`, all territory scoped and authorized by role plus organizational relationship.

## Realtime Outbox

Reconnect currently emits a reconcile-required signal and points clients to REST snapshots because no durable realtime outbox exists. A future additive `RealtimeEventOutbox` should store event envelopes with territory fields, event type, version, idempotency key, committed timestamp, and delivery/replay cursor metadata.
