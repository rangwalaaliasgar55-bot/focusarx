import { io as ioClient, Socket } from "socket.io-client";
import { useEffect, useRef, useState } from "react";

let socket: Socket | null = null;
let connectionAttempted = false;
let connectionFailed = false;

/**
 * Detect Vercel serverless: the API runs as serverless functions with no
 * persistent HTTP server, so Socket.IO (which needs a long-lived server
 * process) will never work.  Fall back silently to polling-based features.
 */
function isVercelServerless(): boolean {
  return typeof window !== "undefined" && window.location.hostname !== "localhost";
}

export function connectSocket(token: string) {
  if (socket?.connected) return socket;
  if (connectionFailed) return null;
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  // In production on Vercel, socket.io won't work because each API call is
  // a cold-start serverless function — there's no persistent process to hold
  // a WebSocket.  We attempt once; if it fails we remember that and skip
  // future attempts to avoid the repeated console spam.
  socket = ioClient(window.location.origin, {
    path: "/socket.io/",
    auth: { token },
    // Start with polling, upgrade to websocket if the server supports it.
    // On Vercel the connection will simply fail and we'll degrade gracefully.
    transports: ["polling", "websocket"],
    reconnectionAttempts: 3,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10_000,
    timeout: 15_000,
    autoConnect: true,
    forceNew: false,
  });

  socket.on("connect", () => {
    connectionAttempted = true;
    connectionFailed = false;
    console.debug("[socket] connected", socket?.id);
  });

  socket.on("connect_error", (err) => {
    connectionAttempted = true;
    // On Vercel production, socket.io will always fail — avoid spamming the
    // console by only logging once and then giving up.
    if (isVercelServerless()) {
      if (!connectionFailed) {
        console.info("[socket] realtime unavailable on this host — falling back to polling");
        connectionFailed = true;
        socket?.disconnect();
        socket = null;
      }
      return;
    }
    // Dev / self-hosted: log normally so developers can diagnose
    console.warn("[socket] connection error:", err.message);
  });

  socket.on("disconnect", (reason) => {
    console.debug("[socket] disconnected:", reason);
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.off();
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}

export function useSocket(): Socket | null {
  const [sock, setSock] = useState<Socket | null>(socket);

  useEffect(() => {
    setSock(socket);
    if (!socket) return;
    const onConnect = () => setSock(socket);
    const onDisconnect = () => setSock(null);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket?.off("connect", onConnect);
      socket?.off("disconnect", onDisconnect);
    };
  }, []);

  return sock;
}

export function useSocketEvent<T = unknown>(
  event: string,
  handler: (data: T) => void,
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!socket) return;
    const fn = (data: T) => handlerRef.current(data);
    socket.on(event, fn);
    return () => { socket?.off(event, fn); };
  }, [event]);
}
