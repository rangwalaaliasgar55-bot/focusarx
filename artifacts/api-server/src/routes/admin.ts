import { Router } from "express";
import { db, usersTable, focusSessionsTable, studyStreaksTable, activeSessionsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import cookie from "cookie";

const router = Router();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "focusarx-admin-dev";
const ADMIN_COOKIE = "focusarx_admin";

function isAdminAuthed(req: any): boolean {
  const cookieHeader = req.headers.cookie ?? "";
  const cookies = cookie.parse(cookieHeader);
  return cookies[ADMIN_COOKIE] === ADMIN_PASSWORD;
}

router.post("/admin/auth", async (req, res) => {
  const { password } = req.body as { password?: string };
  if (!password || password !== ADMIN_PASSWORD) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  res.setHeader("Set-Cookie", `${ADMIN_COOKIE}=${ADMIN_PASSWORD}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`);
  res.json({ ok: true });
});

router.delete("/admin/auth", (_req, res) => {
  res.setHeader("Set-Cookie", `${ADMIN_COOKIE}=; Path=/; HttpOnly; Max-Age=0`);
  res.json({ ok: true });
});

router.get("/admin/users", async (req, res) => {
  if (!isAdminAuthed(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
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

export { router as adminRouter };
