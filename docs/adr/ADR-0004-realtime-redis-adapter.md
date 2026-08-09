# ADR-0004 Realtime Redis Adapter

## Status

Accepted target architecture on 2026-08-09; not implemented.

## Context

Election Day live operations require authenticated multi-instance fan-out, reconnect, and presence. Current 30-second HTTP polling is durable but not realtime.

## Decision

Use Socket.IO with the Socket.IO Redis Adapter and Redis. PostgreSQL/outbox records are authoritative; Redis carries transient fan-out and presence. Clients reconcile over the API after reconnect or Redis loss.

## Consequences

Realtime can scale horizontally without becoming the business source of truth. The design requires authenticated territory rooms, event versions, replay cursors, load tests, and a REST degradation path before release.

## Alternatives Considered

Single-instance Socket.IO was rejected because it cannot support horizontal fan-out. Redis as a durable event store was rejected. Pure polling remains the fallback but does not meet the target live experience.

## Related Master Features

091-120.
