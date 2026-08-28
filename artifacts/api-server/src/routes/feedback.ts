import { Request, Response, NextFunction } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router } from "express";
import { db } from "@workspace/db";
import { appFeedbackTable, userWalletsTable } from "@workspace/db";
import { extractUserId } from "./auth";
import { eq, desc, avg, count, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

function adminAuth(req: any, res: any, next: any) {
  const adminCookie = req.cookies?.focusarx_admin;
  if (!adminCookie) { res.status(401).json({ error: "Admin only" }); return; }
  next();
}

export const feedbackRouter = Router();

feedbackRouter.post("/feedback", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  try {
    const { rating, message, category, sessionCount } = req.body as {
      rating: number;
      message?: string;
      category?: string;
      sessionCount?: number;
    };

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be 1-5" });
    }

    const [wallet] = await db.select({ level: userWalletsTable.level })
      .from(userWalletsTable).where(eq(userWalletsTable.userId, userId)).limit(1);

    const device = req.headers["user-agent"]?.includes("Mobile") ? "mobile" : "desktop";

    await db.insert(appFeedbackTable).values({
      userId,
      rating,
      message: message ? message.slice(0, 1000) : null,
      category: category ?? "general",
      sessionCount: sessionCount ?? 0,
      userLevel: wallet?.level ?? 1,
      device,
    });

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "POST /feedback error:");
    res.status(500).json({ error: "Internal error" });
  }
});

feedbackRouter.get("/admin/feedback", adminAuth, async (_req, res) => {
  try {
    const [stats] = await db.select({
      avgRating: avg(appFeedbackTable.rating),
      total: count(appFeedbackTable.id),
    }).from(appFeedbackTable);

    const byRating = await db.select({
      rating: appFeedbackTable.rating,
      count: count(appFeedbackTable.id),
    }).from(appFeedbackTable)
      .groupBy(appFeedbackTable.rating)
      .orderBy(appFeedbackTable.rating);

    const recent = await db.select().from(appFeedbackTable)
      .orderBy(desc(appFeedbackTable.createdAt))
      .limit(50);

    const byCategory = await db.select({
      category: appFeedbackTable.category,
      count: count(appFeedbackTable.id),
      avgRating: avg(appFeedbackTable.rating),
    }).from(appFeedbackTable)
      .groupBy(appFeedbackTable.category);

    res.json({
      avgRating: Number(stats?.avgRating ?? 0).toFixed(1),
      total: stats?.total ?? 0,
      byRating,
      byCategory,
      recent,
    });
  } catch (err) {
    logger.error({ err }, "GET /admin/feedback error:");
    res.status(500).json({ error: "Internal error" });
  }
});
