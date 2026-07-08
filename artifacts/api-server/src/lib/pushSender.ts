import webpush from "web-push";
import { db } from "@workspace/db";
import { pushSubscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

let vapidInitialized = false;

export function initVapid() {
  if (vapidInitialized) return;
  const pubKey = process.env["VAPID_PUBLIC_KEY"];
  const privKey = process.env["VAPID_PRIVATE_KEY"];
  const email = process.env["VAPID_EMAIL"] || "mailto:admin@focusarx.app";

  if (pubKey && privKey) {
    webpush.setVapidDetails(email, pubKey, privKey);
    vapidInitialized = true;
    return;
  }

  const keys = webpush.generateVAPIDKeys();
  logger.info(
    `\n[VAPID] Keys not set. Add these to your .env:\nVAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\nVAPID_EMAIL=mailto:admin@focusarx.app`
  );
  webpush.setVapidDetails(email, keys.publicKey, keys.privateKey);
  vapidInitialized = true;
}

export function getVapidPublicKey(): string {
  return process.env["VAPID_PUBLIC_KEY"] ?? "";
}

export async function sendPush(
  userId: string,
  payload: { title: string; body: string; url?: string }
) {
  initVapid();
  const subs = await db.select().from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.userId, userId));

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title: payload.title, body: payload.body, url: payload.url || "/" })
      );
    } catch (err: any) {
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        await db.delete(pushSubscriptionsTable)
          .where(eq(pushSubscriptionsTable.id, sub.id)).catch(() => {});
      } else {
        logger.warn({ err, userId }, "push send failed");
      }
    }
  }
}
