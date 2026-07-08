import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { extractUserId } from "./auth";
import { eq, and, desc, sql } from "drizzle-orm";

function auth(req: any, res: any, next: any) {
  const userId = extractUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  req.userId = userId;
  next();
}

export const notificationsRouter = Router();

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  data?: Record<string, unknown>
) {
  await db.insert(notificationsTable).values({ userId, type, title, message, data: data ?? null });
}

notificationsRouter.get("/notifications", auth, async (req, res) => {
  const userId = req.userId!;
  try {
    const rows = await db.select().from(notificationsTable)
      .where(eq(notificationsTable.userId, userId))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(50);
    const unreadCount = rows.filter(r => !r.read).length;
    res.json({ notifications: rows, unreadCount });
  } catch (err) {
    res.status(500).json({ error: "Internal error" });
  }
});

notificationsRouter.patch("/notifications/:id/read", auth, async (req, res) => {
  const userId = req.userId!;
  try {
    await db.update(notificationsTable)
      .set({ read: true })
      .where(and(eq(notificationsTable.id, req.params.id), eq(notificationsTable.userId, userId)));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Internal error" });
  }
});

notificationsRouter.post("/notifications/mark-all-read", auth, async (req, res) => {
  const userId = req.userId!;
  try {
    await db.update(notificationsTable).set({ read: true }).where(eq(notificationsTable.userId, userId));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Internal error" });
  }
});

notificationsRouter.delete("/notifications/:id", auth, async (req, res) => {
  const userId = req.userId!;
  try {
    await db.delete(notificationsTable)
      .where(and(eq(notificationsTable.id, req.params.id), eq(notificationsTable.userId, userId)));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Internal error" });
  }
});

notificationsRouter.delete("/notifications", auth, async (req, res) => {
  const userId = req.userId!;
  try {
    await db.delete(notificationsTable).where(eq(notificationsTable.userId, userId));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Internal error" });
  }
});
