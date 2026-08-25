/**
 * Integration tests for the AI-rival engine (Workstream A).
 *
 * Skipped when DATABASE_URL is not set (unit CI stays green — the db module
 * throws at import time without a URL, so everything is imported lazily).
 * Run locally against a real Postgres (e.g. the embedded cluster in
 * /home/user/pgtest) to verify seeding at scale, the daily tick, caps, and
 * leaderboard query performance at 12k.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { eq, sql, desc, and } from "drizzle-orm";

const hasDb = Boolean(process.env.DATABASE_URL);

type Db = typeof import("@workspace/db");

describe.runIf(hasDb)("bot engine (Workstream A)", () => {
  let db: Db["db"];
  let usersTable: Db["usersTable"];
  let userWalletsTable: Db["userWalletsTable"];
  let socialPostsTable: Db["socialPostsTable"];
  let postCommentsTable: Db["postCommentsTable"];
  let postReactionsTable: Db["postReactionsTable"];
  let followsTable: Db["followsTable"];
  let studyStreaksTable: Db["studyStreaksTable"];
  let platformMetaTable: Db["platformMetaTable"];
  let seedBotsToTarget: typeof import("./botEngine").seedBotsToTarget;
  let ensureDailyBotActivity: typeof import("./botEngine").ensureDailyBotActivity;
  let botActivityStats: typeof import("./botEngine").botActivityStats;
  let istDayKey: typeof import("./botEngine").istDayKey;
  let generatePersona: typeof import("./personas").generatePersona;
  let levelForXp: typeof import("./personas").levelForXp;

  beforeAll(async () => {
    const dbmod = await import("@workspace/db");
    const engine = await import("./botEngine");
    const personas = await import("./personas");
    ({ db, usersTable, userWalletsTable, socialPostsTable, postCommentsTable, postReactionsTable, followsTable, studyStreaksTable, platformMetaTable } = dbmod as any);
    ({ seedBotsToTarget, ensureDailyBotActivity, botActivityStats, istDayKey } = engine);
    ({ generatePersona, levelForXp } = personas);

    // Start from a clean bot slate so the test is repeatable.
    await db.delete(usersTable).where(eq(usersTable.role, "bot"));
    await db.delete(platformMetaTable).where(sql`key = 'bot_tick_day' or key = 'bot_follow_graph_v1'`);
  }, 300_000);

  it("personas are deterministic and collision-free", () => {
    const a = generatePersona(123, new Set());
    const b = generatePersona(123, new Set());
    expect(a.name).toBe(b.name);
    expect(a.totalXp).toBe(b.totalXp);

    const reserved = new Set<string>();
    const names = new Set<string>();
    for (let i = 0; i < 12000; i++) {
      const p = generatePersona(i, reserved);
      expect(p.name).not.toMatch(/\d$/); // never "Aarav Sharma 2"
      names.add(p.name);
    }
    expect(names.size).toBe(12000); // no collisions (middle-initial fallback works)
  });

  it("XP draw matches the spec distribution (few hundred hardcore, long tail fresh)", () => {
    const reserved = new Set<string>();
    let hardcore = 0, middle = 0, fresh = 0;
    const hardcoreSeen = new Set<number>();
    const middleSeen = new Set<number>();
    const freshSeen = new Set<number>();
    for (let i = 0; i < 12000; i++) {
      const p = generatePersona(i, reserved, 12000);
      if (p.totalXp >= 8000) { hardcore++; hardcoreSeen.add(p.totalXp); }
      else if (p.totalXp > 800) { middle++; middleSeen.add(p.totalXp); }
      else { fresh++; freshSeen.add(p.totalXp); }
    }
    expect(hardcore).toBeGreaterThan(100); // "few hundred" 8k–15k
    expect(hardcore).toBeLessThan(600);
    expect(fresh).toBeGreaterThan(8000); // long tail 50–800
    // Upper tiers are injective — zero collisions guaranteed.
    expect(hardcoreSeen.size).toBe(hardcore);
    expect(middleSeen.size).toBe(middle);
    // Fresh tier: every value individually drawn, spread across the range.
    expect(freshSeen.size).toBeGreaterThan(600);
  });

  it("seeds 12,000 bots idempotently in under a minute", async () => {
    const t0 = Date.now();
    const r1 = await seedBotsToTarget(12000);
    const ms = Date.now() - t0;
    expect(r1.created).toBe(12000);
    expect(r1.total).toBe(12000);
    expect(ms).toBeLessThan(60_000);

    // Idempotent re-run: nothing new created, total stable.
    const r2 = await seedBotsToTarget(12000);
    expect(r2.created).toBe(0);
    expect(r2.total).toBe(12000);
  }, 180_000);

  it("runs the daily tick and produces a full social day", async () => {
    await ensureDailyBotActivity(true);

    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);

    const [posts, threads, comments, reactions, follows] = await Promise.all([
      db.select({ n: sql<number>`count(*)` }).from(socialPostsTable)
        .innerJoin(usersTable, eq(usersTable.id, socialPostsTable.userId))
        .where(and(eq(usersTable.role, "bot"), sql`social_posts.created_at >= ${dayStart}`)),
      db.select({ n: sql<number>`count(*)` }).from(socialPostsTable).where(eq(socialPostsTable.type, "discussion")),
      db.select({ n: sql<number>`count(*)` }).from(postCommentsTable)
        .innerJoin(usersTable, eq(usersTable.id, postCommentsTable.userId))
        .where(eq(usersTable.role, "bot")),
      db.select({ n: sql<number>`count(*)` }).from(postReactionsTable)
        .innerJoin(usersTable, eq(usersTable.id, postReactionsTable.userId))
        .where(eq(usersTable.role, "bot")),
      db.select({ n: sql<number>`count(*)` }).from(followsTable)
        .innerJoin(usersTable, eq(usersTable.id, followsTable.followerId))
        .where(eq(usersTable.role, "bot")),
    ]);

    expect(Number(posts[0].n)).toBeGreaterThanOrEqual(3); // 3–8 posts
    expect(Number(posts[0].n)).toBeLessThanOrEqual(24); // global cap
    expect(Number(threads[0].n)).toBeGreaterThanOrEqual(1); // 1–2 threads
    expect(Number(comments[0].n)).toBeGreaterThanOrEqual(5); // 5–15 comments
    expect(Number(reactions[0].n)).toBeGreaterThanOrEqual(10); // 15–30 reaction events
    expect(Number(follows[0].n)).toBeGreaterThanOrEqual(10); // follow graph + daily follows

    const stats = await botActivityStats();
    expect(stats.total).toBe(12000);
  }, 300_000);

  it("threads are actually threaded (comments under discussion posts)", async () => {
    const rows = await db
      .select({ count: sql<number>`count(*)` })
      .from(postCommentsTable)
      .innerJoin(socialPostsTable, eq(socialPostsTable.id, postCommentsTable.postId))
      .where(eq(socialPostsTable.type, "discussion"));
    expect(Number(rows[0]?.count ?? 0)).toBeGreaterThanOrEqual(2); // replies, not just posts
  }, 60_000);

  it("XP tick is batched, level-consistent, and streaks move", async () => {
    // Pick a bot that studied today: its wallet must have XP + consistent level.
    const sample = await db
      .select({
        xp: userWalletsTable.totalXp,
        level: userWalletsTable.level,
        streak: studyStreaksTable.currentStreak,
      })
      .from(userWalletsTable)
      .innerJoin(usersTable, eq(usersTable.id, userWalletsTable.userId))
      .leftJoin(studyStreaksTable, eq(studyStreaksTable.userId, userWalletsTable.userId))
      .where(eq(usersTable.role, "bot"))
      .limit(200);

    for (const row of sample) {
      if (row.xp != null) {
        expect(row.level).toBe(levelForXp(row.xp)); // canonical sqrt formula
      }
    }
    const streaks = sample.map((s) => s.streak ?? 0);
    expect(Math.max(...streaks)).toBeGreaterThan(0); // some bots advancing
    expect(streaks.some((s) => s === 0)).toBe(true); // some resting (movement)
  }, 60_000);

  it("leaderboard top-50 query stays fast at 12k wallets", async () => {
    const t0 = Date.now();
    const rows = await db
      .select({ userId: usersTable.id, weeklyXp: userWalletsTable.weeklyXp })
      .from(usersTable)
      .innerJoin(userWalletsTable, eq(userWalletsTable.userId, usersTable.id))
      .where(eq(usersTable.isGuest, false))
      .orderBy(desc(userWalletsTable.weeklyXp), desc(usersTable.createdAt))
      .limit(50);
    const ms = Date.now() - t0;
    expect(rows.length).toBe(50);
    // First run includes cold cache; be generous but real.
    expect(ms).toBeLessThan(1000);
    // Warm run must hit the < 300ms acceptance bar.
    const t1 = Date.now();
    await db
      .select({ userId: usersTable.id })
      .from(usersTable)
      .innerJoin(userWalletsTable, eq(userWalletsTable.userId, usersTable.id))
      .where(eq(usersTable.isGuest, false))
      .orderBy(desc(userWalletsTable.weeklyXp), desc(usersTable.createdAt))
      .limit(50);
    expect(Date.now() - t1).toBeLessThan(300);
  }, 60_000);

  it("community pulse reports honest numbers", async () => {
    // Direct query check (the /site/community-pulse route wraps this).
    const [totalArr, botArr] = await Promise.all([
      db.select({ n: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.isGuest, false)),
      db.select({ n: sql<number>`count(*)` }).from(usersTable).where(and(eq(usersTable.isGuest, false), eq(usersTable.role, "bot"))),
    ]);
    expect(Number(totalArr[0]?.n ?? 0)).toBe(12000);
    expect(Number(botArr[0]?.n ?? 0)).toBe(12000); // this clean DB has only bots
    expect(istDayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  }, 30_000);
});
