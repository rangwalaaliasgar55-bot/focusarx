import { db, siteSettingsTable } from "@workspace/db";
import { logger } from "./logger";

export interface PublicSiteSettings {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  announcementEnabled: boolean;
  announcementTitle: string | null;
  announcementText: string | null;
  announcementEmoji: string | null;
  brandingName: string;
  brandingTagline: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroCtaText: string | null;
  /**
   * True when the stored settings could not be read and the values above are
   * built-in defaults. Lets the client tell the difference between "the admin
   * turned announcements off" and "we could not reach the database" without
   * failing the request.
   */
  degraded: boolean;
}

const DEFAULT_SETTINGS: Omit<PublicSiteSettings, "degraded"> = {
  maintenanceMode: false,
  maintenanceMessage: "We're making FocusArx even better. Check back in a few minutes.",
  announcementEnabled: false,
  announcementTitle: null,
  announcementText: null,
  announcementEmoji: null,
  brandingName: "FocusArx",
  brandingTagline: null,
  heroTitle: null,
  heroSubtitle: null,
  heroCtaText: null,
};

/** In-memory cache with a short TTL so the maintenance/announcement toggles
 *  take effect quickly without a DB query on every request.
 *
 *  Degraded results are cached for a much shorter time than good ones so the
 *  app recovers on its own as soon as the database comes back. */
let cache: PublicSiteSettings | null = null;
let cacheAt = 0;
const TTL_MS = 5_000;
const DEGRADED_TTL_MS = 1_000;

export function invalidateSiteSettingsCache(): void {
  cache = null;
  cacheAt = 0;
}

/** Read the current site settings, falling back to safe defaults. */
export async function getSiteSettings(): Promise<PublicSiteSettings> {
  const now = Date.now();
  if (cache) {
    const ttl = cache.degraded ? DEGRADED_TTL_MS : TTL_MS;
    if (now - cacheAt < ttl) return cache;
  }

  try {
    const [row] = await db.select().from(siteSettingsTable).limit(1);
    const settings: PublicSiteSettings = {
      maintenanceMode: row?.maintenanceMode ?? DEFAULT_SETTINGS.maintenanceMode,
      maintenanceMessage: row?.maintenanceMessage ?? DEFAULT_SETTINGS.maintenanceMessage,
      announcementEnabled: row?.announcementEnabled ?? DEFAULT_SETTINGS.announcementEnabled,
      announcementTitle: row?.announcementTitle ?? null,
      announcementText: row?.announcementText ?? null,
      announcementEmoji: row?.announcementEmoji ?? null,
      brandingName: row?.brandingName ?? DEFAULT_SETTINGS.brandingName,
      brandingTagline: row?.brandingTagline ?? null,
      heroTitle: row?.heroTitle ?? null,
      heroSubtitle: row?.heroSubtitle ?? null,
      heroCtaText: row?.heroCtaText ?? null,
      degraded: false,
    };
    cache = settings;
    cacheAt = now;
    return settings;
  } catch (err) {
    logger.warn({ err }, "site settings read failed — returning defaults");
    const settings: PublicSiteSettings = { ...DEFAULT_SETTINGS, degraded: true };
    cache = settings;
    cacheAt = now;
    return settings;
  }
}

/** Check maintenance mode (used by the API gate middleware). */
export async function isMaintenanceMode(): Promise<boolean> {
  return (await getSiteSettings()).maintenanceMode;
}
