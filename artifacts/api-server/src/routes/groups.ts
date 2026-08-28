import { Request, Response, NextFunction } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router } from "express";
import { db } from "@workspace/db";
import {
  studyGroupsTable, groupMembersTable, usersTable,
  userWalletsTable, focusSessionsTable, notificationsTable,
} from "@workspace/db";
import { extractUserId } from "./auth";
import { eq, and, desc, sql, or } from "drizzle-orm";

export const groupsRouter = Router();

function genInviteCode() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

async function getGroupWithDetails(groupId: string) {
  const [group] = await db.select().from(studyGroupsTable).where(eq(studyGroupsTable.id, groupId)).limit(1);
  if (!group) return null;
  const members = await db.select().from(groupMembersTable).where(eq(groupMembersTable.groupId, groupId));
  const memberDetails = await Promise.all(members.map(async m => {
    const [user] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, m.userId)).limit(1);
    const [wallet] = await db.select({ totalXp: userWalletsTable.totalXp, level: userWalletsTable.level })
      .from(userWalletsTable).where(eq(userWalletsTable.userId, m.userId)).limit(1);
    return {
      ...m,
      name: user?.name || user?.email?.split("@")[0] || "User",
      xp: wallet?.totalXp ?? 0,
      level: wallet?.level ?? 1,
    };
  }));
  return { ...group, members: memberDetails, memberCount: members.length };
}

groupsRouter.get("/groups", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { search } = req.query as { search?: string };
  let groups = await db.select().from(studyGroupsTable)
    .where(eq(studyGroupsTable.isPublic, true))
    .orderBy(desc(studyGroupsTable.groupXp))
    .limit(20);
  if (search) groups = groups.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));
  const withCounts = await Promise.all(groups.map(async g => {
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(groupMembersTable)
      .where(eq(groupMembersTable.groupId, g.id));
    return { ...g, memberCount: Number(count) };
  }));
  res.json(withCounts);
});

groupsRouter.get("/groups/mine", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const memberships = await db.select({ groupId: groupMembersTable.groupId })
    .from(groupMembersTable).where(eq(groupMembersTable.userId, userId));
  const groups = await Promise.all(memberships.map(m => getGroupWithDetails(m.groupId)));
  res.json(groups.filter(Boolean));
});

groupsRouter.get("/groups/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  const groupId = req.params.id as string;
  const [groupRow] = await db.select({ isPublic: studyGroupsTable.isPublic })
    .from(studyGroupsTable).where(eq(studyGroupsTable.id, groupId)).limit(1);
  if (!groupRow) return res.status(404).json({ error: "Group not found" });
  if (!groupRow.isPublic) {
    const [membership] = await db.select({ id: groupMembersTable.id }).from(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, req.userId)))
      .limit(1);
    if (!membership) return res.status(404).json({ error: "Group not found" });
  }
  const group = await getGroupWithDetails(groupId);
  res.json(group);
});

groupsRouter.post("/groups", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { name, description, isPublic, avatarEmoji, maxMembers, tags } = req.body;
  if (!name?.trim() || typeof name !== "string") return res.status(400).json({ error: "name required" });
  if (name.trim().length > 80) return res.status(400).json({ error: "name too long (max 80 chars)" });
  if (typeof description === "string" && description.length > 500) return res.status(400).json({ error: "description too long (max 500 chars)" });

  const safeMaxMembers = typeof maxMembers === "number" && Number.isInteger(maxMembers)
    ? Math.min(200, Math.max(2, maxMembers))
    : 20;
  const safeTags = Array.isArray(tags) ? tags.filter((t: unknown) => typeof t === "string").map((t: string) => t.slice(0, 30)).slice(0, 10) : [];

  const [group] = await db.insert(studyGroupsTable).values({
    name: name.trim().slice(0, 80),
    description: typeof description === "string" ? description.slice(0, 500) : null,
    ownerId: userId,
    isPublic: isPublic !== false,
    inviteCode: genInviteCode(),
    avatarEmoji: (typeof avatarEmoji === "string" ? avatarEmoji : "🎯").slice(0, 10),
    maxMembers: safeMaxMembers,
    tags: safeTags,
  }).returning();

  await db.insert(groupMembersTable).values({ groupId: group.id, userId, role: "owner" });
  res.status(201).json(group);
});

groupsRouter.patch("/groups/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const [member] = await db.select().from(groupMembersTable)
    .where(and(eq(groupMembersTable.groupId, req.params.id as string), eq(groupMembersTable.userId, userId))).limit(1);
  if (!member || !["owner", "admin"].includes(member.role)) return res.status(403).json({ error: "Not authorized" });

  // Only update fields that are explicitly provided — never set to undefined.
  const { name, description, isPublic, avatarEmoji, maxMembers, tags } = req.body;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof name === "string" && name.trim()) updates.name = name.trim().slice(0, 80);
  if (typeof description === "string") updates.description = description.slice(0, 500);
  if (typeof isPublic === "boolean") updates.isPublic = isPublic;
  if (typeof avatarEmoji === "string") updates.avatarEmoji = avatarEmoji.slice(0, 10);
  if (typeof maxMembers === "number" && Number.isInteger(maxMembers)) updates.maxMembers = Math.min(200, Math.max(2, maxMembers));
  if (Array.isArray(tags)) updates.tags = tags.filter((t: unknown) => typeof t === "string").map((t: string) => t.slice(0, 30)).slice(0, 10);

  const [updated] = await db.update(studyGroupsTable)
    .set(updates)
    .where(eq(studyGroupsTable.id, req.params.id as string)).returning();
  res.json(updated);
});

groupsRouter.delete("/groups/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const [group] = await db.select().from(studyGroupsTable).where(eq(studyGroupsTable.id, req.params.id as string)).limit(1);
  if (!group || group.ownerId !== userId) return res.status(403).json({ error: "Not authorized" });
  await db.delete(studyGroupsTable).where(eq(studyGroupsTable.id, req.params.id as string));
  res.json({ ok: true });
});

groupsRouter.post("/groups/:id/join", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const [group] = await db.select().from(studyGroupsTable).where(eq(studyGroupsTable.id, req.params.id as string)).limit(1);
  if (!group) return res.status(404).json({ error: "Group not found" });
  if (!group.isPublic) return res.status(403).json({ error: "An invite code is required to join this group" });

  const [existing] = await db.select().from(groupMembersTable)
    .where(and(eq(groupMembersTable.groupId, req.params.id as string), eq(groupMembersTable.userId, userId))).limit(1);
  if (existing) return res.status(409).json({ error: "Already a member" });

  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(groupMembersTable)
    .where(eq(groupMembersTable.groupId, req.params.id as string));
  if (Number(count) >= group.maxMembers) return res.status(400).json({ error: "Group is full" });

  await db.insert(groupMembersTable).values({ groupId: req.params.id as string, userId, role: "member" });
  await db.insert(notificationsTable).values({
    userId: group.ownerId, type: "group_join",
    title: `New member joined ${group.name}`,
    message: "Someone joined your study group",
    data: { groupId: group.id },
  });
  res.json({ ok: true });
});

groupsRouter.post("/groups/join-invite", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { inviteCode } = req.body;
  const [group] = await db.select().from(studyGroupsTable).where(eq(studyGroupsTable.inviteCode, inviteCode?.toUpperCase())).limit(1);
  if (!group) return res.status(404).json({ error: "Invalid invite code" });

  const [existing] = await db.select().from(groupMembersTable)
    .where(and(eq(groupMembersTable.groupId, group.id), eq(groupMembersTable.userId, userId))).limit(1);
  if (existing) return res.status(409).json({ error: "Already a member" });

  await db.insert(groupMembersTable).values({ groupId: group.id, userId, role: "member" });
  res.json({ ok: true, group });
});

groupsRouter.delete("/groups/:id/leave", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const [group] = await db.select().from(studyGroupsTable).where(eq(studyGroupsTable.id, req.params.id as string)).limit(1);
  if (group?.ownerId === userId) return res.status(400).json({ error: "Owner cannot leave. Transfer ownership or delete group." });
  await db.delete(groupMembersTable)
    .where(and(eq(groupMembersTable.groupId, req.params.id as string), eq(groupMembersTable.userId, userId)));
  res.json({ ok: true });
});

groupsRouter.patch("/groups/:id/members/:memberId/role", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const [group] = await db.select().from(studyGroupsTable).where(eq(studyGroupsTable.id, req.params.id as string)).limit(1);
  if (!group || group.ownerId !== userId) return res.status(403).json({ error: "Only owner can change roles" });
  const { role } = req.body;
  if (!["admin", "moderator", "member"].includes(role)) return res.status(400).json({ error: "Invalid role" });
  await db.update(groupMembersTable).set({ role })
    .where(and(eq(groupMembersTable.groupId, req.params.id as string), eq(groupMembersTable.userId, req.params.memberId as string)));
  res.json({ ok: true });
});

groupsRouter.get("/groups/:id/leaderboard", authMiddleware, async (req: AuthRequest, res: Response) => {
  const groupId = req.params.id as string;
  const [membership] = await db.select({ id: groupMembersTable.id }).from(groupMembersTable)
    .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, req.userId))).limit(1);
  if (!membership) return res.status(404).json({ error: "Group not found" });
  const members = await db.select().from(groupMembersTable).where(eq(groupMembersTable.groupId, groupId));
  const entries = await Promise.all(members.map(async m => {
    const [user] = await db.select({ name: usersTable.name, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, m.userId)).limit(1);
    const [wallet] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, m.userId)).limit(1);
    return {
      userId: m.userId,
      name: user?.name || user?.email?.split("@")[0] || "User",
      role: m.role,
      xpContribution: m.xpContribution,
      totalXp: wallet?.totalXp ?? 0,
      level: wallet?.level ?? 1,
    };
  }));
  res.json(entries.sort((a, b) => b.xpContribution - a.xpContribution).map((e, i) => ({ ...e, rank: i + 1 })));
});

groupsRouter.post("/groups/:id/contribute-xp", authMiddleware, (_req: AuthRequest, res: Response) => {
  res.status(410).json({ error: "Direct group XP contributions are no longer supported" });
});
