import { Router } from "express";
import { z } from "zod";
import { db, siteSettingsTable, platformMetaTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { adminLimiter } from "../lib/rateLimiter";
import { getSiteSettings, invalidateSiteSettingsCache } from "../lib/siteSettings";
import { checkAdminAuth } from "../lib/adminAuth";
import { sendForbidden, sendInternal, sendValidationError } from "../lib/httpErrors";

const router = Router();
const checkAuth = checkAdminAuth;

/**
 * Public — the frontend reads this to show maintenance mode + announcements.
 *
 * Deliberately cannot fail. Site settings are decorative: if the database is
 * unreachable the correct behaviour is to render the app with defaults, not to
 * turn the whole page into an error state. `getSiteSettings()` already falls
 * back to defaults internally and reports whether it did, so this route answers
 * 200 either way and includes `degraded: true` when the stored values could not
 * be read — honest about the outage, but never fatal.
 */
router.get("/site/settings", async (_req, res) => {
  try {
    const settings = await getSiteSettings();
    res.set("Cache-Control", "no-store");
    res.json(settings);
  } catch (err) {
    logger.error({ err }, "public site settings error");
    sendInternal(res);
  }
});

const updateSchema = z.object({
  maintenanceMode: z.boolean().optional(),
  maintenanceMessage: z.string().max(500).optional(),
  announcementEnabled: z.boolean().optional(),
  announcementTitle: z.string().max(100).optional(),
  announcementText: z.string().max(500).optional(),
  announcementEmoji: z.string().max(8).optional(),
  brandingName: z.string().max(60).optional(),
  brandingTagline: z.string().max(200).optional(),
  heroTitle: z.string().max(120).optional().nullable(),
  heroSubtitle: z.string().max(300).optional().nullable(),
  heroCtaText: z.string().max(60).optional().nullable(),
});

// There is intentionally no public "community pulse" / member-count endpoint.
// `/site/community-pulse` used to publish the registered-member total, the
// number of real humans among them and how many studied this week. Those are
// audience-size figures, and we do not publish audience size to visitors (the
// same rule that removed `/stats/focusing-now` and per-room head counts from
// anonymous responses). Admins still see them on /admin/analytics.

/** Admin — read full settings. */
router.get("/admin/site/settings", async (req, res) => {
  if (!await checkAuth(req)) { sendForbidden(res); return; }
  try {
    const [row] = await db.select().from(siteSettingsTable).limit(1);
    res.json(row ?? { maintenanceMode: false, announcementEnabled: false, brandingName: "FocusArx" });
  } catch (err) {
    logger.error({ err }, "admin site settings get error");
    sendInternal(res);
  }
});

/** Admin — update settings (maintenance mode, announcement, branding). */
router.patch("/admin/site/settings", adminLimiter, async (req, res) => {
  if (!await checkAuth(req)) { sendForbidden(res); return; }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    sendValidationError(res, "Invalid settings");
    return;
  }
  const updates = parsed.data;

  try {
    const [existing] = await db.select().from(siteSettingsTable).limit(1);
    if (existing) {
      const [updated] = await db.update(siteSettingsTable)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(siteSettingsTable.id, existing.id))
        .returning();
      invalidateSiteSettingsCache();
      res.json({ ok: true, settings: updated });
    } else {
      const [created] = await db.insert(siteSettingsTable)
        .values({ id: "default", ...updates })
        .returning();
      invalidateSiteSettingsCache();
      res.json({ ok: true, settings: created });
    }
  } catch (err) {
    logger.error({ err }, "admin site settings update error");
    sendInternal(res);
  }
});

// ─── ADMIN-ADDABLE AMBIENT TRACKS ────────────────────────────────────────────
// The built-in ambient library is procedural (synthesized in the browser).
// Admins can additionally publish streamed audio tracks (licensed lofi loops,
// nature recordings, …) that show up in the ambient mixer for everyone.
// Stored as a JSON array in platform_meta — no schema migration needed.

export const AMBIENT_TRACKS_META_KEY = "ambient_custom_tracks_v1";

const ambientTrackSchema = z.object({
  id: z.string().min(1).max(60),
  label: z.string().min(1).max(40),
  emoji: z.string().max(8).optional().default("🎵"),
  url: z.string().url().refine((u) => u.startsWith("https://"), "Track URL must use https"),
  credit: z.string().max(120).optional().default(""),
});

/** Public — the ambient mixer reads the admin-published track list. */
router.get("/site/ambient-tracks", async (_req, res) => {
  try {
    const [row] = await db.select({ value: platformMetaTable.value })
      .from(platformMetaTable)
      .where(eq(platformMetaTable.key, AMBIENT_TRACKS_META_KEY))
      .limit(1);
    res.set("Cache-Control", "no-store");
    res.json(Array.isArray(row?.value) ? row.value : []);
  } catch (err) {
    logger.error({ err }, "ambient tracks get error");
    // Decorative feature: an outage yields an empty list, never a broken mixer.
    res.json([]);
  }
});

const ambientTracksUpdateSchema = z.array(ambientTrackSchema).max(20, "At most 20 custom tracks");

/** Admin — replace the whole published list (idempotent). */
router.put("/admin/ambient-tracks", adminLimiter, async (req, res) => {
  if (!await checkAuth(req)) { sendForbidden(res); return; }
  const parsed = ambientTracksUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    sendValidationError(res, "Invalid track list");
    return;
  }
  const tracks = parsed.data;
  // Enforce unique ids client-side mistakes can't produce duplicates.
  const seen = new Set<string>();
  const unique = tracks.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
  try {
    await db.insert(platformMetaTable)
      .values({ key: AMBIENT_TRACKS_META_KEY, value: unique })
      .onConflictDoUpdate({ target: platformMetaTable.key, set: { value: unique, updatedAt: new Date() } });
    logger.info({ count: unique.length }, "admin updated ambient track list");
    res.json({ ok: true, tracks: unique });
  } catch (err) {
    logger.error({ err }, "ambient tracks update error");
    sendInternal(res);
  }
});

export { router as siteRouter };
