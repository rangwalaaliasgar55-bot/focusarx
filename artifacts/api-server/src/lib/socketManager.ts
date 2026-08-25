import { Server, Socket } from "socket.io";
import { extractUserId } from "../routes/auth";
import { logger } from "./logger";
import { db, studyRoomMembersTable, studyRoomsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

let io: Server | null = null;

const userSockets = new Map<string, Set<string>>();
const socketUsers = new Map<string, string>();
const onlineUsers = new Set<string>();

export function initSocket(httpServer: import("http").Server) {
  const isDev = process.env.NODE_ENV !== "production";
  const configuredOrigins = [
    process.env.APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined,
  ].filter((value): value is string => Boolean(value)).map((value) => {
    try { return new URL(value).origin; } catch { return value.replace(/\/+$/, ""); }
  });

  io = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => {
        if (!origin || isDev || configuredOrigins.includes(origin)) {
          cb(null, true);
          return;
        }
        logger.warn({ origin }, "socket CORS origin rejected");
        cb(new Error("Origin not allowed"));
      },
      credentials: true,
    },
    transports: ["websocket", "polling"],
    path: "/socket.io/",
  });

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      logger.warn({ socketId: socket.id }, "socket auth rejected: no token");
      next(new Error("Authentication required"));
      return;
    }
    const fakeReq = { headers: { authorization: `Bearer ${token}` } };
    const userId = extractUserId(fakeReq as any);
    if (!userId) {
      logger.warn({ socketId: socket.id }, "socket auth rejected: invalid token");
      next(new Error("Invalid token"));
      return;
    }
    (socket as any).userId = userId;
    next();
  });

  io.on("connection", (socket: Socket) => {
    const userId = (socket as any).userId as string;
    if (!userId) { socket.disconnect(); return; }

    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId)!.add(socket.id);
    socketUsers.set(socket.id, userId);
    onlineUsers.add(userId);

    socket.join(`user:${userId}`);
    logger.info({ userId, socketId: socket.id, transport: socket.conn.transport.name }, "socket connected");

    const canAccessRoom = async (roomId: string): Promise<boolean> => {
      if (!/^[0-9a-f-]{36}$/i.test(roomId)) return false;
      const [membership] = await db.select({ id: studyRoomMembersTable.id })
        .from(studyRoomMembersTable)
        .innerJoin(studyRoomsTable, eq(studyRoomMembersTable.roomId, studyRoomsTable.id))
        .where(and(
          eq(studyRoomMembersTable.roomId, roomId),
          eq(studyRoomMembersTable.userId, userId),
          eq(studyRoomMembersTable.status, "active"),
          eq(studyRoomsTable.status, "active"),
        ))
        .limit(1);
      return Boolean(membership);
    };

    socket.on("join:room", async (roomId: string, acknowledge?: (result: { ok: boolean; error?: string }) => void) => {
      try {
        if (!await canAccessRoom(roomId)) {
          acknowledge?.({ ok: false, error: "Not authorized for this room" });
          logger.warn({ userId, roomId }, "unauthorized socket room join rejected");
          return;
        }
        await socket.join(`room:${roomId}`);
        acknowledge?.({ ok: true });
        logger.debug({ userId, roomId }, "joined room");
        // A couple of AI rivals banter briefly when a human joins — the room
        // feels inhabited. Deterministic per (room, IST day), throttled to
        // once per 20 minutes per room. Bots are always visibly badged.
        scheduleBotBanter(io!, roomId);
      } catch (err) {
        acknowledge?.({ ok: false, error: "Unable to join room" });
        logger.error({ err, userId, roomId }, "socket room authorization failed");
      }
    });

    socket.on("leave:room", (roomId: string) => {
      socket.leave(`room:${roomId}`);
    });

    const recentRoomMessages: number[] = [];
    socket.on("room:chat", async ({ roomId, content }: { roomId?: string; content?: string }) => {
      if (!roomId || typeof content !== "string" || !content.trim() || content.length > 500) return;
      const cutoff = Date.now() - 60_000;
      while (recentRoomMessages.length && recentRoomMessages[0]! < cutoff) recentRoomMessages.shift();
      if (recentRoomMessages.length >= 20) {
        logger.warn({ userId, roomId }, "socket room message rate limit exceeded");
        return;
      }
      if (!socket.rooms.has(`room:${roomId}`) || !await canAccessRoom(roomId)) {
        logger.warn({ userId, roomId }, "unauthorized socket room message rejected");
        return;
      }
      recentRoomMessages.push(Date.now());
      io?.to(`room:${roomId}`).emit("room:chat", {
        userId,
        content: content.trim(),
        ts: new Date().toISOString(),
      });
    });

    socket.on("disconnect", (reason) => {
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
          onlineUsers.delete(userId);
        }
      }
      socketUsers.delete(socket.id);
      logger.info({ userId, socketId: socket.id, reason }, "socket disconnected");
    });

    socket.on("error", (err) => {
      logger.error({ err, userId, socketId: socket.id }, "socket error");
    });
  });

  return io;
}

// ── study-room bot banter (A2: "bots live like real members") ───────────────
// Short bot-to-bot exchanges (2–4 Hinglish lines) that play when a human
// joins an active room. Deterministic per (room, IST day) + in-memory
// throttle, so repeated joins don't replay it, and it costs zero AI calls.

import { BANTER } from "./botTemplates";
import { hashString, mulberry32 } from "./personas";
import { usersTable as botUsersTable } from "@workspace/db";
import { eq as eqRoom } from "drizzle-orm";

const lastBotBanter = new Map<string, number>(); // roomId -> last-run timestamp

async function pickBanterBots(): Promise<Array<{ id: string; name: string }>> {
  const rows = await db
    .select({ id: botUsersTable.id, name: botUsersTable.name })
    .from(botUsersTable)
    .where(eqRoom(botUsersTable.role, "bot"))
    .limit(40);
  return rows.map((r) => ({ id: r.id, name: r.name ?? "Rival" }));
}

function scheduleBotBanter(io: Server, roomId: string): void {
  try {
    const dayKey = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
    const rng = mulberry32(hashString(`banter:${roomId}:${dayKey}`));
    if (rng() > 0.75) return; // ~75% of room-days get a little banter
    const last = lastBotBanter.get(roomId) ?? 0;
    if (Date.now() - last < 20 * 60 * 1000) return;
    lastBotBanter.set(roomId, Date.now());

    void (async () => {
      const bots = await pickBanterBots();
      if (bots.length < 2) return;
      const speakerA = bots[Math.floor(rng() * bots.length)]!;
      const speakerB = bots[Math.floor(rng() * bots.length)]!;
      if (speakerA.id === speakerB.id) return;
      const count = 2 + Math.floor(rng() * 3); // 2–4 lines
      const firstLine = Math.floor(rng() * BANTER.length);
      const delay = 1500 + rng() * 2500;
      let i = 0;
      const emitNext = () => {
        if (i >= count) return;
        const speaker = i % 2 === 0 ? speakerA : speakerB;
        const line = BANTER[(firstLine + i) % BANTER.length]!;
        io.to(`room:${roomId}`).emit("room:chat", {
          userId: speaker.id,
          content: line,
          isBot: true,
          botName: speaker.name,
          ts: new Date().toISOString(),
        });
        i++;
        setTimeout(emitNext, 4000 + Math.random() * 5000);
      };
      setTimeout(emitNext, delay);
    })().catch(() => undefined);
  } catch {
    // banter must never break a join
  }
}

export function getIO(): Server | null { return io; }

/** Broadcast an event to every connected socket (drop announcements etc). */
export function emitDrop(data: unknown): void {
  try {
    io?.emit("drop:started", data);
  } catch (err) {
    logger.warn({ err }, "emit drop failed (non-fatal)");
  }
}

export function emitToUser(userId: string, event: string, data: unknown) {
  io?.to(`user:${userId}`).emit(event, data);
}

export function emitToRoom(roomId: string, event: string, data: unknown) {
  io?.to(`room:${roomId}`).emit(event, data);
}

export function broadcastActivity(event: string, data: unknown) {
  io?.emit(event, data);
}

export function isOnline(userId: string): boolean {
  return onlineUsers.has(userId);
}

export function getOnlineUsers(): string[] {
  return [...onlineUsers];
}
