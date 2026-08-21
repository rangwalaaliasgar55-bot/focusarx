import { useEffect, useState } from "react";

/** Public site settings shape returned by GET /api/site/settings. */
export interface SiteSettings {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  announcementEnabled: boolean;
  announcementTitle: string | null;
  announcementText: string | null;
  announcementEmoji: string | null;
  brandingName: string;
  brandingTagline: string | null;
}

const DEFAULTS: SiteSettings = {
  maintenanceMode: false,
  maintenanceMessage: "We're making FocusArx even better. Check back in a few minutes.",
  announcementEnabled: false,
  announcementTitle: null,
  announcementText: null,
  announcementEmoji: null,
  brandingName: "FocusArx",
  brandingTagline: null,
};

/**
 * Fetch + poll the public site settings (maintenance mode, announcement,
 * branding). Polls every 30s so an admin toggle takes effect app-wide without
 * a reload. Never throws — falls back to safe defaults so the app always works
 * even if the API is unreachable.
 */
export function useSiteSettings(): SiteSettings {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULTS);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const res = await fetch("/api/site/settings");
        if (!res.ok) return;
        const data = (await res.json()) as Partial<SiteSettings>;
        if (alive) setSettings({ ...DEFAULTS, ...data });
      } catch {
        // Offline / API down — keep defaults.
      }
    };

    void load();
    const id = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return settings;
}
