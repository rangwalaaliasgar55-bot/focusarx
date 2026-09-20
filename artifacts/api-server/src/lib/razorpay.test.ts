import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { razorpayAmount, verifyRazorpayPayment } from "./razorpay";

describe("Razorpay payment verification", () => {
  it("accepts the documented order|payment HMAC and rejects tampering", () => {
    const signature = createHmac("sha256", "secret").update("order_1|pay_1").digest("hex");
    expect(verifyRazorpayPayment("order_1", "pay_1", signature, "secret")).toBe(true);
    expect(verifyRazorpayPayment("order_1", "pay_2", signature, "secret")).toBe(false);
    expect(verifyRazorpayPayment("order_1", "pay_1", "not-hex", "secret")).toBe(false);
  });

  it("uses launch prices when optional amount env vars are absent", () => {
    const monthly = process.env.RAZORPAY_AMOUNT_PRO_MONTHLY_PAISE;
    const yearly = process.env.RAZORPAY_AMOUNT_PRO_YEARLY_PAISE;
    delete process.env.RAZORPAY_AMOUNT_PRO_MONTHLY_PAISE;
    delete process.env.RAZORPAY_AMOUNT_PRO_YEARLY_PAISE;
    expect(razorpayAmount("month")).toBe(19_900);
    expect(razorpayAmount("year")).toBe(149_900);
    if (monthly) process.env.RAZORPAY_AMOUNT_PRO_MONTHLY_PAISE = monthly;
    if (yearly) process.env.RAZORPAY_AMOUNT_PRO_YEARLY_PAISE = yearly;
  });
});
