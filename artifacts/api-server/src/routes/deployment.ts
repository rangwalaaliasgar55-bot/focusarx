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
import { getDeploymentVersion, isPreviewDeployment, isLocalDev } from "../lib/deploymentVersion";

const router: IRouter = Router();

router.get("/deployment", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({
    version: getDeploymentVersion(),
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
