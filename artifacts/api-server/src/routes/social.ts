import { Response, Router } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { db } from "@workspace/db";
import {
  friendshipsTable, usersTable, userWalletsTable,
  studyStreaksTable, focusSessionsTable, activeSessionsTable,
  notificationsTable, followsTable,
  userMissionProgressTable, socialPostsTable, userBadgesTable,
} from "@workspace/db";
import { isUsersPremium } from "../lib/premiumCheck";
import { logger } from "../lib/logger";
import { ensureDailyBotActivity } from "../lib/botEngine";
import { eq, or, and, desc, ilike, sql, gte, inArray } from "drizzle-orm";

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

socialRouter.get("/social/friends", authMiddleware, async (req: AuthRequest, res: Response) => {
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
    const [activeSession] = await db.select({ updatedAt: activeSessionsTable.updatedAt, activeSeconds: activeSessionsTable.activeSeconds })
      .from(activeSessionsTable).where(eq(activeSessionsTable.userId, fid)).limit(1);
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
      online: !!activeSession,
      isStudying: !!activeSession,
      studyingFor: activeSession ? Math.round((activeSession.activeSeconds ?? 0) / 60) : null,
      studyStartedAt: activeSession ? activeSession.updatedAt : null,
    };
  }));

  res.json(friends.sort((a, b) => b.xp - a.xp));
});

socialRouter.get("/social/requests", authMiddleware, async (req: AuthRequest, res: Response) => {
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

// The web app posts to the plural /social/requests with `{ toUserId }`, while
// older callers use the singular /social/request with `{ targetId }`. Both
// shapes are accepted here so neither one 404s or 400s.
async function handleSendFriendRequest(req: AuthRequest, res: Response) {
  const userId = req.userId!;
  const { targetId, targetUsername, toUserId } = (req.body ?? {}) as {
    targetId?: string; targetUsername?: string; toUserId?: string;
  };

  let resolvedId = targetId ?? toUserId;
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
}

socialRouter.post("/social/request", authMiddleware, handleSendFriendRequest);
socialRouter.post("/social/requests", authMiddleware, handleSendFriendRequest);

async function handleAcceptFriendRequest(req: AuthRequest, res: Response) {
  const userId = req.userId!;
  const [row] = await db.select({
    id: friendshipsTable.id, requesterId: friendshipsTable.requesterId, addresseeId: friendshipsTable.addresseeId,
  }).from(friendshipsTable).where(eq(friendshipsTable.id, req.params.id as string)).limit(1);
  if (!row || row.addresseeId !== userId) return res.status(403).json({ error: "Not authorized" });
  const [updated] = await db.update(friendshipsTable).set({ status: "accepted", updatedAt: new Date() })
    .where(eq(friendshipsTable.id, req.params.id as string)).returning();
  await db.insert(notificationsTable).values({
    userId: row.requesterId, type: "friend_accepted",
    title: "Friend request accepted",
    message: "Your friend request was accepted!",
    data: { friendshipId: row.id },
  });
  res.json({ ok: true, friendship: updated });
}

// The web app uses POST; PATCH is kept for existing API consumers.
socialRouter.patch("/social/request/:id/accept", authMiddleware, handleAcceptFriendRequest);
socialRouter.post("/social/request/:id/accept", authMiddleware, handleAcceptFriendRequest);
socialRouter.patch("/social/requests/:id/accept", authMiddleware, handleAcceptFriendRequest);
socialRouter.post("/social/requests/:id/accept", authMiddleware, handleAcceptFriendRequest);

async function handleRejectFriendRequest(req: AuthRequest, res: Response) {
  const userId = req.userId!;
  const [row] = await db.select({
    id: friendshipsTable.id, addresseeId: friendshipsTable.addresseeId,
  }).from(friendshipsTable).where(eq(friendshipsTable.id, req.params.id as string)).limit(1);
  if (!row || row.addresseeId !== userId) return res.status(403).json({ error: "Not authorized" });
  await db.delete(friendshipsTable).where(eq(friendshipsTable.id, req.params.id as string));
  res.json({ ok: true });
}

socialRouter.patch("/social/request/:id/reject", authMiddleware, handleRejectFriendRequest);
socialRouter.post("/social/request/:id/reject", authMiddleware, handleRejectFriendRequest);
socialRouter.patch("/social/requests/:id/reject", authMiddleware, handleRejectFriendRequest);
socialRouter.post("/social/requests/:id/reject", authMiddleware, handleRejectFriendRequest);

async function handleCancelFriendRequest(req: AuthRequest, res: Response) {
  const userId = req.userId!;
  const [row] = await db.select({
    id: friendshipsTable.id, requesterId: friendshipsTable.requesterId, addresseeId: friendshipsTable.addresseeId,
  }).from(friendshipsTable).where(eq(friendshipsTable.id, req.params.id as string)).limit(1);
  if (!row || (row.requesterId !== userId && row.addresseeId !== userId)) return res.status(403).json({ error: "Not authorized" });
  await db.delete(friendshipsTable).where(eq(friendshipsTable.id, req.params.id as string));
  res.json({ ok: true });
}

socialRouter.delete("/social/request/:id", authMiddleware, handleCancelFriendRequest);
socialRouter.delete("/social/requests/:id", authMiddleware, handleCancelFriendRequest);

socialRouter.get("/social/search", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { q, friendsOnly } = req.query as { q?: string; friendsOnly?: string };
  if (!q || q.length < 2) return res.json([]);
  const userId = req.userId!;

  if (friendsOnly === "true") {
    const friendIds = await getFriendIds(userId);
    if (!friendIds.length) return res.json([]);
    const friends = await db.select({ id: usersTable.id, name: usersTable.name })
      .from(usersTable)
      .where(and(
        or(ilike(usersTable.name, `%${q}%`), ilike(usersTable.email, `%${q}%`)),
        sql`${usersTable.id} = ANY(ARRAY[${sql.join(friendIds.map(id => sql`${id}::text`), sql`, `)}])`,
      ))
      .limit(10);
    return res.json(friends.filter(u => u.id !== userId));
  }

  const users = await db.select({ id: usersTable.id, name: usersTable.name, role: usersTable.role })
    .from(usersTable)
    .where(and(
      or(ilike(usersTable.name, `%${q}%`), ilike(usersTable.email, `%${q}%`)),
      eq(usersTable.isGuest, false),
    ))
    .limit(10);
  res.json(users
    .filter(u => u.id !== userId)
    .map(u => ({ ...u, isAdmin: (u.role ?? "").toLowerCase() === "admin", isBot: (u.role ?? "").toLowerCase() === "bot" })));
});

socialRouter.get("/social/activity", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  try {
    const friendIds = await getFriendIds(userId);
    const allIds = [...friendIds, userId];

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    if (!allIds.length) return res.json([]);

    const [sessions, badges, missions, posts] = await Promise.all([
      db.select({
        id: focusSessionsTable.id, userId: focusSessionsTable.userId,
        durationSec: focusSessionsTable.durationSec, focusScore: focusSessionsTable.focusScore,
        mode: focusSessionsTable.mode, completedAt: focusSessionsTable.completedAt,
        category: focusSessionsTable.category,
      }).from(focusSessionsTable)
        .where(and(inArray(focusSessionsTable.userId, allIds), eq(focusSessionsTable.mode, "focus"), gte(focusSessionsTable.completedAt, since)))
        .orderBy(desc(focusSessionsTable.completedAt)).limit(30),

      db.select({
        id: userBadgesTable.id, userId: userBadgesTable.userId,
        badgeId: userBadgesTable.badgeId, unlockedAt: userBadgesTable.unlockedAt,
      }).from(userBadgesTable)
        .where(and(inArray(userBadgesTable.userId, allIds), gte(userBadgesTable.unlockedAt, since)))
        .orderBy(desc(userBadgesTable.unlockedAt)).limit(20),

      db.select({
        id: userMissionProgressTable.id, userId: userMissionProgressTable.userId,
        missionKey: userMissionProgressTable.missionKey, completedAt: userMissionProgressTable.completedAt,
      }).from(userMissionProgressTable)
        .where(and(inArray(userMissionProgressTable.userId, allIds), eq(userMissionProgressTable.rewardClaimed, true), gte(userMissionProgressTable.completedAt, since)))
        .orderBy(desc(userMissionProgressTable.completedAt)).limit(20),

      db.select({
        id: socialPostsTable.id, userId: socialPostsTable.userId,
        content: socialPostsTable.content, type: socialPostsTable.type, createdAt: socialPostsTable.createdAt,
      }).from(socialPostsTable)
        .where(and(inArray(socialPostsTable.userId, allIds), eq(socialPostsTable.isPublic, true), gte(socialPostsTable.createdAt, since)))
        .orderBy(desc(socialPostsTable.createdAt)).limit(20),
    ]);

    const uids = new Set([...sessions.map(s => s.userId), ...badges.map(b => b.userId), ...missions.map(m => m.userId), ...posts.map(p => p.userId)]);
    const userMap = new Map<string, { name: string; level: number; isAdmin: boolean; isBot: boolean }>();
    if (uids.size > 0) {
      const [userRows, walletRows] = await Promise.all([
        db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role }).from(usersTable).where(inArray(usersTable.id, [...uids])),
        db.select({ userId: userWalletsTable.userId, level: userWalletsTable.level }).from(userWalletsTable).where(inArray(userWalletsTable.userId, [...uids])),
      ]);
      const wmap = new Map(walletRows.map(w => [w.userId, w.level]));
      for (const u of userRows) {
        const role = (u.role ?? "user").toLowerCase();
        userMap.set(u.id, { name: u.name || u.email?.split("@")[0] || "Scholar", level: wmap.get(u.id) ?? 1, isAdmin: role === "admin", isBot: role === "bot" });
      }
    }

    const items: {
      id: string;
      type: string;
      userId: string;
      userName: string;
      userLevel: number;
      isMe: boolean;
      isAdmin: boolean;
      isBot: boolean;
      timestamp: Date;
      data: any;
    }[] = [];

    for (const s of sessions) {
      const u = userMap.get(s.userId);
      if (s.completedAt) {
        items.push({ id: `session-${s.id}`, type: "session_complete", userId: s.userId, userName: u?.name ?? "Scholar", userLevel: u?.level ?? 1, isMe: s.userId === userId, isAdmin: u?.isAdmin ?? false, isBot: u?.isBot ?? false, timestamp: s.completedAt, data: { durationMin: Math.round((s.durationSec ?? 0) / 60), focusScore: s.focusScore, category: s.category ?? "General" } });
      }
    }
    for (const b of badges) {
      const u = userMap.get(b.userId);
      items.push({ id: `badge-${b.id}`, type: "badge_unlocked", userId: b.userId, userName: u?.name ?? "Scholar", userLevel: u?.level ?? 1, isMe: b.userId === userId, isAdmin: u?.isAdmin ?? false, isBot: u?.isBot ?? false, timestamp: b.unlockedAt, data: { badgeId: b.badgeId } });
    }
    for (const m of missions) {
      if (!m.completedAt) continue;
      const u = userMap.get(m.userId);
      items.push({ id: `mission-${m.id}`, type: "mission_claimed", userId: m.userId, userName: u?.name ?? "Scholar", userLevel: u?.level ?? 1, isMe: m.userId === userId, isAdmin: u?.isAdmin ?? false, isBot: u?.isBot ?? false, timestamp: m.completedAt, data: { missionKey: m.missionKey } });
    }
    for (const p of posts) {
      const u = userMap.get(p.userId);
      items.push({ id: `post-${p.id}`, type: "post_created", userId: p.userId, userName: u?.name ?? "Scholar", userLevel: u?.level ?? 1, isMe: p.userId === userId, isAdmin: u?.isAdmin ?? false, isBot: u?.isBot ?? false, timestamp: p.createdAt, data: { content: p.content.slice(0, 200), postType: p.type } });
    }

    items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    res.json(items.slice(0, 40));
  } catch (err) {
    logger.error({ err }, "GET /social/activity error");
    res.status(500).json({ error: "Internal error" });
  }
});

socialRouter.get("/social/leaderboard", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const period = (req.query.period as string) || "weekly";
  const scope = (req.query.scope as string) || "global";

  try {
    // Global board: every registered user + AI rivals, so there's always
    // someone to compete with. Friends board: just your circle.
    const friendIds = await getFriendIds(userId);

    if (scope === "global") {
      // Keep the AI rivals' daily XP ticking whenever the board is viewed.
      await ensureDailyBotActivity();
    }

    // A3: ORDER BY + LIMIT in SQL (user_wallets_weekly_xp_idx /
    // _total_xp_idx) so the board stays <300ms at 12k+ wallets. The viewer
    // is fetched separately and always included, even past the top-50 cut.
    const sortCol = period === "weekly" ? userWalletsTable.weeklyXp : userWalletsTable.totalXp;

    const baseQuery = db
      .select({
        userId: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        role: usersTable.role,
        coins: userWalletsTable.coins,
        totalXp: userWalletsTable.totalXp,
        weeklyXp: userWalletsTable.weeklyXp,
        level: userWalletsTable.level,
        streak: studyStreaksTable.currentStreak,
      })
      .from(usersTable)
      .innerJoin(userWalletsTable, eq(userWalletsTable.userId, usersTable.id))
      .leftJoin(studyStreaksTable, eq(studyStreaksTable.userId, usersTable.id))
      .where(eq(usersTable.isGuest, false))
      .orderBy(desc(sortCol), desc(usersTable.createdAt));

    // Global board: top 200 in SQL (indexed) for competitive view. Friends board: small, unbounded.
    // Both scopes are bounded. The friends board used to fetch every row in
    // the users table and filter in JS — unbounded on a 12k-user install.
    const rows = scope === "global" ? await baseQuery.limit(200) : await baseQuery.limit(500);

    const filtered = scope === "friends"
      ? rows.filter(r => r.userId === userId || friendIds.includes(r.userId))
      : rows;

    // Fresh users may not have a wallet row yet (it's created lazily) — the
    // inner join above drops them. Append the viewer with zeroed stats so
    // everyone can always find themselves on the board.
    if (!filtered.some(r => r.userId === userId)) {
      const [me] = await db.select({
        userId: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        role: usersTable.role,
        coins: userWalletsTable.coins,
        totalXp: userWalletsTable.totalXp,
        weeklyXp: userWalletsTable.weeklyXp,
        level: userWalletsTable.level,
        streak: studyStreaksTable.currentStreak,
      })
        .from(usersTable)
        .leftJoin(userWalletsTable, eq(userWalletsTable.userId, usersTable.id))
        .leftJoin(studyStreaksTable, eq(studyStreaksTable.userId, usersTable.id))
        .where(eq(usersTable.id, userId));
      if (me) filtered.push({
        ...me,
        coins: me.coins ?? 0,
        totalXp: me.totalXp ?? 0,
        weeklyXp: me.weeklyXp ?? 0,
        level: me.level ?? 1,
      });
    }

    // Batched: 2 queries total instead of one per leaderboard row (was up to 200).
    const premiumSet = await isUsersPremium(filtered.map(r => r.userId));

    const entries = filtered.map(r => {
      const role = (r.role ?? "user").toLowerCase();
      return {
        userId: r.userId,
        name: r.name || r.email?.split("@")[0] || "User",
        // Both shapes — the leaderboard page reads weeklyXp/totalXp while the
        // community table reads `xp`.
        xp: period === "weekly" ? (r.weeklyXp ?? 0) : (r.totalXp ?? 0),
        weeklyXp: r.weeklyXp ?? 0,
        totalXp: r.totalXp ?? 0,
        level: r.level ?? 1,
        streak: r.streak ?? 0,
        coins: r.coins ?? 0,
        isPremium: premiumSet.has(r.userId),
        isAdmin: role === "admin",
        isBot: role === "bot",
        isCurrentUser: r.userId === userId,
        isMe: r.userId === userId,
      };
    });

    entries.sort((a, b) => b.xp - a.xp);

    // Top 200 — but always include the viewer, even past the cut.
    const LIMIT = 200;
    let ranked = entries.slice(0, LIMIT).map((e, i) => ({ ...e, rank: i + 1 }));
    const meIdx = entries.findIndex(e => e.isCurrentUser);
    if (meIdx >= LIMIT) {
      ranked = [...ranked, { ...entries[meIdx]!, rank: meIdx + 1 }];
    }

    res.json(ranked);
  } catch (err) {
    logger.error({ err }, "GET /social/leaderboard error");
    res.status(500).json({ error: "Internal error" });
  }
});

socialRouter.post("/social/follow/:userId", authMiddleware, async (req: AuthRequest, res: Response) => {
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
  } catch {
    res.status(500).json({ error: "Internal error" });
  }
});

socialRouter.delete("/social/follow/:userId", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { userId: targetId } = req.params as { userId: string };
  try {
    await db.delete(followsTable).where(and(eq(followsTable.followerId, userId), eq(followsTable.followingId, targetId)));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Internal error" });
  }
});

socialRouter.get("/social/following", authMiddleware, async (req: AuthRequest, res: Response) => {
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

socialRouter.get("/social/friends-activity", authMiddleware, async (req: AuthRequest, res: Response) => {
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
  } catch {
    res.status(500).json({ error: "Internal error" });
  }
});

socialRouter.get("/social/followers", authMiddleware, async (req: AuthRequest, res: Response) => {
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
