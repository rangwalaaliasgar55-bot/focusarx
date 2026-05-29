import { Router } from "express";
import jwt from "jsonwebtoken";
import { db, usersTable, focusSessionsTable, studyStreaksTable, activeSessionsTable } from "@workspace/db";
import { eq, gte } from "drizzle-orm";
import { logger } from "../lib/logger";
import { getServerConfig } from "../lib/config";
import { extractUserId } from "./auth";
import cookie from "cookie";

const router = Router();
const ADMIN_COOKIE = "focusarx_admin";
const IS_PROD = process.env.NODE_ENV === "production";

function adminPasswordOrRespond(res: { status: (code: number) => { json: (body: unknown) => void } }): string | null {
  const password = getServerConfig().adminPassword;
  if (!password) {
    res.status(503).json({
      error: "Admin panel is not configured",
      hint: "Set ADMIN_PASSWORD in environment variables",
    });
    return null;
  }
  return password;
}

/** Signed cookie survives Vercel serverless cold starts (unlike in-memory session maps). */
function signAdminCookie(secret: string): string {
  return jwt.sign({ admin: true }, secret, { expiresIn: "1d" });
}

function isAdminCookieValid(token: string | undefined, secret: string | null): boolean {
  if (!token || !secret) return false;
  try {
    const payload = jwt.verify(token, secret) as { admin?: boolean };
    return payload.admin === true;
  } catch {
    return false;
  }
}

function isAdminAuthed(req: { headers: { cookie?: string } }): boolean {
  const secret = getServerConfig().jwtSecret;
  const cookieHeader = req.headers.cookie ?? "";
  const cookies = cookie.parse(cookieHeader);
  return isAdminCookieValid(cookies[ADMIN_COOKIE], secret);
}

async function checkAuth(req: any): Promise<boolean> {
  if (isAdminAuthed(req)) return true;
  const userId = extractUserId(req);
  if (!userId) return false;
  try {
    const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId));
    return user?.role?.toLowerCase() === "admin";
  } catch { return false; }
}

const SECURE_FLAG = IS_PROD ? "; Secure" : "";

router.post("/admin/auth", async (req, res) => {
  const adminPassword = adminPasswordOrRespond(res);
  if (!adminPassword) return;
  const secret = getServerConfig().jwtSecret;
  if (!secret) {
    res.status(503).json({
      error: "Authentication is not configured",
      hint: "Set AUTH_SECRET in environment variables",
    });
    return;
  }
  const { password } = req.body as { password?: string };
  if (!password || password !== adminPassword) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const signed = signAdminCookie(secret);
  res.setHeader("Set-Cookie", `${ADMIN_COOKIE}=${signed}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${SECURE_FLAG}`);
  res.json({ ok: true });
});

router.delete("/admin/auth", (_req, res) => {
  res.setHeader("Set-Cookie", `${ADMIN_COOKIE}=; Path=/; HttpOnly; Max-Age=0${SECURE_FLAG}`);
  res.json({ ok: true });
});

router.get("/admin/users", async (req, res) => {
  if (!await checkAuth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
    const sessions = await db.select().from(focusSessionsTable);
    const streaks = await db.select().from(studyStreaksTable);
    const active = await db.select().from(activeSessionsTable);

    const sessionCountByUser: Record<string, number> = {};
    for (const s of sessions) sessionCountByUser[s.userId] = (sessionCountByUser[s.userId] ?? 0) + 1;

    const streakByUser: Record<string, number> = {};
    for (const s of streaks) streakByUser[s.userId] = s.currentStreak;

    res.json({
      users: users.map((u) => ({
        id: u.id, name: u.name, email: u.email, isGuest: u.isGuest,
        role: u.role ?? "user",
        sessionCount: sessionCountByUser[u.id] ?? 0,
        streak: streakByUser[u.id] ?? 0,
        createdAt: u.createdAt,
      })),
      activeCount: active.length,
    });
  } catch (err) {
    logger.error({ err }, "admin users error");
    res.status(500).json({ error: "Internal error" });
  }
});

// Platform-wide stats for admin dashboard
router.get("/admin/stats", async (req, res) => {
  if (!await checkAuth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 6 * 86400000);

    const allSessions = await db.select().from(focusSessionsTable)
      .where(gte(focusSessionsTable.createdAt, sevenDaysAgo));
    const allUsers = await db.select({ id: usersTable.id, createdAt: usersTable.createdAt, isGuest: usersTable.isGuest }).from(usersTable);
    const allFocusSessions = await db.select({
      userId: focusSessionsTable.userId,
      durationSec: focusSessionsTable.durationSec,
      completedAt: focusSessionsTable.completedAt,
      mode: focusSessionsTable.mode,
    }).from(focusSessionsTable);
    const active = await db.select().from(activeSessionsTable);

    // Total focus hours across all users
    const totalFocusSec = allFocusSessions
      .filter(s => s.mode === "focus")
      .reduce((acc, s) => acc + (s.durationSec ?? 0), 0);

    // Sessions per day for last 7 days
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

    // Top 5 users by total focus time
    const timeByUser: Record<string, number> = {};
    for (const s of allFocusSessions) {
      if (s.mode === "focus") timeByUser[s.userId] = (timeByUser[s.userId] ?? 0) + (s.durationSec ?? 0);
    }
    const topUserIds = Object.entries(timeByUser)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, secs]) => ({ id, minutes: Math.round(secs / 60) }));

    const topUsersData = await Promise.all(topUserIds.map(async ({ id, minutes }) => {
      const [user] = await db.select({ name: usersTable.name, email: usersTable.email, isGuest: usersTable.isGuest }).from(usersTable).where(eq(usersTable.id, id));
      return { id, name: user?.name ?? "Unknown", email: user?.email ?? "", isGuest: user?.isGuest ?? false, minutes };
    }));

    // New users last 7 days
    const newUsersThisWeek = allUsers.filter(u => u.createdAt && u.createdAt >= sevenDaysAgo).length;

    res.json({
      totalUsers: allUsers.length,
      registeredUsers: allUsers.filter(u => !u.isGuest).length,
      totalFocusHours: Math.round(totalFocusSec / 3600),
      totalSessions: allFocusSessions.filter(s => s.mode === "focus").length,
      activeSessions: active.length,
      newUsersThisWeek,
      dailyChart,
      topUsers: topUsersData,
    });
  } catch (err) {
    logger.error({ err }, "admin stats error");
    res.status(500).json({ error: "Internal error" });
  }
});

// Promote / demote a user's role
router.patch("/admin/users/:id/role", async (req, res) => {
  if (!await checkAuth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { id } = req.params;
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

// Delete a user
router.delete("/admin/users/:id", async (req, res) => {
  if (!await checkAuth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { id } = req.params;
  try {
    await db.delete(usersTable).where(eq(usersTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "admin delete user error");
    res.status(500).json({ error: "Internal error" });
  }
});

export { router as adminRouter };
