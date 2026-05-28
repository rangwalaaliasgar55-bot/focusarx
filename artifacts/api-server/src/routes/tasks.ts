import { Router } from "express";
import { db, tasksTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { extractUserId } from "./auth";
import { logger } from "../lib/logger";

const router = Router();

function authMiddleware(req: any, res: any, next: any) {
  const userId = extractUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  req.userId = userId;
  next();
}

router.get("/tasks", authMiddleware, async (req: any, res) => {
  try {
    const tasks = await db.select().from(tasksTable)
      .where(eq(tasksTable.userId, req.userId))
      .orderBy(asc(tasksTable.order), asc(tasksTable.createdAt));
    res.json({ tasks });
  } catch (err) {
    logger.error({ err }, "get tasks error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/tasks", authMiddleware, async (req: any, res) => {
  const { text, order } = req.body as { text?: string; order?: number };
  if (!text?.trim()) { res.status(400).json({ error: "Task text required" }); return; }
  try {
    const [task] = await db.insert(tasksTable).values({
      userId: req.userId, text: text.trim(), completed: false, order: order ?? 0,
    }).returning();
    res.status(201).json({ task });
  } catch (err) {
    logger.error({ err }, "create task error");
    res.status(500).json({ error: "Internal error" });
  }
});

async function handleTaskUpdate(req: any, res: any) {
  const { id } = req.params as { id: string };
  const { completed, text, order, estimatedMinutes } = req.body as {
    completed?: boolean; text?: string; order?: number; estimatedMinutes?: number | null;
  };
  try {
    const updates: Partial<typeof tasksTable.$inferInsert> = {};
    if (completed !== undefined) updates.completed = completed;
    if (text !== undefined) updates.text = text;
    if (order !== undefined) updates.order = order;
    if (estimatedMinutes !== undefined) updates.estimatedMinutes = estimatedMinutes;
    const [task] = await db.update(tasksTable).set(updates)
      .where(and(eq(tasksTable.id, id), eq(tasksTable.userId, req.userId)))
      .returning();
    if (!task) { res.status(404).json({ error: "Task not found" }); return; }
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

export { router as tasksRouter };
