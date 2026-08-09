# Ogun Implementation Roadmap

- **Roadmap baseline:** 2026-08-09
- **Functional source:** `docs/MASTER_FEATURES.md`
- **Implementation evidence:** `docs/OGUN_IMPLEMENTATION_AUDIT.md`

## Delivery Principles

- Reuse, refactor, extend, replace only where necessary, then harden.
- Preserve production-compatible data and existing IDs through additive migrations, backfills, dual reads, and explicit cutovers.
- No developer independently renames legacy enums, deletes models/migrations, or rewrites shared territory authorization.
- Docker, realtime, workers, WebRTC, and object storage remain TARGET architecture until code, configuration, tests, and deployment assets are committed.
- A UI is not complete without backend authorization, validation, database constraints, audit behavior, tests, and mobile acceptance.
- Every merged task must identify its locked feature numbers and migration/rollback impact.

## Four-Developer Work Contract

| Owner | Primary domain | Exclusive integration responsibilities |
|---|---|---|
| Developer 1 - Platform Lead | Auth, target RBAC, coordinator levels, territory graph, Candidate decoupling, shared contracts, database migration coordination | Owns `User`/role/assignment/territory migration sequencing, shared authorization API, migration numbering, and cross-domain integration gates. |
| Developer 2 - Pre-Election Lead | Member registration, verification workflow, referrals, rewards, payouts, strength analytics | Owns financial invariants, reward/payout event contracts, verification/referral transitions, and strength formulas. |
| Developer 3 - Election Day Lead | PUC operations, GPS, geofencing, realtime, Situation Room, alerts, messaging, WebRTC | Owns Election Day event namespace, realtime projections, presence, communications, and peak-load simulations. |
| Developer 4 - Evidence/Post-Election Lead | Private storage, media pipeline, evidence hashing/custody, dossiers, exports, legal-support workspace | Owns EvidenceAsset/storage contracts, original/derivative separation, custody/access audit, and evidence-package integrity. |

### Branch and merge rules

- Each branch names one owner and one bounded domain; do not combine opportunistic shared-schema refactors with feature work.
- Every pull request lists affected master feature IDs, API/event contract impact, migration impact, rollback behavior, and verification commands.
- Rebase or merge the current integration branch before requesting final review; resolve contract conflicts with the contract owner, never by duplicating an enum or helper.
- No developer edits a merged or deployed migration. New schema work uses the Ogun migration stream and one coherent, descriptively named migration.
- Any migration touching User identity, roles, assignments, territories, Candidate linkage, audit envelopes, financial ledgers, or evidence ownership requires Platform Lead approval before merge.
- Shared contract changes land before dependent domain implementations. Consumers import the canonical shared definition rather than copying it.
- A domain owner may reject an incompatible event/storage/financial payload; the Platform Lead resolves cross-domain sequencing.
- Target-only services must remain labelled TARGET until their runtime, health checks, failure behavior, tests, and deployment assets are present.
- CI must pass on the exact commit merged. A local pass does not override a failed or skipped protected check.
- Developers do not load invented Ogun electoral data. Missing authoritative data is a blocker and is escalated with provenance requirements.

### Shared-boundary rules

| Boundary | Contract owner | Collaboration rule |
|---|---|---|
| Prisma migrations | Developer 1 | Other developers submit model requirements; Developer 1 sequences migration files and verifies backfill/rollback. |
| Role/territory authorization | Developer 1 | Domain routes call the shared policy service; no route-local hierarchy ranks are added. |
| Verification document storage | Developers 2 and 4 | Developer 2 owns case workflow; Developer 4 owns object/storage/hash/access contract. |
| Reward/payout events | Developer 2 | Other domains emit approved typed events but never create ledger entries directly. |
| Realtime event transport | Developer 3 | Domain owners define payload data; Developer 3 owns naming, delivery, replay, and subscription scope. |
| Evidence links | Developer 4 | Report/incident owners create typed link requests; evidence originals remain controlled by the evidence service. |
| Audit event envelope | Developers 1 and 4 | Developer 1 owns actor/request/territory context; Developer 4 owns evidence custody/access extensions. |

## Dependency Order

```text
Phase 0 repository/database stabilization
-> Phase 1 role + territory + Candidate/Agent/Member compatibility
-> Phase 2 verification + qualified referrals
-> Phase 3 reward ledger + payout architecture
-> Phase 4 strength engine and pre-election dashboards
```

```text
Phase 1 Polling Unit Coordinator identity
-> Phase 5 Election Day sessions/GPS/reports
-> Phase 6 realtime/Situation Room
-> Phase 7 messaging/WebRTC
```

```text
Phase 0 storage/security decisions
-> Phase 8 private media/evidence pipeline
-> Phase 9 timelines/dossiers/legal workspace
-> Phase 10 production hardening and field simulation
```

## Phase 0 - Repository Stabilization and Migration Preparation

**Objective:** make the current platform reproducible, observable, and safe to migrate before changing domain architecture.

| Major task | Features | Owner | Dependencies |
|---|---|---|---|
| Establish a PostgreSQL production baseline, reconcile mixed SQLite/PostgreSQL migrations, and prove fresh-build plus existing-database upgrade paths. | 001, 004, 089, 090 | Developer 1 | Sanitized schema snapshot and production migration history |
| Inventory all legacy roles/territories/Candidate/Agent/Voter rows and generate exception reports for non-Ogun, LGA-admin, orphan, and ambiguous records. | 001-005, 016-020 | Developer 1 | Read-only production access |
| Freeze documentation contracts: target enums, territory identifiers, API versioning, event envelope, audit envelope, and rollback rules. | 005, 018-020, 090 | Developer 1 | Architecture review |
| Inventory and reconcile existing referral rewards/redemptions; label hard-coded legacy awards and define financial cutover controls. | 037, 040-058 | Developer 2 | Read-only ledger export |
| Build Election Day volume assumptions and a replayable fixture for check-ins, location pings, incidents, reports, and media. | 091-120 | Developer 3 | Operational estimates |
| Produce storage/evidence threat model, data classification, object-key policy, hashing boundary, and retention decision request. | 026, 029, 090, 115, 118, 121-140 | Developer 4 | Security/legal stakeholders |
| Add CI for type-check, tests, Prisma validation, migration replay, dependency audit, and documentation checks. | 089-090 | Developer 1 | Reproducible install |

**Exit gate:** a clean PostgreSQL database can be built; an existing snapshot can be upgraded in rehearsal; data exception reports are reviewed; rollback procedures exist; CI is green; no target feature code depends on an undocumented role, territory, event, or storage contract.

## Phase 1 - Ogun Territory and Role Architecture

**Objective:** introduce target identity and authority without breaking legacy users or deleting data.

**Implementation state:** code-complete for architecture review on 2026-08-09. Production identity apply and real lower-level assignments remain gated by the approved data/import and review process documented in `docs/PHASE_1_COMPLETION.md`.

| Major task | Features | Owner | Dependencies |
|---|---|---|---|
| Add Ogun operating scope, target roles, account statuses, CoordinatorLevel, and assignment models beside legacy enums/profiles. | 001-015, 018-020 | Developer 1 | Phase 0 baseline |
| Validate Ogun hierarchy and constituency memberships; remove LGA from new authority decisions while retaining reference filters. | 002-004, 018-021, 025 | Developer 1 | Approved Ogun dataset |
| Implement centralized action-based RBAC and dual-policy observation with authorization matrix tests. | 005-020, 022-023, 087, 090 | Developer 1 | Target role/territory models |
| Backfill Admin to officer/coordinator assignments; route ambiguous national/zone/LGA rows to manual review. | 007, 010-013, 018-022 | Developer 1 | Data exception approval |
| Backfill Agent to `COORDINATOR + POLLING_UNIT` while preserving Agent routes through compatibility adapters. | 014, 079-082, 098-099, 113, 117 | Developers 1 and 3 | Assignment uniqueness policy |
| Create user-independent Candidate and CampaignOfficerAssignment; dual-read legacy `candidateUserId`, then move operations to officers. | 016-017, 066, 084 | Developer 1 | Candidate backfill plan |
| Introduce MemberProfile compatibility for Voter accounts without asserting verification. | 015, 023-025, 086 | Developers 1 and 2 | Member schema contract |

**Exit gate:** target and legacy identities can coexist; target policy decisions match approved fixtures; Candidate public pages still work; Agent/PUC and Voter/Member compatibility tests pass; no new LGA command assignment can be created.

**Exit result:** PASS in disposable PostgreSQL. Target and legacy identities coexist, six Phase 1 integration cases pass, Candidate and field/member compatibility are preserved, and target authorization contains no LGA command input. Production execution is not implied.

## Phase 2 - Member Verification and Referrals

**Objective:** establish secure, reviewable voter verification and make verification the only referral qualification trigger.

| Major task | Features | Owner | Dependencies |
|---|---|---|---|
| Refactor registration to Member terminology, optional voter evidence, Ogun controlled territory, and versioned consent. | 015, 023-027, 033, 086 | Developer 2 | Phase 1 Member/RBAC |
| Implement private verification document upload/access contract and trusted server hash. | 026, 029, 032 | Developers 2 and 4 | Phase 0 storage contract |
| Add verification states, validator queue/claiming, decisions, resubmission, review history, and validator negative permissions. | 008, 027-031 | Developer 2 | Validator role and private documents |
| Add duplicate identity/evidence screening, flags, manual review outcomes, and privacy-safe officer projections. | 032-033 | Developer 2 | Hash/document metadata |
| Add Referral entity, code/link ownership, attribution, statuses, transition history, and one-referrer constraint. | 034-036 | Developer 2 | Coordinator assignments, Member registration |
| Qualify referrals transactionally only on verification approval; emit one idempotent reward event without creating points yet. | 037, 047-048 | Developer 2 | Verification and Referral state machines |
| Add direct/network referral statistics and hierarchy roll-up read models. | 038-039, 059-065 | Developer 2 | Qualified referrals, target territory graph |

**Exit gate:** unverified signup cannot create confirmed points; Validators cannot alter rewards/payouts/territories; document access is private and audited; duplicate referral qualification is database-prevented; legacy signup rewards have a documented reconciliation status.

## Phase 3 - Reward Engine and Payout Architecture

**Objective:** replace route-local points and generic redemption with versioned, idempotent, auditable financial workflows.

| Major task | Features | Owner | Dependencies |
|---|---|---|---|
| Add RewardRule, RewardRuleVersion, RewardEvent, RewardLedgerEntry, and BonusRule with event idempotency. | 040-048 | Developer 2 | Phase 2 qualifying events |
| Backfill legacy ledger into a labeled legacy rule version; add reversals instead of edits and prevent User cascade deletion of financial history. | 042, 044-045, 047, 058 | Developers 1 and 2 | Phase 0 reconciliation |
| Add Super Admin reward configuration, effective dates, limits, categories, and negative permission tests. | 006, 040-044, 048 | Developer 2 | Target RBAC |
| Add pending potential points projection separately from confirmed ledger balance. | 036-037, 046 | Developer 2 | Referral lifecycle |
| Add PayoutConfiguration, cycles, eligibility snapshots, batches, officer assignments, transactions, proof/reference, and status events. | 009, 049-057 | Developer 2 | Confirmed ledger |
| Replace concurrent redemption risk with database locks/constraints, idempotent payout references, exact decimal money, and reconciliation. | 047, 051-058 | Developers 1 and 2 | PostgreSQL transaction design |
| Build Member and Payout Officer projections/dashboards with assignment-only access. | 052-057, 086-088 | Developer 2 | Payout APIs |

**Exit gate:** no route creates ledger entries directly; replaying an event creates no duplicate reward; payout value is system-derived; Payout Officers cannot configure policy; concurrent payout tests and ledger reconciliation pass.

## Phase 4 - Pre-Election Dashboards and Strength Engine

**Objective:** turn verified organizational data into historical, target-driven campaign strength intelligence.

| Major task | Features | Owner | Dependencies |
|---|---|---|---|
| Define strength metrics, configurable/versioned weights, calculation rules, and snapshot schemas. | 067-073, 076 | Developer 2 | Phases 1-3 source metrics |
| Generalize targets by metric, territory, Candidate, period, and creator; calculate target/actual/shortfall. | 074-075 | Developer 2 | Target RBAC and metrics |
| Schedule metric and strength snapshot jobs through BullMQ/Redis once worker infrastructure is implemented. | 067-076 | Developers 2 and 3 | Worker/Redis service contract |
| Refactor Polling Unit through state dashboards to target hierarchy and authorized drill-down. | 059-066 | Developers 1 and 2 | Target policy and snapshots |
| Add heatmaps, trends, coverage intelligence, approved performance comparisons, search, and controlled exports. | 076-078, 082, 087-088 | Developer 2 | Snapshot read models; export worker |
| Rebind tasks, bulk tasks, activities, notifications, broadcasts, and Member dashboard to target roles. | 079-086 | Developers 1 and 2 | Phase 1 compatibility cutover |

**Exit gate:** every score is reproducible from versioned weights and source snapshots; historical values do not change when configuration changes; all dashboards are territory-tested; no leaderboard uses political preference.

## Phase 5 - Election Day Coordinator Operations and GPS

**Objective:** complete durable Polling Unit operations before adding realtime transport.

| Major task | Features | Owner | Dependencies |
|---|---|---|---|
| Add election operation/configuration and Polling Unit operational status state machine. | 095, 098, 117, 119 | Developer 3 | Phase 1 PUC identity |
| Migrate check-in/out to PUC sessions with assignment, time, GPS, consent, idempotency, and offline-safe retries. | 098-099 | Developer 3 | Election configuration |
| Add LocationSession/LocationPing storage, device controls, retention tiers, batching, and latest-location projection. | 099, 106 | Developer 3 | Session policy |
| Load approved Polling Unit coordinates/radii and implement accuracy-aware geofence/mismatch evaluation. | 096, 100, 102 | Developer 3 | Approved geodata; Feature 100 blocker resolved |
| Add durable tracking/report alerts, stale detection, acknowledgement, and target escalation chain. | 097, 101-105 | Developer 3 | Location sessions, worker scheduler |
| Extend incidents with event history, target assignment/escalation, tasks, and evidence-link placeholders. | 113-116 | Developers 3 and 4 | Target roles; Evidence link contract |
| Extend ElectionDayReport with report types, drafts, correction/review events, results, completion, and flexible evidence links. | 117-120 | Developers 3 and 4 | Evidence link contract |

**Exit gate:** REST-only Election Day workflows remain fully functional; duplicate/offline submissions are safe; location retention is bounded; GPS discrepancies are review alerts, not automatic misconduct; report corrections preserve history.

## Phase 6 - Realtime Infrastructure and Situation Room

**Objective:** add horizontally scalable live delivery without making realtime the durable source of truth.

| Major task | Features | Owner | Dependencies |
|---|---|---|---|
| Implement Redis, Socket.IO gateway, Redis adapter, authenticated territory rooms, event outbox, replay/reconciliation, and REST fallback. | 091-097, 106 | Developer 3 | Phase 5 durable events |
| Build Situation Room read models for expected/checked-in/missing/opening/incidents/alerts/reports/results/evidence/completion. | 091-095, 097, 119 | Developer 3 | Election status and event contracts |
| Add hierarchy-scoped live statistics, drill-down, and map payload minimization. | 092-096 | Developers 1 and 3 | Target authorization, geodata |
| Add presence and outstanding-report/contact action projections. | 104-106, 119 | Developer 3 | Realtime connections, report expectations |
| Feed Member/strength context and evidence counts into read models without coupling services. | 060-077, 115, 118-119 | Developers 2 and 4 | Stable projection contracts |

**Exit gate:** multi-instance fan-out works; unauthorized room joins fail; reconnect/replay produces consistent state; Redis loss degrades to REST; load tests meet agreed check-in/location/report burst targets.

## Phase 7 - Messaging and WebRTC Voice

**Objective:** add scoped operational communications linked to Election Day workflows.

| Major task | Features | Owner | Dependencies |
|---|---|---|---|
| Add Conversation, membership, messages, receipts, territory channels, attachments, retention, and moderation controls. | 107-109, 112 | Developer 3 | Phase 6 realtime/RBAC |
| Integrate message actions from alerts, maps, missing reports, incidents, and Situation Room while preserving formal records. | 104-105, 112-116, 120 | Developer 3 | Messaging and operation links |
| Add WebRTC signalling, call permissions, STUN/TURN, call states, participant metadata, missed calls, and text fallback. | 106, 110-111 | Developer 3 | Realtime gateway, TURN service |
| Audit communication metadata and enforce privacy/no automatic recording. | 090, 109-112, 120, 132-133 | Developers 1 and 3 | Audit envelope, retention policy |

**Exit gate:** role/territory relationship tests cover who may message/call whom; TURN fallback is field-tested; voice content is not recorded; communications failure never blocks incident/report submission.

## Phase 8 - Evidence System and Media Pipeline

**Objective:** replace database/external-URL media with a protected, auditable evidence subsystem.

| Major task | Features | Owner | Dependencies |
|---|---|---|---|
| Implement private S3-compatible storage, unique keys, overwrite denial, versioning, signed access, direct upload finalization, and storage health checks. | 029, 115, 118, 122-127, 137 | Developer 4 | Phase 0 storage policy |
| Add EvidenceAsset, typed links, server SHA-256, timestamps, location, classification, review, and access policy. | 121-131, 137-138 | Developer 4 | Target RBAC, storage |
| Add BullMQ workers for hashing verification, malware checks where available, thumbnails, previews, image compression, video metadata, and transcodes. | 125-127 | Developer 4 | Redis/worker runtime |
| Backfill ElectionDayReportAsset/MediaAttachment with copy-hash-verify checkpoints; retain legacy blobs/URLs until reconciliation succeeds. | 115, 117-118, 121-129 | Developers 3 and 4 | EvidenceAsset and migration tooling |
| Add append-only custody, review, and access events for upload/view/download/classification/export/case actions. | 124, 131, 137-138 | Developers 1 and 4 | Audit/request context |
| Extend report, incident, result, and Polling Unit event flows to create typed evidence links. | 115, 118, 123, 129-132 | Developers 3 and 4 | Stable Evidence link API |

**Exit gate:** accepted originals cannot be overwritten; server hashes re-verify; derivatives are separate objects; every sensitive access is authorized and audited; backfill reconciliation proves source and destination identity.

## Phase 9 - Post-Election Evidence and Legal-Support Workspace

**Objective:** provide controlled reconstruction, discovery, dossiers, packages, and case organization.

| Major task | Features | Owner | Dependencies |
|---|---|---|---|
| Build normalized Polling Unit operational/evidence timeline from reports, location, incidents, communications metadata, results, reviews, and custody. | 120-124, 128-132 | Developer 4 | Phases 5-8 event data |
| Build Polling Unit dossiers and Ward/constituency/Ogun evidence aggregation with completeness indicators. | 121, 132-134 | Developer 4 | Timeline and target hierarchy |
| Add evidence search/discovery with role, territory, case, type, classification, status, time, reporter, and Polling Unit filters. | 130-135, 137 | Developer 4 | Evidence metadata/index |
| Add asynchronous evidence packages, manifests, hashes, signed delivery, download audit, and package verification. | 124-128, 136-139 | Developer 4 | Worker, storage, approved retention |
| Add LegalCase, permissions, evidence links, notes, timelines, holds, and explicit no-legal-conclusion UX. | 136-140 | Developer 4 | Features 132-139; retention blocker resolved |

**Exit gate:** an authorized reviewer can reconstruct a Polling Unit timeline, verify original hashes, produce and validate an audited manifest package, and apply a legal hold without altering evidence.

## Phase 10 - Production Hardening, Security, Load Testing, and Field Simulation

**Objective:** prove the entire system can operate securely and recover under Election Day conditions.

| Major task | Features | Owner | Dependencies |
|---|---|---|---|
| Harden auth/session/token storage, password policy, rate limits, security headers, input/file validation, secrets, and account status enforcement. | 005-020, 029, 090, 109, 137 | Developer 1 | All route contracts stable |
| Add financial reconciliation, invariant monitors, concurrent reward/payout tests, and operator runbooks. | 037, 040-058, 090 | Developer 2 | Phase 3 complete |
| Run multi-instance Election Day simulation for check-ins, location bursts, alerts, reports, incidents, map fan-out, messages, and signalling failures. | 091-120 | Developer 3 | Phases 5-7 complete |
| Test evidence upload concurrency, hash verification, worker retries, exports, retention/holds, backup/restore, and object-store failure. | 121-140 | Developer 4 | Phases 8-9 complete |
| Add structured logs, metrics, traces, queue depth, database/Redis/object-store health, security alerts, backups, recovery, and operations dashboards. | 089-090, 091-140 | Developers 1 and 3 | Deployment topology |
| Add incremental Docker assets for postgres, redis, api, realtime, worker, and minio without replacing the current Node/Vercel workflow until parity is proven. | 089-090, 092, 106, 110, 125-127 | Developers 1, 3, and 4 | Services implemented first |
| Conduct mobile/device/network field simulation, accessibility testing, incident drills, and signed readiness review. | 089, 091-120 | All developers | All functional gates complete |

**Exit gate:** security review has no unresolved critical/high findings; migration and rollback are rehearsed; load/error budgets pass; backup restoration and evidence integrity are demonstrated; field simulation is accepted; production runbooks and named on-call ownership exist.

## First Implementation Release

The first implementation release is **Phase 0 only**. Its deliverables are migration safety, data inventory, CI, contracts, test fixtures, security/evidence decisions, and financial reconciliation. Feature work begins only after the Phase 0 exit gate is signed off.

After Phase 0, Developers 2-4 may prepare domain fixtures and adapters in parallel, but Developer 1 must land and validate Phase 1 role/territory contracts before any domain enables target writes in production.
