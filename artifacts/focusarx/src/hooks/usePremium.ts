import { useQuery } from "@tanstack/react-query";
import { getToken, useAuth } from "@/lib/auth";
import { isMembershipTier, type MembershipTier } from "@/lib/membershipSkin";

interface PremiumPlanSummary {
  id: string;
  slug?: string;
  name: string;
  tokenCost: number;
  durationDays?: number;
  benefits?: string[];
}

interface PremiumStatusPayload {
  isPremium?: boolean;
  tier?: string;
  status?: "active" | "expiring_soon" | "expired" | "inactive";
  expiresAt?: string | null;
  benefits?: string[];
  balance?: number;
  plans?: PremiumPlanSummary[];
}

interface PremiumState {
  isPremium: boolean;
  tier: MembershipTier;
  status: "active" | "expiring_soon" | "expired" | "inactive";
  expiresAt: string | null;
  benefits: string[];
  balance: number;
  cheapestCost: number;
  plans: PremiumPlanSummary[];
}

const FREE_STATE: PremiumState = {
  isPremium: false,
  tier: "free",
  status: "inactive",
  expiresAt: null,
  benefits: [],
  balance: 0,
  cheapestCost: 10000,
  plans: [],
};

/**
 * Hook to check whether the current user has an active Premium subscription.
 * Returns `{ isPremium, tier, isLoading, benefits, balance, cheapestCost }`.
 *
 * `tier` is a cosmetic label (`free` | `plus` | `pro` | `elite`) used for
 * things like the timer skin — gates must keep using `isPremium`.
 * No AI model is loaded when not premium - blocked at gate level.
 */
export function usePremium() {
  const { status } = useAuth();
  const { data, isLoading } = useQuery<PremiumState>({
    queryKey: ["premium-status"],
    enabled: status === "authenticated",
    queryFn: async () => {
      const token = getToken();
      // Auth is cookie-first. Missing localStorage credentials do not mean a
      // signed-in user is free (e.g. private mode or a refreshed cookie session).
      const res = await fetch("/api/premium/status", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      if (!res.ok) return FREE_STATE;
      const json = (await res.json().catch(() => ({}))) as PremiumStatusPayload;
      const plans = Array.isArray(json.plans) ? json.plans : [];
      const costs = plans.map(p => Number(p?.tokenCost)).filter(n => Number.isFinite(n) && n > 0);
      const cheapest = costs.length ? Math.min(...costs) : 10000;
      const isPremium = json.isPremium === true;
      // Older API builds don't send `tier`; any premium user is at least Plus.
      const tier: MembershipTier = !isPremium ? "free" : isMembershipTier(json.tier) && json.tier !== "free" ? json.tier : "plus";
      return {
        isPremium,
        tier,
        status: json.status ?? (isPremium ? "active" : "inactive"),
        expiresAt: json.expiresAt ?? null,
        benefits: Array.isArray(json.benefits) ? json.benefits : [],
        balance: Number.isFinite(Number(json.balance)) ? Number(json.balance) : 0,
        cheapestCost: cheapest,
        plans,
      };
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  const state = data ?? FREE_STATE;
  return {
    isPremium: state.isPremium,
    tier: state.tier,
    membershipStatus: state.status,
    expiresAt: state.expiresAt,
    benefits: state.benefits,
    balance: state.balance,
    cheapestCost: state.cheapestCost,
    plans: state.plans,
    isLoading,
  };
}
