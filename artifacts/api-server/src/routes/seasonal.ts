import { Router } from "express";
import { db, seasonalEventsTable, userSeasonalProgressTable } from "@workspace/db";
import { eq, and, lte, gte } from "drizzle-orm";
import { extractUserId } from "./auth";

export const seasonalRouter = Router();

seasonalRouter.get("/seasonal/active", async (_req, res) => {
  try {
    const now = new Date();
    const events = await db.select().from(seasonalEventsTable)
      .where(and(eq(seasonalEventsTable.isActive, true), lte(seasonalEventsTable.startDate, now), gte(seasonalEventsTable.endDate, now)))
      .limit(1);
    if (!events.length) return res.json(null);
    res.json(events[0]);
  } catch {
    res.status(500).json({ error: "Failed to fetch active event" });
  }
});

seasonalRouter.get("/seasonal/all", async (_req, res) => {
  try {
    const events = await db.select().from(seasonalEventsTable).orderBy(seasonalEventsTable.startDate);
    res.json(events);
  } catch {
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

seasonalRouter.get("/seasonal/:eventId/progress", async (req: any, res) => {
  const userId = extractUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const [prog] = await db.select().from(userSeasonalProgressTable)
      .where(and(eq(userSeasonalProgressTable.userId, userId), eq(userSeasonalProgressTable.eventId, req.params.eventId as string)))
      .limit(1);
    res.json(prog ?? { points: 0, completedMissions: [], rewardsClaimed: [] });
  } catch {
    res.status(500).json({ error: "Failed to fetch progress" });
  }
});
