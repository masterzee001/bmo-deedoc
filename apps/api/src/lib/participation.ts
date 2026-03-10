import { RewardType, type Prisma } from "@prisma/client";

type RecordParticipationInput = {
  voterUserId: string;
  type: string;
  description: string;
  pointsAwarded: number;
  relatedPollId?: string | null;
  relatedPostId?: string | null;
};

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

  await transaction.rewardLedger.create({
    data: {
      voterUserId: input.voterUserId,
      type: RewardType.PARTICIPATION,
      points: input.pointsAwarded,
      description: input.description,
    },
  });

  return { created: true, eventId: event.id };
}
