import crypto from "crypto";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { db, pool, usersTable, focusSessionsTable, studyStreaksTable, activeSessionsTable, userMissionProgressTable, loginRewardsTable, freezeTokensTable, battlePassProgressTable, notificationsTable, premiumSubscriptionsTable } from "@workspace/db";
import { eq, gte, inArray, and, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { getServerConfig } from "../lib/config";
import { extractUserId } from "./auth";
import { adminLimiter } from "../lib/rateLimiter";
import { ALL_MISSIONS } from "./missions";
import { checkAdminAuth } from "../lib/adminAuth";

const router = Router();
const ADMIN_COOKIE = "focusarx_admin";
const IS_PROD = process.env.NODE_ENV === "production";
const ADMIN_TOKEN_EXPIRY = "24h";

function getJwtSecret(): string {
  const secret = getServerConfig().jwtSecret;
  if (!secret) {
    throw new Error("AUTH_SECRET is not configured");
  }
  return secret;
}

const checkAuth = checkAdminAuth;

const SECURE_FLAG = IS_PROD ? "; Secure" : "";

router.post("/admin/auth", adminLimiter, async (req, res) => {
  const password = getServerConfig().adminPassword;
  if (!password) {
    const userId = extractUserId(req);
    if (!userId) {
      res.status(503).json({
        error: "ADMIN_PASSWORD not configured",
        hint: "Set ADMIN_PASSWORD in Vercel env vars or use a user with role=admin.",
      });
      return;
    }
    try {
      const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId));
      if (user?.role?.toLowerCase() !== "admin") {
        res.status(403).json({ error: "Access denied" });
        return;
      }
      const token = jwt.sign({ role: "admin_session" }, getJwtSecret(), {
        algorithm: "HS256", issuer: "focusarx-api", audience: "focusarx-admin", expiresIn: ADMIN_TOKEN_EXPIRY,
      });
      res.setHeader("Set-Cookie", `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${SECURE_FLAG}`);
      res.json({ ok: true });
    } catch (err) {
      logger.error({ err }, "admin auth role check error");
      res.status(500).json({ error: "Internal error" });
    }
    return;
  }
  const { password: inputPassword } = req.body as { password?: string };
  if (!inputPassword || inputPassword.length > 256) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const a = Buffer.from(inputPassword.slice(0, 256));
  const b = Buffer.from(password.slice(0, 256));
  const lengthMatch = a.length === b.length;
  const padLen = Math.max(a.length, b.length);
  const aPad = Buffer.concat([a, Buffer.alloc(padLen - a.length)]);
  const bPad = Buffer.concat([b, Buffer.alloc(padLen - b.length)]);
  if (!lengthMatch || !crypto.timingSafeEqual(aPad, bPad)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const token = jwt.sign({ role: "admin_session" }, getJwtSecret(), {
    algorithm: "HS256", issuer: "focusarx-api", audience: "focusarx-admin", expiresIn: ADMIN_TOKEN_EXPIRY,
  });
  res.setHeader("Set-Cookie", `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${SECURE_FLAG}`);
  res.json({ ok: true });
});

router.delete("/admin/auth", (_req, res) => {
  res.setHeader("Set-Cookie", `${ADMIN_COOKIE}=; Path=/; HttpOnly; Max-Age=0${SECURE_FLAG}`);
  res.json({ ok: true });
});

router.get("/admin/users", async (req, res) => {
  if (!await checkAuth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    // Project explicit columns (CLAUDE.md rule #1). A bare
    // `db.select().from(usersTable)` asks for all 17 columns, so if the live DB
    // is missing even one (e.g. referral_code after schema drift) the query
    // throws and this route 500s — which made the admin user list render EMPTY
    // while the rows were still sitting in the database.
    const users = await db.select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      isGuest: usersTable.isGuest,
      role: usersTable.role,
      createdAt: usersTable.createdAt,
    }).from(usersTable).orderBy(usersTable.createdAt);

    // Aggregate in SQL instead of pulling every session/streak row into memory
    // and counting in JS — that grows without bound with usage.
    const sessionCounts = await db.select({
      userId: focusSessionsTable.userId,
      count: sql<number>`count(*)`,
    }).from(focusSessionsTable).groupBy(focusSessionsTable.userId);

    const streakRows = await db.select({
      userId: studyStreaksTable.userId,
      currentStreak: studyStreaksTable.currentStreak,
    }).from(studyStreaksTable);

    const [{ value: activeCount }] = await db.select({
      value: sql<number>`count(*)`,
    }).from(activeSessionsTable);

    const sessionCountByUser = new Map(sessionCounts.map((r) => [r.userId, Number(r.count)]));
    const streakByUser = new Map(streakRows.map((r) => [r.userId, r.currentStreak]));

    const registered = users.filter((u) => !u.isGuest);

    res.json({
      users: registered.map((u) => ({
        id: u.id, name: u.name, email: u.email, isGuest: false,
        role: u.role ?? "user",
        sessionCount: sessionCountByUser.get(u.id) ?? 0,
        streak: streakByUser.get(u.id) ?? 0,
        createdAt: u.createdAt,
      })),
      activeCount: Number(activeCount ?? 0),
      guestCount: users.length - registered.length,
    });
  } catch (err) {
    logger.error({ err }, "admin users error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/admin/stats", async (req, res) => {
  if (!await checkAuth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 6 * 86400000);

    // Project explicit columns (CLAUDE.md rule #1) — bare selects 500 on drift.
    const allSessions = await db.select({
      completedAt: focusSessionsTable.completedAt,
      durationSec: focusSessionsTable.durationSec,
    }).from(focusSessionsTable)
      .where(gte(focusSessionsTable.createdAt, sevenDaysAgo));
    const allUsers = await db.select({ id: usersTable.id, createdAt: usersTable.createdAt, isGuest: usersTable.isGuest }).from(usersTable);
    const allFocusSessions = await db.select({
      userId: focusSessionsTable.userId,
      durationSec: focusSessionsTable.durationSec,
      completedAt: focusSessionsTable.completedAt,
      mode: focusSessionsTable.mode,
    }).from(focusSessionsTable);
    const [{ value: activeSessionCount }] = await db.select({
      value: sql<number>`count(*)`,
    }).from(activeSessionsTable);

    const totalFocusSec = allFocusSessions
      .filter(s => s.mode === "focus")
      .reduce((acc, s) => acc + (s.durationSec ?? 0), 0);

    const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dailyChart = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(sevenDaysAgo.getTime() + i * 86400000);
      const dateStr = date.toISOString().split("T")[0]!;
      const daySessions = allSessions.filter(s => s.completedAt && s.completedAt.toISOString().split("T")[0] === dateStr);
      return {
        day: dayLabels[date.getDay()] ?? "?",
        date: dateStr,
        sessions: daySessions.length,
        minutes: Math.round(daySessions.reduce((acc, s) => acc + (s.durationSec ?? 0), 0) / 60),
      };
    });

    const timeByUser: Record<string, number> = {};
    for (const s of allFocusSessions) {
      if (s.mode === "focus") timeByUser[s.userId] = (timeByUser[s.userId] ?? 0) + (s.durationSec ?? 0);
    }
    const guestIds = new Set(allUsers.filter((u) => u.isGuest).map((u) => u.id));
    const registeredUsers = allUsers.filter((u) => !u.isGuest);

    const topUserIds = Object.entries(timeByUser)
      .filter(([id]) => !guestIds.has(id))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, secs]) => ({ id, minutes: Math.round(secs / 60) }));

    const topIds = topUserIds.map((u) => u.id);
    const topUserRows = topIds.length > 0
      ? await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
          .from(usersTable).where(inArray(usersTable.id, topIds))
      : [];
    const topUserMap = new Map(topUserRows.map((u) => [u.id, u]));
    const topUsersData = topUserIds.map(({ id, minutes }) => {
      const user = topUserMap.get(id);
      return { id, name: user?.name ?? "Unknown", email: user?.email ?? "", isGuest: false, minutes };
    });

    const newUsersThisWeek = registeredUsers.filter((u) => u.createdAt && u.createdAt >= sevenDaysAgo).length;

    res.json({
      totalUsers: registeredUsers.length,
      registeredUsers: registeredUsers.length,
      guestCount: guestIds.size,
      totalFocusHours: Math.round(totalFocusSec / 3600),
      totalSessions: allFocusSessions.filter(s => s.mode === "focus").length,
      activeSessions: Number(activeSessionCount ?? 0),
      newUsersThisWeek,
      dailyChart,
      topUsers: topUsersData,
    });
  } catch (err) {
    logger.error({ err }, "admin stats error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.patch("/admin/users/:id/role", async (req, res) => {
  if (!await checkAuth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { id } = req.params as { id: string };
  const { role } = req.body as { role?: string };
  if (!role || !["admin", "user"].includes(role)) {
    res.status(400).json({ error: "role must be 'admin' or 'user'" });
    return;
  }
  try {
    const [updated] = await db.update(usersTable).set({ role }).where(eq(usersTable.id, id)).returning({ id: usersTable.id, role: usersTable.role });
    if (!updated) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ ok: true, id: updated.id, role: updated.role });
  } catch (err) {
    logger.error({ err }, "admin set role error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.delete("/admin/users/guests", adminLimiter, async (req, res) => {
  if (!await checkAuth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const deleted = await db.delete(usersTable)
      .where(eq(usersTable.isGuest, true))
      .returning({ id: usersTable.id });
    logger.info({ count: deleted.length }, "purged guest users");
    res.json({ ok: true, deletedCount: deleted.length });
  } catch (err) {
    logger.error({ err }, "purge guests error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.delete("/admin/users/:id", async (req, res) => {
  if (!await checkAuth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { id } = req.params as { id: string };
  try {
    await db.delete(usersTable).where(eq(usersTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "admin delete user error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/admin/users/:id/premium", async (req, res) => {
  if (!await checkAuth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { id } = req.params as { id: string };
  const days = Number(req.body.days ?? 30);
  try {
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const [existing] = await db.select().from(premiumSubscriptionsTable)
      .where(eq(premiumSubscriptionsTable.userId, id)).limit(1);
    const benefits = ["exclusive_pets","premium_loot_boxes","premium_themes","xp_multiplier","coin_multiplier","premium_analytics","profile_badge","premium_battle_pass"];
    if (existing) {
      await db.update(premiumSubscriptionsTable)
        .set({ isActive: true, activatedAt: new Date(), expiresAt, benefits })
        .where(eq(premiumSubscriptionsTable.userId, id));
    } else {
      await db.insert(premiumSubscriptionsTable).values({
        userId: id, isActive: true, activatedAt: new Date(), expiresAt,
        coinsCost: 0, benefits,
      });
    }
    res.json({ ok: true, expiresAt });
  } catch (err) {
    logger.error({ err }, "admin grant premium error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/admin/missions", async (req, res) => {
  if (!await checkAuth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const completions = await db
      .select({
        missionKey: userMissionProgressTable.missionKey,
        completions: sql<number>`count(case when ${userMissionProgressTable.completed} = true then 1 end)`,
        claims: sql<number>`count(case when ${userMissionProgressTable.rewardClaimed} = true then 1 end)`,
        totalAttempts: sql<number>`count(*)`,
      })
      .from(userMissionProgressTable)
      .groupBy(userMissionProgressTable.missionKey);

    const completionMap = new Map(completions.map((c) => [c.missionKey, c]));

    const missionStats = ALL_MISSIONS.map((m) => {
      const stats = completionMap.get(m.key);
      return {
        ...m,
        completions: Number(stats?.completions ?? 0),
        claims: Number(stats?.claims ?? 0),
        totalAttempts: Number(stats?.totalAttempts ?? 0),
        completionRate: stats?.totalAttempts && Number(stats.totalAttempts) > 0
          ? Math.round((Number(stats.completions) / Number(stats.totalAttempts)) * 100)
          : 0,
      };
    });

    const totalCompletions = missionStats.reduce((acc, m) => acc + m.completions, 0);
    const totalClaims = missionStats.reduce((acc, m) => acc + m.claims, 0);

    res.json({ missions: missionStats, totalCompletions, totalClaims });
  } catch (err) {
    logger.error({ err }, "admin missions error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/admin/retention", async (req, res) => {
  if (!await checkAuth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const [loginRewardStats] = await db.select({
      totalClaims: sql<number>`coalesce(sum(${loginRewardsTable.totalClaimed}), 0)::int`,
      avgStreak: sql<number>`coalesce(avg(${loginRewardsTable.claimStreak}), 0)::float`,
      usersWithClaims: sql<number>`count(*) filter (where ${loginRewardsTable.totalClaimed} > 0)`,
    }).from(loginRewardsTable);

    const [freezeStats] = await db.select({
      totalTokensGiven: sql<number>`coalesce(sum(${freezeTokensTable.tokensAvailable} + ${freezeTokensTable.tokensUsed}), 0)::int`,
      totalTokensUsed: sql<number>`coalesce(sum(${freezeTokensTable.tokensUsed}), 0)::int`,
      usersWithTokens: sql<number>`count(*) filter (where ${freezeTokensTable.tokensAvailable} > 0 or ${freezeTokensTable.tokensUsed} > 0)`,
    }).from(freezeTokensTable);

    const [bpStats] = await db.select({
      avgTier: sql<number>`coalesce(avg(${battlePassProgressTable.tier}), 0)::float`,
      avgSeasonXp: sql<number>`coalesce(avg(${battlePassProgressTable.seasonXp}), 0)::float`,
      premiumCount: sql<number>`count(*) filter (where ${battlePassProgressTable.premiumUnlocked} = true)`,
      totalUsers: sql<number>`count(*)`,
    }).from(battlePassProgressTable);

    const bpTierDist = await db.select({
      tier: battlePassProgressTable.tier,
      count: sql<number>`count(*)`,
    }).from(battlePassProgressTable).groupBy(battlePassProgressTable.tier).orderBy(battlePassProgressTable.tier);

    const [notifStats] = await db.select({
      total: sql<number>`count(*)`,
      unread: sql<number>`count(*) filter (where ${notificationsTable.read} = false)`,
    }).from(notificationsTable);

    res.json({
      loginRewards: {
        totalClaims: Number(loginRewardStats?.totalClaims ?? 0),
        avgStreak: Number(Number(loginRewardStats?.avgStreak ?? 0).toFixed(1)),
        usersWithClaims: Number(loginRewardStats?.usersWithClaims ?? 0),
      },
      streakFreeze: {
        totalTokensGiven: Number(freezeStats?.totalTokensGiven ?? 0),
        totalTokensUsed: Number(freezeStats?.totalTokensUsed ?? 0),
        usersWithTokens: Number(freezeStats?.usersWithTokens ?? 0),
      },
      battlePass: {
        avgTier: Number(Number(bpStats?.avgTier ?? 0).toFixed(1)),
        avgSeasonXp: Math.round(Number(bpStats?.avgSeasonXp ?? 0)),
        premiumCount: Number(bpStats?.premiumCount ?? 0),
        totalUsers: Number(bpStats?.totalUsers ?? 0),
        tierDistribution: bpTierDist.map(r => ({ tier: r.tier, count: Number(r.count) })),
      },
      notifications: {
        total: Number(notifStats?.total ?? 0),
        unread: Number(notifStats?.unread ?? 0),
      },
    });
  } catch (err) {
    logger.error({ err }, "admin retention error");
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── SQL EDITOR (admin only) ──────────────────────────────────────────────────

router.post("/admin/sql", adminLimiter, async (req, res) => {
  if (process.env.NODE_ENV === "production" || process.env.ENABLE_ADMIN_SQL !== "true") {
    res.status(404).json({ error: "Not found" }); return;
  }
  if (!await checkAuth(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { query } = req.body as { query?: string };
  if (!query || typeof query !== "string") { res.status(400).json({ error: "query required" }); return; }
  const trimmed = query.trim().toLowerCase();
  // Safety: only allow SELECT, SHOW, EXPLAIN, WITH (read-only)
  const safe = /^(select|show|explain|with\s)/i.test(trimmed);
  if (!safe || trimmed.replace(/;\s*$/, "").includes(";")) {
    res.status(400).json({ error: "Only one read-only query is permitted" }); return;
  }
  if (trimmed.length > 4000) { res.status(400).json({ error: "Query too long" }); return; }

  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = '2000ms'");
    const result = await client.query(query);
    await client.query("ROLLBACK");
    res.json({
      rows: (result.rows ?? []).slice(0, 500),
      rowCount: Math.min(result.rowCount ?? 0, 500),
      fields: (result.fields ?? []).map((f: any) => ({ name: f.name, dataTypeID: f.dataTypeID })),
      truncated: (result.rows?.length ?? 0) > 500,
    });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => undefined);
    res.status(400).json({ error: err?.message ?? "Query error" });
  } finally {
    client.release();
  }
});

// ─── DB SCHEMA EXPLORER ───────────────────────────────────────────────────────

router.get("/admin/schema", adminLimiter, async (req, res) => {
  if (!await checkAuth(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const result = await pool.query(`
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `);
    const tables: Record<string, any[]> = {};
    for (const row of result.rows) {
      if (!tables[row.table_name]) tables[row.table_name] = [];
      tables[row.table_name]!.push({ column: row.column_name, type: row.data_type, nullable: row.is_nullable === "YES", default: row.column_default });
    }
    res.json({ tables });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

export { router as adminRouter };

