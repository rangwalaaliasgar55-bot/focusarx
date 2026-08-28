/**
 * Refresh-token lifecycle — rotation with reuse detection.
 *
 * Design (standard "refresh token family" model):
 *  - Tokens are opaque 48-byte random values; only their SHA-256 hash is
 *    stored, so a DB leak does not leak usable session credentials.
 *  - Login creates a family; every refresh rotates: the presented token is
 *    atomically marked revoked+replaced and a sibling is issued.
 *  - Presenting a token that is already revoked (or losing the rotate race,
 *    which means two parties hold the same token) revokes the entire family —
 *    the theft/replay signature — forcing re-authentication everywhere.
 *
 * Migration note: refresh cookies issued before this store existed are legacy
 * JWTs. They remain verifiable for at most their 7-day lifetime, and are
 * exchanged for a DB-backed family on first use (a stateless token cannot be
 * revoked, which is exactly why the store exists).
 */
import { createHash, randomBytes } from "node:crypto";
import { db, refreshTokensTable } from "@workspace/db";
import { and, desc, eq, isNull, lt } from "drizzle-orm";
import { logger } from "./logger";

export const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface RefreshTokenMeta {
  userAgent?: string | null;
  ip?: string | null;
}

export type RotateResult =
  | { status: "ok"; token: string; expiresAt: Date; familyId: string; userId: string }
  | { status: "reused" | "expired" | "unknown" };

/**
 * Grace window for replays of a just-rotated token (multi-tab clients, retried
 * requests whose response was lost). Within 30s of rotation the replay is
 * treated as benign: we rotate from the family's current member instead of
 * burning everything. After 30s, replay = theft signature → family revoked.
 */
const ROTATION_GRACE_MS = 30_000;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateRefreshTokenValue(): string {
  return randomBytes(48).toString("base64url");
}

function truncate(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  return value.slice(0, max);
}

/** Create a brand-new token family (login / guest sign-in). */
export async function createRefreshFamily(
  userId: string,
  meta: RefreshTokenMeta = {},
): Promise<{ token: string; expiresAt: Date; familyId: string }> {
  const token = generateRefreshTokenValue();
  const familyId = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

  await db.insert(refreshTokensTable).values({
    userId,
    tokenHash: hashToken(token),
    familyId,
    expiresAt,
    userAgent: truncate(meta.userAgent, 200),
    ip: truncate(meta.ip, 64),
  });

  // Housekeeping: drop this user's expired rows. Revoked-but-unexpired rows
  // are kept — they are exactly what makes reuse detection work.
  const now = new Date();
  try {
    await db.delete(refreshTokensTable).where(and(
      eq(refreshTokensTable.userId, userId),
      lt(refreshTokensTable.expiresAt, now),
    ));
  } catch (err) {
    logger.warn({ err }, "refresh token housekeeping failed (non-fatal)");
  }

  return { token, expiresAt, familyId };
}

/**
 * Rotate the presented token. Atomic via a conditional UPDATE: if a concurrent
 * request already revoked it, the winner loses the race and the family is
 * treated as compromised.
 */
export async function rotateRefreshToken(
  presentedToken: string,
  meta: RefreshTokenMeta = {},
): Promise<RotateResult> {
  const tokenHash = hashToken(presentedToken);
  const now = new Date();

  const [row] = await db.select().from(refreshTokensTable).where(eq(refreshTokensTable.tokenHash, tokenHash)).limit(1);
  if (!row) return { status: "unknown" };
  if (row.expiresAt.getTime() <= now.getTime()) return { status: "expired" };

  if (!row.revokedAt) {
    const result = await rotateFromRow(row, meta, now);
    if (result) return result;
    // Lost the atomic rotate race → someone else used this token concurrently.
  } else {
    // Token already rotated. Benign within the grace window (multi-tab /
    // network retry): rotate from the family's current member, if one exists.
    if (now.getTime() - row.revokedAt.getTime() <= ROTATION_GRACE_MS) {
      const [sibling] = await db.select().from(refreshTokensTable)
        .where(and(
          eq(refreshTokensTable.familyId, row.familyId),
          isNull(refreshTokensTable.revokedAt),
        ))
        .orderBy(desc(refreshTokensTable.createdAt))
        .limit(1);
      if (sibling && sibling.expiresAt.getTime() > now.getTime()) {
        const result = await rotateFromRow(sibling, meta, now);
        if (result) return result;
      }
    } else {
      logger.warn({ userId: row.userId, familyId: row.familyId }, "refresh token replay outside grace window — family revoked");
    }
  }

  // Theft signature (late replay or lost race): burn the whole family.
  await db.update(refreshTokensTable)
    .set({ revokedAt: now })
    .where(and(eq(refreshTokensTable.familyId, row.familyId), isNull(refreshTokensTable.revokedAt)));
  logger.warn({ userId: row.userId, familyId: row.familyId }, "refresh token reuse detected — family revoked");
  return { status: "reused" };
}

/** Atomically rotate one family member. Returns null when the rotate race was lost. */
async function rotateFromRow(
  row: { id: string; userId: string; familyId: string },
  meta: RefreshTokenMeta,
  now: Date,
): Promise<Extract<RotateResult, { status: "ok" }> | null> {
  const nextToken = generateRefreshTokenValue();
  const nextHash = hashToken(nextToken);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

  const rotated = await db.update(refreshTokensTable)
    .set({ revokedAt: now, replacedByTokenHash: nextHash })
    .where(and(eq(refreshTokensTable.id, row.id), isNull(refreshTokensTable.revokedAt)))
    .returning({ id: refreshTokensTable.id });

  if (rotated.length === 0) return null;

  await db.insert(refreshTokensTable).values({
    userId: row.userId,
    tokenHash: nextHash,
    familyId: row.familyId,
    expiresAt,
    userAgent: truncate(meta.userAgent, 200),
    ip: truncate(meta.ip, 64),
  });

  return { status: "ok", token: nextToken, expiresAt, familyId: row.familyId, userId: row.userId };
}

/** Revoke the presented token (logout). No-op when unknown. */
export async function revokeRefreshToken(presentedToken: string): Promise<void> {
  const tokenHash = hashToken(presentedToken);
  await db.update(refreshTokensTable)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokensTable.tokenHash, tokenHash), isNull(refreshTokensTable.revokedAt)));
}
