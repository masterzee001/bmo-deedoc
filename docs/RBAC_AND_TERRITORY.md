# RBAC and Territory Contract

- **Decision date:** 2026-08-09
- **Status:** Phase 1 target contract implemented; legacy compatibility remains during staged migration
- **Decision record:** `docs/adr/ADR-0002-role-and-coordinator-level-separation.md`

## Authentication Roles

| Role | Meaning | Core authority |
|---|---|---|
| `SUPER_ADMIN` | Platform-wide break-glass and policy administrator | Manages platform configuration, role assignments, territory assignments, and exceptional audited access. |
| `STATE_OFFICER` | Ogun operational command role | Coordinates state-wide operations but cannot change platform security or financial policy reserved to Super Admin. |
| `COORDINATOR` | Field command role whose scope is defined by a separate coordinator level and assignment | Operates only inside assigned territory and inherited descendants. Cannot self-assign. |
| `VALIDATOR` | Verification reviewer | Reviews assigned Member evidence and records verification decisions. Cannot coordinate field operations or process payouts. |
| `PAYOUT_OFFICER` | Assigned payout operator | Processes approved payout work within assignment. Cannot configure reward or payout rules. |
| `MEMBER` | Registered campaign member | Manages the member's own account, submissions, participation, and eligible rewards. |

Candidate is a campaign domain entity, not an authentication role. LGA is reference geography, not a command role or coordinator level.

## Coordinator Levels

`COORDINATOR` answers who the principal is. `CoordinatorLevel` answers where that coordinator sits in the command hierarchy:

```text
SENATORIAL_DISTRICT
FEDERAL_CONSTITUENCY
STATE_CONSTITUENCY
WARD
POLLING_UNIT
```

A coordinator has exactly one active level per active assignment. Multiple assignments require explicit records with effective dates; they are not inferred from email, party, or LGA.

## Territory Hierarchy

The command hierarchy is:

```text
STATE
-> SENATORIAL DISTRICT
-> FEDERAL CONSTITUENCY
-> STATE CONSTITUENCY
-> WARD
-> POLLING UNIT
```

Electoral boundaries are not always a strict single-parent geographic tree in source data. The database must store authoritative membership links needed to evaluate this command order rather than deriving constituencies from names or an LGA shortcut.

LGA remains attached as geographic/reference metadata for addressing, filtering, source reconciliation, and reporting. It grants no command authority. A user's LGA value never substitutes for a coordinator assignment.

## Authorization Formula

```text
ROLE
+ COORDINATOR LEVEL
+ ASSIGNED TERRITORY
+ ACCOUNT STATUS
= AUTHORIZED ACTION
```

Authorization is explicit deny by default and backend enforced. An active account is necessary but never sufficient. Every protected operation must check role capability, assignment validity, territory containment, resource state, and any domain-specific separation of duties.

## Territory Inheritance

| Principal | Authorized command scope |
|---|---|
| Super Admin | All Ogun territories, subject to audited exceptional-access rules. |
| State Officer | Ogun State and every subordinate target territory. |
| Senatorial District Coordinator | Assigned district and linked Federal Constituencies, State Constituencies, Wards, and Polling Units. |
| Federal Constituency Coordinator | Assigned Federal Constituency and linked State Constituencies, Wards, and Polling Units. |
| State Constituency Coordinator | Assigned State Constituency and linked Wards and Polling Units. |
| Ward Coordinator | Assigned Ward and its Polling Units. |
| Polling Unit Coordinator | Assigned Polling Unit only. |

Inheritance flows downward only. Sibling, parent, and unrelated territory access is denied. Validator and Payout Officer assignments may use the same canonical territories, but do not inherit coordinator capabilities.

## Explicit Denials

- A Ward A Coordinator cannot read or mutate Ward B operational records.
- A Polling Unit Coordinator cannot access another Polling Unit, even in the same Ward or LGA.
- A Coordinator cannot change role, level, assignment, account status, or territory.
- A Validator cannot coordinate field operations, configure verification policy, or process payouts.
- A Payout Officer cannot configure reward rules, payout rules, or verification outcomes.
- A State Officer cannot use Super Admin security or policy powers.
- Candidate records never authenticate or inherit a user's permissions.
- LGA membership never authorizes a command action.
- Inactive or suspended accounts cannot perform protected operations with an existing token.

## Legacy Role Migration

No Prisma enum was renamed in place. Phase 1 adds target identity/assignment structures and a dry-run-first backfill utility while retaining legacy profiles and role literals; production apply and final legacy retirement require separate review.

| Legacy state | Target treatment | Required review |
|---|---|---|
| `SUPER_ADMIN` | `SUPER_ADMIN` | Confirm named owners and break-glass controls. |
| `ADMIN` at State | Usually `STATE_OFFICER`; may be `COORDINATOR` if duties are territorial rather than state command | Review account purpose, party coupling, and scope. |
| `ADMIN` at Senatorial/Federal/State Constituency/Ward | `COORDINATOR` plus matching level and canonical assignment | Verify territory mapping and remove party as an authorization shortcut. |
| `ADMIN` at National, Geo-political Zone, or LGA | Exception; no automatic mapping | Manually deactivate, redesign, or map to an approved target role. LGA cannot become a coordinator level. |
| `AGENT` with authoritative Polling Unit assignment | `COORDINATOR` plus `POLLING_UNIT` | Verify Polling Unit, consent/session state, and duplicates. |
| `AGENT` without authoritative Polling Unit assignment | Migration exception | Keep legacy-only and inactive for target operations until resolved. |
| `VOTER` | `MEMBER` | Preserve account and referral history; voter-card value is unverified legacy data, not proof. |
| `CANDIDATE` | Candidate domain record plus separately authorized human account only when needed | Decouple campaign data from login identity using additive keys and audited stewardship. |

## Canonical Identifiers

Canonical IDs are stable, opaque application identifiers owned by the database. Existing structurally sound IDs are retained, including `ng-state-ogun` and the established prefixes `sen-`, `fed-`, `state-assembly-`, `inec-lga-`, `inec-ward-`, and `inec-pu-`. IDs are lowercase ASCII and immutable after publication.

Source codes, display names, aliases, and provenance are separate fields. Developers must not derive authorization from an ID prefix, mint a second ID for an existing territory, encode hierarchy in names, or use free-text constituency composition to create reference records.

## Canonical Module Ownership

| Contract | Canonical home |
|---|---|
| Target roles, account statuses, coordinator levels, territory kinds | `packages/shared/src/platform-contracts.ts` |
| Verification, referral, reward, payout, Election Day, and evidence statuses | `packages/shared/src/platform-contracts.ts` |
| Shared event and audit envelopes | `packages/shared/src/platform-contracts.ts` |
| Persisted schema and relations | `packages/database/prisma/schema.prisma` plus Ogun migrations |
| Runtime configuration | `apps/api/src/env.ts` and `.env.example` |
| Backend authorization decisions | `apps/api/src/authorization.ts`; `apps/api/src/scope.ts` is legacy/transitional |
| API payload schemas and public types | `packages/shared`; route-local validation may consume but not redefine shared enums |

Frontend code displays shared contracts and never becomes an authorization source.

## Ogun Data Verification

`npm run verify:reference:ogun` is the strict identity/provenance gate. The disposable database confirms the canonical Ogun state, 3 Senatorial Districts, and 9 Federal Constituencies. Phase 1 schema supports direct State-Constituency-to-Federal and Ward-to-State-Constituency command links, but the verifier still blocks because approved lower-level records, command mappings, source codes, and import-release provenance are not loaded. No missing record may be manufactured to satisfy the gate.

Polling Unit geodata is a separate target-only gate. `npm run verify:reference:ogun --workspace @pics-nigeria/database -- --require-geodata` must pass before Election Day GPS/geofence behavior depends on coordinates, accuracy, capture metadata, or geofence radius. Missing geodata must not be used to block Pre-Election identity/RBAC integration once the identity/provenance gate is complete.
