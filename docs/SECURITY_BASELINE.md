# Security Baseline

- **Assessment date:** 2026-08-09
- **Scope:** Phase 0 foundational controls

## Implemented Controls

| Area | Phase 0 baseline |
|---|---|
| JWT signing | HS256 is explicit. Issuer, audience, and expiry are required configuration and are verified by the API. |
| JWT secret | Production startup rejects missing, default, or shorter-than-32-character secrets. Development requires at least 16 characters. |
| Account enforcement | Protected requests reload the user profile and reject inactive accounts; tests cover login and existing-token denial. Agent session nonce checks remain backend enforced. |
| Password hashing | Existing bcrypt hashing is retained at cost 10. Password migration is not part of Phase 0. |
| Login/register abuse | Separate IP-aware rate limits protect authentication and registration endpoints. Proxy trust is explicit. |
| HTTP baseline | Helmet headers are enabled, `X-Powered-By` is disabled, and JSON body size is bounded. CSP and cross-origin resource policy remain disabled until binary and frontend compatibility are designed. |
| CORS | Exact configured origins are accepted; production startup requires an explicit allowlist. Rejected origins return 403. |
| Configuration | `apps/api/src/env.ts` validates security-sensitive settings centrally and fails startup with a readable error. |
| Voter-card exposure | General management, candidate, and voter-list payloads expose only a recorded/not-recorded Boolean. CSV export excludes voter-card numbers and writes an audit event. |
| Hierarchy | Candidate-office management requires a strictly superior legacy admin level; same-level management is denied. |

The API continues to use short-lived bearer access tokens only. Phase 0 does not add refresh tokens because there is no existing refresh lifecycle, revocation store, or demonstrated need that justifies adding a second credential system before the target role migration.

## Evidence Access Boundary

Target voter registration evidence follows:

```text
PRIVATE OBJECT STORAGE
-> BACKEND AUTHORIZATION
-> SHORT-LIVED ACCESS
-> ACCESS AUDIT
```

Allowed access is limited to the submitting Member for the Member's own submission, an assigned Validator for an active review, and a Super Admin using an exceptional audited workflow. Coordinators, Candidates, Payout Officers, public routes, exports, logs, notifications, analytics, and client-side state must not receive raw object keys or durable URLs.

The backend creates a short-lived signed read URL only after each authorization decision and records actor, target evidence, purpose, outcome, request/session context, and timestamp. Evidence buckets and originals are private; public ACLs, guessable keys, direct bucket browsing, silent overwrite, and client-supplied authoritative hashes are prohibited.

The current database photo bytes and arbitrary campaign media URLs are legacy media, not compliant target evidence. The storage/access contract is locked, but private object storage is TARGET architecture and is not implemented in Phase 0.

## Dependency Audit

Before Phase 0, `npm audit` reported 16 package findings: 1 low, 3 moderate, 10 high, and 2 critical. Compatible direct upgrades were made to Express, Next 15, Prisma, Prisma Client, and concurrently. A non-forced `npm audit fix` updated safe transitive packages. No forced or major upgrade was applied.

After remediation, `npm audit` reports 5 package findings: 1 low, 0 moderate, 4 high, and 0 critical. The four high findings are package-level findings; the `next` entry aggregates its `postcss` and `sharp` dependency paths rather than representing a separate exploit primitive.

### High Finding 1 - Next

| Field | Assessment |
|---|---|
| Package/version | Direct `next@15.5.23` production framework dependency. |
| Advisory | npm aggregate finding through affected `postcss` and `sharp` versions. |
| Reachability | Indirect. Reachability depends on the two child code paths below; no separate vulnerable Next code path is reported. |
| Affected code path | Next build/style processing and optional image optimization dependency graph. |
| Available fix | `next@16.3.0`. |
| Breaking-change risk | High: semver-major framework migration affecting build/runtime behavior and requiring React/Next compatibility, route, and deployment testing. |
| Decision | `ACCEPT TEMPORARILY`. Do not use `npm audit fix --force`; schedule a dedicated Next 16 migration. Does not block controlled Phase 1. |

### High Finding 2 - PostCSS

| Field | Assessment |
|---|---|
| Package/version | Transitive `postcss@8.4.31` through Next. |
| Advisory | `GHSA-qx2v-qp2m-jg93`, `GHSA-6g55-p6wh-862q`, `GHSA-r28c-9q8g-f849`, and `GHSA-fxqj-rqcc-2cmp`: style-string escaping and attacker-controlled source-map file disclosure paths. |
| Production/dev-only | Build dependency in the current application. |
| Reachability | `NOT PRODUCTION REACHABLE` in the verified code path: the application compiles trusted checked-in styles and exposes no endpoint that accepts or processes user CSS or source maps. |
| Affected code path | Next CSS build pipeline. |
| Available fix | A PostCSS version above 8.5.22, currently offered by npm only through the Next 16 major update. |
| Breaking-change risk | High when applied through the automated Next major upgrade. |
| Decision | `NOT PRODUCTION REACHABLE`; accept temporarily, keep style inputs repository-controlled, and remediate with the tested Next 16 migration. Does not block Phase 1. |

### High Finding 3 - Sharp

| Field | Assessment |
|---|---|
| Package/version | Transitive optional `sharp@0.34.5` through Next. |
| Advisory | `GHSA-f88m-g3jw-g9cj`: inherited libvips vulnerabilities `CVE-2026-33327`, `CVE-2026-33328`, `CVE-2026-35590`, and `CVE-2026-35591`. |
| Production/dev-only | Installed in the production web dependency graph. |
| Reachability | Not known to be attacker-reachable in current code. There are no `next/image` imports, no configured remote image sources, and no web image-upload processing route. |
| Affected code path | Next server image optimization if enabled and given a processable image. |
| Available fix | `sharp>=0.35.0`, currently offered by npm through the Next 16 major update. |
| Breaking-change risk | High when applied by forcing the Next major upgrade. |
| Decision | `ACCEPT TEMPORARILY`. Keep remote image optimization disabled by configuration/default allowlist and do not route untrusted uploads through Next image optimization. Reassess before any image pipeline work. Does not block Phase 1. |

### High Finding 4 - XLSX

| Field | Assessment |
|---|---|
| Package/version | Direct operational `xlsx@0.18.5` database-workspace dependency. |
| Advisory | `GHSA-4r6h-8v6p-xvw6` prototype pollution and `GHSA-5pgg-2g8v-p4x9` regular-expression denial of service. |
| Production/dev-only | Operational bootstrap tooling; not imported by API or web runtime code. |
| Reachability | `NOT PRODUCTION REACHABLE` through an HTTP/file-upload path. The only import reads the fixed checked-in `inec-constituencies.xls` with documented SHA-256. |
| Affected code path | `packages/database/scripts/inec-constituency-reference.ts` during operator-invoked reference bootstrap. |
| Available fix | No npm-registry fix is available for the installed package line. |
| Breaking-change risk | Parser replacement requires workbook compatibility and constituency-count regression tests. |
| Decision | `NOT PRODUCTION REACHABLE`; accept temporarily for the checksum-pinned project workbook only. Never parse an uploaded or unapproved workbook. Replace the parser before accepting external workbook input. Does not block Phase 1. |

The remaining low finding is transitive `esbuild@0.27.3` through `tsx`: `GHSA-g7r4-m6w7-qqqr`, a Windows local development-server arbitrary-read path. It is development/operational tooling, requires local access, is not request-reachable in deployed API/web runtimes, and is accepted temporarily while tracking the upstream `tsx` update.

CI rejects critical advisories. None of the accepted findings creates a currently reachable authentication, authorization, untrusted upload, or remote-code-execution path under the controls above. Any new CSS/source-map input, image optimizer input, or workbook upload invalidates this acceptance and requires security review.

## Unresolved Security Work

- Browser access tokens remain in `localStorage`, which raises XSS credential-theft impact. Move target sessions to an approved browser session model during the role/auth migration.
- Non-Agent access tokens have no server-side session or revocation record beyond account status and expiry.
- Account state remains a legacy Boolean; target `ACTIVE`, `INACTIVE`, and `SUSPENDED` semantics are contract-only.
- CSP, file signature validation, private evidence storage, signed access, malware scanning, custody events, retention, legal hold, and WORM controls are not implemented.
- Route-local legacy scope logic remains distributed and must be replaced by the target policy service in Phase 1.
- The four remaining high package findings require controlled framework/parser remediation.

These items prevent a claim of production security completion, but no critical dependency advisory or silently defaulted production JWT secret remains.
