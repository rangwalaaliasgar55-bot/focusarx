import { Router } from "express";
import { db, tasksTable } from "@workspace/db";
import { eq, and, asc, desc } from "drizzle-orm";
import { extractUserId } from "./auth";
import { logger } from "../lib/logger";
import { updateMissionProgress } from "./missions";
import { z } from "zod";

const router = Router();

function authMiddleware(req: any, res: any, next: any) {
  const userId = extractUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  req.userId = userId;
  next();
}

const createTaskSchema = z.object({
  text: z.string().max(500).optional(),
  title: z.string().max(500).optional(),
  order: z.number().int().optional(),
  estimatedMinutes: z.number().int().min(0).max(1440).optional(),
  category: z.string().max(50).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  dueDate: z.string().max(20).optional(),
  recurring: z.string().max(20).optional(),
});

const updateTaskSchema = z.object({
  completed: z.boolean().optional(),
  done: z.boolean().optional(),
  text: z.string().max(500).optional(),
  title: z.string().max(500).optional(),
  order: z.number().int().optional(),
  estimatedMinutes: z.number().int().min(0).max(1440).nullable().optional(),
  category: z.string().max(50).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  dueDate: z.string().max(20).nullable().optional(),
  recurring: z.string().max(20).nullable().optional(),
});

router.get("/tasks", authMiddleware, async (req: any, res) => {
  try {
    const { category, priority, completed } = req.query as Record<string, string>;
    let query = db.select().from(tasksTable).where(eq(tasksTable.userId, req.userId)).$dynamic();

    const tasks = await db.select().from(tasksTable)
      .where(eq(tasksTable.userId, req.userId))
      .orderBy(asc(tasksTable.order), asc(tasksTable.createdAt));

    let filtered = tasks;
    if (category) filtered = filtered.filter((t) => t.category === category);
    if (priority) filtered = filtered.filter((t) => t.priority === priority);
    if (completed !== undefined) filtered = filtered.filter((t) => t.completed === (completed === "true"));

    res.set("Cache-Control", "private, max-age=10");
    res.json({ tasks: filtered });
  } catch (err) {
    logger.error({ err }, "get tasks error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/tasks/stats", authMiddleware, async (req: any, res) => {
  try {
    const tasks = await db.select().from(tasksTable).where(eq(tasksTable.userId, req.userId));
    const total = tasks.length;
    const completed = tasks.filter((t) => t.completed).length;
    const active = total - completed;
    const byCategory: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    for (const t of tasks) {
      const cat = t.category ?? "General";
      byCategory[cat] = (byCategory[cat] ?? 0) + 1;
      const pri = t.priority ?? "medium";
      byPriority[pri] = (byPriority[pri] ?? 0) + 1;
    }
    res.json({ total, completed, active, completionRate: total > 0 ? Math.round((completed / total) * 100) : 0, byCategory, byPriority });
  } catch (err) {
    logger.error({ err }, "task stats error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/tasks", authMiddleware, async (req: any, res) => {
  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid task data" }); return; }
  const { text, title, order, estimatedMinutes, category, priority, tags, dueDate, recurring } = parsed.data;
  const taskText = (text || title)?.trim();
  if (!taskText) { res.status(400).json({ error: "Task text required" }); return; }
  try {
    const [task] = await db.insert(tasksTable).values({
      userId: req.userId, text: taskText, completed: false, order: order ?? 0,
      estimatedMinutes, category: category ?? "General",
      priority: priority ?? "medium", tags: tags ?? [],
      dueDate, recurring,
    }).returning();
    res.status(201).json({ task });
  } catch (err) {
    logger.error({ err }, "create task error");
    res.status(500).json({ error: "Internal error" });
  }
});

async function handleTaskUpdate(req: any, res: any) {
  const { id } = req.params as { id: string };
  const parsed = updateTaskSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid task data" }); return; }
  const { completed, done, text, title, order, estimatedMinutes, category, priority, tags, dueDate, recurring } = parsed.data;
  try {
    const updates: Partial<typeof tasksTable.$inferInsert> = {};
    if (completed !== undefined) updates.completed = completed;
    if (done !== undefined) updates.completed = done;
    if (text !== undefined) updates.text = text;
    if (title !== undefined) updates.text = title;
    if (order !== undefined) updates.order = order;
    if (estimatedMinutes !== undefined) updates.estimatedMinutes = estimatedMinutes;
    if (category !== undefined) updates.category = category;
    if (priority !== undefined) updates.priority = priority;
    if (tags !== undefined) updates.tags = tags;
    if (dueDate !== undefined) updates.dueDate = dueDate;
    if (recurring !== undefined) updates.recurring = recurring;

    const wasCompleting = (completed === true || done === true);
    if (wasCompleting) updates.completedAt = new Date();

    const [task] = await db.update(tasksTable).set(updates)
      .where(and(eq(tasksTable.id, id), eq(tasksTable.userId, req.userId)))
      .returning();
    if (!task) { res.status(404).json({ error: "Task not found" }); return; }

    if (wasCompleting) {
      await updateMissionProgress(req.userId, "tasks", 1);
    }

    res.json({ task });
  } catch (err) {
    logger.error({ err }, "update task error");
    res.status(500).json({ error: "Internal error" });
  }
}

router.patch("/tasks/:id", authMiddleware, handleTaskUpdate);
router.put("/tasks/:id", authMiddleware, handleTaskUpdate);

router.delete("/tasks/:id", authMiddleware, async (req: any, res) => {
  const { id } = req.params as { id: string };
  try {
    await db.delete(tasksTable).where(and(eq(tasksTable.id, id), eq(tasksTable.userId, req.userId)));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "delete task error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/tasks/reorder", authMiddleware, async (req: any, res) => {
  const { ids } = req.body as { ids?: string[] };
  if (!Array.isArray(ids)) { res.status(400).json({ error: "ids array required" }); return; }
  try {
    await Promise.all(ids.map((id, idx) =>
      db.update(tasksTable).set({ order: idx })
        .where(and(eq(tasksTable.id, id), eq(tasksTable.userId, req.userId)))
    ));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "reorder tasks error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.delete("/tasks", authMiddleware, async (req: any, res) => {
  const { completed } = req.query as { completed?: string };
  try {
    if (completed === "true") {
      await db.delete(tasksTable).where(and(eq(tasksTable.userId, req.userId), eq(tasksTable.completed, true)));
      res.json({ ok: true });
    } else {
      res.status(400).json({ error: "Specify ?completed=true to bulk delete" });
    }
  } catch (err) {
    logger.error({ err }, "bulk delete tasks error");
    res.status(500).json({ error: "Internal error" });
  }
});

export { router as tasksRouter };
