import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import { checkAdminAuth } from "../lib/adminAuth";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.set("Cache-Control", "no-store");
  res.json(data);
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
