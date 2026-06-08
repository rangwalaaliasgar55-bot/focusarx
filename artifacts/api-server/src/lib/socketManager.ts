import { Server, Socket } from "socket.io";
import { extractUserId } from "../routes/auth";
import { logger } from "./logger";

let io: Server | null = null;

const userSockets = new Map<string, Set<string>>();
const socketUsers = new Map<string, string>();
const onlineUsers = new Set<string>();

export function initSocket(httpServer: import("http").Server) {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => {
        if (!origin) { cb(null, true); return; }
        cb(null, true);
      },
      credentials: true,
    },
    transports: ["websocket", "polling"],
    path: "/socket.io/",
  });

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) { next(new Error("Authentication required")); return; }
    const fakeReq = { headers: { authorization: `Bearer ${token}` } };
    const userId = extractUserId(fakeReq as any);
    if (!userId) { next(new Error("Invalid token")); return; }
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
    logger.debug({ userId, socketId: socket.id }, "socket connected");

    socket.on("join:room", (roomId: string) => {
      socket.join(`room:${roomId}`);
      logger.debug({ userId, roomId }, "joined room");
    });

    socket.on("leave:room", (roomId: string) => {
      socket.leave(`room:${roomId}`);
    });

    socket.on("room:chat", ({ roomId, content }: { roomId: string; content: string }) => {
      if (!content?.trim()) return;
      io?.to(`room:${roomId}`).emit("room:chat", {
        userId,
        content: content.trim().slice(0, 500),
        ts: new Date().toISOString(),
      });
    });

    socket.on("disconnect", () => {
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
          onlineUsers.delete(userId);
        }
      }
      socketUsers.delete(socket.id);
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
