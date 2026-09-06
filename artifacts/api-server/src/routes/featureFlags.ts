import { Router } from "express";
import { AuthRequest } from "../middlewares/auth";
import { db } from "@workspace/db";
import { featureFlagsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

// GET /api/feature-flags — public, list enabled
router.get("/feature-flags", async (_req, res) => {
  try {
    const flags = await db.select().from(featureFlagsTable).where(eq(featureFlagsTable.enabled, true));
    const map: Record<string, boolean> = {};
    flags.forEach(f => { map[f.key] = f.enabled; });
    res.json({ flags: map, all: flags });
  } catch {
    // fallback if table not yet migrated
    res.json({ flags: { premium_timer_rituals: true, premium_analytics: true, premium_city_modes: true, pets_3d: true, battle_pass: true }, all: [] });
  }
});

// Admin: CRUD feature flags
router.get("/admin/feature-flags", async (req, res) => {
  const { checkAdminAuth } = await import("../lib/adminAuth");
  if (!await checkAdminAuth(req)) return res.status(403).json({ error: "Forbidden" });
  try {
    const flags = await db.select().from(featureFlagsTable);
    res.json({ flags });
  } catch (err) {
    logger.error({ err }, "feature flags list error");
    res.status(500).json({ error: "Failed to list" });
  }
});

router.post("/admin/feature-flags", async (req, res) => {
  const { checkAdminAuth } = await import("../lib/adminAuth");
  if (!await checkAdminAuth(req)) return res.status(403).json({ error: "Forbidden" });
  const authReq = req as AuthRequest;
  const { key, enabled, description, rolloutPercentage } = req.body as { key: string; enabled?: boolean; description?: string; rolloutPercentage?: number };
  if (!key) return res.status(400).json({ error: "key required" });
  try {
    const [existing] = await db.select().from(featureFlagsTable).where(eq(featureFlagsTable.key, key)).limit(1);
    if (existing) {
      const [updated] = await db.update(featureFlagsTable).set({ enabled: enabled ?? existing.enabled, description: description ?? existing.description, rolloutPercentage: rolloutPercentage ?? existing.rolloutPercentage, updatedAt: new Date() }).where(eq(featureFlagsTable.key, key)).returning();
      return res.json({ flag: updated });
    }
    const [created] = await db.insert(featureFlagsTable).values({ key, enabled: enabled ?? true, description, rolloutPercentage: rolloutPercentage ?? 100 }).returning();
    res.json({ flag: created });
  } catch (err) {
    logger.error({ err }, "feature flag upsert error");
    res.status(500).json({ error: "Failed to upsert" });
  }
});

export { router as featureFlagsRouter };
