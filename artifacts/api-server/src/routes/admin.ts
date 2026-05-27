import { Router } from "express";
import { db, usersTable, focusSessionsTable, studyStreaksTable, activeSessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
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

const adminSessions = new Map<string, number>();

function pruneExpiredSessions() {
  const now = Date.now();
  for (const [id, exp] of adminSessions) {
    if (exp < now) adminSessions.delete(id);
  }
}

function isAdminAuthed(req: any): boolean {
  pruneExpiredSessions();
  const cookieHeader = req.headers.cookie ?? "";
  const cookies = cookie.parse(cookieHeader);
  const sid = cookies[ADMIN_COOKIE];
  return !!sid && adminSessions.has(sid);
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
  const { password } = req.body as { password?: string };
  if (!password || password !== adminPassword) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const sessionId = crypto.randomUUID();
  const expiry = Date.now() + 86400_000;
  adminSessions.set(sessionId, expiry);
  res.setHeader("Set-Cookie", `${ADMIN_COOKIE}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${SECURE_FLAG}`);
  res.json({ ok: true });
});

router.delete("/admin/auth", (req: any, res) => {
  const cookieHeader = req.headers.cookie ?? "";
  const cookies = cookie.parse(cookieHeader);
  const sid = cookies[ADMIN_COOKIE];
  if (sid) adminSessions.delete(sid);
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
