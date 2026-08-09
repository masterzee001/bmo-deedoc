# ADR-0002 Role and Coordinator-Level Separation

## Status

Accepted on 2026-08-09.

## Context

Legacy role enums mix authentication identity, campaign entities, and geographic rank. The target requires separation of duties and constituency-first command while retaining existing accounts safely.

## Decision

Use high-level authentication roles independently from `CoordinatorLevel` and explicit territory assignments. Candidate becomes a non-login domain entity. LGA remains reference geography and never a command level. Migrate additively rather than renaming legacy enum values.

## Consequences

Authorization becomes explicit and testable but requires Phase 1 compatibility records, exception reports, backfills, and a controlled cutover. Legacy Admin, Agent, Candidate, and Voter values remain until migration is verified.

## Alternatives Considered

Extending the legacy Admin-level enum was rejected because it preserves mixed concerns. Direct enum renames were rejected because ambiguous accounts and foreign keys cannot be migrated safely that way.

## Related Master Features

001-020, 059-066, 091-120.
