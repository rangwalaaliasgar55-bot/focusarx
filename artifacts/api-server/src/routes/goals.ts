import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router, type Response } from "express";
import { z } from "zod";
import { db, goalsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "../lib/logger";

export const goalsRouter = Router();

const createGoalSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  description: z.string().max(300).optional().nullable(),
});

const toggleGoalSchema = z.object({
  completed: z.boolean().optional(),
});

goalsRouter.get("/goals", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const rows = await db.select().from(goalsTable)
      .where(eq(goalsTable.userId, req.userId))
      .orderBy(desc(goalsTable.createdAt));
    res.json({ goals: rows });
  } catch (err) {
    logger.error({ err }, "get goals error");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Could not load goals" } });
  }
});

goalsRouter.post("/goals", authMiddleware, async (req: AuthRequest, res: Response) => {
  const parsed = createGoalSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input" },
    });
    return;
  }
  const { title, description } = parsed.data;
  try {
    const [goal] = await db.insert(goalsTable).values({
      id: crypto.randomUUID(),
      userId: req.userId,
      title: title.trim().slice(0, 100),
      description: description?.slice(0, 300) ?? null,
    }).returning();
    res.status(201).json({ goal });
  } catch (err) {
    logger.error({ err }, "create goal error");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Could not create goal" } });
  }
});

goalsRouter.patch("/goals/:id/complete", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params as { id: string };
  const parsed = toggleGoalSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Invalid request body" },
    });
    return;
  }
  const { completed } = parsed.data;
  try {
    const [goal] = await db.update(goalsTable)
      .set({ completed: completed ?? true })
      .where(and(eq(goalsTable.id, id), eq(goalsTable.userId, req.userId)))
      .returning();
    if (!goal) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Goal not found" } });
      return;
    }
    res.json({ goal });
  } catch (err) {
    logger.error({ err }, "toggle goal error");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Could not update goal" } });
  }
});

goalsRouter.delete("/goals/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params as { id: string };
  try {
    const [goal] = await db.delete(goalsTable)
      .where(and(eq(goalsTable.id, id), eq(goalsTable.userId, req.userId)))
      .returning();
    if (!goal) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Goal not found" } });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "delete goal error");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Could not delete goal" } });
  }
});
