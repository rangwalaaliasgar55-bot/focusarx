/**
 * Card payments via Stripe (Phase 1 monetisation infra).
 *
 * Env-gated: every entry point 503s with STRIPE_NOT_CONFIGURED until the
 * owner sets STRIPE_SECRET_KEY (+ webhook secret + price ids). No Stripe SDK
 * dependency — Checkout Sessions are created over plain HTTPS, and webhook
 * signatures are verified with node:crypto. Successful checkouts grant the
 * same entitlement rows token purchases do, so gating logic is unchanged.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export type StripeInterval = "month" | "year";

export function stripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_PRICE_PRO_MONTHLY &&
    process.env.STRIPE_PRICE_PRO_YEARLY &&
    process.env.STRIPE_WEBHOOK_SECRET,
  );
}

export function stripeWebhookConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

export function priceForInterval(interval: StripeInterval): string | null {
  const id =
    interval === "year" ? process.env.STRIPE_PRICE_PRO_YEARLY : process.env.STRIPE_PRICE_PRO_MONTHLY;
  return id && id.length > 0 ? id : null;
}

/** Pro duration granted per billing interval. */
export function daysForInterval(interval: StripeInterval): number {
  return interval === "year" ? 365 : 30;
}

interface StripeSig {
  timestamp: number;
  signatures: string[];
}

/** Parse a `Stripe-Signature: t=..,v1=..,v1=..` header. Null when malformed. */
export function parseStripeSignature(header: unknown): StripeSig | null {
  if (typeof header !== "string") return null;
  let timestamp = NaN;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=");
    if (k === "t") timestamp = Number(v);
    else if (k === "v1" && v) signatures.push(v);
  }
  if (!Number.isFinite(timestamp) || signatures.length === 0) return null;
  return { timestamp, signatures };
}

/**
 * Verify a webhook payload. `toleranceSec` (default 300) rejects replayed or
 * pre-played deliveries. Pure — fully unit-testable without network.
 */
export function verifyStripeSignature(
  rawBody: string | Buffer,
  header: unknown,
  secret: string,
  nowSec: number = Math.floor(Date.now() / 1000),
  toleranceSec = 300,
): boolean {
  const parsed = parseStripeSignature(header);
  if (!parsed || !secret) return false;
  if (Math.abs(nowSec - parsed.timestamp) > toleranceSec) return false;
  const signedPayload = `${parsed.timestamp}.${typeof rawBody === "string" ? rawBody : rawBody.toString("utf8")}`;
  const expected = createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");
  return parsed.signatures.some((sig) => {
    try {
      const a = Buffer.from(sig, "hex");
      const b = Buffer.from(expected, "hex");
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  });
}

export interface CompletedCheckout {
  sessionId: string;
  userId: string;
  interval: StripeInterval;
  customerId: string | null;
  subscriptionId: string;
}

/** Extract the grant from a `checkout.session.completed` event. Null when not applicable. */
export function parseCompletedCheckout(event: unknown): CompletedCheckout | null {
  if (typeof event !== "object" || event === null) return null;
  const e = event as { type?: unknown; data?: { object?: unknown } };
  if (e.type !== "checkout.session.completed") return null;
  const o = (e.data?.object ?? {}) as Record<string, unknown>;
  const sessionId = typeof o.id === "string" ? o.id : null;
  const subscriptionId = typeof o.subscription === "string" ? o.subscription : null;
  const metadata = (o.metadata ?? {}) as Record<string, unknown>;
  const userId = typeof metadata.userId === "string" ? metadata.userId : null;
  const interval = metadata.interval === "year" ? "year" : metadata.interval === "month" ? "month" : null;
  // A completed checkout is not an entitlement unless Stripe confirms that the
  // subscription's first invoice was paid. Async/unpaid sessions are ignored.
  if (o.mode !== "subscription" || o.payment_status !== "paid") return null;
  if (!sessionId || !subscriptionId || !userId || !interval) return null;
  return {
    sessionId,
    userId,
    interval,
    customerId: typeof o.customer === "string" ? o.customer : null,
    subscriptionId,
  };
}

export interface PaidInvoice {
  invoiceId: string;
  subscriptionId: string;
  userId: string;
  interval: StripeInterval;
  periodEnd: Date;
}

/** Extract a paid recurring invoice using metadata copied from the subscription. */
export function parsePaidInvoice(event: unknown): PaidInvoice | null {
  if (typeof event !== "object" || event === null) return null;
  const e = event as { type?: unknown; data?: { object?: unknown } };
  if (e.type !== "invoice.paid") return null;
  const o = (e.data?.object ?? {}) as Record<string, unknown>;
  if (o.status !== "paid") return null;
  const invoiceId = typeof o.id === "string" ? o.id : null;
  const parent = (o.parent ?? {}) as Record<string, unknown>;
  const subscriptionDetails = (parent.subscription_details ?? o.subscription_details ?? {}) as Record<string, unknown>;
  const subscriptionId =
    typeof subscriptionDetails.subscription === "string"
      ? subscriptionDetails.subscription
      : typeof o.subscription === "string"
        ? o.subscription
        : null;
  const metadata = (subscriptionDetails.metadata ?? {}) as Record<string, unknown>;
  const userId = typeof metadata.userId === "string" ? metadata.userId : null;
  const interval = metadata.interval === "year" ? "year" : metadata.interval === "month" ? "month" : null;
  const lines = (o.lines ?? {}) as { data?: Array<Record<string, unknown>> };
  const period = (lines.data?.[0]?.period ?? {}) as Record<string, unknown>;
  const periodEndSeconds = typeof period.end === "number" ? period.end : null;
  if (!invoiceId || !subscriptionId || !userId || !interval || !periodEndSeconds) return null;
  const periodEnd = new Date(periodEndSeconds * 1000);
  if (Number.isNaN(periodEnd.getTime())) return null;
  return { invoiceId, subscriptionId, userId, interval, periodEnd };
}

export interface EndedSubscription {
  subscriptionId: string;
  userId: string;
}

/** Subscription deletion is Stripe's terminal cancellation signal. */
export function parseEndedSubscription(event: unknown): EndedSubscription | null {
  if (typeof event !== "object" || event === null) return null;
  const e = event as { type?: unknown; data?: { object?: unknown } };
  if (e.type !== "customer.subscription.deleted") return null;
  const o = (e.data?.object ?? {}) as Record<string, unknown>;
  const metadata = (o.metadata ?? {}) as Record<string, unknown>;
  const subscriptionId = typeof o.id === "string" ? o.id : null;
  const userId = typeof metadata.userId === "string" ? metadata.userId : null;
  return subscriptionId && userId ? { subscriptionId, userId } : null;
}
