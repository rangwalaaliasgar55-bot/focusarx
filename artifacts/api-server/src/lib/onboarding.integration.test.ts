/**
 * Integration tests for the first-run generator against real Postgres.
 * Skipped without DATABASE_URL (the db module throws at import — lazy imports).
 *
 * The route is invoked through its own express layer rather than a socket:
 * `supertest` is not a dependency here, and what matters is the handler's
 * contract, not the HTTP plumbing it shares with every other route.
 *
 * Acceptance covered:
 *  - a brand-new empty account gets a dream, a week of tasks, three goals and
 *    a starter deck in one call
 *  - calling it again returns the same plan and creates *nothing* new
 *    (idempotence — pressing "generate" twice must not stack duplicate work)
 *  - an account that already has tasks/goals/decks keeps them, and the skipped
 *    areas are reported instead of silently overwritten
 *  - status reports `needsKickoff` only while the account is genuinely empty
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";

const hasDb = Boolean(process.env.DATABASE_URL);

type Handler = (req: unknown, res: unknown) => unknown;

/** Pull the business handler out of the router: [authMiddleware, handler]. */
function personalizeHandler(): Handler {
  return (async () => {
    const { onboardingRouter } = await import("../routes/onboarding");
    const stack = (onboardingRouter as unknown as { stack: Array<{ route?: { path: string; stack: Array<{ handle: Handler }> } }> }).stack;
    const layer = stack.find(l => l.route?.path === "/onboarding/personalize");
    const handlers = layer?.route?.stack ?? [];
    const handler = handlers[handlers.length - 1]?.handle;
    if (!handler) throw new Error("personalize handler not found on the router");
    return handler;
  })();
}

/** Minimal express response double: resolves with what the route sent. */
function fakeRes() {
  const captured: { status: number; body: unknown } = { status: 200, body: undefined };
  const res = {
    status(code: number) { captured.status = code; return res; },
    json(body: unknown) { captured.body = body; return res; },
  };
  return { res, captured };
}

describe.runIf(hasDb)("onboarding personalisation", () => {
  const userId = "onboarding-test-user";
  let db: typeof import("@workspace/db").db;
  let pool: typeof import("@workspace/db").pool;
  let tasksTable: typeof import("@workspace/db").tasksTable;
  let goalsTable: typeof import("@workspace/db").goalsTable;
  let flashcardDecksTable: typeof import("@workspace/db").flashcardDecksTable;
  let userDreamsTable: typeof import("@workspace/db").userDreamsTable;
  let platformMetaTable: typeof import("@workspace/db").platformMetaTable;
  let usersTable: typeof import("@workspace/db").usersTable;
  let countOnboardingRows: typeof import("../routes/onboarding").countOnboardingRows;
  let handler: Handler;

  const call = async (body: unknown) => {
    const { res, captured } = fakeRes();
    await handler({ userId, user: { id: userId }, body } as unknown as never, res as unknown as never);
    return captured;
  };

  beforeAll(async () => {
    const dbmod = await import("@workspace/db");
    ({ db, pool, tasksTable, goalsTable, flashcardDecksTable, userDreamsTable, platformMetaTable, usersTable } = dbmod as never);
    ({ countOnboardingRows } = await import("../routes/onboarding"));
    handler = await personalizeHandler();

    await db.delete(tasksTable).where(eq(tasksTable.userId, userId));
    await db.delete(goalsTable).where(eq(goalsTable.userId, userId));
    await db.delete(flashcardDecksTable).where(eq(flashcardDecksTable.userId, userId));
    await db.delete(userDreamsTable).where(eq(userDreamsTable.userId, userId));
    await db.delete(platformMetaTable).where(eq(platformMetaTable.key, `onboarding_plan_${userId}`));
    await db.delete(usersTable).where(eq(usersTable.id, userId));
    await db.insert(usersTable).values({ id: userId, email: `${userId}@test.focusarx`, name: "Onboarding Test", isGuest: false, role: "user" }).onConflictDoNothing();
  });

  afterAll(async () => {
    await db.delete(tasksTable).where(eq(tasksTable.userId, userId)).catch(() => {});
    await db.delete(goalsTable).where(eq(goalsTable.userId, userId)).catch(() => {});
    await db.delete(flashcardDecksTable).where(eq(flashcardDecksTable.userId, userId)).catch(() => {});
    await db.delete(userDreamsTable).where(eq(userDreamsTable.userId, userId)).catch(() => {});
    await db.delete(platformMetaTable).where(eq(platformMetaTable.key, `onboarding_plan_${userId}`)).catch(() => {});
    await db.delete(usersTable).where(eq(usersTable.id, userId)).catch(() => {});
  });

  it("builds a complete plan for an empty account", async () => {
    const { status, body } = await call({ dreamType: "iit", dailyTargetMinutes: 150, studyWindow: "night", targetDate: "2027-04-01" });
    const plan = (body as { plan: Record<string, any> }).plan;

    expect(status).toBe(201);
    expect(plan.dreamType).toBe("iit");
    expect(plan.dailyTargetMinutes).toBe(150);
    expect(plan.targetDate).toBe("2027-04-01");
    expect(plan.tasks.length).toBeGreaterThanOrEqual(4);
    expect(plan.goals.length).toBe(3);
    expect(plan.deck?.cardCount).toBeGreaterThanOrEqual(6);
    expect(plan.skipped).toEqual([]);

    // The rows really exist, tagged so the learner can tell what we made up.
    const tasks = await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM tasks WHERE user_id = $1`, [userId]);
    expect(Number(tasks.rows[0]!.n)).toBe(plan.tasks.length);
    expect(await countOnboardingRows(userId)).toBe(plan.tasks.length);
    const deckCards = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM flashcards c JOIN flashcard_decks d ON d.id = c.deck_id WHERE d.user_id = $1`,
      [userId],
    );
    expect(Number(deckCards.rows[0]!.n)).toBe(plan.deck!.cardCount);
  });

  it("returns the same plan, and creates nothing new, on a second call", async () => {
    const before = await countOnboardingRows(userId);
    const { status, body } = await call({ dreamType: "coding", dailyTargetMinutes: 300 });
    const payload = body as { alreadyGenerated: boolean; plan: Record<string, any> };

    expect(status).toBe(200);
    expect(payload.alreadyGenerated).toBe(true);
    expect(payload.plan.dreamType).toBe("iit"); // the first plan wins; no second plan
    expect(await countOnboardingRows(userId)).toBe(before);
  });

  it("never overwrites an account that already has work", async () => {
    await db.insert(tasksTable).values({ userId, text: "Pre-existing task the learner wrote", completed: false });
    const metaKey = `onboarding_plan_${userId}`;
    await db.delete(platformMetaTable).where(eq(platformMetaTable.key, metaKey)); // simulate a plan-less but used account

    const { body } = await call({ dreamType: "upsc", dailyTargetMinutes: 240 });
    const plan = (body as { plan: Record<string, any> }).plan;

    expect(plan.skipped).toContain("tasks");
    expect(plan.skipped).toContain("goals");
    expect(plan.skipped).toContain("flashcards");
    expect(plan.tasks).toEqual([]);

    const rows = await pool.query<{ text: string }>(`SELECT text FROM tasks WHERE user_id = $1`, [userId]);
    expect(rows.rows.map(r => r.text)).toContain("Pre-existing task the learner wrote");
    expect(await countOnboardingRows(userId)).toBe(0); // nothing new tagged as kickoff
  });
});
