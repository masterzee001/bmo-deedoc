import type { Prisma, PrismaClient } from "@prisma/client";

type AuditInput = {
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
  politicalPartyId?: string | null;
  territory?: {
    geoPoliticalZoneId?: string | null;
    stateId?: string | null;
    senatorialDistrictId?: string | null;
    federalConstituencyId?: string | null;
    lgaId?: string | null;
    wardId?: string | null;
    stateConstituencyId?: string | null;
    pollingUnitId?: string | null;
  };
};

function buildAuditMetadata(input: AuditInput): string | null {
  const metadata: Record<string, unknown> = {
    ...(input.metadata || {}),
  };

  if (input.politicalPartyId !== undefined) {
    metadata.politicalPartyId = input.politicalPartyId;
  }

  if (input.territory) {
    metadata.territory = {
      geoPoliticalZoneId: input.territory.geoPoliticalZoneId || null,
      stateId: input.territory.stateId || null,
      senatorialDistrictId: input.territory.senatorialDistrictId || null,
      federalConstituencyId: input.territory.federalConstituencyId || null,
      lgaId: input.territory.lgaId || null,
      wardId: input.territory.wardId || null,
      stateConstituencyId: input.territory.stateConstituencyId || null,
      pollingUnitId: input.territory.pollingUnitId || null,
    };
  }

  return Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null;
}

export async function createAuditLog(
  transaction: Prisma.TransactionClient | PrismaClient,
  input: AuditInput,
) {
  return transaction.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadataJson: buildAuditMetadata(input),
    },
  });
}
