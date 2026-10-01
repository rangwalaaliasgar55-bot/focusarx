/**
 * §1.1 — password hashing.
 *
 * Argon2id is the OWASP-recommended password hash, and this module moves every
 * password FocusArx stores onto it while keeping every existing login working.
 *
 * Why not flip a flag and rehash the world? Because a password hash can only
 * be recomputed when the plaintext is available, and FocusArx correctly never
 * stores plaintexts. The only moment the plaintext exists is the moment the
 * user proves it — sign-in, password change, password reset — so the migration
 * has to be *opportunistic*: verify against whatever the row already holds,
 * and if that verification succeeded against an older scheme, upgrade the row
 * right then. Every untouched account keeps its bcrypt hash until its owner
 * next signs in; every password written from today is Argon2id from the start.
 *
 * Parameters are the OWASP Password Storage Cheat Sheet baseline (m=19456
 * KiB i.e. 19 MiB, t=2, p=1): the first row of the table, not a personal
 * tuning exercise, so the next person who reads this does not have to trust
 * that the numbers were chosen deliberately — they can look them up.
 *
 * hash-wasm rather than a native binding (argon2, node-argon2) so a `pnpm
 * install` never needs a compiler toolchain: the api-server builds in
 * serverless and CI images where "works after apt-get install build-essential"
 * is not a thing anyone wants to debug again.
 */

import { randomBytes } from "node:crypto";
import { argon2id, argon2Verify, bcryptVerify } from "hash-wasm";

/** OWASP baseline: 19 MiB memory, 2 iterations, 1 lane. */
const ARGON2_PARALLELISM = 1;
const ARGON2_ITERATIONS = 2;
const ARGON2_MEMORY_KIB = 19456;
const ARGON2_SALT_BYTES = 16;
const ARGON2_HASH_BYTES = 32;

/** The scheme identifier prefix hashPassword() emits. */
const ARGON2_PREFIX = "$argon2id$";

export type PasswordHashAlgorithm = "argon2id" | "bcrypt";

export interface PasswordVerification {
  valid: boolean;
  /** Set when the row verified under bcrypt and should be rehashed on sign-in. */
  needsRehash: boolean;
  /** Which scheme the stored hash was written with. */
  algorithm: PasswordHashAlgorithm | "unknown";
}

/**
 * Hash a password for storage. Always Argon2id: there is no reason a fresh
 * hash would ever use the legacy scheme.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(ARGON2_SALT_BYTES);
  return argon2id({
    password,
    salt,
    parallelism: ARGON2_PARALLELISM,
    iterations: ARGON2_ITERATIONS,
    memorySize: ARGON2_MEMORY_KIB,
    hashLength: ARGON2_HASH_BYTES,
    outputType: "encoded",
  });
}

/**
 * Verify a password against a stored hash of either scheme.
 *
 * Never throws on a malformed hash — returns `valid: false` — because the
 * hash column is user-agnostic data that may have been written by an older
 * deploy, a manual SQL fix, or an import. A crash there would 500 every
 * sign-in for that account; a false is simply "wrong password".
 */
export async function verifyPassword(password: string, stored: string): Promise<PasswordVerification> {
  if (typeof stored !== "string" || stored.length === 0) {
    return { valid: false, needsRehash: false, algorithm: "unknown" };
  }
  if (stored.startsWith(ARGON2_PREFIX)) {
    try {
      const valid = await argon2Verify({ password, hash: stored });
      return { valid, needsRehash: false, algorithm: "argon2id" };
    } catch {
      return { valid: false, needsRehash: false, algorithm: "argon2id" };
    }
  }
  if (stored.startsWith("$2")) {
    try {
      const valid = await bcryptVerify({ password, hash: stored });
      return { valid, needsRehash: valid, algorithm: "bcrypt" };
    } catch {
      return { valid: false, needsRehash: false, algorithm: "bcrypt" };
    }
  }
  return { valid: false, needsRehash: false, algorithm: "unknown" };
}

/**
 * Rehash a just-verified password into Argon2id.
 *
 * Called only after `verifyPassword` returned `{ valid: true, needsRehash:
 * true }` — the plaintext is already in hand and about to be discarded, so
 * this is the one free upgrade moment.
 */
export async function rehashPassword(password: string): Promise<string> {
  return hashPassword(password);
}

/**
 * True when the stored hash already meets the current scheme + parameters.
 *
 * Cheap (prefix/length checks only) so hot paths can skip a pointless write
 * without doing crypto.
 */
export function isCurrentHash(stored: string): boolean {
  return typeof stored === "string" && stored.startsWith(ARGON2_PREFIX);
}
