# Ogun Implementation Audit — SUPERSEDED (Phase 1 historical record)

> **This document is historical. It is not the current implementation status.**
>
> **Current audit:** [`docs/SPRINT_4_FINAL_AUDIT.md`](SPRINT_4_FINAL_AUDIT.md) —
> baseline `main @ c41d23ad87189331680723d4a30ef10a22d30717`,
> **13 COMPLETE / 123 PARTIAL / 4 BLOCKED**.
>
> What follows describes the repository as it stood at Phase 1 (`f2be582`),
> before Sprints 2, 3 and 4 merged. Its taxonomy
> (`COMPLETE`/`PARTIAL`/`REFACTOR`/`NEW`/`BLOCKED`) and its counts
> (15/43/26/53/3) are Phase-1 measurements against a Phase-1 tree.
>
> It is retained deliberately: it records the provenance research on Ogun
> reference data and the Phase 1 architecture decisions, which remain the
> evidence base for the external data blockers that are still open. Do not cite
> its feature statuses as current, and do not delete it.

- **Audit date:** 2026-08-09 *(historical)*
- **Repository baseline:** `f2be582` on `main` *(historical)*
- **Superseded by:** `docs/SPRINT_4_FINAL_AUDIT.md`
- **Functional source:** `docs/MASTER_FEATURES.md`
- **Technical source:** `docs/TECHNICAL.md`

## A. Executive Summary

The repository now contains the Phase 1 Ogun role, identity, command-hierarchy, Candidate-domain, and compatibility foundation. The wider product is not complete: lower-level authoritative Ogun data, verification, financial workflows, realtime, workers, evidence, and production rehearsal remain gated work.

`COMPLETE` below means the locked Phase 1 behavior is implemented and tested in the target path. It does not convert explicitly retained legacy routes into target architecture or waive later data/import and production gates.

| Classification | Count | Meaning |
|---|---:|---|
| COMPLETE | 15 | Locked behavior is implemented and verified in the target path. |
| PARTIAL | 43 | Some verified implementation exists, but a later domain or cutover remains. |
| REFACTOR | 26 | Working legacy implementation must still migrate to target boundaries. |
| NEW | 53 | No implementation was verified. |
| BLOCKED | 3 | Implementation requires an authoritative external decision or dataset. |
| **Total** | **140** | All locked features are represented below. |

The highest-risk areas are the mixed SQLite/PostgreSQL migration history, legacy role and territory semantics, reward issuance before verification, concurrent payout integrity, exposure of voter-card numbers outside a validator boundary, browser-local JWT storage, incomplete audit coverage, database-backed media blobs, and the absence of realtime, queue, object-storage, evidence-integrity, and recovery infrastructure.

The Phase 1 shared code foundation is ready for architecture review. Parallel domain work is safe only under the shared-file approval boundaries recorded in `docs/PHASE_1_COMPLETION.md`; production identity migration and real lower-level assignments remain blocked.

## B. Current Architecture

### Implemented runtime

- npm workspaces contain `apps/web`, `apps/api`, `packages/database`, and `packages/shared`.
- `apps/web` is Next.js 15/React 19 with role-specific routes for admin, candidate, agent, and voter/member-facing flows.
- `apps/api` is Express with 138 HTTP endpoints, including the target `/platform` Candidate, coordinator, account-status, and organization-tree routes.
- PostgreSQL is declared through Prisma. The schema contains 42 models, including target `CoordinatorProfile` and user-independent `Candidate` records.
- Render and Vercel deployment descriptors exist. There are no checked-in Docker, Redis, worker, realtime, TURN, or object-storage services.
- Operational live views use HTTP refreshes. The admin live-operations page refreshes map and activity data every 30 seconds; agent location is posted over HTTP from browser geolocation approximately every 30 seconds.

### Current domain behavior

- Authentication uses email/password, bcrypt cost 10, bearer JWTs, `isActive`, and a single active session nonce for Agents.
- Target roles are `SUPER_ADMIN`, `STATE_OFFICER`, `COORDINATOR`, `VALIDATOR`, `PAYOUT_OFFICER`, and `MEMBER`; legacy role literals remain for staged migration.
- `apps/api/src/authorization.ts` enforces Ogun-only constituency-first target authority without LGA. `apps/api/src/scope.ts` remains legacy/transitional.
- User-independent Candidate records and additive content links are implemented; Candidate-authenticated routes remain legacy/transitional until content stewardship cutover.
- Agent check-in/out, GPS pings, tasks, incidents, session revocation, and Election Day reporting remain available to migrated Polling Unit Coordinators through profile-gated compatibility middleware.
- Voter registration captures controlled territory, a mandatory unique voter-card number, referral attribution, consent flags, rewards, redemptions, polls, campaign events, feedback, and engagement tasks.
- Referral rewards are hard-coded and created at registration, before any verification workflow. No verification models or validator queue exist.
- Reward balances are ledger-derived, but rules are not versioned and several values are hard-coded. Redemption is an admin-reviewed request, not a payout-cycle/batch/assignment system.
- Coverage analytics aggregate assigned Agents, recent activity, incidents, targets, Wards, and Polling Units. There are no configurable strength metrics or historical snapshots.
- Election Day reports capture opening status, arrival, turnout text, remarks, party vote entries, two photos, review status, and territory. Assets are stored as database `Bytes` and are not hashed evidence.

### Tests and delivery state

- Three API integration suites contain 22 passing cases. Phase 1 cases cover target RBAC, territory isolation, LGA non-command behavior, organization-tree errors/scoping, self-reassignment, IDOR, account status, Candidate domain access, and migration preservation/idempotency.
- A CI workflow is present in the worktree but still requires commit/push and a hosted run on the reviewed commit.

## C. Target Architecture

The target is an Ogun-only, constituency-first platform with `SUPER_ADMIN`, `STATE_OFFICER`, `COORDINATOR`, `VALIDATOR`, `PAYOUT_OFFICER`, and `MEMBER`. Coordinator level and assigned territory are independent authorization attributes. Candidate becomes a domain entity, LGA remains reference data only, and Agent functionality migrates to `COORDINATOR + POLLING_UNIT`.

The target adds voter-document verification, qualified referrals, versioned reward rules, immutable event-linked ledger entries, delegated payout cycles, strength snapshots, realtime Election Day operations, presence and messaging, WebRTC voice, private S3-compatible storage, workers, evidence hashing and custody, dossiers, exports, and legal-support workspaces.

Docker, Redis, Socket.IO/WebSocket, BullMQ workers, MinIO/S3, and WebRTC are **TARGET architecture**. They do not exist in the current repository and must not be represented as current capability.

## D. Feature Gap Matrix

Status is based on verified code, not documentation claims. `Recommended Phase` maps to `docs/IMPLEMENTATION_ROADMAP.md`.

| Feature | Category | Current Status | Existing Implementation | Required Change | Dependencies | Recommended Phase |
|---|---|---|---|---|---|---|
| 001. Ogun-State-Only Platform | Pre-Election | COMPLETE | Target platform APIs reject every operational territory outside canonical `ng-state-ogun`; national legacy routes remain transitional only. | Retire legacy national operational paths after dependent UI migration. | Legacy route cutover | 1 |
| 002. Constituency-First Command Structure | Pre-Election | COMPLETE | Target command ancestry is State -> Senatorial -> Federal -> State Constituency -> Ward -> Polling Unit. | Load approved lower-level command mappings before production assignment. | Authoritative Ogun dataset | 1 |
| 003. LGA as Reference, Not Command Level | Pre-Election | COMPLETE | Target profiles and authorization omit `lgaId`; an LGA-admin migration is explicitly blocked and a same-LGA isolation test passes. | Retire legacy LGA admin routes after cutover. | Legacy route cutover | 1 |
| 004. Ogun Electoral Reference Database | Pre-Election | BLOCKED | State, 3 Senatorial Districts, and 9 Federal Constituencies verify; schema now accepts direct command parents. | Approve and load 26 State Constituencies, 20 LGAs, Wards, Polling Units, and command mappings with provenance. | Authoritative Ogun dataset | 0-1 |
| 005. Locked User-Role Architecture | Pre-Election | COMPLETE | All six target roles, account status, and CoordinatorLevel are canonical shared and persisted enums; legacy values are compatibility-only. | Remove legacy enum values only after verified cutover. | Production migration review | 1 |
| 006. Super Admin Authority | Pre-Election | PARTIAL | Super Admin can create/reassign target coordinators, manage account status, candidates, and the Ogun tree with audit records. | Later phases add validator, payout, security, and policy controls. | Phase 2-3 domains | 1-3 |
| 007. General State Officer | Pre-Election | COMPLETE | `STATE_OFFICER` has Ogun-wide target command authority and a safe legacy State-admin mapping. | Apply reviewed production identity plan. | Production migration review | 1 |
| 008. State Validator Role | Pre-Election | PARTIAL | Role exists and negative tests prevent coordinator authority. | Verification capability, queue, and evidence scope are Phase 2. | Verification models, private storage | 2 |
| 009. Payout Officer Role | Pre-Election | PARTIAL | Role exists and negative tests prevent coordinator authority. | Assignment-only payout capability is Phase 3. | Payout architecture | 3 |
| 010. Senatorial District Coordinator | Pre-Election | COMPLETE | Canonical level, validated assignment, descendant inheritance, scoped tree, and migration mapping are implemented. | Apply only to approved canonical records. | Production migration review | 1 |
| 011. Federal Constituency Coordinator | Pre-Election | COMPLETE | Canonical level, parent validation, descendant inheritance, and migration mapping are implemented. | Apply only to approved canonical records. | Production migration review | 1 |
| 012. State Constituency Coordinator | Pre-Election | COMPLETE | Canonical level and Federal-parent command validation are implemented. | Real assignments remain blocked until approved State Constituencies load. | Authoritative Ogun dataset | 1 |
| 013. Ward Coordinator | Pre-Election | COMPLETE | Canonical level, State-Constituency parent validation, subordinate PU inheritance, and peer isolation are implemented. | Real assignments remain blocked until approved Wards load. | Authoritative Ogun dataset | 1 |
| 014. Polling Unit Coordinator | Pre-Election | COMPLETE | `COORDINATOR + POLLING_UNIT` mapping preserves AgentProfile, nonce/GPS controls, tasks, activities, incidents, and field routes. | Real migration remains blocked for users without approved PU ancestry. | Authoritative Ogun dataset | 1, 5 |
| 015. Member / Supporter Account | Pre-Election | PARTIAL | `MEMBER` role and VoterProfile compatibility migration are implemented without deleting referral or profile data. | Phase 2 adopts Member registration and optional verification evidence. | Member schema | 2 |
| 016. Candidate as Campaign Record | Pre-Election | COMPLETE | User-independent Candidate stores public/campaign fields; migration links posts, events, polls, feedback, and assignments additively. | Officer stewardship can extend the target domain later. | Campaign workflow | 1 |
| 017. No Separate Candidate Account | Pre-Election | PARTIAL | Target Candidate reads and writes require no Candidate authentication; legacy Candidate login remains explicitly transitional for safe content cutover. | Retire login only after all self-service dependencies move to officers. | Candidate route cutover | 1 |
| 018. Role + Territory Access Control | Pre-Election | COMPLETE | Central target policy combines role, coordinator level, account status, assigned territory, resource territory, and action. | Domain phases must call this policy rather than legacy scope helpers. | Platform Lead review | 1 |
| 019. Territory Isolation | Pre-Election | COMPLETE | Deny-by-default backend helpers and PostgreSQL tests cover own, descendant, peer, unrelated, superior, inactive, suspended, and specialist cases. | Extend the same policy to each later domain route. | Domain adoption | 1 |
| 020. Controlled Territory Assignment | Pre-Election | COMPLETE | Only Super Admin, State Officer, or an authorized superior may assign/reassign; self-change and peer IDOR are denied and changes are audited. | Effective-date history can be added when multi-assignment is approved. | Assignment history decision | 1 |
| 021. Organization Tree | Pre-Election | PARTIAL | Target API/UI returns server-built scoped hierarchy with coordinator occupancy and blocks incomplete reference ancestry. | Production tree awaits approved lower-level Ogun data. | Authoritative Ogun dataset | 1, 4 |
| 022. Coordinator Management | Pre-Election | COMPLETE | Target coordinator creation, validated assignment, superior-only reassignment, account status, scoped navigation, and audit logging are implemented. | Bulk/import UX remains later work. | Production migration review | 1 |
| 023. Member Management | Pre-Election | PARTIAL | Target hierarchy can manage Member account status in scope and migrated Members retain current self-service routes. | Privacy-safe lists and validator-only document detail are Phase 2. | Member and verification permissions | 2 |
| 024. Member Registration | Pre-Election | REFACTOR | Public Voter registration captures identity, contact, territory, referral, and consent. | Permit registration without voter evidence/card number and adopt Member terminology. | Member schema, Ogun references | 2 |
| 025. Structured Territory Capture | Pre-Election | PARTIAL | Target coordinator/candidate writes accept canonical Ogun IDs and validate constituency-first ancestry; LGA is excluded from command payloads. | Public Member registration still uses legacy LGA/Ward flow pending Phase 2 and authoritative data. | Ogun reference baseline | 1-2 |
| 026. Voter-Card Upload | Pre-Election | NEW | Only a card-number string is collected. | Add private evidence upload and submission workflow. | Object storage, verification models | 2 |
| 027. Verification Status Model | Pre-Election | NEW | No verification status exists. | Add locked states and transition constraints. | Member schema | 2 |
| 028. Validator Work Queue | Pre-Election | NEW | No validator routes or UI. | Add claimable scoped queues and concurrency controls. | Validator role, verification records | 2 |
| 029. Secure Voter-Document Storage | Pre-Election | NEW | No voter document storage; generic URL metadata is public-provider dependent. | Add private object storage and short-lived authorized access. | Storage service, signed URLs | 2, 8 |
| 030. Validation Decision Workflow | Pre-Election | NEW | No approval/rejection/resubmission workflow. | Add transactional decisions, notes, and downstream events. | Validator queue | 2 |
| 031. Verification History | Pre-Election | NEW | Generic audits do not model verification history. | Add append-only review history and status transitions. | Verification workflow | 2 |
| 032. Duplicate / Fraud Screening | Pre-Election | PARTIAL | Unique card number and referral constraints plus generic incident heuristics exist. | Add evidence hash reuse checks, duplicate identities, risk flags, and review outcomes. | Verification documents, hashing | 2 |
| 033. Consent and Privacy Records | Pre-Election | PARTIAL | Terms, contact consent, and Agent GPS consent are stored. | Add versioned privacy, document-processing, and location consent records. | Policy versions | 2, 5 |
| 034. Unique Referral Code and Link | Pre-Election | REFACTOR | Unique codes are generated for every Voter with a PICS prefix. | Issue Ogun codes/links to eligible coordinators and preserve legacy codes. | Coordinator migration | 2 |
| 035. Referral Attribution | Pre-Election | REFACTOR | `referredByUserId` is stored on VoterProfile. | Add immutable Referral entity linked to coordinator and registration context. | Member/referral models | 2 |
| 036. Referral Status Model | Pre-Election | NEW | No referral lifecycle record. | Add locked statuses and transition history. | Referral entity, verification events | 2 |
| 037. Verification-Gated Referral Qualification | Pre-Election | REFACTOR | Referral points are granted immediately at signup. | Stop new pre-verification rewards, qualify transactionally on approval, and reconcile legacy entries. | Verification, reward events | 2-3 |
| 038. Hierarchical Referral Roll-Up | Pre-Election | PARTIAL | Member and coordinator territories are stored. | Add direct/network attribution queries and stable hierarchy snapshots. | Referral entity, territory graph | 2, 4 |
| 039. Direct vs Network Referral Statistics | Pre-Election | NEW | No network referral statistics. | Add separate direct and roll-up metrics. | Qualified referrals | 2, 4 |
| 040. Configurable Reward Engine | Pre-Election | REFACTOR | Ledger and configurable engagement-task point values exist; registration/referral/poll values are hard-coded. | Replace route-local awards with event-driven rules. | Reward rule models | 3 |
| 041. Super-Admin Reward Configuration | Pre-Election | NEW | No reward configuration UI or model. | Add guarded configuration and effective dates. | Target RBAC, RewardRule | 3 |
| 042. Reward Rule Versioning | Pre-Election | NEW | Ledger entries do not reference a rule version. | Add immutable versions and backfill a legacy version. | RewardRuleVersion | 3 |
| 043. System-Controlled Bonus Points | Pre-Election | NEW | `BONUS` enum exists without a rules workflow. | Add BonusRule and qualifying event processing. | Reward engine | 3 |
| 044. Approved Points Categories | Pre-Election | PARTIAL | Participation, referral, bonus, and manual-adjustment types exist. | Adopt locked categories and map legacy values without rewriting history. | Ledger migration | 3 |
| 045. Immutable Points Ledger | Pre-Election | PARTIAL | Balance is ledger-derived and no update route exists. Entries lack rule/source identity and cascade-delete with User. | Add immutable constraints, source event, rule version, reversals, and financial retention. | RewardEvent, migration policy | 3 |
| 046. Pending Potential Points | Pre-Election | NEW | No pending/confirmed separation. | Add non-ledger projection for unqualified referrals. | Referral lifecycle | 2-3 |
| 047. Idempotent Reward Processing | Pre-Election | PARTIAL | Some `findFirst` checks and a narrow unique key exist. | Add event idempotency keys and database uniqueness per rule recipient. | RewardEvent | 3 |
| 048. Reward Integrity Boundary | Pre-Election | PARTIAL | Rewards are not based on selected poll option, but route-local awards lack a policy boundary. | Allowlist lawful qualifying events and prohibit ballot-choice/proof events. | Reward event taxonomy | 3 |
| 049. Minimum Payout Threshold | Pre-Election | NEW | Users may request any positive available points. | Add versioned payout configuration and eligibility evaluation. | Reward ledger | 3 |
| 050. Payout Schedule | Pre-Election | NEW | No schedule or cycle exists. | Add configured cycles and dates. | PayoutConfiguration | 3 |
| 051. Point-to-Value Conversion | Pre-Election | NEW | Optional payout amount is supplied by the requester. | Add authoritative versioned conversion and derived amounts. | Payout configuration | 3 |
| 052. Payout Lifecycle | Pre-Election | REFACTOR | Redemption supports pending, approved, rejected, and paid. | Migrate to locked lifecycle with eligibility, processing, and hold states. | Payout models | 3 |
| 053. Payout Batches | Pre-Election | NEW | No cycles or batches. | Generate auditable beneficiary batches from eligibility snapshots. | PayoutCycle | 3 |
| 054. Delegated Payout Assignment | Pre-Election | NEW | Any scoped Admin can review redemptions. | Add immutable officer workload assignments. | Payout Officer role, batches | 3 |
| 055. Payout-Officer Restrictions | Pre-Election | NEW | No Payout Officer role. | Enforce execution-only policy and negative authorization tests. | Target RBAC | 3 |
| 056. Payout-Officer Dashboard | Pre-Election | NEW | Admin redemption queue is the only UI. | Build assignment-scoped officer workload dashboard. | Assignment API | 3 |
| 057. Payout Accountability | Pre-Election | PARTIAL | Redemption stores beneficiary, points, amount, reviewer, timestamps, status, and note. | Add batch, officer, conversion version, payment reference, proof, and append-only events. | PayoutTransaction | 3 |
| 058. Financial Integrity Controls | Pre-Election | REFACTOR | Transactions and balance derivation exist, but approval has an ineffective concurrent balance check and no duplicate payout reference. | Add locking/serializable processing, idempotency, constraints, reversals, and reconciliation. | Ledger and payout redesign | 3, 10 |
| 059. Hierarchical Dashboard Model | Pre-Election | REFACTOR | Generic Admin summaries are territory-scoped under legacy levels. | Rebind dashboards to target role/level/assignment authorization. | Phase 1 authorization | 4 |
| 060. Polling Unit Dashboard | Pre-Election | PARTIAL | Agent dashboard and Polling Unit coverage rows show activity, tasks, incidents, and staffing. | Add Member, verification, referrals, rewards, payout, readiness, and targets. | Phases 2-4 data | 4 |
| 061. Ward Dashboard | Pre-Election | REFACTOR | Coverage insights aggregate Polling Units by Ward. | Build target Ward KPIs and drill-down under Ward Coordinator scope. | Target hierarchy, strength metrics | 4 |
| 062. State Constituency Dashboard | Pre-Election | REFACTOR | Generic Admin scope supports state-constituency fields. | Build explicit State Constituency aggregation and remove LGA command assumptions. | Target hierarchy | 4 |
| 063. Federal Constituency Dashboard | Pre-Election | REFACTOR | Generic Admin scope supports federal-constituency fields. | Build explicit subordinate State Constituency aggregation. | Target hierarchy | 4 |
| 064. Senatorial District Dashboard | Pre-Election | REFACTOR | Generic Admin scope supports senatorial districts. | Build district comparison and strength intelligence. | Target hierarchy | 4 |
| 065. Ogun State Dashboard | Pre-Election | REFACTOR | State Admin/Super Admin summaries and national analytics exist. | Restrict to Ogun and add target KPIs, strength, readiness, and drill-down. | Ogun scope, Phases 2-4 data | 4 |
| 066. Candidate Campaign Progress Profile | Pre-Election | REFACTOR | Candidate login dashboard, maps, Agents, Voters, incidents, posts, and events exist. | Retain campaign views but expose through authorized officers against a domain Candidate. | Candidate migration, dashboards | 1, 4 |
| 067. Configurable Strength Score Engine | Pre-Election | NEW | No weighted strength engine. | Add metric definitions, versioned weights, and deterministic calculation. | Qualified source metrics | 4 |
| 068. Polling Unit Strength | Pre-Election | NEW | Coverage attention is not a strength score. | Calculate and snapshot Polling Unit strength. | Strength engine | 4 |
| 069. Ward Strength | Pre-Election | NEW | No historical strength aggregate. | Aggregate Polling Unit snapshots with explicit roll-up rules. | Feature 068 | 4 |
| 070. State Constituency Strength | Pre-Election | NEW | No implementation. | Aggregate subordinate Ward/Polling Unit strength. | Feature 069 | 4 |
| 071. Federal Constituency Strength | Pre-Election | NEW | No implementation. | Aggregate and compare State Constituencies. | Feature 070 | 4 |
| 072. Senatorial District Strength | Pre-Election | NEW | No implementation. | Aggregate Federal Constituencies. | Feature 071 | 4 |
| 073. Overall Ogun State Strength | Pre-Election | NEW | No implementation. | Produce statewide snapshot and comparisons. | Features 068-072 | 4 |
| 074. Campaign Target Setting | Pre-Election | PARTIAL | State-level Agents-per-Polling-Unit target exists. | Generalize to metric/territory/date targets with authorization and history. | TerritoryTarget | 4 |
| 075. Target vs Actual Tracking | Pre-Election | PARTIAL | Coverage views calculate target, assigned, and remaining Agents. | Generalize across locked metrics and persist snapshots. | Feature 074, metrics | 4 |
| 076. Progress Trend Analytics | Pre-Election | NEW | Analytics calculate current/request-time values only. | Schedule historical metric and strength snapshots. | Worker, strength engine | 4 |
| 077. Strength Heatmaps and Drill-Down | Pre-Election | PARTIAL | Operational map and coverage attention lists exist without strength scores or Polling Unit coordinates. | Add scored categories, constituency drill-down, and authorized map payloads. | Strength snapshots, geodata | 4 |
| 078. Coordinator Performance and Leaderboards | Pre-Election | PARTIAL | Agent activity summaries and coverage counts exist. | Define approved metrics, snapshots, privacy rules, and target-role comparisons. | Coordinator migration, strength metrics | 4 |
| 079. Field Task Management | Pre-Election | REFACTOR | Title, description, priority, due date, status, assignment, notification, and audit are implemented for Agents. | Rebind to target coordinators and assignment policies. | Phase 1 roles | 1, 4 |
| 080. Bulk Task Assignment | Pre-Election | REFACTOR | Admins can bulk assign by Agent IDs and territory filters. | Rebind audiences to coordinator levels and atomic bulk-job behavior. | Phase 1 roles, worker for scale | 4 |
| 081. Pre-Election Field Activity Logging | Pre-Election | REFACTOR | Check-in/out, outreach, material distribution, observation, and GPS activities exist for Agents. | Rename and extend as coordinator field activity with campaign phase and audit metadata. | Agent migration | 1, 4 |
| 082. Coverage Intelligence | Pre-Election | REFACTOR | Staffing, activity, incidents, targets, and incomplete-reference warnings are implemented. | Ogun-scope the queries, replace Agent terminology, and integrate verified Member/strength metrics. | Phases 1-4 | 4 |
| 083. Notifications | Pre-Election | PARTIAL | In-app notifications and read state exist for several current events. | Add target event taxonomy, preferences, channel delivery, retries, and workers. | Event bus, worker | 2-8 |
| 084. Operational Broadcasts | Pre-Election | REFACTOR | Scoped Admin/Candidate broadcasts create in-app notifications. | Move Candidate-originated operations to officers and target role/territory audiences. | Phase 1 roles | 4 |
| 085. Broadcast History | Pre-Election | PARTIAL | Creator, content, audience, territory, time, and recipient count are stored. | Add recipient/delivery records, status, retries, and target audience types. | Notification delivery | 4 |
| 086. Member Dashboard | Pre-Election | REFACTOR | Voter dashboard shows profile, rewards, redemptions, notifications, posts, events, and tasks. | Convert to Member and add verification/resubmission state while removing pre-verification confirmed rewards. | Phases 2-3 | 2-3 |
| 087. Search, Filters and Management Views | Pre-Election | REFACTOR | User, territory, role, incident, report, and audit filters exist. | Add target roles/statuses and constituency-first filters; hide sensitive fields. | Phase 1-3 models | 1-4 |
| 088. Reporting and Export | Pre-Election | PARTIAL | Analytics views and a Super Admin voter CSV export exist. | Add controlled domain reports, spreadsheet/PDF outputs, authorization, job processing, and export audits. | Worker, reporting contracts | 4, 10 |
| 089. Mobile-First Production Architecture | Pre-Election | PARTIAL | Responsive web UI and browser geolocation flows exist. | Complete device matrix, offline/poor-network behavior, accessibility, and field testing. | Stable workflows | 10 |
| 090. Audit and Security Logging | Pre-Election | PARTIAL | `AuditLog` and selected admin/incident/task/report/reward events exist. Login, document/media view, voter CSV export, and many mutations are not audited. | Add categories, nullable system actors, request/session metadata, full event coverage, retention, and tamper controls. | Cross-domain event contracts | 0-10 |
| 091. Election Situation Room | Election Day | PARTIAL | Admin live-operations page combines HTTP-refreshed map, Agents, incidents, and tasks. | Build target statistics, alerts, report gaps, permissions, and realtime delivery. | Phases 5-6 | 6 |
| 092. Real-Time Election Statistics | Election Day | PARTIAL | Current summaries refresh via HTTP every 30 seconds. | Add event-driven aggregates, Redis fan-out, reconciliation, and degraded polling fallback. | Realtime service, event outbox | 6 |
| 093. Hierarchical Real-Time Statistics | Election Day | REFACTOR | Legacy Admin queries are territory-scoped. | Rebind subscriptions and aggregates to target hierarchy and assignments. | Phase 1 authorization, realtime | 6 |
| 094. Live Drill-Down | Election Day | PARTIAL | Territory selectors and scoped live pages exist. | Add state-to-Polling-Unit live drill-down with consistent aggregate/detail snapshots. | Situation Room read models | 6 |
| 095. Polling Unit Operational Status | Election Day | NEW | No Polling Unit election-state model. | Add status state machine and event-derived transitions. | Coordinator sessions, reports/incidents | 5 |
| 096. Live Election Operations Map | Election Day | PARTIAL | Map displays latest Agent coordinates, incidents, and Polling Unit records; Polling Units have no coordinates. | Add authoritative Polling Unit geodata, statuses, alert layers, and realtime updates. | Geodata, realtime | 5-6 |
| 097. Real-Time Alert System | Election Day | NEW | No tracking/report alert model or delivery path. | Add alert rules, lifecycle, routing, acknowledgement, escalation, and realtime events. | Location sessions, realtime | 5-6 |
| 098. Polling Unit Coordinator Check-In | Election Day | REFACTOR | Agent GPS check-in endpoint and UI exist. | Migrate role, enforce election/session/assignment/geofence context, and add idempotency. | Phase 1, election configuration | 5 |
| 099. Election-Day GPS Tracking | Election Day | REFACTOR | Browser watchPosition posts `AgentActivity.LOCATION_PING`; Agent consent and single-session nonce exist. | Add `LocationSession`/`LocationPing`, device/session policy, retention, batching, and target role. | PUC migration, consent | 5 |
| 100. Polling Unit Geofence Monitoring | Election Day | BLOCKED | PollingUnit has no latitude, longitude, or radius; no distance evaluation exists. | Source and approve authoritative coordinates, then add configurable geofence evaluation. | Authoritative Ogun Polling Unit geodata | 5 |
| 101. Tracking Loss and Stale-Location Alerts | Election Day | NEW | The browser reports location failures locally; supervisors receive no durable alert. | Add thresholds, scheduled detection, alerts, and escalation. | LocationSession, worker/realtime | 5-6 |
| 102. Location Mismatch Alerts | Election Day | NEW | No geofence distance or mismatch record. | Add accuracy-aware mismatch evaluation and review alerts. | Feature 100 | 5-6 |
| 103. Tracking Escalation Workflow | Election Day | NEW | Incident escalation exists, not tracking-alert escalation. | Add hierarchy-aware alert escalation and bypass policy. | Alert model, target hierarchy | 6 |
| 104. Quick Communication from Alerts and Map | Election Day | NEW | Current map can lead to records/tasks but has no message/call action. | Add authorized action endpoints and UI from alert/map context. | Messaging/voice, alerts | 7 |
| 105. Missing-Report Contact Actions | Election Day | NEW | Report list has no expected-report model or contact action. | Calculate outstanding reports and expose message/call/request actions. | Election configuration, messaging | 6-7 |
| 106. Operational Presence Indicators | Election Day | NEW | Latest Agent activity is persisted; no connection presence service. | Add Redis-backed presence with durable last-seen fallback. | Realtime gateway | 6 |
| 107. One-to-One In-App Messaging | Election Day | NEW | No conversation or message model. | Add scoped conversations, messages, receipts, moderation, and realtime delivery. | Realtime, RBAC | 7 |
| 108. Group and Territory Messaging | Election Day | NEW | Broadcasts are one-way notifications, not group chat. | Add target territory channels and membership lifecycle. | Feature 107, territory assignments | 7 |
| 109. Messaging Permission Rules | Election Day | NEW | No messaging authorization engine. | Define sender/recipient/territory relationship policies and tests. | Target RBAC, conversation model | 7 |
| 110. In-App Voice Calling | Election Day | NEW | No WebRTC or signalling code. | Add signalling, STUN/TURN, call setup, failure fallback, and device UX. | Realtime, TURN provider | 7 |
| 111. Call Permissions, Interface and History | Election Day | NEW | No call models or UI. | Add permission checks, call states, participants, metadata, and retention. | Feature 110 | 7 |
| 112. Election Operations Chat | Election Day | NEW | No election-scoped chat. | Integrate conversations with alerts, incidents, reports, and Situation Room. | Features 107-109 | 7 |
| 113. Incident Reporting | Election Day | REFACTOR | Agent and Voter incident APIs support locked types, severity, location, territory, and text. | Migrate reporter role, add election context, history, and evidence links. | Phase 1 roles, EvidenceAsset | 5, 8 |
| 114. Incident Severity and Workflow | Election Day | PARTIAL | Locked severity/status enums, admin assignment, escalation, resolution, notifications, and some audits exist. | Add transition policy, event history, target-role permissions, SLAs, and concurrency control. | IncidentEvent, RBAC | 5 |
| 115. Incident Multimedia Evidence | Election Day | PARTIAL | URL metadata attachments and database photo assets exist; incident text/location are stored. | Route photo/video/written evidence through protected evidence pipeline. | EvidenceAsset, private storage | 8 |
| 116. Incident Assignment and Escalation | Election Day | PARTIAL | Admin assignment, escalation note, task creation, notification, and audit exist. | Add target escalation chain, immutable history, notes, SLA/escalation rules, and resolution evidence. | Phase 1 roles, incident events | 5-6 |
| 117. Structured Election-Day Reporting | Election Day | REFACTOR | Agent report captures arrival, opening, turnout, incident notes, remarks, votes, territory, and photos. | Migrate to PUC, add report types/completion, flexible evidence, drafts, and safe correction history. | PUC migration, election config | 5 |
| 118. Pictorial, Video and Information Proof | Election Day | PARTIAL | Two photos and written report fields are supported; video is absent. | Add all three first-class evidence types and links. | Evidence pipeline | 8 |
| 119. Live Result and Reporting Monitoring | Election Day | PARTIAL | Admin list/filter/review and current report totals exist. | Add expected/outstanding calculations, realtime status, evidence counts, and completion. | Feature 095, realtime | 6 |
| 120. Report Review and Operational Timeline | Election Day | PARTIAL | Approve/reject/under-review plus note and audit exist. | Add query/clarification/correction transitions, review history, and unified operational timeline. | ReportEvent, alerts/comms | 5-8 |
| 121. Post-Election Source of Truth | Post-Election | PARTIAL | Reports, incidents, activities, audits, and timestamps persist in PostgreSQL. | Establish evidence-grade integrity, event history, retention, reconciliation, and read models. | Evidence subsystem | 8-9 |
| 122. Three Evidence Types | Post-Election | NEW | Current assets are report-photo-specific or generic URL metadata. | Add first-class PHOTO, VIDEO, and WRITTEN_REPORT assets. | EvidenceAsset | 8 |
| 123. Evidence Linked to Events | Post-Election | PARTIAL | Report assets link to one report; media metadata links to incidents/feedback. | Add polymorphic or explicit immutable links to reports, incidents, results, events, and cases. | EvidenceAsset, domain link contract | 8 |
| 124. Evidence Chain of Custody | Post-Election | NEW | Generic audits do not record custody. | Add append-only custody events for upload, access, review, classification, download, export, and case use. | Evidence identity, audit actor context | 8 |
| 125. Cryptographic Evidence Hashing | Post-Election | NEW | No hash field or trusted hashing job. | Compute server-controlled SHA-256 and provide re-verification. | Private upload, worker | 8 |
| 126. Original Evidence Preservation | Post-Election | PARTIAL | Election report assets are relationally restricted and have no update endpoint, but are mutable database rows without storage immutability. | Use unique object keys, overwrite denial, versioning, and optional Object Lock/WORM. | Object storage policy | 8 |
| 127. Preview and Streaming Derivatives | Post-Election | NEW | No evidence derivatives or media jobs. | Generate separate thumbnails/previews/transcodes asynchronously. | Worker, media tooling, object storage | 8 |
| 128. Multi-Point Timestamping | Post-Election | PARTIAL | Created/updated, report date, and arrival timestamps exist. | Separate capture, upload, server receipt, report, review, and custody timestamps. | EvidenceAsset | 8 |
| 129. Evidence Location Context | Post-Election | PARTIAL | Incidents and Agent activities can store coordinates; reports store territory, but assets have no location fields. | Snapshot coordinates, accuracy, Polling Unit, and geofence context on evidence. | EvidenceAsset, location service | 8 |
| 130. Evidence Classification | Post-Election | NEW | No evidence classification enum/workflow. | Add locked classes, classifier permissions, and history. | Evidence review | 8 |
| 131. Evidence Review Status | Post-Election | NEW | Report review exists, not evidence review. | Add evidence-specific status, reviewer, notes, and transitions. | EvidenceAsset, validator/reviewer policy | 8 |
| 132. Polling Unit Evidence Timeline | Post-Election | NEW | Data sources exist separately; no normalized timeline. | Project server-timestamped events into an authorized Polling Unit timeline. | Event contracts across Phases 5-8 | 9 |
| 133. Polling Unit Evidence Dossier | Post-Election | NEW | No dossier aggregate. | Build dossier read model with reports, incidents, location, evidence, hashes, reviews, and audits. | Feature 132 | 9 |
| 134. Ward and Constituency Evidence Aggregation | Post-Election | NEW | Territory fields can support queries, but no evidence aggregation exists. | Add authorized roll-ups and completeness metrics. | Evidence links, territory graph | 9 |
| 135. Evidence Search and Discovery | Post-Election | NEW | No evidence search API/index. | Add metadata search with role/territory/case filters. | Evidence metadata and access service | 9 |
| 136. Controlled Legal / Evidence Export | Post-Election | NEW | Voter CSV export is unrelated and unaudited. | Build asynchronous evidence packages, manifests, hashes, signed delivery, and export audit. | Dossiers, worker, object storage | 9 |
| 137. Evidence Access Control | Post-Election | PARTIAL | Report-photo reads check owner or Admin territory/party. | Centralize evidence actions by role, territory, case permission, status, and purpose. | Target RBAC, EvidenceAsset | 8-9 |
| 138. Evidence Access Audit Trail | Post-Election | PARTIAL | Generic audit foundation exists, but media/evidence views and downloads are not logged. | Audit every sensitive access with actor, session/request, purpose, object version, and outcome. | Evidence access service | 8-9 |
| 139. Evidence Retention Policy | Post-Election | BLOCKED | No retention policy or deletion controls. | Obtain approved legal/privacy retention schedule, then implement holds, disposition, and verification. | Legal/product policy approval | 9-10 |
| 140. Post-Election Legal Support Workspace | Post-Election | NEW | No case/workspace models. | Add cases, permissions, evidence links, notes, timelines, packages, and non-conclusion guardrails. | Features 132-139 | 9 |

## E. Database Migration Matrix

Dispositions describe the target treatment. `REPLACE` and `DEPRECATE` always mean compatibility reads/backfill first, never destructive deletion.

| Current model | Disposition | Safe migration direction |
|---|---|---|
| User | EXTEND | Add target role, account status, credential/session versioning, and compatibility mapping; do not rewrite legacy role values in place. |
| AdminProfile | REFACTOR | Introduce coordinator/officer assignments and level separately; backfill each legacy admin after review. |
| CandidateProfile | REFACTOR | Create user-independent `Candidate`, copy campaign fields, and dual-read while foreign keys migrate from `candidateUserId`. |
| AgentProfile | REFACTOR | Preserve rows while migrating to Polling Unit Coordinator assignment; retain legacy IDs for activities/reports. |
| VoterProfile | REFACTOR | Evolve to `MemberProfile`; move voter-card identity into verification records and make evidence optional at registration. |
| VoterEngagementTask | REFACTOR | Keep campaign engagement behavior but route rewards through versioned RewardRules. |
| VoterEngagementClaim | EXTEND | Preserve claims; add event/idempotency and target Member terminology. |
| AdminCandidateAssignment | REFACTOR | Migrate to `CampaignOfficerAssignment(candidateId,userId,scope,responsibility)` and preserve permissions during cutover. |
| RewardLedger | REFACTOR | Backfill to append-only `RewardLedgerEntry` with source event and rule version; retain a legacy compatibility view. |
| ParticipationEvent | EXTEND | Preserve history and use as an input to a typed RewardEvent/outbox, not a direct points authority. |
| CampaignEvent | EXTEND | Keep event/RVSP functionality; replace `candidateUserId` with `candidateId` after dual-key migration. |
| CampaignEventRsvp | KEEP | Preserve with Member naming and candidate-domain foreign-key updates. |
| CandidateMediaAsset | REFACTOR | Keep public campaign-media semantics, move bytes to object storage, and keep separate from evidence. |
| Poll | EXTEND | Preserve engagement polls; enforce territory on response submission and prohibit ballot-choice reward semantics. |
| PollOption | KEEP | No structural target conflict; preserve IDs. |
| PollResponse | KEEP | Preserve responses with corrected authorization and privacy rules. |
| Post | EXTEND | Preserve campaign content; migrate to domain Candidate and managed media assets. |
| Feedback | EXTEND | Preserve operational feedback; normalize territory and typed attachments. |
| AgentActivity | REFACTOR | Split durable field activity from high-volume `LocationSession`/`LocationPing`; preserve old events as historical activity. |
| Incident | EXTEND | Add election, assignment, SLA, review, event-history, and evidence relations without replacing current incidents. |
| FieldTask | EXTEND | Preserve tasks; generalize assignee role and add assignment/event history. |
| BroadcastMessage | EXTEND | Preserve broadcasts; add recipient/delivery records and target audiences. |
| RewardRedemption | REPLACE | Freeze as legacy payout request after backfill into payout cycles/transactions; keep read-only history. |
| Notification | EXTEND | Add channel, status, template/event identity, attempts, and worker delivery while retaining in-app records. |
| AuditLog | EXTEND | Add category, nullable system actor, request/session/territory columns, immutable retention, and partition/index strategy. |
| ElectionDayReportAsset | REFACTOR | Backfill to `EvidenceAsset` plus report link; retain old bytes until object copy/hash verification succeeds. |
| ElectionDayReport | EXTEND | Preserve reports and IDs; add coordinator identity, report type/version, event/review history, and evidence relations. |
| MediaAttachment | REFACTOR | Separate public campaign attachments from protected evidence; migrate URLs to managed storage records. |
| GeoPoliticalZone | DEPRECATE | Retain as legacy reference data but remove from Ogun operational authorization and new forms. |
| PoliticalParty | KEEP | Preserve approved party reference and candidate relationships. |
| State | EXTEND | Preserve Ogun row and historical national rows; add operating-scope configuration rather than deleting non-Ogun data. |
| SenatorialDistrict | KEEP | Preserve IDs after Ogun parentage/completeness validation. |
| FederalConstituency | EXTEND | Preserve; validate Ogun district parentage and add stable external reference metadata. |
| LGA | KEEP | Preserve strictly as geographic/electoral reference, never authorization authority. |
| Ward | EXTEND | Add authoritative constituency memberships/parent path needed for target roll-up. |
| StateConstituency | EXTEND | Normalize multi-LGA membership and avoid treating one `lgaId` as command parent. |
| PollingUnit | EXTEND | Add stable code, constituency path, latitude, longitude, geofence radius, and data provenance. |
| SenatorialDistrictLga | KEEP | Preserve as reference membership only. |
| FederalConstituencyLga | KEEP | Preserve as reference membership only. |
| StateConstituencyLga | KEEP | Preserve as reference membership only. |

### Required new model groups

| Domain | Required models or equivalents |
|---|---|
| Authorization | `CoordinatorAssignment`, `CampaignOfficerAssignment`, `AccountSession`, optional `RoleGrant`/`PermissionPolicy` |
| Verification | `VoterVerification`, `VoterVerificationDocument`, `VerificationReviewEvent`, `VerificationRiskFlag`, `ConsentRecord` |
| Referrals/rewards | `Referral`, `ReferralEvent`, `RewardRule`, `RewardRuleVersion`, `RewardEvent`, `RewardLedgerEntry`, `BonusRule` |
| Payouts | `PayoutConfiguration`, `PayoutCycle`, `PayoutBatch`, `PayoutAssignment`, `PayoutTransaction`, `PayoutEvent` |
| Strength | `StrengthMetricDefinition`, `StrengthWeightConfiguration`, `TerritoryTarget`, `TerritoryMetricSnapshot`, `TerritoryStrengthSnapshot` |
| Election Day | `ElectionOperation`, `PollingUnitOperationalStatus`, `LocationSession`, `LocationPing`, `TrackingAlert`, `OperationalEvent` |
| Communications | `Conversation`, `ConversationMember`, `Message`, `MessageReceipt`, `PresenceSession`, `CallSession`, `CallParticipant` |
| Evidence | `EvidenceAsset`, `EvidenceLink`, `EvidenceDerivative`, `EvidenceCustodyEvent`, `EvidenceReview`, `EvidenceAccessEvent` |
| Post-election | `LegalCase`, `CaseEvidence`, `CaseNote`, `EvidencePackage`, `EvidencePackageItem`, `EvidenceManifest` |

## F. Role Migration Plan

| Legacy identity | Target identity | Migration treatment |
|---|---|---|
| `SUPER_ADMIN` | `SUPER_ADMIN` | Keep ID and credentials; replace implicit powers with explicit target policy tests. |
| `ADMIN + NATIONAL` | No Ogun operational equivalent | Retain legacy account disabled or reference-only after owner review; never auto-map. |
| `ADMIN + GEO_POLITICAL_ZONE` | No Ogun operational equivalent | Retain for audit/history and require manual Ogun assignment if still active. |
| `ADMIN + STATE` | `STATE_OFFICER` | Auto-propose only for Ogun-scoped records; require approval before cutover. |
| `ADMIN + SENATORIAL` | `COORDINATOR + SENATORIAL_DISTRICT` | Backfill assignment and validate district. |
| `ADMIN + FEDERAL_CONSTITUENCY` | `COORDINATOR + FEDERAL_CONSTITUENCY` | Backfill assignment and validate parent district. |
| `ADMIN + STATE_CONSTITUENCY` | `COORDINATOR + STATE_CONSTITUENCY` | Backfill assignment and validate Ward memberships. |
| `ADMIN + LGA` | No direct target equivalent | Produce an exception queue; map manually to constituency or Ward assignments. |
| `ADMIN + WARD` | `COORDINATOR + WARD` | Backfill assignment and validate Polling Units. |
| `CANDIDATE` | Domain `Candidate`; optional officer User after review | Copy campaign profile to Candidate, move operations to assigned officers, then disable Candidate login. |
| `AGENT` | `COORDINATOR + POLLING_UNIT` | Preserve User and profile IDs; add target assignment and compatibility authorization before route rename. |
| `VOTER` | `MEMBER` | Preserve account; create MemberProfile and initialize verification state from reviewed evidence only, never from card string alone. |
| None | `VALIDATOR` | New least-privilege role with assigned verification queues. |
| None | `PAYOUT_OFFICER` | New execution-only role with payout assignments. |

Authorization cutover must run in dual-read mode: legacy policy and target policy are evaluated and discrepancies logged before target policy becomes enforcing. No mass enum rename should be used.

## G. Territory Migration Plan

1. Record a read-only production baseline: counts and orphan checks for every territory ID on profiles, activities, incidents, tasks, reports, rewards, and campaign content.
2. Add an Ogun operating-scope setting and block new non-Ogun operational assignments while preserving national reference rows.
3. Validate Ogun State, 3 Senatorial Districts, Federal Constituencies, State Constituencies, 20 LGAs, Wards, and Polling Units against an approved dataset and stable identifiers.
4. Add direct constituency memberships needed for Ward/Polling Unit roll-up and geodata provenance; do not infer authority from LGA.
5. Add target coordinator assignments alongside `AdminProfile`/`AgentProfile` and generate exception reports for national, zone, and LGA admins.
6. Introduce target authorization in observe-only mode, compare allow/deny decisions, then cut over route groups incrementally.
7. Freeze legacy assignment writes, retain compatibility reads, and deprecate legacy command levels only after reconciliation and rollback rehearsal.

## H. Route Migration Plan

| Current route group | Treatment | Target direction |
|---|---|---|
| `/auth/login`, `/auth/me`, `/auth/password`, `/auth/logout` | REFACTOR | Versioned auth, target roles/status, session lifecycle, login audit, rate limits. |
| `/auth/register-voter` | RENAME/REFACTOR | `/api/v1/members/register`; optional verification evidence and no signup reward. |
| `/auth/territories/*` | REFACTOR | Ogun-only hierarchical reference endpoints with constituency relationships. |
| `/voter/*` | RENAME/REFACTOR | `/api/v1/member/*`; verification, qualified referrals, and target reward/payout projections. |
| `/agent/check-in`, `/check-out`, `/location`, `/activities` | RENAME/REFACTOR | `/api/v1/coordinator/polling-unit/*` backed by sessions and target assignment. |
| `/agent/tasks` | KEEP/REFACTOR | Preserve behavior under coordinator routes and generalized assignee policy. |
| `/agent/incidents` | KEEP/REFACTOR | Preserve fields; add election context, events, and EvidenceAsset links. |
| `/agent/election-reports*` | KEEP/REFACTOR | Preserve reports/IDs; support target report lifecycle and evidence pipeline. |
| `/candidate/public*` | KEEP/RENAME | Preserve public discovery using `candidateId`, not candidate user ID. |
| Authenticated `/candidate/*` | DEPRECATE | Move profile/content/event operations to scoped officer campaign routes. |
| `/admin/users`, `/admin/admin-users`, `/admin/users/manage` | REFACTOR | Target user/role/coordinator assignment administration. |
| `/admin/candidates*` | REFACTOR | Domain Candidate CRUD and CampaignOfficerAssignment. |
| `/admin/agents*` | RENAME/REFACTOR | Polling Unit Coordinator management and assignment/session controls. |
| `/admin/voters*` | RENAME/REFACTOR | Member management; remove card-number exposure and audit exports. |
| `/admin/incidents*` | KEEP/REFACTOR | Target role scope, event history, SLA, and evidence links. |
| `/admin/tasks*` | KEEP/REFACTOR | Preserve and generalize; queue large bulk operations. |
| `/admin/broadcasts*`, `/notifications*` | KEEP/EXTEND | Preserve in-app behavior, add deliveries/channels/workers and target audiences. |
| `/admin/reward-ledger`, `/admin/redemptions*` | REPLACE | Versioned rewards and payout cycles/batches/assignments; legacy read-only endpoints. |
| `/admin/coverage*`, `/analytics`, `/summary`, `/map-summary` | REFACTOR | Ogun target hierarchy, snapshots, strength engine, and Situation Room read models. |
| `/media/*` | REPLACE | Authorized object-storage upload/finalize/access flows and EvidenceAsset links. |
| Realtime/presence/message/call routes | NEW | Versioned REST bootstrap plus Socket.IO events and WebRTC signalling. |
| Evidence/case/export routes | NEW | Protected evidence search, review, custody, dossier, case, and package APIs. |

## I. Reusable Code Inventory

| Reusable area | Specific implementation | Migration use |
|---|---|---|
| Authentication | `apps/api/src/auth/*`, `middleware/auth.ts` | Keep password/JWT primitives; extend sessions, status, audit, and target policy. |
| Authorization | `apps/api/src/scope.ts`, `lib/territory.ts` | Preserve tested concepts; replace legacy ranks and unify deny-by-default checks. |
| API foundation | `apps/api/src/app.ts`, route/error patterns, Zod schemas | Keep Express composition and validation style; add versioning and security middleware. |
| Shared contracts | `packages/shared/src/index.ts` | Evolve with compatibility types and target enums. |
| Territory data | Prisma territory models, constituency membership joins, INEC workbook parser | Restrict operational use to Ogun and validate provenance/completeness. |
| Agent operations | `routes/agent.ts`, `agent-session-tracker.tsx`, Agent dashboard | Primary Polling Unit Coordinator check-in/GPS/task/incident/report base. |
| Incidents | `Incident`, incident governance helper, admin/agent/voter routes and pages | Extend with target roles, event history, realtime alerts, and evidence. |
| Tasks | `FieldTask`, single/bulk assignment, notifications and audits | Rebind to coordinators and queue large batches. |
| Election reports | `ElectionDayReport`, assets, agent form, admin review | Preserve IDs/workflow and migrate assets to evidence. |
| Coverage | Admin coverage queries, insights types, coverage/live pages and map components | Seed strength metrics and Situation Room read models. |
| Campaign content | Candidate public profiles, parties, posts, events, RSVP, media | Preserve after Candidate decoupling. |
| Notifications/broadcasts | Notification and BroadcastMessage models/routes/pages | Extend into asynchronous multi-channel delivery and territory messaging bootstrap. |
| Rewards | Ledger-derived balance helper, transaction usage, notifications | Preserve legacy history and reuse concepts after rule/event redesign. |
| Audit | `lib/audit.ts`, AuditLog, admin audit view | Extend coverage and immutable metadata rather than replace. |
| Deployment | `render.yaml`, `apps/web/vercel.json` | Preserve current workflow while Docker services are introduced incrementally. |

### Old Agent to Polling Unit Coordinator mapping

| Old Agent feature | New Polling Unit Coordinator feature | Action |
|---|---|---|
| Agent login + GPS consent | PUC authenticated field session | REFACTOR role and consent version; keep single-session control. |
| `AgentProfile.pollingUnitId` | Coordinator Polling Unit assignment | MIGRATE to assignment table with validity/history. |
| Check-in/check-out | Election/field attendance | KEEP behavior; add operation, geofence, and idempotency. |
| `LOCATION_PING` activity | LocationSession/LocationPing | SPLIT high-volume telemetry from durable field activity. |
| Agent activities | Coordinator field activity | RENAME/EXTEND types and phase context. |
| FieldTask assignment/update | Coordinator task workflow | KEEP/EXTEND generalized assignment. |
| Incident submission | PUC incident reporting | KEEP/EXTEND evidence and escalation history. |
| ElectionDayReport | PUC structured Election Day report | KEEP/EXTEND report versions and evidence. |
| Agent notifications | Coordinator operational notifications | KEEP/EXTEND worker delivery. |
| Session nonce/revoke | Device/session control | KEEP/EXTEND session records, rotation, and security audit. |

## J. New Systems Required

- Target RBAC and coordinator assignment service.
- Ogun operating-scope and constituency-first territory graph.
- User-independent Candidate and campaign officer assignments.
- Member verification, private voter-document storage, review history, and fraud screening.
- Qualified Referral lifecycle and roll-up statistics.
- Versioned RewardRule/RewardEvent/RewardLedgerEntry engine with idempotent workers.
- Payout configuration, cycles, batches, assignments, transactions, and reconciliation.
- Strength metrics, targets, historical snapshots, heatmaps, and dashboards.
- Election operations configuration, Polling Unit status, location sessions, geofencing, alerts, and escalation.
- Redis, Socket.IO realtime gateway, outbox/event delivery, presence, and Situation Room projections.
- Scoped messaging and WebRTC voice with STUN/TURN.
- Private S3-compatible object storage, secure upload/access service, and BullMQ workers.
- Evidence assets, hashes, derivatives, custody/review/access events, timelines, dossiers, search, and exports.
- Legal-support cases/workspaces and evidence packages.
- Central configuration validation, rate limits, observability, backups, recovery tests, load tests, and field simulations.

## K. Technical Debt and Risks

### Data migration risks

- Early migrations contain SQLite `DATETIME`/`PRAGMA` syntax while `migration_lock.toml` and Prisma declare PostgreSQL. A fresh PostgreSQL build cannot be trusted until a production-safe baseline and replay path are rehearsed.
- `CandidateProfile` and campaign foreign keys are coupled to authenticated User IDs; decoupling requires dual keys and backfill, not deletion.
- Legacy Admin and Agent records may be ambiguous under the target hierarchy, especially national, geo-political-zone, and LGA admins.
- `VoterProfile.voterCardNumber` is mandatory and cannot be treated as verified evidence during Member migration.
- Existing rewards were generated under hard-coded behavior and need a clearly labeled legacy rule version, not retrospective recalculation.

### Permission and privacy risks

- Scope logic is distributed across route-local filters and helpers. Some filters omit constituency dimensions, creating inconsistent authorization semantics.
- Candidate APIs return Member voter-card numbers; general Admin Member lists also expose them. Target access must be validator-only.
- Voter poll submission checks Polling Unit ownership of the option but does not re-check the Voter's territory against the poll at submission.
- Bearer tokens are stored in browser `localStorage`; non-Agent tokens have no server-side revocation/session record.
- Account status is a Boolean only; inactive/suspended semantics and session invalidation are incomplete.

### Financial integrity risks

- Referral reward is created at signup, violating verification-gated qualification.
- Reward values are hard-coded in registration and poll routes; engagement tasks can be configured by any scoped Admin.
- The redemption approval expression `pointsRequested > availablePoints + pointsRequested` is ineffective, and concurrent requests can over-reserve without locking/unique payout controls.
- Float monetary amounts and client-supplied requested amounts are unsuitable as the authoritative payout value.
- Ledger rows cascade-delete with User and lack source event/rule version/reversal semantics.

### Evidence integrity risks

- Election report photos are mutable database blobs with no SHA-256, object version, custody trail, malware check, or original/derivative distinction.
- Generic media accepts arbitrary external URLs and MIME metadata without owning or validating the object.
- Evidence/photo reads are not access-audited; voter CSV export is also unaudited.
- No approved retention schedule, legal hold, WORM/Object Lock policy, evidence backup, or restore verification exists.

### Election Day and production risks

- Live operations are 30-second HTTP polling; there is no realtime gateway, Redis, presence, queue, outbox, or multi-instance fan-out.
- GPS pings are unpartitioned durable `AgentActivity` rows; there is no stale/mismatch detector, geofence, retention strategy, or load test.
- Polling Units have no coordinates, so map/geofence behavior cannot be authoritative.
- Binary uploads pass through API memory/database and are limited to photos; peak media load is not supported.
- No rate limiting, Helmet/security headers, brute-force protection, upload signature inspection, centralized secret schema, observability stack, CI, backup test, or disaster-recovery rehearsal is checked in.
- `npm audit` reports 16 dependency advisories: 1 low, 3 moderate, 10 high, and 2 critical. Direct affected packages include `concurrently` (critical), `express` (moderate), `next` (high), `prisma` (high), and `xlsx` (high with no automated fix reported); the critical transitive `shell-quote` advisory is fixable through its dependency chain.
- `render.yaml` points at a different historical repository URL/name and should be corrected only after deployment ownership is confirmed.

### Migration order

```text
PostgreSQL baseline and data inventory
-> target role model
-> constituency-first territory authorization
-> coordinator/candidate/member compatibility migration
-> member verification
-> qualified referrals
-> reward engine
-> payout architecture
```

```text
Polling Unit Coordinator migration
-> election configuration and location sessions
-> geodata/geofencing and alerts
-> Redis/realtime/outbox
-> Situation Room
-> messaging
-> voice
```

```text
private object storage
-> EvidenceAsset and secure access
-> server hashing
-> derivatives
-> custody/review events
-> timelines and dossiers
-> evidence packages and legal workspace
```

### Verification record

- Installed the lockfile dependencies with `npm ci`; Prisma lifecycle scripts were skipped by the package manager, so the pinned Prisma 6.19.2 client was generated explicitly before source validation.
- `npm run lint` passes across API, web, database, and shared workspaces after client generation.
- `prisma validate` passes for `packages/database/prisma/schema.prisma` using a syntactically valid audit-only PostgreSQL URL.
- `npm run build` passes for all workspaces; Next.js produced all 33 application routes successfully.
- `git diff --check` passes for the documentation changes.
- Database-backed integration tests were not run because the repository has no root environment file or disposable test database configuration, and both suites create and delete persisted records. Running them against an unknown shared database would be unsafe.

## L. Phase 0 Completion Status

**Status: PARTIAL as of 2026-08-09.** The repository foundation is materially safer, but the production-baseline rehearsal and authoritative Ogun reference-data gates remain open. Phase 1 feature implementation has not started.

### Risks resolved or reduced

- The 17 legacy migrations are preserved and SHA-256 locked. A separate PostgreSQL-only Ogun stream now supplies one clean baseline migration.
- Production schema setup now fails closed on non-empty schema drift instead of broadly marking legacy migrations applied after `P3005`.
- A PostgreSQL 16 Docker path creates, migrates, seeds, bootstraps, tests, and destroys a database that is restricted to a local test name.
- The target role, coordinator-level, territory, event, audit, storage, queue, realtime, and developer-ownership contracts are documented and shared target enums are centralized.
- Missing Ogun reference data is reported as a blocker. The constituency bootstrap no longer creates LGAs from free-text constituency composition.
- Production JWT settings are validated; algorithm, issuer, audience, and expiry are explicit. Inactive-account token denial remains backend enforced.
- Helmet, body limits, exact-origin CORS, login/registration rate limits, and explicit proxy trust were added.
- General management/candidate payloads and CSV export no longer expose voter-card numbers; sensitive export behavior is audited.
- Dependency findings fell from 16 total with 2 critical to 5 package findings with 0 critical.
- Minimal CI now covers locked install, documentation/migration integrity, Prisma, type-check, build, disposable PostgreSQL integration, and critical dependency audit without deployment.

### Remaining risks and blockers

- No production credentials, schema export, migration table export, or sanitized snapshot was available. The exact-schema baseline path is implemented but has not been rehearsed against production-derived state.
- The verified disposable database contains Ogun plus 3 Senatorial Districts and 9 Federal Constituencies, but no authoritative Ogun State Constituencies, LGAs, Wards, Polling Units, direct constituency memberships, Polling Unit codes, coordinates, geofence radius, or provenance.
- Browser JWT storage, legacy Boolean account state, legacy role/territory route logic, and Candidate/User coupling remain for Phase 1 migration.
- Private object storage, BullMQ/Redis, Socket.IO/Redis adapter, workers, STUN/TURN, evidence integrity, and observability remain TARGET architecture only.
- `npm audit` retains 1 low and 4 high package findings. Next/PostCSS/Sharp remediation requires a tested Next 16 migration; `xlsx` has no npm fix and is restricted to trusted checked-in bootstrap workbooks.
- CI configuration was validated locally, but no hosted GitHub Actions run is recorded in this Phase 0 worktree.

### Phase 0 verification record

- `npm run verify:migrations`: PASS; 17 legacy migrations and 1 Ogun migration verified.
- `npm run lint`: PASS across API, web, database, and shared workspaces.
- `npm run prisma:validate`: PASS with the documented validation-only PostgreSQL URL.
- `npm run build`: PASS; Next generated 33 routes.
- `npm run test:integration:docker`: PASS; clean deploy, already-baselined, exact-schema reconciliation, all 16 API integration cases, and volume destruction passed.
- `npm run verify:reference:ogun`: BLOCKED as designed on missing authoritative data; the integration path uses the explicit `--allow-incomplete` structural check.
- `npm audit`: 5 findings: 1 low, 4 high, 0 critical.

Four-developer feature implementation is not yet approved. The next work is Phase 0 closure: obtain and rehearse a sanitized production snapshot, source and verify authoritative Ogun electoral reference data, review remaining high dependency risk, and obtain a green hosted CI run.

## Phase 1 Implementation Review

The preceding Phase 0 decision is a historical closure record. It was superseded by explicit Platform Lead authorization to implement Phase 1 on a review branch.

- **Review date:** 2026-08-09
- **Implementation status:** PASS for the Phase 1 code foundation; production data migration remains unapplied
- **Features addressed:** 001-023 and 025
- **Migration added:** `20260809010000_phase1_role_territory_foundation`
- **Existing migrations modified:** 0

The target roles, account statuses, CoordinatorLevel, CoordinatorProfile, constituency-first parent links, centralized authorization, controlled coordinator assignment, organization-tree API/UI, user-independent Candidate, and legacy identity migration utility are implemented. LGA is absent from the target command profile and authorization inputs. Candidate, Agent, Voter, and Admin records are migrated additively; protected legacy profiles and user-keyed operational history are retained.

The migration utility is dry-run by default and applies only with `--apply`. It blocks non-Ogun, National, geopolitical-zone, LGA-admin, missing-profile, and incomplete-command-ancestry rows rather than inventing authority. Candidate authentication remains transitional; target Candidate APIs do not require it. Legacy Admin/Candidate routes and `apps/api/src/scope.ts` remain explicitly transitional.

The authoritative repository still has no approved Ogun LGAs, Wards, Polling Units, or loaded State Constituencies. The organization-tree API returns an explicit incomplete-reference response and real lower-level assignments remain unavailable until that data is approved and imported. Synthetic PostgreSQL fixtures prove the architecture and isolation behavior without promoting fixtures into reference data.

Parallel domain development is `SAFE` under Platform Lead ownership of the shared files listed in `docs/PHASE_1_COMPLETION.md`. Phase 2 must not begin automatically; this result stops for architecture review.
