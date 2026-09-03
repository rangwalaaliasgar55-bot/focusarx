/**
 * Deployment version management.
 *
 * Generates a stable, non-secret version identifier that is baked into the
 * frontend at build time and returned by the API at runtime. When these
 * identifiers diverge, the user has loaded assets from one deployment while
 * hitting API endpoints from a different deployment — a "deployment skew".
 *
 * Why this matters on Vercel:
 * - Preview deployments get a unique URL per PR.
 * - Production deployments can overlap briefly during a rolling deploy.
 * - The service worker can serve a cached index.html from the previous deploy
 *   while the /api/* routes already point to the new serverless function.
 * - The result: silent data corruption, API errors from mismatched schemas,
 *   or a chunk-load failure when the old frontend references a JS chunk that
 *   no longer exists.
 *
 * This module creates a single source of truth for the current deployment
 * version, compatible with Vercel's serverless environment and safe for
 * local development.
 *
 * ── Failure semantics (read before touching) ────────────────────────────
 * Skew protection must FAIL OPEN, never closed. The previous implementation
 * compared the client version against a single `getDeploymentVersion()`
 * value whose last-resort fallback was `dev-${process.pid}` — a DIFFERENT
 * value on every serverless instance. Any production deployment without a
 * stable identifier (Vercel "System Environment Variables" disabled, or a
 * custom host with no `DEPLOYMENT_VERSION` set) therefore:
 *   1. answered every API response with a version the frontend could never
 *      match, so the "Update available" banner appeared on every page load;
 *   2. "Update now" reloaded into the same mismatch (refresh fixed nothing);
 *   3. pinned the frontend to 30s fast-polling of /api/deployment forever;
 *   4. answered every non-exempt mutation with 409 DEPLOYMENT_SKEW, so real
 *      work (session completion, tasks, …) was blocked and queued in a loop.
 * The rules below encode the lesson: with no stable identifier the server
 * admits it (`"unverifiable"`, recognised by the frontend as "stay quiet")
 * and the guard lets traffic through instead of 409ing the whole product.
 */

import { getEnv } from "./env";
import { logger } from "./logger";

let cachedVersion: string | null = null;

/**
 * Sentinel answered (and recognised by the frontend) when this instance has
 * NO stable deployment identifier. Fixed, never per-process, so every
 * instance at least agrees with each other.
 */
export const UNVERIFIABLE_DEPLOYMENT_VERSION = "unverifiable";

/** Prefix for per-process development versions — never a stable identity. */
const DEV_VERSION_PREFIX = "dev-";

/** True for values that can never identify a deployment (`dev-*`, blank). */
export function isUnstableVersion(value: string | null | undefined): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  return trimmed === "" || trimmed.toLowerCase().startsWith(DEV_VERSION_PREFIX);
}

/**
 * Get the current deployment version.
 *
 * Priority:
 * 1. VERCEL_DEPLOYMENT_ID — unique per Vercel deployment (best signal)
 * 2. VERCEL_GIT_COMMIT_SHA — git commit hash (falls back to short form)
 * 3. DEPLOYMENT_VERSION — explicit override (for Docker / custom deploys)
 * 4. "unverifiable" in production — every instance agrees, and the frontend
 *    knows this means "skew cannot be determined, stay quiet"
 * 5. "dev-{pid}" — local development fallback only
 *
 * The version is cached after first call since it never changes during the
 * lifetime of a serverless function instance.
 */
export function getDeploymentVersion(): string {
  if (cachedVersion) return cachedVersion;

  try {
    const env = getEnv();
    if (env.VERCEL_DEPLOYMENT_ID) {
      cachedVersion = env.VERCEL_DEPLOYMENT_ID;
      return cachedVersion;
    }
    if (env.VERCEL_GIT_COMMIT_SHA) {
      cachedVersion = env.VERCEL_GIT_COMMIT_SHA.slice(0, 12);
      return cachedVersion;
    }
  } catch {
    // getEnv() may throw if config is incomplete; fall through to env access
  }

  const explicit = process.env.DEPLOYMENT_VERSION;
  if (explicit) {
    cachedVersion = explicit;
    return cachedVersion;
  }

  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (sha) {
    cachedVersion = sha.slice(0, 12);
    return cachedVersion;
  }

  if (isProductionLike()) {
    // No stable identifier and we are serving real traffic: admit it with a
    // fixed sentinel instead of a per-process `dev-<pid>` that disagrees
    // with every other instance and can never match the frontend.
    cachedVersion = UNVERIFIABLE_DEPLOYMENT_VERSION;
    return cachedVersion;
  }

  // Local dev — use a stable value per process so the frontend and backend
  // always agree during a single dev session.
  cachedVersion = `dev-${process.pid}`;
  return cachedVersion;
}

function isProductionLike(): boolean {
  try {
    if (getEnv().NODE_ENV === "production") return true;
  } catch {
    if (process.env.NODE_ENV === "production") return true;
  }
  return process.env.VERCEL_ENV === "production" || process.env.VERCEL === "1";
}

/**
 * Every stable identifier this deployment is known by. The frontend bakes
 * its version at BUILD time while this runs at RUNTIME, and the two
 * contexts do not always see the same variables (e.g. builds without
 * Vercel's system variables fall back to `git rev-parse --short`, a 7-char
 * SHA, while the runtime sees the full `VERCEL_GIT_COMMIT_SHA`). Accepting
 * the whole set — instead of one primary — keeps skew detection working
 * across those combinations instead of 409ing legitimate same-deploy traffic.
 */
export function getKnownDeploymentIds(): string[] {
  const ids = new Set<string>();
  const add = (value: unknown): void => {
    if (typeof value !== "string") return;
    const trimmed = value.trim();
    if (trimmed === "" || trimmed.toLowerCase().startsWith(DEV_VERSION_PREFIX)) return;
    if (trimmed === UNVERIFIABLE_DEPLOYMENT_VERSION) return;
    ids.add(trimmed);
  };

  try {
    const env = getEnv();
    add(env.VERCEL_DEPLOYMENT_ID);
    if (env.VERCEL_GIT_COMMIT_SHA) add(env.VERCEL_GIT_COMMIT_SHA.slice(0, 12));
    add(env.DEPLOYMENT_VERSION);
  } catch {
    // getEnv() may throw if config is incomplete; fall through to env access
  }
  add(process.env.VERCEL_DEPLOYMENT_ID);
  if (process.env.VERCEL_GIT_COMMIT_SHA) add(process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 12));
  add(process.env.DEPLOYMENT_VERSION);
  return [...ids];
}

let warnedUnverifiable = false;

/**
 * Whether the guard has enough information to judge skew at all. False in
 * local dev (guard bypassed there anyway) and in production when no stable
 * identifier exists — blocking in that state 409s the whole product, so the
 * guard must fail open and say so once in the logs.
 */
export function isSkewProtectionAvailable(): boolean {
  if (isLocalDev()) return false;
  return getKnownDeploymentIds().length > 0;
}

/** A client version that looks like an abbreviated git SHA (7+ hex chars). */
function isShaPrefix(value: string): boolean {
  return /^[0-9a-f]{7,40}$/i.test(value.trim());
}

/**
 * Check whether a client-provided version is compatible with the current
 * deployment. Returns true when:
 * - the client sent no version (legacy client before this feature), or
 * - the version is a dev/unverifiable sentinel from a non-production client
 *   that was never part of the skew contract, or
 * - it exactly matches any known stable id of this deployment, or
 * - it is an abbreviated-SHA prefix of a known id (build-time `git
 *   rev-parse --short` vs runtime full SHA), or
 * - this instance knows NO stable id at all (fail open — see module docs).
 */
export function isDeploymentCompatible(clientVersion: string | undefined | null): boolean {
  // No client version = legacy client, assume compatible for first deploy.
  if (!clientVersion) return true;

  const candidate = clientVersion.trim();
  if (candidate === "") return true;
  // Dev builds hitting any API were never versioned participants; judging
  // them "skewed" only produces bogus 409s during local development.
  if (candidate.toLowerCase().startsWith(DEV_VERSION_PREFIX)) return true;

  const known = getKnownDeploymentIds();
  if (known.length === 0) {
    if (!warnedUnverifiable) {
      warnedUnverifiable = true;
      logger.warn(
        "[deploy-skew] No stable deployment identifier (no VERCEL_DEPLOYMENT_ID / " +
          "VERCEL_GIT_COMMIT_SHA / DEPLOYMENT_VERSION) — skew protection is OFF and all " +
          "mutations are allowed. Enable Vercel System Environment Variables or set " +
          "DEPLOYMENT_VERSION (and matching VITE_DEPLOYMENT_VERSION at build time).",
      );
    }
    return true;
  }

  if (known.includes(candidate)) return true;

  // Build-time short SHA (e.g. `efe5fe5`) vs runtime 12-char slice
  // (e.g. `efe5fe568afb`): same commit, different abbreviation lengths.
  if (isShaPrefix(candidate)) {
    const lower = candidate.toLowerCase();
    if (known.some((id) => id.toLowerCase().startsWith(lower))) return true;
  }

  return false;
}

/**
 * Whether this is a Vercel preview deployment (as opposed to production).
 */
export function isPreviewDeployment(): boolean {
  const env = process.env.VERCEL_ENV;
  return env === "preview";
}

/**
 * Whether this is a local development environment.
 */
export function isLocalDev(): boolean {
  return process.env.NODE_ENV !== "production" && !process.env.VERCEL;
}

/** Reset module caches — tests only. */
export function __resetDeploymentVersionCache(): void {
  cachedVersion = null;
  warnedUnverifiable = false;
}
