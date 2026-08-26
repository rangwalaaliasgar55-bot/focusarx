import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getServerConfig } from "./config";
import { extractUserId } from "../routes/auth";

export const ADMIN_COOKIE = "focusarx_admin";

function getJwtSecret(): string {
  const secret = getServerConfig().jwtSecret;
  if (!secret) throw new Error("AUTH_SECRET is not configured");
  return secret;
}

function isAdminAuthed(req: { headers: { cookie?: string } }): boolean {
  const cookieHeader = req.headers.cookie ?? "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE}=([^;]+)`));
  const token = match?.[1];
  if (!token) return false;
  try {
    const payload = jwt.verify(token, getJwtSecret(), {
      algorithms: ["HS256"],
      issuer: "focusarx-api",
      audience: "focusarx-admin",
    }) as { role?: string };
    return payload?.role === "admin_session";
  } catch {
    return false;
  }
}

export async function checkAdminAuth(req: {
  headers: { cookie?: string; authorization?: string };
}): Promise<boolean> {
  if (isAdminAuthed(req)) return true;
  const userId = extractUserId(req);
  if (!userId) return false;
  try {
    const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId));
    return user?.role?.toLowerCase() === "admin";
  } catch {
    return false;
  }
}

export async function getAdminIdentity(req: {
  headers: { cookie?: string; authorization?: string };
}): Promise<{ isAdmin: boolean; userId?: string; method: "cookie" | "role" | "none" }> {
  if (isAdminAuthed(req)) {
    return { isAdmin: true, method: "cookie" };
  }
  const userId = extractUserId(req);
  if (!userId) return { isAdmin: false, method: "none" };
  try {
    const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId));
    if (user?.role?.toLowerCase() === "admin") {
      return { isAdmin: true, userId, method: "role" };
    }
  } catch {
    // ignore
  }
  return { isAdmin: false, method: "none" };
}
