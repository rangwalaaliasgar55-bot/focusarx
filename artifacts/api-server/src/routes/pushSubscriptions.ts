import { Router } from "express";
import { db } from "@workspace/db";
import { pushSubscriptionsTable } from "@workspace/db";
import { extractUserId } from "./auth";
import { eq, and } from "drizzle-orm";
import { initVapid, getVapidPublicKey } from "../lib/pushSender";
import { logger } from "../lib/logger";

function auth(req: any, res: any, next: any) {
  const userId = extractUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  req.userId = userId;
  next();
}

export const pushRouter = Router();

initVapid();

pushRouter.get("/push/vapid-public-key", (_req, res) => {
  const key = getVapidPublicKey();
  res.json({ publicKey: key });
});

pushRouter.post("/push/subscribe", auth, async (req: any, res) => {
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

pushRouter.delete("/push/subscribe", auth, async (req: any, res) => {
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
