import { Request, Response, NextFunction } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router } from "express";
import { db } from "@workspace/db";
import {
  socialPostsTable, postReactionsTable, postCommentsTable, postSavesTable,
  usersTable, userWalletsTable, followsTable, notificationsTable, studyGroupsTable,
  groupMembersTable,
} from "@workspace/db";
import { extractUserId } from "./auth";
import { eq, and, desc, sql, inArray, or } from "drizzle-orm";

function optionalAuth(req: any, res: any, next: any) {
  const userId = extractUserId(req);
  req.userId = userId;
  next();
}

export const postsRouter = Router();

const REACTION_TYPES = ["fire", "insightful", "focused", "legendary", "love"] as const;

async function enrichPost(post: any, viewerId: string | null) {
  const [author] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
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

  return {
    ...post,
    author: {
      id: author?.id,
      name: author?.name || author?.email?.split("@")[0] || "User",
      level: wallet?.level ?? 1,
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
  const { type = "following", limit = "20", offset = "0", groupId } = req.query as Record<string, string>;

  let posts: any[] = [];

  if (type === "following") {
    const following = await db.select({ followingId: followsTable.followingId })
      .from(followsTable).where(eq(followsTable.followerId, userId));
    const followIds = [userId, ...following.map(f => f.followingId)];

    posts = await db.select().from(socialPostsTable)
      .where(and(
        inArray(socialPostsTable.userId, followIds),
        eq(socialPostsTable.isPublic, true),
      ))
      .orderBy(desc(socialPostsTable.createdAt))
      .limit(parseInt(limit)).offset(parseInt(offset));
  } else if (type === "discover") {
    posts = await db.select().from(socialPostsTable)
      .where(eq(socialPostsTable.isPublic, true))
      .orderBy(desc(socialPostsTable.createdAt))
      .limit(parseInt(limit)).offset(parseInt(offset));
  } else if (type === "group" && groupId) {
    posts = await db.select().from(socialPostsTable)
      .where(eq(socialPostsTable.groupId, groupId))
      .orderBy(desc(socialPostsTable.createdAt))
      .limit(parseInt(limit)).offset(parseInt(offset));
  } else if (type === "saved") {
    const saved = await db.select({ postId: postSavesTable.postId })
      .from(postSavesTable).where(eq(postSavesTable.userId, userId));
    if (!saved.length) return res.json([]);
    posts = await db.select().from(socialPostsTable)
      .where(inArray(socialPostsTable.id, saved.map(s => s.postId)))
      .orderBy(desc(socialPostsTable.createdAt))
      .limit(parseInt(limit)).offset(parseInt(offset));
  } else {
    posts = await db.select().from(socialPostsTable)
      .where(eq(socialPostsTable.isPublic, true))
      .orderBy(desc(socialPostsTable.createdAt))
      .limit(parseInt(limit)).offset(parseInt(offset));
  }

  const enriched = await Promise.all(posts.map(p => enrichPost(p, userId)));
  res.json(enriched);
  } catch (err) {
    console.error("GET /feed error:", err);
    res.status(500).json({ error: "Failed to load feed" });
  }
});

// ─── POSTS CRUD ────────────────────────────────────────────────────────────────

postsRouter.post("/posts", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { content, type, imageUrls, metadata, groupId, isPublic } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "content required" });
    if (content.length > 2000) return res.status(400).json({ error: "Post too long (max 2000 chars)" });

    const [post] = await db.insert(socialPostsTable).values({
      userId, content: content.trim(),
      type: type || "general",
      imageUrls: imageUrls || [],
      metadata: metadata || null,
      groupId: groupId || null,
      isPublic: isPublic !== false,
    }).returning();

    try {
      await db.update(userWalletsTable)
        .set({ totalXp: sql`total_xp + 10`, weeklyXp: sql`weekly_xp + 10` })
        .where(eq(userWalletsTable.userId, userId));
    } catch {}

    const enriched = await enrichPost(post, userId);
    res.status(201).json(enriched);
  } catch (err) {
    console.error("POST /posts error:", err);
    res.status(500).json({ error: "Failed to create post" });
  }
});

postsRouter.get("/posts/:id", optionalAuth, async (req: AuthRequest, res: Response) => {
  const [post] = await db.select().from(socialPostsTable)
    .where(eq(socialPostsTable.id, req.params.id as string)).limit(1);
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
  const posts = await db.select().from(socialPostsTable)
    .where(and(eq(socialPostsTable.userId, req.params.userId as string), eq(socialPostsTable.isPublic, true)))
    .orderBy(desc(socialPostsTable.createdAt))
    .limit(parseInt(limit)).offset(parseInt(offset));

  const enriched = await Promise.all(posts.map(p => enrichPost(p, req.userId ?? null)));
  res.json(enriched);
});

// ─── REACTIONS ────────────────────────────────────────────────────────────────

postsRouter.post("/posts/:id/react", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
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
  const comments = await db.select().from(postCommentsTable)
    .where(eq(postCommentsTable.postId, req.params.id as string))
    .orderBy(postCommentsTable.createdAt);

  const enriched = await Promise.all(comments.map(async c => {
    const [author] = await db.select({ name: usersTable.name, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, c.userId)).limit(1);
    return { ...c, authorName: author?.name || author?.email?.split("@")[0] || "User" };
  }));

  res.json(enriched);
});

postsRouter.post("/posts/:id/comments", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { content, parentId } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: "content required" });

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

  const [author] = await db.select({ name: usersTable.name, email: usersTable.email })
    .from(usersTable).where(eq(usersTable.id, userId)).limit(1);

  res.status(201).json({ ...comment, authorName: author?.name || author?.email?.split("@")[0] || "User" });
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
  const [existing] = await db.select().from(postSavesTable)
    .where(and(eq(postSavesTable.postId, req.params.id as string), eq(postSavesTable.userId, userId))).limit(1);

  if (existing) {
    await db.delete(postSavesTable).where(eq(postSavesTable.id, existing.id));
    return res.json({ ok: true, saved: false });
  }
  await db.insert(postSavesTable).values({ postId: req.params.id as string, userId });
  res.json({ ok: true, saved: true });
});
