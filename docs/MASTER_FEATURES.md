# MASTER_FEATURES.md

# Ogun State Political Organization & Election Operations Platform

## Master Locked Functional Specification

**Document Status:** LOCKED PRODUCT SOURCE OF TRUTH
**Total Locked Features:** 140
**Platform Scope:** Ogun State
**Operating Categories:** Pre-Election, Election Day, Post-Election

---

# 1. Purpose of This Document

This document is the authoritative functional specification for the Ogun State Political Organization & Election Operations Platform.

It defines the complete locked product scope across:

1. **Pre-Election — Build Campaigning Strength**
2. **Election Day — Efficient & Effective Operations**
3. **Post-Election — Source of Truth & Evidence Layer**

All implementation work must remain consistent with the features and operating rules defined in this document.

If implementation, technical documentation, database design, UI design, or developer assumptions conflict with this document, the conflict must be reviewed before the product behavior is changed.

---

# 2. Source-of-Truth Hierarchy

The documentation hierarchy is:

```text
PRODUCT / FUNCTIONAL SOURCE OF TRUTH
        ↓
docs/MASTER_FEATURES.md

TECHNICAL SOURCE OF TRUTH
        ↓
docs/TECHNICAL.md

PROJECT OVERVIEW
        ↓
README.md

LEGACY PICS REFERENCE
        ↓
docs/archive/
```

Legacy PICS documentation may be used to understand reusable code.

Legacy documentation must not override this Master Features specification.

---

# 3. Platform Operating Categories

## CATEGORY 1 — PRE-ELECTION

**Features 001–090**

### Purpose

Build, organize, measure and improve campaigning strength before Election Day.

The platform should answer:

> How strong is our structure, where are we weak, and what must improve before Election Day?

---

## CATEGORY 2 — ELECTION DAY

**Features 091–120**

### Purpose

Provide efficient and effective real-time Election Day operations.

The platform should answer:

> What is happening right now across Ogun State, and where do we need to act immediately?

---

## CATEGORY 3 — POST-ELECTION

**Features 121–140**

### Purpose

Preserve the factual Election Day record and provide a controlled source-of-truth and evidence layer for review and legal support where required.

The platform should answer:

> What happened, what evidence exists, when and where was it submitted, who submitted it, and has the original record remained intact?

---

# 4. Locked Organizational Hierarchy

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

Important structural rules:

```text
Candidate = Campaign Entity
Candidate ≠ Login Role

LGA = Geographic / Electoral Reference
LGA ≠ Operational Command Level

Polling Unit Coordinator = Frontline Field Operator
Generic Agent Role = To Be Phased Out
```

---

# CATEGORY 1 — PRE-ELECTION

# BUILD CAMPAIGNING STRENGTH

## FEATURES 001–090

---

## 001. Ogun-State-Only Platform

The platform is purpose-built for Ogun State and removes unnecessary nationwide operational complexity from the original PICS system.

---

## 002. Constituency-First Command Structure

Operational authority follows:

```text
State
→ Senatorial District
→ Federal Constituency
→ State Constituency
→ Ward
→ Polling Unit
```

---

## 003. LGA as Reference, Not Command Level

LGAs remain part of the electoral and geographic reference database for reporting, search, filtering and INEC alignment.

LGA does not form part of the management hierarchy.

---

## 004. Ogun Electoral Reference Database

The system maintains structured electoral-reference records for:

* Ogun State;
* Senatorial Districts;
* Federal Constituencies;
* State Constituencies;
* LGAs;
* Wards;
* Polling Units.

---

## 005. Locked User-Role Architecture

The operational structure supports:

* Super Admin;
* General State Officer;
* State Validator;
* Payout Officer;
* Senatorial District Coordinator;
* Federal Constituency Coordinator;
* State Constituency Coordinator;
* Ward Coordinator;
* Polling Unit Coordinator;
* Member / Supporter.

---

## 006. Super Admin Authority

Super Admin has platform-wide authority over:

* configuration;
* users;
* roles;
* territories;
* rewards;
* payout rules;
* audits;
* security;
* platform settings.

---

## 007. General State Officer

The General State Officer coordinates Ogun-wide campaign operations and represents the state-level candidate structure.

The role receives statewide organizational intelligence and operational visibility.

---

## 008. State Validator Role

State Validators operate from the General State Officer's office.

They review voter-registration evidence and determine verification status without controlling reward values or payout rules.

---

## 009. Payout Officer Role

Payout Officers execute payout workloads delegated by Super Admin.

Their authority may be limited by:

* territory;
* user level;
* payout batch;
* assigned beneficiaries.

---

## 010. Senatorial District Coordinator

The Senatorial District Coordinator manages and monitors authorized Federal Constituencies and all subordinate organizational structures within the assigned district.

---

## 011. Federal Constituency Coordinator

The Federal Constituency Coordinator manages subordinate State Constituencies, Wards, Polling Units and campaign performance within assigned scope.

---

## 012. State Constituency Coordinator

The State Constituency Coordinator manages Ward and Polling Unit organization within an assigned State Constituency.

---

## 013. Ward Coordinator

The Ward Coordinator manages:

* Polling Unit Coordinators;
* members;
* tasks;
* referrals;
* coverage;
* performance;

within one Ward.

---

## 014. Polling Unit Coordinator

The Polling Unit Coordinator is the frontline operational role assigned to a Polling Unit.

This role performs field operations previously associated with the generic Agent concept.

---

## 015. Member / Supporter Account

Members and supporters can:

* register;
* maintain profile information;
* view verification status;
* receive appropriate announcements and notifications.

---

## 016. Candidate as Campaign Record

A candidate exists as a campaign/domain entity containing information such as:

* name;
* office;
* political party;
* election;
* image;
* territory;
* campaign information.

---

## 017. No Separate Candidate Account

Candidates do not require standalone platform login accounts.

Authorized State and Constituency Officers operate and monitor the candidate structure on their behalf.

---

## 018. Role + Territory Access Control

Protected actions are determined by:

```text
ROLE
+
COORDINATOR LEVEL
+
TERRITORY
+
ACCOUNT STATUS
=
PERMITTED ACTION
```

---

## 019. Territory Isolation

Users may access only data and operations falling within their authorized organizational territory unless explicitly elevated.

---

## 020. Controlled Territory Assignment

Coordinators cannot change their own operational territory.

Territory assignments and reassignments are controlled by authorized superior officers or Super Admin.

---

## 021. Organization Tree

Authorized users can navigate the organizational structure through:

```text
Ogun State
→ Senatorial District
→ Federal Constituency
→ State Constituency
→ Ward
→ Polling Unit
→ Coordinator
```

---

## 022. Coordinator Management

Authorized officers can:

* create;
* edit;
* assign;
* reassign;
* activate;
* deactivate;
* review;

coordinators within their permitted scope.

---

## 023. Member Management

Authorized officers can search and manage members within permitted territory.

Sensitive voter-document evidence remains restricted to authorized validation roles.

---

## 024. Member Registration

Members can register using required:

* identity information;
* contact details;
* electoral territory;
* referral information;
* consent information.

---

## 025. Structured Territory Capture

Territory selection during registration must use controlled electoral-reference records instead of arbitrary free-text territory names.

---

## 026. Voter-Card Upload

A member claiming registered-voter status may upload voter-registration evidence for validation.

---

## 027. Verification Status Model

Supported verification states include:

```text
NOT_SUBMITTED
PENDING
UNDER_REVIEW
RESUBMISSION_REQUIRED
VERIFIED
REJECTED
```

A suspicious case may additionally be flagged for review where required.

---

## 028. Validator Work Queue

Validators receive structured queues for:

* pending cases;
* under-review cases;
* resubmission cases;
* completed cases;
* flagged cases.

---

## 029. Secure Voter-Document Storage

Voter-registration documents must be stored privately.

Access must require:

* authentication;
* authorization;
* controlled short-lived access.

Permanent public document URLs are prohibited.

---

## 030. Validation Decision Workflow

Validators may:

* approve;
* reject;
* request resubmission;
* add review notes.

They do not directly award referral points.

---

## 031. Verification History

Every verification action must be preserved, including:

* reviewer;
* decision;
* timestamp;
* status change;
* notes;
* resubmission history.

---

## 032. Duplicate / Fraud Screening

The system should detect or prevent:

* duplicate voter identifiers;
* repeated evidence use;
* duplicate verified accounts;
* duplicate referral qualification;
* suspicious registration patterns.

---

## 033. Consent and Privacy Records

Where required, the system records consent for:

* terms;
* privacy;
* voter-document processing;
* communications;
* GPS/location use.

---

## 034. Unique Referral Code and Link

Eligible coordinators receive:

* a unique referral code;
* a shareable registration link.

---

## 035. Referral Attribution

The system records the referring coordinator when the member registers.

Referral ownership remains linked throughout verification and reward processing.

---

## 036. Referral Status Model

Referral states include:

```text
REGISTERED
PENDING_VERIFICATION
QUALIFIED
REJECTED
FLAGGED
REWARD_PROCESSED
```

---

## 037. Verification-Gated Referral Qualification

Registration alone does not generate confirmed referral reward.

The referral becomes qualified only after successful voter-registration verification.

---

## 038. Hierarchical Referral Roll-Up

Verified referrals may be aggregated upward through:

```text
Polling Unit
→ Ward
→ State Constituency
→ Federal Constituency
→ Senatorial District
→ Ogun State
```

---

## 039. Direct vs Network Referral Statistics

Dashboards must distinguish:

* direct referrals;
* direct verified referrals;
* network registrations;
* network verified registrations.

---

## 040. Configurable Reward Engine

Reward points are generated automatically from approved qualifying events.

Reward logic must be configurable rather than hard-coded.

---

## 041. Super-Admin Reward Configuration

Super Admin controls:

* reward values;
* qualifying actions;
* eligible roles;
* upstream allocations;
* bonus rules;
* effective dates;
* limits.

---

## 042. Reward Rule Versioning

Reward-rule changes apply prospectively.

Historical reward transactions must retain the rule version under which they were generated.

---

## 043. System-Controlled Bonus Points

Bonus points are generated only through system rules configured by Super Admin.

Payout Officers cannot invent or manually create bonus values.

---

## 044. Approved Points Categories

Possible ledger categories include:

```text
VERIFIED_REFERRAL
FIELD_ACTIVITY
TASK_COMPLETION
APPROVED_PARTICIPATION
BONUS
MANUAL_ADJUSTMENT
```

Manual adjustments must be tightly controlled and audited.

---

## 045. Immutable Points Ledger

Confirmed balances are derived from ledger transactions.

Each transaction should retain:

* recipient;
* points;
* transaction type;
* source event;
* applicable rule;
* timestamp;
* reference.

---

## 046. Pending Potential Points

Potential reward from an unverified referral may be displayed separately.

Pending points:

* do not form part of confirmed balance;
* cannot be withdrawn;
* cannot be paid.

---

## 047. Idempotent Reward Processing

Processing the same qualifying event more than once must not create duplicate reward transactions.

---

## 048. Reward Integrity Boundary

Rewards may relate to:

* verified membership;
* approved participation;
* legitimate organizational work;
* task completion.

Rewards must never depend on:

* ballot choice;
* how a member votes;
* proof of voting for a candidate.

---

## 049. Minimum Payout Threshold

Super Admin defines the minimum confirmed points or balance required before an account becomes eligible for payout.

---

## 050. Payout Schedule

Super Admin defines payout timing, including:

* weekly;
* monthly;
* configured custom cycles.

---

## 051. Point-to-Value Conversion

Where points represent monetary value, the point-to-value conversion rule is centrally configured and audited.

---

## 052. Payout Lifecycle

Recommended payout states:

```text
PENDING
ELIGIBLE
APPROVED
PROCESSING
PAID
HELD
REJECTED
```

---

## 053. Payout Batches

Eligible beneficiaries may be grouped into auditable payout batches associated with a defined payout cycle.

---

## 054. Delegated Payout Assignment

Super Admin delegates payout processing to Payout Officers according to controlled scope.

---

## 055. Payout-Officer Restrictions

Payout Officers cannot:

* alter reward formulas;
* alter verification decisions;
* change payout thresholds;
* change payout dates;
* change territories;
* alter historical ledger records;
* create arbitrary points.

---

## 056. Payout-Officer Dashboard

Payout Officers can see authorized:

* assigned beneficiaries;
* pending payouts;
* approved payouts;
* processing payouts;
* paid payouts;
* held payouts;
* outstanding workload.

---

## 057. Payout Accountability

Every payout must preserve:

* beneficiary;
* points redeemed;
* monetary value;
* payout batch;
* payout officer;
* timestamp;
* payment reference;
* status;
* notes;
* proof where required.

---

## 058. Financial Integrity Controls

The platform must prevent:

* duplicate rewards;
* duplicate payouts;
* unauthorized balance manipulation;
* silent historical edits;
* payout without eligibility.

---

## 059. Hierarchical Dashboard Model

Dashboards automatically aggregate information according to the user's authorized level and subordinate territory.

---

## 060. Polling Unit Dashboard

The Polling Unit view may show:

* coordinator;
* members;
* verified registrations;
* referrals;
* points;
* payouts;
* tasks;
* activity;
* readiness;
* coverage.

---

## 061. Ward Dashboard

The Ward dashboard aggregates:

* Polling Unit Coordinators;
* members;
* verification;
* referrals;
* rewards;
* tasks;
* coverage;
* activity;
* performance.

---

## 062. State Constituency Dashboard

The State Constituency dashboard provides visibility into:

* Wards;
* Polling Units;
* membership;
* referrals;
* strength;
* activity;
* coverage;
* performance;
* readiness.

---

## 063. Federal Constituency Dashboard

The Federal Constituency dashboard aggregates subordinate:

* State Constituencies;
* Wards;
* Polling Units;
* coordinators;
* membership;
* rewards;
* campaign performance.

---

## 064. Senatorial District Dashboard

The Senatorial District dashboard compares Federal Constituencies and provides district-level campaign intelligence.

---

## 065. Ogun State Dashboard

The General State Officer and Super Admin receive statewide:

* KPIs;
* territory comparisons;
* strength indicators;
* coverage;
* membership;
* referrals;
* activity;
* readiness;
* drill-down access.

---

## 066. Candidate Campaign Progress Profile

Authorized officers can view candidate campaign progress without requiring a Candidate login account.

---

## 067. Configurable Strength Score Engine

Campaign strength is calculated using configurable organizational indicators and configurable weightings.

No weighting should be permanently hard-coded.

---

## 068. Polling Unit Strength

Each Polling Unit receives a campaign-readiness or strength score based on approved organizational metrics.

---

## 069. Ward Strength

Ward strength aggregates Polling Unit readiness, staffing, verified membership, activity and configured targets.

---

## 070. State Constituency Strength

State Constituency strength summarizes performance across subordinate Wards and Polling Units.

---

## 071. Federal Constituency Strength

Federal Constituency leadership can compare subordinate State Constituencies and identify weak or strong organizational structures.

---

## 072. Senatorial District Strength

District-level strength summarizes:

* Federal Constituency performance;
* membership growth;
* coverage;
* field activity;
* campaign readiness.

---

## 073. Overall Ogun State Strength

State leadership receives an overall Ogun State campaign-strength score with comparisons between territorial structures.

---

## 074. Campaign Target Setting

Authorized senior officers may define targets for:

* verified members;
* referrals;
* coordinators;
* Polling Unit coverage;
* tasks;
* field activity;
* readiness.

---

## 075. Target vs Actual Tracking

Dashboards display:

```text
TARGET
ACTUAL
PERCENTAGE ACHIEVED
SHORTFALL
```

---

## 076. Progress Trend Analytics

The system stores historical snapshots to determine whether a territory is:

```text
IMPROVING
STABLE
DECLINING
```

---

## 077. Strength Heatmaps and Drill-Down

Authorized officers can identify strong, moderate, weak or critical organizational territories and drill into contributing metrics.

---

## 078. Coordinator Performance and Leaderboards

Coordinator performance may compare approved operational metrics such as:

* verified referrals;
* task completion;
* activity;
* coverage;
* readiness.

Leaderboards must not profile or rank individuals based on political preference.

---

## 079. Field Task Management

Authorized officers can create and assign:

* titled tasks;
* descriptions;
* priorities;
* due dates;
* operational scope.

Suggested task statuses:

```text
TODO
IN_PROGRESS
BLOCKED
DONE
```

---

## 080. Bulk Task Assignment

Operational tasks may be assigned in bulk to authorized:

* coordinators;
* Polling Units;
* Wards;
* other permitted territory groups.

---

## 081. Pre-Election Field Activity Logging

Coordinators may record approved campaign activities such as:

* outreach;
* observations;
* material distribution;
* task-related activity;
* field check-ins.

---

## 082. Coverage Intelligence

The system identifies:

* staffed Polling Units;
* unstaffed Polling Units;
* active territories;
* inactive territories;
* coordinator coverage;
* recent activity;
* coverage percentage.

---

## 083. Notifications

Users receive role-appropriate notifications for events including:

* verification;
* referral qualification;
* reward;
* payout;
* task;
* incident;
* communications;
* system announcements.

---

## 084. Operational Broadcasts

Authorized officers may send controlled announcements or instructions to permitted organizational audiences.

---

## 085. Broadcast History

Every broadcast preserves:

* creator;
* audience;
* territory;
* content;
* time;
* recipient scope;
* delivery information where available.

---

## 086. Member Dashboard

Members may view:

* profile;
* territory;
* verification status;
* resubmission requests;
* notifications;
* announcements.

---

## 087. Search, Filters and Management Views

Management interfaces support appropriate filtering by:

* Senatorial District;
* Federal Constituency;
* State Constituency;
* LGA reference;
* Ward;
* Polling Unit;
* role;
* verification status;
* payout status;
* operational status.

---

## 088. Reporting and Export

Authorized users can generate controlled reports for:

* registration;
* verification;
* referrals;
* rewards;
* payouts;
* strength;
* coverage;
* campaign performance.

Exports may include appropriate:

* CSV;
* Excel;
* print/PDF views.

---

## 089. Mobile-First Production Architecture

The platform must work effectively on field mobile devices while retaining the established web architecture.

---

## 090. Audit and Security Logging

Sensitive actions generate durable audit events, including:

* authentication;
* role changes;
* territory changes;
* voter-document access;
* verification;
* reward activity;
* payout activity;
* sensitive exports;
* administrative actions.

---

# CATEGORY 2 — ELECTION DAY

# EFFICIENT & EFFECTIVE ELECTION-DAY OPERATIONS

## FEATURES 091–120

---

## 091. Election Situation Room

The Election Situation Room provides authorized leadership with a real-time operational command interface.

---

## 092. Real-Time Election Statistics

Election Day statistics update continuously for operational events such as:

* check-ins;
* opening status;
* incidents;
* reports;
* results;
* evidence;
* completion.

---

## 093. Hierarchical Real-Time Statistics

Live statistics are scoped according to organizational level.

Examples:

* Ward sees its Polling Units;
* State Constituency sees subordinate Wards;
* Federal Constituency sees subordinate State Constituencies;
* Senatorial District sees subordinate Federal Constituencies;
* State leadership sees Ogun-wide operations.

---

## 094. Live Drill-Down

Authorized users can drill from:

```text
Ogun State
→ Senatorial District
→ Federal Constituency
→ State Constituency
→ Ward
→ Polling Unit
```

---

## 095. Polling Unit Operational Status

Polling Unit status may include:

```text
NOT_CHECKED_IN
CHECKED_IN
OPENED
REPORTING
INCIDENT_REPORTED
COUNTING
RESULT_SUBMITTED
UNDER_REVIEW
COMPLETED
```

---

## 096. Live Election Operations Map

The live map may display:

* Polling Units;
* active coordinators;
* last-known location;
* incidents;
* missing reports;
* operational status;
* tracking alerts.

---

## 097. Real-Time Alert System

Alerts may be created for:

* critical incidents;
* missing check-ins;
* tracking loss;
* stale location;
* location mismatch;
* Polling Unit not open;
* overdue reports;
* other configured Election Day exceptions.

---

## 098. Polling Unit Coordinator Check-In

Polling Unit Coordinators confirm arrival at assigned Polling Units.

Check-in includes:

* coordinator identity;
* Polling Unit;
* time;
* location context.

---

## 099. Election-Day GPS Tracking

With appropriate consent, active field sessions may send periodic location updates containing:

* latitude;
* longitude;
* accuracy;
* time;
* session;
* last-seen status.

---

## 100. Polling Unit Geofence Monitoring

The system compares coordinator location against the assigned Polling Unit and determines whether the coordinator is within an approved configurable radius.

---

## 101. Tracking Loss and Stale-Location Alerts

The platform alerts appropriate supervisors when:

* tracking stops;
* GPS permission is disabled;
* location becomes stale;
* expected updates stop arriving.

---

## 102. Location Mismatch Alerts

When a coordinator appears materially outside the assigned Polling Unit geofence, the platform creates a review alert.

The alert should include:

* expected location;
* observed location;
* distance;
* accuracy;
* timestamp.

GPS mismatch is an alert for review, not automatic proof of wrongdoing.

---

## 103. Tracking Escalation Workflow

Unresolved tracking problems may escalate through:

```text
Polling Unit
→ Ward
→ State Constituency
→ Federal Constituency
→ Senatorial District
→ General State Officer
```

Critical operational events may bypass intermediate levels where appropriate.

---

## 104. Quick Communication from Alerts and Map

Authorized officers can take operational actions directly from alerts or map records, including:

* Message;
* Call;
* View Location;
* View Profile;
* View Report;
* View Incident;
* Request Check-In.

---

## 105. Missing-Report Contact Actions

Lists of outstanding Polling Unit reports provide immediate communication actions to resolve reporting gaps.

---

## 106. Operational Presence Indicators

Authorized users may see communication-presence states such as:

```text
ONLINE
ACTIVE_RECENTLY
OFFLINE
IN_CALL
```

---

## 107. One-to-One In-App Messaging

Authorized organizational users can exchange operational text messages.

Messages may include:

* timestamp;
* unread count;
* delivery status;
* read status.

---

## 108. Group and Territory Messaging

The system supports appropriate operational groups such as:

* Ward operations;
* State Constituency operations;
* Federal Constituency operations;
* Senatorial District operations;
* State operations.

---

## 109. Messaging Permission Rules

Messaging permissions are controlled through:

* role;
* territory;
* organizational relationship;
* account status.

The platform is not designed as an unrestricted social network.

---

## 110. In-App Voice Calling

Authorized users can make app-to-app internet voice calls.

Recommended technical implementation uses:

* WebRTC;
* signalling;
* STUN;
* TURN.

---

## 111. Call Permissions, Interface and History

The platform controls:

* who may call whom;
* incoming call actions;
* ringing state;
* answered calls;
* missed calls;
* declined calls;
* failed calls;
* call duration;
* call metadata.

Voice conversations are not automatically recorded.

---

## 112. Election Operations Chat

Election-specific chat integrates with operational workflows and the Situation Room.

Chat does not replace formal reports, incidents or evidence submissions.

---

## 113. Incident Reporting

Polling Unit Coordinators may submit structured incidents relating to:

* security;
* logistics;
* intimidation;
* violence;
* material shortages;
* malfunction;
* other Election Day issues.

---

## 114. Incident Severity and Workflow

Incident severity:

```text
LOW
MEDIUM
HIGH
CRITICAL
```

Incident status:

```text
OPEN
IN_PROGRESS
RESOLVED
CLOSED
```

---

## 115. Incident Multimedia Evidence

Incident records may include:

* photographs;
* videos;
* written information;
* location;
* timestamp;
* reporter;
* Polling Unit.

---

## 116. Incident Assignment and Escalation

Authorized officers may:

* assign incidents;
* escalate incidents;
* add notes;
* create related tasks;
* update status;
* resolve;
* close.

Incident history must remain preserved.

---

## 117. Structured Election-Day Reporting

Polling Unit Coordinators submit structured reports including relevant:

* arrival information;
* opening information;
* turnout observation;
* incidents;
* remarks;
* result information;
* evidence;
* completion information.

---

## 118. Pictorial, Video and Information Proof

Election Day reporting supports three principal evidence forms:

```text
PHOTO / PICTORIAL
VIDEO
WRITTEN / INFORMATION REPORT
```

---

## 119. Live Result and Reporting Monitoring

Authorized dashboards monitor:

* reports received;
* reports outstanding;
* reporting percentage;
* result reports received;
* result reports outstanding;
* review status;
* evidence received;
* Polling Unit completion.

---

## 120. Report Review and Operational Timeline

Authorized reviewers may:

* approve;
* query;
* request clarification;
* request correction.

The platform preserves an operational timeline containing relevant:

* reports;
* alerts;
* incidents;
* messages;
* calls;
* escalation events;
* review actions.

---

# CATEGORY 3 — POST-ELECTION

# SOURCE OF TRUTH & EVIDENCE LAYER

## FEATURES 121–140

---

## 121. Post-Election Source of Truth

After Election Day, the platform serves as the authoritative internal record of:

* submitted reports;
* evidence;
* timestamps;
* incidents;
* results;
* operational events.

---

## 122. Three Evidence Types

The evidence system recognizes:

```text
PHOTO
VIDEO
WRITTEN_REPORT
```

as first-class evidence records.

---

## 123. Evidence Linked to Events

Evidence is attached to a defined:

* Election Day report;
* incident;
* result;
* Polling Unit event;
* case;
* other structured record.

Evidence must not exist only as an unstructured media gallery.

---

## 124. Evidence Chain of Custody

Evidence records preserve custody-related information such as:

* uploader;
* account identity;
* territory;
* Polling Unit;
* upload time;
* server-receipt time;
* file information;
* linked event;
* review history;
* custody events.

---

## 125. Cryptographic Evidence Hashing

Original evidence receives a server-generated cryptographic hash such as:

```text
SHA-256
```

The hash enables later integrity verification.

---

## 126. Original Evidence Preservation

The original submitted file must remain preserved.

Original evidence must not be silently overwritten or replaced.

Corrections create:

* a new evidence item; or
* a supplementary version.

---

## 127. Preview and Streaming Derivatives

The platform may create:

* thumbnails;
* compressed images;
* preview files;
* streaming versions;
* transcoded video derivatives.

Derivatives remain separate from the protected original.

---

## 128. Multi-Point Timestamping

Evidence may preserve:

* capture time where available;
* upload time;
* server-receipt time;
* report time;
* review time.

Server-receipt time is the authoritative platform timestamp.

---

## 129. Evidence Location Context

Where available and permitted, evidence may contain:

* GPS coordinates;
* location accuracy;
* Polling Unit;
* relevant geofence/location context.

---

## 130. Evidence Classification

Evidence may be classified as:

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

## 131. Evidence Review Status

Evidence review states may include:

```text
SUBMITTED
UNDER_REVIEW
VERIFIED
DISPUTED
REQUIRES_CLARIFICATION
ARCHIVED
```

`VERIFIED` means reviewed according to platform procedure.

It does not represent a judicial declaration of truth.

---

## 132. Polling Unit Evidence Timeline

The platform reconstructs a chronological Polling Unit record using events such as:

* check-in;
* location events;
* opening;
* incidents;
* communications metadata;
* voting-period observations;
* counting;
* evidence uploads;
* result submission;
* review actions.

---

## 133. Polling Unit Evidence Dossier

Authorized users can assemble a structured Polling Unit dossier containing:

* Polling Unit identity;
* assigned coordinator;
* check-in history;
* relevant GPS history;
* reports;
* incidents;
* photographs;
* videos;
* written information;
* result information;
* communication metadata;
* review notes;
* hashes;
* audit records.

---

## 134. Ward and Constituency Evidence Aggregation

Evidence may be aggregated upward from:

```text
Polling Unit
→ Ward
→ State Constituency
→ Federal Constituency
→ Senatorial District
→ Ogun State
```

---

## 135. Evidence Search and Discovery

Authorized users may search evidence by appropriate attributes such as:

* date;
* time;
* territory;
* Polling Unit;
* incident;
* reporter;
* evidence type;
* classification;
* review status.

---

## 136. Controlled Legal / Evidence Export

Authorized users may generate controlled evidence packages containing:

* selected evidence;
* reports;
* metadata;
* timestamps;
* hashes;
* manifest;
* supporting records.

All exports must be audited.

---

## 137. Evidence Access Control

Evidence access is controlled by:

* role;
* territory;
* case/workspace permission;
* account status.

Sensitive original evidence must not be exposed to unauthorized users.

---

## 138. Evidence Access Audit Trail

Sensitive evidence actions generate audit records, including:

* view;
* download;
* review;
* classification;
* export;
* addition to case/workspace.

---

## 139. Evidence Retention Policy

Election evidence receives a stronger retention policy than routine campaign content.

Evidence must not automatically disappear when campaign activity ends.

---

## 140. Post-Election Legal Support Workspace

Authorized users may create controlled legal-support workspaces containing:

* issues/case records;
* related Polling Units;
* reports;
* incidents;
* photographs;
* videos;
* written evidence;
* timelines;
* GPS information;
* evidence packages;
* review notes.

The platform supports evidence organization and legal review.

It does not make legal conclusions.

---

# 5. Locked Core Workflows

## Member Verification and Referral Reward

```text
Coordinator Shares Referral Code / Link
        ↓
Member Registers
        ↓
Referral Recorded
        ↓
Voter Evidence Submitted
        ↓
State Validator Reviews
        ↓
REJECTED
        └── No Confirmed Reward

VERIFIED
        ↓
Referral Qualified
        ↓
Reward Event
        ↓
Reward Engine
        ↓
Points Ledger Entry
        ↓
Confirmed Account Balance
        ↓
Payout Eligibility
```

---

# 6. Locked Payout Workflow

```text
Super Admin Configures Reward Rules
        ↓
Verified Activity Generates Points
        ↓
Minimum Threshold Reached
        ↓
Payout Cycle Arrives
        ↓
System Determines Eligibility
        ↓
Payout Batch Created
        ↓
Beneficiaries Assigned to Payout Officers
        ↓
Payout Officer Processes Assigned Accounts
        ↓
Payment Reference / Proof Recorded
        ↓
PAID
```

---

# 7. Election-Day Escalation Chain

```text
POLLING UNIT COORDINATOR
        ↓
WARD COORDINATOR
        ↓
STATE CONSTITUENCY COORDINATOR
        ↓
FEDERAL CONSTITUENCY COORDINATOR
        ↓
SENATORIAL DISTRICT COORDINATOR
        ↓
GENERAL STATE OFFICER
```

Critical events may escalate beyond intermediate levels where appropriate.

---

# 8. Evidence Event Structure

```text
ELECTION EVENT / REPORT
│
├── Written Information Report
├── Photographs
├── Videos
├── GPS / Location Context
├── Polling Unit
├── Reporter
├── Timestamp
├── Review History
├── Evidence Hash
└── Audit / Custody Trail
```

---

# 9. Locked Product Integrity Rules

The following rules are non-negotiable unless formally changed through product governance.

## 9.1 Constituency-First

Operational authority follows constituency structure.

LGA remains reference data.

---

## 9.2 Verification Before Referral Reward

Member signup alone does not generate confirmed referral points.

Successful voter verification is required.

---

## 9.3 Validators Do Not Control Rewards

Validators make verification decisions.

The reward engine automatically processes qualifying outcomes.

---

## 9.4 Super Admin Controls Reward Rules

Reward values, bonuses, qualification rules, payout threshold and payout cycles are centrally configured.

---

## 9.5 Payout Officers Execute, Not Configure

Payout Officers process delegated payouts.

They do not control reward formulas or payout policy.

---

## 9.6 System-Controlled Bonus Points

Bonus points come from configured system rules.

---

## 9.7 Immutable Reward History

Historical ledger transactions must not be silently altered.

---

## 9.8 No Candidate Login

Candidate information is represented as a campaign entity.

State and Constituency Officers represent the candidate operationally.

---

## 9.9 Polling Unit Coordinator Replaces Generic Agent

Useful Agent functionality is retained and refactored into the Polling Unit Coordinator role.

---

## 9.10 Election Day Is Real Time

The Situation Room must receive near-real-time:

* tracking;
* incidents;
* alerts;
* reports;
* statistics;
* communications information.

---

## 9.11 GPS Alerts Are Review Signals

GPS discrepancies must not automatically be treated as proof of misconduct.

Location accuracy and timing must be considered.

---

## 9.12 Communication Is Operational

Messaging and calling primarily support:

* missing reports;
* tracking loss;
* location mismatch;
* incidents;
* clarification;
* escalation;
* command coordination.

---

## 9.13 Evidence Is Structured

Photos, videos and written reports must be linked to defined operational events.

---

## 9.14 Original Evidence Must Be Preserved

Original evidence cannot be silently replaced.

---

## 9.15 Evidence Hashing Must Be Server Controlled

The authoritative evidence hash must be computed by trusted backend processing.

---

## 9.16 Evidence Access Must Be Audited

Sensitive evidence access and export activity must be recorded.

---

## 9.17 Post-Election Platform Is a Source of Truth

The system must preserve enough factual operational history to reconstruct Election Day events where possible.

---

## 9.18 No Vote-Choice Reward

No reward, point, payment or benefit may depend on:

* who a member votes for;
* proof that a member voted for a particular candidate;
* ballot choice.

---

# 10. Locked Technical Direction

The platform is expected to retain the existing technology foundation while being expanded.

Core technology direction:

```text
Frontend
Next.js
TypeScript

Backend
Node.js
Express
TypeScript

Database
PostgreSQL
Prisma

Real-Time
WebSocket / Socket.IO
Redis

Background Processing
Workers / Queue

Storage
Private S3-Compatible Object Storage

Voice
WebRTC
STUN
TURN

Development / Packaging
Docker
Docker Compose
```

Detailed implementation decisions belong in:

```text
docs/TECHNICAL.md
```

---

# 11. Migration Principle

The existing PICS codebase should not be discarded without reason.

Development follows:

```text
REUSE
    ↓
REFACTOR
    ↓
EXTEND
    ↓
REPLACE ONLY WHERE NECESSARY
    ↓
HARDEN
```

---

# 12. Functional Acceptance Principle

A feature is considered functionally complete only when its intended workflow and permission boundaries work correctly.

Implementation should also satisfy the technical Definition of Done contained in:

```text
docs/TECHNICAL.md
```

---

# 13. Change-Control Rule

These 140 features represent the locked product baseline.

New functionality may be added later.

However:

```text
NEW FEATURE
≠
SILENT CHANGE TO LOCKED FEATURE
```

Any proposed change that alters a locked feature should be documented as:

```text
CHANGE REQUEST
        ↓
IMPACT REVIEW
        ↓
APPROVAL
        ↓
MASTER_FEATURES.md UPDATE
        ↓
TECHNICAL.md UPDATE
        ↓
IMPLEMENTATION
```

---

# 14. Final Platform Journey

```text
============================================================
PRE-ELECTION
============================================================

Build Organizational Structure
        ↓
Register Members
        ↓
Validate Voter Evidence
        ↓
Qualify Referrals
        ↓
Generate Reward Points
        ↓
Manage Payout Eligibility
        ↓
Measure Campaign Strength
        ↓
Identify Weak Territories
        ↓
Improve Readiness


============================================================
ELECTION DAY
============================================================

Polling Unit Coordinator Check-In
        ↓
Live GPS / Geofence Monitoring
        ↓
Election Situation Room
        ↓
Real-Time Statistics
        ↓
Alerts / Escalations
        ↓
Messaging / Voice Calls
        ↓
Incident Management
        ↓
Election Reports
        ↓
Photo / Video / Written Evidence
        ↓
Result / Completion Monitoring


============================================================
POST-ELECTION
============================================================

Preserved Reports
        +
Original Photographs
        +
Original Videos
        +
Written Information Reports
        +
GPS / Location Context
        +
Server Timestamps
        +
Evidence Hashes
        +
Review History
        +
Audit / Chain of Custody
        ↓
Polling Unit Evidence Timeline
        ↓
Polling Unit Evidence Dossier
        ↓
Ward / Constituency Aggregation
        ↓
Evidence Search
        ↓
Controlled Evidence Export
        ↓
Post-Election Legal Support Workspace
```

---

# END OF MASTER LOCKED FUNCTIONAL SPECIFICATION

**Total Locked Features: 140**

```text
PRE-ELECTION
001–090

ELECTION DAY
091–120

POST-ELECTION
121–140
```

This file is the primary functional source of truth for the Ogun State Political Organization & Election Operations Platform.
