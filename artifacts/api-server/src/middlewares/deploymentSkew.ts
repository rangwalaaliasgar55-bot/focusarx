/**
 * Deployment skew protection middleware.
 *
 * This middleware:
 * 1. Attaches the deployment version header to every API response.
 * 2. Reads the client's deployment version from the request header.
 * 3. Detects mismatches and returns a structured error response.
 * 4. Only blocks mutations (POST/PUT/PATCH/DELETE) on mismatch — GET requests
 *    are allowed through since they are idempotent and safe to retry.
 *
 * Why we don't block GETs:
 * A GET during deployment skew may return slightly stale data, but it won't
 * corrupt anything. The frontend's skew handler will prompt the user to
 * refresh, which will pick up the new deployment.
 *
 * Why we DO block mutations:
 * A POST/PUT/PATCH/DELETE during deployment skew could:
 * - Submit data to an API endpoint whose validation schema has changed.
 * - Trigger a reward that the new frontend doesn't know how to display.
 * - Write to a column that was renamed in the new migration.
 * Blocking these and asking the user to refresh prevents silent corruption.
 */

import type { Request, Response, NextFunction } from "express";
import { getDeploymentVersion, isDeploymentCompatible, isLocalDev } from "../lib/deploymentVersion";
import { logger } from "../lib/logger";

/** Header name for the deployment version (request and response). */
export const DEPLOYMENT_HEADER = "X-FocusArx-Deployment";

/**
 * Paths that are exempt from deployment skew checks.
 * Health checks, the deployment endpoint itself, and admin routes should
 * always be reachable regardless of version.
 */
const EXEMPT_PATHS = [
  "/healthz",
  "/deployment",
  "/readiness",
];

const EXEMPT_PREFIXES = [
  "/admin",
  "/site/settings",
];

function isExempt(path: string): boolean {
  if (EXEMPT_PATHS.some((p) => path === p || path.endsWith(p))) return true;
  if (EXEMPT_PREFIXES.some((p) => path.startsWith(p))) return true;
  return false;
}

/**
 * Response middleware — attaches the deployment version header to every
 * API response so the frontend can always read the server's version.
 */
export function deploymentVersionHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader(DEPLOYMENT_HEADER, getDeploymentVersion());
  res.setHeader("X-FocusArx-Deploy-Env", process.env.VERCEL_ENV ?? "development");
  next();
}

/**
 * Skew protection middleware — blocks mutations when the client's deployment
 * version doesn't match the server's deployment version.
 *
 * This is intentionally lenient:
 * - Local dev always passes (no version mismatch during development).
 * - GET/HEAD/OPTIONS always pass (safe to retry).
 * - Exempt paths always pass (health, admin, deployment endpoint).
 * - Missing client version passes (backward compatibility during rollout).
 */
export function deploymentSkewGuard(req: Request, res: Response, next: NextFunction) {
  // Local development: never block
  if (isLocalDev()) {
    next();
    return;
  }

  // Exempt paths: always allow
  if (isExempt(req.path)) {
    next();
    return;
  }

  // Safe methods: always allow (they can be retried by the frontend)
  const method = req.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    next();
    return;
  }

  // Check version compatibility
  const clientVersion = req.headers[DEPLOYMENT_HEADER.toLowerCase()] as string | undefined;
  if (isDeploymentCompatible(clientVersion)) {
    next();
    return;
  }

  // Version mismatch on a mutation — block it.
  logger.warn(
    {
      clientVersion,
      serverVersion: getDeploymentVersion(),
      method: req.method,
      path: req.path,
    },
    "deployment skew detected — blocking mutation"
  );

  res.status(409).json({
    error: {
      code: "DEPLOYMENT_SKEW",
      message: "A new version of FocusArx has been deployed. Please refresh to continue.",
      serverVersion: getDeploymentVersion(),
      clientVersion: clientVersion ?? null,
      hint: "Refresh the page to load the latest version. Your unsaved work will be preserved.",
      requestId: (req as any).id,
    },
  });
}
