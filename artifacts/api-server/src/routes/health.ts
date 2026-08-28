import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/healthz/db", async (_req, res) => {
  try {
    await pool.query("select 1");
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
    res.status(500).json({ status: "error", database: false, message: cause ? `${base}: ${cause}` : base });
  }
});

export default router;
