# Financial Integrity & Legacy Payout Cutover

Status: implemented, **not executed against any real data**. Payout execution is
disabled by default in every environment, production included.

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
naira amount through the redemption path, because the client asserted the
amount and nothing re-derived it. Two ledgers also meant the same points could
be counted twice depending on which path read them.

## The model now

`RewardLedgerEntry` is the only financial truth. Every money-out path computes
value in one place — [`apps/api/src/lib/payout-authority.ts`](../apps/api/src/lib/payout-authority.ts):

- `getAuthoritativeBalance()` — confirmed, reserved, and eligible points.
  Redemptions and payout assignments both reserve against the same figure, so
  points cannot be spent through both paths.
- `valuePayout()` — reads the active `PayoutConfiguration` and applies the
  stored minimum threshold and conversion rate. The caller may request a number
  of *points*; it may never assert an *amount*.

The legacy `RewardLedger` is read-only. `createRewardEntryWithNotification()`
now throws rather than writing, so a credit cannot be posted to a ledger that no
longer governs payouts.

## Legacy balances: preserved, not credited

Legacy balances are **migrated as non-spendable carryover**, not retired and not
assumed equivalent to current points.

- `LegacyBalanceCarryover` holds each member's legacy balance with a per-row
  SHA-256 fingerprint of the exact source rows it summarises.
- A carryover starts `LEGACY_CARRYOVER_PENDING`, is reported separately by the
  balance endpoint, and is **excluded from eligible points**. It is visible to
  the member but cannot be spent or paid.
- Source rows are never rewritten. Reconciliation posts a new
  `LEGACY_CARRYOVER` entry to the authoritative ledger; it does not edit
  history to make totals fit.

Retiring the balance would lose member value; crediting it 1:1 would invent
value from an unverified assumption. Neither is acceptable, so the balance is
carried and left pending until an approved ratio exists.

## Running the cutover

```bash
npm run migrate:legacy-balances -- --dry-run   # reports totals, writes nothing
npm run migrate:legacy-balances                # creates the batch and carryovers
```

The script is safe to re-run: a member already carried in any batch is skipped,
which is the double-count guard. It re-reads what was stored and fails if the
stored member count or point total does not match what it intended to write.

Verified end to end against a seeded database: 2 members / 225 legacy points →
2 carryovers / 225 pending points, 3 source rows intact, 0 entries credited to
the authoritative ledger. A second run reported `already_carried=2`,
`to_migrate=0`, and the total stayed 225.

## Reconciliation

`POST /pre-election/rewards/legacy-carryover/reconcile` (SUPER_ADMIN) applies an
approved `conversionRatio` and `reconciliationRuleVersion`, credits the derived
points to the authoritative ledger, and links the resulting entry to the
carryover. Reconciling the same carryover twice returns 409 and credits nothing.

**No ratio has been approved.** Until governance sets one, every carryover stays
pending and unpayable.

## Payout kill switch

`PAYOUT_EXECUTION_ENABLED` defaults to `false` in every environment. Enabling it
is a deliberate operator action taken after reconciliation and readiness gates
pass — not a consequence of deploying to production. While disabled, transitions
to `PAID` on both payout assignments and redemptions return 409 and no money-out
state changes.

## What this change does not do

- It does not approve a conversion ratio or credit any carryover.
- It does not enable payout execution anywhere.
- It does not migrate any real member data; the cutover has only been exercised
  against seeded and test databases.
- It does not address the Ogun-only command cutover, which is separate work.
