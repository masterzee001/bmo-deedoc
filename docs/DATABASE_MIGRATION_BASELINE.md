# Database Migration Baseline

- **Decision date:** 2026-08-09
- **Current Prisma provider:** PostgreSQL
- **Operational state:** Ogun
- **Decision record:** `docs/adr/ADR-0001-postgresql-baseline.md`

## Current State

`packages/database/prisma/schema.prisma` and both migration lock files declare PostgreSQL. No local or production credentials, production schema export, or production `_prisma_migrations` export were present during Phase 0, so the physical development and production database histories cannot be asserted from repository evidence alone.

The legacy directory `packages/database/prisma/migrations/` contains 17 migrations. The first five contain SQLite-only constructs such as `DATETIME`, `PRAGMA`, and table rebuilds. The remaining 12 are PostgreSQL or PostgreSQL-compatible. Replaying all 17 against a clean PostgreSQL database is unsafe.

Every legacy migration is preserved byte-for-byte and recorded with its dialect and SHA-256 digest in `packages/database/prisma/legacy-migration-manifest.json`. The active Ogun migrations are independently checksum-locked in `packages/database/prisma/ogun-migration-manifest.json`. `npm run verify:migrations` rejects edits, unmanifested Ogun migrations, additions to the legacy stream, SQLite syntax in the Ogun stream, and unapproved destructive SQL.

## Chosen Strategy

The repository now has two explicit streams:

| Stream | Location | Purpose |
|---|---|---|
| Legacy history | `packages/database/prisma/migrations/` | Forensic record and reconciliation with databases that may report these migrations. Never replayed for a new Ogun database. |
| Ogun PostgreSQL | `packages/database/prisma/ogun-migrations/` | Active stream for clean PostgreSQL builds and every future Ogun schema change. |

`packages/database/prisma.config.ts` selects the Ogun stream. Its first migration, `20260809000000_ogun_postgresql_baseline`, was generated from an empty PostgreSQL schema against the current Prisma model. It creates the baseline without deleting or modifying legacy history.

## Developer Procedure

1. Copy `.env.example` to a local ignored environment file and keep the database host local.
2. Run `npm run db:dev:up` to start PostgreSQL 16 on the configured development port.
3. Run `npm run prisma:migrate:deploy`, `npm run seed`, and `npm run bootstrap:reference-data`.
4. Run `npm run prisma:validate` and `npm run verify:reference:ogun:allow-incomplete`.

Ogun lower-level reference-data releases must be rehearsed after the schema migration and before production apply:

```bash
npm run validate:reference:ogun-release --workspace @pics-nigeria/database -- --release-dir packages/database/reference/ogun/<release-id>
npm run import:reference:ogun --workspace @pics-nigeria/database -- --release-dir packages/database/reference/ogun/<release-id> --apply
npm run import:reference:ogun --workspace @pics-nigeria/database -- --release-dir packages/database/reference/ogun/<release-id> --apply
npm run verify:reference:ogun --workspace @pics-nigeria/database
```

The repeated import is the idempotency rehearsal. Do not use `--require-geodata` unless the release is a separately approved Polling Unit geodata release and Election Day geofence readiness is being rehearsed.
5. Use `npm run test:integration:docker` for the complete isolated create, migrate, seed, bootstrap, test, and destroy cycle.
6. Run `npm run db:dev:destroy` only for a disposable local environment. It is never a production procedure.

The integration runner refuses remote database hosts and requires a test/CI database name. It creates a unique Docker Compose project and removes its container, network, and volume after the run.

## New Migration Procedure

1. Change `schema.prisma` for one coherent schema concern.
2. Create a descriptive migration with `npm run prisma:migrate:create --workspace @pics-nigeria/database -- --name <description>`.
3. Never use `init` as a repeated migration name.
4. Inspect the generated SQL and run `npm run verify:migrations`.
5. Add a `-- DESTRUCTIVE-MIGRATION-APPROVED:` marker only after explicit Platform Lead and data-owner review when SQL drops, truncates, or narrows data.
6. Run the full disposable PostgreSQL integration suite before review.
7. Production applies reviewed migrations with `prisma migrate deploy`, never `migrate dev`, `db push`, or reset.

Migration directories use sortable UTC timestamps followed by lower snake case, for example `20260809143000_add_coordinator_assignments`. Never edit a migration after it has been deployed or merged to `main`; add a corrective migration instead.

## Existing Production Procedure

Production reconciliation is fail-closed:

1. Take a database backup and capture the live schema plus the complete `_prisma_migrations` table.
2. Restore a sanitized copy into an isolated PostgreSQL rehearsal environment.
3. Compare the restored schema with `schema.prisma`; inventory data exceptions separately from schema drift.
4. Provision an empty disposable PostgreSQL database and set `BASELINE_SHADOW_DATABASE_URL` to it. It must be a separate database from `DATABASE_URL`; using another schema in the live database is rejected.
5. Run `npm run prisma:ensure-production` against the rehearsal copy. The command reconstructs only the immutable baseline in the shadow database and compares the unbaselined live schema to that baseline, not to the latest datamodel.
6. If the database is empty, the Ogun baseline is deployed normally.
7. If the database is non-empty and exactly matches the baseline schema, the command records the Ogun baseline as applied and deploys subsequent Ogun migrations.
8. If any schema drift exists, an Ogun migration is recorded without the baseline, or the shadow database is unavailable, the command aborts. Reconcile drift with reviewed SQL or an additive migration; do not mark the baseline applied by assumption.
9. Rehearse application reads/writes, migration rollback, and backup restoration before scheduling production.
10. Repeat the reviewed steps in production under a maintenance and monitoring plan.

The previous behavior that marked every legacy migration applied after a broad `P3005` condition has been removed. No automatic reset, history deletion, or unverified baseline marking is allowed.

## Production-Derived Rehearsal Operator Runbook

**Closure status:** `BLOCKED - production snapshot/access required`. No production credentials, local `.env`, production schema export, migration-history export, or sanitized dump was available on 2026-08-09. The disposable exact-schema simulation is not a production-derived rehearsal.

An authorized database operator must perform the following. The dump must remain outside the repository and contain only data approved for the isolated rehearsal environment.

1. Capture the source identity, PostgreSQL version, snapshot timestamp, backup identifier, and complete `_prisma_migrations` export. Create a custom-format dump using an approved secure workstation:

```bash
pg_dump "$PRODUCTION_DATABASE_URL" --format=custom --no-owner --no-acl --file=/secure/ogun-production-sanitized.dump
```

2. Sanitize personal data under the approved data-handling procedure before the dump leaves the controlled environment. Do not commit the dump, credentials, query output, or personal records.
3. From a clean repository worktree, start a uniquely named isolated PostgreSQL project. The commands below target only local port `55434` and database `ogun_phase0_test`:

```powershell
$env:OGUN_POSTGRES_PORT = "55434"
docker compose -p ogun-production-rehearsal -f docker-compose.dev.yml up -d --wait postgres
docker cp "C:\secure\ogun-production-sanitized.dump" ogun-production-rehearsal-postgres-1:/tmp/production.dump
docker compose -p ogun-production-rehearsal -f docker-compose.dev.yml exec -T postgres pg_restore --exit-on-error --no-owner --no-privileges --dbname=ogun_phase0_test /tmp/production.dump
docker compose -p ogun-production-rehearsal -f docker-compose.dev.yml exec -T postgres createdb --username=ogun_test ogun_phase0_baseline_shadow
$env:DATABASE_URL = "postgresql://ogun_test:ogun_test_local_only@127.0.0.1:55434/ogun_phase0_test?schema=public"
$env:BASELINE_SHADOW_DATABASE_URL = "postgresql://ogun_test:ogun_test_local_only@127.0.0.1:55434/ogun_phase0_baseline_shadow?schema=public"
```

4. Run the locked migration and schema checks. `prisma:ensure-production` must fail if the restored schema differs from the baseline; do not bypass or manually mark migrations:

```powershell
npm ci
npm run verify:migrations
npm run prisma:generate
npm run prisma:validate
npm run prisma:ensure-production
npm run verify:production
npm run verify:reference:ogun:allow-incomplete
```

5. Run read-only representative counts without exposing row contents:

```powershell
docker compose -p ogun-production-rehearsal -f docker-compose.dev.yml exec -T postgres psql --username=ogun_test --dbname=ogun_phase0_test --set=ON_ERROR_STOP=1 --command='BEGIN TRANSACTION READ ONLY; SELECT (SELECT COUNT(*) FROM "User") AS users, (SELECT COUNT(*) FROM "State") AS states, (SELECT COUNT(*) FROM "SenatorialDistrict") AS senatorial_districts, (SELECT COUNT(*) FROM "FederalConstituency") AS federal_constituencies, (SELECT COUNT(*) FROM "AuditLog") AS audit_logs; COMMIT;'
```

6. Start the API with rehearsal-only secrets, call `/health`, and execute approved read-only smoke queries for authentication profile lookup and territory/reference lists. Do not send notifications, run bootstrap/seed, or exercise payout/reward writes against the clone unless the rehearsal plan explicitly authorizes those mutations.
7. Record migration names, checksums, schema-diff result, aggregate query results, application smoke-test result, duration, rollback observation, and operator/reviewer sign-off. Record no personal row data.
8. Destroy the clone and securely delete the dump after evidence is captured:

```powershell
docker compose -p ogun-production-rehearsal -f docker-compose.dev.yml down --volumes --remove-orphans
Remove-Item -LiteralPath "C:\secure\ogun-production-sanitized.dump"
```

Before the destructive cleanup command, the operator must verify that the Compose project is exactly `ogun-production-rehearsal` and the dump path is the approved secure snapshot path.

## Rollback

Prisma migrations are forward-only. Each migration review must state one of:

- application rollback is safe because the change is backward compatible;
- a compensating migration is supplied;
- a database restore is required and its recovery-point objective is accepted.

Additive columns and dual-read/dual-write transitions are preferred. Destructive cleanup occurs only after backfill reconciliation, a release cutover, and an accepted restore rehearsal.

## Prohibited Practices

- Do not edit, delete, reorder, or replay the legacy migrations.
- Do not reset, shadow, or test against production or staging data.
- Do not use `prisma db push --accept-data-loss` as a migration mechanism.
- Do not manually alter `_prisma_migrations` outside the reviewed baseline procedure.
- Do not manufacture electoral reference records to make a migration or test pass.
- Do not merge a schema change without its migration, integrity check, rollback note, and Platform Lead review.

## Open Production Gate

The clean PostgreSQL build is proven. The disposable suite also proves idempotent handling of an applied baseline and safe resolution of a non-empty, untracked baseline schema before subsequent migrations deploy. The active baseline is `20260809000000_ogun_postgresql_baseline`, SHA-256 `54ecb637075cc952fca4b0969dec080c5d3e5ca2ded16793e14e5c3372dc6d63`. The path cannot be approved for production until the runbook above succeeds against a sanitized production schema and migration-history snapshot. This remains a Phase 0 closure blocker.
