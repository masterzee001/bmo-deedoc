# Ogun State Political Organization & Election Operations Platform

## Master README

### Project Status

This repository contains the Ogun State version of the Political Organization & Election Operations Platform.

The platform is designed specifically for Ogun State and is organized around three operating periods:

1. **Pre-Election — Build Campaigning Strength**
2. **Election Day — Efficient & Effective Operations**
3. **Post-Election — Source of Truth & Evidence Layer**

The system is constituency-first, mobile-first, role-controlled, territory-aware, evidence-focused, and designed for real-time Election Day operations.

This project is derived from the original PICS platform architecture but is being substantially refactored for Ogun State operations.

---

# 1. Platform Purpose

The platform provides one connected operating system for:

* grassroots campaign organization;
* verified member registration;
* voter-registration evidence validation;
* coordinator management;
* referral tracking;
* configurable reward points;
* delegated payout operations;
* pre-election campaign-strength measurement;
* Polling Unit readiness;
* Ward and Constituency performance;
* Election Day coordinator tracking;
* real-time Election Situation Room monitoring;
* in-app operational messaging;
* in-app voice calling;
* incident management;
* Election Day reporting;
* photographic evidence;
* video evidence;
* structured information reports;
* evidence preservation;
* evidence chain of custody;
* post-election investigation;
* controlled evidence export;
* legal-support evidence organization where required.

---

# 2. The Three Operating Categories

## 2.1 Pre-Election

### Purpose

Build, measure, monitor and improve campaigning strength before Election Day.

Core functions include:

* member registration;
* voter-card upload;
* State Validator review;
* verification status management;
* referral codes and referral links;
* verification-gated referral rewards;
* hierarchical referral statistics;
* configurable points rules;
* immutable reward ledger;
* payout eligibility;
* delegated payout officers;
* Polling Unit strength;
* Ward strength;
* State Constituency strength;
* Federal Constituency strength;
* Senatorial District strength;
* Ogun State strength;
* campaign targets;
* target-vs-actual tracking;
* trend analysis;
* field tasks;
* coordinator activity;
* coverage intelligence;
* performance dashboards;
* strength heatmaps;
* operational broadcasts.

The central pre-election question is:

> How strong is the campaign structure, where are the weaknesses, and what must be improved before Election Day?

---

## 2.2 Election Day

### Purpose

Provide efficient and effective real-time Election Day operations.

Core functions include:

* Polling Unit Coordinator check-in;
* live GPS tracking;
* geofence monitoring;
* stale-location detection;
* tracking-loss alerts;
* location-mismatch alerts;
* Election Situation Room;
* real-time statistics;
* live Polling Unit status;
* live operational map;
* outstanding-report monitoring;
* incident reporting;
* incident escalation;
* real-time alerts;
* one-to-one in-app messaging;
* group and territory messaging;
* in-app voice calls;
* operational presence;
* structured Election Day reports;
* photographic evidence;
* video evidence;
* written information reports;
* result-report monitoring;
* report review;
* operational event timelines.

The central Election Day question is:

> What is happening right now across the authorized territory, and where does the campaign need to act immediately?

---

## 2.3 Post-Election

### Purpose

Preserve the factual record of Election Day and provide a controlled source-of-truth and evidence layer for post-election review and legal activity where required.

Core functions include:

* preservation of original photographs;
* preservation of original videos;
* preservation of written information reports;
* cryptographic evidence hashing;
* evidence metadata;
* server receipt timestamps;
* location context;
* evidence classification;
* evidence review;
* Polling Unit timelines;
* Polling Unit evidence dossiers;
* Ward and Constituency evidence aggregation;
* evidence search;
* evidence access control;
* evidence access audit;
* evidence retention;
* controlled evidence packages;
* evidence manifests;
* post-election legal-support workspaces.

The central post-election question is:

> What happened, what evidence exists, when was it received, where did it occur, who submitted it, and can the original record be demonstrated to have remained intact?

---

# 3. Locked Organizational Hierarchy

```text
SUPER ADMIN
    |
GENERAL STATE OFFICER
    |
SENATORIAL DISTRICT COORDINATOR
    |
FEDERAL CONSTITUENCY COORDINATOR
    |
STATE CONSTITUENCY COORDINATOR
    |
WARD COORDINATOR
    |
POLLING UNIT COORDINATOR
    |
MEMBER / SUPPORTER
```

Supporting specialist roles:

```text
STATE VALIDATOR
PAYOUT OFFICER
```

---

# 4. Important Structural Rules

## Candidate

A candidate is a campaign entity.

A candidate is **not** an authentication role.

There is no separate Candidate dashboard/login requirement.

Authorized State and Constituency Officers represent and operate the candidate's campaign structure.

---

## LGA

LGA remains part of the electoral and geographic reference database.

LGA is used for:

* reference;
* filtering;
* reporting;
* INEC alignment;
* Ward and Polling Unit mapping.

LGA is **not** part of the operational command hierarchy.

---

## Polling Unit Coordinator

The Polling Unit Coordinator is the frontline field role.

This role inherits the useful operational functions previously associated with the generic Agent concept, including:

* check-in;
* check-out;
* GPS;
* field activity;
* tasks;
* incidents;
* Election Day reporting;
* evidence submission.

The generic Agent role should therefore be phased out.

---

# 5. Core Authentication Roles

Recommended application-level roles:

```text
SUPER_ADMIN
STATE_OFFICER
COORDINATOR
VALIDATOR
PAYOUT_OFFICER
MEMBER
```

Coordinator level is stored separately.

Recommended coordinator levels:

```text
SENATORIAL_DISTRICT
FEDERAL_CONSTITUENCY
STATE_CONSTITUENCY
WARD
POLLING_UNIT
```

Authorization is determined using:

```text
ROLE
+
COORDINATOR LEVEL
+
TERRITORY
+
ACCOUNT STATUS
=
PERMITTED ACTIONS
```

---

# 6. Member Registration & Voter Verification

Members may create accounts even when voter-registration evidence is not immediately available.

Verification states:

```text
NOT_SUBMITTED
PENDING
UNDER_REVIEW
RESUBMISSION_REQUIRED
VERIFIED
REJECTED
```

Registered-voter evidence is reviewed by authorized State Validators.

Validators may:

* open pending cases;
* view private evidence;
* approve;
* reject;
* request resubmission;
* add internal review notes.

Validators cannot:

* create arbitrary rewards;
* modify reward rules;
* change payout thresholds;
* change payout dates;
* alter coordinator territories;
* manipulate confirmed points.

---

# 7. Verification-Gated Referral System

Each eligible coordinator receives:

* unique referral code;
* shareable registration link.

Referral lifecycle:

```text
MEMBER REGISTERS
      |
REFERRAL RECORDED
      |
VOTER EVIDENCE SUBMITTED
      |
STATE VALIDATION
      |
VERIFIED
      |
REFERRAL QUALIFIED
      |
REWARD ENGINE
      |
POINTS LEDGER
```

Signup alone does not generate confirmed referral reward.

---

# 8. Reward System

Reward configuration is controlled by Super Admin.

Reward rules may include:

* qualifying action;
* eligible role;
* direct referral points;
* upstream/network points;
* activity points;
* task-completion points;
* system bonus points;
* rule start date;
* rule end date;
* active/inactive state;
* limits.

Reward values must not be hard-coded.

Historical transactions must not be silently rewritten when reward rules change.

---

# 9. Points Ledger

Confirmed points must be transaction-ledger based.

Possible point types include:

```text
VERIFIED_REFERRAL
FIELD_ACTIVITY
TASK_COMPLETION
APPROVED_PARTICIPATION
BONUS
MANUAL_ADJUSTMENT
```

Manual adjustments must be restricted and audited.

Pending potential points must remain separate from confirmed/withdrawable points.

---

# 10. Payout System

Super Admin controls:

* minimum payout threshold;
* payout schedule;
* point-to-value conversion;
* payout cycle;
* eligibility rules;
* payout-officer assignments.

Payout statuses:

```text
PENDING
ELIGIBLE
APPROVED
PROCESSING
PAID
HELD
REJECTED
```

Payout execution is delegated to authorized Payout Officers.

Payout Officers cannot modify the reward system.

---

# 11. Pre-Election Campaign Strength

The platform measures campaigning strength at:

```text
POLLING UNIT
WARD
STATE CONSTITUENCY
FEDERAL CONSTITUENCY
SENATORIAL DISTRICT
OGUN STATE
```

Strength may be calculated using configurable weighted indicators such as:

* verified membership;
* target achievement;
* coordinator coverage;
* Polling Unit coverage;
* referral growth;
* field activity;
* task completion;
* readiness.

The system must support historical strength snapshots so territories can be identified as:

```text
IMPROVING
STABLE
DECLINING
```

---

# 12. Election Situation Room

The Election Situation Room is the primary Election Day command interface.

It should display live information such as:

* expected Polling Units;
* checked-in coordinators;
* missing check-ins;
* Polling Units opened;
* Polling Units opened late;
* Polling Units not open;
* reports received;
* reports outstanding;
* incidents;
* critical incidents;
* result reports;
* evidence received;
* tracking alerts;
* location mismatch;
* last-report time;
* completion percentage.

All statistics must respect territory authorization.

---

# 13. Election Day GPS

Election Day field tracking supports:

* active location session;
* GPS updates;
* location accuracy;
* Polling Unit assignment;
* geofence radius;
* stale-location threshold;
* last-known location;
* tracking-loss alerts;
* location mismatch;
* escalation.

GPS discrepancies create review alerts and must not automatically be interpreted as wrongdoing.

---

# 14. Election Day Communications

Communication exists primarily for operational Election Day coordination.

Supported communication types:

```text
IN-APP TEXT
GROUP MESSAGING
TERRITORY CHANNELS
IN-APP VOICE CALLING
```

Examples:

* tracking stops;
* coordinator is outside assigned Polling Unit;
* report is overdue;
* incident is reported;
* supervisor needs immediate clarification.

Voice calls should be app-to-app.

Voice conversations should not be automatically recorded.

Call metadata may be retained.

---

# 15. Election Reporting

Polling Unit Coordinators can submit structured Election Day reports.

Reports may contain:

* arrival confirmation;
* arrival time;
* opening status;
* turnout observation;
* incidents;
* remarks;
* result information;
* photographic proof;
* video proof;
* written information;
* Polling Unit;
* reporter;
* location;
* server timestamps.

---

# 16. Evidence Layer

Evidence types:

```text
PHOTO
VIDEO
WRITTEN_REPORT
```

Evidence must be attached to a defined event, report, incident, result or Polling Unit record.

Evidence must not become an uncontrolled media gallery.

---

# 17. Evidence Integrity

Original evidence should be:

* stored privately;
* hashed;
* timestamped;
* associated with uploader;
* associated with territory;
* associated with Polling Unit;
* associated with report/event;
* preserved unchanged.

The system may create:

* thumbnails;
* previews;
* compressed versions;
* streaming versions.

The preserved original must remain separate.

---

# 18. Evidence Chain of Custody

Evidence-related events may include:

```text
UPLOADED
VIEWED
REVIEWED
CLASSIFIED
DOWNLOADED
EXPORTED
ADDED_TO_CASE
```

The system records:

* actor;
* timestamp;
* evidence;
* action;
* session/security metadata where appropriate.

---

# 19. Technology Stack

Core stack:

```text
Frontend:
Next.js
TypeScript

Backend:
Node.js
Express
TypeScript

Database:
PostgreSQL
Prisma

Real-Time:
WebSocket / Socket.IO
Redis Pub/Sub

Storage:
Private S3-compatible object storage

Voice:
WebRTC
STUN
TURN

Development / Packaging:
Docker
Docker Compose
```

---

# 20. Docker

Docker is recommended and locked for backend service packaging.

Docker Compose is recommended and locked for local multi-service development.

A developer should be able to bring up the backend environment using:

```bash
docker compose up
```

Local services may include:

```text
PostgreSQL
Redis
Express API
Real-Time Gateway
Background Worker
S3-Compatible Local Storage
```

The Next.js frontend may run outside Docker when deployed through Vercel.

---

# 21. Recommended Repository Structure

```text
/
├── apps/
│   ├── web/
│   ├── api/
│   ├── realtime/
│   └── worker/
│
├── packages/
│   ├── database/
│   ├── shared/
│   ├── auth/
│   └── config/
│
├── docs/
│   ├── MASTER_FEATURES.md
│   ├── TECHNICAL.md
│   ├── RBAC_AND_TERRITORY.md
│   ├── DATABASE_DESIGN.md
│   ├── PRE_ELECTION.md
│   ├── ELECTION_DAY.md
│   ├── POST_ELECTION_EVIDENCE.md
│   ├── REWARDS_AND_PAYOUTS.md
│   ├── REALTIME_AND_COMMUNICATIONS.md
│   ├── SECURITY.md
│   ├── DEPLOYMENT.md
│   └── IMPLEMENTATION_ROADMAP.md
│
├── docker-compose.yml
├── docker-compose.dev.yml
├── .dockerignore
└── README.md
```

---

# 22. Environment Configuration

Expected configuration groups include:

```text
DATABASE
AUTH
REDIS
OBJECT STORAGE
REAL-TIME
MAPS
WEBRTC
EMAIL / SMS
MEDIA PROCESSING
SECURITY
OBSERVABILITY
```

Example environment names:

```env
DATABASE_URL=

REDIS_URL=

JWT_SECRET=
JWT_EXPIRES_IN=

STORAGE_ENDPOINT=
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

Secrets must never be committed to Git.

---

# 23. Deployment Architecture

Recommended production architecture:

```text
NEXT.JS WEB
    |
    | HTTPS / WebSocket
    |
API / REAL-TIME LAYER
    |
    +---- PostgreSQL
    |
    +---- Redis
    |
    +---- Private Object Storage
    |
    +---- Worker Processes
    |
    +---- STUN / TURN
    |
    +---- Monitoring / Logs
```

The architecture must allow multiple backend instances and must not rely permanently on one API process.

---

# 24. Security Principles

Required principles include:

* backend-enforced RBAC;
* territory isolation;
* least privilege;
* secure password hashing;
* secure session/token handling;
* private voter-document storage;
* private evidence storage;
* short-lived media access;
* input validation;
* rate limiting;
* audit logging;
* financial transaction integrity;
* evidence integrity;
* controlled exports;
* secure secret management;
* backups;
* monitoring;
* production verification.

---

# 25. Locked Non-Negotiable Rules

1. Ogun State only.
2. Constituency-first hierarchy.
3. LGA is reference data, not command authority.
4. No Candidate login role.
5. Polling Unit Coordinator replaces the generic field Agent concept.
6. Successful voter validation is required before referral reward.
7. Validators do not determine reward value.
8. Super Admin configures reward and payout rules.
9. Payout execution is delegated to scoped Payout Officers.
10. Bonus points are system-controlled.
11. Reward history is ledger-based.
12. Pending potential points are not withdrawable.
13. Election Day statistics are real time.
14. GPS tracking supports alerts and geofence review.
15. Communication is primarily operational.
16. Election evidence includes photographs, videos and written reports.
17. Original evidence must be preserved.
18. Evidence must be hashed and auditable.
19. Post-election records serve as the platform's source-of-truth/evidence layer.
20. Rewards must never depend on how a person votes.

---

# 26. Local Development

Typical development flow:

```bash
npm install
docker compose up -d
npm run prisma:generate
npm run prisma:migrate
npm run seed
npm run dev
```

Exact scripts may change as the repository is refactored.

---

# 27. Project Direction

The repository should be migrated incrementally.

Existing working components should be reused where appropriate.

Do not rewrite functioning functionality merely to rename it.

Priority should be:

```text
REUSE
→ REFACTOR
→ EXTEND
→ REPLACE ONLY WHERE NECESSARY
```

The 140-feature Master Locked Design remains the functional source of truth for the project.

For deeper engineering decisions, see:

```text
docs/TECHNICAL.md
```
