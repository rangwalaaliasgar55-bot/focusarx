import { Request, Response, NextFunction } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable, userWalletsTable, studyStreaksTable,
  userBadgesTable, focusSessionsTable, tasksTable,
  friendshipsTable,
} from "@workspace/db";
import { extractUserId } from "./auth";
import { isUserPremium } from "../lib/premiumCheck";
import { premiumSubscriptionsTable } from "@workspace/db";
import { eq, and, or, sql, desc } from "drizzle-orm";

export const publicProfilesRouter = Router();

publicProfilesRouter.get("/u/:username", async (req: AuthRequest, res: Response) => {
  const { username } = req.params as { username: string };
  // Project explicit columns — a bare select couples this to the full users
  // schema and 500s on schema drift (missing column).
  const [user] = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    bio: usersTable.bio,
    timezone: usersTable.timezone,
    createdAt: usersTable.createdAt,
  }).from(usersTable)
    .where(or(eq(usersTable.email, username), sql`lower(name) = lower(${username})`))
    .limit(1);
  if (!user) return res.status(404).json({ error: "User not found" });

  const [wallet] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, user.id)).limit(1);
  const [streak] = await db.select().from(studyStreaksTable).where(eq(studyStreaksTable.userId, user.id)).limit(1);
  const badges = await db.select().from(userBadgesTable).where(eq(userBadgesTable.userId, user.id)).limit(20);

  const [sessionStats] = await db.select({
    totalSessions: sql<number>`count(*)`,
    totalMinutes: sql<number>`coalesce(sum(duration_sec)/60, 0)`,
  }).from(focusSessionsTable).where(and(eq(focusSessionsTable.userId, user.id), sql`completed_at is not null`));

  const [taskStats] = await db.select({ completed: sql<number>`count(*)` }).from(tasksTable)
    .where(and(eq(tasksTable.userId, user.id), eq(tasksTable.completed, true)));

  const [friendCount] = await db.select({ count: sql<number>`count(*)` }).from(friendshipsTable)
    .where(and(or(eq(friendshipsTable.requesterId, user.id), eq(friendshipsTable.addresseeId, user.id)), eq(friendshipsTable.status, "accepted")));

  const isPremium = await isUserPremium(user.id);

  res.json({
    id: user.id,
    name: user.name || user.email?.split("@")[0] || "User",
    bio: user.bio,
    timezone: user.timezone,
    joinedAt: user.createdAt,
    xp: wallet?.totalXp ?? 0,
    level: wallet?.level ?? 1,
    coins: wallet?.coins ?? 0,
    prestige: wallet?.prestige ?? 0,
    isPremium,
    streak: streak?.currentStreak ?? 0,
    longestStreak: streak?.longestStreak ?? 0,
    totalSessions: Number(sessionStats?.totalSessions ?? 0),
    totalFocusHours: Math.round(Number(sessionStats?.totalMinutes ?? 0) / 60 * 10) / 10,
    tasksCompleted: Number(taskStats?.completed ?? 0),
    badgeCount: badges.length,
    recentBadges: badges.slice(0, 6).map(b => b.badgeId),
    friendCount: Number(friendCount?.count ?? 0),
  });
});

publicProfilesRouter.post("/u/:username/friend", authMiddleware, async (req: AuthRequest, res: Response) => {
  const requesterId = req.userId!;
  const { username } = req.params as { username: string };
  const [target] = await db.select({ id: usersTable.id }).from(usersTable)
    .where(or(eq(usersTable.email, username), sql`lower(name) = lower(${username})`)).limit(1);
  if (!target) return res.status(404).json({ error: "User not found" });
  if (target.id === requesterId) return res.status(400).json({ error: "Cannot add yourself" });

  const existing = await db.select().from(friendshipsTable).where(
    or(
      and(eq(friendshipsTable.requesterId, requesterId), eq(friendshipsTable.addresseeId, target.id)),
      and(eq(friendshipsTable.requesterId, target.id), eq(friendshipsTable.addresseeId, requesterId)),
    )
  ).limit(1);
  if (existing.length) return res.status(409).json({ error: "Request already exists" });

  const [row] = await db.insert(friendshipsTable).values({ requesterId, addresseeId: target.id, status: "pending" }).returning();
  res.json({ ok: true, friendship: row });
});
