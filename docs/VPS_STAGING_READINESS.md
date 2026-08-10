# VPS Staging Readiness

- **Baseline:** `main @ c41d23ad87189331680723d4a30ef10a22d30717`
- **Assessment date:** 2026-08-10
- **Companion:** [`docs/SPRINT_4_FINAL_AUDIT.md`](SPRINT_4_FINAL_AUDIT.md) (feature status)
- **Nothing is deployed.** No VPS, no DNS, no TLS certificate, no object storage
  bucket, no running TURN server.

## Deployment asset audit

| Component | Result | Evidence |
|---|---|---|
| Dockerfiles (web, api, worker) | PASS | `deploy/docker/*.Dockerfile`, multi-stage, Node 22 Debian slim, non-root, no baked secrets. All three build locally. |
| Production Compose | PASS | `docker-compose.prod.yml`, internal-only network, resource ceilings, log rotation. Brought up locally with all 7 services healthy. |
| Caddy | PASS | `deploy/caddy/Caddyfile`; verified locally: `/healthz`, `/`, `/api/*` prefix strip, and Socket.IO handshake with `upgrades:["websocket"]`. |
| PostgreSQL persistence | PASS | Named volume, `pg_isready` healthcheck, no published port, deterministic `--locale=C` initdb. |
| Redis | PASS | AOF `everysec`, `maxmemory-policy noeviction` so queue state is never silently evicted, no published port. |
| BullMQ Worker | PASS | `apps/worker`, three queues, health endpoint reporting pending/processing/deadLetter, 60s stop grace. Verified processing jobs live. |
| S3 storage contract | PASS | `packages/object-storage`, SigV4, overwrite denial, presigned reads; production env validation rejects any driver but `s3`. **No bucket provisioned.** |
| Coturn configuration | PARTIAL | Config renders, listener accepts TCP, credentials 600, 20 deny ranges enforced (a relay to `172.20.0.4` was actively refused). **Relay data path unproven** — 100% packet loss through Docker Desktop bridge NAT, which is precisely why production uses host networking. |
| Health checks | PASS | All seven services define one; all reached healthy locally. |
| Graceful shutdown | PASS | API closes gateway then server; worker closes BullMQ workers before connections. Verified `shutdown.started` → `shutdown.complete` on restart. |
| Migration service | PASS | One-shot `migrate` target; every long-running service gates on `service_completed_successfully`, so containers cannot race the stream. |
| Migration checksum verification | PASS | `verify-migration-integrity.mjs` runs before `migrate deploy`; 17 legacy + 10 Ogun locked. |
| Backup procedure | PASS | `npm run verify:backup-restore` — dumps, **drops the database**, recreates empty, restores with `--exit-on-error`, requires exit 0, compares content **and** schema fingerprints (82 tables, 1803 schema objects). Fail-closed verified by fault injection. |
| Restore procedure | PASS | Same rehearsal; `pg_restore_exit=0`, both fingerprints match. |
| Load/recovery rehearsal | PASS | 500 jobs, 0 lost, 200/200 exclusive claims, 200/200 stranded recovered. |
| Secrets/env contract | PASS | `.env.production.example` complete, no secrets committed, `verify:deployment` guards against committed credentials and published data-tier ports. |
| Legacy auto-deploy removal | PASS | `render.yaml` (which carried `autoDeploy: true`) and `apps/web/vercel.json` deleted; `verify:deployment` fails if any such artifact reappears anywhere in the tree. |

**Overall: PASS with Coturn PARTIAL.**

## Tests that cannot honestly be completed without a Linux VPS

These are not code defects. Each requires a real host, real DNS, or a real
external service, and none can be settled on a Windows workstation.

| # | Outstanding test | Why it needs a VPS |
|---|---|---|
| 1 | DNS resolution to the host | No domain points anywhere yet |
| 2 | Caddy ACME certificate issuance | Requires public DNS + reachable :80 |
| 3 | Public HTTPS end-to-end | Depends on (1) and (2) |
| 4 | WebSocket upgrade through the public proxy | Local test used plain HTTP on a bridge |
| 5 | Redis restart under the Linux deployment | Verified locally; not on target topology |
| 6 | Worker restart under the Linux deployment | Verified locally; not on target topology |
| 7 | Private S3 bucket connectivity | No bucket exists |
| 8 | Evidence upload/download against real object storage | Covered locally only by the in-memory driver |
| 9 | Coturn allocation on Linux host networking | Bridge NAT invalidates the local result |
| 10 | ICE candidate of `type=relay` observed in a browser | Requires (9) **and** the client SDP/ICE gap in Feature 110 to be closed first |
| 11 | TURN-relayed audio actually flowing | Same as (10) |
| 12 | Previous-image rollback against the migrated schema | Requires two deployed image versions |
| 13 | Backup shipped to an off-host location | No off-host target configured |
| 14 | Restore rehearsal inside staging | Rehearsed locally; not on target |
| 15 | Resource usage under realistic load | Needs production-shaped hardware |
| 16 | Monitoring/logging behaviour | `ERROR_TRACKING_DSN` / OTLP endpoint unset |
| 17 | Firewall verification | Coturn binds the host directly; ufw rules are its only gate |

**Item 10 has a code prerequisite.** Feature 110's client never exchanges SDP or
ICE, so even a perfectly working TURN server would not produce a relay
candidate. That gap must be closed before the TURN relay path can be tested at
all.

## Security residual risk

`npm audit`: **0 critical**, 4 high, 0 moderate, 1 low.

| Package | Severity | Reachable? | Control | Residual risk | Future remediation |
|---|---|---|---|---|---|
| `sharp` (under `next`) | HIGH | **No** | The worker pins `sharp@0.35.3` with patched libvips and resolves it as a nested dependency. Next's own copy is unreachable: `images.unoptimized = true`, no `next/image` imports, evidence served by signed URLs. | Vulnerable code present but never invoked | Clears with the Next 16 upgrade |
| `next` | HIGH | Partially | Aggregate finding over `postcss` and `sharp`; no separate Next code path reported | Build-time CSS processing of first-party stylesheets only | Dedicated Next 16 migration |
| `postcss` | HIGH | **No** | Affects CSS stringify of our own stylesheets; no untrusted CSS input exists | Build-time only, no request path | Clears with Next 16 |
| `xlsx` | HIGH | **No** | Moved to `devDependencies`, so absent from API and worker runtime images (`--omit=dev`). Bootstrap runs in the `migrate` image. The INEC workbook SHA-256 is **verified before parsing**, so a swapped workbook fails closed. | Operator-invoked bootstrap only, on a checksum-pinned file | Replace parser before accepting any external workbook |
| `esbuild` (via `tsx`) | LOW | **No** | Windows dev-server read path; dev tooling only | Not request-reachable in any deployed runtime | Track upstream `tsx` |

No advisory is suppressed. Confirmed: reachable evidence image processing uses
patched sharp; `xlsx` is not in the production runtime; workbook hash
verification precedes parsing.

## Readiness decisions

### READY FOR VPS STAGING: **YES**

Every repository engineering gate is green on this baseline: migration integrity
(17 + 10), 50/50 integration tests, lint, build, all three production rehearsals
(schema-additivity, backup/restore, load/recovery), and zero critical advisories.
The deployment topology is complete enough to launch — Dockerfiles build, the
full seven-service compose stack came up healthy locally with working reverse
proxy, Socket.IO upgrade, Redis-backed realtime and durable job processing, and
migrations are gated behind a one-shot service that cannot race. The remaining
uncertainty is precisely the kind that *only* a real Linux host can resolve: TLS
issuance, host-networked TURN relay, real object storage, and behaviour under
production-shaped load. Staging is the correct next step because it is the
cheapest way to convert those unknowns into facts.

### READY FOR PRODUCTION UAT: **NO**

None of the seventeen staging-only validations has been performed, because no
staging environment exists. UAT additionally presumes the product is usable
end-to-end by its intended roles, and this audit found that it is not yet: only
13 of 140 features survive an end-to-end test, voice calls carry no audio, and
the command hierarchy below Federal Constituency cannot be populated without
authoritative Ogun data. Putting real users in front of that would produce
findings the team already knows about.

### READY FOR PRODUCTION: **NO**

Production requires staging and UAT to have passed first, and neither has begun.
Beyond that, four features are BLOCKED on external inputs the project does not
control — the Ogun reference release, PU geodata, and an approved evidence
retention policy — and material product gaps remain, including two disjoint
reward ledgers with an ungated money-out path that bypasses the configured
minimum threshold and conversion rate. That last item is a financial-integrity
defect and must be closed before any real payout runs.
