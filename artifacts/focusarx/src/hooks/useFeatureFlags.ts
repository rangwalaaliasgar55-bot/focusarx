import { useQuery } from "@tanstack/react-query";

/**
 * Feature flags, finally consumed by the app.
 *
 * The backend has served `GET /api/feature-flags` for a long time and the admin
 * panel could create flags — but nothing read them, so flipping one changed
 * exactly nothing. This hook is the missing consumer.
 *
 * Two rules make it safe to put in front of real features:
 *
 *  1. **Fail-open.** If the request errors (offline, API restarting, table not
 *     migrated) every flag reads as `true`. A flag endpoint going down must
 *     never turn features off for users — that is an outage caused by a
 *     monitoring convenience.
 *  2. **One fetch per session-ish.** Five-minute stale time, no refetch on
 *     focus: flags are a kill switch, not live data, and re-rendering the whole
 *     shell to re-read them is worse than being five minutes behind a flip.
 */
export interface FeatureFlagState {
  /** Raw flag map from the server: key → enabled. */
  flags: Record<string, boolean>;
  /** Is a feature on? Unknown keys default to `true` (see rule 1). */
  isOn: (key: string) => boolean;
  /** True once the first fetch has settled (either way). */
  ready: boolean;
}

export const FEATURE_FLAG_KEYS = {
  lootBoxes: "lootboxes",
  marketplace: "marketplace",
  leaderboard: "leaderboard",
  social: "community",
  dreams: "dreams",
  voiceAssistant: "voice_assistant",
  lootBoxReveal: "lootbox_reveal_animation",
} as const;

export function useFeatureFlags(): FeatureFlagState {
  const { data, isSuccess, isError } = useQuery<Record<string, boolean>>({
    queryKey: ["feature-flags"],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      const res = await fetch("/api/feature-flags");
      if (!res.ok) throw new Error("flags unavailable");
      const json = await res.json();
      return (json?.flags ?? {}) as Record<string, boolean>;
    },
  });

  const flags = data ?? {};
  return {
    flags,
    isOn: (key: string) => {
      if (isError) return true;      // rule 1: fail open
      if (!isSuccess) return true;   // first paint: never flash a feature away
      return flags[key] !== false;
    },
    ready: isSuccess || isError,
  };
}
