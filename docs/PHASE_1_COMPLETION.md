# Phase 1 Completion: Ogun Territory and Role Architecture

- **Completion date:** 2026-08-09
- **Review branch:** `phase-1-ogun-territory-role-architecture`
- **Status:** PASS for architecture review
- **Master features addressed:** 001-023 and 025
- **Next phase:** Not started

## Delivered Foundation

### User role architecture

The persisted and shared target roles are `SUPER_ADMIN`, `STATE_OFFICER`, `COORDINATOR`, `VALIDATOR`, `PAYOUT_OFFICER`, and `MEMBER`. Legacy `ADMIN`, `CANDIDATE`, `AGENT`, and `VOTER` values remain compatibility literals for staged migration. `AccountStatus` enforces `ACTIVE`, `INACTIVE`, and `SUSPENDED`; protected requests reload current database state, so an existing JWT cannot bypass a status change.

`CoordinatorLevel` is canonically defined as `SENATORIAL_DISTRICT`, `FEDERAL_CONSTITUENCY`, `STATE_CONSTITUENCY`, `WARD`, and `POLLING_UNIT`. `CoordinatorProfile` gives one user one level and one operational scope. It deliberately has no `lgaId`.

### Territory authorization

`apps/api/src/authorization.ts` resolves canonical Ogun records and validates this command chain:

```text
OGUN STATE
-> SENATORIAL DISTRICT
-> FEDERAL CONSTITUENCY
-> STATE CONSTITUENCY
-> WARD
-> POLLING UNIT
```

`StateConstituency.federalConstituencyId` and `Ward.stateConstituencyId` are additive, nullable command-parent links so existing rows remain deployable. Missing links fail closed. Role, coordinator level, current account status, assigned territory, resource territory, and action all participate in the backend decision. LGA remains available in legacy/reference models for search, filtering, reporting, and INEC alignment but cannot grant target command access.

The `/platform` target routes provide scoped organization traversal, coordinator creation, superior-only assignment/reassignment, account status management, and Candidate-domain reads/writes. Self-reassignment, peer/sibling management, superior management, specialist command inheritance, cross-State writes, and cross-territory IDOR are denied. Important changes use the existing `AuditLog` model.

### Candidate domain migration

`Candidate` is a user-independent domain model with additive links from assignments, events, polls, posts, and feedback. Public target Candidate routes do not require Candidate authentication. The migration creates a Candidate from each eligible Ogun `CandidateProfile`, copies reusable profile fields, and backfills domain links without deleting the legacy User, profile, media ownership, or campaign content.

Legacy Candidate login and self-service routes remain `LEGACY / TRANSITIONAL`. They must not be removed until all content operations move to authorized officers and relationship reconciliation is approved.

### Agent and Member migration

Eligible Ogun `AGENT` users with complete canonical PU ancestry migrate to `COORDINATOR + POLLING_UNIT`. `AgentProfile`, GPS consent, active session nonce, activities, tasks, incidents, Election Day reports, notifications, and user-keyed history remain untouched. Compatibility middleware restricts legacy field routes to an Agent or a migrated Polling Unit Coordinator that still owns an AgentProfile; higher coordinators cannot gain field-agent capability.

Eligible Ogun `VOTER` users migrate to `MEMBER` while retaining `VoterProfile`, referral, consent, reward, and participation relationships. Existing Member-facing routes accept both transitional Voter and target Member identities. Registration terminology and optional verification evidence remain Phase 2 work.

### Controlled data migration

Run a report only:

```bash
npm run migrate:phase1-identities
```

Apply only after review:

```bash
npm run migrate:phase1-identities -- --apply --actor-user-id=<super-admin-user-id>
```

The utility is idempotent, logs intended actions, creates no duplicate CoordinatorProfile or Candidate records, and writes audits on apply. It blocks non-Ogun profiles, missing profiles, invalid command ancestry, and legacy National, geopolitical-zone, or LGA admin roles. It never silently deletes or deactivates an account.

## Database Migration

The additive Ogun migration is:

```text
20260809010000_phase1_role_territory_foundation
```

It adds target enum values, account status, CoordinatorProfile, Candidate, candidate-domain foreign keys, and command-parent links. It preserves legacy tables, columns, enum values, profiles, foreign keys, and data. Existing migrations modified: `0`.

## Verification

The Phase 1 PostgreSQL suite covers:

- Super Admin, State Officer, every Coordinator level, Validator, Payout Officer, and Member.
- Own, descendant, peer, unrelated, superior, inactive, and suspended cases.
- Same-LGA records that do not share command ancestry.
- Backend IDOR denial, self-reassignment denial, and specialist negative permissions.
- Complete and incomplete organization-tree behavior plus coordinator-scoped output.
- Candidate-domain access without Candidate authentication.
- Candidate relation backfill and preservation of the legacy Candidate User/Profile.
- Agent-to-PU-Coordinator and Voter-to-Member preservation, compatibility, and rerun safety.

Final command evidence is recorded below after the clean disposable PostgreSQL run. No reward engine, payout workflow, realtime gateway, worker, Redis runtime, WebRTC, evidence pipeline, or legal workspace was introduced.

### Final verification result

| Gate | Result |
|---|---|
| Documentation | PASS; all 140 master features and 12 required current documents verified |
| Migration integrity | PASS; 17 protected legacy migrations and 2 Ogun migrations verified |
| Prisma | PASS; generate, validate, clean deploy, reconciliation, and no-drift checks |
| Lint | PASS across API, web, database, and shared workspaces |
| Build | PASS; API/database/shared compile and Next.js generates 34 routes with the documented API URL |
| Disposable PostgreSQL | PASS; PostgreSQL 16 container, network, and volume destroyed after the run |
| API/integration tests | PASS; 22 of 22 cases, including 6 Phase 1 architecture/security cases |
| Dependency critical gate | PASS; 0 critical findings, with 4 high and 1 low findings still tracked under Phase 0 controls |
| Strict Ogun reference gate | BLOCKED as designed on missing authoritative lower-level data; structural `--allow-incomplete` check passes |
| Hosted CI | PASS; `CI / validate` run `31300468657` completed on commit `f9f0762` |

## Transitional Code

- `apps/api/src/scope.ts` and legacy Admin routes retain old role/LGA semantics for existing clients.
- Legacy Candidate authentication and dashboard routes remain during content cutover.
- `AdminProfile`, `CandidateProfile`, `AgentProfile`, and `VoterProfile` remain for compatibility and preservation.
- Legacy enum values remain persisted until a production-derived migration and reconciliation proves retirement is safe.
- The small `/platform` web view is a hierarchy/navigation surface, not a Phase 4 dashboard redesign.

## Remaining Blockers

1. Approve and import versioned Ogun LGAs, 26 State Constituencies, Wards, Polling Units, and direct command-parent mappings. Current real lower-level assignments remain blocked.
2. Run the Phase 0 production-derived migration rehearsal against an approved sanitized snapshot and migration-history export.
3. Review the dry-run production identity exception report before any `--apply` execution.
4. Retire legacy role/routes only after dual-read reconciliation and dependent frontend/domain cutover.

## Parallel Development Gate

`PARALLEL DEVELOPMENT: SAFE` for Developers 2, 3, and 4 to branch against this reviewed foundation. This does not authorize production identity migration, invented reference data, Phase 2 startup without review, or independent edits to shared platform boundaries.

Platform Lead approval is required before modifying:

- `packages/database/prisma/schema.prisma`
- `packages/database/prisma/ogun-migrations/`
- `packages/shared/src/platform-contracts.ts`
- target role/account/coordinator types in `packages/shared/src/index.ts`
- `apps/api/src/authorization.ts`
- `apps/api/src/middleware/auth.ts`
- `apps/api/src/auth/profile.ts`
- `apps/api/src/auth/jwt.ts`
- `apps/api/src/lib/organization-tree.ts`
- `apps/api/src/routes/platform.ts`
- `packages/database/scripts/migrate-phase1-identities.ts`

Stop for architecture review. Do not begin Phase 2 automatically.
