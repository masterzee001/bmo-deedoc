# Financial Integrity & Legacy Payout Cutover

Status: implemented, **not executed against any real data**. `PAYOUT_EXECUTION_ENABLED`
is false in every environment, production included, and no conversion ratio has
been approved — so reconciliation is fail-closed and a pending carryover remains
non-spendable.

## Why this exists

Before this change the platform had two balances and two money-out paths that
did not agree with each other.

| | Payout cycle path | Redemption path (before) |
| --- | --- | --- |
| Balance read | `RewardLedgerEntry` | legacy `RewardLedger` |
| Minimum threshold | enforced | not enforced |
| Conversion rate | applied server-side | not applied |
| Monetary amount | server-computed | **supplied by the client** |

A member holding a single point could request and be assigned an arbitrary
naira amount, because the client asserted the amount and nothing re-derived it.
Two ledgers also meant the same points could be counted twice depending on which
path read them.

## Two authorities

**[`payout-authority.ts`](../apps/api/src/lib/payout-authority.ts) decides what a
member is owed.** `getAuthoritativeBalances` is the single balance
implementation — the per-member function delegates to it, so the two cannot
drift. `valuePayout` and `valueEligibleBeneficiaries` apply the minimum
threshold and conversion rate from the active `PayoutConfiguration`. A payout
cycle snapshots those terms at creation instead of accepting them in a request
body, so a cycle's terms are immutable for its lifetime and were never chosen by
a caller.

**[`payout-execution.ts`](../apps/api/src/lib/payout-execution.ts) decides
whether that money may leave, and records that it did.** It is the only code in
the platform that may mark money as paid. Both money-out routes call
`executePayout` and neither performs its own `PAID` mutation.

Every execution, whichever path it came from:

- refuses unless `PAYOUT_EXECUTION_ENABLED` is on — asserted before the
  transaction and again inside it;
- refuses unless the target is in a legal pre-`PAID` state;
- refuses a payment reference that already identifies another execution;
- is valued from server-side terms, never from a stored or supplied amount;
- claims its transition atomically, so a double submit pays once;
- writes an immutable `PayoutExecution` record and an audit row in the same
  transaction as the transition.

An assignment is paid at its cycle's snapshotted terms rather than re-valued,
because a cycle's terms are deliberately immutable for its lifetime. That is only
sound if those terms were server-derived, so a cycle records the
`PayoutConfiguration` it priced from. A cycle created before the payout authority
has no such provenance — its rate came from a request body — and its assignments
are refused at execution rather than paid at a figure nobody authorised.

`PayoutExecution` exists because `PayoutTransaction`'s assignment foreign key is
required, so it could not represent a redemption without being distorted. Unique
indexes on each target make exactly-once a database property, and
`paymentReference` is unique across both kinds.

Two guards keep this from decaying into convention:
[`verify-money-out-chokepoint.mjs`](../scripts/verify-money-out-chokepoint.mjs)
fails the build on a `PAID` write outside the authority (and refuses to pass if
it stops matching the authority itself), and the assignment route's generic
status writer is annotated to a type that excludes `PAID`, so removing its
delegation fails to compile.

## Legacy balances: preserved, not credited

Legacy balances are **migrated as non-spendable carryover**, not retired and not
assumed equivalent to current points.

- `LegacyBalanceCarryover` holds each member's legacy balance with a per-row
  SHA-256 fingerprint of the exact source rows it summarises. One carryover per
  member is a database constraint.
- A carryover starts `LEGACY_CARRYOVER_PENDING`, is reported separately by the
  balance endpoint, and is **excluded from eligible points**. It is visible to
  the member but cannot be spent or paid.
- Source rows are never rewritten. Reconciliation posts a new
  `LEGACY_CARRYOVER` entry to the authoritative ledger; it does not edit history
  to make totals fit.

Retiring the balance would lose member value; crediting it 1:1 would invent
value from an unverified assumption.

### A pending carryover has no effect on anything spendable

This is stronger than it sounds, and it was got wrong twice before it was got
right. An earlier version netted pre-cutover redemptions off the authoritative
reservation, reasoning that legacy value had funded them so authoritative
earnings should not be charged twice. That silently priced the preserved balance
at parity: releasing a reservation of N points because a pending carryover of N
legacy points exists **is** paying that carryover out at 1:1. It also disagreed
with reconciliation, which applies the approved ratio, so below parity a member
could receive more than the organisation had valued the balance at.

The rule now admits no arithmetic to get wrong:

```
pending legacy carryover
  ≠ authoritative points
  ≠ reservation credit
  ≠ spendable value
```

A regression test asserts it directly — voiding a pending carryover must not
change `availablePoints`. If that test starts failing, unvalued legacy property
has been coupled back into spendable value.

## Open policy: pre-cutover redemptions

**This is unresolved policy, not an implementation defect to be fixed by
arithmetic.**

A redemption raised at or before a member's cutover is a claim against value the
legacy ledger held. What should happen to it — cancel, convert at the approved
ratio, grandfather, or settle some other way — is a governance decision, and no
approved policy exists.

Until one does, the platform takes the fail-closed position:

- the reservation stands in full, so the platform can never over-pay;
- the figure is surfaced as `preCutoverReservedPoints` on the balance and in the
  reconciliation audit record — **diagnostic only**. It tells an operator that a
  liability originated before cutover without asserting how it should be
  settled;
- such a redemption is refused at execution while its carryover is pending, so
  nothing is settled on a guess.

Resolving this is a prerequisite for enabling payouts, not a follow-up to them.

## Running the cutover

```bash
npm run migrate:legacy-balances -- --dry-run   # reports totals, writes nothing
npm run migrate:legacy-balances                # creates the batch and carryovers
```

Safe to re-run: a member already carried is skipped, and since one carryover per
member is a unique index, a concurrent second run fails rather than double-counts.
The script re-reads what was stored and fails if the stored member count or point
total does not match what it intended to write.

Verified end to end against a seeded database: 2 members / 225 legacy points →
2 carryovers / 225 pending points, 3 source rows intact, 0 entries credited to
the authoritative ledger. A second run reported `already_carried=2`,
`to_migrate=0`, and the total stayed 225.

## Reconciliation

**The valuation is server-derived.** `POST /pre-election/rewards/legacy-carryover/reconcile`
(SUPER_ADMIN) takes a `carryoverId` and an optional note. It does **not** accept
a conversion ratio or a rule version — a request carrying either is rejected
outright rather than silently stripped, so an old client is told its figure was
refused instead of quietly having it ignored.

The ratio and version come from an approved `LegacyReconciliationPolicy` and
nowhere else. Governance sets one in two deliberate acts:

```bash
POST /pre-election/rewards/legacy-reconciliation-policy            # drafts a ratio; inert
POST /pre-election/rewards/legacy-reconciliation-policy/:id/approve # authorises it
```

Drafting proposes a valuation and approving authorises it, so no single request
can both invent a ratio and apply it to a member's balance. At most one policy
may be approved at a time — the application retires the previous one in the same
transaction, and a partial unique index refuses the write if it ever fails to.

**No ratio is currently approved, and none is seeded.** Until governance approves
one, reconciliation fails closed with
`RECONCILIATION_POLICY_NOT_APPROVED` (409): the carryover stays pending, nothing
is credited, and the batch counters do not move. There is no equivalence between
a legacy point and an authoritative one to apply.

Points are computed in exact decimal — in binary floating point 100 × 0.29 is
28.999999999999996, which floors to 28.

Every credit carries provenance back to the decision that authorised it: the
carryover records the policy id, version and ratio, and the audit entry records
those plus the source balance, `preCutoverReservedPoints`, credited points and
actor.

Exactly-once is enforced at three levels: a conditional claim that transitions
the carryover only if it is still pending, unique indexes on the reward event and
ledger entry, and the one-carryover-per-member constraint. Verified under
concurrency: three simultaneous requests produce one success, two 409s, one
ledger credit, and batch counters that move once.

## Payout kill switch

`PAYOUT_EXECUTION_ENABLED` defaults to `false` in every environment. Enabling it
is a deliberate operator action taken after reconciliation and readiness gates
pass — not a consequence of deploying to production.

## Known gaps, for the next financial-hardening step

These are real and deliberately not addressed here. All are safe while the kill
switch remains false.

- **Points can be minted from a request body.** `POST /admin/participation`
  (`pointsAwarded`) and `POST /admin/engagement-tasks` (`rewardPoints`, claimed
  by a member) write to the authoritative ledger with no `rewardRuleVersionId`.
  Both are audited, but neither is versioned, and money-in has had nothing like
  the scrutiny money-out has.
- **No CHECK constraints on financial columns.** Points and amounts permit
  negatives at the database level.
- **No reversal mechanism.** `MANUAL_ADJUSTMENT` exists as a ledger category
  with no writer, and `LEGACY_CARRYOVER_VOID` has no code path, so a wrongly
  minted credit cannot be unwound through any supported route.
- **`RewardRedemption.amountRequested` is a nullable float** while the payout
  path uses `Decimal(18,2)` throughout.

## What this change does not do

- It does not approve a conversion ratio or credit any carryover.
- It does not enable payout execution anywhere.
- It does not migrate any real member data; the cutover has only been exercised
  against seeded and test databases.
- It does not address the Ogun-only command cutover, which is separate work.
