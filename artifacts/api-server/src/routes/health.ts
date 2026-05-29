import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { HealthCheckResponse } from "@workspace/api-zod";
import { db } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/healthz/db", async (_req, res) => {
  try {
    await db.execute(sql`select 1`);
    res.json({ status: "ok", database: true });
  } catch (err) {
    const base = err instanceof Error ? err.message : "unknown";
    const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : undefined;
    res.status(500).json({ status: "error", database: false, message: cause ? `${base}: ${cause}` : base });
  }
});

export default router;
