/**
 * Central AI budget manager (Workstream G, G1).
 *
 * Free-tier discipline: every LLM call goes through `recordCall`, which
 * atomically increments the per-provider daily counter. `checkBudget`
 * hard-stops at the cap (callers degrade to templates / Groq fallback).
 * 429s set an exponential `coolUntil` so a throttled provider stays quiet.
 *
 * Serverless-safe: state lives in `ai_budget_state` (one row per
 * provider+IST-day), so all cold-started instances share one budget.
 */
import { db, pool, aiBudgetStateTable, aiCallLogTable, platformMetaTable } from "@workspace/db";
import { eq, sql, and, gte } from "drizzle-orm";
import { providerCap, COST_PER_1K, MODELS, istDayKey, type AiProvider } from "./aiBudgetCore";

export { providerCap, COST_PER_1K, MODELS, istDayKey, type AiProvider };

export interface BudgetState {
  provider: AiProvider;
  day: string;
  used: number;
  cap: number;
  coolUntil: Date | null;
  available: boolean;
}

export async function checkBudget(provider: AiProvider, now: Date = new Date()): Promise<BudgetState> {
  const day = istDayKey(now);
  const rows = await db.select().from(aiBudgetStateTable).where(eq(aiBudgetStateTable.provider, provider)).limit(5);
  const row = rows.find((r) => r.day === day);
  const used = row?.callsUsed ?? 0;
  // The row's stored cap is the effective one (admin can tighten it at runtime);
  // fall back to the configured cap only when no row exists yet.
  const cap = row?.cap ?? providerCap(provider);
  const coolUntil = row?.coolUntil ?? null;
  const cooledDown = coolUntil ? coolUntil.getTime() <= now.getTime() : true;
  return { provider, day, used, cap, coolUntil, available: cooledDown && used < cap };
}

/** Log a call + atomically bump the daily counter (best-effort, never throws). */
export async function recordCall(entry: {
  provider: AiProvider;
  model: string;
  purpose: string;
  userId?: string | null;
  tokensIn?: number;
  tokensOut?: number;
  latencyMs?: number;
  status?: "ok" | "error" | "rate_limited" | "fallback";
  fallbackUsed?: boolean;
}): Promise<void> {
  const day = istDayKey();
  try {
    await db.insert(aiCallLogTable).values({
      provider: entry.provider,
      model: entry.model,
      purpose: entry.purpose,
      userId: entry.userId ?? null,
      tokensIn: entry.tokensIn ?? 0,
      tokensOut: entry.tokensOut ?? 0,
      latencyMs: entry.latencyMs ?? 0,
      status: entry.status ?? "ok",
      fallbackUsed: entry.fallbackUsed ?? false,
    });
  } catch (err) {
    // Budget metering must never take down a request path.
    console.error("[aiBudget] call log insert failed", err);
  }
  try {
    // Increment (upsert if the row doesn't exist yet) via raw SQL —
    // atomic and safe under serverless concurrency.
    await pool.query(
      `INSERT INTO ai_budget_state (id, provider, day, cap, calls_used)
       VALUES (gen_random_uuid(), $1, $2, $3, 1)
       ON CONFLICT (provider, day)
       DO UPDATE SET calls_used = ai_budget_state.calls_used + 1, updated_at = now()`,
      [entry.provider, day, providerCap(entry.provider)]
    );
  } catch (err) {
    console.error("[aiBudget] counter bump failed", err);
  }
}

/**
 * Register a 429: cool the provider off with exponential backoff
 * (1min → 5min → 25min) so we stop hammering a throttled endpoint.
 */
export async function recordRateLimit(provider: AiProvider, now: Date = new Date()): Promise<Date> {
  const day = istDayKey(now);
  // 429 streak per provider+day → exponential backoff 1min → 5min → 25min…
  const metaKey = `rl_429_${provider}_${day}`;
  let streak = 0;
  try {
    const rows = await db.select().from(platformMetaTable).where(eq(platformMetaTable.key, metaKey));
    streak = Number((rows[0]?.value as { streak?: number } | undefined)?.streak ?? 0) + 1;
    await pool.query(
      `INSERT INTO platform_meta (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()`,
      [metaKey, JSON.stringify({ streak })]
    );
  } catch (err) {
    console.error("[aiBudget] 429 streak bump failed", err);
  }
  const backoffMin = Math.min(5 ** streak, 120);
  const coolUntil = new Date(now.getTime() + backoffMin * 60_000);
  try {
    await pool.query(
      `INSERT INTO ai_budget_state (id, provider, day, cap, calls_used)
       VALUES (gen_random_uuid(), $1, $2, $3, 0)
       ON CONFLICT (provider, day) DO UPDATE SET cool_until = $4, updated_at = now()`,
      [provider, day, providerCap(provider), coolUntil]
    );
  } catch (err) {
    console.error("[aiBudget] rate-limit set failed", err);
  }
  return coolUntil;
}

export interface PurposeUsage {
  purpose: string;
  calls: number;
  ok: number;
  fallback: number;
  avgLatencyMs: number;
}

/** Calls in the trailing window, grouped by purpose (G5 traffic/cost view). */
export async function usageByPurpose(hours = 24): Promise<PurposeUsage[]> {
  const since = new Date(Date.now() - hours * 3600_000);
  const rows = await db
    .select({
      purpose: aiCallLogTable.purpose,
      calls: sql<number>`count(*)::int`,
      ok: sql<number>`count(*) filter (where ${aiCallLogTable.status} = 'ok')::int`,
      fallback: sql<number>`count(*) filter (where ${aiCallLogTable.fallbackUsed})::int`,
      avgLatencyMs: sql<number>`coalesce(avg(${aiCallLogTable.latencyMs})::int, 0)`,
    })
    .from(aiCallLogTable)
    .where(gte(aiCallLogTable.createdAt, since))
    .groupBy(aiCallLogTable.purpose)
    .orderBy(sql`count(*) desc`);
  return rows;
}

/** Rough cost estimate over a window (display only). */
export async function estimatedCost(days = 7): Promise<{ calls: number; usd: number; byProvider: Record<string, number> }> {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await db
    .select({
      provider: aiCallLogTable.provider,
      calls: sql<number>`count(*)::int`,
      tokensIn: sql<number>`coalesce(sum(${aiCallLogTable.tokensIn}), 0)`,
      tokensOut: sql<number>`coalesce(sum(${aiCallLogTable.tokensOut}), 0)`,
    })
    .from(aiCallLogTable)
    .where(gte(aiCallLogTable.createdAt, since))
    .groupBy(aiCallLogTable.provider);
  let calls = 0;
  let usd = 0;
  const byProvider: Record<string, number> = {};
  for (const r of rows) {
    calls += r.calls;
    const rates = COST_PER_1K[r.provider as AiProvider] ?? COST_PER_1K.groq;
    const cost = (Number(r.tokensIn) / 1000) * rates.in + (Number(r.tokensOut) / 1000) * rates.out;
    usd += cost;
    byProvider[r.provider] = cost;
  }
  return { calls, usd: Math.round(usd * 1000) / 1000, byProvider: Object.fromEntries(Object.entries(byProvider).map(([k, v]) => [k, Math.round(v * 1000) / 1000])) };
}

/** Per-user daily usage (Arx 30/day cap). */
export async function userPurposeCalls(userId: string, purpose: string): Promise<number> {
  const since = new Date(new Date(istDayKey()).getTime() - 12 * 3600_000); // IST day ≈ 24h window
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(aiCallLogTable)
    .where(and(eq(aiCallLogTable.userId, userId), eq(aiCallLogTable.purpose, purpose), gte(aiCallLogTable.createdAt, since)));
  return Number(rows[0]?.n ?? 0);
}
