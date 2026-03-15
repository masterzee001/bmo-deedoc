# PICS Nigeria Product Capability Guide

## What The Platform Does
PICS Nigeria is a territory-governed political operations platform for party structures, campaign leadership, field administrators, candidates, agents, and supporters. It supports controlled user management, party-aligned operations, field tasking, live agent visibility, campaign communication, supporter engagement, rewards, audit-friendly administration, and operational incident review.

The platform is designed for live political operations, so authority is always constrained by both `rank` and `territory`. Users only see and act within the operational scope assigned to them.

## Core Product Capabilities
- `Territory-governed access`: every management and reporting action is limited by state, LGA, ward, constituency, or polling-unit scope.
- `Rank-based control`: higher-ranking admins can manage lower-ranking users only within their authorized territory.
- `Party-aligned operations`: admin, candidate, and agent records operate with political-party linkage rules enforced on the backend.
- `Locator-first workflows`: admins begin with territory and role selection before opening user management, creation, or live operations.
- `Operational dashboards`: each role sees only the summaries and actions relevant to its work.
- `Field execution`: agents receive tasks, submit activity, report incidents, and support election-day operations.
- `Campaign engagement`: candidates manage public profile, posts, broadcasts, events, and supporter-facing engagement.
- `Reward participation`: supporters can earn and redeem reward points through governed engagement workflows.
- `Operational governance`: audit history, incident review signals, communication previews, and coverage insights support oversight without weakening live workflows.

## Major Modules
- `Authentication and RBAC`
  secure sign-in, role assignment, access control, active-account enforcement, and protected operational routes.
- `Territory reference data`
  geo-political zones, states, senatorial districts, federal constituencies, state constituencies, LGAs, wards, and polling units.
- `Admin management`
  territory-first user discovery, admin lifecycle actions, scoped create/edit flows, activation control, and safe deletion where policy permits.
- `Party structure management`
  approved political-party records and enforced party relationships across party-bound roles.
- `Candidate operations`
  campaign profile, posts, broadcasts, events, supporter visibility, and scoped campaign monitoring.
- `Agent operations`
  task assignment, activity logging, incident submission, live tracking, and election-day reporting.
- `Voter and supporter engagement`
  registration, candidate discovery, consent-based communication, referrals, engagement tasks, and rewards.
- `Reporting and oversight`
  live activity views, map summaries, scoped notifications, incident monitoring, operational queues, audit-friendly workflows, communication previews, and coverage intelligence.

## Candidate Discovery And Public Profile
Current capability:
- public candidate discovery already supports search and filtering by:
  - state
  - office
  - political party where available
- public candidate listing now presents a clearer discovery experience with:
  - visible candidate counts
  - office coverage summaries
  - quick office-based narrowing from visible results
- public candidate detail pages already expose published candidate-facing information only
- candidate public presence can include:
  - profile portrait
  - campaign slogan
  - bio
  - political party context
  - territory labels
  - published campaign materials
  - published campaign events
  - related candidate and related party navigation where available

Visibility controls:
- only active candidate records with published public profiles are shown in discovery
- admin-only fields are not part of the public directory
- candidate-controlled media and profile publishing remain separate from internal admin workflows

Safe next-step direction:
- richer manifesto and structured highlights can be added later on top of the existing public profile foundation without exposing private fields

## User Types And What They Can Do
- `Super Admin`
  manages the whole platform, all territories, reference structures, political parties, high-level user operations, and cross-territory oversight.
- `National Admin`
  operates at national scope within assigned authority, manages lower-ranking admins and field users, tracks national field activity, and coordinates party-aligned operations.
- `State Admin`
  manages state-wide operations, lower-ranked admins, local candidates, agents, and reporting inside the assigned state only.
- `LGA Admin`
  manages ward-level operators, local agents, tasks, field coverage, and reports inside the assigned LGA only.
- `Ward Admin`
  coordinates polling-unit and ward field execution, supervises local agents, and handles ward-level reporting.
- `Polling Unit Agent / Field Agent`
  receives tasks, records field activities, submits incidents, updates task progress, and supports polling-unit operations for assigned territory.
- `Candidate`
  manages campaign presence, supporter communications, materials, events, and campaign-facing live field visibility inside eligible scope.
- `Voter / Supporter`
  views candidate information, receives campaign updates where permitted, performs engagement actions, earns rewards, and participates in supporter workflows.

## Admin Powers By Rank
Admin powers follow both `hierarchy` and `territory`. Rank alone is not enough; the territory must also be valid.

- `Super Admin`
  can drill from national level down to any lower territory and manage platform-wide structures and users.
- `National Admin`
  can manage lower-ranking admins and field users only in assigned national authority and party scope.
- `State Admin`
  can manage lower-ranking admins and field users only inside the assigned state.
- `LGA Admin`
  can manage lower-ranking users only inside the assigned LGA.
- `Ward Admin`
  can manage agents and lower local workflows only inside the assigned ward or polling-unit scope where applicable.

Higher-ranking admins can perform these actions only when backend rules allow:
- create admin, candidate, and agent records
- edit lower-ranked users
- assign or update allowed territory
- link party-bound users to a political party
- unlink or change party linkage where policy and scope permit
- deactivate and reactivate accounts
- delete accounts only when safe-policy checks pass
- assign tasks to single agents or eligible bulk target groups
- review scoped field activity and reports

Restricted actions:
- no admin can manage outside assigned territory
- no lower-ranking admin can manage a higher-ranking admin
- no admin can use the workflow to manage super-admin accounts
- self-destructive actions are blocked where unsafe
- destructive actions require explicit confirmation in the UI

## Territory And Locator Logic
The platform is territory-first. Management should begin with scope selection, not a broad uncontrolled list.

Current workflow pattern:
- select territory
- select target role or operational action
- open a scoped list or scoped form
- complete creation, edit, tracking, or tasking inside that scope

Current admin workflow pages now separate:
- `overview`
  summary cards and next actions only
- `select territory`
  scope selection before management or tracking
- `manage users`
  scoped list and lifecycle actions
- `create user`
  scoped create and edit workflow
- `live operations`
  live tracking and task assignment
- `incident review`
  governed review signals for incident follow-up
- `communications`
  targeted messaging with preview before send
- `rewards`
  reward accountability and redemption visibility
- `coverage`
  weak territory and polling-unit intelligence

Territory logic is used across:
- dashboard summaries
- managed-user discovery
- live agent tracking
- task assignment
- candidate visibility
- polling-unit operations
- reporting and incident review

This keeps the product operationally safe for live field use and reduces cross-scope errors.

## Political Party Linkage Logic
Political-party relationship is a core operational rule, not a cosmetic field.

- admin accounts are expected to operate with party linkage
- agent accounts are party-bound field records
- candidate records are party-aligned campaign records
- party-bound actions are backend-validated, not just UI-filtered

Operational implications:
- admins without required party linkage cannot use party-bound management actions
- lower admins can only create or manage party-bound users inside allowed party scope
- agent assignment and tasking must respect party compatibility where policy requires it
- candidate and admin operations are aligned to permitted party structure
- communication targeting is also party-aware for party-bound roles
- scoped recipient previews and task assignment do not bypass party rules

This ensures that platform operations reflect real campaign structure rather than generic user administration.

## Communication Targeting Rules
Current capability:
- candidate broadcasts already operate through controlled backend routes
- admin broadcasts already support scoped audience fields and territory filters
- communication logic already recognizes audience categories such as:
  - admins
  - agents
  - voters
  - candidates
- territory fields already exist on communication records for:
  - state
  - constituency
  - LGA
  - ward
  - polling unit

Current targeting principles:
- no user should message outside authorized role and territory scope
- party-bound actors must remain inside allowed party scope
- communication should flow through scoped campaign or operational audiences, not unrestricted user selection

Current operational support:
- admin communication workflows now support recipient previews before send
- admin targeting can be narrowed by:
  - audience role
  - territory
  - political party
  - admin level
  - candidate office
  - agent task status
- preview and send remain backend-scoped so actors cannot message outside authorized territory or party authority
- empty-target sends are blocked
- a changed target selection requires a fresh preview before send in the admin workflow
- party targeting is limited to party-linked recipient roles and is not available for voter-only broadcasts
- preview now reflects both applied filters and the effective territory scope before send

Operational result:
- admins can send to all agents in one LGA, visible ward admins, scoped candidates, or consented voters within their authority
- targeting remains understandable because the workflow shows recipient counts before a message is sent

## User Lifecycle Management
The platform supports controlled user lifecycle operations for authorized admins.

Lifecycle actions include:
- create user
- edit user
- assign territory
- assign or update party linkage
- activate or deactivate access
- delete account only where safe and allowed

Deletion is intentionally conservative:
- active accounts must be deactivated first
- protected accounts cannot be deleted through normal workflow
- accounts with dependent operational records may be blocked from deletion
- dependency checks help preserve audit-friendliness and deployed data integrity

Operational result:
- admins can safely manage user lifecycle in production without guessing whether a destructive action will succeed
- protected records are preserved when campaign, reward, incident, or task history still depends on them

## Dashboard And Operational Navigation
Dashboard pages are intended to show summary and the next most important actions, not mixed operational forms.

Structure used by the product:
- `Dashboard home`
  summary cards, alerts, queues, and high-priority shortcuts only
- `Management pages`
  scoped tables and controlled actions only
- `Forms`
  dedicated create and edit workflows
- `Live operations`
  territory-scoped field visibility, activity review, and tasking

Current admin overview shortcuts now point into:
- manage users
- select territory
- incident review
- communications
- rewards
- coverage intelligence
- account settings

This separation reduces clutter and makes training and day-to-day usage easier for campaign teams.

## Task Assignment And Task Lifecycle
Field tasking is used to coordinate agent execution in a controlled way.

Supported tasking patterns:
- assign a task to one specific agent
- assign tasks in bulk to eligible agents
- bulk target by state
- bulk target by LGA
- bulk target by senatorial district
- bulk target by federal constituency
- bulk target by state constituency
- bulk target by selected visible agents

Current safety rules:
- task creation is checked against the admin's allowed territory
- party-bound agent tasking is checked against allowed party scope
- linked incident tasking is checked against visible incident scope
- bulk assignment requires explicit confirmation in the UI

Typical task types include:
- mobilization activity
- field verification
- polling-unit preparation
- voter outreach
- material distribution
- incident follow-up
- election-day reporting

Current implemented task lifecycle:
- `Todo`
  task is assigned and waiting for action
- `In Progress`
  agent has started the work
- `Blocked`
  agent cannot continue and needs intervention
- `Done`
  task is finished and recorded

Planned safe extension:
- a richer submitted, reviewed, or approved completion flow can be layered later without replacing current task status behavior

Task lifecycle value:
- gives admins clearer operational control
- gives agents clear responsibility and status visibility
- supports reward and performance workflows where enabled

## Reward Ledger And Approval Logic
Current capability:
- the platform already has a reward ledger foundation for earned points
- reward-related records already support:
  - reward type
  - points
  - description
  - related user reference where applicable
  - redemption request records
  - review fields for redemption decisions
- reward balance is already computed from ledger and redemption state rather than from a single unsafe mutable counter
- voter-facing reward history now combines:
  - earned ledger entries
  - redemption lifecycle states
  - source and status breakdown visibility
  - requested amount where applicable
  - review note visibility where available
  - review timestamps where available
- admin-facing reward accountability now shows:
  - posted reward history in scope
  - visible redemption queue
  - pending, approved, paid, and rejected states
  - compact ledger-type breakdowns for operational review

Operational meaning:
- supporters can see reward outcomes relevant to their participation
- admins can already review redemption requests in authorized scope
- reward activity is traceable at a foundational level even where the UI is still lightweight

Safe next-step direction:
- richer reviewer notes, more detailed approval history, and more explicit source categorization can continue to be added on top of the current model without replacing current balances

## Agent Operational Features
Agents are not passive user accounts. They are active field-operational users.

Agent-facing capabilities include:
- view assigned tasks
- update task status
- submit field activities
- submit incidents
- capture field observations
- operate from assigned territory and polling-unit context
- support election-period field execution

Admin and candidate oversight capabilities include:
- track live agent activity inside authorized scope
- drill into one specific visible agent
- review recent signals and last activity time
- tie operational action back to territory and party structure
- assign immediate single-agent tasks from live operations
- assign territory-scoped bulk tasks from live operations

## Live Agent Tracking
Live agent tracking is designed for operational supervision, not just analytics.

Capabilities include:
- territory-based live tracking
- single-agent drilldown
- recent activity visibility
- map-based operational summary
- incident and agent-location review inside authorized scope
- direct transition from tracking into task assignment for visible agents

Tracking visibility always respects:
- admin level
- territory assignment
- party scope where applicable

This means a state admin can supervise visible state agents, while an LGA admin sees only their LGA field footprint.

## Election-Day Reporting Flow
Current capability:
- the live system supports election-period field operations through:
  - agent check-in and check-out
  - location pings
  - incident submission
  - task assignment
  - live agent tracking
  - incident escalation

Current limitation:
- there is not yet a dedicated structured election-day result-report workflow for:
  - arrival confirmation
  - opening status
  - turnout observations
  - result entry
  - labeled evidence-photo capture

Safe planned enhancement:
- this should be added as a dedicated additive reporting flow, not by overloading the current generic incident model

## Communication And Campaign Operations
The platform supports controlled campaign communication rather than uncontrolled mass messaging.

Capabilities include:
- candidate posts and materials
- campaign events
- broadcasts
- scoped audience targeting
- supporter engagement workflows
- candidate-facing monitoring of relevant field activity
- party and territory-aware admin messaging
- preview-first communication governance for admin broadcasts

Communications are intended to move through governed routes:
- candidate to supporters
- admin to eligible field structures
- campaign leadership to visible operational audiences

## Rewards And Engagement
Supporter rewards are part of the operational model, especially for participation and mobilization incentives.

Capabilities include:
- reward balance visibility
- engagement task participation
- referral-based participation
- redemption requests
- admin review queues where applicable
- reward history visibility for supporters
- reward accountability visibility for admins in scope

This helps connect field mobilization, supporter activity, and campaign engagement in one governed workflow.

## Audit Trail And Action History
Current capability:
- the platform already has a backend audit-log foundation
- many sensitive admin and operational actions already write audit records
- the current audit model tracks:
  - actor
  - action
  - target type
  - target id
  - timestamp
  - structured metadata where included

Operational value:
- sensitive actions are not entirely silent
- user lifecycle changes, task actions, escalation actions, and other governed operations already have a reusable logging base
- scoped admin activity history is now available for visible audit events through an admin-facing review page
- audit records now support clearer operational context through structured metadata and scoped visibility checks
- activity review now covers a broader set of visible operational events such as candidate and agent updates, incident assignment and status updates, engagement-task creation, and broadcast creation

Current limitation:
- audit-log visibility remains conservative and currently centered on high-trust admin access
- territory and party context are primarily carried through metadata, not yet as explicit indexed fields

Safe next-step direction:
- broader scoped activity-history views can be added by extending the current audit foundation rather than creating a second logging system

## Incident Escalation And Fraud Flags
Current capability:
- incidents already support:
  - classification
  - severity
  - status
  - territory binding
  - assignment
  - escalation metadata
- admin routes already support escalation of incidents through governed workflows
- admin incident review now exposes a scoped queue with summary signals and filterable review visibility

Current limitation:
- suspicious patterns are treated as review signals first, not hard rejections

Current operational support:
- incident review now surfaces explainable governance signals such as:
  - duplicate report windows
  - reporter territory mismatch
  - missing location data
  - repeated reporter volume
  - open incidents still awaiting assignment
- incident review can now be narrowed by status, incident type, flagged-only view, and governance review priority
- these indicators help admins prioritize review without blocking legitimate submissions

Operational result:
- suspicious items can be reviewed faster
- low-confidence anomalies do not break live field submission
- review remains explainable to non-technical operations teams

## Coverage Intelligence And Field Visibility
Current capability:
- the platform now exposes a dedicated coverage view for admins in scope
- coverage intelligence highlights:
  - wards with weak coverage pressure
  - polling units without assigned agents
  - polling units without recent activity
  - polling units carrying open incident pressure
- the coverage view now also separates actionable follow-up into:
  - agent assignment gaps
  - activity follow-up queues
  - incident-pressure queues
- the coverage view remains practical and operational rather than becoming a heavy analytics system

Operational result:
- admins can quickly identify blind spots in field deployment
- ward and LGA follow-up can be prioritized from one focused page
- weak territories can be actioned through the existing user-management and tasking workflows

## Governance And Safety Controls
The platform is designed for deployed-system safety.

Key governance controls:
- backend permission enforcement for sensitive actions
- territory-scoped queries
- hierarchy checks for admin management
- party-scope checks for party-bound operations
- confirmation before destructive actions
- activation state control
- dependency-aware deletion safeguards
- reuse of existing structures instead of risky rewrites
- minimal schema-change bias for deployed environments

## Operational Strengths That Matter In Practice
Features that are easy to overlook, but important operationally:
- locator-first navigation reduces accidental cross-scope browsing
- focused pages reduce admin errors in live campaign use
- backend scoping protects against UI bypass
- live operations and management flows align around the same territory logic
- party linkage keeps campaign structure coherent
- deletion safeguards protect live reporting, tasks, incidents, and historical operations
- role-relevant dashboards improve usability for non-technical campaign teams
- coverage intelligence now highlights weak wards, polling units without assigned agents, and areas with missing recent activity for faster operational follow-up

## Product Operating Principle
PICS Nigeria is built to let campaign structures operate at scale without losing territorial discipline, party alignment, or backend safety. The platform works best when authority stays close to the correct operational level and every action is filtered through rank, territory, and governed workflow rules.
