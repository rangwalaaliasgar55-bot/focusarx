import { Router } from "express";
import { db, usersTable, focusSessionsTable, studyStreaksTable, activeSessionsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import cookie from "cookie";

const router = Router();
const ADMIN_COOKIE = "focusarx_admin";
const IS_PROD = process.env.NODE_ENV === "production";

// Fail fast in production if ADMIN_PASSWORD is not set.
// In development, fall through with a warning so local dev still works.
let ADMIN_PASSWORD: string;
if (process.env.ADMIN_PASSWORD) {
  ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
} else if (IS_PROD) {
  logger.error("ADMIN_PASSWORD environment variable is required in production but was not set. Exiting.");
  process.exit(1);
} else {
  ADMIN_PASSWORD = `dev-admin-${crypto.randomUUID().slice(0, 8)}`;
  logger.warn({ hint: "Set ADMIN_PASSWORD to a strong secret via Replit Secrets." }, `ADMIN_PASSWORD is not set. Using ephemeral dev password: ${ADMIN_PASSWORD}`);
}

// Server-side session store — maps random session ID to expiry timestamp.
// This ensures the cookie never carries the password-equivalent value.
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

const SECURE_FLAG = IS_PROD ? "; Secure" : "";

router.post("/admin/auth", async (req, res) => {
  const { password } = req.body as { password?: string };
  if (!password || password !== ADMIN_PASSWORD) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const sessionId = crypto.randomUUID();
  const expiry = Date.now() + 86400_000; // 24h
  adminSessions.set(sessionId, expiry);
  res.setHeader("Set-Cookie", `${ADMIN_COOKIE}=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${SECURE_FLAG}`);
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
