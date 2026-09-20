import { Router, type Response } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, paymentCheckoutIntentsTable, premiumEntitlementsTable, premiumSubscriptionsTable } from "@workspace/db";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";
import { daysForInterval } from "../lib/stripe";
import { razorpayAmount, razorpayConfigured, verifyRazorpayPayment } from "../lib/razorpay";

export const razorpayRouter = Router();
const intervalSchema = z.enum(["month", "year"]);
const verifySchema = z.object({
  interval: intervalSchema,
  razorpay_order_id: z.string().min(5).max(100),
  razorpay_payment_id: z.string().min(5).max(100),
  razorpay_signature: z.string().min(32).max(256),
});

razorpayRouter.get("/premium/razorpay/config", (_req, res) => {
  res.json({
    configured: razorpayConfigured(),
    keyId: razorpayConfigured() ? process.env.RAZORPAY_KEY_ID : null,
    currency: "INR",
    amounts: { month: razorpayAmount("month"), year: razorpayAmount("year") },
  });
});

razorpayRouter.post("/premium/razorpay/order", authMiddleware, async (req: AuthRequest, res: Response) => {
  const interval = intervalSchema.safeParse(req.body?.interval);
  if (!interval.success) { res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Choose monthly or annual Pro." } }); return; }
  if (!razorpayConfigured()) { res.status(503).json({ error: { code: "RAZORPAY_NOT_CONFIGURED", message: "UPI payments are not enabled yet." } }); return; }
  const amount = razorpayAmount(interval.data);
  const receipt = `fx_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
  try {
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount, currency: "INR", receipt, notes: { userId: req.userId, interval: interval.data } }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      logger.warn({ status: response.status, body: (await response.text().catch(() => "")).slice(0, 300) }, "razorpay order failed");
      res.status(502).json({ error: { code: "RAZORPAY_ERROR", message: "Could not start UPI checkout." } }); return;
    }
    const order = await response.json() as { id?: string; amount?: number; currency?: string };
    if (!order.id) { res.status(502).json({ error: { code: "RAZORPAY_ERROR", message: "Payment provider returned no order." } }); return; }
    await db.insert(paymentCheckoutIntentsTable).values({
      id: crypto.randomUUID(), userId: req.userId, provider: "razorpay", providerOrderId: order.id,
      interval: interval.data, amountMinor: amount, currency: "INR", status: "pending",
    });
    res.status(201).json({ orderId: order.id, amount, currency: "INR", keyId: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    logger.error({ err }, "razorpay create order error");
    res.status(502).json({ error: { code: "RAZORPAY_ERROR", message: "Could not start UPI checkout." } });
  }
});

razorpayRouter.post("/premium/razorpay/verify", authMiddleware, async (req: AuthRequest, res: Response) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid payment confirmation." } }); return; }
  if (!razorpayConfigured()) { res.status(503).json({ error: { code: "RAZORPAY_NOT_CONFIGURED" } }); return; }
  const data = parsed.data;
  try {
    const [intent] = await db.select().from(paymentCheckoutIntentsTable).where(and(
      eq(paymentCheckoutIntentsTable.provider, "razorpay"),
      eq(paymentCheckoutIntentsTable.providerOrderId, data.razorpay_order_id),
      eq(paymentCheckoutIntentsTable.userId, req.userId),
    )).limit(1);
    if (!intent || intent.interval !== data.interval) { res.status(404).json({ error: { code: "ORDER_NOT_FOUND", message: "This payment order does not belong to your account." } }); return; }
    if (!verifyRazorpayPayment(data.razorpay_order_id, data.razorpay_payment_id, data.razorpay_signature, process.env.RAZORPAY_KEY_SECRET!)) {
      res.status(400).json({ error: { code: "BAD_SIGNATURE", message: "Payment confirmation could not be verified." } }); return;
    }

    // A valid checkout signature proves the response came from Razorpay, but
    // not that an authorised payment was captured. Confirm provider state and
    // capture when the account is configured for manual capture.
    const authorization = `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64")}`;
    let paymentResponse = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(data.razorpay_payment_id)}`, {
      headers: { Authorization: authorization }, signal: AbortSignal.timeout(15_000),
    });
    if (!paymentResponse.ok) { res.status(502).json({ error: { code: "PAYMENT_LOOKUP_FAILED", message: "Payment status could not be confirmed yet." } }); return; }
    let payment = await paymentResponse.json() as { status?: string; order_id?: string; amount?: number; currency?: string };
    if (payment.order_id !== intent.providerOrderId || payment.amount !== intent.amountMinor || payment.currency !== intent.currency) {
      res.status(400).json({ error: { code: "PAYMENT_MISMATCH", message: "Payment details did not match the checkout order." } }); return;
    }
    if (payment.status === "authorized") {
      paymentResponse = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(data.razorpay_payment_id)}/capture`, {
        method: "POST", headers: { Authorization: authorization, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: intent.amountMinor, currency: intent.currency }), signal: AbortSignal.timeout(15_000),
      });
      if (paymentResponse.ok) payment = await paymentResponse.json() as typeof payment;
    }
    if (payment.status !== "captured") { res.status(409).json({ error: { code: "PAYMENT_NOT_CAPTURED", message: "Payment has not been captured. No Pro access was granted." } }); return; }

    const outcome = await db.transaction(async (tx) => {
      const idempotencyKey = `razorpay_${data.razorpay_payment_id}`;
      const [entitlement] = await tx.insert(premiumEntitlementsTable).values({
        userId: req.userId, planId: null, source: "razorpay", status: "active", startsAt: new Date(),
        endsAt: new Date(Date.now() + daysForInterval(data.interval) * 86_400_000), tokenCost: 0, idempotencyKey,
      }).onConflictDoNothing({ target: [premiumEntitlementsTable.idempotencyKey] }).returning({ id: premiumEntitlementsTable.id });
      if (!entitlement) return { replayed: true };

      const [current] = await tx.select().from(premiumSubscriptionsTable).where(eq(premiumSubscriptionsTable.userId, req.userId)).limit(1);
      const base = current?.expiresAt && current.expiresAt.getTime() > Date.now() ? current.expiresAt.getTime() : Date.now();
      const expiresAt = new Date(base + daysForInterval(data.interval) * 86_400_000);
      await tx.update(premiumEntitlementsTable).set({ endsAt: expiresAt }).where(eq(premiumEntitlementsTable.idempotencyKey, idempotencyKey));
      await tx.insert(premiumSubscriptionsTable).values({ userId: req.userId, expiresAt, isActive: true, grantedByAdmin: false }).onConflictDoUpdate({
        target: [premiumSubscriptionsTable.userId], set: { expiresAt, isActive: true },
      });
      await tx.update(paymentCheckoutIntentsTable).set({ status: "completed", providerPaymentId: data.razorpay_payment_id, completedAt: new Date() }).where(eq(paymentCheckoutIntentsTable.id, intent.id));
      return { replayed: false, expiresAt: expiresAt.toISOString() };
    });
    res.json({ verified: true, ...outcome });
  } catch (err) {
    logger.error({ err }, "razorpay verify error");
    res.status(500).json({ error: { code: "PAYMENT_GRANT_FAILED", message: "Payment is recorded, but Pro activation needs support review." } });
  }
});
