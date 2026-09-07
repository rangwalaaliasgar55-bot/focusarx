/**
 * Admin management for the Break Free ("no fap journey") feature.
 *
 *  GET    /admin/break-free/overview             — aggregate stats + recent pledges
 *  GET    /admin/break-free/users?q=&sort=&limit= — every user with a streak row
 *  GET    /admin/break-free/users/:userId        — one user's streak + last 30 moods
 *  POST   /admin/break-free/users/:userId/reset  — restart the streak from today
 *  PATCH  /admin/break-free/users/:userId        — set startDate / longestStreak / relapseCount
 *  DELETE /admin/break-free/users/:userId        — remove the streak (and moods) entirely
 *  DELETE /admin/break-free/pledges/:id          — remove a public pledge
 *  POST   /admin/break-free/pledges              — post a pledge as the community wall
 */
import { Router } from "express";
import { z } from "zod";
import { db, usersTable, breakFreeStreaksTable, breakFreeMoodsTable, breakFreePledgesTable } from "@workspace/db";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { adminLimiter } from "../lib/rateLimiter";
import { checkAdminAuth } from "../lib/adminAuth";
import { auditLog, getClientIp } from "../lib/auditLog";
import { sendUnauthorized, sendNotFound, sendValidationError } from "../lib/httpErrors";

const router = Router();

/** Whole calendar days from a YYYY-MM-DD start to today (UTC). */
function daysSince(startDate: string): number {
  const [y, m, d] = startDate.slice(0, 10).split("-").map(Number);
  if (![y, m, d].every(Number.isFinite)) return 0;
  const start = Date.UTC(y!, m! - 1, d!);
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.floor((today - start) / 86_400_000));
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

router.get("/admin/break-free/overview", async (req, res) => {
  if (!await checkAdminAuth(req)) { sendUnauthorized(res); return; }
  try {
    const [totals] = await db.select({
      participants: sql<number>`count(*)`,
      relapses: sql<number>`coalesce(sum(${breakFreeStreaksTable.relapseCount}), 0)`,
      longest: sql<number>`coalesce(max(${breakFreeStreaksTable.longestStreak}), 0)`,
      activeWeek: sql<number>`count(*) filter (where ${breakFreeStreaksTable.updatedAt} > now() - interval '7 days')`,
    }).from(breakFreeStreaksTable);

    const streakRows = await db.select({ startDate: breakFreeStreaksTable.startDate }).from(breakFreeStreaksTable);
    const currents = streakRows.map((r) => daysSince(r.startDate));
    const avgCurrent = currents.length ? Math.round(currents.reduce((a, b) => a + b, 0) / currents.length) : 0;
    const buckets = { day0_6: 0, day7_29: 0, day30_89: 0, day90_plus: 0 };
    for (const c of currents) {
      if (c < 7) buckets.day0_6++;
      else if (c < 30) buckets.day7_29++;
      else if (c < 90) buckets.day30_89++;
      else buckets.day90_plus++;
    }

    const [moodAgg] = await db.select({
      checkins7d: sql<number>`count(*) filter (where ${breakFreeMoodsTable.createdAt} > now() - interval '7 days')`,
      avgMood7d: sql<number>`coalesce(avg(${breakFreeMoodsTable.mood}) filter (where ${breakFreeMoodsTable.createdAt} > now() - interval '7 days'), 0)`,
    }).from(breakFreeMoodsTable);

    const pledges = await db.select().from(breakFreePledgesTable).orderBy(desc(breakFreePledgesTable.postedAt)).limit(50);
    const [pledgeCount] = await db.select({ n: sql<number>`count(*)` }).from(breakFreePledgesTable);

    res.json({
      participants: Number(totals?.participants ?? 0),
      activeThisWeek: Number(totals?.activeWeek ?? 0),
      totalRelapses: Number(totals?.relapses ?? 0),
      longestEver: Number(totals?.longest ?? 0),
      avgCurrentStreak: avgCurrent,
      buckets,
      moods: { checkins7d: Number(moodAgg?.checkins7d ?? 0), avg7d: Math.round(Number(moodAgg?.avgMood7d ?? 0) * 10) / 10 },
      pledges: { total: Number(pledgeCount?.n ?? 0), recent: pledges },
    });
  } catch (err) {
    logger.error({ err }, "admin break-free overview error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/admin/break-free/users", async (req, res) => {
  if (!await checkAdminAuth(req)) { sendUnauthorized(res); return; }
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 80) : "";
    const sort = typeof req.query.sort === "string" ? req.query.sort : "current";
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));

    const where = q
      ? or(ilike(usersTable.name, `%${q}%`), ilike(usersTable.email, `%${q}%`))
      : undefined;

    const rows = await db.select({
      userId: breakFreeStreaksTable.userId,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      startDate: breakFreeStreaksTable.startDate,
      longestStreak: breakFreeStreaksTable.longestStreak,
      relapseCount: breakFreeStreaksTable.relapseCount,
      lastRelapseDate: breakFreeStreaksTable.lastRelapseDate,
      updatedAt: breakFreeStreaksTable.updatedAt,
    })
      .from(breakFreeStreaksTable)
      .innerJoin(usersTable, eq(usersTable.id, breakFreeStreaksTable.userId))
      .where(where)
      .orderBy(desc(breakFreeStreaksTable.updatedAt))
      .limit(limit);

    const userIds = rows.map((r) => r.userId);
    const moodRows = userIds.length
      ? await db.select({
          userId: breakFreeMoodsTable.userId,
          mood: breakFreeMoodsTable.mood,
          date: breakFreeMoodsTable.date,
        })
          .from(breakFreeMoodsTable)
          .where(and(inArray(breakFreeMoodsTable.userId, userIds), sql`${breakFreeMoodsTable.createdAt} > now() - interval '7 days'`))
      : [];
    const moodByUser = new Map<string, number[]>();
    for (const m of moodRows) moodByUser.set(m.userId, [...(moodByUser.get(m.userId) ?? []), m.mood]);

    const users = rows.map((r) => {
      const moods = moodByUser.get(r.userId) ?? [];
      return {
        ...r,
        name: r.name || r.email?.split("@")[0] || "User",
        currentStreak: daysSince(r.startDate),
        avgMood7d: moods.length ? Math.round((moods.reduce((a, b) => a + b, 0) / moods.length) * 10) / 10 : null,
        checkins7d: moods.length,
      };
    });
    users.sort((a, b) => {
      if (sort === "longest") return b.longestStreak - a.longestStreak;
      if (sort === "relapses") return b.relapseCount - a.relapseCount;
      if (sort === "recent") return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      return b.currentStreak - a.currentStreak;
    });
    res.json({ users, total: users.length });
  } catch (err) {
    logger.error({ err }, "admin break-free users error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/admin/break-free/users/:userId", async (req, res) => {
  if (!await checkAdminAuth(req)) { sendUnauthorized(res); return; }
  try {
    const userId = String(req.params.userId);
    const [row] = await db.select().from(breakFreeStreaksTable).where(eq(breakFreeStreaksTable.userId, userId)).limit(1);
    if (!row) { sendNotFound(res, "No Break Free journey for this user"); return; }
    const [user] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const moods = await db.select().from(breakFreeMoodsTable)
      .where(eq(breakFreeMoodsTable.userId, userId))
      .orderBy(desc(breakFreeMoodsTable.createdAt)).limit(30);
    res.json({ user, streak: { ...row, currentStreak: daysSince(row.startDate) }, moods });
  } catch (err) {
    logger.error({ err }, "admin break-free user error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/admin/break-free/users/:userId/reset", adminLimiter, async (req, res) => {
  if (!await checkAdminAuth(req)) { sendUnauthorized(res); return; }
  try {
    const userId = String(req.params.userId);
    const countRelapse = Boolean((req.body as { countRelapse?: boolean } | undefined)?.countRelapse);
    const [existing] = await db.select().from(breakFreeStreaksTable).where(eq(breakFreeStreaksTable.userId, userId)).limit(1);
    if (!existing) { sendNotFound(res, "No Break Free journey for this user"); return; }
    const today = todayKey();
    const current = daysSince(existing.startDate);
    const [row] = await db.update(breakFreeStreaksTable)
      .set({
        startDate: today,
        currentStreak: 0,
        longestStreak: Math.max(existing.longestStreak, current),
        relapseCount: countRelapse ? existing.relapseCount + 1 : existing.relapseCount,
        lastRelapseDate: countRelapse ? today : existing.lastRelapseDate,
        updatedAt: new Date(),
      })
      .where(eq(breakFreeStreaksTable.id, existing.id))
      .returning();
    auditLog({ action: "admin_break_free_action", ip: getClientIp(req), details: { userId, op: "reset", countRelapse } });
    res.json({ ok: true, streak: { ...row!, currentStreak: 0 } });
  } catch (err) {
    logger.error({ err }, "admin break-free reset error");
    res.status(500).json({ error: "Internal error" });
  }
});

const patchSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  longestStreak: z.number().int().min(0).max(36_500).optional(),
  relapseCount: z.number().int().min(0).max(100_000).optional(),
}).strict();

router.patch("/admin/break-free/users/:userId", adminLimiter, async (req, res) => {
  if (!await checkAdminAuth(req)) { sendUnauthorized(res); return; }
  const parsed = patchSchema.safeParse(req.body ?? {});
  if (!parsed.success) { sendValidationError(res, parsed.error.issues[0]?.message ?? "Invalid payload"); return; }
  if (Object.keys(parsed.data).length === 0) { sendValidationError(res, "Nothing to update"); return; }
  try {
    const userId = String(req.params.userId);
    const [existing] = await db.select().from(breakFreeStreaksTable).where(eq(breakFreeStreaksTable.userId, userId)).limit(1);
    if (!existing) { sendNotFound(res, "No Break Free journey for this user"); return; }
    const startDate = parsed.data.startDate ?? existing.startDate;
    const currentStreak = daysSince(startDate);
    const [row] = await db.update(breakFreeStreaksTable)
      .set({
        startDate,
        currentStreak,
        longestStreak: Math.max(parsed.data.longestStreak ?? existing.longestStreak, currentStreak),
        relapseCount: parsed.data.relapseCount ?? existing.relapseCount,
        updatedAt: new Date(),
      })
      .where(eq(breakFreeStreaksTable.id, existing.id))
      .returning();
    auditLog({ action: "admin_break_free_action", ip: getClientIp(req), details: { userId, op: "patch", ...parsed.data } });
    res.json({ ok: true, streak: { ...row!, currentStreak } });
  } catch (err) {
    logger.error({ err }, "admin break-free patch error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.delete("/admin/break-free/users/:userId", adminLimiter, async (req, res) => {
  if (!await checkAdminAuth(req)) { sendUnauthorized(res); return; }
  try {
    const userId = String(req.params.userId);
    const deleted = await db.delete(breakFreeStreaksTable).where(eq(breakFreeStreaksTable.userId, userId)).returning({ id: breakFreeStreaksTable.id });
    await db.delete(breakFreeMoodsTable).where(eq(breakFreeMoodsTable.userId, userId));
    auditLog({ action: "admin_break_free_action", ip: getClientIp(req), details: { userId, op: "delete" } });
    res.json({ ok: true, deleted: deleted.length });
  } catch (err) {
    logger.error({ err }, "admin break-free delete error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.delete("/admin/break-free/pledges/:id", adminLimiter, async (req, res) => {
  if (!await checkAdminAuth(req)) { sendUnauthorized(res); return; }
  try {
    const deleted = await db.delete(breakFreePledgesTable).where(eq(breakFreePledgesTable.id, String(req.params.id))).returning({ id: breakFreePledgesTable.id });
    if (!deleted.length) { sendNotFound(res, "Pledge not found"); return; }
    auditLog({ action: "admin_break_free_action", ip: getClientIp(req), details: { op: "deletePledge", id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "admin break-free pledge delete error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/admin/break-free/pledges", adminLimiter, async (req, res) => {
  if (!await checkAdminAuth(req)) { sendUnauthorized(res); return; }
  const parsed = z.object({ message: z.string().trim().min(1).max(100) }).safeParse(req.body ?? {});
  if (!parsed.success) { sendValidationError(res, "message required (1–100 chars)"); return; }
  try {
    const [pledge] = await db.insert(breakFreePledgesTable).values({ message: parsed.data.message }).returning();
    auditLog({ action: "admin_break_free_action", ip: getClientIp(req), details: { op: "postPledge" } });
    res.status(201).json({ ok: true, pledge });
  } catch (err) {
    logger.error({ err }, "admin break-free pledge post error");
    res.status(500).json({ error: "Internal error" });
  }
});

export { router as adminBreakFreeRouter };
