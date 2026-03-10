import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../prisma";
import { serializeNotificationItem } from "../lib/serializers";

const router = Router();

const notificationIdSchema = z.object({
  notificationId: z.string().trim().min(1),
});

router.get("/", requireAuth, async (request, response) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: request.authUser!.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return response.json({
    notifications: notifications.map(serializeNotificationItem),
  });
});

router.patch("/:notificationId/read", requireAuth, async (request, response) => {
  const parsed = notificationIdSchema.safeParse(request.params);
  if (!parsed.success) {
    return response.status(400).json({ message: "Invalid notification id." });
  }

  const notification = await prisma.notification.findFirst({
    where: {
      id: parsed.data.notificationId,
      userId: request.authUser!.id,
    },
  });

  if (!notification) {
    return response.status(404).json({ message: "Notification was not found." });
  }

  const updated = await prisma.notification.update({
    where: { id: notification.id },
    data: { isRead: true },
  });

  return response.json({
    message: "Notification marked as read.",
    notification: serializeNotificationItem(updated),
  });
});

router.patch("/read-all", requireAuth, async (request, response) => {
  await prisma.notification.updateMany({
    where: { userId: request.authUser!.id, isRead: false },
    data: { isRead: true },
  });

  return response.json({ message: "All notifications marked as read." });
});

export default router;
