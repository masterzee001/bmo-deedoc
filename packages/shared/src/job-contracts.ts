/**
 * Background job contracts shared by the API (producer) and the worker
 * (consumer).
 *
 * PostgreSQL is authoritative for what must run: the API writes a durable
 * `BackgroundJob` row and never requires Redis to accept work. The worker reads
 * those rows, executes them through BullMQ for concurrency, retry, and backoff,
 * and writes the outcome back. Losing Redis therefore delays background work
 * rather than dropping it.
 */

export const BACKGROUND_QUEUES = ["evidence-derivatives", "realtime-outbox", "maintenance"] as const;

export type BackgroundQueue = (typeof BACKGROUND_QUEUES)[number];

export const BACKGROUND_JOB_NAMES = [
  "evidence.derivatives.generate",
  "realtime.outbox.replay",
  "maintenance.jobs.sweep",
] as const;

export type BackgroundJobName = (typeof BACKGROUND_JOB_NAMES)[number];

export const BACKGROUND_JOB_QUEUE_BY_NAME: Record<BackgroundJobName, BackgroundQueue> = {
  "evidence.derivatives.generate": "evidence-derivatives",
  "realtime.outbox.replay": "realtime-outbox",
  "maintenance.jobs.sweep": "maintenance",
};

export type EvidenceDerivativeJobPayload = {
  evidenceAssetId: string;
};

export type RealtimeOutboxReplayJobPayload = {
  /** Bounded batch so a large backlog cannot monopolize a worker. */
  limit?: number;
};

export type MaintenanceSweepJobPayload = {
  /** Jobs stuck in PROCESSING beyond this age are returned to PENDING. */
  staleProcessingMinutes?: number;
};

export type BackgroundJobPayloadByName = {
  "evidence.derivatives.generate": EvidenceDerivativeJobPayload;
  "realtime.outbox.replay": RealtimeOutboxReplayJobPayload;
  "maintenance.jobs.sweep": MaintenanceSweepJobPayload;
};

/**
 * Derivative renditions produced from an evidence original.
 *
 * A derivative is never authoritative. The original object and its
 * server-computed SHA-256 remain the evidentiary record, and every derivative is
 * regenerable from that original.
 */
export const EVIDENCE_DERIVATIVE_KINDS = ["THUMBNAIL", "PREVIEW", "POSTER"] as const;

export type EvidenceDerivativeKind = (typeof EVIDENCE_DERIVATIVE_KINDS)[number];

export const EVIDENCE_DERIVATIVE_STATUSES = ["PENDING", "PROCESSING", "READY", "FAILED", "DEFERRED"] as const;

export type EvidenceDerivativeStatus = (typeof EVIDENCE_DERIVATIVE_STATUSES)[number];

export const BACKGROUND_JOB_STATUSES = ["PENDING", "PROCESSING", "COMPLETED", "FAILED", "DEAD_LETTER"] as const;

export type BackgroundJobStatus = (typeof BACKGROUND_JOB_STATUSES)[number];

/** Target pixel widths for image renditions. Height follows the source aspect ratio. */
export const EVIDENCE_DERIVATIVE_TARGETS: Record<"THUMBNAIL" | "PREVIEW", { width: number; quality: number }> = {
  THUMBNAIL: { width: 320, quality: 72 },
  PREVIEW: { width: 1280, quality: 82 },
};

/**
 * Reason recorded on a DEFERRED derivative. Video rendition requires a media
 * transcoding runtime that is not part of this deployment, so video evidence
 * records an explicit deferral instead of a silent gap or a false failure.
 */
export const EVIDENCE_DERIVATIVE_VIDEO_DEFERRED_REASON = "VIDEO_TRANSCODE_RUNTIME_NOT_DEPLOYED";

export type EvidenceDerivativeItem = {
  id: string;
  evidenceAssetId: string;
  kind: EvidenceDerivativeKind;
  status: EvidenceDerivativeStatus;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  byteSize: number | null;
  sha256: string | null;
  deferredReason: string | null;
  generatedAt: string | null;
};

export type BackgroundJobHealth = {
  queue: BackgroundQueue;
  pending: number;
  processing: number;
  failed: number;
  deadLetter: number;
  oldestPendingAgeSeconds: number | null;
};
