import { useQuery } from "@tanstack/react-query";
import { getToken } from "@/lib/auth";

/**
 * Hook to check whether the current user has an active Premium subscription.
 * Returns `{ isPremium, isLoading, benefits, balance, cheapestCost }`.
 * No AI model is loaded when not premium - blocked at gate level.
 */
export function usePremium() {
  const { data, isLoading } = useQuery({
    queryKey: ["premium-status"],
    queryFn: async () => {
      const token = getToken();
      if (!token) return { isPremium: false, benefits: [] as string[], balance: 0, cheapestCost: 10000, plans: [] as any[] };
      const res = await fetch("/api/premium/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { isPremium: false, benefits: [] as string[], balance: 0, cheapestCost: 10000, plans: [] as any[] };
      const json = (await res.json()) as { isPremium: boolean; benefits?: string[]; balance?: number; plans?: any[] };
      const plans = json.plans ?? [];
      const cheapest = plans.length ? Math.min(...plans.map((p: any) => p.tokenCost)) : 10000;
      return { isPremium: json.isPremium ?? false, benefits: json.benefits ?? [], balance: json.balance ?? 0, cheapestCost: cheapest, plans };
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  return {
    isPremium: data?.isPremium ?? false,
    benefits: data?.benefits ?? [],
    balance: data?.balance ?? 0,
    cheapestCost: data?.cheapestCost ?? 10000,
    plans: data?.plans ?? [],
    isLoading,
  };
}
