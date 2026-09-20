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
 *  1. **Explicit defaults.** Core and established flags fail open. Secondary
 *     product areas default off until an admin enables their row. Their routes
 *     continue to work directly; this only keeps an unconfigured shell focused.
 *  2. **One fetch per session-ish.** Five-minute stale time, no refetch on
 *     focus: flags are a kill switch, not live data, and re-rendering the whole
 *     shell to re-read them is worse than being five minutes behind a flip.
 */
export interface FeatureFlagState {
  /** Raw flag map from the server: key → enabled. */
  flags: Record<string, boolean>;
  /** Is a feature on? Unknown core keys default on; secondary areas default off. */
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
  city: "focus_city",
  pets: "pets",
  missions: "missions",
  quests: "quests",
  achievements: "achievements",
  habits: "habits",
  groups: "study_groups",
  messages: "messages",
  wallet: "wallet_rewards",
  shop: "rewards_shop",
} as const;

const DEFAULT_OFF_FLAGS = new Set<string>([
  FEATURE_FLAG_KEYS.city,
  FEATURE_FLAG_KEYS.pets,
  FEATURE_FLAG_KEYS.missions,
  FEATURE_FLAG_KEYS.quests,
  FEATURE_FLAG_KEYS.achievements,
  FEATURE_FLAG_KEYS.habits,
  FEATURE_FLAG_KEYS.groups,
  FEATURE_FLAG_KEYS.messages,
  FEATURE_FLAG_KEYS.wallet,
  FEATURE_FLAG_KEYS.shop,
]);

function shippedDefault(key: string): boolean {
  return !DEFAULT_OFF_FLAGS.has(key);
}

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
      const fallback = shippedDefault(key);
      if (isError || !isSuccess) return fallback;
      return flags[key] ?? fallback;
    },
    ready: isSuccess || isError,
  };
}
