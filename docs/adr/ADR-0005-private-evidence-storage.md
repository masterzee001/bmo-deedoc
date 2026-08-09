# ADR-0005 Private Evidence Storage

## Status

Accepted target architecture on 2026-08-09; not implemented.

## Context

Legacy media uses database bytes and arbitrary URLs without immutable originals, server hashes, controlled access, or custody history. Election evidence and voter registration evidence require stronger integrity and privacy.

## Decision

Store originals in private S3-compatible object storage under server-owned unique keys. Deny silent overwrite, generate SHA-256 server-side, preserve versions, separate derivatives, authorize short-lived access in the backend, audit custody/access, and use Object Lock/WORM where supported and approved.

## Consequences

Object storage and workers become required before target evidence workflows launch. Existing media must be copied, hashed, verified, and reconciled before legacy bytes/URLs can be retired.

## Alternatives Considered

Public URLs were rejected for privacy. Database blobs were rejected for scale and object-control limitations. Client hashes alone were rejected because they are not authoritative.

## Related Master Features

026, 029, 090, 115, 118, 121-140.
