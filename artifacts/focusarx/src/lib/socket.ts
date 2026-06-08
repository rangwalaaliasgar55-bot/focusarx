import { io as ioClient, Socket } from "socket.io-client";
import { useEffect, useRef, useState } from "react";

let socket: Socket | null = null;

export function connectSocket(token: string) {
  if (socket?.connected) return socket;
  socket = ioClient(window.location.origin, {
    path: "/socket.io/",
    auth: { token },
    transports: ["websocket", "polling"],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });
  return socket;
}

export function disconnectSocket() {
  if (socket) {
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
