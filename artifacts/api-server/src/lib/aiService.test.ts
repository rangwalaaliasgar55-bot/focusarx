import { describe, expect, it } from "vitest";
import type {
  AiProvider,
  AiTextRequest,
  ModerationRequest,
  ModerationResponse,
} from "./aiService";
import { defaultAiProvider } from "./aiService";

/**
 * Contract tests for the provider-independent AiProvider interface.
 * The fake provider proves callers can be fully tested without keys or
 * network; the default adapter proves the real gateway satisfies the contract
 * in its zero-key degradation mode (no network calls are attempted without
 * keys, so these run safely in CI).
 */

function fakeProvider(overrides: Partial<AiProvider> = {}): AiProvider {
  return {
    generateText: async (req: AiTextRequest) =>
      req.forceTemplate
        ? null
        : { text: "ok", provider: "groq", model: "test-model", source: "llm", fallbackUsed: false },
    moderate: async (_req: ModerationRequest): Promise<ModerationResponse> =>
      ({ status: "approved", reason: "Clean", method: "keyword" }),
    ...overrides,
  };
}

describe("AiProvider interface (fake injection)", () => {
  it("returns deterministic text without touching the network", async () => {
    const provider = fakeProvider();
    const result = await provider.generateText({ purpose: "test", prompt: "hello" });
    expect(result).not.toBeNull();
    expect(result?.source).toBe("llm");
    expect(result?.text).toBe("ok");
  });

  it("supports forceTemplate as a hard skip", async () => {
    const provider = fakeProvider();
    const result = await provider.generateText({ purpose: "test", prompt: "hello", forceTemplate: true });
    expect(result).toBeNull();
  });

  it("always resolves moderation with a verdict", async () => {
    const provider = fakeProvider();
    const verdict = await provider.moderate({ text: "anything" });
    expect(["approved", "flagged", "rejected"]).toContain(verdict.status);
    expect(verdict.reason.length).toBeGreaterThan(0);
  });

  it("allows outage injection: generateText resolves null, moderate still works", async () => {
    const provider = fakeProvider({
      generateText: async () => null,
    });
    expect(await provider.generateText({ purpose: "test", prompt: "x" })).toBeNull();
    expect((await provider.moderate({ text: "x" })).status).toBe("approved");
  });
});

describe("defaultAiProvider (real adapter, zero-key degradation)", () => {
  it("generateText resolves null (never throws) when no keys are configured", async () => {
    const hadGemini = Boolean(process.env.GEMINI_API_KEY);
    const hadGroq = Boolean(process.env.GROQ_API_KEY);
    try {
      delete process.env.GEMINI_API_KEY;
      delete process.env.GROQ_API_KEY;
      const result = await defaultAiProvider.generateText({ purpose: "contract_test", prompt: "hello" });
      expect(result).toBeNull();
    } finally {
      if (hadGemini) process.env.GEMINI_API_KEY = "x";
      if (hadGroq) process.env.GROQ_API_KEY = "x";
    }
  });

  it("moderate resolves a verdict via the always-on keyword layer", async () => {
    const verdict = await defaultAiProvider.moderate({ text: "just a normal study update" });
    expect(["approved", "flagged", "rejected"]).toContain(verdict.status);

    const blocked = await defaultAiProvider.moderate({ text: "this contains fuck" });
    expect(blocked.status).toBe("rejected");
    expect(blocked.method).toBe("keyword");
  });
});
