/**
 * Deployment compatibility endpoint.
 *
 * GET /api/deployment
 *
 * Returns the current server deployment version and environment information.
 * The frontend polls this endpoint periodically (and on window focus) to
 * detect when a new deployment has landed. When the versions diverge, the
 * frontend prompts the user to refresh.
 *
 * This endpoint is:
 * - Unauthenticated (public, like /healthz)
 * - Never cached (Cache-Control: no-store)
 * - Safe to call from any origin
 */

import { Router, type IRouter } from "express";
import {
  getDeploymentVersion,
  getKnownDeploymentIds,
  isPreviewDeployment,
  isLocalDev,
  isSkewProtectionAvailable,
} from "../lib/deploymentVersion";

const router: IRouter = Router();

router.get("/deployment", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({
    version: getDeploymentVersion(),
    // Every identifier this deployment answers to. The frontend bakes its
    // version at BUILD time (vite.config.ts: VERCEL_DEPLOYMENT_ID → commit SHA →
    // `git rev-parse --short HEAD`) while this runs at RUNTIME, and the two
    // contexts do not always pick the same one — the build usually has a git SHA
    // while the runtime prefers VERCEL_DEPLOYMENT_ID. Comparing `version` alone
    // therefore reported a permanent mismatch for a single deployment: a banner
    // on every page, an "Update now" that reloaded into the same banner, and 30 s
    // polling forever. The backend's own 409 guard already accepted the whole
    // set (`isDeploymentCompatible`); now the client can use the same rule.
    knownIds: getKnownDeploymentIds(),
    // False when this instance knows no stable identifier, which means skew
    // cannot be judged at all and the client must stay quiet (fail open).
    skewProtectionAvailable: isSkewProtectionAvailable(),
    environment: process.env.VERCEL_ENV ?? (isLocalDev() ? "development" : "production"),
    isPreview: isPreviewDeployment(),
    isLocal: isLocalDev(),
    timestamp: new Date().toISOString(),
    // Compatibility protocol version — bump if the skew-protection contract
    // itself changes (e.g. different header name, different error format).
    protocol: 1,
  });
});

export { router as deploymentRouter };
