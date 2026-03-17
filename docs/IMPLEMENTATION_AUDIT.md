# Implementation Audit

## Scope Of This Audit
This note captures the current production-safe implementation before additional changes. It is intended to identify what already exists, what can be extended safely, what should not be disturbed, and which requested improvements likely need no schema change versus minimal additive schema change.

## What Already Exists

### Dashboard routes and pages
- Admin dashboard exists at `apps/web/app/admin/dashboard/page.tsx`.
- Admin management pages already exist at:
  - `apps/web/app/admin/manage/page.tsx`
  - `apps/web/app/admin/manage/territory/page.tsx`
  - `apps/web/app/admin/manage/users/page.tsx`
  - `apps/web/app/admin/manage/create/page.tsx`
- Admin live operations exists at `apps/web/app/admin/operations/live/page.tsx`.
- Candidate dashboard exists at `apps/web/app/candidate/dashboard/page.tsx`.
- Candidate live tracking exists at `apps/web/app/candidate/operations/live/page.tsx`.
- Agent dashboard exists at `apps/web/app/agent/dashboard/page.tsx`.
- Public candidate discovery already exists at:
  - `apps/web/app/candidates/page.tsx`
  - `apps/web/app/candidates/[candidateUserId]/page.tsx`

### Role-based access logic
- Backend auth middleware already enforces:
  - bearer token authentication
  - active-account check
  - role gating through `requireRole`
- Current implementation is in:
  - `apps/api/src/middleware/auth.ts`
  - `apps/api/src/auth/profile.ts`
- Scope and hierarchy helpers already exist in `apps/api/src/scope.ts`.
- Existing helpers cover:
  - super-admin checks
  - admin checks
  - party alignment checks
  - admin territory checks
  - candidate visibility checks
  - lower-admin management checks
  - agent creation scope checks

### Territory scoping logic
- Territory is already first-class in schema and backend logic.
- Current scope dimensions include:
  - geo-political zone
  - state
  - senatorial district
  - federal constituency
  - state constituency
  - LGA
  - ward
  - polling unit
- Territory validation utilities already exist and are used in create/update/report flows.
- Admin-side scoped user discovery and live operations already follow territory-first flow.

### Admin hierarchy and rank model
- Admin hierarchy already exists in schema via `AdminLevel`.
- Supported levels:
  - `NATIONAL`
  - `GEO_POLITICAL_ZONE`
  - `STATE`
  - `SENATORIAL`
  - `FEDERAL_CONSTITUENCY`
  - `STATE_CONSTITUENCY`
  - `LGA`
  - `WARD`
- Rank comparison and manageability rules are already implemented in `apps/api/src/scope.ts`.

### User management flows
- Admins can already:
  - create admin, candidate, and agent records
  - edit those records
  - assign territory within current backend restrictions
  - set party linkage in the existing create/edit flows
  - activate or deactivate users
  - delete some users through a guarded workflow
- Deletion already has safety protections:
  - no self-delete
  - no super-admin delete
  - deactivation required first
  - dependency counts block deletion when live operational data exists

### Candidate management flows
- Candidate creation and update already exist in admin routes.
- Candidate profile editing already exists in candidate routes/dashboard.
- Candidate public publishing already exists through:
  - `isProfilePublished`
  - public candidate list/detail routes
- Candidate materials already exist:
  - posts
  - images/documents/videos via post media URLs
  - profile portrait asset upload
  - event cover asset upload
  - campaign events
  - broadcasts

### Current party linkage model
- Political party records already exist in schema and reference data flows.
- Party linkage already exists on:
  - `AdminProfile`
  - `CandidateProfile`
  - `AgentProfile`
- Backend already enforces party-bound restrictions in core admin and agent flows.
- Super-admin can manage political party reference data.

### Task and reward system
- Field task model already exists with:
  - status
  - priority
  - due date
  - completion timestamp
  - resolution note
  - territory scope
- Admin can assign single tasks and scoped bulk tasks.
- Agent can view and update tasks.
- Reward system already exists with:
  - `RewardLedger`
  - `RewardRedemption`
  - reward balance utility
  - redemption review fields
- Existing reward model already supports traceability better than a simple balance-only system.

### Reporting flows
- Agent reporting currently includes:
  - check-in
  - check-out
  - location ping
  - incident submission
- Incident escalation already exists in admin routes.
- There is no dedicated structured election-day report model or route yet.
- There is no confirmed current implementation for:
  - arrival photo / post-counting photo workflow
  - top-5-party vote figure capture
  - structured polling-unit election result form

### Upload and media handling flow
- Candidate image uploads already exist with backend validation:
  - JPEG / PNG / WebP only
  - 2 MB request limit
  - binary stored in `CandidateMediaAsset`
- Incident and feedback media metadata attachment exists in `apps/api/src/routes/media.ts`.
- General media attachments currently store metadata and URL references, not binary blobs.
- There is no confirmed dedicated secure upload flow yet for election-day report photos.

### Reference-data and completeness operations
- National state reference bootstrap already exists.
- National polling-unit bootstrap now exists as a controlled manual operations script rather than a deploy-time startup dependency.
- Coverage and polling-unit finder flows can work from authoritative reference tables once that manual bootstrap has been run.
- A dedicated reference-completeness verifier is now the safer operational gap to maintain, rather than forcing heavy remote sync during deploy.

### Agent location and session controls
- Agent login already supports GPS-consent enforcement and one active session per device through a stored session nonce.
- Backend session middleware already invalidates older agent tokens when a newer session is created.
- Agent live tracking already uses device geolocation rather than typed location input.
- A safer next extension point is explicit session revocation and periodic client revalidation, not a rewrite of the activity model.

### Feedback, toasts, and modal utilities
- Frontend currently uses:
  - inline `error` and `message` state
  - `window.confirm` for destructive actions
- There is no shared toast framework or reusable modal system confirmed in the current codebase.
- Notifications exist as backend/user-facing in-app notifications, but not as a frontend toast system.

### Audit trail and logging
- Audit logging utility already exists in `apps/api/src/lib/audit.ts`.
- `AuditLog` model already exists in schema.
- Admin routes already write audit records for many sensitive actions.
- Audit-log read route already exists at `/admin/audit-logs`, but is currently `SUPER_ADMIN` only.
- Existing audit model stores:
  - actor user id
  - action
  - target type
  - target id
  - metadata JSON
  - timestamp
- Territory and party context are not first-class columns yet; they are only available if explicitly included in metadata.

### Relevant schema already present
- Core user models:
  - `User`
  - `AdminProfile`
  - `CandidateProfile`
  - `AgentProfile`
  - `VoterProfile`
- Operations:
  - `FieldTask`
  - `AgentActivity`
  - `Incident`
  - `Feedback`
  - `BroadcastMessage`
  - `Notification`
- Rewards:
  - `RewardLedger`
  - `RewardRedemption`
  - `ParticipationEvent`
  - `VoterEngagementTask`
  - `VoterEngagementClaim`
- Audit and media:
  - `AuditLog`
  - `MediaAttachment`
  - `CandidateMediaAsset`

## What Can Be Extended Safely
- Documentation can be upgraded with no runtime impact.
- Existing `AuditLog` foundation can be extended before introducing any new logging model.
- Existing `/admin/audit-logs` route can be extended or safely exposed to scoped admins later, if backend scope filtering is added.
- Candidate public discovery can be improved safely because public list/detail and publish-state controls already exist.
- Reward accountability can be extended using the existing `RewardLedger` and `RewardRedemption` models.
- Incident governance can be extended from the current `Incident` model and escalation flow.
- Communication targeting can be improved on top of the current `BroadcastMessage` territory fields and audience fields.
- Field intelligence summaries can be built from already available task, incident, polling-unit, agent, and feedback data.

## What Should Not Be Touched Carelessly
- Authentication token and active-account logic in `apps/api/src/middleware/auth.ts`.
- Core territory and hierarchy checks in `apps/api/src/scope.ts`.
- Existing admin create/edit/delete restrictions, especially dependency-aware deletion.
- Current candidate public publish-state logic.
- Existing reward balance calculations until ledger review is fully understood.
- Current live management routes and dashboards unless changes remain additive and scoped.
- Existing migrations and bootstrap flows should not be rewritten or squashed.
- The full national polling-unit bootstrap should not be moved back into deploy startup because it is externally dependent and can cause production timeouts.

## Requested Features That Need No Schema Change
- Phase 1 documentation upgrade.
- Phase 2 audit trail foundation:
  existing `AuditLog` and `createAuditLog` are already in place.
- Phase 3 candidate discovery enhancement:
  public candidate list/detail, published profile state, and candidate asset support already exist.
- Parts of Phase 6 communication targeting:
  `BroadcastMessage` already contains territory scope and audience fields.
- Parts of Phase 7 field intelligence:
  available data already exists for summaries and scoped operational visibility.
- Reference completeness verification and readiness reporting:
  this can be added safely with a read-only report and a manual verifier script without changing schema.

## Requested Features That May Need Minimal Additive Schema Change
- Richer audit visibility by territory or party:
  may benefit from additive `AuditLog` scope columns, but this is not required for an initial safe extension.
- Reward approval lifecycle:
  existing ledger and redemption models may be enough for a first pass, but explicit approval-state history on ledger entries may eventually need additive fields if current logic is insufficient.
- Incident fraud flags and anomaly review:
  likely needs additive fields or a small review model if explainable flags are to be persisted cleanly.
- Election-day structured reporting:
  likely needs a new additive report model rather than overloading `Incident` or `Feedback`.
- Election-day evidence uploads:
  likely needs additive report-linked media handling or a safe extension of current media attachment patterns.
- Richer agent session governance:
  current session nonce fields already exist, so logout and revoke-session controls need no further schema change.

## Safe Recommendations For Later Phases
- Prefer extending `AuditLog` usage and read filtering over creating a second logging system.
- Prefer extending `RewardLedger` and `RewardRedemption` over replacing current reward math.
- Prefer extending `Incident` review and escalation over creating a parallel incident system.
- Prefer additive election-report models instead of repurposing generic feedback records.
- Prefer a shared confirmation/toast abstraction only if it can wrap current UI behavior without changing route behavior.

## Phase 0 Conclusion
The current system already contains significant foundations for:
- RBAC and backend permission checks
- territory-first operations
- party-bound management
- public candidate discovery
- field tasking
- reward ledger and redemption review
- incident escalation
- audit logging

The largest functional gaps relative to the requested roadmap are:
- dedicated election-day structured reporting
- persistent fraud/suspicion classification
- scoped audit-log visibility beyond super admin
- clearer reward approval/accountability UX on top of the existing ledger
