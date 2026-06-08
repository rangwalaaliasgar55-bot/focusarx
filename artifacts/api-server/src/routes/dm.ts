import { Router } from "express";
import { db } from "@workspace/db";
import {
  conversations, conversationParticipants, messages, messageReactions,
  usersTable, notificationsTable,
} from "@workspace/db";
import { extractUserId } from "./auth";
import { eq, and, desc, sql, or } from "drizzle-orm";
import { emitToUser } from "../lib/socketManager";

function auth(req: any, res: any, next: any) {
  const userId = extractUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  req.userId = userId;
  next();
}

export const dmRouter = Router();

async function getOrCreateDm(userA: string, userB: string) {
  const existing = await db
    .select({ convId: conversationParticipants.conversationId })
    .from(conversationParticipants)
    .where(eq(conversationParticipants.userId, userA));

  for (const row of existing) {
    const participants = await db.select()
      .from(conversationParticipants)
      .where(eq(conversationParticipants.conversationId, row.convId));
    if (participants.length === 2 && participants.some(p => p.userId === userB)) {
      const [conv] = await db.select().from(conversations)
        .where(and(eq(conversations.id, row.convId), eq(conversations.type, "direct"))).limit(1);
      if (conv) return conv;
    }
  }

  const id = crypto.randomUUID();
  const [conv] = await db.insert(conversations).values({ id, type: "direct" }).returning();
  await db.insert(conversationParticipants).values([
    { id: crypto.randomUUID(), conversationId: id, userId: userA },
    { id: crypto.randomUUID(), conversationId: id, userId: userB },
  ]);
  return conv;
}

dmRouter.get("/dm/conversations", auth, async (req, res) => {
  const userId = req.userId!;

  const myParticipations = await db.select()
    .from(conversationParticipants)
    .where(eq(conversationParticipants.userId, userId));

  const convIds = myParticipations.map(p => p.conversationId);
  if (!convIds.length) return res.json([]);

  const result = await Promise.all(convIds.map(async convId => {
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, convId)).limit(1);
    if (!conv) return null;

    const allParticipants = await db.select().from(conversationParticipants)
      .where(eq(conversationParticipants.conversationId, convId));

    const others = allParticipants.filter(p => p.userId !== userId);

    let otherParticipant = null;
    if (conv.type === "direct" && others[0]) {
      const [u] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
        .from(usersTable).where(eq(usersTable.id, others[0].userId)).limit(1);
      otherParticipant = { id: u?.id, name: u?.name || u?.email?.split("@")[0] || "User" };
    }

    const [lastMsg] = await db.select().from(messages)
      .where(eq(messages.conversationId, convId))
      .orderBy(desc(messages.createdAt)).limit(1);

    const myParticipation = myParticipations.find(p => p.conversationId === convId);
    const unreadCount = myParticipation?.lastReadAt
      ? await db.select({ count: sql<number>`count(*)` }).from(messages)
          .where(and(eq(messages.conversationId, convId), sql`created_at > ${myParticipation.lastReadAt}`))
          .then(r => Number(r[0]?.count ?? 0))
      : 0;

    return {
      id: convId,
      type: conv.type,
      name: conv.name,
      participantCount: allParticipants.length,
      otherParticipant,
      lastMessage: lastMsg ? { content: lastMsg.content, createdAt: lastMsg.createdAt } : null,
      lastMessageAt: conv.lastMessageAt,
      unreadCount,
    };
  }));

  res.json(result.filter(Boolean).sort((a: any, b: any) =>
    new Date(b?.lastMessageAt || 0).getTime() - new Date(a?.lastMessageAt || 0).getTime()
  ));
});

dmRouter.post("/dm/start", auth, async (req, res) => {
  const userId = req.userId!;
  const { userId: targetId } = req.body;
  if (!targetId) return res.status(400).json({ error: "userId required" });
  if (targetId === userId) return res.status(400).json({ error: "Cannot DM yourself" });

  const [target] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
    .from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
  if (!target) return res.status(404).json({ error: "User not found" });

  const conv = await getOrCreateDm(userId, targetId);
  const otherParticipant = { id: target.id, name: target.name || target.email?.split("@")[0] || "User" };

  res.json({ id: conv.id, type: "direct", otherParticipant, lastMessage: null, unreadCount: 0 });
});

dmRouter.get("/dm/:convId/messages", auth, async (req, res) => {
  const userId = req.userId!;
  const { limit = "50", offset = "0" } = req.query as Record<string, string>;

  const [participant] = await db.select().from(conversationParticipants)
    .where(and(eq(conversationParticipants.conversationId, req.params.convId), eq(conversationParticipants.userId, userId))).limit(1);
  if (!participant) return res.status(403).json({ error: "Not in this conversation" });

  const msgs = await db.select().from(messages)
    .where(eq(messages.conversationId, req.params.convId))
    .orderBy(messages.createdAt)
    .limit(parseInt(limit)).offset(parseInt(offset));

  const enriched = await Promise.all(msgs.map(async m => {
    const [sender] = await db.select({ name: usersTable.name, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, m.senderId)).limit(1);

    const reacts = await db.select().from(messageReactions)
      .where(eq(messageReactions.messageId, m.id));
    const reactions: Record<string, number> = {};
    reacts.forEach(r => { reactions[r.emoji] = (reactions[r.emoji] || 0) + 1; });

    return {
      ...m,
      senderName: sender?.name || sender?.email?.split("@")[0] || "User",
      reactions,
    };
  }));

  await db.update(conversationParticipants)
    .set({ lastReadAt: new Date() })
    .where(and(eq(conversationParticipants.conversationId, req.params.convId), eq(conversationParticipants.userId, userId)));

  res.json(enriched);
});

dmRouter.post("/dm/:convId/messages", auth, async (req, res) => {
  const userId = req.userId!;
  const { content, replyToId } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: "content required" });
  if (content.length > 4000) return res.status(400).json({ error: "Message too long" });

  const [participant] = await db.select().from(conversationParticipants)
    .where(and(eq(conversationParticipants.conversationId, req.params.convId), eq(conversationParticipants.userId, userId))).limit(1);
  if (!participant) return res.status(403).json({ error: "Not in this conversation" });

  const [msg] = await db.insert(messages).values({
    id: crypto.randomUUID(),
    conversationId: req.params.convId,
    senderId: userId,
    content: content.trim(),
    replyToId: replyToId || null,
  }).returning();

  await db.update(conversations).set({ lastMessageAt: new Date() })
    .where(eq(conversations.id, req.params.convId));

  const [senderUser] = await db.select({ name: usersTable.name, email: usersTable.email })
    .from(usersTable).where(eq(usersTable.id, userId)).limit(1);

  const fullMsg = { ...msg, senderName: senderUser?.name || senderUser?.email?.split("@")[0] || "User", reactions: {} };

  try {
    const others = await db.select().from(conversationParticipants)
      .where(and(eq(conversationParticipants.conversationId, req.params.convId), sql`user_id != ${userId}`));
    for (const other of others) {
      emitToUser(other.userId, "dm:new_message", { conversationId: req.params.convId, message: fullMsg });
      await db.insert(notificationsTable).values({
        userId: other.userId, type: "dm",
        title: `Message from ${senderUser?.name || "Someone"}`,
        message: content.trim().slice(0, 100),
        data: { conversationId: req.params.convId, messageId: msg.id },
      });
    }
  } catch {}

  res.status(201).json(fullMsg);
});

dmRouter.post("/dm/messages/:msgId/react", auth, async (req, res) => {
  const userId = req.userId!;
  const { emoji } = req.body;
  if (!emoji) return res.status(400).json({ error: "emoji required" });

  const [existing] = await db.select().from(messageReactions)
    .where(and(eq(messageReactions.messageId, req.params.msgId), eq(messageReactions.userId, userId))).limit(1);

  if (existing) {
    if (existing.emoji === emoji) {
      await db.delete(messageReactions).where(eq(messageReactions.id, existing.id));
      return res.json({ ok: true, action: "removed" });
    }
    await db.update(messageReactions).set({ emoji }).where(eq(messageReactions.id, existing.id));
    return res.json({ ok: true, action: "changed" });
  }

  await db.insert(messageReactions).values({ id: crypto.randomUUID(), messageId: req.params.msgId, userId, emoji });
  res.json({ ok: true, action: "added" });
});

dmRouter.delete("/dm/messages/:msgId", auth, async (req, res) => {
  const userId = req.userId!;
  await db.update(messages)
    .set({ isDeleted: true, content: "" })
    .where(and(eq(messages.id, req.params.msgId), eq(messages.senderId, userId)));
  res.json({ ok: true });
});

dmRouter.post("/dm/group", auth, async (req, res) => {
  const userId = req.userId!;
  const { name, participantIds } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "name required" });
  if (!participantIds?.length) return res.status(400).json({ error: "participantIds required" });

  const allIds = [...new Set([userId, ...participantIds])].slice(0, 21);
  const id = crypto.randomUUID();
  const [conv] = await db.insert(conversations).values({ id, type: "group", name: name.trim() }).returning();
  await db.insert(conversationParticipants).values(
    allIds.map(uid => ({ id: crypto.randomUUID(), conversationId: id, userId: uid, isAdmin: uid === userId }))
  );
  res.status(201).json(conv);
});
