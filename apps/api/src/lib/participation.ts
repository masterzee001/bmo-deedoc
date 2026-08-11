import { RewardEventStatus, RewardLedgerCategory, RewardQualifyingEvent, type Prisma } from "@prisma/client";

type RecordParticipationInput = {
  voterUserId: string;
  type: string;
  description: string;
  pointsAwarded: number;
  relatedPollId?: string | null;
  relatedPostId?: string | null;
};

/**
 * Records a participation event and credits the authoritative ledger.
 *
 * This previously wrote to the legacy `RewardLedger`, which produced a second
 * balance that the payout module could not see and the redemption module paid
 * against. The legacy ledger is now read-only, so participation earnings land
 * in `RewardLedgerEntry` like every other earning.
 *
 * The participation event id is the idempotency key: a duplicate poll response
 * or post interaction cannot mint a second credit, because both the event and
 * the reward event are keyed on it.
 */
export async function recordParticipationAndReward(
  transaction: Prisma.TransactionClient,
  input: RecordParticipationInput,
) {
  const existingEvent = await transaction.participationEvent.findFirst({
    where: {
      voterUserId: input.voterUserId,
      type: input.type,
      relatedPollId: input.relatedPollId || null,
      relatedPostId: input.relatedPostId || null,
    },
    select: { id: true },
  });

  if (existingEvent) {
    return { created: false, eventId: existingEvent.id };
  }

  const event = await transaction.participationEvent.create({
    data: {
      voterUserId: input.voterUserId,
      type: input.type,
      description: input.description,
      pointsAwarded: input.pointsAwarded,
      relatedPollId: input.relatedPollId || null,
      relatedPostId: input.relatedPostId || null,
    },
  });

  // Zero-point participation is still recorded as an event, but posts no ledger
  // entry: an entry worth nothing would only add noise to the financial record.
  if (input.pointsAwarded <= 0) {
    return { created: true, eventId: event.id };
  }

  const rewardEvent = await transaction.rewardEvent.upsert({
    where: {
      eventType_sourceType_sourceId: {
        eventType: RewardQualifyingEvent.PARTICIPATION_APPROVED,
        sourceType: "ParticipationEvent",
        sourceId: event.id,
      },
    },
    create: {
      eventType: RewardQualifyingEvent.PARTICIPATION_APPROVED,
      sourceType: "ParticipationEvent",
      sourceId: event.id,
      status: RewardEventStatus.PENDING,
      idempotencyKey: `participation:${event.id}`,
    },
    update: {},
  });

  await transaction.rewardLedgerEntry.upsert({
    where: {
      userId_sourceEventId_category: {
        userId: input.voterUserId,
        sourceEventId: rewardEvent.id,
        category: RewardLedgerCategory.APPROVED_PARTICIPATION,
      },
    },
    create: {
      userId: input.voterUserId,
      points: input.pointsAwarded,
      category: RewardLedgerCategory.APPROVED_PARTICIPATION,
      sourceEventType: RewardQualifyingEvent.PARTICIPATION_APPROVED,
      sourceEventId: rewardEvent.id,
      description: input.description,
    },
    update: {},
  });

  await transaction.rewardEvent.update({
    where: { id: rewardEvent.id },
    data: { status: RewardEventStatus.PROCESSED, processedAt: new Date() },
  });

  return { created: true, eventId: event.id };
}
