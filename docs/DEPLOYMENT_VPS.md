# VPS Deployment and Operations

- **Production target:** single Linux VPS running Docker Compose
- **Status:** runtime topology implemented and validated locally. **Nothing is deployed.** No VPS has been provisioned, no bucket exists, no TURN server is running.

```text
Internet
   ↓
Caddy (TLS, :80 :443)
   ↓
Docker Compose (internal network)
   ├── Next.js Web          :3000
   ├── Express API + Socket.IO  :4000
   ├── BullMQ Worker        :4100 (health only)
   ├── PostgreSQL           :5432  (never published)
   └── Redis                :6379  (never published)

Coturn (host network, TURN relay)
Private S3-compatible object storage (external service)
```

Only Caddy and Coturn are reachable from the internet. Postgres and Redis have no published ports at all.

---

## 1. Initial VPS setup

Minimum practical sizing: 4 vCPU, 8 GB RAM, 80 GB SSD. The worker generates image derivatives, which is memory-hungry in bursts.

```bash
# Docker Engine + Compose plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"   # re-login afterwards

# Confirm
docker --version && docker compose version
```

Create a deploy user, disable password SSH login, and enable unattended security updates before exposing anything.

## 2. DNS

Point an A record at the VPS public IP **before** first start. Caddy performs an ACME HTTP challenge on first boot and will fail if DNS does not resolve.

```text
ops.example.org.   A   203.0.113.10
```

If TURN is served from the same host, its realm should be the same name.

## 3. Firewall

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp                  # SSH — restrict to your admin IP if possible
sudo ufw allow 80/tcp                  # ACME challenge + HTTP→HTTPS redirect
sudo ufw allow 443/tcp                 # HTTPS
sudo ufw allow 443/udp                 # HTTP/3
sudo ufw allow 3478/tcp                # TURN listener
sudo ufw allow 3478/udp                # TURN listener
sudo ufw allow 5349/tcp                # TURN over TLS
sudo ufw allow 5349/udp                # TURN over DTLS
sudo ufw allow 49160:49200/udp         # TURN relay range — must match TURN_MIN_PORT/TURN_MAX_PORT
sudo ufw enable
```

The relay range is the one most often forgotten. Without it, calls negotiate and then carry no audio.

Do **not** open 5432 or 6379. They are internal to the compose network.

## 4. Environment and secrets

```bash
git clone https://github.com/masterzee001/bmo-deedoc.git
cd bmo-deedoc
cp .env.production.example .env.production
chmod 600 .env.production
$EDITOR .env.production
```

Generate real secrets:

```bash
openssl rand -base64 48    # JWT_SECRET
openssl rand -base64 32    # POSTGRES_PASSWORD
openssl rand -base64 32    # TURN_CREDENTIAL
```

`.env*` is gitignored. Never commit it, and never bake it into an image.

**Object storage must be provisioned separately.** Create a private, versioned S3-compatible bucket with no public read, then set `STORAGE_*`. The API refuses to start in production with any driver other than `s3`. Nothing in this repository creates the bucket.

## 5. Database migration

Migrations are run by a dedicated one-shot `migrate` service. Every long-running service declares `depends_on: migrate: service_completed_successfully`, so **containers cannot race the migration stream** — a restarting API replica will never apply migrations concurrently with another.

The migrate service verifies checksums before applying anything and refuses to deploy if an existing migration was modified.

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm migrate
```

`packages/database/prisma.config.ts` disables dotenv loading, so Prisma reads `DATABASE_URL` from the **process environment only**. Any manual invocation must pass it explicitly:

```bash
DATABASE_URL="postgresql://..." npx prisma migrate deploy --config packages/database/prisma.config.ts
```

## 6. First-deploy bootstrap (once, never on restart)

Reference data and the Super Admin are seeded by an explicit one-off command, deliberately **not** part of container startup. A restart never re-seeds and never mutates existing records.

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm \
  -e SUPER_ADMIN_EMAIL=... -e SUPER_ADMIN_PASSWORD=... \
  api npm run deploy:bootstrap
```

There is no demo or fixture seeding path in production.

## 7. Start

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml ps
```

Startup order is enforced by health conditions: postgres and redis become healthy → migrate runs to completion → api and worker start → web starts → caddy starts.

## 8. Health checks

| Service | Check |
|---|---|
| Edge | `curl -fsS https://ops.example.org/healthz` |
| Web | `curl -fsS https://ops.example.org/health` |
| API | `docker compose -f docker-compose.prod.yml exec api wget -qO- http://127.0.0.1:4000/health` |
| Worker | `docker compose -f docker-compose.prod.yml exec worker wget -qO- http://127.0.0.1:4100/health` |
| Postgres | `docker compose -f docker-compose.prod.yml exec postgres pg_isready -U "$POSTGRES_USER"` |
| Redis | `docker compose -f docker-compose.prod.yml exec redis redis-cli ping` |

The worker health payload also reports `pending`, `processing`, and `deadLetter` job counts. A climbing `deadLetter` count is the signal that jobs are failing permanently and need operator attention.

Realtime readiness is reported at `GET /election-day/realtime-contracts`. In production it must read `AVAILABLE`; `DEGRADED_NO_REDIS` means the adapter never connected.

## 9. Logs

```bash
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f worker --since 15m
```

Logs are JSON, capped at 10 MB × 5 files per service so a chatty container cannot fill the disk.

## 10. Restart and graceful shutdown

```bash
docker compose -f docker-compose.prod.yml restart api
```

The API closes its realtime gateway and HTTP server on SIGTERM. The worker closes its BullMQ workers before its connections, so an in-flight job records its outcome instead of being stranded — it gets a 60 s grace period for that reason.

If a worker is killed anyway, jobs left in `PROCESSING` beyond `WORKER_STALE_PROCESSING_MINUTES` are automatically swept back to `PENDING` and retried.

## 11. PostgreSQL backup

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom \
  > "backup-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Schedule daily, ship off-host, and **test the restore** — an untested backup is not a backup. Evidence originals live in object storage and are covered by that provider's versioning, not by `pg_dump`.

## 12. Restore

```bash
docker compose -f docker-compose.prod.yml stop api worker web
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists < backup.dump
docker compose -f docker-compose.prod.yml start api worker web
```

Stop the application tier first so nothing writes during the restore.

## 13. Redis recovery

Redis holds queues, realtime fan-out, and presence — never business truth. A total Redis loss is recoverable:

```bash
docker compose -f docker-compose.prod.yml restart redis
```

Accepted background work survives, because the API records every job as a durable `BackgroundJob` row in PostgreSQL and never requires Redis to accept it. The worker sweeps `PENDING` rows back into BullMQ on its next poll. **Losing Redis delays work; it does not lose accepted work.**

Undelivered realtime events survive in `RealtimeEventOutbox` and are replayed. Clients additionally reconcile through `GET /election-day/realtime/replay`.

`maxmemory-policy` is `noeviction` on purpose: silently evicting queue state would lose jobs. If Redis fills, writes fail loudly instead.

## 14. Worker recovery

```bash
docker compose -f docker-compose.prod.yml restart worker
docker compose -f docker-compose.prod.yml exec worker wget -qO- http://127.0.0.1:4100/health
```

Inspect dead letters before clearing them:

```sql
SELECT "jobName", "attempts", "lastError", "updatedAt"
FROM "BackgroundJob" WHERE status = 'DEAD_LETTER' ORDER BY "updatedAt" DESC LIMIT 50;
```

## 15. Coturn verification

Config parsing is not proof of function. Verify an actual relay allocation:

```bash
docker compose -f docker-compose.prod.yml logs coturn | tail -30

# Requires coturn-utils locally
turnutils_uclient -v -u "$TURN_USERNAME" -w "$TURN_CREDENTIAL" ops.example.org
```

Then confirm the application agrees: `GET /election-day/webrtc/config` must report `turnConfigured: true`. It reports `false` unless `TURN_URL` is a valid `turn:`/`turns:` URI **and** both credentials are set, so a half-configured relay is never advertised as working.

Browser-side check: open the call panel, start a call, and confirm an ICE candidate of type `relay` appears. Candidates of type `srflx` only mean STUN worked, not TURN.

`recording` is always `DISABLED`. No call media is captured or persisted anywhere in this topology.

## 16. Rollback

Images are tagged by `IMAGE_TAG`. To roll back application code:

```bash
IMAGE_TAG=<previous-tag> docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

**Migrations do not roll back automatically.** The stream is additive by policy — new tables, columns, and enum values only — so a previous application image continues to run against a newer schema. That is the intended rollback path.

If a migration itself must be reversed, restore the database from backup (§12) and redeploy the matching image. Never hand-edit an applied migration: checksums are locked and `verify:migrations` will fail the next deploy.

---

## What is not covered here

- Multi-host scale-out. The topology is intentionally single-VPS; service boundaries allow later separation without application redesign.
- Off-host log shipping, metrics, and alerting (`ERROR_TRACKING_DSN` and `OTEL_EXPORTER_OTLP_ENDPOINT` are wired but unset).
- Automated backup scheduling. §11 gives the command; cron or a systemd timer is an operator decision.
