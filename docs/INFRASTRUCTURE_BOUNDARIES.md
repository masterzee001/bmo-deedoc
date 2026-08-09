# Infrastructure Boundaries

- **Decision date:** 2026-08-09
- **Rule:** A documented target is not an implemented service

## Implementation Status

| Service | Status |
|---|---|
| Web | Implemented as Next.js |
| API | Implemented as Express |
| PostgreSQL | Implemented Prisma provider; disposable PostgreSQL 16 Docker service added for development/tests |
| Realtime | TARGET only |
| Worker | TARGET only |
| Redis | TARGET only |
| Private object storage | TARGET only |
| STUN/TURN | TARGET only |

`docker-compose.dev.yml` intentionally contains PostgreSQL only. Dockerized API/web, Redis, workers, realtime, object storage, and WebRTC services must not be represented as available until code, health checks, tests, and deployment configuration exist.

## Service Contracts

| Service | Responsibility / owns | Does not own | Data source | Scaling and failure behavior |
|---|---|---|---|---|
| Web | Browser UI, accessibility, route rendering, API/realtime clients | Authorization, durable business truth, secrets | API responses and authorized realtime projections | Horizontally cache/render where safe. API failure shows bounded errors and preserves retryable input. |
| API | Authentication, authorization, validation, command/query APIs, transaction boundaries, signed-access decisions | Long-running jobs, websocket presence, evidence bytes as database blobs | PostgreSQL; target object metadata and Redis adapters | Stateless horizontal instances. Fail closed on auth/config/database failure; return idempotent retry semantics where defined. |
| Realtime | Target Socket.IO connections, authenticated rooms, fan-out, presence, reconnect/replay handoff | Durable business state or command completion | Durable events/outbox in PostgreSQL; transient Redis fan-out | Multiple instances use Socket.IO Redis Adapter. Redis loss degrades live delivery, never deletes durable records; clients reconcile over API. |
| Worker | Target BullMQ job execution, retries, derivatives, notifications, exports, hashing support | User authorization decisions or primary transaction commits | Redis queues plus PostgreSQL/object storage | Scale by queue. Jobs are idempotent, bounded, observable, and dead-lettered; API remains available when workers are delayed. |
| PostgreSQL | Users, assignments, territories, business records, ledgers, durable events/audits, object metadata | Presence, websocket fan-out, large evidence originals | Authoritative transactional data | Managed backups, point-in-time recovery, connection limits, migration control. Write failure stops business commands. |
| Redis | Target BullMQ state, Socket.IO adapter traffic, ephemeral presence/rate coordination/cache | Durable business or legal evidence truth | Derived/transient data only | Highly available target deployment. Flush/loss causes replay/rebuild and delayed jobs, not business-record loss. |
| Object storage | Target private originals, immutable versions, derivatives, manifests | Authorization policy, business metadata, public ACL distribution | Binary objects keyed by database-owned metadata | S3-compatible versioning and lifecycle. Failure pauses upload/access/jobs; no silent fallback to public URLs or database blobs. |
| STUN/TURN | Target WebRTC connectivity and relay | Call authorization, messaging history, automatic recording | Ephemeral signalling/relay metadata | Multiple regional endpoints where required. Failure falls back to text/telephone procedures and never blocks reports/incidents. |

## Queue Direction

BullMQ plus Redis is the target asynchronous job platform. Candidate jobs include reward/bonus processing, payout eligibility, notifications, evidence hashing verification, thumbnails, video derivatives, exports, analytics snapshots, and cleanup. Producers emit a typed `PlatformEventEnvelope`; consumers require idempotency keys, bounded retries, timeout, dead-letter handling, and observable outcomes.

No Phase 0 route enqueues a BullMQ job. Adding a Redis environment variable does not constitute queue implementation.

## Realtime Direction

Socket.IO plus Socket.IO Redis Adapter plus Redis is the target. Rooms are authorized from current backend role and territory assignments, never from client claims. PostgreSQL remains authoritative. A reconnecting client obtains a durable cursor/snapshot from the API and then resumes live events; transient presence can be rebuilt.

No Election Situation Room, websocket gateway, presence service, or multi-instance fan-out is implemented in Phase 0.

## Evidence Direction

Evidence originals use private S3-compatible object storage with unique non-guessable keys, overwrite denial, server-generated SHA-256, object versioning, custody/access audit, separate derivatives, and Object Lock/WORM where supported and legally approved. PostgreSQL stores metadata and links; the object store stores bytes. Clients never choose final object keys or authoritative hashes.

Private storage, hashing workers, derivatives, custody, dossier, export, and legal-workspace implementation remains TARGET architecture.

## Canonical Code Homes

| Concern | Canonical location |
|---|---|
| Shared enums, event/audit envelopes | `packages/shared/src/platform-contracts.ts` |
| Database schema and migrations | `packages/database/prisma/` and `prisma/ogun-migrations/` |
| API validated environment | `apps/api/src/env.ts` |
| Backend authorization | `apps/api/src/authorization.ts` for target paths; `apps/api/src/scope.ts` remains legacy/transitional |
| Web API contracts | `packages/shared` and the existing web API client modules |
| Future queue producers/consumers | One shared queue contract package plus dedicated worker application; no route-local queue names |
| Future realtime events | Shared versioned event contracts plus dedicated realtime application; no UI-invented event names |
| Future storage | Dedicated evidence/storage module; no direct bucket SDK usage in feature routes |

Any new cross-domain abstraction requires Platform Lead review before another developer creates a parallel version.
