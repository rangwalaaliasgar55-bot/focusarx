import { Request, Response, NextFunction } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router } from "express";
import { db } from "@workspace/db";
import { pushSubscriptionsTable } from "@workspace/db";
import { extractUserId } from "./auth";
import { eq, and } from "drizzle-orm";
import { initVapid, getVapidPublicKey } from "../lib/pushSender";
import { logger } from "../lib/logger";
import { isUserPremium } from "../lib/premiumCheck";

export const pushRouter = Router();

initVapid();

pushRouter.get("/push/vapid-public-key", (_req, res) => {
  const key = getVapidPublicKey();
  res.json({ publicKey: key });
});

pushRouter.post("/push/subscribe", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { endpoint, keys, expirationTime } = req.body as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    expirationTime?: number | null;
  };

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: "Invalid subscription object" });
  }

  try {
    const [existing] = await db.select().from(pushSubscriptionsTable)
      .where(and(eq(pushSubscriptionsTable.userId, userId), eq(pushSubscriptionsTable.endpoint, endpoint)))
      .limit(1);

    if (!existing) {
      await db.insert(pushSubscriptionsTable).values({
        userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        expiresAt: expirationTime ? new Date(expirationTime) : null,
      });
    }

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "push subscribe error");
    res.status(500).json({ error: "Internal error" });
  }
});

pushRouter.get("/push/preferences", authMiddleware, async (req: AuthRequest, res: Response) => {
  const [subscription] = await db.select({ priorityEnabled: pushSubscriptionsTable.priorityEnabled, sound: pushSubscriptionsTable.sound })
    .from(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.userId, req.userId)).limit(1);
  res.json({ priorityEnabled: subscription?.priorityEnabled ?? false, sound: subscription?.sound ?? "default", premium: await isUserPremium(req.userId) });
});

pushRouter.patch("/push/preferences", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { priorityEnabled, sound } = req.body as { priorityEnabled?: boolean; sound?: string };
  const allowedSounds = ["default", "chime", "focus-bell", "cosmic"];
  if (sound && !allowedSounds.includes(sound)) return res.status(400).json({ error: "Invalid sound" });
  const [subscription] = await db.select({ id: pushSubscriptionsTable.id }).from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.userId, req.userId)).limit(1);
  if (!subscription) return res.status(409).json({ error: "Enable push notifications first" });
  const premium = await isUserPremium(req.userId);
  if (!premium && (priorityEnabled || (sound && sound !== "default"))) return res.status(403).json({ error: "Premium notification controls require Premium" });
  await db.update(pushSubscriptionsTable).set({ priorityEnabled: premium && Boolean(priorityEnabled), sound: premium ? (sound ?? "default") : "default" })
    .where(eq(pushSubscriptionsTable.userId, req.userId));
  res.json({ ok: true, priorityEnabled: premium && Boolean(priorityEnabled), sound: premium ? (sound ?? "default") : "default" });
});

pushRouter.delete("/push/subscribe", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { endpoint } = req.body as { endpoint?: string };
  if (endpoint) {
    await db.delete(pushSubscriptionsTable)
      .where(and(eq(pushSubscriptionsTable.userId, userId), eq(pushSubscriptionsTable.endpoint, endpoint)));
  } else {
    await db.delete(pushSubscriptionsTable)
      .where(eq(pushSubscriptionsTable.userId, userId));
  }
  res.json({ ok: true });
});
