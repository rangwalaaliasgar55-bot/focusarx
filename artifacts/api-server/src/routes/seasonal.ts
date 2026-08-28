import { Router } from "express";
import { db, seasonalEventsTable, userSeasonalProgressTable } from "@workspace/db";
import { eq, and, lte, gte } from "drizzle-orm";
import { extractUserId } from "./auth";
import { isUserPremium } from "../lib/premiumCheck";
import { sendUnauthorized } from "../lib/httpErrors";

const PREMIUM_CHALLENGES = [
  { id: "cosmic-10", title: "Cosmic Consistency", description: "Complete 10 focus sessions during the event", target: 10, reward: "Exclusive Aurora city skin" },
  { id: "deep-300", title: "Deep Season", description: "Protect 300 focus minutes", target: 300, reward: "1,500 XP + premium emote" },
];

export const seasonalRouter = Router();

seasonalRouter.get("/seasonal/active", async (req, res) => {
  try {
    const now = new Date();
    const events = await db.select().from(seasonalEventsTable)
      .where(and(eq(seasonalEventsTable.isActive, true), lte(seasonalEventsTable.startDate, now), gte(seasonalEventsTable.endDate, now)));
    if (!events.length) return res.json(null);
    const userId = extractUserId(req);
    const premium = userId ? await isUserPremium(userId) : false;
    const event = (premium ? events.find((item) => item.premiumOnly) : events.find((item) => !item.premiumOnly)) ?? events[0]!;
    res.json({ ...event, locked: event.premiumOnly && !premium, premiumChallenges: premium ? PREMIUM_CHALLENGES : [] });
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

seasonalRouter.get("/seasonal/premium-challenges", async (req, res) => {
  const userId = extractUserId(req);
  if (!userId) return sendUnauthorized(res);
  if (!await isUserPremium(userId)) return res.status(403).json({ error: "Premium required" });
  res.json({ challenges: PREMIUM_CHALLENGES });
});

seasonalRouter.get("/seasonal/:eventId/progress", async (req: any, res) => {
  const userId = extractUserId(req);
  if (!userId) return sendUnauthorized(res);
  try {
    const [event] = await db.select({ premiumOnly: seasonalEventsTable.premiumOnly }).from(seasonalEventsTable)
      .where(eq(seasonalEventsTable.id, req.params.eventId as string)).limit(1);
    if (!event) return res.status(404).json({ error: "Event not found" });
    if (event.premiumOnly && !await isUserPremium(userId)) return res.status(403).json({ error: "Premium required" });
    const [prog] = await db.select().from(userSeasonalProgressTable)
      .where(and(eq(userSeasonalProgressTable.userId, userId), eq(userSeasonalProgressTable.eventId, req.params.eventId as string)))
      .limit(1);
    res.json(prog ?? { points: 0, completedMissions: [], rewardsClaimed: [] });
  } catch {
    res.status(500).json({ error: "Failed to fetch progress" });
  }
});
