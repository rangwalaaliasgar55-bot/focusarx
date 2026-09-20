import { Router } from "express";
import { db } from "@workspace/db";
import { featureFlagsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

// GET /api/feature-flags — public. Return both enabled and disabled rows:
// omitting disabled rows made the fail-open client interpret every OFF switch as ON.
router.get("/feature-flags", async (_req, res) => {
  try {
    const flags = await db.select().from(featureFlagsTable);
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

// DELETE /api/admin/feature-flags/:key — remove a flag entirely.
//
// Deliberately a hard delete rather than a soft "off": an admin who created a
// flag by mistake needs the row gone, and every consumer fails open, so deleting
// a flag restores the shipped default instead of changing behaviour.
// `gemini_auto_publish` is protected — it is the one flag whose absence means
// ON, so deleting it would silently re-enable auto-publishing.
const PROTECTED_FLAG_KEYS = new Set(["gemini_auto_publish"]);

router.delete("/admin/feature-flags/:key", async (req, res) => {
  const { checkAdminAuth } = await import("../lib/adminAuth");
  if (!await checkAdminAuth(req)) return res.status(403).json({ error: "Forbidden" });
  const key = String(req.params.key ?? "").slice(0, 80);
  if (!key) return res.status(400).json({ error: "key required" });
  if (PROTECTED_FLAG_KEYS.has(key)) {
    return res.status(400).json({ error: `${key} cannot be deleted — set enabled=false to disable it` });
  }
  try {
    const deleted = await db.delete(featureFlagsTable).where(eq(featureFlagsTable.key, key)).returning({ key: featureFlagsTable.key });
    if (deleted.length === 0) return res.status(404).json({ error: "Flag not found" });
    res.json({ ok: true, deleted: deleted[0]!.key });
  } catch (err) {
    logger.error({ err }, "feature flag delete error");
    res.status(500).json({ error: "Failed to delete" });
  }
});

export { router as featureFlagsRouter };
