# Evidence Closure Foundation

## Sprint 2 Scope

This branch implements the Evidence/Post-Election foundation for features 121-140:

- authoritative evidence metadata in PostgreSQL through `EvidenceAsset`;
- private object-storage originals through the API storage abstraction;
- server-generated SHA-256 hashes;
- unique object keys with conditional no-overwrite writes;
- PHOTO, VIDEO, and WRITTEN_REPORT evidence types;
- classifications, review states, custody events, signed/private access, PU timelines, dossiers, legal-support associations, and controlled manifest exports.

## Storage Boundary

Authoritative evidence originals must not be stored on the local/container filesystem. The production runtime is private S3-compatible object storage. Tests use `InMemoryEvidenceObjectStorage`, which is deterministic, rejects overwrites, and does not create files.

## Deferred Target Work

Derivative workers remain target-later work. `EvidenceAsset.derivativesJson` records derivative metadata and currently marks worker status as `TARGET_LATER`.

Full archive/package materialization remains target-later work. The implemented export creates and audits a controlled manifest with hashes and metadata; it marks `archivePackagingStatus` as `TARGET_LATER_MANIFEST_ONLY`.
