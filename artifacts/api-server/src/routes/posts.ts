import { Response } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router } from "express";
import { db } from "@workspace/db";
import {
  socialPostsTable, postReactionsTable, postCommentsTable, postSavesTable,
  usersTable, userWalletsTable, followsTable, notificationsTable,
  groupMembersTable,
} from "@workspace/db";
import { extractUserId } from "./auth";
import { eq, and, desc, lt, sql, inArray, ne } from "drizzle-orm";
import { moderateText } from "../lib/moderation";
import { parseLimit, parseOffset } from "../lib/pagination";
import { ensureDailyBotActivity, materializeDueBotReplies, queueBotReplies, queueBotCommentReply } from "../lib/botEngine";
import { logger } from "../lib/logger";

const REPEAT_OFFENDER_THRESHOLD = 3;

function optionalAuth(req: any, res: any, next: any) {
  const userId = extractUserId(req);
  req.userId = userId;
  next();
}

export const postsRouter = Router();

const REACTION_TYPES = ["fire", "insightful", "focused", "legendary", "love"] as const;

async function canViewPost(post: typeof socialPostsTable.$inferSelect, viewerId: string | null): Promise<boolean> {
  if (viewerId === post.userId) return true;
  if (post.moderationStatus !== "approved") return false;
  if (post.isPublic && !post.groupId) return true;
  if (!viewerId || !post.groupId) return false;
  const [membership] = await db.select({ id: groupMembersTable.id }).from(groupMembersTable)
    .where(and(eq(groupMembersTable.groupId, post.groupId), eq(groupMembersTable.userId, viewerId)))
    .limit(1);
  return Boolean(membership);
}

async function loadVisiblePost(postId: string, viewerId: string | null) {
  const [post] = await db.select().from(socialPostsTable)
    .where(eq(socialPostsTable.id, postId)).limit(1);
  return post && await canViewPost(post, viewerId) ? post : null;
}

async function enrichPost(post: any, viewerId: string | null) {
  const [author] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role })
    .from(usersTable).where(eq(usersTable.id, post.userId)).limit(1);
  const [wallet] = await db.select({ level: userWalletsTable.level })
    .from(userWalletsTable).where(eq(userWalletsTable.userId, post.userId)).limit(1);

  const reactions = await db.select().from(postReactionsTable)
    .where(eq(postReactionsTable.postId, post.id));

  const reactionCounts: Record<string, number> = {};
  REACTION_TYPES.forEach(r => { reactionCounts[r] = 0; });
  reactions.forEach(r => { reactionCounts[r.reaction] = (reactionCounts[r.reaction] || 0) + 1; });

  const myReaction = viewerId ? reactions.find(r => r.userId === viewerId)?.reaction ?? null : null;

  const comments = await db.select({ count: sql<number>`count(*)` })
    .from(postCommentsTable).where(eq(postCommentsTable.postId, post.id));
  const commentCount = Number(comments[0]?.count ?? 0);

  const isSaved = viewerId
    ? (await db.select().from(postSavesTable).where(and(eq(postSavesTable.postId, post.id), eq(postSavesTable.userId, viewerId))).limit(1)).length > 0
    : false;

  const authorRole = (author?.role ?? "user").toLowerCase();
  return {
    ...post,
    author: {
      id: author?.id,
      name: author?.name || author?.email?.split("@")[0] || "User",
      level: wallet?.level ?? 1,
      role: authorRole,
      isAdmin: authorRole === "admin",
      isBot: authorRole === "bot",
    },
    reactionCounts,
    totalReactions: reactions.length,
    myReaction,
    commentCount,
    isSaved,
  };
}

// ─── FEED ─────────────────────────────────────────────────────────────────────

postsRouter.get("/feed", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
  const userId = req.userId!;
  const { type = "following", limit = "20", offset = "0", groupId, cursor } = req.query as Record<string, string>;
  const pageLimit = parseLimit(limit, { fallback: 20, min: 5, max: 50 });
  const pageOffset = parseOffset(offset);

  // Public surfaces keep the AI rivals' daily activity ticking (throttled)
  // and materialise staggered bot replies that have come due.
  if (type === "discover" || type === "public") {
    await ensureDailyBotActivity();
    await materializeDueBotReplies();
  }

  let posts: any[] = [];
  let nextCursor: string | null = null;

  if (type === "following") {
    const following = await db.select({ followingId: followsTable.followingId })
      .from(followsTable).where(eq(followsTable.followerId, userId));
    const followIds = [userId, ...following.map(f => f.followingId)];

    posts = await db.select().from(socialPostsTable)
      .where(and(
        inArray(socialPostsTable.userId, followIds),
        eq(socialPostsTable.isPublic, true),
        eq(socialPostsTable.moderationStatus, "approved"),
      ))
      .orderBy(desc(socialPostsTable.createdAt))
      .limit(pageLimit).offset(pageOffset);
  } else if (type === "discover") {
    // A3: cursor pagination + ~60/40 human/bot recency mix so the feed never
    // floods at 12k-bot scale. Bots are interleaved by recency but capped so
    // humans always hold the majority of every page.
    const cursorDate = cursor ? new Date(cursor) : null;
    const baseWhere = and(
      eq(socialPostsTable.isPublic, true),
      eq(socialPostsTable.moderationStatus, "approved"),
      cursorDate ? lt(socialPostsTable.createdAt, cursorDate) : undefined,
    );
    const overfetch = pageLimit * 3;
    const [humanRows, botRows] = await Promise.all([
      db.select().from(socialPostsTable)
        .innerJoin(usersTable, eq(usersTable.id, socialPostsTable.userId))
        .where(and(baseWhere, ne(usersTable.role, "bot"), ne(usersTable.role, "admin")))
        .orderBy(desc(socialPostsTable.createdAt))
        .limit(overfetch),
      db.select().from(socialPostsTable)
        .innerJoin(usersTable, eq(usersTable.id, socialPostsTable.userId))
        .where(and(baseWhere, eq(usersTable.role, "bot")))
        .orderBy(desc(socialPostsTable.createdAt))
        .limit(overfetch),
    ]);

    const merged = [
      ...humanRows.map((p: any) => ({ post: p, isBot: false })),
      ...botRows.map((p: any) => ({ post: p, isBot: true })),
    ].sort((a, b) => (b.post.createdAt as Date).getTime() - (a.post.createdAt as Date).getTime());

    const botBudget = Math.ceil(pageLimit * 0.4);
    let botCount = 0;
    for (const item of merged) {
      if (posts.length >= pageLimit) break;
      if (item.isBot && botCount >= botBudget) continue;
      posts.push(item.post);
      if (item.isBot) botCount++;
    }
    // Thin tail: if the mix left the page short (few humans), top up.
    if (posts.length < pageLimit) {
      const seen = new Set(posts.map((p: any) => p.id));
      for (const item of merged) {
        if (posts.length >= pageLimit) break;
        if (seen.has(item.post.id)) continue;
        posts.push(item.post);
        seen.add(item.post.id);
      }
    }
    nextCursor = posts.length ? (posts[posts.length - 1] as any).createdAt : null;
  } else if (type === "group" && groupId) {
    posts = await db.select().from(socialPostsTable)
      .where(and(
        eq(socialPostsTable.groupId, groupId),
        eq(socialPostsTable.moderationStatus, "approved"),
      ))
      .orderBy(desc(socialPostsTable.createdAt))
      .limit(pageLimit).offset(pageOffset);
  } else if (type === "saved") {
    const saved = await db.select({ postId: postSavesTable.postId })
      .from(postSavesTable).where(eq(postSavesTable.userId, userId));
    if (!saved.length) return res.json([]);
    posts = await db.select().from(socialPostsTable)
      .where(and(
        inArray(socialPostsTable.id, saved.map(s => s.postId)),
        eq(socialPostsTable.moderationStatus, "approved"),
      ))
      .orderBy(desc(socialPostsTable.createdAt))
      .limit(pageLimit).offset(pageOffset);
  } else {
    posts = await db.select().from(socialPostsTable)
      .where(and(
        eq(socialPostsTable.isPublic, true),
        eq(socialPostsTable.moderationStatus, "approved"),
      ))
      .orderBy(desc(socialPostsTable.createdAt))
      .limit(pageLimit).offset(pageOffset);
  }

  const enriched = await Promise.all(posts.map(p => enrichPost(p, userId)));
  // The discover feed is cursor-paginated, so it returns an envelope the client
  // can page with; the other feeds keep their legacy plain-array shape.
  if (type === "discover") {
    res.json({ posts: enriched, nextCursor: enriched.length >= pageLimit ? nextCursor : null });
    return;
  }
  res.json(enriched);
  } catch (err) {
    logger.error({ err }, "GET /feed error:");
    res.status(500).json({ error: "Failed to load feed" });
  }
});

// ─── POSTS CRUD ────────────────────────────────────────────────────────────────

postsRouter.post("/posts", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { content, type, imageUrls, metadata, groupId, isPublic } = req.body;
    if (!content?.trim() || typeof content !== "string") return res.status(400).json({ error: "content required" });
    if (content.length > 2000) return res.status(400).json({ error: "Post too long (max 2000 chars)" });
    if (Array.isArray(imageUrls) && imageUrls.length > 10) return res.status(400).json({ error: "Too many images (max 10)" });
    // Validate imageUrls are actually URLs (prevent XSS via javascript: URIs)
    const safeImageUrls = Array.isArray(imageUrls)
      ? imageUrls.filter((u: unknown) => typeof u === "string" && /^https?:\/\//i.test(u)).slice(0, 10)
      : [];

    // Automated moderation — reject clear violations, flag borderline ones.
    let moderation = await moderateText(content);

    // Repeat-offender automation: if this author has been rejected repeatedly
    // before, escalate borderline ("flagged") content to an automatic reject.
    if (moderation.status === "flagged") {
      try {
        const [rejectedCount] = await db.select({ c: sql<number>`count(*)` })
          .from(socialPostsTable)
          .where(and(eq(socialPostsTable.userId, userId), eq(socialPostsTable.moderationStatus, "rejected")));
        if (Number(rejectedCount?.c ?? 0) >= REPEAT_OFFENDER_THRESHOLD) {
          moderation = { ...moderation, status: "rejected", reason: "Repeat offender (escalated)" };
        }
      } catch { /* ignore — fall through with the keyword/AI verdict */ }
    }

    if (moderation.status === "rejected") {
      return res.status(400).json({
        error: `This post was blocked by our community filter (${moderation.reason}). Please keep it positive.`,
        moderation: { status: moderation.status, reason: moderation.reason },
      });
    }

    const [post] = await db.insert(socialPostsTable).values({
      userId, content: content.trim(),
      type: (typeof type === "string" && ["general", "achievement", "session", "milestone", "question"].includes(type)) ? type : "general",
      imageUrls: safeImageUrls,
      metadata: metadata || null,
      groupId: (typeof groupId === "string" && /^[0-9a-f-]{36}$/i.test(groupId)) ? groupId : null,
      isPublic: isPublic !== false,
      moderationStatus: moderation.status,
      moderationReason: moderation.status === "flagged" ? moderation.reason : null,
    }).returning();

    try {
      await db.update(userWalletsTable)
        .set({ totalXp: sql`total_xp + 10`, weeklyXp: sql`weekly_xp + 10` })
        .where(eq(userWalletsTable.userId, userId));
    } catch {}

    const enriched = await enrichPost(post, userId);
    // AI rivals drop topic-matched replies under fresh human posts with a
    // natural 1–8h lag (only for posts that passed moderation).
    if (moderation.status === "approved" || moderation.status === "flagged") {
      await queueBotReplies(post.id, userId, content.trim(), false);
    }
    res.status(201).json({
      ...enriched,
      moderation: { status: moderation.status, reason: moderation.reason },
    });
  } catch (err) {
    logger.error({ err }, "POST /posts error:");
    res.status(500).json({ error: "Failed to create post" });
  }
});

postsRouter.get("/posts/:id", optionalAuth, async (req: AuthRequest, res: Response) => {
  const post = await loadVisiblePost(req.params.id as string, req.userId ?? null);
  if (!post) return res.status(404).json({ error: "Post not found" });

  await db.update(socialPostsTable)
    .set({ viewCount: sql`view_count + 1` })
    .where(eq(socialPostsTable.id, req.params.id as string));

  const enriched = await enrichPost(post, req.userId ?? null);
  res.json(enriched);
});

postsRouter.delete("/posts/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const [post] = await db.select().from(socialPostsTable)
    .where(and(eq(socialPostsTable.id, req.params.id as string), eq(socialPostsTable.userId, userId))).limit(1);
  if (!post) return res.status(404).json({ error: "Post not found or not authorized" });
  await db.delete(socialPostsTable).where(eq(socialPostsTable.id, req.params.id as string));
  res.json({ ok: true });
});

postsRouter.get("/users/:userId/posts", optionalAuth, async (req: AuthRequest, res: Response) => {
  const { limit = "20", offset = "0" } = req.query as Record<string, string>;
  const pageLimit = parseLimit(limit, { fallback: 20, min: 1, max: 50 });
  const pageOffset = parseOffset(offset);
  const posts = await db.select().from(socialPostsTable)
    .where(and(
      eq(socialPostsTable.userId, req.params.userId as string),
      eq(socialPostsTable.isPublic, true),
      eq(socialPostsTable.moderationStatus, "approved"),
    ))
    .orderBy(desc(socialPostsTable.createdAt))
    .limit(pageLimit).offset(pageOffset);

  const enriched = await Promise.all(posts.map(p => enrichPost(p, req.userId ?? null)));
  res.json(enriched);
});

// ─── REACTIONS ────────────────────────────────────────────────────────────────

postsRouter.post("/posts/:id/react", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const visiblePost = await loadVisiblePost(req.params.id as string, userId);
  if (!visiblePost) return res.status(404).json({ error: "Post not found" });
  const { reaction } = req.body;
  if (!REACTION_TYPES.includes(reaction)) return res.status(400).json({ error: "Invalid reaction" });

  const [existing] = await db.select().from(postReactionsTable)
    .where(and(eq(postReactionsTable.postId, req.params.id as string), eq(postReactionsTable.userId, userId))).limit(1);

  if (existing) {
    if (existing.reaction === reaction) {
      await db.delete(postReactionsTable).where(eq(postReactionsTable.id, existing.id));
      return res.json({ ok: true, action: "removed" });
    }
    await db.update(postReactionsTable).set({ reaction }).where(eq(postReactionsTable.id, existing.id));
    return res.json({ ok: true, action: "changed", reaction });
  }

  await db.insert(postReactionsTable).values({ postId: req.params.id as string, userId, reaction });

  try {
    const [post] = await db.select({ userId: socialPostsTable.userId }).from(socialPostsTable)
      .where(eq(socialPostsTable.id, req.params.id as string)).limit(1);
    if (post && post.userId !== userId) {
      const emojiMap: Record<string, string> = { fire: "🔥", insightful: "💡", focused: "🎯", legendary: "🏆", love: "❤️" };
      await db.insert(notificationsTable).values({
        userId: post.userId, type: "post_reaction",
        title: "Someone reacted to your post",
        message: `${emojiMap[reaction] || reaction} reaction on your post`,
        data: { postId: req.params.id as string, reaction },
      });
    }
  } catch {}

  res.json({ ok: true, action: "added", reaction });
});

// ─── COMMENTS ────────────────────────────────────────────────────────────────

postsRouter.get("/posts/:id/comments", optionalAuth, async (req: AuthRequest, res: Response) => {
  const visiblePost = await loadVisiblePost(req.params.id as string, req.userId ?? null);
  if (!visiblePost) return res.status(404).json({ error: "Post not found" });
  const comments = await db.select().from(postCommentsTable)
    .where(eq(postCommentsTable.postId, req.params.id as string))
    .orderBy(postCommentsTable.createdAt);

  const enriched = await Promise.all(comments.map(async c => {
    const [author] = await db.select({ name: usersTable.name, email: usersTable.email, role: usersTable.role, id: usersTable.id })
      .from(usersTable).where(eq(usersTable.id, c.userId)).limit(1);
    const role = (author?.role ?? "user").toLowerCase();
    return {
      ...c,
      authorName: author?.name || author?.email?.split("@")[0] || "User",
      author: {
        id: author?.id,
        name: author?.name || author?.email?.split("@")[0] || "User",
        role,
        isAdmin: role === "admin",
        isBot: role === "bot",
      },
    };
  }));

  res.json(enriched);
});

postsRouter.post("/posts/:id/comments", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const visiblePost = await loadVisiblePost(req.params.id as string, userId);
  if (!visiblePost) return res.status(404).json({ error: "Post not found" });
  const { content, parentId } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: "content required" });
  if (typeof content !== "string" || content.length > 1000) return res.status(400).json({ error: "Comment too long (max 1000 chars)" });

  // Automated moderation on comments too.
  if (parentId) {
    const [parent] = await db.select({ id: postCommentsTable.id }).from(postCommentsTable)
      .where(and(eq(postCommentsTable.id, parentId), eq(postCommentsTable.postId, req.params.id as string)))
      .limit(1);
    if (!parent) return res.status(400).json({ error: "Invalid parent comment" });
  }

  const moderation = await moderateText(content);
  if (moderation.status === "rejected") {
    return res.status(400).json({
      error: `This comment was blocked by our community filter (${moderation.reason}).`,
      moderation: { status: moderation.status, reason: moderation.reason },
    });
  }

  const [comment] = await db.insert(postCommentsTable).values({
    postId: req.params.id as string, userId, content: content.trim(),
    parentId: parentId || null,
  }).returning();

  try {
    const [post] = await db.select({ userId: socialPostsTable.userId }).from(socialPostsTable)
      .where(eq(socialPostsTable.id, req.params.id as string)).limit(1);
    if (post && post.userId !== userId) {
      await db.insert(notificationsTable).values({
        userId: post.userId, type: "post_comment",
        title: "New comment on your post",
        message: content.trim().slice(0, 100),
        data: { postId: req.params.id as string, commentId: comment.id },
      });
    }
  } catch {}

  const [author] = await db.select({ name: usersTable.name, email: usersTable.email, role: usersTable.role, id: usersTable.id })
    .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const role = (author?.role ?? "user").toLowerCase();

  // Bots continue conversations under fresh human comments (threaded).
  if (role !== "bot" && (moderation.status === "approved" || moderation.status === "flagged")) {
    await queueBotCommentReply(comment.id, req.params.id as string, userId);
  }

  res.status(201).json({
    ...comment,
    authorName: author?.name || author?.email?.split("@")[0] || "User",
    author: {
      id: author?.id,
      name: author?.name || author?.email?.split("@")[0] || "User",
      role,
      isAdmin: role === "admin",
      isBot: role === "bot",
    },
  });
});

postsRouter.delete("/posts/:postId/comments/:commentId", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  await db.delete(postCommentsTable)
    .where(and(eq(postCommentsTable.id, req.params.commentId as string), eq(postCommentsTable.userId, userId)));
  res.json({ ok: true });
});

// ─── SAVES ───────────────────────────────────────────────────────────────────

postsRouter.post("/posts/:id/save", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const visiblePost = await loadVisiblePost(req.params.id as string, userId);
  if (!visiblePost) return res.status(404).json({ error: "Post not found" });
  const [existing] = await db.select().from(postSavesTable)
    .where(and(eq(postSavesTable.postId, req.params.id as string), eq(postSavesTable.userId, userId))).limit(1);

  if (existing) {
    await db.delete(postSavesTable).where(eq(postSavesTable.id, existing.id));
    return res.json({ ok: true, saved: false });
  }
  await db.insert(postSavesTable).values({ postId: req.params.id as string, userId });
  res.json({ ok: true, saved: true });
});
