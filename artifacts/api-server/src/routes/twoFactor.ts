/**
 * §1.2 — TOTP two-factor authentication routes.
 *
 * Mounted directly after the auth router (see routes/index.ts) so the
 * endpoints live under /api/auth/2fa/* and inherit auth.ts's no-store
 * middleware semantics. Every route that touches secrets requires a real
 * session; the one exception (MFA sign-in completion) is deliberately NOT
 * here — it lives in auth.ts next to /auth/login, because it is the second
 * half of that endpoint's contract, not an account-management operation.
 *
 * Endpoints:
 *
 *   GET   /auth/2fa/status              — { enabled, backupCodesRemaining }
 *   POST  /auth/2fa/register            — start enrolment: QR + otpauth URI
 *   POST  /auth/2fa/register/confirm    — verify first code, activate, get backup codes
 *   POST  /auth/2fa/disable             — password + code, turn the factor off
 *   POST  /auth/2fa/backup-codes        — regenerate the single-use codes
 *
 * Enrolment is two-phase on purpose: /register stores the secret in the
 * *pending* column and nothing about the account changes until /confirm
 * verifies a code produced by that pending secret. A user who bails halfway
 * is untouched; a user who confirms is protected from that exact moment.
 */

import { Router, type Response } from "express";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { z } from "zod";
import { db, usersTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { sendUnauthorized, sendServiceUnavailable } from "../lib/httpErrors";
import { authLimiter } from "../lib/rateLimiter";
import { isDependencyFailure } from "./auth";
import {
  createTotpFactor,
  encryptTotpSecret,
  decryptTotpSecret,
  verifyTotpCode,
  TwoFactorNotConfiguredError,
  SecretDecryptionError,
  generateBackupCodes,
  matchBackupCode,
} from "../lib/twoFactor";
import { verifyPassword } from "../lib/passwordHashing";

const router = Router();

const codeField = z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator");

function sendConfigError(res: Response): void {
  res.status(503).json({
    error: {
      code: "CONFIG_ERROR",
      message: "Two-factor authentication is not configured on this deployment",
      hint: "Set INTEGRATION_ENCRYPTION_KEY (32+ characters) in the server environment",
    },
  });
}

/** The fields the 2FA routes need; deliberately narrow, never the password hash. */
function factorSelection() {
  return {
    id: usersTable.id,
    email: usersTable.email,
    isGuest: usersTable.isGuest,
    twoFactorEnabled: usersTable.twoFactorEnabled,
    twoFactorSecretEnc: usersTable.twoFactorSecretEnc,
    twoFactorPendingSecretEnc: usersTable.twoFactorPendingSecretEnc,
    twoFactorBackupCodesHash: usersTable.twoFactorBackupCodesHash,
  };
}

type FactorRow = {
  id: string;
  email: string;
  isGuest: boolean;
  twoFactorEnabled: boolean;
  twoFactorSecretEnc: string | null;
  twoFactorPendingSecretEnc: string | null;
  twoFactorBackupCodesHash: string | null;
};

async function loadFactor(userId: string): Promise<FactorRow | null> {
  const [row] = await db.select(factorSelection()).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return row ?? null;
}

function parseBackupHashes(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

router.get("/auth/2fa/status", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const row = await loadFactor(req.userId);
    if (!row) {
      sendUnauthorized(res, "User not found");
      return;
    }
    // An enrolment that is pending (secret stored, never confirmed) is real
    // state the UI must show — the QR the user scanned may still be sitting
    // in their authenticator, and re-registering simply replaces it.
    res.json({
      enabled: row.twoFactorEnabled,
      enrolmentPending: Boolean(row.twoFactorPendingSecretEnc) && !row.twoFactorEnabled,
      backupCodesRemaining: row.twoFactorEnabled ? parseBackupHashes(row.twoFactorBackupCodesHash).length : 0,
    });
  } catch (err) {
    logger.error({ err }, "2fa status error");
    if (isDependencyFailure(err)) {
      sendServiceUnavailable(res, "FocusArx is temporarily unavailable.");
      return;
    }
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal error" } });
  }
});

router.post("/auth/2fa/register", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const row = await loadFactor(req.userId);
    if (!row) {
      sendUnauthorized(res, "User not found");
      return;
    }
    if (row.isGuest) {
      res.status(400).json({ error: { code: "GUEST_ACCOUNT", message: "Guest accounts cannot enable two-factor authentication" } });
      return;
    }
    if (row.twoFactorEnabled) {
      res.status(409).json({ error: { code: "ALREADY_ENABLED", message: "Two-factor authentication is already enabled" } });
      return;
    }
    const { secret, otpauthUri } = createTotpFactor(row.email);
    // Storing the pending secret is what makes /confirm meaningful: the code
    // the user types must come from *this* secret, not from any secret.
    await db.update(usersTable)
      .set({ twoFactorPendingSecretEnc: encryptTotpSecret(secret) })
      .where(eq(usersTable.id, row.id));
    const qrDataUrl = await QRCode.toDataURL(otpauthUri, { margin: 1, width: 220 });
    res.json({ otpauthUri, qrDataUrl, message: "Scan with your authenticator app, then confirm with a code." });
  } catch (err) {
    if (err instanceof TwoFactorNotConfiguredError) {
      sendConfigError(res);
      return;
    }
    logger.error({ err }, "2fa register error");
    if (isDependencyFailure(err)) {
      sendServiceUnavailable(res, "FocusArx is temporarily unavailable.");
      return;
    }
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal error" } });
  }
});

const confirmSchema = z.object({ code: codeField });

router.post("/auth/2fa/register/confirm", authLimiter, authMiddleware, async (req: AuthRequest, res: Response) => {
  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Enter the 6-digit code from your authenticator" } });
    return;
  }
  try {
    const row = await loadFactor(req.userId);
    if (!row) {
      sendUnauthorized(res, "User not found");
      return;
    }
    if (row.twoFactorEnabled) {
      res.status(409).json({ error: { code: "ALREADY_ENABLED", message: "Two-factor authentication is already enabled" } });
      return;
    }
    if (!row.twoFactorPendingSecretEnc) {
      res.status(400).json({ error: { code: "NO_PENDING_ENROLMENT", message: "Start enrolment first" } });
      return;
    }
    let secret: string;
    try {
      secret = decryptTotpSecret(row.twoFactorPendingSecretEnc);
    } catch (decErr) {
      // Tampered/undecryptable pending secret: clear it and make the user
      // start over. Silently proceeding would verify against nothing.
      logger.warn({ err: decErr, userId: row.id }, "2fa pending secret decryption failed — enrolment reset");
      await db.update(usersTable).set({ twoFactorPendingSecretEnc: null }).where(eq(usersTable.id, row.id));
      res.status(400).json({ error: { code: "NO_PENDING_ENROLMENT", message: "Enrolment expired — start again" } });
      return;
    }
    if (!verifyTotpCode(secret, row.email, parsed.data.code)) {
      res.status(401).json({ error: { code: "INVALID_CODE", message: "That code is not valid — check your authenticator and try again" } });
      return;
    }
    // The promotion is the atomic moment 2FA turns on: live secret set,
    // pending cleared, backup codes issued, enabled flipped. All or nothing —
    // a partial write here could enable the factor with no secret to verify.
    const backup = generateBackupCodes();
    await db.update(usersTable)
      .set({
        twoFactorSecretEnc: row.twoFactorPendingSecretEnc,
        twoFactorPendingSecretEnc: null,
        twoFactorBackupCodesHash: JSON.stringify(backup.hashed),
        twoFactorEnabled: true,
      })
      .where(eq(usersTable.id, row.id));
    logger.info({ userId: row.id }, "two-factor authentication enabled");
    // The only response that ever carries backup-code plaintexts.
    res.json({ ok: true, enabled: true, backupCodes: backup.plaintext });
  } catch (err) {
    if (err instanceof TwoFactorNotConfiguredError) {
      sendConfigError(res);
      return;
    }
    logger.error({ err }, "2fa confirm error");
    if (isDependencyFailure(err)) {
      sendServiceUnavailable(res, "FocusArx is temporarily unavailable. Enrolment was not completed — please try again.");
      return;
    }
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal error" } });
  }
});

const disableSchema = z.object({
  password: z.string().min(1).max(256),
  code: z.string().min(6).max(20),
});

router.post("/auth/2fa/disable", authLimiter, authMiddleware, async (req: AuthRequest, res: Response) => {
  const parsed = disableSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Your password and a current code are required" } });
    return;
  }
  try {
    const [row] = await db.select({
      id: usersTable.id,
      email: usersTable.email,
      hashedPassword: usersTable.hashedPassword,
      twoFactorEnabled: usersTable.twoFactorEnabled,
      twoFactorSecretEnc: usersTable.twoFactorSecretEnc,
      twoFactorBackupCodesHash: usersTable.twoFactorBackupCodesHash,
    }).from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
    if (!row) {
      sendUnauthorized(res, "User not found");
      return;
    }
    if (!row.twoFactorEnabled || !row.twoFactorSecretEnc) {
      res.status(409).json({ error: { code: "NOT_ENABLED", message: "Two-factor authentication is not enabled" } });
      return;
    }
    const verification = row.hashedPassword
      ? await verifyPassword(parsed.data.password, row.hashedPassword)
      : { valid: false, needsRehash: false, algorithm: "unknown" as const };
    if (!verification.valid) {
      res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Password confirmation failed" } });
      return;
    }
    // Disabling is a downgrade of account security, so it demands *both*
    // factors: password (something you know) plus a current code or backup
    // code (something you have). A stolen password alone must not suffice.
    const backupHashes = parseBackupHashes(row.twoFactorBackupCodesHash);
    let codeOk = false;
    try {
      const secret = decryptTotpSecret(row.twoFactorSecretEnc);
      codeOk = verifyTotpCode(secret, row.email, parsed.data.code);
    } catch {
      // Live secret undecryptable (key rotated or lost): the factor can no
      // longer verify codes — but it also cannot produce them, so a backup
      // code is the recovery path. If the user has none left, disabling is
      // refused: password-only disable would make 2FA decorative.
    }
    const backupIdx = codeOk ? -1 : matchBackupCode(parsed.data.code, backupHashes);
    if (!codeOk && backupIdx < 0) {
      res.status(401).json({ error: { code: "INVALID_CODE", message: "That code is not valid" } });
      return;
    }
    const remaining = backupHashes.slice();
    if (backupIdx >= 0) remaining.splice(backupIdx, 1);
    await db.update(usersTable)
      .set({
        twoFactorEnabled: false,
        twoFactorSecretEnc: null,
        twoFactorPendingSecretEnc: null,
        twoFactorBackupCodesHash: remaining.length > 0 ? JSON.stringify(remaining) : null,
      })
      .where(eq(usersTable.id, row.id));
    logger.info({ userId: row.id }, "two-factor authentication disabled");
    res.json({ ok: true, enabled: false });
  } catch (err) {
    logger.error({ err }, "2fa disable error");
    if (isDependencyFailure(err)) {
      sendServiceUnavailable(res, "FocusArx is temporarily unavailable.");
      return;
    }
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal error" } });
  }
});

const regenerateSchema = z.object({ code: codeField });

router.post("/auth/2fa/backup-codes", authLimiter, authMiddleware, async (req: AuthRequest, res: Response) => {
  const parsed = regenerateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Enter the 6-digit code from your authenticator" } });
    return;
  }
  try {
    const row = await loadFactor(req.userId);
    if (!row) {
      sendUnauthorized(res, "User not found");
      return;
    }
    if (!row.twoFactorEnabled || !row.twoFactorSecretEnc) {
      res.status(409).json({ error: { code: "NOT_ENABLED", message: "Enable two-factor authentication first" } });
      return;
    }
    const secret = decryptTotpSecret(row.twoFactorSecretEnc);
    if (!verifyTotpCode(secret, row.email, parsed.data.code)) {
      res.status(401).json({ error: { code: "INVALID_CODE", message: "That code is not valid" } });
      return;
    }
    const backup = generateBackupCodes();
    await db.update(usersTable)
      .set({ twoFactorBackupCodesHash: JSON.stringify(backup.hashed) })
      .where(eq(usersTable.id, row.id));
    logger.info({ userId: row.id }, "backup codes regenerated");
    res.json({ ok: true, backupCodes: backup.plaintext });
  } catch (err) {
    if (err instanceof TwoFactorNotConfiguredError || err instanceof SecretDecryptionError) {
      sendConfigError(res);
      return;
    }
    logger.error({ err }, "2fa backup-codes error");
    if (isDependencyFailure(err)) {
      sendServiceUnavailable(res, "FocusArx is temporarily unavailable.");
      return;
    }
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal error" } });
  }
});

export { router as twoFactorRouter };
