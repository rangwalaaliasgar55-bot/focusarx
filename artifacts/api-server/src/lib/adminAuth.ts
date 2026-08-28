import jwt from "jsonwebtoken";
import type { NextFunction, Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getServerConfig } from "./config";
import { logger } from "./logger";
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
  } catch (err) {
    // Fail closed, but never silently — a DB outage must not look like a
    // mere "not an admin" in the logs.
    logger.error({ err }, "admin auth DB check failed");
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
  } catch (err) {
    logger.error({ err }, "admin identity DB check failed");
  }
  return { isAdmin: false, method: "none" };
}

/**
 * Express middleware form of the admin check.
 *
 * IMPORTANT: `checkAdminAuth` above is a *predicate* (returns `Promise<boolean>`)
 * and must be awaited inside a handler. Passing it straight into a route as
 * middleware hangs the request forever — Express treats it as
 * `(req, res, next)` because of its arity, calls it, and the returned promise
 * is discarded without `next()` ever running. Always mount this instead.
 */
export async function requireAdmin(
  req: { headers: { cookie?: string; authorization?: string } },
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (await checkAdminAuth(req)) {
      next();
      return;
    }
  } catch {
    // fall through to 403 — never leak internals
  }
  res.status(403).json({ error: "Admin access required" });
}
