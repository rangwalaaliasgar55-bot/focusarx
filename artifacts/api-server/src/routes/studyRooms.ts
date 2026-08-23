import { Request, Response, NextFunction } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router } from "express";
import { db } from "@workspace/db";
import {
  studyRoomsTable, studyRoomMembersTable, usersTable, userWalletsTable,
  studyGroupsTable, groupMembersTable, notificationsTable,
} from "@workspace/db";
import { extractUserId } from "./auth";
import { eq, and, desc, sql, ne } from "drizzle-orm";

export const studyRoomsRouter = Router();

function genCode() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

async function canAccessRoom(userId: string, room: typeof studyRoomsTable.$inferSelect): Promise<boolean> {
  if (room.isPublic) return true;
  const [roomMembership] = await db.select({ id: studyRoomMembersTable.id }).from(studyRoomMembersTable)
    .where(and(
      eq(studyRoomMembersTable.roomId, room.id),
      eq(studyRoomMembersTable.userId, userId),
      eq(studyRoomMembersTable.status, "active"),
    )).limit(1);
  if (roomMembership) return true;
  if (!room.groupId) return false;
  const [groupMembership] = await db.select({ id: groupMembersTable.id }).from(groupMembersTable)
    .where(and(eq(groupMembersTable.groupId, room.groupId), eq(groupMembersTable.userId, userId))).limit(1);
  return Boolean(groupMembership);
}

async function enrichRoom(room: any) {
  const activeMembers = await db.select().from(studyRoomMembersTable)
    .where(and(eq(studyRoomMembersTable.roomId, room.id), eq(studyRoomMembersTable.status, "active")));

  const memberDetails = await Promise.all(activeMembers.map(async m => {
    const [user] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, m.userId)).limit(1);
    const [wallet] = await db.select({ level: userWalletsTable.level })
      .from(userWalletsTable).where(eq(userWalletsTable.userId, m.userId)).limit(1);
    return {
      userId: m.userId,
      name: user?.name || user?.email?.split("@")[0] || "User",
      level: wallet?.level ?? 1,
      joinedAt: m.joinedAt,
      focusMinutes: m.focusMinutes,
    };
  }));

  const [host] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
    .from(usersTable).where(eq(usersTable.id, room.hostId)).limit(1);

  return {
    ...room,
    participantCount: activeMembers.length,
    participants: memberDetails,
    hostName: host?.name || host?.email?.split("@")[0] || "Host",
  };
}

studyRoomsRouter.get("/study-rooms", async (req: AuthRequest, res: Response) => {
  (req as any).userId = extractUserId(req) ?? null;
  const { groupId } = req.query as { groupId?: string };
  let rooms;
  if (groupId) {
    const userId = (req as any).userId as string | null;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const [membership] = await db.select({ id: groupMembersTable.id }).from(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, userId))).limit(1);
    if (!membership) return res.status(404).json({ error: "Group not found" });
    rooms = await db.select().from(studyRoomsTable)
      .where(and(eq(studyRoomsTable.groupId, groupId), eq(studyRoomsTable.status, "active")))
      .orderBy(desc(studyRoomsTable.createdAt));
  } else {
    rooms = await db.select().from(studyRoomsTable)
      .where(and(eq(studyRoomsTable.status, "active"), eq(studyRoomsTable.isPublic, true)))
      .orderBy(desc(studyRoomsTable.createdAt))
      .limit(20);
  }
  const enriched = await Promise.all(rooms.map(enrichRoom));
  res.json(enriched);
});

studyRoomsRouter.get("/study-rooms/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  const [room] = await db.select().from(studyRoomsTable)
    .where(eq(studyRoomsTable.id, req.params.id as string)).limit(1);
  if (!room || !await canAccessRoom(req.userId, room)) return res.status(404).json({ error: "Room not found" });
  res.json(await enrichRoom(room));
});

studyRoomsRouter.post("/study-rooms", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { name, mode, groupId, isPublic, maxParticipants, timerDuration, ambiance, scheduledFor } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "name required" });

  const MODES = ["silent", "pomodoro", "open_chat", "accountability"];
  const AMBIANCES = ["silence", "lofi", "rain", "cafe", "forest", "binaural"];

  const [room] = await db.insert(studyRoomsTable).values({
    name: name.trim(),
    hostId: userId,
    groupId: groupId || null,
    mode: MODES.includes(mode) ? mode : "silent",
    isPublic: isPublic !== false,
    maxParticipants: maxParticipants || 50,
    timerDuration: timerDuration || 1500,
    ambiance: AMBIANCES.includes(ambiance) ? ambiance : "silence",
    inviteCode: genCode(),
    scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
  }).returning();

  await db.insert(studyRoomMembersTable).values({ roomId: room.id, userId, status: "active" });

  res.status(201).json(await enrichRoom(room));
});

studyRoomsRouter.post("/study-rooms/:id/join", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const [room] = await db.select().from(studyRoomsTable)
    .where(eq(studyRoomsTable.id, req.params.id as string)).limit(1);
  if (!room || !await canAccessRoom(userId, room)) return res.status(404).json({ error: "Room not found" });
  if (room.status !== "active") return res.status(400).json({ error: "Room is not active" });

  const activeCount = await db.select({ count: sql<number>`count(*)` })
    .from(studyRoomMembersTable)
    .where(and(eq(studyRoomMembersTable.roomId, room.id), eq(studyRoomMembersTable.status, "active")));
  if (Number(activeCount[0]?.count ?? 0) >= room.maxParticipants) {
    return res.status(400).json({ error: "Room is full" });
  }

  const [existing] = await db.select().from(studyRoomMembersTable)
    .where(and(eq(studyRoomMembersTable.roomId, room.id), eq(studyRoomMembersTable.userId, userId))).limit(1);

  if (existing) {
    if (existing.status !== "active") {
      await db.update(studyRoomMembersTable)
        .set({ status: "active", leftAt: null, joinedAt: new Date() })
        .where(eq(studyRoomMembersTable.id, existing.id));
    }
  } else {
    await db.insert(studyRoomMembersTable).values({ roomId: room.id, userId, status: "active" });
  }

  res.json({ ok: true });
});

studyRoomsRouter.post("/study-rooms/join-code", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { inviteCode } = req.body;
  const [room] = await db.select().from(studyRoomsTable)
    .where(eq(studyRoomsTable.inviteCode, inviteCode?.toUpperCase())).limit(1);
  if (!room) return res.status(404).json({ error: "Invalid invite code" });

  const [existing] = await db.select().from(studyRoomMembersTable)
    .where(and(eq(studyRoomMembersTable.roomId, room.id), eq(studyRoomMembersTable.userId, userId))).limit(1);

  if (!existing) {
    await db.insert(studyRoomMembersTable).values({ roomId: room.id, userId, status: "active" });
  } else {
    await db.update(studyRoomMembersTable)
      .set({ status: "active", leftAt: null, joinedAt: new Date() })
      .where(eq(studyRoomMembersTable.id, existing.id));
  }

  res.json({ ok: true, room: await enrichRoom(room) });
});

studyRoomsRouter.delete("/study-rooms/:id/leave", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const [member] = await db.select().from(studyRoomMembersTable)
    .where(and(eq(studyRoomMembersTable.roomId, req.params.id as string), eq(studyRoomMembersTable.userId, userId))).limit(1);

  if (member) {
    const mins = Math.round((Date.now() - new Date(member.joinedAt).getTime()) / 60000);
    await db.update(studyRoomMembersTable)
      .set({ status: "left", leftAt: new Date(), focusMinutes: Math.max(member.focusMinutes, mins) })
      .where(eq(studyRoomMembersTable.id, member.id));
  }

  const [room] = await db.select().from(studyRoomsTable).where(eq(studyRoomsTable.id, req.params.id as string)).limit(1);
  if (room?.hostId === userId) {
    await db.update(studyRoomsTable).set({ status: "ended", endedAt: new Date() })
      .where(eq(studyRoomsTable.id, req.params.id as string));
  }

  res.json({ ok: true });
});

studyRoomsRouter.delete("/study-rooms/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const [room] = await db.select().from(studyRoomsTable)
    .where(and(eq(studyRoomsTable.id, req.params.id as string), eq(studyRoomsTable.hostId, userId))).limit(1);
  if (!room) return res.status(403).json({ error: "Not authorized" });
  await db.update(studyRoomsTable).set({ status: "ended", endedAt: new Date() })
    .where(eq(studyRoomsTable.id, req.params.id as string));
  res.json({ ok: true });
});
