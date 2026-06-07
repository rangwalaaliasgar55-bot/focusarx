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

notificationsRouter.get("/api/notifications", auth, async (req, res) => {
  const userId = req.userId!;
  const rows = await db.select().from(notificationsTable)
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);
  const unreadCount = rows.filter(r => !r.read).length;
  res.json({ notifications: rows, unreadCount });
});

notificationsRouter.patch("/api/notifications/:id/read", auth, async (req, res) => {
  const userId = req.userId!;
  await db.update(notificationsTable)
    .set({ read: true })
    .where(and(eq(notificationsTable.id, req.params.id), eq(notificationsTable.userId, userId)));
  res.json({ ok: true });
});

notificationsRouter.post("/api/notifications/mark-all-read", auth, async (req, res) => {
  const userId = req.userId!;
  await db.update(notificationsTable).set({ read: true }).where(eq(notificationsTable.userId, userId));
  res.json({ ok: true });
});

notificationsRouter.delete("/api/notifications/:id", auth, async (req, res) => {
  const userId = req.userId!;
  await db.delete(notificationsTable)
    .where(and(eq(notificationsTable.id, req.params.id), eq(notificationsTable.userId, userId)));
  res.json({ ok: true });
});

notificationsRouter.delete("/api/notifications", auth, async (req, res) => {
  const userId = req.userId!;
  await db.delete(notificationsTable).where(eq(notificationsTable.userId, userId));
  res.json({ ok: true });
});
