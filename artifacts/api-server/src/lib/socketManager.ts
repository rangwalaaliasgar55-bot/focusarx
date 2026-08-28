import { Server, Socket } from "socket.io";
import { extractUserId } from "../routes/auth";
import { verifySocketTicket } from "./socketTickets";
import { getServerConfig } from "./config";
import { logger } from "./logger";
import { db, studyRoomMembersTable, studyRoomsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

let io: Server | null = null;

const userSockets = new Map<string, Set<string>>();
const socketUsers = new Map<string, string>();
const onlineUsers = new Set<string>();

// Zod schemas for socket payloads
const roomIdSchema = z.string().uuid();
const roomChatSchema = z.object({
  roomId: z.string().uuid(),
  content: z.string().trim().min(1).max(500),
});

const joinRoomSchema = z.string().uuid();

export function initSocket(httpServer: import("http").Server) {
  const isDev = process.env.NODE_ENV !== "production";
  const configuredOrigins = [
    process.env.APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined,
    ...(process.env.CORS_ALLOWED_ORIGINS?.split(",").map((v) => v.trim()).filter(Boolean) ?? []),
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
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
    path: "/socket.io/",
    maxHttpBufferSize: 1e6, // 1MB max message size
    connectTimeout: 10000,
  });

  io.use((socket: Socket, next) => {
    // Preferred: a 60s socket-scoped ticket from GET /api/auth/socket-ticket.
    // Fallback: the legacy bearer token (older clients), still fully verified.
    const ticket = socket.handshake.auth?.ticket as string | undefined;
    const token = socket.handshake.auth?.token as string | undefined;
    let userId: string | null = null;

    if (ticket) {
      const secret = getServerConfig().jwtSecret;
      userId = secret ? verifySocketTicket(ticket, secret)?.sub ?? null : null;
    } else if (token) {
      const fakeReq = { headers: { authorization: `Bearer ${token}` } } as any;
      userId = extractUserId(fakeReq);
    }

    if (!userId) {
      logger.warn({ socketId: socket.id, method: ticket ? "ticket" : token ? "token" : "none" }, "socket auth rejected");
      next(new Error(ticket || token ? "Invalid credentials" : "Authentication required"));
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
      const parsed = roomIdSchema.safeParse(roomId);
      if (!parsed.success) return false;
      try {
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
      } catch {
        return false;
      }
    };

    // Rate limiting per socket
    const recentRoomMessages: number[] = [];
    const recentJoins: number[] = [];

    function checkRateLimit(bucket: number[], windowMs: number, max: number): boolean {
      const cutoff = Date.now() - windowMs;
      while (bucket.length && bucket[0]! < cutoff) bucket.shift();
      if (bucket.length >= max) return false;
      bucket.push(Date.now());
      return true;
    }

    socket.on("join:room", async (roomId: string, acknowledge?: (result: { ok: boolean; error?: string }) => void) => {
      try {
        const parsed = joinRoomSchema.safeParse(roomId);
        if (!parsed.success) {
          acknowledge?.({ ok: false, error: "INVALID_ROOM_ID" });
          socket.emit("error", { code: "INVALID_MESSAGE", message: "Invalid room ID" });
          return;
        }

        if (!checkRateLimit(recentJoins, 60_000, 20)) {
          acknowledge?.({ ok: false, error: "RATE_LIMITED" });
          socket.emit("error", { code: "RATE_LIMITED", message: "Too many join attempts" });
          return;
        }

        if (!await canAccessRoom(parsed.data)) {
          acknowledge?.({ ok: false, error: "Not authorized for this room" });
          logger.warn({ userId, roomId: parsed.data }, "unauthorized socket room join rejected");
          socket.emit("error", { code: "FORBIDDEN", message: "Not authorized for this room" });
          return;
        }

        await socket.join(`room:${parsed.data}`);
        acknowledge?.({ ok: true });
        logger.debug({ userId, roomId: parsed.data }, "joined room");
        scheduleBotBanter(io!, parsed.data);
      } catch (err) {
        acknowledge?.({ ok: false, error: "Unable to join room" });
        logger.error({ err, userId, roomId }, "socket room authorization failed");
        socket.emit("error", { code: "INTERNAL_ERROR", message: "Unable to join room" });
      }
    });

    socket.on("leave:room", (roomId: string) => {
      const parsed = roomIdSchema.safeParse(roomId);
      if (!parsed.success) {
        socket.emit("error", { code: "INVALID_MESSAGE", message: "Invalid room ID" });
        return;
      }
      socket.leave(`room:${parsed.data}`);
    });

    socket.on("room:chat", async (payload: unknown) => {
      const parsed = roomChatSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit("error", { code: "INVALID_MESSAGE", message: "Invalid message format" });
        return;
      }

      const { roomId, content } = parsed.data;

      if (!checkRateLimit(recentRoomMessages, 60_000, 20)) {
        logger.warn({ userId, roomId }, "socket room message rate limit exceeded");
        socket.emit("error", { code: "RATE_LIMITED", message: "Too many messages" });
        return;
      }

      // Verify room membership AND that socket actually joined the room
      // Do not trust client-supplied userId — use authenticated socket.userId
      if (!socket.rooms.has(`room:${roomId}`)) {
        const hasAccess = await canAccessRoom(roomId);
        if (!hasAccess) {
          logger.warn({ userId, roomId }, "unauthorized socket room message rejected - not in room");
          socket.emit("error", { code: "FORBIDDEN", message: "Not in room" });
          return;
        }
        // Auto-join if they have access but haven't joined via event (defensive)
        await socket.join(`room:${roomId}`);
      }

      if (!await canAccessRoom(roomId)) {
        logger.warn({ userId, roomId }, "unauthorized socket room message rejected");
        socket.emit("error", { code: "FORBIDDEN", message: "Not authorized" });
        return;
      }

      // Sanitize content — prevent XSS
      const sanitized = content.trim().replace(/[<>]/g, "").slice(0, 500);
      if (!sanitized) {
        socket.emit("error", { code: "INVALID_MESSAGE", message: "Empty message" });
        return;
      }

      io?.to(`room:${roomId}`).emit("room:chat", {
        userId, // Server-determined, never trust client
        content: sanitized,
        ts: new Date().toISOString(),
      });
    });

    // Generic message handler with validation
    socket.on("room:typing", async (payload: unknown) => {
      const parsed = roomIdSchema.safeParse((payload as any)?.roomId ?? payload);
      if (!parsed.success) return;
      const roomId = parsed.data;
      if (!socket.rooms.has(`room:${roomId}`)) return;
      if (!await canAccessRoom(roomId)) return;
      socket.to(`room:${roomId}`).emit("room:typing", { userId, ts: new Date().toISOString() });
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

// ── study-room bot banter ───────────────────────────────────────────────

import { BANTER } from "./botTemplates";
import { hashString, mulberry32 } from "./personas";
import { usersTable as botUsersTable } from "@workspace/db";
import { eq as eqRoom } from "drizzle-orm";

const lastBotBanter = new Map<string, number>();

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
    if (rng() > 0.75) return;
    const last = lastBotBanter.get(roomId) ?? 0;
    if (Date.now() - last < 20 * 60 * 1000) return;
    lastBotBanter.set(roomId, Date.now());

    void (async () => {
      const bots = await pickBanterBots();
      if (bots.length < 2) return;
      const speakerA = bots[Math.floor(rng() * bots.length)]!;
      const speakerB = bots[Math.floor(rng() * bots.length)]!;
      if (speakerA.id === speakerB.id) return;
      const count = 2 + Math.floor(rng() * 3);
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
