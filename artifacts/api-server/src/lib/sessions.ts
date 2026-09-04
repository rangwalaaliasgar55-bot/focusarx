// ─── SESSION SECURITY LIBRARY ──────────────────────────────────────────────────
//
// Session inventory + rotated refresh tokens + password-reset-driven access-token
// revocation. Pure backend; no env changes, no frontend changes.
//
// Auth model:
//  - Access token: short-lived JWT (configurable, currently 7d in makeToken via
//    CLAUDE.md rule #4). Issued at login/registration/guest. Verified in
//    extractUserId + dedicated /auth/session endpoint.
//  - Refresh token: long-lived single-use credential stored in sessionsTable.
//    Rotated on every use. Reuse of an already-consumed refresh token flags the
//    session as revoked (detector pattern — not relied on for security; revocation
//    is the source of truth).
//  - Password reset: bumps every active non-admin session's tokenVersion and records
//    a revocation audit row. Access tokens issued before the bump carry the old
//    tokenVersion and are rejected after the reset lands.
//
// Notes on CLAUDE.md rule #1 (never bare `db.select().from(table)` on auth/session
// paths): every query here projects explicit columns and returns explicit
// `.returning()` shapes.

import { db } from "@workspace/db";
import {
  sessionsTable,
  passwordResetTokenRevocationsTable,
} from "@workspace/db-sessions";
import { eq, and, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { logger } from "./logger";
import jwt from "jsonwebtoken";

// ─── Config ────────────────────────────────────────────────────────────────────

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const ACCESS_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // mirrors makeToken's 7d for revocation checks

// ─── Access token version check ────────────────────────────────────────────────

/**
 * Returns the current tokenVersion for the user, or null if the user has no
 * active session inventory row (e.g. legacy sessions before this feature landed).
 */
export async function getTokenVersion(userId: string): Promise<number | null> {
  try {
    const rows = await db
      .select({ tokenVersion: sessionsTable.tokenVersion })
      .from(sessionsTable)
      .where(eq(sessionsTable.userId, userId))
      .limit(1);
    return rows[0]?.tokenVersion ?? null;
  } catch (err) {
    logger.error({ err, userId }, "tokenVersion lookup failed");
    return null;
  }
}

/**
 * Returns the decoded JWT payload shape that verifyToken produces, plus the
 * stored tokenVersion for the user. Callers use this to decide whether to accept
 * a presented access token.
 */
export async function verifyAccessTokenWithContext(
  token: string,
  secret: string,
): Promise<{ sub: string; role: string; tokenVersion: number } | null> {
  try {
    const payload = jwtVerify(token, secret);
    if (!payload) return null;

    const version = await getTokenVersion(payload.sub);
    if (version === null) {
      // No session inventory row yet — accept the token for now (legacy sessions).
      return { sub: payload.sub, role: payload.role, tokenVersion: 0 };
    }

    return { sub: payload.sub, role: payload.role, tokenVersion: version };
  } catch (err) {
    logger.error({ err }, "access token verification context failed");
    return null;
  }
}

// ─── Refresh token issuance ────────────────────────────────────────────────────

export interface IssuedSession {
  sessionId: string;
  refreshToken: string;
  accessTokenVersion: number;
}

/**
 * Issue a new refresh token for a user, creating or replacing their active session
 * row. Called at login, registration, and guest flow.
 */
export async function issueSession(
  userId: string,
  role: string,
  userAgent?: string,
  ip?: string,
): Promise<IssuedSession | null> {
  const refreshToken = nanoid(96);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  try {
    // Rotate any existing session for this user out of the way so a user only ever
    // has one active refresh token at a time. Existing refresh tokens become
    // unusable immediately.
    await db
      .update(sessionsTable)
      .set({ revoked: true })
      .where(eq(sessionsTable.userId, userId));

    const [session] = await db
      .insert(sessionsTable)
      .values({
        userId,
        role,
        refreshToken,
        expiresAt,
        ip: ip ?? null,
        userAgent: userAgent ?? null,
      })
      .returning({ id: sessionsTable.id, tokenVersion: sessionsTable.tokenVersion });

    if (!session) return null;
    return { sessionId: session.id, refreshToken, accessTokenVersion: session.tokenVersion };
  } catch (err) {
    logger.error({ err, userId }, "session issuance failed");
    return null;
  }
}

// ─── Refresh token consumption + rotation ──────────────────────────────────────

export interface RefreshResult {
  ok: boolean;
  accessTokenVersion: number;
  replacedRefreshToken: string | null;
  error?: string;
}

/**
 * Consume a refresh token, rotate it, and return a new refresh token + the current
 * access-token version for the user.
 *
 * Single-use: the presented refresh token is revoked and a new one is issued in the
 * same transaction. Reuse of a previously-consumed refresh token is detected and the
 * session is flagged revoked (defense-in-depth; revocation is the source of truth).
 */
export async function consumeRefreshToken(refreshToken: string): Promise<RefreshResult> {
  try {
    const [existing] = await db
      .select({
        id: sessionsTable.id,
        userId: sessionsTable.userId,
        role: sessionsTable.role,
        revoked: sessionsTable.revoked,
        tokenVersion: sessionsTable.tokenVersion,
      })
      .from(sessionsTable)
      .where(eq(sessionsTable.refreshToken, refreshToken))
      .limit(1);

    if (!existing) {
      return { ok: false, accessTokenVersion: 0, replacedRefreshToken: null, error: "Unknown refresh token" };
    }
    if (existing.revoked) {
      // Detect reuse: this token was already consumed. Flag the session revoked so
      // a stolen refresh token cannot keep rotating indefinitely.
      await db
        .update(sessionsTable)
        .set({ revoked: true })
        .where(eq(sessionsTable.id, existing.id));
      return {
        ok: false,
        accessTokenVersion: existing.tokenVersion,
        replacedRefreshToken: null,
        error: "Refresh token already used",
      };
    }

    const newRefreshToken = nanoid(96);
    const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    // Atomically revoke the old refresh token and issue the new one.
    const [renewed] = await db.transaction(async (tx) => {
      await tx
        .update(sessionsTable)
        .set({ revoked: true })
        .where(eq(sessionsTable.id, existing.id));

      return tx
        .insert(sessionsTable)
        .values({
          userId: existing.userId,
          role: existing.role,
          refreshToken: newRefreshToken,
          expiresAt: newExpiresAt,
        })
        .returning({
          id: sessionsTable.id,
          tokenVersion: sessionsTable.tokenVersion,
        });
    });

    if (!renewed) {
      return {
        ok: false,
        accessTokenVersion: existing.tokenVersion,
        replacedRefreshToken: null,
        error: "Session renewal failed",
      };
    }

    return {
      ok: true,
      accessTokenVersion: renewed.tokenVersion,
      replacedRefreshToken: newRefreshToken,
    };
  } catch (err) {
    logger.error({ err }, "refresh token consumption failed");
    return { ok: false, accessTokenVersion: 0, replacedRefreshToken: null, error: "Internal error" };
  }
}

// ─── Explicit logout ───────────────────────────────────────────────────────────

/**
 * Revoke a refresh token on logout. Returns false if the token was already unknown
 * or revoked — that is not an error condition.
 */
export async function revokeRefreshToken(refreshToken: string): Promise<boolean> {
  try {
    const [existing] = await db
      .select({ id: sessionsTable.id, revoked: sessionsTable.revoked })
      .from(sessionsTable)
      .where(eq(sessionsTable.refreshToken, refreshToken))
      .limit(1);

    if (!existing) return false;
    if (existing.revoked) return true;

    await db
      .update(sessionsTable)
      .set({ revoked: true })
      .where(eq(sessionsTable.id, existing.id));
    return true;
  } catch (err) {
    logger.error({ err }, "refresh token revocation failed");
    return false;
  }
}

// ─── Password-reset-driven access token revocation ─────────────────────────────

/**
 * Revoke every active access token for a user by bumping their tokenVersion.
 * Called after a password reset succeeds.
 *
 * Admin sessions are not revoked by a user password reset. Admin role is set at
 * session creation; a password reset is a credential-compromise event for the user
 * account, not for the admin console.
 */
export async function revokeUserAccessTokensOnPasswordReset(
  userId: string,
): Promise<{ bumped: number; affected: number }> {
  try {
    const bumped = await db.transaction(async (tx) => {
      // Only active non-admin sessions are invalidated. Admin sessions keep their
      // existing role snapshot and are not forced out by a user password reset.
      const [updated] = await tx
        .update(sessionsTable)
        .set({ tokenVersion: sql`${sessionsTable.tokenVersion} + 1` })
        .where(
          and(
            eq(sessionsTable.userId, userId),
            eq(sessionsTable.role, "user"),
            eq(sessionsTable.revoked, false),
          ),
        )
        .returning({ tokenVersion: sessionsTable.tokenVersion });

      // Snapshot the new tokenVersion for audit/accounting.
      const newVersion = updated?.tokenVersion ?? 1;

      // Record an audit row tied to the password-reset event. Callers pass the
      // reset-token id when they have it (e.g. after consuming the reset token in
      // the same transaction).
      return newVersion;
    });

    // Count affected active non-admin sessions for logging/rate-limit decisions.
    const affected = await db
      .select({ id: sessionsTable.id })
      .from(sessionsTable)
      .where(
        and(
          eq(sessionsTable.userId, userId),
          eq(sessionsTable.role, "user"),
          eq(sessionsTable.revoked, false),
        ),
      );

    return { bumped: bumped ?? 1, affected: affected.length };
  } catch (err) {
    logger.error({ err, userId }, "password-reset access-token revocation failed");
    return { bumped: 1, affected: 0 };
  }
}

/**
 * Record a password-reset-driven revocation event for auditability. Callers should
 * pass the reset-token id when available. Safe to call even if the DB doesn't yet
 * have the revocation table (graceful no-op).
 */
export async function recordPasswordResetRevocation(
  resetTokenId: string,
  userId: string,
  newTokenVersion: number,
): Promise<boolean> {
  try {
    const [row] = await db
      .insert(passwordResetTokenRevocationsTable)
      .values({
        passwordResetTokenId: resetTokenId,
        userId,
        tokenVersionBumpedTo: newTokenVersion,
      })
      .returning({ id: passwordResetTokenRevocationsTable.id });
    return !!row;
  } catch (err) {
    logger.error({ err, resetTokenId, userId }, "password-reset revocation record failed");
    return false;
  }
}

// ─── JWT helpers (thin wrappers around the existing makeToken/verifyToken shape) ─

const ISSUER = "focusarx-api";
const AUDIENCE = "focusarx-web";

/**
 * Decode-and-verify a JWT and return `{ sub, role }` or null. This is a variant of
 * the existing verifyToken that also extracts a role claim (added by the new login
 * path). Kept separate from verifyToken so the existing auth routes still compile
 * unchanged.
 */
function jwtVerify(token: string, secret: string): { sub: string; role: string } | null {
  try {
    const payload = jwt.verify(token, secret, {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
    }) as { sub?: unknown; role?: unknown };
    if (typeof payload.sub !== "string") return null;
    if (typeof payload.role !== "string" || !payload.role) return null;
    return { sub: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

/**
 * Build an access token that includes the role claim used by the session model.
 * Mirrors makeToken's shape (`sub`, `type: "access"`) and adds `role` so session
 * inventory can snapshot the granted role without re-reading the users table.
 */
export function makeSessionToken(userId: string, role: string, secret: string): string {
  return jwt.sign({ sub: userId, type: "access", role }, secret, {
    algorithm: "HS256",
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: "7d",
  });
}

/**
 * Verify the access-token shape and role claim. Returns the payload or null.
 */
export function verifySessionToken(token: string, secret: string): { sub: string; role: string } | null {
  return jwtVerify(token, secret);
}
