import { NotificationType, type Prisma } from "@prisma/client";

type NotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
};

export async function createNotification(
  transaction: Prisma.TransactionClient,
  input: NotificationInput,
) {
  return transaction.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
    },
  });
}
