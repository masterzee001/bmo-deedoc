# Infrastructure Boundaries

- **Decision date:** 2026-08-09
- **Rule:** A documented target is not an implemented service

## Implementation Status

Application code and provisioned infrastructure are tracked separately. Code being
implemented does not mean a server is running.

| Service | Application code | Provisioned/running |
|---|---|---|
| Web | Implemented as Next.js | Not deployed |
| API | Implemented as Express | Not deployed |
| PostgreSQL | Implemented Prisma provider; disposable PostgreSQL 16 Docker service for development/tests | No production instance |
| Realtime | Implemented — Socket.IO gateway attached to the API HTTP server (`apps/api/src/realtime/gateway.ts`), with authenticated handshake, territory-scoped subscriptions, presence, and durable event outbox | Not deployed |
| Redis | Implemented — `@socket.io/redis-adapter` client and presence writes; degrades to `DEGRADED_NO_REDIS` when `REDIS_URL` is unset, and `REALTIME_REDIS_REQUIRED` fails closed in production | No Redis server provisioned |
| Worker | **Not implemented** — no BullMQ dependency, no queue code, no `apps/worker` | Not deployed |
| Private object storage | Implemented — `S3CompatibleEvidenceObjectStorage` with AWS SigV4 signing, overwrite denial, server-generated SHA-256, and presigned reads; production env validation forces `STORAGE_DRIVER=s3` | No bucket provisioned |
| STUN/TURN | Signalling and ICE configuration implemented; STUN default configured; TURN credentials validated as required in production | **Coturn server not operational** |

`docker-compose.dev.yml` intentionally contains PostgreSQL only and remains the
development/test database service.

The production topology now exists as committed, locally validated assets:
`docker-compose.prod.yml`, production Dockerfiles for web/api/worker under
`deploy/docker/`, the Caddy reverse proxy, and the Coturn configuration.
Operations procedures are in `docs/DEPLOYMENT_VPS.md`.

**Assets existing is not the same as a running system.** No VPS is provisioned,
no domain resolves, no TLS certificate has been issued, no S3-compatible bucket
exists, and no TURN server is running. Nothing in this repository has been
deployed. Realtime, object storage, queues, and TURN may only be described as
operational once a host actually runs them and their health checks pass.

## Production Deployment Target

The locked production deployment target is **VPS**.

Target production topology:

```text
Internet
   |
   v
Nginx / Caddy
   |
   v
Docker / Docker Compose
   |
   +-- Next.js Web
   +-- Express API + Socket.IO
   +-- BullMQ Worker
   +-- PostgreSQL
   +-- Redis
```

Docker is the service-packaging standard. Docker Compose may be used initially for single-VPS production orchestration after the target services, production secrets handling, persistent volumes, backups, health checks, restart policies, logging, and monitoring are implemented.

Nginx or Caddy terminates HTTPS and reverse-proxies HTTP/WebSocket traffic to the application containers. PostgreSQL requires persistent storage, backups, restore tests, monitoring, and migration controls. Redis requires persistence and configuration appropriate to its queue, realtime, rate-coordination, cache, and transient-presence workloads.

Private S3-compatible object storage may remain external or separately hosted, but it is independent from the application filesystem. Application containers must not rely on ephemeral local filesystem storage for voter documents or election evidence.

WebRTC STUN/TURN may later be provided by a dedicated TURN service such as Coturn.

GitHub Actions `CI / validate` remains the repository validation gate and is separate from production hosting. Existing Render/Vercel files may remain temporarily for legacy compatibility, but they are legacy/non-target deployment paths.

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

No route enqueues a BullMQ job. There is no BullMQ dependency, no queue code, and
no worker service in the repository. Adding a Redis environment variable does not
constitute queue implementation.

## Realtime Direction

Socket.IO plus Socket.IO Redis Adapter plus Redis is the target. Rooms are authorized from current backend role and territory assignments, never from client claims. PostgreSQL remains authoritative. A reconnecting client obtains a durable cursor/snapshot from the API and then resumes live events; transient presence can be rebuilt.

Status: the Situation Room, the authenticated websocket gateway, territory-scoped
rooms, presence, and the durable realtime event outbox are implemented. The Redis
adapter that enables multi-instance fan-out is implemented in code but has no
Redis server provisioned, so live delivery currently runs single-instance and
reports `DEGRADED_NO_REDIS`.

## Evidence Direction

Evidence originals use private S3-compatible object storage with unique non-guessable keys, overwrite denial, server-generated SHA-256, object versioning, custody/access audit, separate derivatives, and Object Lock/WORM where supported and legally approved. PostgreSQL stores metadata and links; the object store stores bytes. Clients never choose final object keys or authoritative hashes.

Private S3-compatible storage, server-side SHA-256 hashing, custody, PU dossier,
controlled manifest export, and the legal-support workspace are implemented and
covered by integration tests. Derivative generation and any queue-driven hashing
worker remain TARGET architecture, blocked on the unimplemented worker runtime
and media processing infrastructure.

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
