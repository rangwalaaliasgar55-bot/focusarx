import { createHmac, timingSafeEqual } from "node:crypto";

export type RazorpayInterval = "month" | "year";

export function razorpayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export function razorpayAmount(interval: RazorpayInterval): number {
  const configured = interval === "year"
    ? process.env.RAZORPAY_AMOUNT_PRO_YEARLY_PAISE
    : process.env.RAZORPAY_AMOUNT_PRO_MONTHLY_PAISE;
  const fallback = interval === "year" ? 149_900 : 19_900;
  const amount = Number(configured ?? fallback);
  return Number.isInteger(amount) && amount >= 100 && amount <= 100_000_000 ? amount : fallback;
}

export function verifyRazorpayPayment(orderId: string, paymentId: string, signature: string, secret: string): boolean {
  if (!orderId || !paymentId || !signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`, "utf8").digest("hex");
  try {
    const supplied = Buffer.from(signature, "hex");
    const correct = Buffer.from(expected, "hex");
    return supplied.length === correct.length && timingSafeEqual(supplied, correct);
  } catch {
    return false;
  }
}
