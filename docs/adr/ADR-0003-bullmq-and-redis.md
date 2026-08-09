# ADR-0003 BullMQ and Redis

## Status

Accepted target architecture on 2026-08-09; not implemented.

## Context

Rewards, payouts, notifications, evidence processing, exports, analytics, and cleanup require durable asynchronous execution and retries. Route-local background promises cannot provide operational control or horizontal processing.

## Decision

Use BullMQ with Redis for target job transport. Jobs use shared versioned payloads, idempotency keys, bounded retries, timeouts, dead-letter handling, and durable business results in PostgreSQL/object storage.

## Consequences

A worker runtime and Redis become operational dependencies once jobs are enabled. Redis is not durable business truth, and API transactions must not be considered complete merely because a job was enqueued.

## Alternatives Considered

In-process jobs were rejected for loss and scaling risk. Database polling remains a possible outbox bridge but not the worker API. Introducing a heavier broker was rejected until throughput evidence requires it.

## Related Master Features

040-058, 067-090, 121-140.
