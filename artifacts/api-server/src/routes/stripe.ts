import { Router } from "express";
import { z } from "zod";
import { db, premiumEntitlementsTable, premiumSubscriptionsTable } from "@workspace/db";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";
import {
  daysForInterval,
  parseCompletedCheckout,
  priceForInterval,
  stripeConfigured,
  stripeWebhookConfigured,
  verifyStripeSignature,
} from "../lib/stripe";

const router = Router();

const checkoutSchema = z.object({
  interval: z.enum(["month", "year"]).default("month"),
  successUrl: z.string().url().max(500).optional(),
  cancelUrl: z.string().url().max(500).optional(),
});

function appBaseUrl(): string {
  const configured = (process.env.APP_URL || "").replace(/\/+$/, "");
  if (configured) return configured;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "https://focusarx.site";
}

/** Public: does card checkout exist right now? (Drives the /premium UI.) */
router.get("/premium/stripe/config", (_req, res) => {
  res.json({ configured: stripeConfigured() });
});

/** Create a Checkout Session (auth). 503 until the owner configures Stripe. */
router.post("/premium/stripe/checkout", authMiddleware, async (req: AuthRequest, res) => {
  if (!stripeConfigured()) {
    res.status(503).json({ error: { code: "STRIPE_NOT_CONFIGURED", message: "Card payments are not enabled yet" } });
    return;
  }
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid checkout request" } });
    return;
  }
  const price = priceForInterval(parsed.data.interval);
  if (!price) {
    res.status(503).json({ error: { code: "STRIPE_PRICE_MISSING", message: "That billing interval is not configured" } });
    return;
  }
  const base = appBaseUrl();
  const params = new URLSearchParams({
    "payment_method_types[0]": "card",
    mode: "subscription",
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    success_url: parsed.data.successUrl ?? `${base}/premium?stripe=success`,
    cancel_url: parsed.data.cancelUrl ?? `${base}/premium?stripe=cancelled`,
    "metadata[userId]": req.userId!,
    "metadata[interval]": parsed.data.interval,
    "subscription_data[metadata][userId]": req.userId!,
    "subscription_data[metadata][interval]": parsed.data.interval,
  });
  try {
    const resp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": `checkout_${req.userId}_${parsed.data.interval}_${Math.floor(Date.now() / 60000)}`,
      },
      body: params.toString(),
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      logger.warn({ status: resp.status, body: text.slice(0, 300) }, "stripe checkout failed");
      res.status(502).json({ error: { code: "STRIPE_ERROR", message: "Could not start checkout" } });
      return;
    }
    const data = (await resp.json()) as { url?: string };
    if (!data.url) {
      res.status(502).json({ error: { code: "STRIPE_ERROR", message: "Checkout returned no URL" } });
      return;
    }
    res.json({ url: data.url });
  } catch (err) {
    logger.error({ err }, "stripe checkout error");
    res.status(502).json({ error: { code: "STRIPE_ERROR", message: "Could not start checkout" } });
  }
});

/**
 * Stripe webhook. Signature-verified with the raw body (captured in app.ts
 * via express.json `verify`). Unknown/unverifiable deliveries are 400ed so
 * Stripe retries; handled events are idempotent via the unique
 * `stripe_<sessionId>` key — replays return the existing entitlement.
 */
router.post("/stripe/webhook", async (req, res) => {
  if (!stripeWebhookConfigured()) {
    res.status(503).json({ error: { code: "STRIPE_NOT_CONFIGURED" } });
    return;
  }
  const raw: Buffer | undefined = (req as { rawBody?: Buffer }).rawBody;
  const signature = req.headers["stripe-signature"];
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  if (!raw || !verifyStripeSignature(raw, signature, secret)) {
    res.status(400).json({ error: { code: "BAD_SIGNATURE", message: "Invalid webhook signature" } });
    return;
  }
  let event: unknown;
  try {
    event = JSON.parse(raw.toString("utf8"));
  } catch {
    res.status(400).json({ error: { code: "INVALID_JSON" } });
    return;
  }

  const grant = parseCompletedCheckout(event);
  if (!grant) {
    // Includes subscription lifecycle events we intentionally ignore for now.
    res.json({ received: true, handled: false });
    return;
  }

  try {
    const endsAt = new Date(Date.now() + daysForInterval(grant.interval) * 86_400_000);
    const idempotencyKey = `stripe_${grant.sessionId}`;
    const result = await db.transaction(async (tx) => {
      const inserted = await tx.insert(premiumEntitlementsTable).values({
        userId: grant.userId,
        planId: null,
        source: "stripe",
        status: "active",
        startsAt: new Date(),
        endsAt,
        tokenCost: 0,
        idempotencyKey,
      }).onConflictDoNothing({ target: [premiumEntitlementsTable.idempotencyKey] }).returning();
      if (inserted.length === 0) {
        return { replay: true as const };
      }
      await tx.insert(premiumSubscriptionsTable).values({
        userId: grant.userId,
        expiresAt: endsAt,
        isActive: true,
        grantedByAdmin: false,
      }).onConflictDoUpdate({
        target: [premiumSubscriptionsTable.userId],
        set: { expiresAt: endsAt, isActive: true },
      });
      return { replay: false as const };
    });
    logger.info({ userId: grant.userId, interval: grant.interval, replay: result.replay }, "stripe premium granted");
    res.json({ received: true, handled: true, replay: result.replay });
  } catch (err) {
    logger.error({ err }, "stripe grant failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
  }
});

export { router as stripeRouter };
