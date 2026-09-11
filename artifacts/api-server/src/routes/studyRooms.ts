import { Response } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  studyRoomsTable, studyRoomMembersTable, studyRoomMessagesTable, usersTable, userWalletsTable,
  groupMembersTable,
} from "@workspace/db";
import { extractUserId } from "./auth";
import { eq, and, desc, asc, sql, inArray, gt, ne } from "drizzle-orm";
import type { SelectedFields } from "drizzle-orm/pg-core";
import { logger } from "../lib/logger";
import { moderateText } from "../lib/moderation";
import { getBotSettings } from "../lib/botSettings";
import { sendForbidden, sendInternal, sendNotFound, sendUnauthorized, sendValidationError } from "../lib/httpErrors";
import { BANTER } from "../lib/botTemplates";
import { hashString, mulberry32 } from "../lib/personas";
import { describeDrift, queryOrFallback, selectableColumns, selectResilient } from "../lib/schemaDrift";

/**
 * Study rooms — REST-first.
 *
 * Production runs as a serverless function, so there is no long-lived
 * Socket.IO process: presence and chat are persisted and polled instead.
 *
 *  - Presence: a member row is "online" while its `joined_at`/heartbeat is
 *    fresh (`PRESENCE_TTL_MS`). Clients call POST /:id/heartbeat every ~45 s.
 *  - Chat: `study_room_messages` rows; GET /:id/messages?after=<iso> returns
 *    what changed since the last poll. Bot "banter" is generated server-side
 *    (deterministic per room/day) so rooms never feel empty.
 */

export const studyRoomsRouter = Router();

export const ROOM_MODES = ["silent", "pomodoro", "open_chat", "accountability"] as const;
export const ROOM_AMBIANCES = ["silence", "lofi", "rain", "cafe", "forest", "binaural"] as const;
const PRESENCE_TTL_MS = 3 * 60 * 1000;
const MESSAGE_PAGE = 60;
const BANTER_GAP_MS = 12 * 60 * 1000;

type RoomRow = typeof studyRoomsTable.$inferSelect;
type MemberRow = typeof studyRoomMembersTable.$inferSelect;

function genCode() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

const createRoomSchema = z.object({
  name: z.string().trim().min(2, "Room name is too short").max(80, "Room name is too long"),
  description: z.string().trim().max(240).optional().nullable(),
  topic: z.string().trim().max(60).optional().nullable(),
  mode: z.enum(ROOM_MODES).optional(),
  ambiance: z.enum(ROOM_AMBIANCES).optional(),
  groupId: z.string().uuid().optional().nullable(),
  isPublic: z.boolean().optional(),
  // Legacy client field; `isPrivate: true` == `isPublic: false`.
  isPrivate: z.boolean().optional(),
  maxParticipants: z.number().int().min(2).max(100).optional(),
  timerDuration: z.number().int().min(60).max(14_400).optional(),
  scheduledFor: z.string().datetime({ offset: true }).optional().nullable(),
}).passthrough();

const messageSchema = z.object({
  content: z.string().trim().min(1).max(500),
});

function displayName(user: { name: string | null; email: string | null } | undefined, fallback = "Member"): string {
  return user?.name || user?.email?.split("@")[0] || fallback;
}

/** Is a member row still considered present in the room? */
function isOnline(member: Pick<MemberRow, "status" | "joinedAt">, now = Date.now()): boolean {
  return member.status === "active" && now - new Date(member.joinedAt).getTime() < PRESENCE_TTL_MS;
}

async function canAccessRoom(userId: string | null, room: RoomRow): Promise<boolean> {
  if (room.isPublic) return true;
  if (!userId) return false;
  if (room.hostId === userId) return true;
  const [roomMembership] = await db.select({ id: studyRoomMembersTable.id }).from(studyRoomMembersTable)
    .where(and(
      eq(studyRoomMembersTable.roomId, room.id),
      eq(studyRoomMembersTable.userId, userId),
    )).limit(1);
  if (roomMembership) return true;
  if (!room.groupId) return false;
  const [groupMembership] = await db.select({ id: groupMembersTable.id }).from(groupMembersTable)
    .where(and(eq(groupMembersTable.groupId, room.groupId), eq(groupMembersTable.userId, userId))).limit(1);
  return Boolean(groupMembership);
}

/**
 * `extractUserId` without the ability to throw.
 *
 * A malformed or expired bearer token must not turn a public endpoint into a
 * 500: the viewer is simply anonymous. Token verification is already defensive,
 * but this route is polled by /forge-room every few seconds, so the cost of a
 * throw here is a permanent error loop in the client console.
 */
function safeViewerId(req: AuthRequest): string | null {
  try {
    return extractUserId(req) ?? null;
  } catch (err) {
    logger.warn({ err }, "GET /study-rooms: unreadable auth token — continuing anonymously");
    return null;
  }
}

async function loadRoom(roomId: string): Promise<RoomRow | undefined> {
  if (!roomId || roomId.length > 64) return undefined;
  // Column-explicit via selectResilient: `db.select()` expands to every column
  // in lib/db/src/schema, so one column missing from the deployed database
  // (Postgres 42703) used to fail every read of this table. Now the missing
  // column is dropped, logged with its name, and the room still loads.
  const [room] = await selectResilient<RoomRow[]>(
    studyRoomsTable,
    (fields) => db.select(fields as unknown as SelectedFields).from(studyRoomsTable).where(eq(studyRoomsTable.id, roomId)).limit(1),
    { route: "loadRoom", roomId },
  );
  return room;
}

/**
 * Enrich a batch of rooms with participants/host details in a fixed number
 * of queries (the old implementation issued ~3 queries per member).
 */
async function enrichRooms(rooms: RoomRow[], viewerId: string | null) {
  if (rooms.length === 0) return [];
  const roomIds = rooms.map((r) => r.id);
  const now = Date.now();

  // Every query below is decoration around the room rows the caller already has.
  // A failure in any of them (missing table, missing column, statement timeout)
  // degrades the participant/level/count fields instead of turning the whole
  // list into a 500 — which is what `GET /study-rooms` did in production while
  // /forge-room polled it into an error loop.
  const members = await queryOrFallback<MemberRow[]>(
    "study room members",
    selectResilient<MemberRow[]>(
      studyRoomMembersTable,
      (fields) => {
        const query = db.select(fields as unknown as SelectedFields).from(studyRoomMembersTable)
          .where(and(inArray(studyRoomMembersTable.roomId, roomIds), eq(studyRoomMembersTable.status, "active")));
        // `joined_at` drives presence ordering; skip the sort if it is the
        // column that drifted rather than failing the read.
        return fields.joinedAt ? query.orderBy(desc(fields.joinedAt)) : query;
      },
      { route: "enrichRooms", rooms: roomIds.length },
    ),
    [],
  );

  const userIds = [...new Set([...members.map((m) => m.userId), ...rooms.map((r) => r.hostId)])];
  const users = userIds.length
    ? await queryOrFallback(
        "study room participants",
        db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role })
          .from(usersTable).where(inArray(usersTable.id, userIds)),
        [] as Array<{ id: string; name: string | null; email: string | null; role: string }>,
      )
    : [];
  const wallets = userIds.length
    ? await queryOrFallback(
        "study room wallet levels",
        db.select({ userId: userWalletsTable.userId, level: userWalletsTable.level })
          .from(userWalletsTable).where(inArray(userWalletsTable.userId, userIds)),
        [] as Array<{ userId: string; level: number }>,
      )
    : [];
  const userById = new Map(users.map((u) => [u.id, u]));
  const levelById = new Map(wallets.map((w) => [w.userId, w.level ?? 1]));

  const messageCounts = await queryOrFallback(
    "study room message counts",
    db.select({
      roomId: studyRoomMessagesTable.roomId,
      count: sql<number>`count(*)`,
    }).from(studyRoomMessagesTable)
      .where(and(inArray(studyRoomMessagesTable.roomId, roomIds), eq(studyRoomMessagesTable.kind, "chat")))
      .groupBy(studyRoomMessagesTable.roomId),
    [] as Array<{ roomId: string; count: number }>,
  );
  const messageCountByRoom = new Map(messageCounts.map((m) => [m.roomId, Number(m.count)]));

  return rooms.map((room) => {
    const roomMembers = members.filter((m) => m.roomId === room.id);
    const participants = roomMembers.map((m) => {
      const user = userById.get(m.userId);
      return {
        userId: m.userId,
        name: displayName(user),
        level: levelById.get(m.userId) ?? 1,
        role: (user?.role ?? "user").toLowerCase(),
        isHost: m.userId === room.hostId,
        joinedAt: m.joinedAt,
        focusMinutes: m.focusMinutes,
        online: isOnline(m, now),
      };
    });
    const onlineCount = participants.filter((p) => p.online).length;
    const host = userById.get(room.hostId);
    const mine = viewerId ? roomMembers.find((m) => m.userId === viewerId) : undefined;
    return {
      ...room,
      hostName: displayName(host, "Host"),
      // Legacy aliases the older client used.
      isPrivate: !room.isPublic,
      memberCount: participants.length,
      activeCount: onlineCount,
      participantCount: participants.length,
      onlineCount,
      participants,
      messageCount: messageCountByRoom.get(room.id) ?? 0,
      isHost: viewerId === room.hostId,
      isMember: Boolean(mine),
      // Never leak the invite code of a private room to non-members.
      inviteCode: room.isPublic || viewerId === room.hostId || mine ? room.inviteCode : null,
    };
  });
}

async function enrichRoom(room: RoomRow, viewerId: string | null) {
  const [enriched] = await enrichRooms([room], viewerId);
  return enriched!;
}

async function upsertMembership(roomId: string, userId: string): Promise<void> {
  const [existing] = await db.select().from(studyRoomMembersTable)
    .where(and(eq(studyRoomMembersTable.roomId, roomId), eq(studyRoomMembersTable.userId, userId))).limit(1);
  if (existing) {
    await db.update(studyRoomMembersTable)
      .set({ status: "active", leftAt: null, joinedAt: new Date() })
      .where(eq(studyRoomMembersTable.id, existing.id));
    return;
  }
  await db.insert(studyRoomMembersTable)
    .values({ roomId, userId, status: "active" })
    .onConflictDoUpdate({
      target: [studyRoomMembersTable.roomId, studyRoomMembersTable.userId],
      set: { status: "active", leftAt: null, joinedAt: new Date() },
    })
    .catch(async (err: unknown) => {
      // Databases without the unique index fall back to a plain insert race:
      // a duplicate is harmless because reads always dedupe by user.
      logger.warn({ err, roomId, userId }, "study room membership upsert fallback");
      await db.insert(studyRoomMembersTable).values({ roomId, userId, status: "active" });
    });
}

async function postSystemMessage(roomId: string, content: string): Promise<void> {
  try {
    await db.insert(studyRoomMessagesTable).values({ roomId, userId: null, kind: "system", content });
    await db.update(studyRoomsTable).set({ lastActivityAt: new Date() }).where(eq(studyRoomsTable.id, roomId));
  } catch (err) {
    logger.warn({ err, roomId }, "system message failed (non-fatal)");
  }
}

/**
 * Deterministic, throttled bot banter so a room never feels dead. Runs on
 * read (the poll), which is the only tick a serverless deployment has. Two
 * bots exchange 2–3 lines at most once per `BANTER_GAP_MS` per room.
 */
async function maybeSeedBanter(room: RoomRow): Promise<void> {
  if (room.mode === "silent") return;
  try {
    const settings = await getBotSettings();
    if (!settings.enabled || !settings.roomBanter) return;
    const [last] = await db.select({ createdAt: studyRoomMessagesTable.createdAt })
      .from(studyRoomMessagesTable)
      .where(and(eq(studyRoomMessagesTable.roomId, room.id), eq(studyRoomMessagesTable.kind, "bot")))
      .orderBy(desc(studyRoomMessagesTable.createdAt)).limit(1);
    const now = Date.now();
    if (last && now - new Date(last.createdAt).getTime() < BANTER_GAP_MS) return;

    const slot = Math.floor(now / BANTER_GAP_MS);
    const rng = mulberry32(hashString(`banter:${room.id}:${slot}`));
    if (rng() > settings.roomBanterChance) return; // most slots stay quiet

    const bots = await db.select({ id: usersTable.id, name: usersTable.name })
      .from(usersTable).where(eq(usersTable.role, "bot")).limit(40);
    if (bots.length < 2) return;
    const a = bots[Math.floor(rng() * bots.length)]!;
    let b = bots[Math.floor(rng() * bots.length)]!;
    if (b.id === a.id) b = bots[(bots.indexOf(a) + 1) % bots.length]!;
    const count = 2 + Math.floor(rng() * 2);
    const first = Math.floor(rng() * BANTER.length);
    const rows = Array.from({ length: count }, (_, i) => ({
      roomId: room.id,
      userId: (i % 2 === 0 ? a : b).id,
      kind: "bot",
      content: BANTER[(first + i) % BANTER.length]!,
      // Spread the lines out a few seconds so they read like a conversation.
      createdAt: new Date(now - (count - i) * 4_000),
    }));
    await db.insert(studyRoomMessagesTable).values(rows);
  } catch (err) {
    logger.warn({ err, roomId: room.id }, "banter seed failed (non-fatal)");
  }
}

// ─── LIST / DETAIL ──────────────────────────────────────────────────────────

/**
 * Public room list, ordered by recent activity.
 *
 * Written through `selectResilient` so the SELECT list is exactly the set of
 * columns the deployed database has: a bare `db.select()` expands to every
 * column in lib/db/src/schema, and one column missing in Neon (Postgres 42703)
 * failed this endpoint with 500 "Could not load study rooms" for every visitor
 * while /forge-room polled it in a loop. `last_activity_at` is only sorted on
 * when it survived the drift check — a room list ordered by creation time is a
 * worse page than one that loads.
 */
function listRooms(whereClause: ReturnType<typeof and>, options: { limit?: number } = {}) {
  return selectResilient<RoomRow[]>(
    studyRoomsTable,
    (fields) => {
      const query = db.select(fields as unknown as SelectedFields).from(studyRoomsTable).where(whereClause);
      const ordered = fields.lastActivityAt && fields.createdAt
        ? query.orderBy(desc(fields.lastActivityAt), desc(fields.createdAt))
        : fields.createdAt
          ? query.orderBy(desc(fields.createdAt))
          : query;
      return options.limit ? ordered.limit(options.limit) : ordered;
    },
    { route: "GET /study-rooms" },
  );
}

studyRoomsRouter.get("/study-rooms", async (req: AuthRequest, res: Response) => {
  const requestId = (req as unknown as { id?: string }).id;
  try {
    // An unreadable/expired token must never turn a public list into a 500:
    // extractUserId is defensive, and so is this.
    const viewerId = safeViewerId(req);
    const { groupId, scope } = req.query as { groupId?: string; scope?: string };
    let rooms: RoomRow[];
    if (groupId) {
      if (!viewerId) return sendUnauthorized(res);
      const [membership] = await db.select({ id: groupMembersTable.id }).from(groupMembersTable)
        .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, viewerId))).limit(1);
      if (!membership) return sendNotFound(res, "Group not found");
      rooms = await listRooms(and(eq(studyRoomsTable.groupId, groupId), eq(studyRoomsTable.status, "active")));
    } else if (scope === "mine" && viewerId) {
      const memberships = await db.select({ roomId: studyRoomMembersTable.roomId }).from(studyRoomMembersTable)
        .where(and(eq(studyRoomMembersTable.userId, viewerId), eq(studyRoomMembersTable.status, "active")));
      const ids = memberships.map((m) => m.roomId);
      rooms = ids.length
        ? await listRooms(and(inArray(studyRoomsTable.id, ids), eq(studyRoomsTable.status, "active")))
        : [];
    } else {
      rooms = await listRooms(and(eq(studyRoomsTable.status, "active"), eq(studyRoomsTable.isPublic, true)), { limit: 40 });
      // Private rooms the viewer belongs to are listed too (they can't be discovered otherwise).
      if (viewerId) {
        const memberships = await db.select({ roomId: studyRoomMembersTable.roomId }).from(studyRoomMembersTable)
          .where(and(eq(studyRoomMembersTable.userId, viewerId), eq(studyRoomMembersTable.status, "active")));
        const known = new Set(rooms.map((r) => r.id));
        const ids = memberships.map((m) => m.roomId).filter((id) => !known.has(id));
        if (ids.length) {
          const mine = await listRooms(and(inArray(studyRoomsTable.id, ids), eq(studyRoomsTable.status, "active")));
          rooms = [...mine, ...rooms];
        }
      }
    }
    res.json(await enrichRooms(rooms, viewerId));
  } catch (err) {
    const drift = describeDrift(err);
    logger.error(
      { err, requestId, drift: drift.kind, object: drift.name, sqlstate: drift.sqlstate },
      "GET /study-rooms failed",
    );
    sendInternal(res, "Could not load study rooms");
  }
});

studyRoomsRouter.get("/study-rooms/:id", async (req: AuthRequest, res: Response) => {
  try {
    const viewerId = extractUserId(req) ?? null;
    const room = await loadRoom(req.params.id as string);
    if (!room || !(await canAccessRoom(viewerId, room))) return sendNotFound(res, "Room not found");
    res.json(await enrichRoom(room, viewerId));
  } catch (err) {
    const drift = describeDrift(err);
    logger.error(
      { err, drift: drift.kind, object: drift.name, sqlstate: drift.sqlstate },
      "GET /study-rooms/:id failed",
    );
    sendInternal(res, "Could not load the room");
  }
});

// ─── CREATE / JOIN / LEAVE ──────────────────────────────────────────────────

studyRoomsRouter.post("/study-rooms", authMiddleware, async (req: AuthRequest, res: Response) => {
  const parsed = createRoomSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return sendValidationError(res, parsed.error.issues[0]?.message ?? "Invalid room", { issues: parsed.error.issues });
  }
  const userId = req.userId!;
  const body = parsed.data;
  try {
    // A host can only run a handful of rooms at once — stops accidental spam.
    const [{ count: openCount }] = await db.select({ count: sql<number>`count(*)` }).from(studyRoomsTable)
      .where(and(eq(studyRoomsTable.hostId, userId), eq(studyRoomsTable.status, "active")));
    if (Number(openCount) >= 5) {
      return sendValidationError(res, "You already host 5 open rooms. End one before creating another.");
    }

    let scheduledFor: Date | null = null;
    if (body.scheduledFor) {
      const when = new Date(body.scheduledFor);
      if (Number.isFinite(when.getTime()) && when.getTime() > Date.now()) scheduledFor = when;
    }
    const isPublic = body.isPublic !== undefined ? body.isPublic : body.isPrivate === undefined ? true : !body.isPrivate;

    const [room] = await db.insert(studyRoomsTable).values({
      name: body.name.slice(0, 80),
      description: body.description ? body.description.slice(0, 240) : null,
      topic: body.topic ? body.topic.slice(0, 60) : null,
      hostId: userId,
      groupId: body.groupId ?? null,
      mode: body.mode ?? "silent",
      isPublic,
      maxParticipants: body.maxParticipants ?? 50,
      timerDuration: body.timerDuration ?? 1500,
      ambiance: body.ambiance ?? "silence",
      inviteCode: genCode(),
      scheduledFor,
      lastActivityAt: new Date(),
    }).returning();
    if (!room) throw new Error("insert returned no row");

    await upsertMembership(room.id, userId);
    await postSystemMessage(room.id, "Room opened. Say hi and set your first goal 🎯");
    res.status(201).json(await enrichRoom(room, userId));
  } catch (err) {
    logger.error({ err, userId }, "POST /study-rooms failed");
    sendInternal(res, "Could not create the room");
  }
});

studyRoomsRouter.post("/study-rooms/:id/join", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  try {
    const room = await loadRoom(req.params.id as string);
    if (!room || !(await canAccessRoom(userId, room))) return sendNotFound(res, "Room not found");
    if (room.status !== "active") return sendValidationError(res, "This room has ended");

    const [existing] = await db.select().from(studyRoomMembersTable)
      .where(and(eq(studyRoomMembersTable.roomId, room.id), eq(studyRoomMembersTable.userId, userId))).limit(1);
    if (!existing || existing.status !== "active") {
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(studyRoomMembersTable)
        .where(and(eq(studyRoomMembersTable.roomId, room.id), eq(studyRoomMembersTable.status, "active")));
      if (Number(count) >= room.maxParticipants) return sendValidationError(res, "Room is full");
      await upsertMembership(room.id, userId);
      const [me] = await db.select({ name: usersTable.name, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
      await postSystemMessage(room.id, `${displayName(me)} joined the room`);
    } else {
      // Already a member: refresh presence.
      await db.update(studyRoomMembersTable).set({ joinedAt: new Date() }).where(eq(studyRoomMembersTable.id, existing.id));
    }
    res.json({ ok: true, room: await enrichRoom(room, userId) });
  } catch (err) {
    logger.error({ err, userId }, "POST /study-rooms/:id/join failed");
    sendInternal(res, "Could not join the room");
  }
});

studyRoomsRouter.post("/study-rooms/join-code", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const code = String((req.body as { inviteCode?: unknown })?.inviteCode ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{6,12}$/.test(code)) return sendValidationError(res, "Enter a valid invite code");
  try {
    const [room] = await db.select().from(studyRoomsTable).where(eq(studyRoomsTable.inviteCode, code)).limit(1);
    if (!room) return sendNotFound(res, "Invalid invite code");
    if (room.status !== "active") return sendValidationError(res, "This room has ended");
    await upsertMembership(room.id, userId);
    const [me] = await db.select({ name: usersTable.name, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    await postSystemMessage(room.id, `${displayName(me)} joined with an invite`);
    res.json({ ok: true, room: await enrichRoom(room, userId) });
  } catch (err) {
    logger.error({ err, userId }, "POST /study-rooms/join-code failed");
    sendInternal(res, "Could not join the room");
  }
});

/** Presence heartbeat: keeps the member "online" and reports focus minutes. */
studyRoomsRouter.post("/study-rooms/:id/heartbeat", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  try {
    const roomId = req.params.id as string;
    const [member] = await db.select().from(studyRoomMembersTable)
      .where(and(eq(studyRoomMembersTable.roomId, roomId), eq(studyRoomMembersTable.userId, userId))).limit(1);
    if (!member) return sendNotFound(res, "Join the room first");
    const focusMinutes = Number((req.body as { focusMinutes?: unknown })?.focusMinutes);
    await db.update(studyRoomMembersTable).set({
      status: "active",
      leftAt: null,
      joinedAt: new Date(),
      ...(Number.isFinite(focusMinutes) && focusMinutes >= 0
        ? { focusMinutes: Math.max(member.focusMinutes, Math.min(1_440, Math.floor(focusMinutes))) }
        : {}),
    }).where(eq(studyRoomMembersTable.id, member.id));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err, userId }, "POST /study-rooms/:id/heartbeat failed");
    sendInternal(res);
  }
});

studyRoomsRouter.delete("/study-rooms/:id/leave", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  try {
    const roomId = req.params.id as string;
    const [member] = await db.select().from(studyRoomMembersTable)
      .where(and(eq(studyRoomMembersTable.roomId, roomId), eq(studyRoomMembersTable.userId, userId))).limit(1);
    if (member && member.status === "active") {
      const mins = Math.max(0, Math.round((Date.now() - new Date(member.joinedAt).getTime()) / 60000));
      await db.update(studyRoomMembersTable)
        .set({ status: "left", leftAt: new Date(), focusMinutes: Math.max(member.focusMinutes, Math.min(mins, 240)) })
        .where(eq(studyRoomMembersTable.id, member.id));
      const [me] = await db.select({ name: usersTable.name, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
      await postSystemMessage(roomId, `${displayName(me)} left the room`);
    }
    // Leaving as host no longer ends the room for everyone — the host must
    // end it explicitly (DELETE /study-rooms/:id). Hand the room over instead.
    const room = await loadRoom(roomId);
    if (room && room.hostId === userId && room.status === "active") {
      const [next] = await db.select({ userId: studyRoomMembersTable.userId }).from(studyRoomMembersTable)
        .where(and(eq(studyRoomMembersTable.roomId, roomId), eq(studyRoomMembersTable.status, "active"), ne(studyRoomMembersTable.userId, userId)))
        .orderBy(asc(studyRoomMembersTable.joinedAt)).limit(1);
      if (next) {
        await db.update(studyRoomsTable).set({ hostId: next.userId }).where(eq(studyRoomsTable.id, roomId));
        await postSystemMessage(roomId, "Host left — the longest-standing member is now host");
      } else {
        await db.update(studyRoomsTable).set({ status: "ended", endedAt: new Date() }).where(eq(studyRoomsTable.id, roomId));
      }
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err, userId }, "DELETE /study-rooms/:id/leave failed");
    sendInternal(res, "Could not leave the room");
  }
});

studyRoomsRouter.delete("/study-rooms/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  try {
    const roomId = req.params.id as string;
    const room = await loadRoom(roomId);
    if (!room) return sendNotFound(res, "Room not found");
    if (room.hostId !== userId) return sendForbidden(res, "Only the host can end this room");
    await db.update(studyRoomsTable).set({ status: "ended", endedAt: new Date() }).where(eq(studyRoomsTable.id, roomId));
    await db.update(studyRoomMembersTable).set({ status: "left", leftAt: new Date() })
      .where(and(eq(studyRoomMembersTable.roomId, roomId), eq(studyRoomMembersTable.status, "active")));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err, userId }, "DELETE /study-rooms/:id failed");
    sendInternal(res, "Could not end the room");
  }
});

// ─── CHAT ───────────────────────────────────────────────────────────────────

studyRoomsRouter.get("/study-rooms/:id/messages", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  try {
    const room = await loadRoom(req.params.id as string);
    if (!room || !(await canAccessRoom(userId, room))) return sendNotFound(res, "Room not found");

    await maybeSeedBanter(room);

    const afterRaw = typeof req.query.after === "string" ? new Date(req.query.after) : null;
    const after = afterRaw && Number.isFinite(afterRaw.getTime()) ? afterRaw : null;
    // Postgres keeps microseconds while the client's cursor is an ISO string
    // with milliseconds — compare at ms precision or the boundary row is
    // re-delivered on every poll.
    const where = after
      ? and(
          eq(studyRoomMessagesTable.roomId, room.id),
          sql`date_trunc('milliseconds', ${studyRoomMessagesTable.createdAt}) > ${after}`,
        )
      : eq(studyRoomMessagesTable.roomId, room.id);
    const rows = await db.select().from(studyRoomMessagesTable)
      .where(where)
      .orderBy(desc(studyRoomMessagesTable.createdAt))
      .limit(MESSAGE_PAGE);
    rows.reverse();

    const authorIds = [...new Set(rows.map((r) => r.userId).filter((id): id is string => Boolean(id)))];
    const authors = authorIds.length
      ? await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role })
          .from(usersTable).where(inArray(usersTable.id, authorIds))
      : [];
    const authorById = new Map(authors.map((a) => [a.id, a]));

    res.json({
      messages: rows.map((row) => {
        const author = row.userId ? authorById.get(row.userId) : undefined;
        const role = (author?.role ?? "user").toLowerCase();
        return {
          id: row.id,
          roomId: row.roomId,
          userId: row.userId,
          kind: row.kind,
          content: row.content,
          createdAt: row.createdAt,
          ts: row.createdAt,
          authorName: row.kind === "system" ? "FocusArx" : displayName(author, "Member"),
          isBot: row.kind === "bot" || role === "bot",
          isAdmin: role === "admin",
          isMine: row.userId === userId,
        };
      }),
      serverNow: new Date().toISOString(),
    });
  } catch (err) {
    logger.error({ err, userId }, "GET /study-rooms/:id/messages failed");
    sendInternal(res, "Could not load messages");
  }
});

studyRoomsRouter.post("/study-rooms/:id/messages", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const parsed = messageSchema.safeParse(req.body ?? {});
  if (!parsed.success) return sendValidationError(res, "Message must be 1–500 characters");
  try {
    const room = await loadRoom(req.params.id as string);
    if (!room || !(await canAccessRoom(userId, room))) return sendNotFound(res, "Room not found");
    if (room.status !== "active") return sendValidationError(res, "This room has ended");

    const [member] = await db.select({ id: studyRoomMembersTable.id, status: studyRoomMembersTable.status })
      .from(studyRoomMembersTable)
      .where(and(eq(studyRoomMembersTable.roomId, room.id), eq(studyRoomMembersTable.userId, userId))).limit(1);
    if (!member || member.status !== "active") return sendForbidden(res, "Join the room to chat");

    // Light flood control: max 20 messages / minute / user / room.
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(studyRoomMessagesTable)
      .where(and(
        eq(studyRoomMessagesTable.roomId, room.id),
        eq(studyRoomMessagesTable.userId, userId),
        gt(studyRoomMessagesTable.createdAt, new Date(Date.now() - 60_000)),
      ));
    if (Number(count) >= 20) {
      res.status(429).json({ error: { code: "RATE_LIMITED", message: "Slow down a little — 20 messages per minute" } });
      return;
    }

    // Stored as plain text; every renderer escapes it (React text nodes).
    const content = parsed.data.content.slice(0, 500);
    const moderation = await moderateText(content).catch(() => ({ status: "approved" as const, reason: "", method: "none" as const }));
    if (moderation.status === "rejected") {
      return sendValidationError(res, "That message isn't allowed here", { reason: moderation.reason });
    }

    const [row] = await db.insert(studyRoomMessagesTable).values({ roomId: room.id, userId, kind: "chat", content }).returning();
    await db.update(studyRoomsTable).set({ lastActivityAt: new Date() }).where(eq(studyRoomsTable.id, room.id));
    // Sending also counts as presence.
    await db.update(studyRoomMembersTable).set({ joinedAt: new Date() }).where(eq(studyRoomMembersTable.id, member.id));

    const [me] = await db.select({ name: usersTable.name, email: usersTable.email, role: usersTable.role })
      .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    res.status(201).json({
      id: row!.id,
      roomId: room.id,
      userId,
      kind: "chat",
      content,
      createdAt: row!.createdAt,
      ts: row!.createdAt,
      authorName: displayName(me, "You"),
      isBot: false,
      isAdmin: (me?.role ?? "").toLowerCase() === "admin",
      isMine: true,
    });
  } catch (err) {
    logger.error({ err, userId }, "POST /study-rooms/:id/messages failed");
    sendInternal(res, "Could not send the message");
  }
});
