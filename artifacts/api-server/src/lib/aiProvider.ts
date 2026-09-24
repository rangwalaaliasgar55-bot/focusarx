/**
 * Unified LLM gateway (Workstream G).
 *
 * One entry point for every AI feature: budget-checked, timed (8s),
 * retried once, logged to ai_call_log, with a Gemini → Groq fallback
 * chain. Callers that can degrade get `null` back and serve templates —
 * the product is fully functional with zero AI keys.
 */
import { checkBudget, recordCall, recordRateLimit, type AiProvider } from "./aiBudget";
import {
  GEMINI_MODEL_CANDIDATES,
  GROQ_MODEL,
  bestGeminiModel,
  currentGeminiModel,
  isRetiredModelStatus,
  rememberGeminiModel,
} from "./aiBudgetCore";
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

/**
 * Model IDs to try, in order — the model that last answered first.
 *
 * `currentGeminiModel()` is the remembered winner once one is known, so a warm
 * instance issues exactly one request; the full candidate list is only walked on
 * a cold start (or after a model is retired underneath us).
 */
function geminiModelCandidates(): string[] {
  const preferred = currentGeminiModel();
  return [preferred, ...GEMINI_MODEL_CANDIDATES.filter((m) => m !== preferred)];
}

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

/**
 * Ask the API which models this key can actually reach.
 *
 * Called only after every ID in `GEMINI_MODEL_CANDIDATES` has been rejected —
 * i.e. when the list is provably out of date. One `models.list` call then
 * produces a working ID for the rest of the process, which is the difference
 * between "Gemini is down" and "Gemini is one HTTP call away from working".
 *
 * Cached for the process, with a floor between attempts so a genuinely broken
 * key cannot cause a listing call on every request.
 */
const DISCOVERY_RETRY_MS = 10 * 60 * 1000;
let discoveredModel: string | null = null;
let discoverAttemptedAt = 0;

async function discoverGeminiModel(apiKey: string): Promise<string | null> {
  if (discoveredModel) return discoveredModel;
  if (Date.now() - discoverAttemptedAt < DISCOVERY_RETRY_MS) return null;
  discoverAttemptedAt = Date.now();
  try {
    const resp = await withTimeout(
      () => fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=200`),
      TIMEOUT_MS
    );
    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      logger.warn({ status: resp.status, detail: detail.slice(0, 300) }, "gemini models.list failed");
      return null;
    }
    const data = (await resp.json()) as {
      models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
    };
    const ids = (data.models ?? [])
      .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
      .map((m) => (m.name ?? "").replace(/^models\//, ""))
      .filter(Boolean);
    const best = bestGeminiModel(ids);
    if (best) {
      discoveredModel = best;
      logger.info({ model: best, considered: ids.length }, "gemini model discovered from models.list");
    } else {
      logger.warn({ considered: ids }, "no usable gemini model in models.list");
    }
    return best;
  } catch (err) {
    logger.warn({ err }, "gemini models.list threw");
    return null;
  }
}

/** Test-only / admin-test seam: forget the discovered model. */
export function resetGeminiDiscovery(): void {
  discoveredModel = null;
  discoverAttemptedAt = 0;
}

async function callGemini(req: AiRequest, purpose: string, userId?: string | null): Promise<AiResult | "rate_limited" | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const t0 = Date.now();
  let retired: string | null = null;
  let authRejected = false;

  for (const model of geminiModelCandidates()) {
    const attempt = await tryGeminiModel(model, req, purpose, userId);
    if (attempt === "retired") { retired = model; continue; }
    if (attempt === "auth") { authRejected = true; return null; }
    if (attempt) return attempt;
    return null;
  }

  // Every candidate was rejected as a model ID. Before giving up (and before
  // dropping the request to Groq or to template text), ask the API what it
  // serves and use that — see discoverGeminiModel.
  if (retired && !authRejected) {
    const discovered = await discoverGeminiModel(apiKey);
    if (discovered && !geminiModelCandidates().includes(discovered)) {
      const result = await tryGeminiModel(discovered, req, purpose, userId);
      if (result && result !== "rate_limited" && result !== "retired" && result !== "auth") return result;
    }
  }
  return null;
}

type GeminiAttempt = AiResult | "rate_limited" | "retired" | "auth" | null;

/**
 * One request, one model ID.
 *
 * Split out of `callGemini` so the candidate loop and the discovered-ID path
 * share the exact same request shape, retry semantics and logging — two copies
 * of this would drift, and the "wrong model ID" branch is the one that has to
 * keep working forever.
 */
async function tryGeminiModel(model: string, req: AiRequest, purpose: string, userId?: string | null): Promise<GeminiAttempt> {
  const apiKey = process.env.GEMINI_API_KEY!;
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

    // 404 / 400 means the *model ID* is wrong — retired, or never granted to
    // this project — not that the request was bad. Try the next candidate
    // rather than reporting the AI as unavailable. This is the branch that
    // made every AI feature return canned text for months: `gemini-1.5-flash`
    // was shut down by Google in September 2025 and every call 404'd here.
    if (isRetiredModelStatus(resp.status)) {
      const detail = await resp.text().catch(() => "");
      await recordCall({ provider: "gemini", model, purpose, userId, latencyMs: Date.now() - t0, status: "error" });
      logger.warn({ model, status: resp.status, detail: detail.slice(0, 300) }, "gemini model unavailable — trying next candidate");
      return "retired";
    }

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      await recordCall({ provider: "gemini", model, purpose, userId, latencyMs: Date.now() - t0, status: "error" });
      // 401/403 is an account problem, not a model problem: the key is wrong,
      // revoked, or the Generative Language API is not enabled on the project.
      // Retrying another ID cannot fix it, and the fallback chain means the
      // user sees a template either way — so say it in the log, loudly and
      // once, instead of leaving "the AI is quiet" as the only symptom.
      if (resp.status === 401 || resp.status === 403) {
        logger.error(
          { status: resp.status, detail: detail.slice(0, 300) },
          "GEMINI_API_KEY rejected (401/403) — check the key and that the Generative Language API is enabled; falling back"
        );
        return "auth";
      }
      logger.warn({ model, status: resp.status, detail: detail.slice(0, 300) }, "gemini non-ok response");
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
    if (!text) return null;
    // Stick with the model that answered — one probe per cold start.
    rememberGeminiModel(model);
    return { text, provider: "gemini", model, source: "llm", fallbackUsed: false };
  } catch (err) {
    // Network/timeout: a different model ID will not help.
    await recordCall({ provider: "gemini", model, purpose, userId, latencyMs: Date.now() - t0, status: "error" });
    logger.warn({ err, purpose, model }, "gemini call failed");
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
  const model = GROQ_MODEL;
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
      model: currentGeminiModel(),
      ...g,
    },
    groq: {
      configured: Boolean(process.env.GROQ_API_KEY),
      model: GROQ_MODEL,
      ...r,
    },
  };
}
