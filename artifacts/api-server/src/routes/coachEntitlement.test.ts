/**
 * The coach is reachable by a free student — enforced, not just intended.
 *
 * The bug this file exists to prevent is a *pair* of guards that agreed with
 * each other and disagreed with the product: `requirePremium` on
 * `POST /coach/chat` and a client-side `isLocked` that refused to send. Nothing
 * failed, nothing logged, and the only visible symptom was a student reading
 * "Focus Coach is Premium-only" — which is indistinguishable from an AI that
 * does not work, and was reported as exactly that.
 *
 * Two invariants, both source-level because they are about wiring:
 *   1. no `requirePremium` on the coach's chat/tip routes (the entitlement is a
 *      daily allowance, not a wall);
 *   2. the allowance is real — a positive free limit exists and the route
 *      returns it, so the panel can show "N left today" instead of a paywall.
 *
 * `CoachPanel.access.test.tsx` in the frontend covers the other half (that the
 * client actually sends a free student's message).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const coachSource = readFileSync(path.join(here, "coach.ts"), "utf8");

/** Strip comments so prose about the old behaviour cannot satisfy an assertion. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

const coachCode = code(coachSource);

describe("coach entitlement", () => {
  it("does not put a premium wall in front of the chat", () => {
    const chat = coachCode.slice(coachCode.indexOf('router.post("/coach/chat"'));
    const registration = chat.slice(0, chat.indexOf("async (req"));
    expect(registration).toContain("authMiddleware");
    expect(registration).toContain("premiumStatusMiddleware");
    expect(registration).not.toContain("requirePremium");
  });

  it("does not gate the session tip either", () => {
    for (const route of ['router.get("/coach/session-tip"', 'router.post("/coach/session-tip"']) {
      const start = coachCode.indexOf(route);
      expect(start, `${route} is missing`).toBeGreaterThan(-1);
      const registration = coachCode.slice(start, coachCode.indexOf(");", start));
      expect(registration).not.toContain("requirePremium");
    }
  });

  it("gives a free account a usable daily allowance", () => {
    const free = Number(/COACH_DAILY_FREE = (\d+)/.exec(coachCode)?.[1]);
    expect(Number.isFinite(free), "COACH_DAILY_FREE is not declared").toBe(true);
    // Enough to plan a session, ask a follow-up and try a second task. One or
    // two messages is a demo, not a usable feature.
    expect(free).toBeGreaterThanOrEqual(5);
    const premium = Number(/COACH_DAILY_PREMIUM = (\d+)/.exec(coachCode)?.[1]);
    expect(premium).toBeGreaterThan(free);
  });

  it("reports the allowance on every reply so the panel never has to guess", () => {
    // The chat reply carries the count; the status endpoint carries it too, so
    // the panel can render "N left today" before the first message as well.
    expect(coachCode).toContain("allowance: { used: coachUsed + 1");
    const status = coachCode.slice(coachCode.indexOf('router.get("/coach/status"'));
    expect(status.slice(0, 1200)).toMatch(/allowance,/);
  });

  it("keeps the abuse guardrails that make a free tier safe to open", () => {
    // Opening the coach must not mean opening the wallet: the per-IP daily cap,
    // input sanitisation and prompt-injection detection all stay in the path.
    expect(coachCode).toContain("checkIpLimit(ip)");
    expect(coachCode).toContain("sanitizeAiInput(rawMessage)");
    expect(coachCode).toContain("detectPromptInjection(rawMessage)");
    // And the model call itself is still budget-checked through the gateway.
    expect(coachCode).toContain("generateAi({");
  });

  it("still answers with the offline coach when no model is reachable", () => {
    // A dead provider must produce an answer that performs the request, not a
    // question back and not a motivational quote.
    expect(coachCode).toContain("builtinReply(sanitized)");
    const builtin = coachCode.slice(coachCode.indexOf("function builtinReply"), coachCode.indexOf("export const COACH_DAILY_FREE"));
    expect(builtin).toMatch(/asksForPlan/);
    expect(builtin).toMatch(/asksForBreakdown/);
    // No question marks in the *replies*: "let me know if…" instead of an answer
    // is the exact reading a student reported as "the AI does not do what I ask".
    // (Regex literals elsewhere in the function legitimately use `?`.)
    const replies = builtin.match(/return "[^"]*"/g) ?? [];
    expect(replies.length).toBeGreaterThan(4);
    for (const reply of replies) {
      expect(reply.includes("?"), `offline reply asks a question instead of answering: ${reply}`).toBe(false);
      expect(reply.length, `offline reply is too short to be an answer: ${reply}`).toBeGreaterThan(80);
    }
  });
});
