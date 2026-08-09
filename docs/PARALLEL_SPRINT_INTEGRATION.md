# Parallel Sprint Integration

- **Integration branch:** `integration/parallel-sprint`
- **Base commit:** `917d24703865695db4787904025aa490c4c90f2c`
- **Integration date:** 2026-08-09
- **Main merge status:** Not merged

## Workstream Status

```text
PLATFORM:
INTEGRATED

ELECTION DAY:
INTEGRATED

PRE-ELECTION:
INTEGRATED

PRE-ELECTION MIGRATION:
20260809030000_pre_election_verification_rewards_foundation

EVIDENCE:
DEFERRED

MIGRATION INTEGRITY:
PASS

DATABASE TESTS:
PASS

LINT:
PASS

BUILD:
PASS

PRISMA:
PASS

READY FOR REVIEW PR:
YES
```

## Features Now Complete

- Versioned Ogun reference-data import contract for State Constituencies, LGAs, Wards, and Polling Units.
- Additive provenance and geodata schema for authoritative Ogun reference imports.
- Validate-first Ogun reference importer with explicit apply mode and idempotency rehearsal path.
- Stricter Ogun reference verification with separate identity/provenance and geodata gates.
- Shared Ogun reference import contracts exported from `packages/shared`.
- Polling Unit Coordinator Election Day check-in and check-out foundation.
- Location ping capture with geofence enforcement intentionally gated until authoritative PU geodata exists.
- Election Day incidents, escalation, reporting status, Situation Room status, realtime contract discovery, and REST messaging fallback.
- Member verification state and voter-document metadata foundation.
- Validator queue, claim, decision, and verification-history workflow.
- Referral qualification on verification approval.
- Reward rule/version, reward event, and immutable ledger foundation.

## Features Still Partial

- Authoritative Ogun State Constituency, LGA, Ward, and Polling Unit data ingestion remains blocked until approved source files are supplied.
- Polling Unit geodata remains blocked until approved coordinates/radii and provenance are supplied.
- GPS geofence enforcement and location mismatch remain gated.
- Redis realtime fanout, dedicated Socket.IO gateway, WebRTC, and full messaging remain TARGET architecture.
- Payout and strength foundations are schema-level only.
- Private voter-document signing/storage is behind the storage abstraction until Evidence/storage runtime is approved.
- Evidence/Post-Election workstream remains deferred.

## Shared Contract Conflicts Resolved

- `apps/api/src/app.ts` now mounts both `/election-day` and `/pre-election` routes.
- `apps/api/src/run-tests.ts` preserves existing Phase 1 tests and adds Election Day and Pre-Election tests.
- `packages/shared/src/platform-contracts.ts` preserves compatible Election Day realtime/status contracts and Pre-Election reward status additions.
- `packages/database/prisma/schema.prisma` preserves Platform reference import schema and adds Pre-Election verification/referral/reward/payout/strength foundation.
- `packages/database/prisma/ogun-migration-manifest.json` preserves Platform migration history and adds the renumbered Pre-Election migration.
- Pre-Election migration timestamp collision was resolved by renaming `20260809020000_pre_election_verification_rewards_foundation` to `20260809030000_pre_election_verification_rewards_foundation`.

## Remaining Blockers

- Authoritative Ogun lower-level reference release is not checked in.
- Authoritative Polling Unit geodata release is not checked in.
- Production-derived migration rehearsal still requires an authorized sanitized snapshot.
- Evidence branch is not integration-ready.
- Existing non-critical audit findings remain tracked: 1 low and 4 high advisories, with no critical advisory found.

## Platform Lead Migration Sequencing Guidance

- Existing migrations remain immutable. No workstream may edit, reorder, delete, or renumber any directory already listed in `packages/database/prisma/ogun-migration-manifest.json`.
- The current active stream ends at `20260809030000_pre_election_verification_rewards_foundation`. The next shared migration slot must use a later UTC timestamp and one coherent snake-case concern name.
- Developer 1 owns shared migration sequencing. Developer 2 reward/payout or strength changes, Developer 3 Election Day session/location/realtime changes, and Developer 4 evidence/storage/audit ownership changes must be proposed to Platform Lead before a migration is generated.
- Reference-data imports are not schema migrations. Approved Ogun identity and geodata releases must be checked in under `packages/database/reference/ogun/<release-id>/`, validated, applied twice in disposable PostgreSQL for idempotency, and then verified with the strict Ogun reference gate.
- LGA must remain reference-only in every migration and importer contract. No migration may add LGA as a target coordinator level, command parent, or authorization shortcut.
- Polling Unit identity and Polling Unit geodata stay separate. Identity imports may unblock Pre-Election territory operations; geodata imports unblock only Election Day GPS/geofence behavior after `--require-geodata` passes.
- If two workstreams need schema changes in the same area, Platform Lead must combine or sequence them before merge; downstream branches should import shared contracts rather than duplicating enums or local status strings.

## Evidence Next Action

Do not integrate Evidence until all of the following pass:

- disposable PostgreSQL full API test pass;
- storage-runtime configuration review;
- object-storage integration test or approved test double;
- migration reconciliation pass against Platform and Pre-Election schema;
- confirmation that no local or container filesystem is treated as authoritative evidence storage.

## Validation Evidence

- `npm run verify:migrations`: PASS
- `npm run verify:docs`: PASS
- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/placeholder npm run prisma:validate`: PASS
- `npm run prisma:generate`: PASS
- `npm run lint`: PASS
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000 npm run build`: PASS
- `npm run test:integration:docker`: PASS
- `npm audit --audit-level=critical`: PASS

