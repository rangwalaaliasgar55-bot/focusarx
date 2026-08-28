/**
 * Developer God Mode API — admin-only endpoints for the /developer page.
 *
 * Every endpoint requires admin auth (role=admin in the users table).
 * No separate admin password needed — if you're logged in as admin, you're in.
 *
 * Capabilities:
 * - System stats (users, sessions, economy, AI usage)
 * - User search and management (grant XP, coins, premium, reset)
 * - Database health and schema explorer
 * - Feature flag management
 * - AI budget and cost monitoring
 * - Cache and deployment management
 * - Migration status
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  db, pool, usersTable, focusSessionsTable, userWalletsTable,
  studyStreaksTable, tasksTable, goalsTable, notificationsTable,
  premiumSubscriptionsTable, featureFlagsTable,
} from "@workspace/db";
import { eq, desc, sql, and, like, count } from "drizzle-orm";
import { requireAdmin } from "../lib/adminAuth";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { getDeploymentVersion } from "../lib/deploymentVersion";
import { logger } from "../lib/logger";
import { mintCoins, burnCoins } from "../lib/coinLedger";

const router: IRouter = Router();

// All routes require admin auth
router.use(authMiddleware, requireAdmin);

// ── System Overview ──────────────────────────────────────────────────────────

router.get("/developer/overview", async (_req: AuthRequest, res) => {
  try {
    const [
      [userStats],
      [sessionStats],
      [walletStats],
      [streakStats],
      [taskStats],
      [goalStats],
    ] = await Promise.all([
      db.select({
        total: count(),
        guests: sql<number>`count(*) FILTER (WHERE is_guest = true)::int`,
        admins: sql<number>`count(*) FILTER (WHERE role = 'admin')::int`,
        onboarded: sql<number>`count(*) FILTER (WHERE onboarding_completed = true)::int`,
      }).from(usersTable),
      db.select({
        total: count(),
        today: sql<number>`count(*) FILTER (WHERE created_at > now() - interval '1 day')::int`,
        thisWeek: sql<number>`count(*) FILTER (WHERE created_at > now() - interval '7 days')::int`,
        avgDuration: sql<number>`coalesce(avg(duration_sec), 0)::int`,
      }).from(focusSessionsTable),
      db.select({
        totalCoins: sql<number>`coalesce(sum(coins), 0)::bigint`,
        totalXp: sql<number>`coalesce(sum(total_xp), 0)::bigint`,
        avgLevel: sql<number>`coalesce(avg(level), 0)::numeric(5,1)`,
      }).from(userWalletsTable),
      db.select({
        avgStreak: sql<number>`coalesce(avg(current_streak), 0)::numeric(5,1)`,
        maxStreak: sql<number>`coalesce(max(longest_streak), 0)::int`,
      }).from(studyStreaksTable),
      db.select({
        total: count(),
        completed: sql<number>`count(*) FILTER (WHERE completed = true)::int`,
      }).from(tasksTable),
      db.select({
        total: count(),
        completed: sql<number>`count(*) FILTER (WHERE completed = true)::int`,
      }).from(goalsTable),
    ]);

    // Recent signups
    const recentUsers = await db.select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      createdAt: usersTable.createdAt,
      isGuest: usersTable.isGuest,
    }).from(usersTable).orderBy(desc(usersTable.createdAt)).limit(10);

    // Premium subscriptions
    const [premiumStats] = await db.select({
      active: sql<number>`count(*) FILTER (WHERE is_active = true)::int`,
      total: count(),
    }).from(premiumSubscriptionsTable);

    res.json({
      deployment: {
        version: getDeploymentVersion(),
        environment: process.env.VERCEL_ENV ?? "development",
        nodeEnv: process.env.NODE_ENV,
      },
      users: userStats,
      sessions: sessionStats,
      economy: walletStats,
      streaks: streakStats,
      tasks: taskStats,
      goals: goalStats,
      premium: premiumStats,
      recentUsers,
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "developer overview error");
    res.status(500).json({ error: "Failed to load overview" });
  }
});

// ── User Search ──────────────────────────────────────────────────────────────

router.get("/developer/users", async (req: AuthRequest, res) => {
  try {
    const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    let query = db.select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      role: usersTable.role,
      isGuest: usersTable.isGuest,
      onboardingCompleted: usersTable.onboardingCompleted,
      createdAt: usersTable.createdAt,
      bio: usersTable.bio,
    }).from(usersTable);

    if (search) {
      query = query.where(
        sql`(${usersTable.email} ILIKE ${`%${search}%`} OR ${usersTable.name} ILIKE ${`%${search}%`})`
      ) as typeof query;
    }

    const users = await query.orderBy(desc(usersTable.createdAt)).limit(limit).offset(offset);

    // Enrich with wallet data
    const userIds = users.map((u) => u.id);
    const wallets = userIds.length > 0
      ? await db.select({
          userId: userWalletsTable.userId,
          coins: userWalletsTable.coins,
          totalXp: userWalletsTable.totalXp,
          level: userWalletsTable.level,
        }).from(userWalletsTable).where(sql`${userWalletsTable.userId} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`)
      : [];
    const walletMap = new Map(wallets.map((w) => [w.userId, w]));

    res.json({
      users: users.map((u) => ({ ...u, wallet: walletMap.get(u.id) ?? null })),
      page,
      limit,
    });
  } catch (err) {
    logger.error({ err }, "developer users search error");
    res.status(500).json({ error: "Failed to search users" });
  }
});

// ── User Actions (God Mode) ──────────────────────────────────────────────────

const grantSchema = z.object({
  userId: z.string().uuid(),
  amount: z.number().int().min(-1_000_000).max(1_000_000),
  reason: z.string().max(200).optional(),
});

router.post("/developer/users/grant-coins", async (req: AuthRequest, res) => {
  const parsed = grantSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request" });
  const { userId, amount, reason } = parsed.data;

  try {
    if (amount > 0) {
      await mintCoins(userId, amount, reason ?? "admin_grant", { description: "Developer god mode grant" });
    } else if (amount < 0) {
      await burnCoins(userId, Math.abs(amount), reason ?? "admin_burn", { description: "Developer god mode burn" });
    }
    const [wallet] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, userId));
    res.json({ ok: true, wallet });
  } catch (err) {
    logger.error({ err }, "grant coins error");
    res.status(500).json({ error: "Failed to grant coins" });
  }
});

router.post("/developer/users/grant-xp", async (req: AuthRequest, res) => {
  const parsed = grantSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request" });
  const { userId, amount } = parsed.data;

  try {
    const [wallet] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, userId));
    if (!wallet) {
      await db.insert(userWalletsTable).values({
        userId, coins: 0, totalXp: Math.max(0, amount), weeklyXp: Math.max(0, amount),
        level: Math.floor(Math.sqrt(Math.max(0, amount) / 100)) + 1,
      });
    } else {
      const newXp = Math.max(0, wallet.totalXp + amount);
      await db.update(userWalletsTable).set({
        totalXp: newXp,
        level: Math.floor(Math.sqrt(newXp / 100)) + 1,
        updatedAt: new Date(),
      }).where(eq(userWalletsTable.userId, userId));
    }
    const [updated] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, userId));
    res.json({ ok: true, wallet: updated });
  } catch (err) {
    logger.error({ err }, "grant xp error");
    res.status(500).json({ error: "Failed to grant XP" });
  }
});

router.post("/developer/users/grant-premium", async (req: AuthRequest, res) => {
  const { userId, days } = req.body as { userId?: string; days?: number };
  if (!userId || typeof days !== "number" || days < 1 || days > 3650) {
    return res.status(400).json({ error: "userId and days (1-3650) required" });
  }

  try {
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const [existing] = await db.select().from(premiumSubscriptionsTable).where(eq(premiumSubscriptionsTable.userId, userId));
    if (existing) {
      await db.update(premiumSubscriptionsTable).set({
        isActive: true,
        expiresAt,
        grantedByAdmin: true,
      }).where(eq(premiumSubscriptionsTable.userId, userId));
    } else {
      await db.insert(premiumSubscriptionsTable).values({
        userId, expiresAt, grantedByAdmin: true, isActive: true,
      });
    }
    res.json({ ok: true, expiresAt });
  } catch (err) {
    logger.error({ err }, "grant premium error");
    res.status(500).json({ error: "Failed to grant premium" });
  }
});

router.post("/developer/users/reset-streak", async (req: AuthRequest, res) => {
  const { userId, streak } = req.body as { userId?: string; streak?: number };
  if (!userId) return res.status(400).json({ error: "userId required" });

  try {
    const newStreak = typeof streak === "number" ? Math.max(0, Math.min(9999, streak)) : 0;
    const [existing] = await db.select().from(studyStreaksTable).where(eq(studyStreaksTable.userId, userId));
    if (existing) {
      await db.update(studyStreaksTable).set({
        currentStreak: newStreak,
        longestStreak: Math.max(existing.longestStreak, newStreak),
        updatedAt: new Date(),
      }).where(eq(studyStreaksTable.userId, userId));
    } else {
      await db.insert(studyStreaksTable).values({ userId, currentStreak: newStreak, longestStreak: newStreak });
    }
    res.json({ ok: true, streak: newStreak });
  } catch (err) {
    logger.error({ err }, "reset streak error");
    res.status(500).json({ error: "Failed to reset streak" });
  }
});

router.post("/developer/users/notify", async (req: AuthRequest, res) => {
  const { userId, title, message } = req.body as { userId?: string; title?: string; message?: string };
  if (!userId || !title || !message) return res.status(400).json({ error: "userId, title, message required" });

  try {
    await db.insert(notificationsTable).values({
      userId, type: "admin_message",
      title: title.slice(0, 100),
      message: message.slice(0, 500),
      data: { source: "developer_god_mode" },
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "send notification error");
    res.status(500).json({ error: "Failed to send notification" });
  }
});

// ── Feature Flags ────────────────────────────────────────────────────────────

router.get("/developer/flags", async (_req: AuthRequest, res) => {
  try {
    const flags = await db.select().from(featureFlagsTable).orderBy(featureFlagsTable.key);
    res.json({ flags });
  } catch (err) {
    logger.error({ err }, "get flags error");
    res.status(500).json({ error: "Failed to load flags" });
  }
});

router.patch("/developer/flags/:id", async (req: AuthRequest, res) => {
  const flagId = String(req.params.id);
  const { enabled, rolloutPercentage } = req.body as { enabled?: boolean; rolloutPercentage?: number };
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof enabled === "boolean") updates.enabled = enabled;
    if (typeof rolloutPercentage === "number") updates.rolloutPercentage = Math.min(100, Math.max(0, rolloutPercentage));
    const [updated] = await db.update(featureFlagsTable)
      .set(updates)
      .where(eq(featureFlagsTable.id, flagId)).returning();
    res.json({ flag: updated });
  } catch (err) {
    logger.error({ err }, "update flag error");
    res.status(500).json({ error: "Failed to update flag" });
  }
});

// ── AI Budget Monitor ────────────────────────────────────────────────────────

router.get("/developer/ai-budget", async (_req: AuthRequest, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const budget = await pool.query(
      `SELECT provider, day, calls_used, cap, cool_until
       FROM ai_budget_state
       WHERE day = $1
       ORDER BY provider`,
      [today]
    );

    const recentCalls = await pool.query(
      `SELECT provider, model, purpose, status, count(*) as call_count,
              sum(tokens_in) as total_tokens_in, sum(tokens_out) as total_tokens_out,
              avg(latency_ms)::int as avg_latency_ms
       FROM ai_call_log
       WHERE created_at > now() - interval '24 hours'
       GROUP BY provider, model, purpose, status
       ORDER BY call_count DESC
       LIMIT 20`
    );

    res.json({
      todayBudget: budget.rows,
      recentUsage: recentCalls.rows,
      date: today,
    });
  } catch (err) {
    // Table might not exist yet
    res.json({ todayBudget: [], recentUsage: [], date: new Date().toISOString().slice(0, 10), error: "AI budget tables may not exist yet" });
  }
});

// ── System Health ────────────────────────────────────────────────────────────

router.get("/developer/health", async (_req: AuthRequest, res) => {
  try {
    const dbStart = Date.now();
    await pool.query("SELECT 1");
    const dbLatency = Date.now() - dbStart;

    const tableCount = await pool.query(
      "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'"
    );

    const [activeUsers] = await db.select({
      count: sql<number>`count(*)::int`,
    }).from(usersTable).where(sql`${usersTable.createdAt} > now() - interval '24 hours'`);

    res.json({
      database: {
        connected: true,
        latencyMs: dbLatency,
        tableCount: Number(tableCount.rows[0]?.count ?? 0),
      },
      deployment: {
        version: getDeploymentVersion(),
        environment: process.env.VERCEL_ENV ?? "development",
      },
      activity: {
        newUsersToday: activeUsers?.count ?? 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "developer health check error");
    res.json({
      database: { connected: false, error: "Connection failed" },
      deployment: { version: getDeploymentVersion() },
      timestamp: new Date().toISOString(),
    });
  }
});

// ── User Details (Deep View) ────────────────────────────────────────────────

router.get("/developer/users/:id/details", async (req: AuthRequest, res) => {
  const userId = String(req.params.id);
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return res.status(400).json({ error: "Invalid user ID" });

  try {
    const [user] = await db.select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      role: usersTable.role,
      isGuest: usersTable.isGuest,
      bio: usersTable.bio,
      onboardingCompleted: usersTable.onboardingCompleted,
      createdAt: usersTable.createdAt,
    }).from(usersTable).where(eq(usersTable.id, userId));
    if (!user) return res.status(404).json({ error: "User not found" });

    const [wallet] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, userId));
    const [streak] = await db.select().from(studyStreaksTable).where(eq(studyStreaksTable.userId, userId));

    const recentSessions = await db.select({
      id: focusSessionsTable.id,
      durationSec: focusSessionsTable.durationSec,
      focusScore: focusSessionsTable.focusScore,
      mode: focusSessionsTable.mode,
      category: focusSessionsTable.category,
      completedAt: focusSessionsTable.completedAt,
    }).from(focusSessionsTable)
      .where(eq(focusSessionsTable.userId, userId))
      .orderBy(desc(focusSessionsTable.completedAt))
      .limit(10);

    const [sessionStats] = await db.select({
      total: count(),
      totalMinutes: sql<number>`coalesce(sum(duration_sec) / 60, 0)::int`,
      avgFocus: sql<number>`coalesce(avg(focus_score), 0)::int`,
    }).from(focusSessionsTable).where(eq(focusSessionsTable.userId, userId));

    const [taskStats] = await db.select({
      total: count(),
      completed: sql<number>`count(*) FILTER (WHERE completed = true)::int`,
    }).from(tasksTable).where(eq(tasksTable.userId, userId));

    const [goalStats] = await db.select({
      total: count(),
      completed: sql<number>`count(*) FILTER (WHERE completed = true)::int`,
    }).from(goalsTable).where(eq(goalsTable.userId, userId));

    const [premium] = await db.select().from(premiumSubscriptionsTable).where(eq(premiumSubscriptionsTable.userId, userId));

    res.json({
      user,
      wallet: wallet ?? null,
      streak: streak ?? null,
      recentSessions,
      sessionStats: sessionStats ?? null,
      taskStats: taskStats ?? null,
      goalStats: goalStats ?? null,
      premium: premium ?? null,
    });
  } catch (err) {
    logger.error({ err }, "user details error");
    res.status(500).json({ error: "Failed to load user details" });
  }
});

// ── Set User Role ───────────────────────────────────────────────────────────

router.post("/developer/users/set-role", async (req: AuthRequest, res) => {
  const { userId, role } = req.body as { userId?: string; role?: string };
  if (!userId || !role || !["user", "admin", "bot"].includes(role)) {
    return res.status(400).json({ error: "userId and role (user|admin|bot) required" });
  }

  try {
    const [updated] = await db.update(usersTable)
      .set({ role })
      .where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id, role: usersTable.role });
    if (!updated) return res.status(404).json({ error: "User not found" });
    res.json({ ok: true, user: updated });
  } catch (err) {
    logger.error({ err }, "set role error");
    res.status(500).json({ error: "Failed to set role" });
  }
});

// ── Delete User (Nuclear) ───────────────────────────────────────────────────

router.delete("/developer/users/:id", async (req: AuthRequest, res) => {
  const userId = String(req.params.id);
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return res.status(400).json({ error: "Invalid user ID" });

  try {
    // Don't allow deleting other admins
    const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId));
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.role === "admin") return res.status(403).json({ error: "Cannot delete admin users" });

    // Delete user (cascade should handle related data)
    await db.delete(usersTable).where(eq(usersTable.id, userId));
    res.json({ ok: true, deleted: userId });
  } catch (err) {
    logger.error({ err }, "delete user error");
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// ── Economy Overview (Detailed) ─────────────────────────────────────────────

router.get("/developer/economy", async (_req: AuthRequest, res) => {
  try {
    const [totals] = await db.select({
      totalCoins: sql<number>`coalesce(sum(coins), 0)::bigint`,
      totalXp: sql<number>`coalesce(sum(total_xp), 0)::bigint`,
      avgCoins: sql<number>`coalesce(avg(coins), 0)::int`,
      avgXp: sql<number>`coalesce(avg(total_xp), 0)::int`,
      avgLevel: sql<number>`coalesce(avg(level), 0)::numeric(5,1)`,
      maxCoins: sql<number>`coalesce(max(coins), 0)::bigint`,
      maxXp: sql<number>`coalesce(max(total_xp), 0)::bigint`,
      maxLevel: sql<number>`coalesce(max(level), 0)::int`,
      usersWithWallets: count(),
    }).from(userWalletsTable);

    // Top 10 richest users
    const topCoins = await db.select({
      userId: userWalletsTable.userId,
      coins: userWalletsTable.coins,
      level: userWalletsTable.level,
      name: usersTable.name,
      email: usersTable.email,
    }).from(userWalletsTable)
      .innerJoin(usersTable, eq(usersTable.id, userWalletsTable.userId))
      .orderBy(desc(userWalletsTable.coins))
      .limit(10);

    // Top 10 by XP
    const topXp = await db.select({
      userId: userWalletsTable.userId,
      totalXp: userWalletsTable.totalXp,
      level: userWalletsTable.level,
      name: usersTable.name,
      email: usersTable.email,
    }).from(userWalletsTable)
      .innerJoin(usersTable, eq(usersTable.id, userWalletsTable.userId))
      .orderBy(desc(userWalletsTable.totalXp))
      .limit(10);

    res.json({ totals, topCoins, topXp });
  } catch (err) {
    logger.error({ err }, "economy overview error");
    res.status(500).json({ error: "Failed to load economy data" });
  }
});

export { router as developerRouter };
