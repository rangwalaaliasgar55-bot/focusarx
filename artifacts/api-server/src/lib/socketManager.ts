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

export function getIO(): Server | null { return io; }

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
