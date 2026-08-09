# Phase 1 Architecture Review

- **Review date:** 2026-08-09
- **Review branch:** `phase-1-ogun-territory-role-architecture`
- **Scope:** Complete Phase 0 and Phase 1 worktree
- **Phase 2:** Not started
- **Architecture decision:** Approved subject to the external production rehearsal and hosted CI gates recorded below

## Governing Contract

The review used `README.md`, `MASTER_FEATURES.md`, `TECHNICAL.md`, the RBAC/territory contract, implementation audit and roadmap, Phase 0 and Phase 1 completion reports, reference-data readiness assessment, and security baseline. `MASTER_FEATURES.md` remains unchanged and is the functional source of truth.

The canonical target authentication roles remain `SUPER_ADMIN`, `STATE_OFFICER`, `COORDINATOR`, `VALIDATOR`, `PAYOUT_OFFICER`, and `MEMBER`. Coordinator level remains separate and limited to Senatorial District, Federal Constituency, State Constituency, Ward, and Polling Unit. Candidate remains a domain entity. Legacy Candidate and Agent role literals and routes remain explicitly transitional for data-preserving cutover; they are not target roles.

## Diff Review

The complete Phase 0 and Phase 1 change set was reviewed for scope, debug artifacts, secrets, private keys, machine-specific paths, migration safety, duplicated role/territory contracts, authorization regressions, and destructive data changes.

- No unrelated product feature, Phase 2 implementation, temporary artifact, credential, private key, or machine-specific path is included.
- `package-lock.json` changes correspond to the reviewed dependency upgrades and workspace metadata.
- The large `schema.prisma` diff includes Prisma formatting plus the reviewed additive Phase 1 models, enum values, relations, indexes, and command-parent keys.
- Docker contains PostgreSQL only. Redis, realtime, workers, object storage, WebRTC, and related structures remain marked TARGET/RESERVED.
- The target role, status, coordinator-level, territory-kind, event, and audit contracts have one shared source in `packages/shared/src/platform-contracts.ts`. Persisted Prisma enums mirror the shared contract at the database boundary.
- Legacy LGA-aware authorization remains isolated in explicitly transitional routes. Target authorization contains no LGA command scope.

## Review Corrections

The gate review identified and resolved the following before publication:

1. Hosted CI originally ignored review-branch pushes. The workflow now validates every pushed branch and pull request while retaining read-only repository permissions.
2. Existing-database reconciliation compared an unbaselined database with the latest datamodel. It now compares against a temporary baseline-only migration replay in a separate disposable shadow database, rejects missing/collocated shadow configuration, rejects later Ogun markers without the baseline, marks only the baseline, then deploys subsequent migrations.
3. The integration suite now reconstructs a genuinely untracked baseline schema instead of deleting one marker from a fully migrated schema.
4. The organization tree now checks the known Ogun counts of 3 Senatorial Districts, 9 Federal Constituencies, 26 State Constituencies, and 20 reference LGAs in addition to command-parent and child completeness.
5. Ogun reference verification now treats Polling Unit identity/provenance and Polling Unit geodata as separate gates. Missing coordinates do not block Pre-Election identity work.
6. Identity migration apply now requires an active, non-suspended Super Admin actor.
7. Agent preservation coverage now explicitly verifies GPS consent, session nonce, activities, tasks, incidents, Election Day reports and assets, notifications, and audit history.

## Migration Integrity

| Migration | SHA-256 | Review |
|---|---|---|
| `20260809000000_ogun_postgresql_baseline` | `54ecb637075cc952fca4b0969dec080c5d3e5ca2ded16793e14e5c3372dc6d63` | Preserved; no Phase 1 edit |
| `20260809010000_phase1_role_territory_foundation` | `8a1e5ee41d5f757826b4f93de85b4ebac81a84d0d570df71d68d69e1109a0e89` | Additive and non-destructive |

All 17 legacy migrations and both active Ogun migrations are checksum-locked. The Phase 1 migration adds enum values, nullable relationship keys, account status, Candidate, and CoordinatorProfile structures. It does not drop, truncate, narrow, rename, or delete legacy data. Foreign keys retain legacy records and use restrictive or nulling behavior rather than cascading removal from new domain links.

## Identity Migration Review

The migration utility is dry-run by default. Apply requires an explicit flag and a valid active Super Admin actor. Each identity writes in a transaction, repeated runs do not create duplicate Candidate or CoordinatorProfile rows, blocked records remain unchanged, and there are no delete or implicit deactivate operations.

| Legacy identity | Target treatment | Preservation result |
|---|---|---|
| Ogun State `ADMIN` | `STATE_OFFICER` | User and AdminProfile retained |
| Valid Ogun command-level `ADMIN` | `COORDINATOR` plus canonical level/assignment | User and AdminProfile retained |
| National, zone, LGA, non-Ogun, or incomplete `ADMIN` | Blocked for manual review | No mutation |
| Ogun `CANDIDATE` | Candidate domain record plus additive relationship backfill | Legacy User, CandidateProfile, media ownership, assignments, events, polls, posts, and feedback retained |
| Ogun `AGENT` with complete PU ancestry | `COORDINATOR + POLLING_UNIT` | AgentProfile and all operational/history relations retained |
| Ogun `VOTER` | `MEMBER` | VoterProfile, consent, referral, reward, and participation relations retained |

## Territory And Reference Review

Target authorization resolves the locked command hierarchy from canonical database relationships and rejects non-Ogun IDs, missing parents, mismatched parents, peers, siblings, superiors, self-reassignment, inactive accounts, suspended accounts, and specialist command access. LGA is used only as reference data and never participates in target inheritance or authority.

Real lower-level Ogun data remains unavailable. The organization tree therefore remains operationally fail-closed. The versioned import plan in `OGUN_REFERENCE_DATA_READINESS.md` defines immutable release manifests, checksums, source provenance, stable canonical IDs, staging, duplicate/orphan/conflict checks, direct relationship validation, idempotent transactional upserts, no implicit deletes, and separate identity/geodata acceptance.

## External Gates

### Production rehearsal

`BLOCKED - production snapshot required`. No authorized sanitized production-derived snapshot, production schema export, or migration-history export is available. No production database was contacted. The disposable synthetic rehearsal is evidence for migration mechanics only and does not replace the required production-derived run.

### Hosted CI

`PENDING` until the reviewed branch commit is pushed. Required job: `CI / validate` covering install, repository integrity, Prisma generation/validation, lint, build, isolated PostgreSQL migration/reconciliation tests, API tests, and the critical dependency gate.

## Parallel Ownership Gate

| Owner | Readiness | Boundary |
|---|---|---|
| Platform Lead | Ready | Owns/reviews schema, migrations, shared contracts, auth/JWT, territory authorization, organization tree, identity migration, and cross-team integration |
| Developer 2 - Pre-Election | Ready after green hosted CI | May build on locked roles/territories; lower-level real assignments remain gated by approved identity data |
| Developer 3 - Election Day | Partial after green hosted CI | May build non-geodata foundations; GPS, geofence, and location alerts remain blocked on approved PU identity/geodata |
| Developer 4 - Evidence | Ready after green hosted CI | May build private evidence boundaries; shared schema/migrations require Platform Lead review |

No developer may independently change shared enums, Prisma schema, migrations, target authorization, or canonical territory rules without Platform Lead review.

## Local Gate Evidence

| Gate | Result |
|---|---|
| Repository integrity | PASS; 140 master features, 13 required documents, 17 legacy checksums, 2 Ogun checksums |
| Prisma | PASS; generate and validate with isolated PostgreSQL configuration |
| Lint | PASS across API, web, database, and shared workspaces |
| Build | PASS; 34 Next routes plus API, database, and shared compilation |
| Dependency critical gate | PASS; 0 critical, with 4 high and 1 low accepted/tracked under `SECURITY_BASELINE.md` |
| Clean PostgreSQL deploy | PASS; baseline and Phase 1 migrations applied |
| Untracked-baseline reconciliation | PASS; baseline-only comparison, baseline resolution, Phase 1 deploy, no drift |
| API/integration tests | PASS; 22 of 22 |
| Strict Ogun identity gate | BLOCKED as designed; 0 State Constituencies, 0 LGAs, 0 Wards, and 0 Polling Units loaded |
| Polling Unit geodata | BLOCKED independently; does not block Pre-Election identity work |
| Disposable cleanup | PASS; integration shadow database, container, network, and volume destroyed |

Hosted CI evidence is recorded only after GitHub reports the exact pushed commit green.
