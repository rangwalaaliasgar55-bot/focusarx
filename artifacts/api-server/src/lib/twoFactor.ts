/**
 * §1.2 — TOTP two-factor authentication.
 *
 * Standard RFC 6238 codes over the Authenticator ecosystem's de-facto
 * defaults (SHA-1, 6 digits, 30 s period) — every authenticator app supports
 * exactly this, and choosing "better" parameters (SHA-256, 8 digits) is how
 * you get users whose app silently shows codes the server rejects.
 *
 * The lifecycle is deliberately two-phase:
 *
 *   1. POST /auth/2fa/register   → secret generated, encrypted, held in a
 *                                  *pending* column; QR + otpauth URI returned
 *   2. POST /auth/2fa/register/confirm → user's first code verified, secret
 *                                  promoted to the live column, backup codes
 *                                  issued once
 *
 * The pending column is what stops the footgun where a user starts enrolment,
 * abandons it halfway, and is then locked out of their own account by a
 * factor that was never confirmed. 2FA is only ever "on" after a code that
 * the live secret produced has been verified.
 *
 * The secret is encrypted at rest with the same AES-256-GCM key as OAuth
 * refresh tokens (lib/secrets.ts): a TOTP secret *is* a bearer credential —
 * anyone who reads it can generate codes forever. No `INTEGRATION_ENCRYPTION_KEY`,
 * no 2FA enrolment, answered as a 503 up front rather than a failure at the
 * last step.
 */

import { createHash, randomInt } from "node:crypto";
import { Secret, TOTP } from "otpauth";
import { encryptSecret, decryptSecret, SecretDecryptionError } from "./secrets";

const TOTP_ISSUER = "FocusArx";
/** ±1 period of clock drift is tolerated; 2+ would need a deliberate attack. */
const TOTP_WINDOW = 1;

/** Backup codes: 8 single-use codes, each 10 digits of entropy. */
export const BACKUP_CODE_COUNT = 8;

export class TwoFactorNotConfiguredError extends Error {
  readonly code = "CONFIG_ERROR";
  constructor() {
    super("INTEGRATION_ENCRYPTION_KEY is not set — two-factor enrolment is unavailable");
    this.name = "TwoFactorNotConfiguredError";
  }
}

/** The decoded form of what the encrypted columns hold. */
export interface DecodedFactor {
  secret: string;
}

/** Generate a fresh TOTP factor and its otpauth:// provisioning URI. */
export function createTotpFactor(email: string): { secret: string; otpauthUri: string } {
  const secret = new Secret({ size: 20 });
  const totp = new TOTP({
    issuer: TOTP_ISSUER,
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret,
  });
  return { secret: secret.base32, otpauthUri: totp.toString() };
}

/** Build the TOTP instance for a stored (base32) secret. */
function totpFor(secret: string, email: string): TOTP {
  return new TOTP({
    issuer: TOTP_ISSUER,
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secret),
  });
}

/**
 * Verify a 6-digit code against a stored secret.
 *
 * `window: 1` tolerates one period of drift in either direction — a phone
 * clock a few seconds slow must not cost a login. Codes are consumed by time,
 * not by counter, so no replay table is needed: a code stops working when its
 * 30-second window (± 1) passes.
 */
export function verifyTotpCode(secretBase32: string, email: string, token: string): boolean {
  const normalized = token.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  try {
    const totp = totpFor(secretBase32, email);
    return totp.validate({ token: normalized, window: TOTP_WINDOW }) !== null;
  } catch {
    return false;
  }
}

/** Encrypt a base32 secret for the database. Throws without the key. */
export function encryptTotpSecret(secretBase32: string): string {
  if (!process.env.INTEGRATION_ENCRYPTION_KEY) throw new TwoFactorNotConfiguredError();
  return encryptSecret(secretBase32);
}

/** Decrypt a stored secret. Throws SecretDecryptionError on tamper/bad key. */
export function decryptTotpSecret(encrypted: string): string {
  return decryptSecret(encrypted);
}

export { SecretDecryptionError };

/**
 * Generate a batch of single-use backup codes.
 *
 * Ten digits ≈ 33 bits of entropy per code, printed in groups of five so a
 * human can transcribe them. Delivered exactly once — the response of the
 * call that created them is the only place the plaintexts ever appear.
 */
export function generateBackupCodes(): { plaintext: string[]; hashed: string[] } {
  const plaintext: string[] = [];
  const hashed: string[] = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i += 1) {
    // randomInt, not Math.random: this is a credential.
    const code = `${randomInt(0, 100000).toString().padStart(5, "0")}-${randomInt(0, 100000).toString().padStart(5, "0")}`;
    plaintext.push(code);
    hashed.push(hashBackupCode(code));
  }
  return { plaintext, hashed };
}

/**
 * SHA-256 of a backup code, normalised so a user typing it with or without
 * the dash lands on the same digest. Codes are high-entropy random values —
 * unlike passwords, a fast hash is the *right* hash here: there is nothing to
 * brute-force slowly, and the digest protects only against a database leak
 * revealing reusable codes.
 */
export function hashBackupCode(code: string): string {
  return createHash("sha256").update(code.replace(/[\s-]/g, "").toLowerCase(), "utf8").digest("hex");
}

/**
 * Check a presented backup code against the stored digest list.
 *
 * Returns the index of the matching entry (so the caller can consume it) or
 * -1. Linear over at most 8 entries — there is nothing to optimise and no
 * timing signal worth leaking on a value that is single-use anyway.
 */
export function matchBackupCode(presented: string, storedHashes: string[]): number {
  if (!presented) return -1;
  const digest = hashBackupCode(presented);
  for (let i = 0; i < storedHashes.length; i += 1) {
    if (storedHashes[i] === digest) return i;
  }
  return -1;
}

/**
 * Generate a challenge JWT body for the two-step sign-in. The route signs it;
 * this function only exists so the shape lives next to its verifier's docs.
 *
 * It is a *proof the password step passed*, not a credential: it cannot read
 * sessions, it expires in five minutes, and it is single-purpose (type: "mfa").
 */
export const MFA_CHALLENGE_TTL_SECONDS = 5 * 60;
