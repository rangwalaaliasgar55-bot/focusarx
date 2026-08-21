import { Request, Response, NextFunction } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { extractUserId } from "./auth";
import { eq, and, desc, sql } from "drizzle-orm";

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

notificationsRouter.get("/notifications", authMiddleware, async (req: AuthRequest, res: Response) => {
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

notificationsRouter.patch("/notifications/:id/read", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  try {
    await db.update(notificationsTable)
      .set({ read: true })
      .where(and(eq(notificationsTable.id, req.params.id as string), eq(notificationsTable.userId, userId)));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Internal error" });
  }
});

notificationsRouter.post("/notifications/mark-all-read", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  try {
    await db.update(notificationsTable).set({ read: true }).where(eq(notificationsTable.userId, userId));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Internal error" });
  }
});

notificationsRouter.delete("/notifications/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  try {
    await db.delete(notificationsTable)
      .where(and(eq(notificationsTable.id, req.params.id as string), eq(notificationsTable.userId, userId)));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Internal error" });
  }
});

notificationsRouter.delete("/notifications", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  try {
    await db.delete(notificationsTable).where(eq(notificationsTable.userId, userId));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Internal error" });
  }
});
