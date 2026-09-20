import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import {
  parseCompletedCheckout,
  parseStripeSignature,
  verifyStripeSignature,
} from "./stripe";

const SECRET = "whsec_test_1234567890abcdef";

function sign(payload: string, ts: number): string {
  return `t=${ts},v1=${createHmac("sha256", SECRET).update(`${ts}.${payload}`, "utf8").digest("hex")}`;
}

describe("stripe webhook verification (no network)", () => {
  const now = 1_700_000_000;

  it("accepts a correctly signed delivery", () => {
    const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });
    expect(verifyStripeSignature(body, sign(body, now), SECRET, now)).toBe(true);
  });

  it("rejects tampered bodies, wrong secrets and stale timestamps", () => {
    const body = JSON.stringify({ id: "evt_1" });
    const header = sign(body, now);
    expect(verifyStripeSignature(`${body} `, header, SECRET, now)).toBe(false);
    expect(verifyStripeSignature(body, header, "whsec_wrong", now)).toBe(false);
    expect(verifyStripeSignature(body, sign(body, now - 600), SECRET, now)).toBe(false);
    expect(verifyStripeSignature(body, "garbage", SECRET, now)).toBe(false);
  });

  it("parses checkout completions into grants, ignoring anything else", () => {
    expect(
      parseCompletedCheckout({
        type: "checkout.session.completed",
        data: { object: { id: "cs_1", customer: "cus_1", metadata: { userId: "u_1", interval: "year" } } },
      }),
    ).toEqual({ sessionId: "cs_1", userId: "u_1", interval: "year", customerId: "cus_1" });
    expect(parseCompletedCheckout({ type: "customer.subscription.deleted" })).toBeNull();
    expect(
      parseCompletedCheckout({ type: "checkout.session.completed", data: { object: { id: "cs_1" } } }),
    ).toBeNull();
  });

  it("rejects malformed signature headers", () => {
    expect(parseStripeSignature(null)).toBeNull();
    expect(parseStripeSignature("t=abc")).toBeNull();
    expect(parseStripeSignature("v1=deadbeef")).toBeNull();
  });
});
