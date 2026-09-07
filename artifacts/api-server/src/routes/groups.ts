import { Response } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router } from "express";
import { db } from "@workspace/db";
import {
  studyGroupsTable, groupMembersTable, usersTable,
  userWalletsTable, notificationsTable,
} from "@workspace/db";
import { eq, and, desc, sql, inArray, ilike } from "drizzle-orm";
import { z } from "zod";
import { logger } from "../lib/logger";
import { sendValidationError, sendNotFound, sendForbidden, sendConflict } from "../lib/httpErrors";

/**
 * Study groups.
 *
 * Hardening pass:
 *  - every body is parsed with Zod (a non-object body used to throw on
 *    destructuring → 500; now it is a 400 with a readable message)
 *  - member/wallet lookups are batched (`inArray`) instead of one query per
 *    member per group — `/groups/mine` for a user in 5 groups of 20 was 200+
 *    round-trips on Neon
 *  - join / join-invite are race-safe: the capacity check and insert happen
 *    inside one transaction with the group row locked
 *  - errors use the shared envelope so the client shows the server's wording
 */
export const groupsRouter = Router();

const MAX_TAGS = 10;
const TAG_LEN = 30;

const groupBodySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80, "Name too long (max 80 chars)"),
  description: z.string().max(500, "Description too long (max 500 chars)").nullish(),
  isPublic: z.boolean().optional(),
  avatarEmoji: z.string().max(10).optional(),
  maxMembers: z.number().int().min(2).max(200).optional(),
  tags: z.array(z.string().max(TAG_LEN)).max(MAX_TAGS).optional(),
});

const groupPatchSchema = groupBodySchema.partial();

const inviteSchema = z.object({
  inviteCode: z.string().trim().min(4, "Invite code is required").max(32),
});

const roleSchema = z.object({
  role: z.enum(["admin", "moderator", "member"]),
});

function firstIssue(err: z.ZodError): string {
  return err.issues[0]?.message ?? "The request is invalid";
}

function genInviteCode() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

function displayName(u: { name: string | null; email: string | null } | undefined): string {
  return u?.name?.trim() || u?.email?.split("@")[0] || "User";
}

/** Batched user + wallet lookup for a set of member ids. */
async function loadMemberProfiles(userIds: string[]) {
  if (!userIds.length) return { users: new Map<string, { id: string; name: string | null; email: string | null }>(), wallets: new Map<string, { totalXp: number; level: number }>() };
  const [users, wallets] = await Promise.all([
    db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
      .from(usersTable).where(inArray(usersTable.id, userIds)),
    db.select({ userId: userWalletsTable.userId, totalXp: userWalletsTable.totalXp, level: userWalletsTable.level })
      .from(userWalletsTable).where(inArray(userWalletsTable.userId, userIds)),
  ]);
  return {
    users: new Map(users.map(u => [u.id, u])),
    wallets: new Map(wallets.map(w => [w.userId, { totalXp: w.totalXp ?? 0, level: w.level ?? 1 }])),
  };
}

async function getGroupsWithDetails(groupIds: string[]) {
  if (!groupIds.length) return [];
  const [groups, members] = await Promise.all([
    db.select().from(studyGroupsTable).where(inArray(studyGroupsTable.id, groupIds)),
    db.select().from(groupMembersTable).where(inArray(groupMembersTable.groupId, groupIds)),
  ]);
  const { users, wallets } = await loadMemberProfiles([...new Set(members.map(m => m.userId))]);
  const byGroup = new Map<string, typeof members>();
  for (const m of members) {
    const list = byGroup.get(m.groupId) ?? [];
    list.push(m);
    byGroup.set(m.groupId, list);
  }
  // Preserve the caller's order (e.g. most-recently-joined first).
  const order = new Map(groupIds.map((id, i) => [id, i]));
  return groups
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map(g => {
      const ms = byGroup.get(g.id) ?? [];
      return {
        ...g,
        members: ms.map(m => ({
          ...m,
          name: displayName(users.get(m.userId)),
          xp: wallets.get(m.userId)?.totalXp ?? 0,
          level: wallets.get(m.userId)?.level ?? 1,
        })),
        memberCount: ms.length,
      };
    });
}

async function getGroupWithDetails(groupId: string) {
  const [g] = await getGroupsWithDetails([groupId]);
  return g ?? null;
}

async function memberCounts(groupIds: string[]): Promise<Map<string, number>> {
  if (!groupIds.length) return new Map();
  const rows = await db.select({ groupId: groupMembersTable.groupId, count: sql<number>`count(*)::int` })
    .from(groupMembersTable)
    .where(inArray(groupMembersTable.groupId, groupIds))
    .groupBy(groupMembersTable.groupId);
  return new Map(rows.map(r => [r.groupId, Number(r.count)]));
}

groupsRouter.get("/groups", authMiddleware, async (req: AuthRequest, res: Response) => {
  const rawSearch = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 80) : "";
  const where = rawSearch
    ? and(eq(studyGroupsTable.isPublic, true), ilike(studyGroupsTable.name, `%${rawSearch.replace(/[%_\\]/g, "\\$&")}%`))
    : eq(studyGroupsTable.isPublic, true);
  const groups = await db.select().from(studyGroupsTable)
    .where(where)
    .orderBy(desc(studyGroupsTable.groupXp))
    .limit(30);
  const counts = await memberCounts(groups.map(g => g.id));
  res.json(groups.map(g => ({ ...g, memberCount: counts.get(g.id) ?? 0 })));
});

groupsRouter.get("/groups/mine", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const memberships = await db.select({ groupId: groupMembersTable.groupId })
    .from(groupMembersTable)
    .where(eq(groupMembersTable.userId, userId))
    .orderBy(desc(groupMembersTable.joinedAt));
  const groups = await getGroupsWithDetails(memberships.map(m => m.groupId));
  res.json(groups);
});

groupsRouter.get("/groups/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  const groupId = req.params.id as string;
  const [groupRow] = await db.select({ isPublic: studyGroupsTable.isPublic })
    .from(studyGroupsTable).where(eq(studyGroupsTable.id, groupId)).limit(1);
  if (!groupRow) return sendNotFound(res, "Group not found");
  if (!groupRow.isPublic) {
    const [membership] = await db.select({ id: groupMembersTable.id }).from(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, req.userId!)))
      .limit(1);
    if (!membership) return sendNotFound(res, "Group not found");
  }
  const group = await getGroupWithDetails(groupId);
  if (!group) return sendNotFound(res, "Group not found");
  res.json(group);
});

groupsRouter.post("/groups", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const parsed = groupBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) return sendValidationError(res, firstIssue(parsed.error));
  const body = parsed.data;

  const tags = (body.tags ?? []).map(t => t.trim()).filter(Boolean).slice(0, MAX_TAGS);

  // Invite codes are 8 hex chars — collisions are rare but possible; retry a few times.
  let group: typeof studyGroupsTable.$inferSelect | undefined;
  for (let attempt = 0; attempt < 3 && !group; attempt++) {
    try {
      [group] = await db.insert(studyGroupsTable).values({
        name: body.name.slice(0, 80),
        description: typeof body.description === "string" ? body.description.slice(0, 500) : null,
        ownerId: userId,
        isPublic: body.isPublic !== false,
        inviteCode: genInviteCode(),
        avatarEmoji: (body.avatarEmoji?.trim() || "🎯").slice(0, 10),
        maxMembers: body.maxMembers ?? 20,
        tags,
      }).returning();
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code !== "23505" || attempt === 2) throw err;
    }
  }
  if (!group) throw new Error("group insert failed");

  await db.insert(groupMembersTable).values({ groupId: group.id, userId, role: "owner" });
  res.status(201).json({ ...group, memberCount: 1 });
});

groupsRouter.patch("/groups/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const groupId = req.params.id as string;
  const [member] = await db.select({ role: groupMembersTable.role }).from(groupMembersTable)
    .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, userId))).limit(1);
  if (!member || !["owner", "admin"].includes(member.role)) return sendForbidden(res, "Only the owner or an admin can edit this group");

  const parsed = groupPatchSchema.safeParse(req.body ?? {});
  if (!parsed.success) return sendValidationError(res, firstIssue(parsed.error));
  const body = parsed.data;

  // Only update fields that are explicitly provided — never set to undefined.
  const updates: Partial<typeof studyGroupsTable.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim().slice(0, 80);
  if (body.description !== undefined) updates.description = body.description === null ? null : body.description.slice(0, 500);
  if (typeof body.isPublic === "boolean") updates.isPublic = body.isPublic;
  if (typeof body.avatarEmoji === "string" && body.avatarEmoji.trim()) updates.avatarEmoji = body.avatarEmoji.trim().slice(0, 10);
  if (typeof body.maxMembers === "number") updates.maxMembers = body.maxMembers;
  if (Array.isArray(body.tags)) updates.tags = body.tags.map(t => t.trim()).filter(Boolean).slice(0, MAX_TAGS);

  const [updated] = await db.update(studyGroupsTable)
    .set(updates)
    .where(eq(studyGroupsTable.id, groupId)).returning();
  if (!updated) return sendNotFound(res, "Group not found");
  res.json(updated);
});

groupsRouter.delete("/groups/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const groupId = req.params.id as string;
  const [group] = await db.select({ ownerId: studyGroupsTable.ownerId }).from(studyGroupsTable).where(eq(studyGroupsTable.id, groupId)).limit(1);
  if (!group) return sendNotFound(res, "Group not found");
  if (group.ownerId !== userId) return sendForbidden(res, "Only the owner can delete this group");
  await db.delete(studyGroupsTable).where(eq(studyGroupsTable.id, groupId));
  res.json({ ok: true });
});

type JoinOutcome = "joined" | "already" | "full" | "missing";

/**
 * Race-safe join: lock the group row, count members, insert. Two concurrent
 * joins for the last seat can't both succeed, and a double-tap can't create
 * two membership rows.
 */
async function joinGroupTx(groupId: string, userId: string): Promise<{ outcome: JoinOutcome; group?: typeof studyGroupsTable.$inferSelect }> {
  return db.transaction(async (tx) => {
    const [group] = await tx.select().from(studyGroupsTable).where(eq(studyGroupsTable.id, groupId)).for("update").limit(1);
    if (!group) return { outcome: "missing" as const };
    const [existing] = await tx.select({ id: groupMembersTable.id }).from(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, userId))).limit(1);
    if (existing) return { outcome: "already" as const, group };
    const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(groupMembersTable)
      .where(eq(groupMembersTable.groupId, groupId));
    if (Number(count) >= group.maxMembers) return { outcome: "full" as const, group };
    await tx.insert(groupMembersTable).values({ groupId, userId, role: "member" });
    return { outcome: "joined" as const, group };
  });
}

async function notifyOwnerOfJoin(group: { id: string; name: string; ownerId: string }, joinerId: string) {
  if (group.ownerId === joinerId) return;
  try {
    const [joiner] = await db.select({ name: usersTable.name, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, joinerId)).limit(1);
    await db.insert(notificationsTable).values({
      userId: group.ownerId, type: "group_join",
      title: `New member joined ${group.name}`,
      message: `${displayName(joiner)} joined your study group`,
      data: { groupId: group.id, userId: joinerId },
    });
  } catch (err) {
    logger.warn({ err, groupId: group.id }, "group join notification failed (non-fatal)");
  }
}

groupsRouter.post("/groups/:id/join", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const groupId = req.params.id as string;
  const [group] = await db.select({ isPublic: studyGroupsTable.isPublic }).from(studyGroupsTable).where(eq(studyGroupsTable.id, groupId)).limit(1);
  if (!group) return sendNotFound(res, "Group not found");
  if (!group.isPublic) return sendForbidden(res, "An invite code is required to join this group");

  const result = await joinGroupTx(groupId, userId);
  if (result.outcome === "missing") return sendNotFound(res, "Group not found");
  if (result.outcome === "already") return sendConflict(res, "You're already a member of this group");
  if (result.outcome === "full") return sendConflict(res, "This group is full");
  await notifyOwnerOfJoin(result.group!, userId);
  res.json({ ok: true, group: result.group });
});

groupsRouter.post("/groups/join-invite", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const parsed = inviteSchema.safeParse(req.body ?? {});
  if (!parsed.success) return sendValidationError(res, firstIssue(parsed.error));
  const code = parsed.data.inviteCode.toUpperCase();
  const [group] = await db.select({ id: studyGroupsTable.id }).from(studyGroupsTable).where(eq(studyGroupsTable.inviteCode, code)).limit(1);
  if (!group) return sendNotFound(res, "Invalid invite code");

  const result = await joinGroupTx(group.id, userId);
  if (result.outcome === "missing") return sendNotFound(res, "Invalid invite code");
  if (result.outcome === "already") return sendConflict(res, "You're already a member of this group");
  if (result.outcome === "full") return sendConflict(res, "This group is full");
  await notifyOwnerOfJoin(result.group!, userId);
  res.json({ ok: true, group: result.group });
});

groupsRouter.delete("/groups/:id/leave", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const groupId = req.params.id as string;
  const [group] = await db.select({ ownerId: studyGroupsTable.ownerId }).from(studyGroupsTable).where(eq(studyGroupsTable.id, groupId)).limit(1);
  if (!group) return sendNotFound(res, "Group not found");
  if (group.ownerId === userId) return sendValidationError(res, "The owner can't leave. Transfer ownership or delete the group.");
  await db.delete(groupMembersTable)
    .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, userId)));
  res.json({ ok: true });
});

groupsRouter.patch("/groups/:id/members/:memberId/role", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const groupId = req.params.id as string;
  const memberId = req.params.memberId as string;
  const [group] = await db.select({ ownerId: studyGroupsTable.ownerId }).from(studyGroupsTable).where(eq(studyGroupsTable.id, groupId)).limit(1);
  if (!group) return sendNotFound(res, "Group not found");
  if (group.ownerId !== userId) return sendForbidden(res, "Only the owner can change roles");
  if (memberId === userId) return sendValidationError(res, "You can't change your own role");
  const parsed = roleSchema.safeParse(req.body ?? {});
  if (!parsed.success) return sendValidationError(res, "Role must be admin, moderator or member");
  const updated = await db.update(groupMembersTable).set({ role: parsed.data.role })
    .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, memberId)))
    .returning({ id: groupMembersTable.id });
  if (!updated.length) return sendNotFound(res, "That user isn't a member of this group");
  res.json({ ok: true });
});

groupsRouter.get("/groups/:id/leaderboard", authMiddleware, async (req: AuthRequest, res: Response) => {
  const groupId = req.params.id as string;
  const [membership] = await db.select({ id: groupMembersTable.id }).from(groupMembersTable)
    .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, req.userId!))).limit(1);
  if (!membership) return sendNotFound(res, "Group not found");
  const members = await db.select().from(groupMembersTable).where(eq(groupMembersTable.groupId, groupId));
  const { users, wallets } = await loadMemberProfiles(members.map(m => m.userId));
  const entries = members.map(m => ({
    userId: m.userId,
    name: displayName(users.get(m.userId)),
    role: m.role,
    xpContribution: m.xpContribution,
    totalXp: wallets.get(m.userId)?.totalXp ?? 0,
    level: wallets.get(m.userId)?.level ?? 1,
  }));
  res.json(entries.sort((a, b) => b.xpContribution - a.xpContribution).map((e, i) => ({ ...e, rank: i + 1 })));
});

groupsRouter.post("/groups/:id/contribute-xp", authMiddleware, (_req: AuthRequest, res: Response) => {
  res.status(410).json({ error: { code: "NOT_FOUND", message: "Direct group XP contributions are no longer supported" } });
});
