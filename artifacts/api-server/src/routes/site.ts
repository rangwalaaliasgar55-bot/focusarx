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

// ── Custom site settings ────────────────────────────────────────────────────
/**
 * Admin-defined settings, stored as one JSON row in `platform_meta`.
 *
 * The typed settings above cover the fields the app already knows how to read.
 * This is the escape hatch for everything else — an admin can register any
 * key/value pair, mark it public or internal, and change or delete it later
 * without a deploy.
 *
 * Three rules keep it from becoming a config footgun:
 *
 *  1. **Keys are namespaced.** Everything lands under `site_custom_settings_v1`
 *     as a map, so a custom key can never collide with a typed setting or with
 *     another subsystem's `platform_meta` row.
 *  2. **Only `public: true` leaves the admin surface.** The public endpoint
 *     returns an allowlisted map of scalars; internal values (API keys, feature
 *     notes, staged copy) never appear in a browser-readable response.
 *  3. **Values are typed and bounded** — string/number/boolean or a bounded
 *     JSON value, with the same size ceiling as the announcement copy.
 */
const CUSTOM_SETTINGS_META_KEY = "site_custom_settings_v1";
const CUSTOM_SETTINGS_LIMIT = 100;
const CUSTOM_KEY_RE = /^[a-z0-9][a-z0-9_.-]{1,59}$/;

interface CustomSetting {
  key: string;
  value: string | number | boolean | null;
  public: boolean;
  note: string;
  updatedAt: string;
}

async function readCustomSettings(): Promise<CustomSetting[]> {
  try {
    const [row] = await db.select({ value: platformMetaTable.value })
      .from(platformMetaTable)
      .where(eq(platformMetaTable.key, CUSTOM_SETTINGS_META_KEY))
      .limit(1);
    const list = row?.value;
    if (!Array.isArray(list)) return [];
    return list.filter((e): e is CustomSetting =>
      Boolean(e) && typeof e === "object" && typeof (e as CustomSetting).key === "string");
  } catch (err) {
    logger.error({ err }, "custom settings read error");
    return [];
  }
}

async function writeCustomSettings(list: CustomSetting[]): Promise<void> {
  await db.insert(platformMetaTable)
    .values({ key: CUSTOM_SETTINGS_META_KEY, value: list })
    .onConflictDoUpdate({ target: platformMetaTable.key, set: { value: list, updatedAt: new Date() } });
}

const customSettingSchema = z.object({
  value: z.union([z.string().max(1000), z.number().finite(), z.boolean(), z.null()]),
  public: z.boolean().optional().default(false),
  note: z.string().max(200).optional().default(""),
});

/** Public — only the settings an admin explicitly marked public. */
router.get("/site/custom-settings", async (_req, res) => {
  const list = await readCustomSettings();
  const out: Record<string, string | number | boolean | null> = {};
  for (const entry of list) if (entry.public) out[entry.key] = entry.value;
  res.set("Cache-Control", "no-store");
  res.json(out);
});

router.get("/admin/site/custom-settings", async (req, res) => {
  if (!await checkAuth(req)) { sendForbidden(res); return; }
  res.json({ settings: await readCustomSettings() });
});

router.put("/admin/site/custom-settings/:key", adminLimiter, async (req, res) => {
  if (!await checkAuth(req)) { sendForbidden(res); return; }
  const key = String(req.params.key ?? "").trim().toLowerCase();
  if (!CUSTOM_KEY_RE.test(key)) {
    sendValidationError(res, "Key must be 2-60 chars: lowercase letters, numbers, dot, dash or underscore");
    return;
  }
  const parsed = customSettingSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    sendValidationError(res, "Invalid value — use text, a number, true/false, or leave empty");
    return;
  }
  try {
    const list = await readCustomSettings();
    const entry: CustomSetting = {
      key,
      value: parsed.data.value,
      public: parsed.data.public,
      note: parsed.data.note,
      updatedAt: new Date().toISOString(),
    };
    const index = list.findIndex(e => e.key === key);
    if (index === -1) {
      if (list.length >= CUSTOM_SETTINGS_LIMIT) {
        sendValidationError(res, `At most ${CUSTOM_SETTINGS_LIMIT} custom settings`);
        return;
      }
      list.push(entry);
    } else {
      list[index] = entry;
    }
    await writeCustomSettings(list);
    invalidateSiteSettingsCache();
    res.json({ ok: true, setting: entry, count: list.length });
  } catch (err) {
    logger.error({ err }, "custom setting save error");
    sendInternal(res);
  }
});

router.delete("/admin/site/custom-settings/:key", adminLimiter, async (req, res) => {
  if (!await checkAuth(req)) { sendForbidden(res); return; }
  const key = String(req.params.key ?? "").trim().toLowerCase();
  try {
    const list = await readCustomSettings();
    const next = list.filter(e => e.key !== key);
    if (next.length === list.length) { sendValidationError(res, "Setting not found"); return; }
    await writeCustomSettings(next);
    invalidateSiteSettingsCache();
    res.json({ ok: true, deleted: key, count: next.length });
  } catch (err) {
    logger.error({ err }, "custom setting delete error");
    sendInternal(res);
  }
});

export { router as siteRouter };
