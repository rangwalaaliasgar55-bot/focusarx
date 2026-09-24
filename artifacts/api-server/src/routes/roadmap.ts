import express, { Router } from "express";
import { db, roadmapsTable, tasksTable, goalsTable } from "@workspace/db";
import { and, eq, desc, inArray } from "drizzle-orm";
import { z } from "zod";
import { dayKeyInZone } from "../lib/timezone";
import { userZone } from "../lib/userZone";
import { logger } from "../lib/logger";
import jwt from "jsonwebtoken";
import { getServerConfig } from "../lib/config";
import { aiRoadmapLimiter } from "../lib/rateLimiter";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { premiumStatusMiddleware } from "../lib/premiumCheck";

const router = Router();

function extractUserId(req: express.Request): string | null {
  const header: string = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  try {
    const config = getServerConfig();
    if (!config.jwtSecret) return null;
    const payload = jwt.verify(token, config.jwtSecret) as { sub?: string };
    return payload?.sub ?? null;
  } catch { return null; }
}

// premiumStatusMiddleware runs before aiRoadmapLimiter — premium users bypass rate limit
router.post("/roadmap/save", authMiddleware, premiumStatusMiddleware, aiRoadmapLimiter, async (req: AuthRequest, res) => {
  const userId = req.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const { subject, data } = req.body as { subject?: string; data?: unknown };
  if (!subject || !data) { res.status(400).json({ error: "subject and data are required" }); return; }
  try {
    const [saved] = await db.insert(roadmapsTable).values({ userId, subject, data }).returning();
    res.json({ ok: true, id: saved?.id });
  } catch (err) {
    logger.error({ err }, "roadmap save error");
    res.status(500).json({ error: "Failed to save roadmap" });
  }
});

router.get("/roadmap/list", async (req, res) => {
  const userId = extractUserId(req);
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  try {
    const rows = await db.select({
      id: roadmapsTable.id,
      subject: roadmapsTable.subject,
      createdAt: roadmapsTable.createdAt,
    }).from(roadmapsTable)
      .where(eq(roadmapsTable.userId, userId))
      .orderBy(desc(roadmapsTable.createdAt))
      .limit(20);
    res.json({ roadmaps: rows });
  } catch (err) {
    logger.error({ err }, "roadmap list error");
    res.status(500).json({ error: "Failed to load roadmaps" });
  }
});

router.get("/roadmap/:id", async (req, res) => {
  const userId = extractUserId(req);
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const { id } = req.params as { id: string };
  try {
    const [row] = await db.select().from(roadmapsTable)
      .where(eq(roadmapsTable.id, id));
    if (!row || row.userId !== userId) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ roadmap: row });
  } catch (err) {
    logger.error({ err }, "roadmap get error");
    res.status(500).json({ error: "Failed to load roadmap" });
  }
});

router.delete("/roadmap/:id", async (req, res) => {
  const userId = extractUserId(req);
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const { id } = req.params as { id: string };
  try {
    const [row] = await db.select({ userId: roadmapsTable.userId }).from(roadmapsTable).where(eq(roadmapsTable.id, id));
    if (!row || row.userId !== userId) { res.status(404).json({ error: "Not found" }); return; }
    await db.delete(roadmapsTable).where(eq(roadmapsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "roadmap delete error");
    res.status(500).json({ error: "Failed to delete roadmap" });
  }
});

const commitDaySchema = z.object({
  day: z.number().int().min(1).max(60),
  tasks: z.array(z.string().trim().min(1).max(500)).max(12),
  focusSessions: z.array(z.string().trim().max(200)).max(12).optional(),
});

const commitSchema = z.object({
  subject: z.string().trim().min(3).max(200),
  /** How many days of the plan to turn into dated tasks. */
  horizonDays: z.number().int().min(1).max(7).default(3),
  createGoal: z.boolean().default(false),
  days: z.array(commitDaySchema).min(1).max(7),
});

/**
 * Turn an AI roadmap into work that exists.
 *
 * This closes the gap behind "the AI does not do what I ask": the roadmap
 * generator returns a seven-day plan, the page renders it beautifully, and
 * nothing is ever written down — the plan lives in React state and dies on
 * refresh. A student who asked for a study plan and got a *picture of* a study
 * plan is right to say the AI did not do the task.
 *
 * Server-side because the client cannot be trusted with counts, dates or
 * duplicates, and because a plan is exactly the sort of thing that gets
 * double-clicked. Duplicates are prevented by the data rather than by an
 * idempotency table: a task whose title and due date already exist for this user
 * is skipped, and the response says how many were skipped. That is also what
 * makes re-running a commit safe after a timeout.
 */
router.post("/roadmap/commit", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const parsed = commitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid plan" });
    return;
  }
  const { subject, horizonDays, createGoal, days } = parsed.data;

  try {
    const zone = await userZone(userId);
    const todayKey = dayKeyInZone(Date.now(), zone);
    const [year, month, day] = todayKey.split("-").map(Number);
    /** Day N of the plan lands on today + (N - 1) days, in the user's own zone. */
    const dueDateFor = (planDay: number): string => {
      const base = Date.UTC(year!, (month ?? 1) - 1, day!);
      const shifted = new Date(base + (planDay - 1) * 86_400_000);
      return shifted.toISOString().slice(0, 10);
    };

    const useDays = days.filter((d) => d.day <= horizonDays);
    const wanted = useDays.flatMap((d) =>
      d.tasks.slice(0, 8).map((text) => ({
        text: text.replace(/\s+/g, " ").trim(),
        dueDate: dueDateFor(d.day),
      })),
    ).filter((item) => item.text.length > 0);

    if (wanted.length === 0) {
      res.status(400).json({ error: "That plan has no tasks to add" });
      return;
    }

    // One query for the window we might write into, then compare in memory.
    const existing = await db
      .select({ text: tasksTable.text, dueDate: tasksTable.dueDate })
      .from(tasksTable)
      .where(and(eq(tasksTable.userId, userId), inArray(tasksTable.dueDate, [...new Set(wanted.map((w) => w.dueDate))])));
    const existingKeys = new Set(existing.map((row) => `${row.dueDate}|${(row.text ?? "").trim().toLowerCase()}`));

    const fresh = wanted.filter((item) => !existingKeys.has(`${item.dueDate}|${item.text.toLowerCase()}`));
    // …and within the request itself, because a plan can name the same block twice.
    const seen = new Set<string>();
    const deduped = fresh.filter((item) => {
      const key = `${item.dueDate}|${item.text.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const created = deduped.length > 0
      ? await db.insert(tasksTable).values(deduped.map((item, index) => ({
          userId,
          text: item.text,
          completed: false,
          order: index,
          // The plan's own day count is the only estimate available, so give the
          // first block a realistic default rather than pretending to know more.
          estimatedMinutes: 45,
          category: "Study",
          priority: "medium" as const,
          tags: [subject.slice(0, 40)],
          dueDate: item.dueDate,
          status: "active",
        }))).returning({ id: tasksTable.id })
      : [];

    let goalId: string | null = null;
    if (createGoal) {
      try {
        const [goal] = await db.insert(goalsTable).values({
          userId,
          title: subject.slice(0, 200),
          description: `Study plan generated by the AI roadmap coach. ${wanted.length} blocks across ${useDays.length} days.`,
          completed: false,
        }).returning({ id: goalsTable.id });
        goalId = goal?.id ?? null;
      } catch (err) {
        logger.warn({ err }, "roadmap commit goal create failed");
      }
    }

    logger.info({ userId, created: created.length, skipped: wanted.length - created.length, horizonDays }, "roadmap committed to tasks");
    res.status(201).json({
      ok: true,
      created: created.length,
      skipped: wanted.length - created.length,
      days: useDays.length,
      firstDueDate: wanted[0]?.dueDate ?? null,
      goalId,
    });
  } catch (err) {
    logger.error({ err }, "roadmap commit error");
    res.status(500).json({ error: "Could not add that plan to your tasks" });
  }
});

export { router as roadmapRouter };
