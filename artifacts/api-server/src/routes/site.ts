import { Router } from "express";
import { z } from "zod";
import { db, siteSettingsTable, platformMetaTable, ambientTracksTable, ambientTrackListensTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { adminLimiter, trackLimiter } from "../lib/rateLimiter";
import { getSiteSettings, invalidateSiteSettingsCache } from "../lib/siteSettings";
import { checkAdminAuth } from "../lib/adminAuth";
import { extractUserId } from "./auth";
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

// ─── AUDIO-FIRST AMBIENT CATALOG ────────────────────────────────────────────
// Ambient recordings are modelled as rows rather than a JSON setting. This
// gives admins a draft/release workflow, provenance fields, loop defaults, and
// private listening insight. The client always uses native audio; YouTube URLs
// are rejected instead of embedding a video or attempting to extract a stream.

const YOUTUBE_HOST_RE = /(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/i;
const AUDIO_STATUSES = ["draft", "published", "archived"] as const;

type AmbientTrackStatus = typeof AUDIO_STATUSES[number];

function isDirectAudioUrl(value: string): boolean {
  const raw = value.trim();
  if (!raw || raw.length > 2_000) return false;
  try {
    // Relative paths are first-party public assets, for example the bundled
    // MIT-licensed recordings at /ambient/chillnsound/*.mp3.
    const parsed = new URL(raw, "https://focusarx.local");
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    if (YOUTUBE_HOST_RE.test(parsed.hostname)) return false;
    return raw.startsWith("/") || /^https?:\/\//i.test(raw);
  } catch {
    return false;
  }
}

function isWebUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

const ambientTrackInputSchema = z.object({
  label: z.string().trim().min(1).max(60),
  emoji: z.string().trim().min(1).max(8).optional().default("🎵"),
  url: z.string().trim().max(2_000).refine(isDirectAudioUrl, "Use a direct audio URL or a first-party /ambient path. YouTube links are not supported."),
  credit: z.string().trim().max(160).optional().default(""),
  sourceUrl: z.string().trim().max(2_000).refine((value) => !value || isWebUrl(value), "Source URL must be http(s)").optional().default(""),
  license: z.string().trim().min(2).max(120),
  looping: z.boolean().optional().default(true),
});

const ambientTrackUpdateSchema = ambientTrackInputSchema.partial();

function toPublicTrack(track: typeof ambientTracksTable.$inferSelect) {
  return {
    id: track.id,
    label: track.label,
    emoji: track.emoji,
    url: track.audioUrl,
    credit: track.credit,
    sourceUrl: track.sourceUrl,
    license: track.sourceLicense,
    looping: track.looping,
  };
}

async function ambientTrackAnalytics() {
  const rows = await db.select({
    trackId: ambientTrackListensTable.trackId,
    starts: sql<number>`count(*)::int`,
    listeners: sql<number>`count(distinct ${ambientTrackListensTable.userId})::int`,
    starts30d: sql<number>`count(*) filter (where ${ambientTrackListensTable.listenedAt} >= now() - interval '30 days')::int`,
    listeners30d: sql<number>`count(distinct ${ambientTrackListensTable.userId}) filter (where ${ambientTrackListensTable.listenedAt} >= now() - interval '30 days')::int`,
    lastListenedAt: sql<Date | null>`max(${ambientTrackListensTable.listenedAt})`,
  }).from(ambientTrackListensTable).groupBy(ambientTrackListensTable.trackId);
  return new Map(rows.map((row) => [row.trackId, row]));
}

/** Public — only deliberately released, direct-audio tracks reach the mixer. */
router.get("/site/ambient-tracks", async (_req, res) => {
  try {
    const tracks = await db.select().from(ambientTracksTable)
      .where(eq(ambientTracksTable.status, "published"))
      .orderBy(desc(ambientTracksTable.publishedAt), desc(ambientTracksTable.createdAt))
      .limit(30);
    // Published recordings are stable content but a short private cache keeps
    // release/unpublish changes responsive without adding a render-blocking call.
    res.set("Cache-Control", "public, max-age=120, stale-while-revalidate=600");
    res.json(tracks.map(toPublicTrack));
  } catch (err) {
    logger.error({ err }, "ambient tracks get error");
    // Decorative feature: an outage yields an empty list, never a broken mixer.
    res.json([]);
  }
});

/**
 * Record an authenticated playback start. Anonymous listeners can still use
 * sounds; we intentionally do not fingerprint them. These data are admin-only
 * and are never returned by the public track endpoint.
 */
router.post("/site/ambient-tracks/:id/listen", trackLimiter, async (req, res) => {
  const userId = extractUserId(req);
  if (!userId) { res.status(204).end(); return; }
  const id = String(req.params.id ?? "");
  if (!id || id.length > 80) { res.status(204).end(); return; }
  try {
    const [track] = await db.select({ id: ambientTracksTable.id, status: ambientTracksTable.status }).from(ambientTracksTable)
      .where(eq(ambientTracksTable.id, id)).limit(1);
    if (track?.status === "published") await db.insert(ambientTrackListensTable).values({ trackId: track.id, userId });
  } catch (err) {
    // Playback must not depend on telemetry availability.
    logger.warn({ err, trackId: id }, "ambient listen metric was not recorded");
  }
  res.status(204).end();
});

/** Admin — all records, including drafts and archived tracks, plus private insight. */
router.get("/admin/ambient-tracks", adminLimiter, async (req, res) => {
  if (!await checkAuth(req)) { sendForbidden(res); return; }
  try {
    const [tracks, analytics] = await Promise.all([
      db.select().from(ambientTracksTable).orderBy(desc(ambientTracksTable.updatedAt)).limit(80),
      ambientTrackAnalytics(),
    ]);
    res.json({ tracks: tracks.map((track) => ({
      ...toPublicTrack(track),
      status: track.status as AmbientTrackStatus,
      createdAt: track.createdAt,
      updatedAt: track.updatedAt,
      publishedAt: track.publishedAt,
      archivedAt: track.archivedAt,
      insight: analytics.get(track.id) ?? { starts: 0, listeners: 0, starts30d: 0, listeners30d: 0, lastListenedAt: null },
    })) });
  } catch (err) {
    logger.error({ err }, "admin ambient track list error");
    sendInternal(res);
  }
});

/** Admin — add a track as a non-public draft. Provenance and license are required. */
router.post("/admin/ambient-tracks", adminLimiter, async (req, res) => {
  if (!await checkAuth(req)) { sendForbidden(res); return; }
  const parsed = ambientTrackInputSchema.safeParse(req.body);
  if (!parsed.success) { sendValidationError(res, parsed.error.errors[0]?.message ?? "Invalid audio track"); return; }
  try {
    const count = await db.select({ count: sql<number>`count(*)::int` }).from(ambientTracksTable);
    if ((count[0]?.count ?? 0) >= 80) { sendValidationError(res, "At most 80 ambient catalog entries are allowed"); return; }
    const input = parsed.data;
    const [track] = await db.insert(ambientTracksTable).values({
      label: input.label,
      emoji: input.emoji,
      audioUrl: input.url,
      credit: input.credit,
      sourceUrl: input.sourceUrl,
      sourceLicense: input.license,
      looping: input.looping,
      status: "draft",
      createdById: extractUserId(req),
    }).returning();
    res.status(201).json({ track: track && toPublicTrack(track) });
  } catch (err) {
    logger.error({ err }, "admin ambient track create error");
    sendInternal(res);
  }
});

/** Admin — correct metadata or loop defaults without making a draft public. */
router.patch("/admin/ambient-tracks/:id", adminLimiter, async (req, res) => {
  if (!await checkAuth(req)) { sendForbidden(res); return; }
  const id = String(req.params.id ?? "");
  const parsed = ambientTrackUpdateSchema.safeParse(req.body);
  if (!id || id.length > 80 || !parsed.success || Object.keys(parsed.data).length === 0) {
    sendValidationError(res, "Provide a valid track update"); return;
  }
  const input = parsed.data;
  try {
    const [track] = await db.update(ambientTracksTable).set({
      ...(input.label === undefined ? {} : { label: input.label }),
      ...(input.emoji === undefined ? {} : { emoji: input.emoji }),
      ...(input.url === undefined ? {} : { audioUrl: input.url }),
      ...(input.credit === undefined ? {} : { credit: input.credit }),
      ...(input.sourceUrl === undefined ? {} : { sourceUrl: input.sourceUrl }),
      ...(input.license === undefined ? {} : { sourceLicense: input.license }),
      ...(input.looping === undefined ? {} : { looping: input.looping }),
      updatedAt: new Date(),
    }).where(eq(ambientTracksTable.id, id)).returning();
    if (!track) { res.status(404).json({ error: "Track not found" }); return; }
    res.json({ track: toPublicTrack(track) });
  } catch (err) {
    logger.error({ err, trackId: id }, "admin ambient track update error");
    sendInternal(res);
  }
});

async function changeAmbientTrackStatus(id: string, status: AmbientTrackStatus) {
  const now = new Date();
  return db.update(ambientTracksTable).set({
    status,
    updatedAt: now,
    ...(status === "published" ? { publishedAt: now, archivedAt: null } : {}),
    ...(status === "draft" ? { archivedAt: null } : {}),
    ...(status === "archived" ? { archivedAt: now } : {}),
  }).where(eq(ambientTracksTable.id, id)).returning();
}

for (const [action, status] of [["publish", "published"], ["unpublish", "draft"], ["archive", "archived"]] as const) {
  router.post(`/admin/ambient-tracks/:id/${action}`, adminLimiter, async (req, res) => {
    if (!await checkAuth(req)) { sendForbidden(res); return; }
    const id = String(req.params.id ?? "");
    if (!id || id.length > 80) { sendValidationError(res, "Invalid track id"); return; }
    try {
      const [track] = await changeAmbientTrackStatus(id, status);
      if (!track) { res.status(404).json({ error: "Track not found" }); return; }
      res.json({ ok: true, track: toPublicTrack(track), status });
    } catch (err) {
      logger.error({ err, trackId: id, action }, "admin ambient track release action error");
      sendInternal(res);
    }
  });
}

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
