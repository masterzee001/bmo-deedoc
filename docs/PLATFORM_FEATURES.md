# PICS Nigeria Platform Features

## Purpose
PICS Nigeria is a campaign operations and field coordination platform for political structures, candidates, administrators, agents, and supporters. It combines territory-based management, user administration, campaign communication, field activity tracking, and election-period reporting in one governed system.

## Major Modules
- `Access and administration`: role-based sign-in, scoped dashboards, admin hierarchy, activation control, and audited management actions.
- `Territory management`: national, zone, state, LGA, ward, constituency, and polling-unit assignment used to control visibility and authority.
- `Locator workflows`: territory-first selectors for opening scoped user management, creation flows, and live field operations without loading unrelated records.
- `Campaign operations`: candidate profiles, campaign materials, events, voter engagement, and consent-based communication.
- `Field operations`: agent assignment, attendance, activity logging, incident reporting, and task coordination.
- `Rewards and participation`: supporter rewards, redemptions, engagement tasks, and participation tracking.
- `Reference structures`: geo-political zones, states, LGAs, wards, polling units, and approved political party records.

## User Types
- `Super Admin`: governs the full platform, manages global structures, monitors cross-territory activity, and can drill down into lower territory operations.
- `National Admin`: oversees national campaign operations within assigned party authority and manages lower-ranking admins and field users in allowed scope.
- `State Admin`: manages state-wide structures, lower admins, candidates, agents, and field visibility inside the assigned state only.
- `LGA Admin`: coordinates ward-level coverage, local agents, tasks, and reports inside the assigned LGA only.
- `Ward Admin`: supervises ward-level execution, assigned field users, polling-unit coordination, and local reporting.
- `Polling Unit Agent / Field Agent`: handles assigned field tasks, check-ins, local updates, incident escalation, and polling-unit reporting.
- `Candidate`: manages campaign profile, voter-facing materials, events, broadcasts, supporter engagement, and constituency visibility.
- `Voter / Supporter`: views candidate information, receives updates, completes engagement actions, earns rewards, and submits participation signals.

## Territory-Based Authority
Authority follows both `role hierarchy` and `territory scope`.

- Higher-ranking admins can manage lower-ranking users only inside their own permitted territory.
- Territory scope narrows from `National -> Zone -> State -> LGA -> Ward -> Polling Unit`.
- Political-party alignment is also enforced for party-bound admin, candidate, and agent actions.
- Users do not see or manage records outside their assigned authority.

## Communication and Reporting Flow
- Candidates publish campaign materials and events for supporters in their eligible territory.
- Admins and candidates can send scoped communication to the audiences they are allowed to reach.
- Agents submit operational updates from the field, including attendance, location activity, task progress, and incident reports.
- Admin dashboards aggregate scoped notifications, field activity, coverage, incidents, and management workflows for review.
- Higher-ranking admins can use locator-driven live operations to track all visible agents in a territory or drill into one agent at a time.

## Rewards, Tasks, Materials, and Election-Day Activity
- `Rewards`: supporters earn points through participation and referrals, then request redemptions through controlled workflows.
- `Tasks`: admins coordinate field execution by assigning scoped tasks to one agent or bulk target groups by territory, then tracking progress.
- `Campaign materials`: candidates publish text, image, video, and document updates for voter discovery and engagement.
- `Election-day reporting`: field reporting is tied to assigned territory so polling-unit operations, turnout observations, incidents, and result updates can flow upward through the admin structure.

## Workflow Pattern
- `Dashboard home`: summary and highest-priority actions only.
- `Locator first`: choose territory, then choose role or live-ops action.
- `Scoped lists`: load only the records that match the selected role and territory.
- `Dedicated forms`: create and edit users in focused workflows with party and territory controls built in.

## Operating Principle
The platform is designed to keep operational control close to the relevant territory, reduce cross-scope errors, and preserve secure oversight for live political campaign activity.
