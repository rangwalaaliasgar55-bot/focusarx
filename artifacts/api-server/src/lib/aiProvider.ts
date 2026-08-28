/**
 * Unified LLM gateway (Workstream G).
 *
 * One entry point for every AI feature: budget-checked, timed (8s),
 * retried once, logged to ai_call_log, with a Gemini → Groq fallback
 * chain. Callers that can degrade get `null` back and serve templates —
 * the product is fully functional with zero AI keys.
 */
import { checkBudget, recordCall, recordRateLimit, MODELS, type AiProvider } from "./aiBudget";
import { logger } from "./logger";

export interface AiRequest {
  purpose: string; // "arx_reply" | "briefing" | "seo" | "ideas" | "console" | ...
  prompt: string;
  system?: string;
  /** Ask for strict JSON (Gemini responseMimeType / Groq response_format). */
  json?: boolean;
  maxTokens?: number;
  userId?: string | null;
  /** Skip the LLM entirely (template-only caller). */
  forceTemplate?: boolean;
}

export interface AiResult {
  text: string;
  provider: AiProvider;
  model: string;
  source: "llm" | "template";
  fallbackUsed: boolean;
  tokensIn?: number;
  tokensOut?: number;
}

const TIMEOUT_MS = 8000;

async function withTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("ai timeout")), ms);
  });
  try {
    return await Promise.race([fn(), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  error?: { code?: number; message?: string };
}

async function callGemini(req: AiRequest, purpose: string, userId?: string | null): Promise<AiResult | "rate_limited" | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const model = MODELS.gemini;
  const t0 = Date.now();
  try {
    const body: Record<string, unknown> = {
      contents: [{ role: "user", parts: [{ text: req.prompt }] }],
      generationConfig: {
        maxOutputTokens: req.maxTokens ?? 512,
        ...(req.json ? { responseMimeType: "application/json" } : {}),
      },
    };
    if (req.system) body.systemInstruction = { parts: [{ text: req.system }] };

    const resp = await withTimeout(
      () =>
        fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      TIMEOUT_MS
    );

    if (resp.status === 429) {
      await recordCall({ provider: "gemini", model, purpose, userId, latencyMs: Date.now() - t0, status: "rate_limited" });
      void recordRateLimit("gemini");
      return "rate_limited";
    }
    if (!resp.ok) {
      await recordCall({ provider: "gemini", model, purpose, userId, latencyMs: Date.now() - t0, status: "error" });
      return null;
    }
    const data = (await resp.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    await recordCall({
      provider: "gemini",
      model,
      purpose,
      userId,
      tokensIn: data.usageMetadata?.promptTokenCount ?? 0,
      tokensOut: data.usageMetadata?.candidatesTokenCount ?? 0,
      latencyMs: Date.now() - t0,
    });
    return text
      ? { text, provider: "gemini", model, source: "llm", fallbackUsed: false }
      : null;
  } catch (err) {
    await recordCall({ provider: "gemini", model, purpose, userId, latencyMs: Date.now() - t0, status: "error" });
    logger.warn({ err, purpose }, "gemini call failed");
    return null;
  }
}

interface GroqResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
}

async function callGroq(req: AiRequest, purpose: string, fallbackUsed: boolean, userId?: string | null): Promise<AiResult | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  const model = MODELS.groq;
  const t0 = Date.now();
  try {
    const resp = await withTimeout(
      () =>
        fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            max_tokens: req.maxTokens ?? 512,
            ...(req.json ? { response_format: { type: "json_object" } } : {}),
            messages: [
              ...(req.system ? [{ role: "system", content: req.system }] : []),
              { role: "user", content: req.prompt },
            ],
          }),
        }),
      TIMEOUT_MS
    );
    if (!resp.ok) {
      await recordCall({ provider: "groq", model, purpose, userId, latencyMs: Date.now() - t0, status: "error", fallbackUsed });
      return null;
    }
    const data = (await resp.json()) as GroqResponse;
    const text = data.choices?.[0]?.message?.content ?? "";
    await recordCall({
      provider: "groq",
      model,
      purpose,
      userId,
      tokensIn: data.usage?.prompt_tokens ?? 0,
      tokensOut: data.usage?.completion_tokens ?? 0,
      latencyMs: Date.now() - t0,
      fallbackUsed,
    });
    return text ? { text, provider: "groq", model, source: "llm", fallbackUsed } : null;
  } catch (err) {
    await recordCall({ provider: "groq", model, purpose, userId, latencyMs: Date.now() - t0, status: "error", fallbackUsed });
    logger.warn({ err, purpose }, "groq call failed");
    return null;
  }
}

/**
 * Generate text with budget checks + fallback chain.
 * Returns null when every path is exhausted — callers serve templates.
 */
export async function generateAi(req: AiRequest): Promise<AiResult | null> {
  if (req.forceTemplate) return null;

  // Key presence first — zero-key deployments must not pay a DB roundtrip
  // per call just to learn there is nothing to call.
  const geminiKey = Boolean(process.env.GEMINI_API_KEY);
  const groqKey = Boolean(process.env.GROQ_API_KEY);
  if (!geminiKey && !groqKey) return null;

  const geminiBudget = await checkBudget("gemini");
  const groqBudget = await checkBudget("groq");

  let geminiTried = false;
  if (geminiKey && geminiBudget.available) {
    const result = await callGemini(req, req.purpose, req.userId);
    geminiTried = true;
    if (result && result !== "rate_limited") return result;
    if (result === null) {
      // one retry on transient failure
      const retry = await callGemini(req, req.purpose, req.userId);
      if (retry && retry !== "rate_limited") return retry;
    }
  }

  // Fallback / primary (Gemini absent, budget out, or 429)
  if (groqKey && groqBudget.available) {
    const result = await callGroq(req, req.purpose, geminiTried, req.userId);
    if (result) return result;
  }

  return null;
}

/** Which providers can actually serve traffic right now (admin status view). */
export async function providerAvailability() {
  const [g, r] = await Promise.all([checkBudget("gemini"), checkBudget("groq")]);
  return {
    gemini: {
      configured: Boolean(process.env.GEMINI_API_KEY),
      model: MODELS.gemini,
      ...g,
    },
    groq: {
      configured: Boolean(process.env.GROQ_API_KEY),
      model: MODELS.groq,
      ...r,
    },
  };
}
