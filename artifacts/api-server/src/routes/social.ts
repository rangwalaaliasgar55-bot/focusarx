import { Router } from "express";
import { db } from "@workspace/db";
import {
  friendshipsTable, usersTable, userWalletsTable,
  studyStreaksTable, userBadgesTable, focusSessionsTable,
  tasksTable, notificationsTable, followsTable,
} from "@workspace/db";
import { extractUserId } from "./auth";
import { eq, or, and, desc, ne, ilike, sql } from "drizzle-orm";

function auth(req: any, res: any, next: any) {
  const userId = extractUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  req.userId = userId;
  next();
}

export const socialRouter = Router();

async function getFriendIds(userId: string): Promise<string[]> {
  const rows = await db.select().from(friendshipsTable).where(
    and(
      or(eq(friendshipsTable.requesterId, userId), eq(friendshipsTable.addresseeId, userId)),
      eq(friendshipsTable.status, "accepted"),
    )
  );
  return rows.map(r => r.requesterId === userId ? r.addresseeId : r.requesterId);
}

socialRouter.get("/social/friends", auth, async (req, res) => {
  const userId = req.userId!;
  const friendIds = await getFriendIds(userId);
  if (!friendIds.length) return res.json([]);

  const friends = await Promise.all(friendIds.map(async (fid) => {
    const [user] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, bio: usersTable.bio })
      .from(usersTable).where(eq(usersTable.id, fid)).limit(1);
    const [wallet] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, fid)).limit(1);
    const [streak] = await db.select().from(studyStreaksTable).where(eq(studyStreaksTable.userId, fid)).limit(1);
    const todaySessions = await db.select({ count: sql<number>`count(*)` }).from(focusSessionsTable)
      .where(and(eq(focusSessionsTable.userId, fid), sql`completed_at >= now() - interval '24 hours'`));
    return {
      id: fid,
      name: user?.name || user?.email?.split("@")[0] || "User",
      email: user?.email,
      bio: user?.bio,
      xp: wallet?.totalXp ?? 0,
      level: wallet?.level ?? 1,
      coins: wallet?.coins ?? 0,
      streak: streak?.currentStreak ?? 0,
      productivityScore: 0,
      sessionsToday: Number(todaySessions[0]?.count ?? 0),
      online: false,
    };
  }));

  res.json(friends.sort((a, b) => b.xp - a.xp));
});

socialRouter.get("/social/requests", auth, async (req, res) => {
  const userId = req.userId!;
  const incoming = await db.select().from(friendshipsTable)
    .where(and(eq(friendshipsTable.addresseeId, userId), eq(friendshipsTable.status, "pending")));
  const outgoing = await db.select().from(friendshipsTable)
    .where(and(eq(friendshipsTable.requesterId, userId), eq(friendshipsTable.status, "pending")));

  const enriched = async (rows: typeof incoming, role: "incoming" | "outgoing") => {
    return Promise.all(rows.map(async r => {
      const otherId = role === "incoming" ? r.requesterId : r.addresseeId;
      const [user] = await db.select({ name: usersTable.name, email: usersTable.email })
        .from(usersTable).where(eq(usersTable.id, otherId)).limit(1);
      return { ...r, otherUser: { id: otherId, name: user?.name, email: user?.email }, role };
    }));
  };

  res.json({ incoming: await enriched(incoming, "incoming"), outgoing: await enriched(outgoing, "outgoing") });
});

socialRouter.post("/social/request", auth, async (req, res) => {
  const userId = req.userId!;
  const { targetId, targetUsername } = req.body;

  let resolvedId = targetId;
  if (!resolvedId && targetUsername) {
    const [u] = await db.select({ id: usersTable.id }).from(usersTable)
      .where(or(eq(usersTable.email, targetUsername), ilike(usersTable.name, targetUsername))).limit(1);
    if (!u) return res.status(404).json({ error: "User not found" });
    resolvedId = u.id;
  }
  if (!resolvedId) return res.status(400).json({ error: "targetId or targetUsername required" });
  if (resolvedId === userId) return res.status(400).json({ error: "Cannot add yourself" });

  const existing = await db.select().from(friendshipsTable).where(
    or(
      and(eq(friendshipsTable.requesterId, userId), eq(friendshipsTable.addresseeId, resolvedId)),
      and(eq(friendshipsTable.requesterId, resolvedId), eq(friendshipsTable.addresseeId, userId)),
    )
  ).limit(1);
  if (existing.length) return res.status(409).json({ error: "Request already exists or already friends" });

  const [row] = await db.insert(friendshipsTable).values({ requesterId: userId, addresseeId: resolvedId, status: "pending" }).returning();

  await db.insert(notificationsTable).values({
    userId: resolvedId, type: "friend_request",
    title: "New friend request",
    message: "Someone sent you a friend request",
    data: { friendshipId: row.id, requesterId: userId },
  });

  res.json({ ok: true, friendship: row });
});

socialRouter.patch("/social/request/:id/accept", auth, async (req, res) => {
  const userId = req.userId!;
  const [row] = await db.select().from(friendshipsTable).where(eq(friendshipsTable.id, req.params.id)).limit(1);
  if (!row || row.addresseeId !== userId) return res.status(403).json({ error: "Not authorized" });
  const [updated] = await db.update(friendshipsTable).set({ status: "accepted", updatedAt: new Date() })
    .where(eq(friendshipsTable.id, req.params.id)).returning();
  await db.insert(notificationsTable).values({
    userId: row.requesterId, type: "friend_accepted",
    title: "Friend request accepted",
    message: "Your friend request was accepted!",
    data: { friendshipId: row.id },
  });
  res.json({ ok: true, friendship: updated });
});

socialRouter.patch("/social/request/:id/reject", auth, async (req, res) => {
  const userId = req.userId!;
  const [row] = await db.select().from(friendshipsTable).where(eq(friendshipsTable.id, req.params.id)).limit(1);
  if (!row || row.addresseeId !== userId) return res.status(403).json({ error: "Not authorized" });
  await db.delete(friendshipsTable).where(eq(friendshipsTable.id, req.params.id));
  res.json({ ok: true });
});

socialRouter.delete("/social/request/:id", auth, async (req, res) => {
  const userId = req.userId!;
  const [row] = await db.select().from(friendshipsTable).where(eq(friendshipsTable.id, req.params.id)).limit(1);
  if (!row || (row.requesterId !== userId && row.addresseeId !== userId)) return res.status(403).json({ error: "Not authorized" });
  await db.delete(friendshipsTable).where(eq(friendshipsTable.id, req.params.id));
  res.json({ ok: true });
});

socialRouter.get("/social/search", auth, async (req, res) => {
  const { q } = req.query as { q?: string };
  if (!q || q.length < 2) return res.json([]);
  const users = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
    .from(usersTable)
    .where(or(ilike(usersTable.name, `%${q}%`), ilike(usersTable.email, `%${q}%`)))
    .limit(10);
  res.json(users.filter(u => u.id !== req.userId));
});

socialRouter.get("/social/activity", auth, async (req, res) => {
  const userId = req.userId!;
  const friendIds = await getFriendIds(userId);
  if (!friendIds.length) return res.json([]);

  const sessions = await db.select({
    id: focusSessionsTable.id,
    userId: focusSessionsTable.userId,
    durationSec: focusSessionsTable.durationSec,
    focusScore: focusSessionsTable.focusScore,
    completedAt: focusSessionsTable.completedAt,
  }).from(focusSessionsTable)
    .where(and(
      sql`${focusSessionsTable.userId} = ANY(ARRAY[${sql.join(friendIds.map(id => sql`${id}::text`), sql`, `)}])`,
      sql`completed_at >= now() - interval '7 days'`,
    ))
    .orderBy(desc(focusSessionsTable.completedAt))
    .limit(50);

  const userCache: Record<string, { name: string; email?: string }> = {};
  const activities = await Promise.all(sessions.map(async s => {
    if (!userCache[s.userId]) {
      const [u] = await db.select({ name: usersTable.name, email: usersTable.email })
        .from(usersTable).where(eq(usersTable.id, s.userId)).limit(1);
      userCache[s.userId] = { name: u?.name || u?.email?.split("@")[0] || "User", email: u?.email };
    }
    const user = userCache[s.userId];
    const mins = Math.round((s.durationSec ?? 0) / 60);
    return {
      id: s.id,
      type: "session",
      userId: s.userId,
      userName: user.name,
      description: `Completed a ${mins}min focus session${s.focusScore ? ` with ${s.focusScore.toFixed(0)}% focus` : ""}`,
      timestamp: s.completedAt,
      icon: "🎯",
    };
  }));

  res.json(activities.sort((a, b) => new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime()));
});

const LEADERBOARD_PERIODS = ["daily", "weekly", "monthly", "alltime"] as const;

socialRouter.get("/social/leaderboard", auth, async (req, res) => {
  const userId = req.userId!;
  const period = (req.query.period as string) || "weekly";
  const friendIds = await getFriendIds(userId);
  const allIds = [userId, ...friendIds];

  const wallets = await db.select().from(userWalletsTable)
    .where(sql`${userWalletsTable.userId} = ANY(ARRAY[${sql.join(allIds.map(id => sql`${id}::text`), sql`, `)}])`);

  const entries = await Promise.all(wallets.map(async w => {
    const [u] = await db.select({ name: usersTable.name, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, w.userId)).limit(1);
    const [streak] = await db.select().from(studyStreaksTable).where(eq(studyStreaksTable.userId, w.userId)).limit(1);
    return {
      userId: w.userId,
      name: u?.name || u?.email?.split("@")[0] || "User",
      xp: period === "weekly" ? (w.weeklyXp ?? 0) : w.totalXp,
      level: w.level,
      streak: streak?.currentStreak ?? 0,
      coins: w.coins,
      isMe: w.userId === userId,
    };
  }));

  res.json(entries.sort((a, b) => b.xp - a.xp).map((e, i) => ({ ...e, rank: i + 1 })));
});

// ─── FOLLOWS ─────────────────────────────────────────────────────────────────

socialRouter.post("/social/follow/:userId", auth, async (req, res) => {
  const userId = req.userId!;
  const { userId: targetId } = req.params as { userId: string };
  if (userId === targetId) { res.status(400).json({ error: "Cannot follow yourself" }); return; }
  try {
    const [target] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
    if (!target) { res.status(404).json({ error: "User not found" }); return; }
    const [existing] = await db.select().from(followsTable).where(and(eq(followsTable.followerId, userId), eq(followsTable.followingId, targetId))).limit(1);
    if (existing) { res.json({ ok: true, alreadyFollowing: true }); return; }
    await db.insert(followsTable).values({ followerId: userId, followingId: targetId });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Internal error" });
  }
});

socialRouter.delete("/social/follow/:userId", auth, async (req, res) => {
  const userId = req.userId!;
  const { userId: targetId } = req.params as { userId: string };
  try {
    await db.delete(followsTable).where(and(eq(followsTable.followerId, userId), eq(followsTable.followingId, targetId)));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Internal error" });
  }
});

socialRouter.get("/social/following", auth, async (req, res) => {
  const userId = req.userId!;
  try {
    const rows = await db.select().from(followsTable).where(eq(followsTable.followerId, userId)).orderBy(desc(followsTable.createdAt));
    const users = await Promise.all(rows.map(async r => {
      const [u] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
        .from(usersTable).where(eq(usersTable.id, r.followingId)).limit(1);
      const [w] = await db.select({ level: userWalletsTable.level, totalXp: userWalletsTable.totalXp }).from(userWalletsTable).where(eq(userWalletsTable.userId, r.followingId)).limit(1);
      const [s] = await db.select({ currentStreak: studyStreaksTable.currentStreak }).from(studyStreaksTable).where(eq(studyStreaksTable.userId, r.followingId)).limit(1);
      return { id: r.followingId, name: u?.name || u?.email?.split("@")[0] || "User", level: w?.level ?? 1, xp: w?.totalXp ?? 0, streak: s?.currentStreak ?? 0, followedAt: r.createdAt };
    }));
    res.json(users);
  } catch {
    res.status(500).json({ error: "Internal error" });
  }
});

socialRouter.get("/social/friends-activity", auth, async (req, res) => {
  const userId = req.userId!;
  try {
    const followRows = await db.select({ followingId: followsTable.followingId })
      .from(followsTable).where(eq(followsTable.followerId, userId));
    const friendIds = await getFriendIds(userId);
    const allIds = [...new Set([...followRows.map(f => f.followingId), ...friendIds])];
    if (!allIds.length) return res.json([]);

    const sessions = await db.select({
      id: focusSessionsTable.id,
      userId: focusSessionsTable.userId,
      durationSec: focusSessionsTable.durationSec,
      focusScore: focusSessionsTable.focusScore,
      completedAt: focusSessionsTable.completedAt,
    }).from(focusSessionsTable)
      .where(and(
        sql`${focusSessionsTable.userId} = ANY(ARRAY[${sql.join(allIds.map(id => sql`${id}::text`), sql`, `)}])`,
        sql`completed_at >= now() - interval '24 hours'`,
      ))
      .orderBy(desc(focusSessionsTable.completedAt))
      .limit(20);

    const userCache: Record<string, string> = {};
    const activities = await Promise.all(sessions.map(async s => {
      if (!userCache[s.userId]) {
        const [u] = await db.select({ name: usersTable.name, email: usersTable.email })
          .from(usersTable).where(eq(usersTable.id, s.userId)).limit(1);
        userCache[s.userId] = u?.name || u?.email?.split("@")[0] || "User";
      }
      const mins = Math.round((s.durationSec ?? 0) / 60);
      const elapsed = s.completedAt ? Math.round((Date.now() - new Date(s.completedAt).getTime()) / 60000) : 0;
      const timeAgo = elapsed < 60 ? `${elapsed}m ago` : `${Math.round(elapsed / 60)}h ago`;
      return {
        id: s.id,
        userId: s.userId,
        userName: userCache[s.userId]!,
        action: `Completed a ${mins}min focus session${s.focusScore ? ` (${Math.round(s.focusScore)}% focus)` : ""}`,
        timeAgo,
        icon: "🎯",
        timestamp: s.completedAt,
      };
    }));

    res.json(activities.slice(0, 5));
  } catch (err) {
    res.status(500).json({ error: "Internal error" });
  }
});

socialRouter.get("/social/followers", auth, async (req, res) => {
  const userId = req.userId!;
  try {
    const rows = await db.select().from(followsTable).where(eq(followsTable.followingId, userId)).orderBy(desc(followsTable.createdAt));
    const users = await Promise.all(rows.map(async r => {
      const [u] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
        .from(usersTable).where(eq(usersTable.id, r.followerId)).limit(1);
      const [w] = await db.select({ level: userWalletsTable.level, totalXp: userWalletsTable.totalXp }).from(userWalletsTable).where(eq(userWalletsTable.userId, r.followerId)).limit(1);
      return { id: r.followerId, name: u?.name || u?.email?.split("@")[0] || "User", level: w?.level ?? 1, xp: w?.totalXp ?? 0, followedAt: r.createdAt };
    }));
    res.json(users);
  } catch {
    res.status(500).json({ error: "Internal error" });
  }
});
