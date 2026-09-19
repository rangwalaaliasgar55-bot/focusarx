/**
 * §1.6 — encryption for third-party tokens and webhook signing secrets.
 *
 * AES-256-GCM, one key from the environment. Two properties are non-negotiable
 * and are why this is a module rather than three lines in the route file:
 *
 * **A stored token must not be readable from the database alone.** Outbound
 * webhook secrets and OAuth refresh tokens are durable credentials. A plaintext
 * webhook secret in a leaked backup lets an attacker forge deliveries *into the
 * user's own endpoint* and pass the signature check the user relies on; a
 * plaintext refresh token is long-lived access to their calendar and is never
 * rotated by the user. Encrypting at rest means a database read alone is not
 * enough — the attacker also needs the key, which lives only in the process
 * environment.
 *
 * **Failure is loud, not silent.** When no key is configured, `encryptSecret`
 * throws `SecretsNotConfiguredError` and every caller turns it into a 503 with
 * a stable code, exactly like the Stripe layer. The tempting alternative —
 * falling back to a hard-coded default or to base64 — produces something that
 * *looks* encrypted in the table and is not, which is worse than an obvious
 * outage because nobody ever finds out.
 *
 * Ciphertext format, all base64url joined by ".":
 *
 *     v1.<iv:12 bytes>.<authTag:16 bytes>.<ciphertext>
 *
 * The version prefix exists so a future key or algorithm change is a decrypt
 * branch rather than a migration that has to guess what it is looking at. The
 * IV is 12 bytes because that is GCM's native size; a longer IV is hashed down
 * by some libraries and silently weakens the construction.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const VERSION = "v1";

/** Thrown when a secret operation is attempted with no key configured. */
export class SecretsNotConfiguredError extends Error {
  readonly code = "SECRETS_NOT_CONFIGURED";
  constructor() {
    super("INTEGRATION_ENCRYPTION_KEY is not set");
    this.name = "SecretsNotConfiguredError";
  }
}

export class SecretDecryptionError extends Error {
  readonly code = "SECRET_DECRYPTION_FAILED";
  constructor(reason: string) {
    super(`Could not decrypt secret: ${reason}`);
    this.name = "SecretDecryptionError";
  }
}

export function secretsConfigured(): boolean {
  return Boolean(process.env.INTEGRATION_ENCRYPTION_KEY);
}

/**
 * Derive the 32-byte key.
 *
 * `sha256` of the configured value rather than using it raw, so the operator
 * can paste a passphrase of any length and get a correct-length key. This is
 * *not* a password-stretching function and is not meant to be: the input is a
 * server-side env var, not a user-chosen password, so there is no dictionary
 * attacker to slow down — only someone who already has the environment, who by
 * then has the key regardless.
 */
function keyBytes(): Buffer {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!raw) throw new SecretsNotConfiguredError();
  return createHash("sha256").update(raw, "utf8").digest();
}

/**
 * Encrypt a secret for storage.
 *
 * A fresh random IV per call. Reusing an IV with the same key in GCM is
 * catastrophic — it leaks the XOR of two plaintexts and, worse, allows
 * forgery of the authentication tag — so the IV is generated here and never
 * accepted from a caller.
 */
export function encryptSecret(plaintext: string, keyOverride?: Buffer): string {
  const key = keyOverride ?? keyBytes();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

/**
 * Decrypt a stored secret.
 *
 * Throws rather than returning null or an empty string. A caller that gets an
 * empty string back would sign with an empty key and send deliveries the
 * receiver rejects for reasons nobody can see; a thrown error names the actual
 * problem. GCM's tag check is what makes the tampering detectable — a modified
 * ciphertext fails here instead of decrypting to garbage that we would then
 * send to a third party.
 */
export function decryptSecret(stored: string, keyOverride?: Buffer): string {
  const key = keyOverride ?? keyBytes();
  const parts = stored.split(".");
  if (parts.length !== 4) throw new SecretDecryptionError("malformed ciphertext");
  const [version, ivPart, tagPart, dataPart] = parts;
  if (version !== VERSION) throw new SecretDecryptionError(`unsupported version ${String(version)}`);
  let iv: Buffer;
  let tag: Buffer;
  let data: Buffer;
  try {
    iv = Buffer.from(ivPart!, "base64url");
    tag = Buffer.from(tagPart!, "base64url");
    data = Buffer.from(dataPart!, "base64url");
  } catch {
    throw new SecretDecryptionError("malformed ciphertext encoding");
  }
  if (iv.length !== IV_BYTES) throw new SecretDecryptionError("bad IV length");
  if (tag.length !== TAG_BYTES) throw new SecretDecryptionError("bad auth tag length");
  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    // Deliberately not re-throwing the underlying error: Node's message for a
    // tag mismatch is stable, but a decryption failure must never be reported
    // in a way that distinguishes "wrong key" from "tampered ciphertext".
    throw new SecretDecryptionError("authentication failed");
  }
}

/** Non-secret prefix of a secret, for display in a UI list. */
export function secretHint(secret: string): string {
  return secret.slice(0, 8);
}

/**
 * Generate a signing secret. 32 bytes of randomness, base64url so it survives
 * a copy-paste through a dashboard or a `.env` file without escaping.
 */
export function generateSecret(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Constant-time string comparison.
 *
 * Kept here next to the crypto rather than re-implemented per caller, because
 * the version that gets written inline is `a === b`, which leaks the secret a
 * byte at a time through timing. Used for verifying inbound webhook signatures
 * from providers we call.
 */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
