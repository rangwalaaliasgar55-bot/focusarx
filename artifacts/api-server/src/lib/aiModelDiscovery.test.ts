/**
 * The AI gateway's self-healing model choice.
 *
 * History: the gateway addressed `gemini-1.5-flash` by name, Google retired it
 * in September 2025, and for months every AI feature in the product answered
 * with template text while the logs said "AI unavailable". The fix was a
 * candidate list, which is the same bug postponed — the list is a *guess* about
 * a remote catalogue that changes without telling anyone.
 *
 * So the gateway now also asks the API what it serves (`models.list`) and ranks
 * the answer. These tests cover the ranking and the selection, which is the part
 * that decides whether a real request goes to a real model; the HTTP call itself
 * is exercised by the admin self-test route against a live key.
 */
import { describe, it, expect } from "vitest";
import { bestGeminiModel, rankGeminiModel, GEMINI_MODEL_CANDIDATES, currentGeminiModel, rememberGeminiModel } from "./aiBudgetCore";

describe("rankGeminiModel", () => {
  it("prefers flash to pro (the request path has an 8s budget and a free tier)", () => {
    expect(rankGeminiModel("gemini-3.8-flash")).toBeGreaterThan(rankGeminiModel("gemini-3.8-pro"));
  });

  it("prefers a newer generation to an older one", () => {
    expect(rankGeminiModel("gemini-3.5-flash")).toBeGreaterThan(rankGeminiModel("gemini-2.5-flash"));
  });

  it("prefers the durable `-latest` alias to a pinned version of the same family", () => {
    expect(rankGeminiModel("gemini-3.5-flash-latest")).toBeGreaterThan(rankGeminiModel("gemini-3.5-flash"));
  });

  it("demotes previews below stable IDs of the same generation", () => {
    expect(rankGeminiModel("gemini-3.5-flash-001")).toBeGreaterThan(rankGeminiModel("gemini-3.5-flash-preview-04-2026"));
    expect(rankGeminiModel("gemini-3.5-flash-preview-04-2026")).toBeGreaterThan(0);
  });

  it("refuses models that cannot serve a text chat at all", () => {
    for (const id of ["text-embedding-004", "imagen-4.0-generate", "gemini-embedding-001", "gemini-2.5-flash-tts"]) {
      expect(rankGeminiModel(id), `${id} must never be selected`).toBe(-1);
    }
  });

  it("ignores shorthands that are not Gemini at all", () => {
    expect(rankGeminiModel("text-bison-001")).toBe(-1);
  });
});

describe("bestGeminiModel", () => {
  it("picks the highest-ranked ID from a models.list response", () => {
    expect(bestGeminiModel([
      "text-embedding-004",
      "gemini-2.5-pro",
      "gemini-3.5-flash",
      "gemini-3.8-flash-latest",
    ])).toBe("gemini-3.8-flash-latest");
  });

  it("returns null when the project can reach nothing usable", () => {
    // A key with only embedding access is a real state, and it must degrade to
    // the Groq leg of the chain rather than picking something unusable.
    expect(bestGeminiModel(["text-embedding-004", "imagen-3.0"])).toBeNull();
    expect(bestGeminiModel([])).toBeNull();
  });

  it("takes bare IDs (the `models/` prefix is stripped by the caller)", () => {
    // `models/gemini-2.5-flash` would not match the ranking's generation
    // pattern, so a prefixed ID must not be passed in — this documents the
    // contract for the caller in aiProvider.ts.
    expect(bestGeminiModel(["models/gemini-2.5-flash"])).toBeNull();
  });
});

describe("the static candidate list", () => {
  it("leads with the aliases Google cannot retire out from under us", () => {
    // An env override, when set, is the operator's explicit choice and wins.
    const first = GEMINI_MODEL_CANDIDATES[0]!;
    expect(first.startsWith("gemini-")).toBe(true);
    if (!process.env.GEMINI_MODEL) {
      expect(first.endsWith("-latest"), "the first guess should be a floating alias").toBe(true);
    }
  });

  it("remembers the model that answered instead of re-probing every request", () => {
    const before = currentGeminiModel();
    rememberGeminiModel("gemini-test-probe");
    expect(currentGeminiModel()).toBe("gemini-test-probe");
    rememberGeminiModel(before);
  });
});
