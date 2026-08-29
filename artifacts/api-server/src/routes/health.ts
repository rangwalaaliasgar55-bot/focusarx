import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import { checkAdminAuth } from "../lib/adminAuth";
import { getConfigStatus } from "../lib/config";
import { getDeploymentVersion } from "../lib/deploymentVersion";

const router: IRouter = Router();

/**
 * Liveness probe. Answers 200 as long as the function itself loaded — which is
 * the whole point: during the production incident where a malformed env var
 * crashed the module at import, *every* route 500'd including this one, so
 * there was no signal distinguishing "misconfigured" from "dead".
 */
router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.set("Cache-Control", "no-store");
  res.json(data);
});

/**
 * Configuration status. Unauthenticated and secret-free: it reports only
 * variable *names* and validation *messages*, never values, hosts or
 * connection strings.
 *
 * Returns 200 even when misconfigured — a probe that 503s on the exact
 * condition you are trying to diagnose is useless, and it makes uptime
 * monitors indistinguishable from real outages. `ok: false` is the signal.
 */
router.get("/healthz/config", (_req, res) => {
  const status = getConfigStatus();
  res.set("Cache-Control", "no-store");
  res.status(200).json({
    ...status,
    version: getDeploymentVersion(),
    timestamp: new Date().toISOString(),
  });
});

/**
 * Combined readiness probe: process + configuration + database.
 *
 * 200 when fully ready, 503 otherwise, with per-component detail so an
 * operator can see at a glance which layer is failing. This is the endpoint to
 * point a warm-up or post-deploy check at.
 */
router.get("/healthz/ready", async (_req, res) => {
  const config = getConfigStatus();
  let database = false;
  if (config.database) {
    try {
      await pool.query("select 1");
      database = true;
    } catch (err) {
      logger.warn({ err }, "healthz/ready database probe failed");
    }
  }

  const ready = config.ok && database;
  res.set("Cache-Control", "no-store");
  res.status(ready ? 200 : 503).json({
    status: ready ? "ok" : "degraded",
    ready,
    config: { ok: config.ok, errors: config.errors },
    database,
    version: getDeploymentVersion(),
    timestamp: new Date().toISOString(),
  });
});

/**
 * Database liveness probe.
 *
 * This endpoint is unauthenticated and therefore must never echo the driver's
 * error string — Postgres/Neon messages can contain the hostname, port,
 * database and role name, which is a free reconnaissance gift to anyone who
 * scrapes it. The detail is logged server-side and only returned to an admin
 * who can prove it.
 */
router.get("/healthz/db", async (req, res) => {
  try {
    await pool.query("select 1");
    res.set("Cache-Control", "no-store");
    res.json({ status: "ok", database: true });
  } catch (err) {
    // Never leak driver/connection internals to a public endpoint in production;
    // the detail is only useful (and safe) in local development.
    if (process.env.NODE_ENV === "production") {
      res.status(503).json({ status: "error", database: false, message: "Database unavailable" });
      return;
    }
    const base = err instanceof Error ? err.message : "unknown";
    const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : undefined;
    // Full detail goes to the log, never to the client.
    logger.error({ err, cause }, "healthz/db probe failed");

    const isAdmin = await checkAdminAuth(req).catch(() => false);
    const payload: Record<string, unknown> = { status: "error", database: false };
    if (isAdmin) {
      payload.message = cause ? `${base}: ${cause}` : base;
    } else {
      payload.message = "database unavailable";
    }
    res.set("Cache-Control", "no-store");
    res.status(500).json(payload);
  }
});

export default router;
