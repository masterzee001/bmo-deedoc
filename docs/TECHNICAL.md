# TECHNICAL.md

# Ogun State Political Organization & Election Operations Platform

## Technical Architecture & Engineering Specification

---

# 1. Purpose

This document defines the engineering architecture for the Ogun State Political Organization & Election Operations Platform.

It translates the locked functional design into technical implementation guidance covering:

* architecture;
* services;
* authentication;
* RBAC;
* territory scope;
* database design;
* voter verification;
* referrals;
* rewards;
* payouts;
* strength analytics;
* field operations;
* real-time infrastructure;
* GPS;
* communications;
* Election Day Situation Room;
* evidence management;
* post-election preservation;
* deployment;
* security;
* scalability;
* testing.

The application operates across:

```text
PRE-ELECTION
ELECTION DAY
POST-ELECTION
```

---

# 2. Engineering Principles

The project must follow these principles:

```text
Reuse before rewriting.
Backend permissions before frontend visibility.
Transactions before mutable balances.
Event history before destructive overwrite.
Private storage before public file URLs.
Server timestamps before client-only timestamps.
Evidence originals before derivatives.
Configuration before hard-coded business rules.
Territory-scoped access by default.
Real-time systems must degrade gracefully.
```

---

# 3. High-Level Architecture

Target-state note:

```text
This diagram is the intended target architecture. Application code and provisioned infrastructure differ.
The checked-in repo implements the Next.js web app, Express API, Prisma database package, and shared package.
Also implemented: the Socket.IO realtime gateway (inside the API process, not a separate service), its Redis adapter and presence writes, the WebRTC signalling and call-lifecycle contract, and the private S3-compatible object-storage pipeline for evidence.
Also implemented: the BullMQ background worker in apps/worker, and the production Docker topology (compose, Dockerfiles, Caddy, Coturn) under deploy/.
Still TARGET: a separately deployed realtime service, and video derivative transcoding.
No production runtime is deployed. Implemented code does not mean a running Redis, bucket, TURN server, or container.
```

```text
                         USERS
                           |
                           v
                 +-------------------+
                 |     NEXT.JS WEB   |
                 |    TypeScript     |
                 +---------+---------+
                           |
               HTTPS / WebSocket / WebRTC
                           |
          +----------------+----------------+
          |                                 |
          v                                 v
+---------------------+          +----------------------+
|     EXPRESS API     |          |   REAL-TIME GATEWAY  |
|     TypeScript      |          | WebSocket/Socket.IO  |
+----------+----------+          +----------+-----------+
           |                                |
           +---------------+----------------+
                           |
                          Redis
                           |
          +----------------+----------------+
          |                |                |
          v                v                v
     PostgreSQL       Background        Presence /
       Prisma           Workers          Live Events
                           |
           +---------------+----------------+
           |                                |
           v                                v
  Private Object Storage             Notifications
    Photos / Videos                 Async Processing
        Evidence
```

Voice:

```text
CLIENT
   |
WebRTC
   |
SIGNALLING
   |
STUN / TURN
   |
REMOTE CLIENT
```

---

# 4. Monorepo Structure

Recommended structure:

```text
TARGET architecture note:
- apps/web and apps/api exist today.
- The realtime gateway is implemented, but it runs inside apps/api on the shared HTTP server. Extracting it into a standalone apps/realtime service is target structure.
- apps/worker is implemented: BullMQ across three queues, backed by a durable BackgroundJob outbox in PostgreSQL.
- packages/auth and packages/config are also target structure until added to the repo.
```

```text
apps/
├── web/
│   └── Next.js frontend
│
├── api/
│   └── Express REST/API application
│
├── realtime/
│   └── WebSocket / Socket.IO gateway
│
└── worker/
    └── background jobs

packages/
├── database/
│   └── Prisma schema, migrations, seeds
│
├── shared/
│   └── types, enums, validation, shared utilities
│
├── auth/
│   └── reusable authorization helpers
│
└── config/
    └── validated environment configuration

docs/
├── MASTER_FEATURES.md
├── TECHNICAL.md
├── RBAC_AND_TERRITORY.md
├── DATABASE_DESIGN.md
├── PRE_ELECTION.md
├── ELECTION_DAY.md
├── POST_ELECTION_EVIDENCE.md
├── REWARDS_AND_PAYOUTS.md
├── REALTIME_AND_COMMUNICATIONS.md
├── SECURITY.md
├── DEPLOYMENT.md
└── IMPLEMENTATION_ROADMAP.md
```

---

# 5. Authentication Model

Recommended high-level roles:

```text
SUPER_ADMIN
STATE_OFFICER
COORDINATOR
VALIDATOR
PAYOUT_OFFICER
MEMBER
```

Do not create a standalone authentication role for every coordinator level.

Instead:

```text
COORDINATOR
+
CoordinatorLevel
```

Recommended coordinator levels:

```text
SENATORIAL_DISTRICT
FEDERAL_CONSTITUENCY
STATE_CONSTITUENCY
WARD
POLLING_UNIT
```

---

# 6. Candidate Architecture

Candidate is a domain entity, not an authenticated role.

Suggested model:

```text
Candidate
--------
id
fullName
officeType
politicalPartyId
electionId
photoUrl
slogan
bio
stateId
senatorialDistrictId?
federalConstituencyId?
stateConstituencyId?
isActive
createdAt
updatedAt
```

Campaign officers may be linked using:

```text
CampaignOfficerAssignment
-------------------------
id
candidateId
userId
responsibility
stateId?
senatorialDistrictId?
federalConstituencyId?
stateConstituencyId?
wardId?
pollingUnitId?
createdAt
```

Do not require:

```text
Candidate.password
Candidate.login
CandidateAuthRole
```

---

# 7. Territory Architecture

Operational command:

```text
STATE
  |
SENATORIAL DISTRICT
  |
FEDERAL CONSTITUENCY
  |
STATE CONSTITUENCY
  |
WARD
  |
POLLING UNIT
```

LGA remains:

```text
GEOGRAPHIC / ELECTORAL REFERENCE
```

It may still be associated with:

* Ward;
* Polling Unit;
* voter/member;
* reports;
* search;
* analytics.

But LGA does not grant command authority.

---

# 8. Authorization Engine

Every protected request must be evaluated by the backend.

Authorization context:

```text
user.role
user.accountStatus
coordinator.level
assignedTerritory
resourceTerritory
requestedAction
```

Conceptually:

```text
authorize(
    user,
    action,
    resource,
    territory
)
```

Frontend visibility is convenience only.

The API remains authoritative.

---

# 9. Account Status

Recommended:

```text
ACTIVE
INACTIVE
SUSPENDED
```

Suspended/inactive users should be denied protected functionality regardless of valid tokens.

---

# 10. Member Model

Suggested member profile fields:

```text
MemberProfile
-------------
id
userId
phone
stateId
senatorialDistrictId?
federalConstituencyId?
stateConstituencyId?
lgaId?
wardId?
pollingUnitId?
referredByUserId?
referralCodeUsed?
createdAt
updatedAt
```

Sensitive or unnecessary personal data should not be collected without a defined operational purpose.

---

# 11. Voter Verification

Recommended enum:

```text
VoterVerificationStatus

NOT_SUBMITTED
PENDING
UNDER_REVIEW
RESUBMISSION_REQUIRED
VERIFIED
REJECTED
```

Suggested model:

```text
VoterVerification
-----------------
id
memberUserId
status
submittedAt?
reviewStartedAt?
reviewedAt?
reviewedByUserId?
reviewNote?
createdAt
updatedAt
```

Document:

```text
VoterVerificationDocument
-------------------------
id
verificationId
originalStorageKey
previewStorageKey?
originalFileName
mimeType
fileSize
sha256
uploadedAt
```

---

# 12. Verification Permissions

Validator may:

```text
VIEW_PENDING
CLAIM_REVIEW
APPROVE
REJECT
REQUEST_RESUBMISSION
ADD_REVIEW_NOTE
```

Validator may not:

```text
CHANGE_REWARD_RULE
CHANGE_PAYOUT_RULE
CREATE_ARBITRARY_POINTS
CHANGE_REFERRER
CHANGE_TERRITORY
PROCESS_PAYOUT
```

---

# 13. Verification-to-Reward Event

Core invariant:

```text
REGISTRATION != REWARD
```

Correct sequence:

```text
REGISTERED
    |
PENDING_VERIFICATION
    |
VALIDATOR APPROVAL
    |
VERIFIED
    |
REFERRAL QUALIFIED
    |
REWARD EVENT
    |
LEDGER ENTRIES
```

This should be implemented transactionally.

---

# 14. Referral Architecture

Suggested model:

```text
Referral
--------
id
referredUserId
referrerUserId
referralCode
status
registeredAt
qualifiedAt?
rewardProcessedAt?
flaggedAt?
createdAt
updatedAt
```

Suggested statuses:

```text
REGISTERED
PENDING_VERIFICATION
QUALIFIED
REJECTED
FLAGGED
REWARD_PROCESSED
```

A referred user must have only one qualifying referral relationship.

---

# 15. Referral Roll-Up

When a verified member qualifies, the system may calculate organizational attribution through:

```text
POLLING UNIT
    |
WARD
    |
STATE CONSTITUENCY
    |
FEDERAL CONSTITUENCY
    |
SENATORIAL DISTRICT
    |
STATE
```

Direct and network registrations must remain distinguishable.

---

# 16. Reward Rule Architecture

Suggested models:

```text
RewardRule
RewardRuleVersion
RewardEvent
RewardLedgerEntry
```

RewardRule example fields:

```text
id
name
qualifyingEvent
eligibleRole
eligibleCoordinatorLevel?
active
effectiveFrom
effectiveUntil?
createdByUserId
```

RewardRuleVersion:

```text
id
rewardRuleId
version
directPoints
upstreamPointsConfig
maximumPoints?
createdAt
```

Historical ledger entries reference the exact rule version used.

---

# 17. Reward Event

Example qualifying event:

```text
VOTER_VERIFICATION_APPROVED
```

Processing:

```text
Event
  |
Load applicable rule version
  |
Determine eligible recipients
  |
Create unique ledger transactions
```

Reward processing must be idempotent.

A unique constraint should prevent the same reward event from being paid twice.

---

# 18. Reward Ledger

Suggested:

```text
RewardLedgerEntry
-----------------
id
userId
points
type
sourceEventType
sourceEventId
rewardRuleVersionId?
relatedUserId?
description?
createdAt
```

Balance is calculated from ledger entries.

Do not treat:

```text
user.points = 5000
```

as the primary financial source of truth.

Cached balances may exist only as rebuildable projections.

---

# 19. Bonus System

Bonus points must be generated through:

```text
BonusRule
+
Qualifying system event
```

Payout Officers cannot award bonus points.

---

# 20. Payout Architecture

Suggested models:

```text
PayoutConfiguration
PayoutCycle
PayoutBatch
PayoutAssignment
PayoutTransaction
```

---

# 21. Payout Configuration

Possible configuration:

```text
minimumPoints
pointConversionRate
frequency
nextPayoutDate
active
createdBy
updatedAt
```

Configuration changes should be versioned or auditable.

---

# 22. Payout Cycle

Example:

```text
PayoutCycle
-----------
id
name
opensAt
closesAt
payoutDate
minimumThreshold
conversionRate
status
```

---

# 23. Payout Batch

```text
PayoutBatch
-----------
id
payoutCycleId
status
createdAt
approvedAt?
```

Batch contains beneficiaries determined by system eligibility.

---

# 24. Payout Assignment

```text
PayoutAssignment
----------------
id
payoutBatchId
payoutOfficerUserId
beneficiaryUserId
points
amount
status
assignedAt
processedAt?
```

Payout officer access must be limited to assigned records.

---

# 25. Pre-Election Strength Engine

Strength should not be permanently calculated only at request time.

Use metric snapshots.

Suggested models:

```text
StrengthMetricDefinition
StrengthWeightConfiguration
TerritoryTarget
TerritoryMetricSnapshot
TerritoryStrengthSnapshot
```

---

# 26. Strength Metric Examples

Potential inputs:

```text
VERIFIED_MEMBER_RATIO
COORDINATOR_COVERAGE
POLLING_UNIT_COVERAGE
REFERRAL_GROWTH
RECENT_FIELD_ACTIVITY
TASK_COMPLETION
READINESS_SCORE
```

Weights are configurable.

---

# 27. Strength Snapshot

```text
TerritoryStrengthSnapshot
-------------------------
id
territoryType
territoryId
candidateId?
score
breakdownJson
calculatedAt
```

Snapshots allow historical trend analysis.

---

# 28. Campaign Target Model

```text
CampaignTarget
--------------
id
candidateId?
territoryType
territoryId
metric
targetValue
startDate
endDate?
createdBy
```

Dashboard shows:

```text
TARGET
ACTUAL
PERCENTAGE
SHORTFALL
```

---

# 29. Field Tasks

Suggested:

```text
FieldTask
---------
id
title
description
priority
status
creatorUserId
assigneeUserId?
territoryType
territoryId
dueAt?
completedAt?
```

Status:

```text
TODO
IN_PROGRESS
BLOCKED
DONE
```

---

# 30. Field Activity

Suggested activity types:

```text
CHECK_IN
CHECK_OUT
LOCATION_PING
OUTREACH
MATERIAL_DISTRIBUTION
OBSERVATION
INCIDENT_RESPONSE
TASK_ACTIVITY
```

---

# 31. Real-Time Infrastructure

Recommended:

```text
Socket.IO / WebSocket
+
Redis Pub/Sub
```

Redis is used for:

* connection coordination;
* distributed event fan-out;
* presence;
* Situation Room updates;
* live alerts;
* chat;
* tracking events;
* lightweight transient state.

Do not assume only one backend instance.

---

# 32. Event Naming

Use structured event names such as:

```text
election.checkin.created
election.location.updated
election.tracking.stale
election.location.mismatch
election.incident.created
election.incident.updated
election.report.submitted
election.report.reviewed
election.result.submitted
message.created
call.ringing
call.connected
call.ended
```

Events should include territory identifiers so subscriptions can remain scoped.

---

# 33. Election Day Location Session

Suggested:

```text
LocationSession
---------------
id
userId
pollingUnitId
deviceNonce
startedAt
endedAt?
lastPingAt?
status
```

Only one active authorized session per Polling Unit Coordinator where required.

---

# 34. Location Ping

```text
LocationPing
------------
id
sessionId
latitude
longitude
accuracyMeters
capturedAt
serverReceivedAt
```

Retention strategy may differ between raw pings and important operational events.

---

# 35. Geofence

```text
PollingUnit
-----------
latitude
longitude
geofenceRadiusMeters
```

Evaluation:

```text
distance(currentLocation, pollingUnitLocation)
```

Result may create:

```text
IN_RANGE
OUT_OF_RANGE
LOCATION_UNKNOWN
```

---

# 36. Tracking Alerts

Suggested alert types:

```text
NO_CHECK_IN
TRACKING_STOPPED
LOCATION_STALE
LOCATION_MISMATCH
GPS_PERMISSION_DISABLED
DEVICE_SESSION_CHANGED
REPORT_OVERDUE
```

Alert records should support:

```text
OPEN
ACKNOWLEDGED
ESCALATED
RESOLVED
```

---

# 37. Election Situation Room

Situation Room queries should provide:

* total expected Polling Units;
* checked-in coordinators;
* missing coordinators;
* opened on time;
* opened late;
* not opened;
* incident counts;
* critical incident counts;
* tracking alerts;
* reports received;
* reports outstanding;
* results received;
* evidence received;
* completion percentages.

Aggregations must be territory-scoped.

---

# 38. Live Map

Map data should include only operationally necessary fields:

```text
pollingUnitId
pollingUnitName
latitude
longitude
coordinatorId?
status
lastLocation?
lastSeenAt?
openIncidentCount
```

Avoid sending unnecessary sensitive data into map payloads.

---

# 39. Messaging Architecture

Suggested models:

```text
Conversation
ConversationMember
Message
MessageAttachment
MessageReceipt
PresenceSession
```

Conversation types:

```text
DIRECT
GROUP
TERRITORY
ELECTION_OPERATION
```

---

# 40. Message Permission

Before a message is sent, backend verifies:

```text
sender role
sender territory
recipient role
recipient territory
organizational relationship
account status
```

Messaging is not an unrestricted public network.

---

# 41. In-App Voice Calling

Recommended implementation:

```text
WebRTC
+
Signalling over Socket.IO/WebSocket
+
STUN
+
TURN
```

Do not implement NAT traversal manually.

Production requires TURN fallback.

---

# 42. Call Models

```text
CallSession
-----------
id
conversationId?
initiatorUserId
status
startedAt
connectedAt?
endedAt?

CallParticipant
---------------
callSessionId
userId
joinedAt?
leftAt?
```

Statuses:

```text
OUTGOING
RINGING
CONNECTED
ENDED
DECLINED
MISSED
FAILED
```

Store call metadata.

Do not automatically record voice content.

---

# 43. Incident Architecture

Suggested:

```text
Incident
--------
id
reporterUserId
pollingUnitId
type
severity
status
title
description
latitude?
longitude?
reportedAt
assignedUserId?
escalatedAt?
```

Types may include:

```text
VIOLENCE
INTIMIDATION
MATERIAL_SHORTAGE
LOGISTICS_DELAY
MALFUNCTION
SECURITY_CONCERN
OTHER
```

---

# 44. Election Day Report

Suggested model:

```text
ElectionDayReport
-----------------
id
pollingUnitId
coordinatorUserId
reportDate
arrivalConfirmedAt?
openingStatus
turnoutObservation?
incidentNotes?
remarks?
resultData?
status
submittedAt
reviewedAt?
reviewedByUserId?
reviewNote?
```

---

# 45. Evidence Architecture

Evidence must be modeled separately from generic media.

Suggested:

```text
EvidenceAsset
-------------
id
evidenceType
classification
originalStorageKey
previewStorageKey?
thumbnailStorageKey?
originalFileName
mimeType
fileSize
sha256
capturedAt?
uploadedAt
serverReceivedAt
latitude?
longitude?
accuracyMeters?
uploaderUserId
pollingUnitId?
incidentId?
electionReportId?
createdAt
```

---

# 46. Evidence Types

```text
PHOTO
VIDEO
WRITTEN_REPORT
```

Possible classifications:

```text
ARRIVAL
OPENING
MATERIALS
SECURITY
INCIDENT
VOTING_PROCESS
COUNTING
RESULT_SHEET
POST_COUNTING
OTHER
```

---

# 47. Evidence Upload Pipeline

Recommended process:

```text
Client requests upload
        |
Authorization check
        |
Secure upload created
        |
Original received
        |
Server computes SHA-256
        |
Metadata persisted
        |
Original marked immutable
        |
Derivative job queued
        |
Thumbnail / preview generated
```

Never trust a client-supplied hash as the authoritative evidence hash.

---

# 48. Original Evidence

Original evidence must not be modified after acceptance into the evidence repository.

If corrected evidence is supplied:

```text
NEW EVIDENCE ITEM
```

or:

```text
SUPPLEMENTARY VERSION
```

should be created.

Do not overwrite the original.

---

# 49. Evidence Storage

Use private S3-compatible object storage.

Suggested buckets/logical prefixes:

```text
voter-verification/
election-evidence/original/
election-evidence/preview/
election-evidence/thumbnail/
exports/
```

Public permanent evidence URLs should not exist.

Use short-lived signed access.

---

# 50. Evidence Custody Events

Suggested model:

```text
EvidenceCustodyEvent
--------------------
id
evidenceAssetId
actorUserId
eventType
metadataJson?
createdAt
```

Events:

```text
UPLOADED
VIEWED
REVIEWED
CLASSIFIED
DOWNLOADED
EXPORTED
ADDED_TO_CASE
```

---

# 51. Polling Unit Evidence Timeline

Timeline is constructed from:

```text
check-in
location events
opening report
incidents
communications metadata
evidence uploads
counting reports
result submission
review events
```

All events should use server-normalized timestamps.

---

# 52. Evidence Dossier

A Polling Unit dossier may aggregate:

* Polling Unit identity;
* assigned coordinator;
* check-in;
* location history;
* reports;
* incidents;
* photos;
* videos;
* information reports;
* communications metadata;
* results;
* review notes;
* hashes;
* custody records.

---

# 53. Legal Support Workspace

Suggested:

```text
LegalCase
CaseEvidence
CaseNote
EvidencePackage
EvidencePackageItem
EvidenceManifest
```

The system organizes evidence.

It does not make legal conclusions.

---

# 54. Evidence Export

Exports should produce:

```text
Evidence Package
├── manifest.json / manifest.pdf
├── reports/
├── photos/
├── videos/
├── metadata/
└── hashes/
```

Manifest should identify:

* evidence ID;
* type;
* hash;
* Polling Unit;
* timestamp;
* uploader;
* related incident/report.

Export itself should be audited.

---

# 55. Audit Architecture

Audit categories:

```text
SYSTEM
AUTH
ADMINISTRATION
VERIFICATION
FINANCIAL
ELECTION_OPERATION
EVIDENCE
SECURITY
```

Suggested model:

```text
AuditLog
--------
id
actorUserId?
category
action
targetType
targetId?
territoryType?
territoryId?
metadataJson?
createdAt
```

---

# 56. Notifications

Notifications should support:

```text
IN_APP
EMAIL
SMS
PUSH
```

Not all channels need to be enabled initially.

Notification events include:

* verification approved;
* resubmission required;
* reward earned;
* payout eligibility;
* payout processed;
* task assigned;
* incident assigned;
* tracking alert;
* message;
* missed call;
* election report status.

---

# 57. Background Workers

Workers should process jobs such as:

```text
reward processing
bonus processing
payout eligibility
thumbnail generation
video processing
evidence hashing
notifications
export generation
analytics snapshots
cleanup
```

Use queues where long-running work must not block API requests.

---

# 58. Docker Architecture

```text
TARGET architecture note:
Docker is the locked service-packaging standard for the target production architecture.
The full repo-wide production Docker topology is TARGET architecture until the container assets, health checks, restart policies, logging, monitoring, and service code are implemented.
As of August 9, 2026, only the checked-in services and development/test database support should be treated as implemented.
```

Target production containers:

```text
reverse-proxy
web
api
realtime
worker
postgres
redis
```

Optional local-only support services may include:

```text
minio
mailhog
```

Private S3-compatible object storage may be external or separately hosted. It must remain independent from the application filesystem and must not be replaced by ephemeral container-local uploads.

Next.js may run locally through Node/npm for faster frontend development, but production packaging targets a containerized web service behind Nginx or Caddy.

---

# 59. Docker Compose

```text
TARGET architecture note:
Docker Compose may be used initially for single-VPS production orchestration.
The full production compose workflow remains TARGET architecture until the referenced Docker assets, secrets handling, volumes, backups, health checks, restart policies, logging, and monitoring exist.
```

Expected production orchestration shape:

```text
Internet
   |
   v
Nginx / Caddy
   |
   v
Docker / Docker Compose
   |
   +-- Next.js Web
   +-- Express API + Socket.IO
   +-- BullMQ Worker
   +-- PostgreSQL
   +-- Redis
```

Expected developer experience, once implemented:

```bash
npm install
docker compose up -d
npm run prisma:generate
npm run prisma:migrate
npm run seed
npm run dev:web
```

The exact scripts should be standardized before implementation begins.

---

# 60. Docker Files

```text
STATUS:
These files exist and build. Nothing is deployed: no VPS is provisioned, and no
image has been published or run outside local validation.
```

Implemented:

```text
deploy/docker/web.Dockerfile
deploy/docker/api.Dockerfile
deploy/docker/worker.Dockerfile

docker-compose.dev.yml      PostgreSQL only, development/test
docker-compose.prod.yml     full single-VPS production topology
deploy/caddy/Caddyfile
deploy/coturn/turnserver.conf.template
deploy/coturn/entrypoint.sh
.dockerignore
```

There is deliberately no `apps/realtime` Dockerfile. Socket.IO runs inside the
API process, so the realtime gateway ships in the API image. Extracting it into
a standalone service remains target structure, not current topology.

Images are Debian slim rather than Alpine: the Prisma engines and sharp are
native, glibc-linked builds, and the musl variants buy only image size.

Operations procedures are documented in `docs/DEPLOYMENT_VPS.md`.

---

# 61. Environment Validation

Configuration should be centrally validated on process startup.

Do not access arbitrary:

```javascript
process.env.X
```

throughout the application.

Use a validated config package.

Example groups:

```text
database
auth
redis
storage
maps
realtime
webrtc
notifications
security
observability
```

---

# 62. Example Environment Variables

```env
NODE_ENV=development

DATABASE_URL=

JWT_SECRET=
JWT_EXPIRES_IN=

REDIS_URL=

STORAGE_ENDPOINT=
STORAGE_REGION=
STORAGE_BUCKET=
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=

MAP_PROVIDER_KEY=

TURN_URL=
TURN_USERNAME=
TURN_CREDENTIAL=

NEXT_PUBLIC_API_BASE_URL=
NEXT_PUBLIC_REALTIME_URL=
```

Never commit actual production credentials.

---

# 63. Database Transactions

Critical operations that must be transactional include:

* verification approval;
* referral qualification;
* reward creation;
* payout eligibility creation;
* payout completion;
* territory reassignment where dependent data is affected;
* evidence registration where chain-of-custody metadata must accompany upload acceptance.

---

# 64. Database Constraints

Use database-level protection where possible.

Examples:

```text
unique referral qualification
unique reward event processing
unique payout transaction reference
unique active assignment where appropriate
unique voter identifier where legally/operationally justified
unique evidence asset ID
```

Application checks alone are insufficient.

---

# 65. Caching

Redis may cache:

* dashboard aggregates;
* real-time presence;
* temporary access;
* Situation Room statistics;
* rate-limit counters.

Do not treat cache as authoritative data.

PostgreSQL remains the durable source of truth.

---

# 66. Performance

Election Day is the peak-load condition.

Design for:

* burst location updates;
* simultaneous report submissions;
* media upload concurrency;
* dashboard fan-out;
* real-time alerts;
* messaging;
* voice signaling.

Large files should not pass unnecessarily through application memory.

Prefer direct secure object-storage uploads where architecture permits.

---

# 67. Media Processing

Video processing should occur asynchronously.

Possible tasks:

```text
metadata extraction
thumbnail generation
preview generation
transcoding
integrity validation
```

Original files remain untouched.

---

# 68. Failure Handling

Real-time failure must not prevent core reporting.

If WebSocket is unavailable:

```text
REST submission still works.
```

If voice fails:

```text
text messaging and formal incident reporting remain available.
```

If media upload is slow:

```text
report may preserve draft/upload state where safe.
```

Design graceful degradation.

---

# 69. Observability

Production should include:

```text
structured logs
error tracking
API metrics
worker metrics
WebSocket connection metrics
database health
Redis health
upload failures
queue depth
security events
```

Election Day requires a dedicated operations monitoring dashboard.

---

# 70. Backup & Recovery

Backups should cover:

```text
PostgreSQL
Object Storage
Configuration
Evidence Metadata
Audit Records
```

Evidence-original retention and database recovery must be tested before Election Day.

---

# 71. Security Controls

Minimum technical security:

* TLS everywhere;
* secure password hashing;
* token/session expiration;
* refresh/session management where applicable;
* backend RBAC;
* territory authorization;
* input schema validation;
* file MIME validation;
* upload limits;
* anti-malware scanning where feasible;
* rate limiting;
* brute-force protection;
* audit logging;
* private object storage;
* signed media URLs;
* encryption at rest where supported;
* encryption in transit;
* secret rotation;
* database backups;
* evidence integrity verification.

---

# 72. Sensitive Data Separation

Sensitive information should be logically separated.

A normal coordinator should receive:

```text
Member verified: YES
```

not:

```text
full voter-card image URL
```

Actual documents are available only to explicitly authorized validation/security roles.

---

# 73. Testing Strategy

Required layers:

```text
unit tests
integration tests
API tests
authorization tests
database transaction tests
real-time tests
GPS/geofence tests
evidence pipeline tests
reward/payout integrity tests
end-to-end tests
load tests
security tests
field simulations
```

---

# 74. RBAC Testing

Create test matrices such as:

```text
Ward Coordinator
CAN access own Ward
CANNOT access another Ward

State Constituency Coordinator
CAN access subordinate Wards
CANNOT access unrelated State Constituency

Validator
CAN view assigned verification evidence
CANNOT change reward rules

Payout Officer
CAN process assigned payouts
CANNOT change payout threshold
```

---

# 75. Election Day Simulation

Before production Election Day, simulate:

* thousands of simultaneous check-ins;
* GPS updates;
* stale-location events;
* geofence alerts;
* hundreds of incidents;
* media uploads;
* report spikes;
* message bursts;
* voice signaling;
* Situation Room updates;
* database failover/restart scenarios.

---

# 76. Migration Strategy

Do not rewrite the existing codebase wholesale.

Recommended sequence:

```text
1. Audit current reusable modules.
2. Introduce new roles/levels.
3. Refactor territory authorization.
4. Remove candidate authentication dependency.
5. Convert Agent functionality into Polling Unit Coordinator functionality.
6. Add voter verification.
7. Refactor referral/reward pipeline.
8. Add delegated payout system.
9. Build strength analytics.
10. Add real-time infrastructure.
11. Build Election Situation Room.
12. Add operational messaging/calling.
13. Expand evidence pipeline.
14. Add post-election evidence workspace.
15. Harden and test.
```

---

# 77. Existing Components to Reuse

Where sound, retain:

```text
Next.js structure
Express API
Prisma
PostgreSQL
authentication utilities
existing territory tables
existing reward-ledger ideas
incident models
field activity concepts
Election Day reporting foundations
admin dashboard patterns
notification foundations
audit logging foundations
deployment scripts
```

---

# 78. Existing Components to Refactor

Refactor:

```text
national scope
AdminLevel architecture
candidate authentication
Agent role/profile
voter-only naming
referral qualification
redemption workflow
media handling
territory authorization
dashboard aggregation
```

---

# 79. Existing Components to Add

New major systems:

```text
State Validator workflow
secure voter-document pipeline
RewardRule versioning
Payout Officer assignments
Strength Engine
historical strength snapshots
Redis
real-time gateway
presence
GPS geofence alerts
Election Situation Room
in-app chat
WebRTC calling
EvidenceAsset
evidence hashing
custody events
Evidence Dossier
Legal Case Workspace
Evidence Package Export
```

---

# 80. Deployment

Locked production deployment target:

```text
PRODUCTION DEPLOYMENT TARGET:
VPS
```

Target production architecture:

```text
Internet
   |
   v
Nginx / Caddy
   |
   v
Docker / Docker Compose
   |
   +-- Next.js Web
   +-- Express API + Socket.IO
   +-- BullMQ Worker
   +-- PostgreSQL
   +-- Redis
```

Nginx or Caddy terminates HTTPS and reverse-proxies HTTP/WebSocket traffic to the application services. Docker is the service-packaging standard. Docker Compose may be used initially for single-VPS production orchestration.

The architecture must permit future migration from one VPS to multiple servers without redesigning the application. Services may initially share infrastructure, but service boundaries, environment configuration, health checks, storage boundaries, and event contracts must allow later separation.

Production secrets must come from production environment configuration and must never be committed. The production topology must support health checks, restart policies, structured logging, monitoring, alerting, persistent PostgreSQL storage, Redis configuration appropriate to its workloads, and backup/restore procedures.

GitHub Actions `CI / validate` remains required for repository validation and is separate from production hosting.

Existing Render and Vercel configuration may remain temporarily for legacy compatibility, but Render and Vercel are legacy/non-target production deployment paths.

---

# 81. Frontend Deployment

Next.js is packaged as the target production web container and served behind Nginx or Caddy on the VPS deployment.

It communicates with:

```text
API_BASE_URL
REALTIME_URL
```

Vercel may remain as a legacy compatibility path while transition work is underway, but it is not the locked production hosting target.

---

# 82. Backend Deployment

Backend services must be packaged through Docker for the target production architecture.

Target backend services:

```text
Express API
Realtime Gateway / Socket.IO
BullMQ Worker
```

These services run behind the VPS reverse proxy and share durable infrastructure through PostgreSQL, Redis, and private object storage contracts.

Render configuration may remain temporarily for legacy compatibility, but Render is not the production target.

---

# 83. Database

PostgreSQL runs as part of the target VPS architecture or on a separately operated database host when capacity requires it.

Required capabilities:

* automated backups;
* point-in-time recovery where available;
* connection pooling;
* monitoring;
* production migration discipline.
* persistent data volumes or equivalent durable storage;
* tested restore procedures.

---

# 84. Redis

Redis runs as part of the target VPS architecture or on a separately operated Redis host when capacity requires it.

Redis must be configured appropriately for its workloads:

* BullMQ queue state;
* Socket.IO adapter fan-out;
* rate coordination;
* cache;
* transient presence.

Redis must not become the only store for durable business data.

Implementation status: the Socket.IO Redis adapter and presence writes are
implemented in the API. BullMQ queue state is not — there is no worker runtime.
**No Redis server is provisioned.** With `REDIS_URL` unset the gateway reports
`DEGRADED_NO_REDIS` and serves single-instance realtime over the REST fallback;
`REALTIME_REDIS_REQUIRED=true` makes production fail closed instead.

---

# 85. Object Storage

Use production-grade S3-compatible private storage.

Possible providers include:

```text
AWS S3
Cloudflare R2
Backblaze B2
other compatible providers
```

Architecture should minimize provider lock-in.

Object storage must remain architecturally independent from the application filesystem. Application containers must not store voter documents or election evidence on ephemeral local container disks.

Implementation status: the private S3-compatible pipeline is implemented
(`apps/api/src/storage/evidence-storage.ts`) with AWS SigV4 request signing,
write-if-absent overwrite denial, server-generated SHA-256, and presigned reads.
Production environment validation rejects any driver other than `s3`; the
in-memory driver is restricted to development and tests. **No production bucket
is provisioned**, so the pipeline is implemented but not yet operating against
real storage.

---

# 86. WebRTC Infrastructure

Voice calling requires:

```text
signalling
STUN
TURN
```

TURN must be available for users behind restrictive networks.

Implemented today: signalling over the Socket.IO gateway, the durable call
lifecycle in PostgreSQL (`VoiceCall`, `VoiceCallParticipant`, `VoiceCallEvent`),
ICE server configuration served from `GET /election-day/webrtc/config`, a STUN
default, and production environment validation that requires `TURN_URL`,
`TURN_USERNAME`, and `TURN_CREDENTIAL`.

**Not operational: there is no Coturn (or any TURN) server deployed.** The
configuration contract reports `turnConfigured: false` when TURN credentials are
absent rather than implying reachability. Until a TURN service is provisioned,
calls connect only on permissive networks and must not be described as working
for field devices behind carrier-grade NAT.

Calls are never recorded. No media is persisted; only the signal type is retained
for accountability.

---

# 87. API Versioning

Consider:

```text
/api/v1/
```

for stable external frontend/backend contracts.

Major breaking changes should not silently alter production clients.

---

# 88. Shared Validation

Use shared schemas for request validation where appropriate.

Examples:

```text
Zod
shared TypeScript contracts
```

Frontend types must not substitute for backend validation.

---

# 89. Time Handling

Store server timestamps in UTC.

Display in the appropriate local timezone.

Evidence should preserve:

* capture timestamp where available;
* server receipt timestamp;
* upload timestamp;
* review timestamp.

Server receipt is the platform-authoritative timestamp.

---

# 90. Data Retention

Define separate retention policies for:

```text
routine logs
GPS raw pings
chat metadata
verification documents
Election Day evidence
financial transactions
audit records
```

Election evidence should receive stronger retention than transient operational telemetry.

---

# 91. Privacy

Only collect data required for defined functionality.

Access must follow least privilege.

Sensitive verification records and election evidence require special access controls.

---

# 92. Locked Business Integrity Rules

The implementation must preserve:

```text
NO REWARD BEFORE VERIFICATION

NO DUPLICATE REFERRAL REWARD

NO DUPLICATE PAYOUT

NO PAYOUT-OFFICER REWARD CONTROL

NO VALIDATOR REWARD CONTROL

NO SILENT LEDGER EDITS

NO SILENT EVIDENCE REPLACEMENT

NO CANDIDATE LOGIN REQUIREMENT

NO LGA COMMAND AUTHORITY

NO VOTE-CHOICE REWARD
```

---

# 93. Development Philosophy

The four senior developers should be able to work independently against defined domain boundaries.

Suggested ownership:

```text
Developer 1
Platform architecture, auth, RBAC, territory, integration

Developer 2
Pre-Election, verification, referrals, rewards, payouts, analytics

Developer 3
Election Day, realtime, GPS, Situation Room, communications

Developer 4
Evidence, storage, post-election, audit, exports, security
```

Shared code contracts must be agreed early.

---

# 94. Definition of Done

A feature is not done because the UI exists.

A feature is done when:

```text
UI implemented
API implemented
authorization enforced
database constraints implemented
validation implemented
errors handled
audit requirements implemented
tests passing
mobile behavior verified
documentation updated
acceptance criteria passed
```

---

# 95. Source of Truth

Functional source of truth:

```text
MASTER LOCKED 140-FEATURE DESIGN
```

Technical source of truth:

```text
README.md
docs/TECHNICAL.md
database schema
approved architecture decision records
```

When implementation conflicts with a locked product decision, the discrepancy must be reviewed rather than silently changing the product behavior.

---

# 96. Final Technical Direction

The system should evolve from the existing PICS codebase through:

```text
REUSE
    ↓
REFACTOR
    ↓
EXTEND
    ↓
HARDEN
```

not:

```text
DELETE EVERYTHING
    ↓
START FROM ZERO
```

The target is a secure, scalable, constituency-first Ogun State platform capable of supporting:

```text
PRE-ELECTION CAMPAIGN STRENGTH
        ↓
REAL-TIME ELECTION DAY OPERATIONS
        ↓
POST-ELECTION SOURCE OF TRUTH & EVIDENCE
```
