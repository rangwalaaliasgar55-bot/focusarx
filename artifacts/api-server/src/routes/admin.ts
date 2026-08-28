import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { db, pool, usersTable, focusSessionsTable, studyStreaksTable, activeSessionsTable, userMissionProgressTable, loginRewardsTable, freezeTokensTable, battlePassProgressTable, notificationsTable, premiumSubscriptionsTable, userWalletsTable, socialPostsTable, followsTable, platformMetaTable } from "@workspace/db";
import { desc, eq, gte, inArray, and, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { mintCoins, burnCoins } from "../lib/coinLedger";
import { getServerConfig } from "../lib/config";
import { extractUserId } from "./auth";
import { adminLimiter } from "../lib/rateLimiter";
import { ALL_MISSIONS } from "./missions";
import { checkAdminAuth, ADMIN_COOKIE } from "../lib/adminAuth";
import { seedBots, seedBotsToTarget, deleteAllBots, BOT_PERSONAS, botActivityStats, buildBotFollowGraph, istDayKey } from "../lib/botEngine";
import { generatePersona } from "../lib/personas";
import { templateInventory } from "../lib/botTemplates";
import { auditLog, getClientIp } from "../lib/auditLog";

const router = Router();
const IS_PROD = process.env.NODE_ENV === "production";
const ADMIN_TOKEN_EXPIRY = "12h";

function getJwtSecret(): string {
  const secret = getServerConfig().jwtSecret;
  if (!secret) {
    throw new Error("AUTH_SECRET is not configured");
  }
  return secret;
}

const checkAuth = checkAdminAuth;

function secureAdminCookieOptions() {
  return {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 12 * 60 * 60 * 1000, // 12h, reduced from 24h
  };
}

function timingSafeCompare(a: string, b: string): boolean {
  // Hash both to fixed length to avoid length leakage, then constant-time compare
  const hashA = crypto.createHash("sha256").update(a).digest();
  const hashB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

router.post("/admin/auth", adminLimiter, async (req, res) => {
  const password = getServerConfig().adminPassword;
  const ip = getClientIp(req as any);

  if (!password) {
    const userId = extractUserId(req);
    if (!userId) {
      auditLog({ action: "admin_login_failed", ip, details: { reason: "no_admin_password_and_no_user" } });
      res.status(503).json({
        error: "ADMIN_PASSWORD not configured",
        hint: "Set ADMIN_PASSWORD in Vercel env vars or use a user with role=admin.",
      });
      return;
    }
    try {
      const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId));
      if (user?.role?.toLowerCase() !== "admin") {
        auditLog({ action: "admin_login_failed", userId, ip, details: { reason: "not_admin_role" } });
        res.status(403).json({ error: "Access denied" });
        return;
      }
      const token = jwt.sign({ role: "admin_session" }, getJwtSecret(), {
        algorithm: "HS256", issuer: "focusarx-api", audience: "focusarx-admin", expiresIn: ADMIN_TOKEN_EXPIRY,
      });
      res.cookie(ADMIN_COOKIE, token, secureAdminCookieOptions());
      auditLog({ action: "admin_login_success", userId, ip, details: { method: "role" } });
      res.json({ ok: true });
    } catch (err) {
      logger.error({ err }, "admin auth role check error");
      res.status(500).json({ error: "Internal error" });
    }
    return;
  }

  const { password: inputPassword } = req.body as { password?: string };
  if (!inputPassword || typeof inputPassword !== "string" || inputPassword.length === 0 || inputPassword.length > 256) {
    auditLog({ action: "admin_login_failed", ip, details: { reason: "invalid_input" } });
    // Generic response — never expose whether password was missing vs wrong
    res.status(403).json({ error: "Access denied" });
    return;
  }

  // Constant-time comparison via hashed values
  const isValid = timingSafeCompare(inputPassword, password);

  if (!isValid) {
    auditLog({ action: "admin_login_failed", ip, details: { reason: "bad_password" } });
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const token = jwt.sign({ role: "admin_session" }, getJwtSecret(), {
    algorithm: "HS256", issuer: "focusarx-api", audience: "focusarx-admin", expiresIn: ADMIN_TOKEN_EXPIRY,
  });
  res.cookie(ADMIN_COOKIE, token, secureAdminCookieOptions());
  auditLog({ action: "admin_login_success", ip, details: { method: "password" } });
  res.json({ ok: true });
});

router.delete("/admin/auth", (req, res) => {
  const ip = getClientIp(req as any);
  res.cookie(ADMIN_COOKIE, "", { ...secureAdminCookieOptions(), maxAge: 0 });
  auditLog({ action: "admin_logout", ip });
  res.json({ ok: true });
});

router.get("/admin/users", async (req, res) => {
  if (!await checkAuth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    // Project explicit columns (see CONTRIBUTING «Database query rules»). A bare
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
    const botCount = registered.filter((u) => (u.role ?? "").toLowerCase() === "bot").length;

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
      botCount,
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

    // Project explicit columns — bare selects 500 on schema drift.
    const allSessions = await db.select({
      completedAt: focusSessionsTable.completedAt,
      durationSec: focusSessionsTable.durationSec,
    }).from(focusSessionsTable)
      .where(gte(focusSessionsTable.createdAt, sevenDaysAgo));
    const allUsers = await db.select({ id: usersTable.id, createdAt: usersTable.createdAt, isGuest: usersTable.isGuest, role: usersTable.role }).from(usersTable);
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
    // Bots (AI rivals) are excluded from human platform metrics.
    const registeredUsers = allUsers.filter((u) => !u.isGuest && (u.role ?? "").toLowerCase() !== "bot");

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
  if (!role || !["admin", "user", "bot"].includes(role)) {
    res.status(400).json({ error: "role must be 'admin', 'user' or 'bot'" });
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

// ─── FULL USER PROFILE (admin) ────────────────────────────────────────────────
// Everything the platform knows about one user, in one payload.

router.get("/admin/users/:id/profile", async (req, res) => {
  if (!await checkAuth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { id } = req.params as { id: string };
  try {
    // Explicit column projection so schema drift can't 500.
    const [user] = await db.select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      isGuest: usersTable.isGuest,
      role: usersTable.role,
      bio: usersTable.bio,
      timezone: usersTable.timezone,
      onboardingCompleted: usersTable.onboardingCompleted,
      productivityScore: usersTable.productivityScore,
      totalFocusMinutes: usersTable.totalFocusMinutes,
      referralCode: usersTable.referralCode,
      createdAt: usersTable.createdAt,
    }).from(usersTable).where(eq(usersTable.id, id));
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const [wallet] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, id));
    const [streak] = await db.select().from(studyStreaksTable).where(eq(studyStreaksTable.userId, id));
    const [premium] = await db.select().from(premiumSubscriptionsTable).where(eq(premiumSubscriptionsTable.userId, id));

    const [sessionAgg] = await db.select({
      count: sql<number>`count(*)`,
      totalSec: sql<number>`coalesce(sum(${focusSessionsTable.durationSec}), 0)`,
      lastAt: sql<string | null>`max(${focusSessionsTable.completedAt})`,
    }).from(focusSessionsTable).where(eq(focusSessionsTable.userId, id));

    const [postAgg] = await db.select({
      count: sql<number>`count(*)`,
    }).from(socialPostsTable).where(eq(socialPostsTable.userId, id));

    const recentSessions = await db.select({
      id: focusSessionsTable.id,
      mode: focusSessionsTable.mode,
      durationSec: focusSessionsTable.durationSec,
      focusScore: focusSessionsTable.focusScore,
      completedAt: focusSessionsTable.completedAt,
      sessionStatus: focusSessionsTable.sessionStatus,
    }).from(focusSessionsTable)
      .where(eq(focusSessionsTable.userId, id))
      .orderBy(sql`${focusSessionsTable.completedAt} desc nulls last`)
      .limit(10);

    const hasPassword = await (async () => {
      const [row] = await db.select({ hashed: usersTable.hashedPassword }).from(usersTable).where(eq(usersTable.id, id));
      return Boolean(row?.hashed);
    })();

    res.json({
      user: {
        ...user,
        hasPassword,
      },
      wallet: wallet ? {
        coins: wallet.coins,
        totalXp: wallet.totalXp,
        weeklyXp: wallet.weeklyXp,
        level: wallet.level,
        prestige: wallet.prestige,
      } : null,
      streak: streak ? {
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        lastStudyDate: streak.lastStudyDate,
      } : null,
      premium: premium ? { isActive: premium.isActive, expiresAt: premium.expiresAt } : null,
      stats: {
        sessionCount: Number(sessionAgg?.count ?? 0),
        totalFocusMinutes: Math.round(Number(sessionAgg?.totalSec ?? 0) / 60),
        lastSessionAt: sessionAgg?.lastAt ?? null,
        postCount: Number(postAgg?.count ?? 0),
      },
      recentSessions,
    });
  } catch (err) {
    logger.error({ err }, "admin user profile error");
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── EDIT CORE PROFILE ────────────────────────────────────────────────────────

router.patch("/admin/users/:id", adminLimiter, async (req, res) => {
  if (!await checkAuth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { id } = req.params as { id: string };
  const b = req.body as Record<string, unknown>;
  const patch: Partial<typeof usersTable.$inferInsert> = {};

  if (typeof b.name === "string") patch.name = b.name.trim().slice(0, 80) || null;
  if (typeof b.email === "string" && b.email.includes("@")) patch.email = b.email.trim().toLowerCase().slice(0, 160);
  if (typeof b.bio === "string") patch.bio = b.bio.slice(0, 280);
  if (typeof b.timezone === "string") patch.timezone = b.timezone.slice(0, 60);
  if (typeof b.role === "string" && ["admin", "user", "bot"].includes(b.role)) patch.role = b.role;
  if (typeof b.onboardingCompleted === "boolean") patch.onboardingCompleted = b.onboardingCompleted;
  if (typeof b.productivityScore === "number" && Number.isFinite(b.productivityScore)) patch.productivityScore = Math.max(0, Math.min(100, b.productivityScore));
  if (typeof b.totalFocusMinutes === "number" && Number.isFinite(b.totalFocusMinutes)) patch.totalFocusMinutes = Math.max(0, Math.round(b.totalFocusMinutes));

  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }
  try {
    const [updated] = await db.update(usersTable).set(patch)
      .where(eq(usersTable.id, id))
      .returning({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role });
    if (!updated) { res.status(404).json({ error: "User not found" }); return; }
    logger.info({ id, fields: Object.keys(patch) }, "admin edited user profile");
    res.json({ ok: true, user: updated });
  } catch (err: any) {
    if (String(err?.code) === "23505") { res.status(409).json({ error: "Email already in use" }); return; }
    logger.error({ err }, "admin edit user error");
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── EDIT STREAK ──────────────────────────────────────────────────────────────

router.patch("/admin/users/:id/streak", adminLimiter, async (req, res) => {
  if (!await checkAuth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { id } = req.params as { id: string };
  const b = req.body as { currentStreak?: number; longestStreak?: number };
  const current = typeof b.currentStreak === "number" ? Math.max(0, Math.round(b.currentStreak)) : null;
  const longest = typeof b.longestStreak === "number" ? Math.max(0, Math.round(b.longestStreak)) : null;
  if (current === null && longest === null) {
    res.status(400).json({ error: "currentStreak or longestStreak required" });
    return;
  }
  try {
    const [existing] = await db.select({ id: studyStreaksTable.id }).from(studyStreaksTable).where(eq(studyStreaksTable.userId, id));
    if (existing) {
      await db.update(studyStreaksTable).set({
        ...(current !== null ? { currentStreak: current } : {}),
        ...(longest !== null ? { longestStreak: longest } : {}),
        ...(current !== null && current > 0 ? { lastStudyDate: new Date().toISOString().slice(0, 10) } : {}),
        updatedAt: new Date(),
      }).where(eq(studyStreaksTable.userId, id));
    } else {
      await db.insert(studyStreaksTable).values({
        userId: id,
        currentStreak: current ?? 0,
        longestStreak: longest ?? current ?? 0,
        ...(current && current > 0 ? { lastStudyDate: new Date().toISOString().slice(0, 10) } : {}),
      });
    }
    const [row] = await db.select().from(studyStreaksTable).where(eq(studyStreaksTable.userId, id));
    res.json({ ok: true, streak: row });
  } catch (err) {
    logger.error({ err }, "admin edit streak error");
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── EDIT WALLET (coins / XP / level) ─────────────────────────────────────────

router.patch("/admin/users/:id/wallet", adminLimiter, async (req, res) => {
  if (!await checkAuth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { id } = req.params as { id: string };
  const b = req.body as { coins?: number; totalXp?: number; weeklyXp?: number; level?: number; mode?: "set" | "add" };
  const mode = b.mode === "add" ? "add" : "set";
  const num = (v: unknown) => typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;
  const coins = num(b.coins);
  const totalXp = num(b.totalXp);
  const weeklyXp = num(b.weeklyXp);
  const level = num(b.level);
  if (coins === null && totalXp === null && weeklyXp === null && level === null) {
    res.status(400).json({ error: "coins, totalXp, weeklyXp or level required" });
    return;
  }
  const clamp = (v: number) => Math.max(0, v);
  try {
    let [existing] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, id));
    if (!existing) {
      // Create the wallet shell first; coin movement goes through the ledger
      // below so admin adjustments land in coin_transactions like everything
      // else (economy dashboard + audit).
      await db.insert(userWalletsTable).values({
        userId: id,
        coins: 0,
        totalXp: clamp(totalXp ?? 0),
        weeklyXp: clamp(weeklyXp ?? 0),
        level: clamp(level ?? 1),
      });
      [existing] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, id));
    }

    // Coin movement via the ledger (add = mint; set = mint/burn the delta).
    if (coins !== null) {
      const target = clamp(mode === "add" ? existing!.coins + coins : coins);
      const delta = target - existing!.coins;
      if (delta > 0) {
        await mintCoins(id, delta, "admin_adjust", {
          description: `Admin set wallet to ${target} coins`,
          metadata: { mode, actor: req.userId ?? "admin" },
        });
      } else if (delta < 0) {
        const newBal = await burnCoins(id, -delta, "admin_adjust", {
          description: `Admin set wallet to ${target} coins`,
          metadata: { mode, actor: req.userId ?? "admin" },
        });
        if (newBal === null) {
          res.status(400).json({ error: "Cannot set balance below the burn amount — wallet has fewer coins" });
          return;
        }
      }
    }

    if (totalXp !== null || weeklyXp !== null || level !== null) {
      const [cur] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, id));
      await db.update(userWalletsTable).set({
        ...(totalXp !== null ? { totalXp: clamp(mode === "add" ? cur.totalXp + totalXp : totalXp) } : {}),
        ...(weeklyXp !== null ? { weeklyXp: clamp(mode === "add" ? cur.weeklyXp + weeklyXp : weeklyXp) } : {}),
        ...(level !== null ? { level: Math.max(1, mode === "add" ? cur.level + level : level) } : {}),
        updatedAt: new Date(),
      }).where(eq(userWalletsTable.userId, id));
    }
    const [row] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, id));
    logger.info({ id, mode, coins, totalXp }, "admin edited wallet");
    res.json({ ok: true, wallet: row });
  } catch (err) {
    logger.error({ err }, "admin edit wallet error");
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── ADMIN PASSWORD RESET (forgot password help) ──────────────────────────────
// Sets a brand-new password for the user. When none is supplied a random one is
// generated and returned exactly once — the admin relays it to the user.

router.post("/admin/users/:id/reset-password", adminLimiter, async (req, res) => {
  if (!await checkAuth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { id } = req.params as { id: string };
  const bodyPassword = typeof (req.body as any)?.password === "string" ? (req.body as any).password as string : "";
  const password = bodyPassword.trim().length >= 8
    ? bodyPassword
    : `Fx-${crypto.randomBytes(5).toString("hex")}-${crypto.randomInt(10, 99)}`;
  try {
    const [user] = await db.select({ id: usersTable.id, email: usersTable.email, isGuest: usersTable.isGuest })
      .from(usersTable).where(eq(usersTable.id, id));
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    if (user.isGuest) { res.status(400).json({ error: "Guest accounts have no password" }); return; }
    const hashed = await bcrypt.hash(password, 12);
    await db.update(usersTable).set({ hashedPassword: hashed }).where(eq(usersTable.id, id));
    // Invalidate any outstanding self-service reset tokens.
    await db.execute(sql`update password_reset_tokens set used_at = now() where user_id = ${id} and used_at is null`);
    logger.info({ id }, "admin reset user password");
    res.json({ ok: true, email: user.email, temporaryPassword: password, generated: bodyPassword.trim().length < 8 });
  } catch (err) {
    logger.error({ err }, "admin reset password error");
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── DIRECT NOTIFICATION TO ONE USER ──────────────────────────────────────────

router.post("/admin/users/:id/notification", adminLimiter, async (req, res) => {
  if (!await checkAuth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { id } = req.params as { id: string };
  const { title, message, type } = req.body as { title?: string; message?: string; type?: string };
  if (!title?.trim() || !message?.trim()) { res.status(400).json({ error: "title and message required" }); return; }
  try {
    await db.insert(notificationsTable).values({
      userId: id,
      type: type ?? "system",
      title: title.trim().slice(0, 120),
      message: message.trim().slice(0, 500),
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "admin notify user error");
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── AI RIVALS (labelled bot accounts) ────────────────────────────────────────

router.get("/admin/bots", async (_req, res) => {
  if (!await checkAuth(_req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const [bots, totalArr] = await Promise.all([
      db.select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        createdAt: usersTable.createdAt,
      }).from(usersTable).where(eq(usersTable.role, "bot")).orderBy(desc(usersTable.createdAt)).limit(100),
      db.select({ n: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.role, "bot")),
    ]);
    const stats = await botActivityStats();
    // Preview of what the next seed would create (deterministic).
    const reserved = new Set<string>();
    const total = Number(totalArr[0]?.n ?? 0);
    const preview = Array.from({ length: 8 }, (_, i) => {
      const p = generatePersona(total + i, reserved);
      return { name: p.name, bio: p.bio, xp: p.totalXp, streak: p.streak, timezone: p.timezone };
    });
    res.json({
      bots,
      total,
      personas: BOT_PERSONAS.length,
      stats,
      preview,
      inventory: templateInventory(),
      istDay: istDayKey(),
    });
  } catch (err) {
    logger.error({ err }, "admin list bots error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/admin/bots/seed", adminLimiter, async (req, res) => {
  if (!await checkAuth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const target = Math.floor(Number((req.body as { target?: number })?.target) || 12000);
    if (![500, 2000, 12000].includes(target) && (target < 100 || target > 20000)) {
      res.status(400).json({ error: "target must be 500, 2000 or 12000 (or 100–20000)" });
      return;
    }
    const t0 = Date.now();
    const result = await seedBotsToTarget(target);
    logger.info({ ...result, ms: Date.now() - t0 }, "admin seeded AI rivals");
    res.json({ ok: true, ...result, ms: Date.now() - t0 });
  } catch (err) {
    logger.error({ err }, "admin seed bots error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/admin/bots/graph", adminLimiter, async (req, res) => {
  if (!await checkAuth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    // reset=true: wipe the bot follow graph + flag so it can be rebuilt.
    if ((req.body as { reset?: boolean })?.reset) {
      await db.delete(followsTable).where(sql`${followsTable.followerId} IN (SELECT id FROM users WHERE role = 'bot')`);
      await db.delete(platformMetaTable).where(eq(platformMetaTable.key, "bot_follow_graph_v1"));
    }
    const result = await buildBotFollowGraph();
    res.json({ ok: true, ...result });
  } catch (err) {
    logger.error({ err }, "admin build bot graph error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.delete("/admin/bots", adminLimiter, async (req, res) => {
  if (!await checkAuth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const deleted = await deleteAllBots();
    logger.info({ deleted }, "admin removed AI rivals");
    res.json({ ok: true, deleted });
  } catch (err) {
    logger.error({ err }, "admin delete bots error");
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

// ─── ECONOMY DASHBOARD (Workstream C) ────────────────────────────────────────
// All mints/burns land in coin_transactions via lib/coinLedger, so this view
// is complete by construction: circulating supply, daily mint/burn flow,
// top reasons, and an inflation alert (net mint last 7d vs supply).

router.get("/admin/economy", async (req, res) => {
  if (!await checkAuth(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const supply = await pool.query(`
      SELECT
        coalesce(sum(uw.coins), 0)::bigint AS total,
        coalesce(sum(CASE WHEN u.role = 'bot' THEN uw.coins ELSE 0 END), 0)::bigint AS bots,
        count(uw.id)::int AS wallets,
        coalesce(sum(CASE WHEN u.role = 'bot' THEN 0 ELSE 1 END), 0)::int AS humans
      FROM user_wallets uw
      LEFT JOIN users u ON u.id = uw.user_id
    `);
    const daily = await pool.query(`
      SELECT to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'MM-DD') AS day,
             type,
             coalesce(sum(amount), 0)::bigint AS total,
             count(*)::int AS n
      FROM coin_transactions
      WHERE created_at >= now() - interval '14 days'
      GROUP BY 1, 2
      ORDER BY 1 DESC, 2
    `);
    const reasons = await pool.query(`
      SELECT reason, type,
             coalesce(sum(amount), 0)::bigint AS total,
             count(*)::int AS n
      FROM coin_transactions
      WHERE created_at >= now() - interval '7 days'
      GROUP BY 1, 2
      ORDER BY abs(coalesce(sum(amount), 0)) DESC
      LIMIT 10
    `);
    const last7 = await pool.query(`
      SELECT coalesce(sum(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)::bigint AS mints,
             coalesce(sum(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0)::bigint AS burns
      FROM coin_transactions
      WHERE created_at >= now() - interval '7 days'
    `);
    const marketplace = await pool.query(`
      SELECT reason, count(*)::int AS n, coalesce(sum(amount), 0)::bigint AS total
      FROM coin_transactions
      WHERE reason IN ('marketplace_purchase','gift_purchase','sellback','bundle_purchase')
        AND created_at >= now() - interval '7 days'
      GROUP BY 1
    `);

    const total = Number(supply.rows[0].total);
    const net7 = Number(last7.rows[0].mints) - Number(last7.rows[0].burns);
    const inflationPct = total > 0 ? (net7 / total) * 100 : 0;

    // Build a 14-day series (MM-DD labels) with mints/burns per day.
    const byDay = new Map<string, { day: string; mints: number; burns: number }>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(5, 7) + "-" + d.toISOString().slice(8, 10);
      byDay.set(key, { day: key, mints: 0, burns: 0 });
    }
    for (const r of daily.rows) {
      const slot = byDay.get(r.day);
      if (!slot) continue;
      if (r.type === "earn") slot.mints += Number(r.total);
      else slot.burns += Number(r.total);
    }

    res.json({
      supply: {
        total,
        humans: supply.rows[0].humans,
        bots: Number(supply.rows[0].bots),
        wallets: supply.rows[0].wallets,
      },
      last7: { mints: Number(last7.rows[0].mints), burns: Number(last7.rows[0].burns), net: net7 },
      inflationPct: Math.round(inflationPct * 100) / 100,
      inflationAlert: inflationPct > 5,
      daily: [...byDay.values()],
      topReasons: reasons.rows,
      marketplace: Object.fromEntries(marketplace.rows.map((r) => [r.reason, { n: r.n, total: Number(r.total) }])),
    });
  } catch (err) {
    logger.error({ err }, "economy dashboard error");
    res.status(500).json({ error: "Internal error" });
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

// ─── SQL Console (read-only by default, write via unlock phrase) ────────────

let sqlWriteWindow: { unlockedAt: number; by: string } | null = null;
const SQL_WRITE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const SQL_UNLOCK_PHRASE = process.env.SQL_UNLOCK_PHRASE || "focusarx-admin-unlock";

/** Safe check: is this a read-only statement? */
function isReadOnlyStatement(sql: string): boolean {
  const trimmed = sql.trim().replace(/\/\/[\s\S]*$/, "").replace(/--[\s\S]*$/, "");
  const firstWord = trimmed.split(/\s+/)[0]?.toUpperCase();
  const readOnlyPrefixes = ["SELECT", "SHOW", "EXPLAIN", "WITH", "TABLE", "\d"];
  return readOnlyPrefixes.some((p) => firstWord?.startsWith(p));
}

/** Check if a statement is potentially destructive */
function isDestructiveStatement(sql: string): boolean {
  const upper = sql.trim().toUpperCase();
  return /\b(TRUNCATE|DROP|DELETE\s+FROM|ALTER\s+TABLE|UPDATE\s+\w+\s+SET|INSERT\s+INTO)\b/.test(upper);
}

/** SQL query log table — created on first use */
let sqlLogReady = false;
async function ensureSqlLogTable() {
  if (sqlLogReady) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS admin_sql_log (
        id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        kind text NOT NULL DEFAULT 'read',
        sql text NOT NULL,
        rows_affected integer DEFAULT 0,
        status text DEFAULT 'ok',
        error text,
        branch_name text,
        created_at timestamp DEFAULT now() NOT NULL
      )
    `);
    sqlLogReady = true;
  } catch { /* table may not exist — that's ok */ }
}

router.get("/admin/sql/status", async (req, res) => {
  if (!await checkAuth(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const now = Date.now();
  const writeActive = sqlWriteWindow && now - sqlWriteWindow.unlockedAt < SQL_WRITE_WINDOW_MS;
  res.json({
    enabled: true,
    writeUnlocked: !!writeActive,
    remainingMs: writeActive ? SQL_WRITE_WINDOW_MS - (now - sqlWriteWindow!.unlockedAt) : 0,
    windowMs: SQL_WRITE_WINDOW_MS,
    unlockPhrase: "***",
    unlockedBy: writeActive ? sqlWriteWindow!.by : null,
    hasUnlockRecord: !!sqlWriteWindow,
  });
});

router.get("/admin/sql/log", async (req, res) => {
  if (!await checkAuth(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    await ensureSqlLogTable();
    const limit = Math.min(parseInt(String(req.query.limit) || "15"), 100);
    const rows = await db.execute(sql`SELECT * FROM admin_sql_log ORDER BY created_at DESC LIMIT ${limit}`);
    res.json({ entries: (rows as any).rows ?? rows });
  } catch (err) {
    res.json({ entries: [] });
  }
});

router.post("/admin/sql/unlock", async (req, res) => {
  if (!await checkAuth(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { phrase } = req.body as { phrase?: string };
  if (phrase !== SQL_UNLOCK_PHRASE) {
    res.status(403).json({ error: "Invalid unlock phrase" });
    return;
  }
  const userId = extractUserId(req);
  sqlWriteWindow = { unlockedAt: Date.now(), by: userId || "admin" };
  res.json({ ok: true, remainingMs: SQL_WRITE_WINDOW_MS });
});

router.post("/admin/sql/query", async (req, res) => {
  if (!await checkAuth(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { query, branch } = req.body as { query?: string; branch?: string };
  if (!query || typeof query !== "string" || query.trim().length === 0) {
    res.status(400).json({ error: "Empty query" });
    return;
  }
  // Log the query attempt
  await ensureSqlLogTable();
  const isRead = isReadOnlyStatement(query);
  const isDestructive = isDestructiveStatement(query);
  const now = Date.now();
  const writeActive = sqlWriteWindow && now - sqlWriteWindow.unlockedAt < SQL_WRITE_WINDOW_MS;

  if (!isRead) {
    // Write mode requires unlock
    if (!writeActive) {
      try {
        const logId = crypto.randomUUID();
        await db.execute(sql`INSERT INTO admin_sql_log (id, kind, sql, status, error, branch_name) VALUES (${logId}, 'write', ${query}, 'blocked', 'Write mode not unlocked', ${branch || null})`);
      } catch { /* best effort */ }
      res.status(403).json({ error: "Write mode not unlocked. Use the unlock phrase first." });
      return;
    }
    if (isDestructive) {
      // Double-check: destructive statements need extra confirmation
      const { confirmed } = req.body as { confirmed?: boolean };
      if (!confirmed) {
        res.status(400).json({ error: "Destructive statement. Set confirmed: true to proceed.", needsConfirmation: true });
        return;
      }
    }
  }

  const start = Date.now();
  try {
    // Use the raw pool for direct SQL execution
    const result = await pool.query(query);
    const durationMs = Date.now() - start;
    const columns = result.fields?.map((f: any) => f.name) ?? [];
    const rows = result.rows?.map((r: any) => Object.values(r)) ?? [];
    const rowCount = result.rowCount ?? rows.length;

    // Log successful query
    try {
      const logId = crypto.randomUUID();
      await db.execute(sql`INSERT INTO admin_sql_log (id, kind, sql, rows_affected, status, branch_name) VALUES (${logId}, ${isRead ? 'read' : 'write'}, ${query}, ${rowCount}, 'ok', ${branch || null})`);
    } catch { /* best effort */ }

    res.json({ columns, rows, rowCount, truncated: rowCount >= 1000, durationMs });
  } catch (err: any) {
    const durationMs = Date.now() - start;
    try {
      const logId = crypto.randomUUID();
      await db.execute(sql`INSERT INTO admin_sql_log (id, kind, sql, status, error, branch_name) VALUES (${logId}, ${isRead ? 'read' : 'write'}, ${query}, 'error', ${err?.message?.slice(0, 500) || 'Unknown error'}, ${branch || null})`);
    } catch { /* best effort */ }
    res.status(400).json({ error: err?.message || "Query failed", durationMs });
  }
});

export { router as adminRouter };

