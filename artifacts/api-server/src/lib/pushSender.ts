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
  const email = process.env["VAPID_EMAIL"] || "mailto:focusarx@gmail.com";

  if (pubKey && privKey) {
    webpush.setVapidDetails(email, pubKey, privKey);
    vapidInitialized = true;
    return;
  }

  // No stable keys configured: fall back to an ephemeral per-instance pair so
  // push still works within this process. Never print generated key material
  // into logs — it looks like a leaked secret and is useless on other
  // instances anyway. Tell the operator how to pin a stable pair instead.
  const keys = webpush.generateVAPIDKeys();
  logger.warn(
    "[VAPID] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY not set — using an ephemeral per-instance key pair; " +
      "push subscriptions will stop working on the next cold start. Generate a stable pair with " +
      "`npx web-push generate-vapid-keys` and set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (and optionally VAPID_EMAIL).",
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
        JSON.stringify({ title: payload.title, body: payload.body, url: payload.url || "/", priority: sub.priorityEnabled, sound: sub.sound })
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
