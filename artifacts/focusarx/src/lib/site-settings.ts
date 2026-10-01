import { useQuery } from "@tanstack/react-query";

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
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroCtaText: string | null;
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
  heroTitle: null,
  heroSubtitle: null,
  heroCtaText: null,
};

async function fetchSiteSettings(): Promise<SiteSettings> {
  try {
    const res = await fetch("/api/site/settings");
    if (!res.ok) return DEFAULTS;
    const data = (await res.json()) as Partial<SiteSettings>;
    return { ...DEFAULTS, ...data };
  } catch {
    // Offline / API down — keep defaults.
    return DEFAULTS;
  }
}

/**
 * Public site settings (maintenance mode, announcement, branding).
 *
 * This used to be a raw useEffect + setInterval per consumer, so every mounted
 * consumer (MaintenanceGate, AnnouncementBanner, …) fired its own request AND
 * its own 30-second poller for the same URL — duplicate boot traffic on every
 * page load, forever. As a React Query hook the identical queryKey collapses
 * all consumers into one cached request and one shared poller, whatever the
 * mount count. Never throws — falls back to safe defaults so the app always
 * works even if the API is unreachable.
 */
export function useSiteSettings(): SiteSettings {
  const { data } = useQuery({
    queryKey: ["site-settings"],
    queryFn: fetchSiteSettings,
    staleTime: 30_000,
    refetchInterval: 30_000,
    // Settings degrade to defaults offline; a failed poll must not spam the
    // global error toast (it also fires for the maintenance gate's own use).
    retry: false,
  });
  return data ?? DEFAULTS;
}
