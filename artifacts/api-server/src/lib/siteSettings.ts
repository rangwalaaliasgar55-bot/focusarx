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
}

/** In-memory cache with a short TTL so the maintenance/announcement toggles
 *  take effect quickly without a DB query on every request. */
let cache: PublicSiteSettings | null = null;
let cacheAt = 0;
const TTL_MS = 5_000;

export function invalidateSiteSettingsCache(): void {
  cache = null;
  cacheAt = 0;
}

/** Read the current site settings, creating the row on first access. */
export async function getSiteSettings(): Promise<PublicSiteSettings> {
  const now = Date.now();
  if (cache && now - cacheAt < TTL_MS) return cache;

  try {
    const [row] = await db.select().from(siteSettingsTable).limit(1);
    const settings: PublicSiteSettings = {
      maintenanceMode: row?.maintenanceMode ?? false,
      maintenanceMessage: row?.maintenanceMessage ?? "We're making FocusArx even better. Check back in a few minutes.",
      announcementEnabled: row?.announcementEnabled ?? false,
      announcementTitle: row?.announcementTitle ?? null,
      announcementText: row?.announcementText ?? null,
      announcementEmoji: row?.announcementEmoji ?? null,
      brandingName: row?.brandingName ?? "FocusArx",
      brandingTagline: row?.brandingTagline ?? null,
    };
    cache = settings;
    cacheAt = now;
    return settings;
  } catch (err) {
    logger.warn({ err }, "site settings read failed — returning defaults");
    return {
      maintenanceMode: false,
      maintenanceMessage: "We're making FocusArx even better. Check back in a few minutes.",
      announcementEnabled: false,
      announcementTitle: null,
      announcementText: null,
      announcementEmoji: null,
      brandingName: "FocusArx",
      brandingTagline: null,
    };
  }
}

/** Check maintenance mode (used by the API gate middleware). */
export async function isMaintenanceMode(): Promise<boolean> {
  return (await getSiteSettings()).maintenanceMode;
}
