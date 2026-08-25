/**
 * Central AI budget manager (Workstream G, G1) — integration vs real PG.
 * Skipped without DATABASE_URL (db module throws at import — lazy imports).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { istDayKey } from "./aiBudgetCore";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDb)("ai budget manager (Workstream G)", () => {
  let db: typeof import("@workspace/db").db;
  let pool: typeof import("@workspace/db").pool;
  let aiBudgetStateTable: typeof import("@workspace/db").aiBudgetStateTable;
  let aiCallLogTable: typeof import("@workspace/db").aiCallLogTable;
  let checkBudget: typeof import("./aiBudget").checkBudget;
  let recordCall: typeof import("./aiBudget").recordCall;
  let recordRateLimit: typeof import("./aiBudget").recordRateLimit;
  let userPurposeCalls: typeof import("./aiBudget").userPurposeCalls;

  const day = () => istDayKey();

  beforeAll(async () => {
    const m = await import("@workspace/db");
    db = m.db;
    pool = m.pool;
    aiBudgetStateTable = m.aiBudgetStateTable;
    aiCallLogTable = m.aiCallLogTable;
    const b = await import("./aiBudget");
    checkBudget = b.checkBudget;
    recordCall = b.recordCall;
    recordRateLimit = b.recordRateLimit;
    userPurposeCalls = b.userPurposeCalls;
    // Clean slate for the test day
    await pool.query("DELETE FROM ai_budget_state WHERE provider = 'groq'");
    await pool.query("DELETE FROM ai_call_log WHERE purpose = 'budget_test'");
  });

  afterAll(async () => {
    await pool.query("DELETE FROM ai_budget_state WHERE provider = 'groq'");
    await pool.query("DELETE FROM ai_call_log WHERE purpose = 'budget_test'");
    await pool.end();
  });

  it("starts at 0/cap and increments atomically per recordCall", async () => {
    const before = await checkBudget("groq");
    expect(before.day).toBe(day());
    expect(before.cap).toBe(3000);
    expect(before.available).toBe(true);

    await recordCall({ provider: "groq", model: "test-model", purpose: "budget_test" });
    await recordCall({ provider: "groq", model: "test-model", purpose: "budget_test" });

    const after = await checkBudget("groq");
    expect(after.used).toBe(before.used + 2);
    const logs = await db.select().from(aiCallLogTable).where(sql`${aiCallLogTable.purpose} = 'budget_test'`);
    expect(logs.length).toBeGreaterThanOrEqual(2);
  });

  it("hard-stops at the cap (callers must degrade)", async () => {
    // Force the counter to the cap.
    await pool.query(
      `INSERT INTO ai_budget_state (id, provider, day, cap, calls_used) VALUES (gen_random_uuid(), 'groq', $1, 3, 3)
       ON CONFLICT (provider, day) DO UPDATE SET calls_used = 3, cap = 3`,
      [day()]
    );
    const atCap = await checkBudget("groq");
    expect(atCap.available).toBe(false);
    expect(atCap.used).toBe(3);
  });

  it("recordRateLimit sets coolUntil in the future and blocks availability", async () => {
    const coolUntil = await recordRateLimit("groq");
    expect(coolUntil.getTime()).toBeGreaterThan(Date.now());
    const cooled = await checkBudget("groq");
    expect(cooled.available).toBe(false);
    expect(cooled.coolUntil).not.toBeNull();

    // Cool-off expiry restores availability (counter below cap).
    await pool.query(
      `UPDATE ai_budget_state SET cool_until = now() - interval '1 minute', calls_used = 0 WHERE provider = 'groq'`
    );
    const restored = await checkBudget("groq");
    expect(restored.available).toBe(true);
  });

  it("userPurposeCalls counts a user's calls for a purpose (Arx 30/day cap)", async () => {
    const fakeUser = "00000000-0000-0000-0000-0000000000aa";
    // Real users row — ai_call_log.user_id is an FK.
    await pool.query(
      `INSERT INTO users (id, email, is_guest, role) VALUES ($1, 'budget-test@guest.focusarx.internal', false, 'user')
       ON CONFLICT (id) DO NOTHING`,
      [fakeUser]
    );
    await pool.query("DELETE FROM ai_call_log WHERE user_id = $1", [fakeUser]);
    expect(await userPurposeCalls(fakeUser, "arx_reply")).toBe(0);
    await recordCall({ provider: "groq", model: "test", purpose: "arx_reply", userId: fakeUser });
    await recordCall({ provider: "groq", model: "test", purpose: "arx_reply", userId: fakeUser });
    expect(await userPurposeCalls(fakeUser, "arx_reply")).toBe(2);
    await pool.query("DELETE FROM ai_call_log WHERE user_id = $1", [fakeUser]);
    await pool.query("DELETE FROM users WHERE id = $1", [fakeUser]);
  });
});
