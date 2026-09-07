import { useQuery, type QueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api";
import { getToken } from "@/lib/auth";

/**
 * Single source of truth for `/api/missions` in the client.
 *
 * Every consumer (nav badges, dashboard widget, missions page) MUST share the
 * same cache entry *and* the same data shape. Before this module the sidebar
 * badge cached a `number` under `["missions-badge"]` while the dashboard
 * widget cached the full `{ daily, weekly, stats }` object under the same key
 * — so whichever fetched second handed the other an unexpected type and React
 * threw minified error #31 ("Objects are not valid as a React child") when
 * navigating back to the dashboard.
 */

export interface MissionDef {
  key: string;
  title: string;
  description: string;
  type: "daily" | "weekly";
  xpReward: number;
  coinReward: number;
  targetValue: number;
  icon: string;
  difficulty: "easy" | "medium" | "hard" | "epic";
  currentValue: number;
  completed: boolean;
  rewardClaimed: boolean;
}

export type MissionsData = {
  daily: MissionDef[];
  weekly: MissionDef[];
  stats: {
    dailyCompleted: number;
    totalDaily: number;
    weeklyCompleted?: number;
    totalWeekly?: number;
  } | null;
};

export const MISSIONS_QUERY_KEY = ["missions"] as const;

const EMPTY: MissionsData = { daily: [], weekly: [], stats: null };

function asMissionList(value: unknown): MissionDef[] {
  return Array.isArray(value) ? (value as MissionDef[]) : [];
}

/** Defensive normaliser — the UI must never receive a non-object payload. */
export function normalizeMissions(raw: unknown): MissionsData {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return EMPTY;
  const data = raw as Partial<MissionsData>;
  return {
    daily: asMissionList(data.daily),
    weekly: asMissionList(data.weekly),
    stats: data.stats && typeof data.stats === "object" ? data.stats : null,
  };
}

export async function fetchMissions(): Promise<MissionsData> {
  if (!getToken()) return EMPTY;
  const raw = await apiJson<unknown>("/api/missions");
  return normalizeMissions(raw);
}

export function countClaimable(data: MissionsData | undefined): number {
  if (!data) return 0;
  return [...data.daily, ...data.weekly].filter((m) => m.completed && !m.rewardClaimed).length;
}

export function useMissionsQuery<T = MissionsData>(options?: {
  select?: (data: MissionsData) => T;
  enabled?: boolean;
  refetchInterval?: number;
}) {
  return useQuery<MissionsData, Error, T>({
    queryKey: MISSIONS_QUERY_KEY,
    queryFn: fetchMissions,
    staleTime: 30_000,
    refetchInterval: options?.refetchInterval ?? 120_000,
    enabled: options?.enabled,
    select: options?.select,
  });
}

/** Count of missions ready to claim — used by the navigation badges. */
export function useClaimableMissionCount() {
  return useMissionsQuery({ select: countClaimable });
}

export function claimMission(key: string) {
  return apiJson<{ xpEarned: number; coinsEarned: number }>(`/api/missions/${encodeURIComponent(key)}/claim`, {
    method: "POST",
    body: "{}",
  });
}

/** Invalidate everything a mission claim can change. */
export function invalidateAfterMissionClaim(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: MISSIONS_QUERY_KEY });
  void qc.invalidateQueries({ queryKey: ["wallet"] });
  void qc.invalidateQueries({ queryKey: ["stats"] });
}
