import { Router } from "express";
import { db, goalsTable } from "@workspace/db";
import { extractUserId } from "./auth";
import { eq, and, desc } from "drizzle-orm";

function auth(req: any, res: any, next: any) {
  const userId = extractUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  req.userId = userId;
  next();
}

export const goalsRouter = Router();

goalsRouter.get("/goals", auth, async (req: any, res) => {
  const rows = await db.select().from(goalsTable)
    .where(eq(goalsTable.userId, req.userId))
    .orderBy(desc(goalsTable.createdAt));
  res.json({ goals: rows });
});

goalsRouter.post("/goals", auth, async (req: any, res) => {
  const { title, description } = req.body as { title?: string; description?: string };
  if (!title?.trim()) return res.status(400).json({ error: "Title required" });
  const [goal] = await db.insert(goalsTable).values({
    id: crypto.randomUUID(),
    userId: req.userId,
    title: title.trim().slice(0, 100),
    description: description?.slice(0, 300) ?? null,
  }).returning();
  res.status(201).json({ goal });
});

goalsRouter.patch("/goals/:id/complete", auth, async (req: any, res) => {
  const { id } = req.params;
  const { completed } = req.body as { completed?: boolean };
  const [goal] = await db.update(goalsTable)
    .set({ completed: completed ?? true })
    .where(and(eq(goalsTable.id, id), eq(goalsTable.userId, req.userId)))
    .returning();
  if (!goal) return res.status(404).json({ error: "Not found" });
  res.json({ goal });
});

goalsRouter.delete("/goals/:id", auth, async (req: any, res) => {
  const { id } = req.params;
  await db.delete(goalsTable)
    .where(and(eq(goalsTable.id, id), eq(goalsTable.userId, req.userId)));
  res.json({ ok: true });
});
