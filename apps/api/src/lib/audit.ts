import type { Prisma, PrismaClient } from "@prisma/client";

type AuditInput = {
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
};

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
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}
