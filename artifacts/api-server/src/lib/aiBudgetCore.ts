/**
 * Pure budget primitives (Workstream G, G1) — no DB imports so they can be
 * unit-tested without a database.
 */

export type AiProvider = "gemini" | "groq";

/** Daily call caps per provider (env-overridable). */
export function providerCap(provider: AiProvider): number {
  const env = Number(process.env[provider === "gemini" ? "GEMINI_DAILY_CAP" : "GROQ_DAILY_CAP"]);
  return Number.isFinite(env) && env > 0 ? Math.floor(env) : provider === "gemini" ? 1500 : 3000;
}

/** Rough USD cost per 1k tokens — display only, never billing. */
export const COST_PER_1K: Record<AiProvider, { in: number; out: number }> = {
  gemini: { in: 0.1, out: 0.4 },
  groq: { in: 0.05, out: 0.08 },
};

/**
 * Gemini model candidates, in the order we are willing to use them.
 *
 * `gemini-1.5-flash` — the hardcoded default until now — was **shut down by
 * Google on 29 September 2025** (see the Gemini API release notes). Every call
 * to it returns 404 `NOT_FOUND: models/gemini-1.5-flash is not found`, so the
 * whole Gemini half of the gateway failed on the first request of every call:
 * the Roadmap page returned its template stub, the coach fell through to Groq
 * (or to canned text when no Groq key was set), and nothing in the UI said why.
 *
 * The available model IDs have churned repeatedly since (2.0 retired June 2026,
 * 2.5 restricted to pre-existing users in September 2026), so a single hardcoded
 * string is not a fix — it is the same bug scheduled for later. Instead:
 *
 *   1. `GEMINI_MODEL` still wins if the deployment sets it (that is the
 *      operator's explicit choice, and it is not our place to override it);
 *   2. otherwise we walk this list front-to-back, and the first ID the API
 *      accepts is remembered for the life of the process by
 *      `rememberGeminiModel()` — one probe per cold start, not per request;
 *   3. a `GEMINI_MODEL_MISSING` warning names the ID Google recommends, which
 *      its own 404 body supplies, so the next retirement is visible in logs
 *      instead of silent.
 */
export const GEMINI_MODEL_CANDIDATES: string[] = [
  process.env.GEMINI_MODEL,
  // Google's floating aliases come first on purpose. They are the only IDs in
  // this list that cannot be retired out from under us — `…-latest` is
  // re-pointed at whatever is current, so a retirement that is not this file's
  // business (2.0 in June 2026, 2.5 for new projects in September 2026) cannot
  // turn every call into a 404. Versioned IDs are kept behind them as the
  // pinned fallback for a deployment that wants reproducible behaviour.
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-3.8-flash",
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash",
].filter((m): m is string => Boolean(m && m.trim()));

let activeGeminiModel: string | null = null;

/** The model the gateway is currently using (the first candidate until probed). */
export function currentGeminiModel(): string {
  return activeGeminiModel ?? GEMINI_MODEL_CANDIDATES[0] ?? "gemini-flash-latest";
}

/** Remember the candidate that answered, so later calls skip the dead ones. */
export function rememberGeminiModel(model: string): void {
  activeGeminiModel = model;
}

/**
 * Rank a model ID discovered from the API's own `models.list` response.
 *
 * Discovery exists because the candidate list above is a *guess* about a moving
 * target, and it is wrong the day after Google ships a series. The list is
 * still the fast path — one request, no listing call, no thinking — but when
 * every entry 404s the gateway asks the API what it actually serves and picks
 * from that, so the worst case is a slower first call instead of a dead
 * integration.
 *
 * Preference order: newest generation first, `flash` over `pro` (this runs on a
 * request path with an 8s budget and a free-tier quota), stable IDs over
 * `preview`/`experimental`, and text chat over specialised variants.
 */
export function rankGeminiModel(id: string): number {
  const m = id.toLowerCase();
  // Anything that is not a Gemini chat model — PaLM-era IDs, a prefixed
  // `models/…` string, a specialised variant — is unusable here and must rank
  // below every real option rather than merely low.
  if (!m.startsWith("gemini")) return -1;
  if (/embedding|aqa|imagen|veo|tts|image|audio|live|native/.test(m)) return -1;
  const version = Number((m.match(/gemini-(\d+)(?:\.(\d+))?/) ?? [])[1] ?? 0);
  const minor = Number((m.match(/gemini-\d+\.(\d+)/) ?? [])[1] ?? 0);
  let score = version * 100 + minor * 10;
  if (m.includes("flash-lite")) score += 6;
  else if (m.includes("flash")) score += 8;
  else if (m.includes("pro")) score += 2;
  if (m.includes("latest")) score += 4;
  if (m.includes("preview") || m.includes("exp")) score -= 3;
  return score;
}

/** Pick the best of the IDs the API says it serves (highest rank wins). */
export function bestGeminiModel(ids: string[]): string | null {
  const ranked = ids
    .filter((id) => id.startsWith("gemini"))
    .map((id) => ({ id, score: rankGeminiModel(id) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.id ?? null;
}

/** True when the API rejected the ID itself rather than the request. */
export function isRetiredModelStatus(status: number): boolean {
  return status === 404 || status === 400;
}

/** Groq's model ID. Stable — Groq does not retire model names monthly. */
export const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

export const MODELS: Record<AiProvider, string> = {
  /** Legacy read path — prefer `currentGeminiModel()` (see above). */
  get gemini() {
    return currentGeminiModel();
  },
  groq: GROQ_MODEL,
};

/** IST day key (YYYY-MM-DD, UTC+5:30). */
export function istDayKey(d: Date = new Date()): string {
  const ist = new Date(d.getTime() + 5.5 * 3600 * 1000);
  return ist.toISOString().slice(0, 10);
}
