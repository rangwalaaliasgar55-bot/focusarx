import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Trophy, Users } from "lucide-react";
import { apiJson } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type CommunityStats = {
  focusingNow: number;
  communityMembers: number;
  topPerformerToday: { firstName: string; minutes: number } | null;
  yourWeeklyRank: number | null;
};

/**
 * Dashboard social proof (audit Gap 2): live "focusing right now" counter,
 * today's top performer, community size and the user's weekly XP rank.
 */
export default function CommunityNow() {
  const { status } = useAuth();
  const enabled = status === "authenticated";

  const query = useQuery<CommunityStats>({
    queryKey: ["stats-community"],
    queryFn: () => apiJson<CommunityStats>("/api/stats/community"),
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  // Stay invisible while loading or on failure — never block the dashboard.
  if (!enabled || query.isLoading || query.isError || !query.data) return null;
  const stats = query.data;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card interactive className="overflow-hidden">
        <CardContent className="flex flex-col gap-5 py-5 sm:flex-row sm:items-center sm:gap-8">
          <div className="flex items-center gap-3">
            <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--success-soft)]">
              <span className="absolute inset-0 animate-ping rounded-full bg-[var(--success)]/20" aria-hidden="true" />
              <Users className="size-5 text-[var(--success)]" />
            </span>
            <div>
              <p className="text-2xl font-semibold tabular-nums leading-none">{stats.focusingNow}</p>
              <p className="mt-1 text-xs font-medium text-[var(--foreground-muted)]">
                {stats.focusingNow === 1 ? "learner focusing right now" : "learners focusing right now"}
              </p>
            </div>
          </div>

          <div className="hidden h-10 w-px bg-[var(--border-subtle)] sm:block" aria-hidden="true" />

          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-lg)] bg-[var(--warning-soft)]">
              <Trophy className="size-4 text-[var(--warning)]" />
            </span>
            <p className="min-w-0 truncate text-sm text-[var(--foreground-muted)]">
              {stats.topPerformerToday ? (
                <>
                  Top today: <span className="font-semibold text-[var(--foreground)]">{stats.topPerformerToday.firstName}</span>{" "}
                  · {stats.topPerformerToday.minutes}m focused
                </>
              ) : (
                <>No sessions yet today — claim the top spot 🚀</>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-lg)] bg-[var(--brand-soft)]">
              <TrendingUp className="size-4 text-[var(--brand-strong)]" />
            </span>
            <p className="text-sm text-[var(--foreground-muted)]">
              {stats.yourWeeklyRank ? (
                <>
                  Your weekly rank: <span className="font-semibold text-[var(--foreground)]">#{stats.yourWeeklyRank}</span>
                </>
              ) : (
                <>Complete a session to enter the weekly ranks</>
              )}
            </p>
          </div>

          <p className="sr-only">{stats.communityMembers} learners in the FocusArx community.</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function CommunityNowSkeleton() {
  return <Skeleton className="h-24" />;
}
