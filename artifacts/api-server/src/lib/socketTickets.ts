/**
 * Short-lived, single-purpose socket tickets.
 *
 * The Socket.IO handshake previously carried the same 7-day bearer JWT the
 * SPA keeps in localStorage — a stolen socket log (or proxy) yielded a fully
 * reusable session credential. Tickets instead:
 *   - live 60 seconds,
 *   - are audience-pinned to "focusarx-socket" (useless to HTTP routes),
 *   - carry type "socket_ticket" (rejected by extractUserId's access check).
 * The legacy `auth.token` handshake path stays as a fallback for old clients.
 */
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";

export const SOCKET_TICKET_TTL_SEC = 60;
const ISSUER = "focusarx-api";
const AUDIENCE = "focusarx-socket";

export function issueSocketTicket(userId: string, secret: string): { ticket: string; expiresInSeconds: number } {
  const ticket = jwt.sign(
    { sub: userId, type: "socket_ticket", jti: randomUUID() },
    secret,
    {
      algorithm: "HS256",
      issuer: ISSUER,
      audience: AUDIENCE,
      expiresIn: SOCKET_TICKET_TTL_SEC,
    },
  );
  return { ticket, expiresInSeconds: SOCKET_TICKET_TTL_SEC };
}

export function verifySocketTicket(token: string, secret: string): { sub: string } | null {
  try {
    const payload = jwt.verify(token, secret, {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
    }) as { sub?: unknown; type?: unknown };
    if (typeof payload.sub !== "string" || payload.type !== "socket_ticket") return null;
    return { sub: payload.sub };
  } catch {
    return null;
  }
}
