/**
 * Arx companion guardrails (Workstream G, G2) — pure, zero AI keys.
 */
import { describe, it, expect } from "vitest";
import { sanitizeNeverNegative, arxTemplateReply, dailySeoSuggestions } from "./aiTemplates";
import { istDayKey, providerCap } from "./aiBudgetCore";

describe("sanitizeNeverNegative (never-discourage guardrail)", () => {
  it("rewrites direct negatives into supportive language", () => {
    expect(sanitizeNeverNegative("You can't finish this in time.")).not.toMatch(/you can'?t/i);
    expect(sanitizeNeverNegative("This is impossible for you.")).not.toMatch(/impossible/i);
    expect(sanitizeNeverNegative("You are lazy and failing.")).not.toMatch(/lazy|fail/i);
  });

  it("is idempotent", () => {
    const once = sanitizeNeverNegative("You can't do this");
    expect(sanitizeNeverNegative(once)).toBe(once);
  });
});

describe("arxTemplateReply (zero-AI-key path)", () => {
  it("is deterministic per message", () => {
    expect(arxTemplateReply("Arx I am stressed")).toBe(arxTemplateReply("Arx I am stressed"));
  });

  it("is never negative, even for stress input", () => {
    const r = arxTemplateReply("Arx I want to give up I am so tired");
    expect(sanitizeNeverNegative(r)).toBe(r);
    expect(r.length).toBeGreaterThan(30);
  });

  it("varies across different messages", () => {
    const a = new Set(Array.from({ length: 12 }, (_, i) => arxTemplateReply(`message number ${i}`)));
    expect(a.size).toBeGreaterThan(1);
  });
});

describe("istDayKey / providerCap", () => {
  it("computes IST (UTC+5:30) day keys", () => {
    // 2026-08-24T20:00Z is 2026-08-25T01:30 IST → next day.
    expect(istDayKey(new Date("2026-08-24T20:00:00Z"))).toBe("2026-08-25");
    // 2026-08-24T18:00Z is 2026-08-24T23:30 IST → same day.
    expect(istDayKey(new Date("2026-08-24T18:00:00Z"))).toBe("2026-08-24");
  });

  it("caps: gemini 1500/day, groq 3000/day by default", () => {
    expect(providerCap("gemini")).toBe(1500);
    expect(providerCap("groq")).toBe(3000);
  });
});

describe("dailySeoSuggestions (G6 determinism)", () => {
  it("returns 3 distinct keywords per day, stable within the day", () => {
    const a = dailySeoSuggestions("2026-08-24", 3);
    const b = dailySeoSuggestions("2026-08-24", 3);
    expect(a).toEqual(b);
    expect(a).toHaveLength(3);
    expect(new Set(a.map((k) => k.kw)).size).toBe(3);
    for (const k of a) expect(k.angle.length).toBeGreaterThan(5);
  });

  it("rotates as the day or existing-page count changes", () => {
    expect(dailySeoSuggestions("2026-08-24", 3)[0]!.kw).not.toBe(
      dailySeoSuggestions("2026-08-25", 3)[0]!.kw
    );
  });
});

