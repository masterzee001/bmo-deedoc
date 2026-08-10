import crypto from "node:crypto";
import { getEvidenceObjectStorage, EvidenceObjectAlreadyExistsError } from "@pics-nigeria/object-storage";
import {
  EVIDENCE_DERIVATIVE_TARGETS,
  EVIDENCE_DERIVATIVE_VIDEO_DEFERRED_REASON,
  type EvidenceDerivativeJobPayload,
} from "@pics-nigeria/shared";
import sharp from "sharp";
import { prisma } from "../prisma";

/**
 * Derivative object keys are derived from the original key so a derivative can
 * always be traced back to its source, and are namespaced under `derivatives/`
 * so they can never collide with an authoritative original.
 */
function derivativeKeyFor(originalKey: string, kind: "THUMBNAIL" | "PREVIEW") {
  return `derivatives/${kind.toLowerCase()}/${originalKey}`;
}

/**
 * Generates preview renditions for an evidence asset.
 *
 * Originals are never modified: this reads the original object, writes new
 * derivative objects under a separate prefix, and records their metadata. If a
 * derivative is lost it can be regenerated, because the original and its
 * server-computed SHA-256 remain the authoritative record.
 *
 * Video is not rendered here. There is no transcoding runtime in this
 * deployment, so video assets record an explicit DEFERRED derivative rather than
 * a silent gap or a misleading FAILED state.
 */
export async function generateEvidenceDerivatives(payload: EvidenceDerivativeJobPayload) {
  const asset = await prisma.evidenceAsset.findUnique({
    where: { id: payload.evidenceAssetId },
    select: {
      id: true,
      evidenceType: true,
      originalStorageKey: true,
      mimeType: true,
      sha256: true,
    },
  });

  if (!asset) {
    // The asset was removed after the job was scheduled. Nothing to do, and
    // failing would only produce a permanent dead letter.
    return { skipped: "EVIDENCE_ASSET_NOT_FOUND" as const };
  }

  if (asset.evidenceType === "WRITTEN_REPORT") {
    return { skipped: "NO_DERIVATIVE_FOR_WRITTEN_REPORT" as const };
  }

  if (asset.evidenceType === "VIDEO") {
    await prisma.evidenceDerivative.upsert({
      where: { evidenceAssetId_kind: { evidenceAssetId: asset.id, kind: "POSTER" } },
      update: { status: "DEFERRED", deferredReason: EVIDENCE_DERIVATIVE_VIDEO_DEFERRED_REASON },
      create: {
        evidenceAssetId: asset.id,
        kind: "POSTER",
        status: "DEFERRED",
        deferredReason: EVIDENCE_DERIVATIVE_VIDEO_DEFERRED_REASON,
      },
    });
    return { deferred: EVIDENCE_DERIVATIVE_VIDEO_DEFERRED_REASON };
  }

  const storage = getEvidenceObjectStorage();
  const original = await storage.getObject(asset.originalStorageKey);
  if (!original) {
    throw new Error(`Evidence original is not readable from object storage: ${asset.originalStorageKey}`);
  }

  // The original is verified before deriving from it. A derivative built from a
  // corrupted or substituted object would silently misrepresent the evidence.
  const originalDigest = crypto.createHash("sha256").update(original.body).digest("hex");
  if (originalDigest !== asset.sha256) {
    throw new Error(`Evidence original hash mismatch for ${asset.id}; refusing to derive from unverified bytes.`);
  }

  const generated: Array<{ kind: "THUMBNAIL" | "PREVIEW"; width: number; height: number; byteSize: number }> = [];

  for (const kind of ["THUMBNAIL", "PREVIEW"] as const) {
    const target = EVIDENCE_DERIVATIVE_TARGETS[kind];
    await prisma.evidenceDerivative.upsert({
      where: { evidenceAssetId_kind: { evidenceAssetId: asset.id, kind } },
      update: { status: "PROCESSING", attempts: { increment: 1 } },
      create: { evidenceAssetId: asset.id, kind, status: "PROCESSING", attempts: 1 },
    });

    try {
      const pipeline = sharp(original.body, { failOn: "error" })
        .rotate()
        .resize({ width: target.width, withoutEnlargement: true })
        .jpeg({ quality: target.quality });
      const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
      const key = derivativeKeyFor(asset.originalStorageKey, kind);
      const sha256 = crypto.createHash("sha256").update(data).digest("hex");

      try {
        await storage.putObjectIfAbsent({
          key,
          body: data,
          contentType: "image/jpeg",
          metadata: { evidenceassetid: asset.id, derivativekind: kind },
        });
      } catch (error) {
        // A derivative that already exists is the expected outcome of a retry.
        // Overwrite is denied by the storage contract, so this is recorded as
        // success rather than treated as a failure.
        if (!(error instanceof EvidenceObjectAlreadyExistsError)) {
          throw error;
        }
      }

      await prisma.evidenceDerivative.update({
        where: { evidenceAssetId_kind: { evidenceAssetId: asset.id, kind } },
        data: {
          status: "READY",
          storageKey: key,
          sha256,
          mimeType: "image/jpeg",
          width: info.width,
          height: info.height,
          byteSize: info.size,
          generatedAt: new Date(),
          lastError: null,
        },
      });
      generated.push({ kind, width: info.width, height: info.height, byteSize: info.size });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await prisma.evidenceDerivative.update({
        where: { evidenceAssetId_kind: { evidenceAssetId: asset.id, kind } },
        data: { status: "FAILED", lastError: message.slice(0, 500) },
      });
      throw error;
    }
  }

  return { generated };
}
