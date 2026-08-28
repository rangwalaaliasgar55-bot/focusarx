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
 */

import { getEnv } from "./env";

let cachedVersion: string | null = null;

/**
 * Get the current deployment version.
 *
 * Priority:
 * 1. VERCEL_DEPLOYMENT_ID — unique per Vercel deployment (best signal)
 * 2. VERCEL_GIT_COMMIT_SHA — git commit hash (falls back to short form)
 * 3. DEPLOYMENT_VERSION — explicit override (for Docker / custom deploys)
 * 4. "dev-{timestamp}" — local development fallback
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

  // Local dev — use a stable value per process so the frontend and backend
  // always agree during a single dev session.
  cachedVersion = `dev-${process.pid}`;
  return cachedVersion;
}

/**
 * Check whether a client-provided version is compatible with the current
 * server version. Returns true if they match or if the client sent no version
 * (e.g. an old client before this feature was deployed — be lenient on the
 * first rollout).
 */
export function isDeploymentCompatible(clientVersion: string | undefined | null): boolean {
  // No client version = legacy client, assume compatible for first deploy.
  if (!clientVersion) return true;
  return clientVersion === getDeploymentVersion();
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
