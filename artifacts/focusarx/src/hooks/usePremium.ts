import { useQuery } from "@tanstack/react-query";
import { getToken } from "@/lib/auth";

/**
 * Hook to check whether the current user has an active Premium subscription.
 * Returns `{ isPremium, isLoading, benefits }`.
 */
export function usePremium() {
  const { data, isLoading } = useQuery({
    queryKey: ["premium-status"],
    queryFn: async () => {
      const token = getToken();
      if (!token) return { isPremium: false, benefits: [] as string[] };
      const res = await fetch("/api/premium/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { isPremium: false, benefits: [] as string[] };
      const json = (await res.json()) as { isPremium: boolean; benefits?: string[] };
      return { isPremium: json.isPremium ?? false, benefits: json.benefits ?? [] };
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  return {
    isPremium: data?.isPremium ?? false,
    benefits: data?.benefits ?? [],
    isLoading,
  };
}
