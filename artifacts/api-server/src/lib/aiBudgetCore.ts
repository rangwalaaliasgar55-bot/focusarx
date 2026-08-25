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

export const MODELS: Record<AiProvider, string> = {
  gemini: "gemini-2.5-flash",
  groq: "llama-3.3-70b-versatile",
};

/** IST day key (YYYY-MM-DD, UTC+5:30). */
export function istDayKey(d: Date = new Date()): string {
  const ist = new Date(d.getTime() + 5.5 * 3600 * 1000);
  return ist.toISOString().slice(0, 10);
}
