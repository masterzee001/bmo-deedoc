# Parallel Sprint 3 Status — Post-Integration Re-Audit

- **Branch:** `integration/sprint3`
- **Base:** `main @ 8ba43f9` (Sprint 2 merged)
- **Assessment date:** 2026-08-10
- **Audit target:** the integrated branch, after all four Sprint 3 workstreams merged and the voice-call lifecycle landed
- **Existing migrations modified:** 0
- **New migrations:** 1 (`20260810000000_election_day_voice_call_lifecycle`)

> This document replaces the pre-integration matrix published at `9e14d92`. That
> earlier version was written against `main @ 8ba43f9` **before** the three
> feature workstreams committed, so its counts (55/79/6) described the Sprint 3
> starting line, not its result. It must not be cited as the Sprint 3 outcome.

## Summary

| Status | Count | Meaning |
|---|---:|---|
| COMPLETE | 74 | The intended workflow runs end-to-end on this branch: backend enforcement, authorization, and a usable entry point, with integration-test or equivalent evidence. |
| PARTIAL | 62 | Real capability exists, but the workflow stops short of the Definition of Done in `docs/TECHNICAL.md` — usually a missing UI surface, an unimplemented rule, or a background runtime. |
| BLOCKED | 4 | Cannot be completed in code. Gated on authoritative external data, a governance decision, or unbuilt processing infrastructure. |

Sprint 3 moved 19 features from PARTIAL to COMPLETE and closed 2 of the 6
previously BLOCKED features (110, 111 → voice calling now implemented; 111
remains PARTIAL pending UI).

## Integration Result

All four workstream branches merged into `integration/sprint3` with a single
conflict, in `apps/web/lib/api.ts`, where three workstreams each appended to the
same `@pics-nigeria/shared` import list. Resolved as the union of both sides; no
functionality was dropped. **No other integration, type, or contract fallout
occurred** — lint, build, and the full database integration suite passed on the
merged tree before any further code was written.

## Validation

| Gate | Result | Evidence |
|---|---|---|
| `verify:repository` | PASS | `legacy_migrations_verified=17`, `ogun_migrations_verified=8`, `master_features=140`, `required_documents=13` |
| `verify:migrations` | PASS | `migration_integrity=ok` with the new migration checksum-locked in `ogun-migration-manifest.json` |
| `prisma:validate` | PASS | schema valid |
| `prisma:generate` | PASS | client generated |
| `lint` | PASS | `tsc --noEmit` clean across api, web, database, shared |
| `build` | PASS | api/database/shared compile; Next.js builds 37 routes |
| `test` / `test:integration:docker` | PASS | 41 suites, `database_integration=ok`, against disposable PostgreSQL with full migrate-deploy + seed + reference bootstrap |
| `npm audit --audit-level=critical` | PASS | 0 critical (4 high, 1 low pre-existing; deferred to Sprint 4 hardening) |

The new migration was applied by `prisma:migrate:deploy` onto a fresh database
during the integration run, so it is proven deployable from baseline, not only
diffable.

## Non-Negotiable Gates Preserved

- LGA remains reference/search/reporting data and is never a command level.
- Missing territory ancestry fails closed in platform authorization.
- No Ogun LGA, Ward, Polling Unit, or PU geodata was invented.
- Polling Unit identity and Polling Unit geodata remain separate gates.
- No existing migration was edited; the new migration is additive only
  (`CREATE TYPE` / `CREATE TABLE` / `CREATE INDEX` / `ADD CONSTRAINT`).
- Reward paths remain verification- and referral-based. Nothing rewards a vote
  choice, ballot choice, or proof of voting for a candidate.
- Voice calls are never recorded; no media is persisted.

## Sprint 3 Migration

```text
20260810000000_election_day_voice_call_lifecycle
```

Adds `VoiceCall`, `VoiceCallParticipant`, and append-only `VoiceCallEvent`, plus
the `VoiceCallStatus`, `VoiceCallEndReason`, `VoiceCallParticipantStatus`, and
`VoiceCallEventType` enums. PostgreSQL is authoritative for call lifecycle and
history; Redis/Socket.IO carries only transient signalling.

## Security Fix Landed During Integration

The Socket.IO `call.signal` relay inherited from the election-operations branch
accepted a signal from **any authenticated user to any other user**, with no
call, no participation check, and no contact-permission check. It is now gated
on an in-progress `VoiceCall`, live participation by both ends, and the shared
contact rule in `apps/api/src/lib/messaging-permissions.ts` — the same rule the
REST messaging routes use. Covered by
`voice call permissions deny cross-territory, member, and non-participant access`.

## Feature Completion Matrix

| # | Name | Status | Post-integration assessment |
|---:|---|---|---|
| 001 | Ogun-State-Only Platform | COMPLETE | Contracts, routes, and validation scope to `ng-state-ogun`; legacy national compatibility is transitional only. |
| 002 | Constituency-First Command Structure | COMPLETE | Authorization resolves State → Senatorial → Federal → State Constituency → Ward → Polling Unit. |
| 003 | LGA as Reference, Not Command Level | COMPLETE | Coordinator profile carries no `lgaId`; LGA authorizes nothing. Enforced by the RBAC matrix test. |
| 004 | Ogun Electoral Reference Database | PARTIAL | **Data-gated.** State, 3 Senatorial Districts, 9 Federal Constituencies VERIFIED. State Constituencies PARTIAL; LGA/Ward/PU MISSING. |
| 005 | Locked User-Role Architecture | COMPLETE | Target roles and coordinator levels shared and persisted. |
| 006 | Super Admin Authority | PARTIAL | Platform, reward, payout, evidence, and account powers exist; platform settings/security configuration surface is incomplete. |
| 007 | General State Officer | PARTIAL | Statewide command visibility works; no dedicated State Officer operational dashboard. |
| 008 | State Validator Role | COMPLETE | Queue, claim, decision, restricted document access, and reward/payout denial implemented with UI. |
| 009 | Payout Officer Role | COMPLETE | Processes assigned payout work; denied rule and verification control. Tested. |
| 010 | Senatorial District Coordinator | PARTIAL | **Data-gated.** Level and inheritance work; production assignments need approved lower-level data. |
| 011 | Federal Constituency Coordinator | PARTIAL | **Data-gated.** Same as 010; dashboard surface also incomplete. |
| 012 | State Constituency Coordinator | PARTIAL | **Data-gated.** Command mappings not imported. |
| 013 | Ward Coordinator | PARTIAL | **Data-gated.** Ward command and referral capability tested; no production Ward data. |
| 014 | Polling Unit Coordinator | PARTIAL | PUC field capability works through transitional AgentProfile compatibility; Agent retirement incomplete. |
| 015 | Member / Supporter Account | COMPLETE | Registration, verification submission, status visibility, and rewards are reachable end-to-end from the member dashboard. |
| 016 | Candidate as Campaign Record | COMPLETE | Candidate domain model and `/platform/candidates` require no candidate authentication. |
| 017 | No Separate Candidate Account | PARTIAL | Target requires no Candidate login, but legacy Candidate login/dashboard routes still exist pending cutover. |
| 018 | Role + Territory Access Control | COMPLETE | Role, coordinator level, territory, account status, and action combined in one authorization path. |
| 019 | Territory Isolation | COMPLETE | Platform, realtime, evidence, and now call routes deny sibling and unrelated territories. |
| 020 | Controlled Territory Assignment | COMPLETE | Superior-only assignment, self-reassignment denial, peer IDOR denial, all audited and tested. |
| 021 | Organization Tree | PARTIAL | **Data-gated.** Endpoint fails closed on incomplete hierarchy, as designed; production tree awaits approved data. |
| 022 | Coordinator Management | PARTIAL | Create/assign/reassign/status workflows exist; management UI incomplete. |
| 023 | Member Management | PARTIAL | Admin management and sensitive-document redaction exist; target member-management workflow incomplete. |
| 024 | Member Registration | COMPLETE | Registration captures identity, contact, territory, referral, and consent through the updated register page. |
| 025 | Structured Territory Capture | PARTIAL | **Data-gated.** Controlled reference endpoints exist; approved LGA/Ward/PU records missing. |
| 026 | Voter-Card Upload | PARTIAL | Submission flow and client-side hashing work; production private object-storage pipeline for voter documents is not proven. |
| 027 | Verification Status Model | COMPLETE | Target statuses shared and persisted. |
| 028 | Validator Work Queue | COMPLETE | Status and flagged filters, claim, and review paths with a working Validator dashboard. |
| 029 | Secure Voter-Document Storage | PARTIAL | Private/no-public-key contract holds; full object-storage-backed voter-document pipeline not production complete. |
| 030 | Validation Decision Workflow | COMPLETE | Approve, reject, resubmission, notes, and role separation implemented and tested. |
| 031 | Verification History | COMPLETE | Status changes, actor, decision, note, and timestamps recorded. |
| 032 | Duplicate / Fraud Screening | PARTIAL | Duplicate document-hash flagging exists; broader fraud screening not implemented. |
| 033 | Consent and Privacy Records | PARTIAL | Terms, privacy, contact, document, and GPS consent recorded; broader privacy lifecycle incomplete. |
| 034 | Unique Referral Code and Link | COMPLETE | Eligible coordinators receive unique active codes; link surfaced in UI. |
| 035 | Referral Attribution | COMPLETE | Registration stores referrer and referral code and links referral to referred user. |
| 036 | Referral Status Model | COMPLETE | Target referral statuses shared and persisted. |
| 037 | Verification-Gated Referral Qualification | COMPLETE | Reward is created only after validator approval, never at signup. Tested. |
| 038 | Hierarchical Referral Roll-Up | COMPLETE | Network roll-up now aggregates through the command hierarchy, not just direct referrals. |
| 039 | Direct vs Network Referral Statistics | COMPLETE | Direct and network registered/verified counts are returned separately. |
| 040 | Configurable Reward Engine | PARTIAL | Rules and versions drive verified-referral rewards; the full qualifying-event catalog is not implemented. |
| 041 | Super-Admin Reward Configuration | COMPLETE | Super Admin controls rule creation; Payout Officer and Validator denied. Tested. |
| 042 | Reward Rule Versioning | COMPLETE | Versions persisted and referenced by processed events and ledger entries. |
| 043 | System-Controlled Bonus Points | PARTIAL | Bonus ledger category exists, but no bonus-rule processing path is implemented. |
| 044 | Approved Points Categories | COMPLETE | Shared and schema ledger categories match the locked list. |
| 045 | Immutable Points Ledger | COMPLETE | Confirmed balances derive from ledger entries; idempotency constraints protect processing. |
| 046 | Pending Potential Points | COMPLETE | Pending referral points calculated separately from confirmed and available balances. |
| 047 | Idempotent Reward Processing | COMPLETE | Duplicate approval rejected; unique constraints prevent duplicate reward events. Tested. |
| 048 | Reward Integrity Boundary | COMPLETE | No implemented reward path depends on vote or ballot choice. |
| 049 | Minimum Payout Threshold | COMPLETE | Configuration and cycles carry thresholds used for eligibility. |
| 050 | Payout Schedule | COMPLETE | Cycles with configured frequency and date fields. |
| 051 | Point-to-Value Conversion | COMPLETE | Conversion rates preserved on config and cycle; amounts calculated from them. |
| 052 | Payout Lifecycle | COMPLETE | Target statuses shared/persisted with enforced transitions. |
| 053 | Payout Batches | COMPLETE | Eligible beneficiaries grouped into batches. |
| 054 | Delegated Payout Assignment | COMPLETE | Batches create officer-specific beneficiary assignments. |
| 055 | Payout-Officer Restrictions | COMPLETE | Reward-rule, verification-decision, and unassigned-payout actions denied. Tested. |
| 056 | Payout-Officer Dashboard | COMPLETE | Officers can list and action their own assignments through the pre-election console. |
| 057 | Payout Accountability | COMPLETE | Beneficiary, points, value, officer, reference, proof key, status, and note preserved. |
| 058 | Financial Integrity Controls | COMPLETE | Duplicate rewards, duplicate assignment, unauthorized officer processing, and finalized edits all guarded. Tested. |
| 059 | Hierarchical Dashboard Model | PARTIAL | Scoped APIs and a strength dashboard exist; a unified hierarchical dashboard layer does not. |
| 060 | Polling Unit Dashboard | PARTIAL | PUC status and legacy Agent dashboard exist; target PU dashboard incomplete. |
| 061 | Ward Dashboard | PARTIAL | Scoped APIs can serve Ward data; no dedicated Ward dashboard. |
| 062 | State Constituency Dashboard | PARTIAL | Strength/status APIs support the scope; dashboard incomplete. |
| 063 | Federal Constituency Dashboard | PARTIAL | Aggregation foundations exist; dashboard incomplete. |
| 064 | Senatorial District Dashboard | PARTIAL | Aggregation foundations exist; dashboard incomplete. |
| 065 | Ogun State Dashboard | PARTIAL | Situation Room and strength summaries exist; unified statewide product dashboard incomplete. |
| 066 | Candidate Campaign Progress Profile | PARTIAL | Candidate domain and profile exist; campaign-progress dashboard incomplete. |
| 067 | Configurable Strength Score Engine | COMPLETE | Metric definitions, weight configs, targets, and snapshot calculation implemented with UI. |
| 068 | Polling Unit Strength | PARTIAL | **Data-gated.** Engine calculates PU scope; production PU data missing. |
| 069 | Ward Strength | PARTIAL | **Data-gated.** Ward snapshot path tested; production Ward data missing. |
| 070 | State Constituency Strength | PARTIAL | **Data-gated.** Engine supports the scope; authoritative mapping missing. |
| 071 | Federal Constituency Strength | PARTIAL | Engine supports the scope; comparison UX incomplete. |
| 072 | Senatorial District Strength | PARTIAL | Engine supports the scope; district intelligence UX incomplete. |
| 073 | Overall Ogun State Strength | PARTIAL | Engine supports state scope; statewide strength dashboard incomplete. |
| 074 | Campaign Target Setting | COMPLETE | Authorized senior roles create territory targets through the UI. |
| 075 | Target vs Actual Tracking | COMPLETE | Progress endpoint returns target, actual, percentage, and shortfall. |
| 076 | Progress Trend Analytics | COMPLETE | Snapshots compare latest and prior scores as improving/stable/declining. |
| 077 | Strength Heatmaps and Drill-Down | PARTIAL | Snapshot data can feed a heatmap; no heatmap or drill-down UI exists. |
| 078 | Coordinator Performance and Leaderboards | PARTIAL | Activity and referral data exist; no leaderboard endpoint or UI. |
| 079 | Field Task Management | PARTIAL | Legacy task CRUD exists; constituency-first task workflow incomplete. |
| 080 | Bulk Task Assignment | PARTIAL | Legacy bulk endpoint exists; target role/territory contract incomplete. |
| 081 | Pre-Election Field Activity Logging | PARTIAL | Logging works through Agent/PUC compatibility; target workflow incomplete. |
| 082 | Coverage Intelligence | PARTIAL | Coverage summary and insight endpoints exist; full intelligence layer incomplete. |
| 083 | Notifications | PARTIAL | Model, routes, and helpers exist; channel strategy incomplete. |
| 084 | Operational Broadcasts | PARTIAL | Creation and history exist; target territory messaging contract incomplete. |
| 085 | Broadcast History | PARTIAL | History listable; audit/review workflow incomplete. |
| 086 | Member Dashboard | COMPLETE | Verification status, rewards balance and ledger, tasks, events, and content all reachable for a member. |
| 087 | Search, Filters and Management Views | PARTIAL | Many management filters exist; unified search/discovery incomplete. |
| 088 | Reporting and Export | PARTIAL | Verification CSV export with redaction and audit exists; full reporting suite incomplete. |
| 089 | Mobile-First Production Architecture | PARTIAL | Next.js app builds; production mobile verification and runtime topology not done. |
| 090 | Audit and Security Logging | PARTIAL | Audit baseline plus key domain audits (including all call lifecycle actions); not every sensitive action is covered. |
| 091 | Election Situation Room | COMPLETE | Situation Room UI is live over the durable scoped status endpoint, with alerts, timeline, and messaging. |
| 092 | Real-Time Election Statistics | PARTIAL | Totals compute live from PostgreSQL; the Redis-backed realtime runtime is not deployed. |
| 093 | Hierarchical Real-Time Statistics | PARTIAL | Authorization-scoped status works; full hierarchy drill aggregation incomplete. |
| 094 | Live Drill-Down | COMPLETE | Polling-unit rows are returned and rendered within the actor's authorized scope. |
| 095 | Polling Unit Operational Status | COMPLETE | Shared statuses and status calculation drive the Situation Room view. |
| 096 | Live Election Operations Map | PARTIAL | **Geodata-gated.** Legacy incident/agent map summaries render; the validated PU live map requires approved PU geodata. |
| 097 | Real-Time Alert System | COMPLETE | Alert taxonomy, durable lifecycle, reconciliation, and acknowledge/escalate/resolve transitions. Tested. |
| 098 | Polling Unit Coordinator Check-In | COMPLETE | Idempotent check-in with audit, realtime event, and tests. |
| 099 | Election-Day GPS Tracking | PARTIAL | Consent-gated pings with REST and realtime events; no durable tracking-session model. |
| 100 | Polling Unit Geofence Monitoring | BLOCKED | **Geodata-gated.** Requires approved PU latitude, longitude, accuracy, and geofence radius. Code returns a gated status rather than guessing. |
| 101 | Tracking Loss and Stale-Location Alerts | PARTIAL | `LOCATION_STALE` alerts are generated by the reconcile endpoint; no scheduled background worker runs it automatically. |
| 102 | Location Mismatch Alerts | BLOCKED | **Geodata-gated.** Intentionally returns a gated review status. |
| 103 | Tracking Escalation Workflow | PARTIAL | Incident escalation exists; the tracking-alert escalation chain is incomplete. |
| 104 | Quick Communication from Alerts and Map | PARTIAL | Messaging and calling exist and are reachable, but alert/map quick-action controls are not wired. |
| 105 | Missing-Report Contact Actions | PARTIAL | Missing check-in and report data surface; contact-action workflow not wired to them. |
| 106 | Operational Presence Indicators | COMPLETE | Presence states, socket presence rooms, and the scoped `/presence` endpoint work; multi-instance presence requires `REDIS_URL` (implemented, unconfigured). |
| 107 | One-to-One In-App Messaging | COMPLETE | Direct conversations, messages, receipts, and read state, with Situation Room UI. Tested. |
| 108 | Group and Territory Messaging | COMPLETE | Group and territory conversations with membership resolution and REST fallback. |
| 109 | Messaging Permission Rules | COMPLETE | One shared contact rule governs REST messaging, calling, and socket relay. Cross-territory denial tested. |
| 110 | In-App Voice Calling | COMPLETE | Full lifecycle — initiate, ringing, accept, reject, connected, ended, missed/cancelled — durable in PostgreSQL, with WebRTC signalling and STUN/TURN configuration. Calls are never recorded. |
| 111 | Call Permissions, Interface and History | PARTIAL | Permissions, transition enforcement, and call history are implemented and tested, and web client functions exist; **no call UI component is built yet**. |
| 112 | Election Operations Chat | COMPLETE | Election operations conversations are integrated into the Situation Room workspace. |
| 113 | Incident Reporting | COMPLETE | PUC incident creation with territory, audit, and realtime event. |
| 114 | Incident Severity and Workflow | COMPLETE | Severity/status enums with status and escalation routes and an incident console. |
| 115 | Incident Multimedia Evidence | PARTIAL | Evidence assets link to incidents; multimedia upload UX and derivatives incomplete. |
| 116 | Incident Assignment and Escalation | PARTIAL | Assignment, status, and escalation exist; full incident history workflow incomplete. |
| 117 | Structured Election-Day Reporting | PARTIAL | Legacy/compat report submission works; the target report contract is incomplete. |
| 118 | Pictorial, Video and Information Proof | PARTIAL | All three evidence types supported; the election-report capture UI remains transitional. |
| 119 | Live Result and Reporting Monitoring | PARTIAL | Report, result, and evidence counts surface in the Situation Room; full monitoring and review coverage incomplete. |
| 120 | Report Review and Operational Timeline | COMPLETE | Report review plus a chronological operational timeline endpoint rendered in the Situation Room. |
| 121 | Post-Election Source of Truth | PARTIAL | Evidence source-of-truth foundation is solid; complete Election Day record coverage is not done. |
| 122 | Three Evidence Types | COMPLETE | PHOTO, VIDEO, WRITTEN_REPORT shared and persisted. |
| 123 | Evidence Linked to Events | COMPLETE | Finalization requires a Polling Unit, incident, or election report link. |
| 124 | Evidence Chain of Custody | COMPLETE | Custody events preserve upload, access, review, classification, export, and case actions. Tested. |
| 125 | Cryptographic Evidence Hashing | COMPLETE | Server computes SHA-256 and verifies the stored object hash. Tested. |
| 126 | Original Evidence Preservation | COMPLETE | Storage abstraction denies overwrite; originals separate from derivatives. Tested. |
| 127 | Preview and Streaming Derivatives | BLOCKED | Derivative worker/runtime is explicitly `TARGET_LATER`; requires media processing infrastructure. |
| 128 | Multi-Point Timestamping | COMPLETE | Capture, upload, server receipt, review, and custody timestamps modeled. |
| 129 | Evidence Location Context | COMPLETE | Coordinates, accuracy, territory, and PU context stored when supplied. |
| 130 | Evidence Classification | COMPLETE | Classification enum and review-time updates implemented with UI. |
| 131 | Evidence Review Status | COMPLETE | Review statuses and endpoint with audit and custody. Tested. |
| 132 | Polling Unit Evidence Timeline | COMPLETE | Timeline aggregates activities, incidents, reports, and evidence chronologically. |
| 133 | Polling Unit Evidence Dossier | COMPLETE | Dossier returns PU identity, incidents, reports, evidence, hashes, custody, and draws no legal conclusion. Tested. |
| 134 | Ward and Constituency Evidence Aggregation | COMPLETE | Dedicated aggregation endpoint with Ward/State-Constituency/Federal/Senatorial grouping and UI. Tested. |
| 135 | Evidence Search and Discovery | COMPLETE | Evidence Explorer provides scoped search and filtering by type, classification, and review status. Tested. |
| 136 | Controlled Legal / Evidence Export | PARTIAL | Controlled manifest export and hash verification are implemented and audited; archive/package materialization is `TARGET_LATER`. |
| 137 | Evidence Access Control | COMPLETE | Role- and territory-scoped; unauthorized users receive not-found behavior. Tested. |
| 138 | Evidence Access Audit Trail | COMPLETE | View, download, review, classification, export, and case actions write audit and custody records. |
| 139 | Evidence Retention Policy | BLOCKED | Retention and legal-hold policy require explicit governance approval before implementation. |
| 140 | Post-Election Legal Support Workspace | COMPLETE | Legal-support workspaces, evidence association, notes, manifests, and no-legal-conclusion behavior. Tested. |

## Blockers Preventing Production Readiness

### A. Authoritative data (cannot be solved in code)

Missing an approved Ogun identity release for **LGAs, Wards, Polling Units, and
direct command relationships**. This gates features 004, 010, 011, 012, 013,
021, 025, 068, 069, and 070 — every one of which is implemented and tested
against fixtures, and would move toward COMPLETE the day authoritative data
lands.

Missing an approved **PU geodata release** (latitude, longitude, accuracy,
geofence radius). This gates features 096, 100, and 102. Current code correctly
returns `GATED_AUTHORITATIVE_PU_GEODATA_REQUIRED` rather than fabricating
coordinates.

### B. Governance decisions

- Evidence retention and legal-hold policy (139) needs explicit approval.
- Legacy Candidate/Agent/Admin/Voter compatibility routes (014, 017) remain
  until the target cutover is approved.

### C. Infrastructure not yet stood up

- Redis realtime topology (092, 093, 106 at multi-instance scale).
- Background/scheduled worker for automatic stale-tracking reconciliation (101).
- Media derivative processing runtime (127).
- TURN/Coturn server for voice calling behind carrier-grade NAT. The
  configuration contract and production env validation exist; the server does
  not. Calls connect on permissive networks today.

### D. Remaining product work (code only, no external dependency)

- Call UI component (111).
- Hierarchical dashboards for each command level (059–065).
- Heatmap and drill-down UI (077); leaderboards (078).
- Bonus-rule processing (043) and the full reward event catalog (040).
- Alert/map quick-contact actions (104, 105).
- Target Election Day report contract and capture UI (117, 118).
- Archive/package materialization for evidence export (136).

## What Sprint 3 Changed

Nineteen features moved to COMPLETE against the pre-integration baseline:

```text
015 024 038 039 056 086 091 094 095 097
106 107 108 109 110 112 120 134 135
```

Of these, 110 (In-App Voice Calling) moved from BLOCKED; the other eighteen from
PARTIAL. Feature 111 moved BLOCKED → PARTIAL: permissions, lifecycle
enforcement, and history are done and tested, but the call UI is not built.

BLOCKED count fell from 6 to 4. The four that remain (100, 102, 127, 139) are
all external — two authoritative-geodata, one infrastructure, one governance.
None can be closed by writing more application code.
