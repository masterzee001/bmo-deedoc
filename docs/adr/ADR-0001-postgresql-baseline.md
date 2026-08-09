# ADR-0001 PostgreSQL Baseline

## Status

Accepted on 2026-08-09.

## Context

The declared provider is PostgreSQL, but the first five of 17 legacy migrations contain SQLite syntax. Replaying the mixed stream cannot produce a trustworthy clean PostgreSQL database, and production history was not available for inspection.

## Decision

Preserve and hash-lock the legacy stream for reconciliation. Use `prisma/ogun-migrations` as the active PostgreSQL stream, beginning with a generated full-schema baseline. Baseline non-empty databases only when their schema exactly matches; otherwise abort for manual reconciliation.

## Consequences

Clean PostgreSQL builds are deterministic and old history remains intact. Production adoption requires a sanitized snapshot rehearsal and explicit handling of drift. New migrations cannot be replayed by tooling that ignores `prisma.config.ts`.

## Alternatives Considered

Rewriting legacy SQL was rejected because deployed checksums and unknown production history could be corrupted. Resetting production was rejected as destructive. Continuing with automatic `P3005` resolution was rejected because it could mark unapplied history as applied.

## Related Master Features

001, 004, 089, 090.
