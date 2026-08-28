/**
 * Deployment skew protection — backend middleware (v2).
 *
 * Attached to every /api/* request:
 * 1. Response headers: X-FocusArx-Deployment (server version) + X-FocusArx-Deploy-Env
 * 2. Request validation: reads X-FocusArx-Deployment from client
 * 3. Mismatch handling:
 *    - GET/HEAD/OPTIONS: always pass (safe to retry from frontend)
 *    - POST/PUT/PATCH/DELETE: blocked with 409 + structured error
 * 4. Retry-After header: tells the client how long to wait before retrying
 * 5. Idempotency awareness: requests with Idempotency-Key are treated as safe
 *    to replay after refresh (the key prevents duplicate execution)
 *
 * Why we don't block GETs:
 * A GET during skew may return slightly stale data, but it won't corrupt
 * anything. The frontend's skew handler will prompt the user to refresh.
 *
 * Why we DO block mutations:
 * A POST/PUT/PATCH/DELETE during skew could:
 * - Submit data to an API whose validation schema has changed
 * - Trigger rewards the new frontend doesn't know how to display
 * - Write to a column that was renamed in the new migration
 */

import type { Request, Response, NextFunction } from "express";
import { getDeploymentVersion, isDeploymentCompatible, isLocalDev, isPreviewDeployment } from "../lib/deploymentVersion";
import { logger } from "../lib/logger";

/** Header name for the deployment version (request and response). */
export const DEPLOYMENT_HEADER = "X-FocusArx-Deployment";

/**
 * Paths exempt from skew checks.
 * Health, deployment info, admin, and auth routes must always be reachable.
 */
const EXEMPT_PATHS = new Set([
  "/healthz",
  "/deployment",
  "/readiness",
]);

const EXEMPT_PREFIXES = [
  "/admin",
  "/site/settings",
  "/auth/",
  "/healthz/",
  "/og/",
  "/sitemap",
  "/robots.txt",
];

function isExempt(path: string): boolean {
  if (EXEMPT_PATHS.has(path)) return true;
  return EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/**
 * Check if a request is idempotent (safe to replay after refresh).
 * Requests with an Idempotency-Key header are idempotent by definition —
 * the server will deduplicate them, so the frontend can safely queue and
 * replay them after a skew-triggered refresh.
 */
function isIdempotentRequest(req: Request): boolean {
  // Explicit idempotency key
  if (req.headers["idempotency-key"]) return true;
  // client_nonce in body (used by session completion)
  if (req.body?.clientNonce) return true;
  // GET/HEAD/OPTIONS are inherently idempotent
  const method = req.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return true;
  return false;
}

/**
 * Response middleware — attaches deployment version headers to every API response.
 * This must run before route handlers so the version is always present.
 */
export function deploymentVersionHeaders(_req: Request, res: Response, next: NextFunction) {
  const version = getDeploymentVersion();
  res.setHeader(DEPLOYMENT_HEADER, version);
  res.setHeader("X-FocusArx-Deploy-Env", process.env.VERCEL_ENV ?? "development");

  // Add version to ETag so caches can distinguish between deployments
  const existingETag = res.getHeader("ETag");
  if (existingETag && typeof existingETag === "string") {
    res.setHeader("ETag", `${existingETag}-${version}`);
  }

  next();
}

/**
 * Skew guard middleware — blocks mutations when client version ≠ server version.
 *
 * Decision matrix:
 * ┌──────────────┬─────────────┬──────────────────────────────────┐
 * │ Method       │ Skew?       │ Action                           │
 * ├──────────────┼─────────────┼──────────────────────────────────┤
 * │ GET/HEAD     │ Any         │ PASS (safe, frontend retries)    │
 * │ OPTIONS      │ Any         │ PASS (CORS preflight)            │
 * │ POST/PUT/etc │ Match       │ PASS                             │
 * │ POST/PUT/etc │ Mismatch    │ BLOCK 409                        │
 * │ POST/PUT/etc │ No header   │ PASS (legacy client compat)      │
 * │ Any          │ Exempt path │ PASS                             │
 * │ Any          │ Local dev   │ PASS                             │
 * └──────────────┴─────────────┴──────────────────────────────────┘
 */
export function deploymentSkewGuard(req: Request, res: Response, next: NextFunction) {
  // Local development: never block (versions always diverge in dev)
  if (isLocalDev()) {
    next();
    return;
  }

  // Exempt paths: always allow
  if (isExempt(req.path)) {
    next();
    return;
  }

  // Safe methods: always allow
  const method = req.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    next();
    return;
  }

  // Read client version
  const clientVersion = req.headers[DEPLOYMENT_HEADER.toLowerCase()] as string | undefined;

  // No version header = legacy client (before skew protection was deployed)
  // Be lenient during the rollout period
  if (!clientVersion) {
    next();
    return;
  }

  // Check compatibility
  if (isDeploymentCompatible(clientVersion)) {
    next();
    return;
  }

  // ── Version mismatch on a mutation — block it ──

  const serverVersion = getDeploymentVersion();
  const idempotent = isIdempotentRequest(req);

  logger.warn(
    {
      clientVersion,
      serverVersion,
      method: req.method,
      path: req.path,
      idempotent,
      requestId: (req as any).id,
    },
    "deployment skew detected — blocking mutation"
  );

  // Set Retry-After to tell the client to wait briefly before retrying
  // (gives the deployment time to fully propagate)
  res.setHeader("Retry-After", "5");

  res.status(409).json({
    error: {
      code: "DEPLOYMENT_SKEW",
      message: "A new version of FocusArx has been deployed. Please refresh to continue.",
      serverVersion,
      clientVersion,
      idempotent,
      retryAfterSec: 5,
      hint: idempotent
        ? "This request is idempotent and will be automatically retried after refresh."
        : "Refresh the page to load the latest version. Your unsaved work will be preserved.",
      requestId: (req as any).id,
    },
  });
}
