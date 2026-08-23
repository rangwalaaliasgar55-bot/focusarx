import { useState } from "react";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Snowflake, ShieldCheck, Flame } from "lucide-react";
import { apiJson } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type StreakInfo = { currentStreak: number; longestStreak: number; lastStudyDate: string | null };
type FreezeInfo = { tokens: number; used: number };

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function protectionKey() {
  return `focusarx-freeze-used-${todayKey()}`;
}

/**
 * Surfaces the streak-freeze system (freeze_tokens table + /api/retention
 * endpoints) on the dashboard. Shows a warning banner when the streak is at
 * risk (no session logged today), with a one-click "use freeze" action, and
 * a compact banked-tokens chip otherwise.
 */
export default function StreakFreezeCard() {
  const { status } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [protectedToday, setProtectedToday] = useState(() => localStorage.getItem(protectionKey()) === "1");

  const enabled = status === "authenticated";
  const streakQuery = useQuery<StreakInfo>({
    queryKey: ["stats-streak"],
    queryFn: async () => (await apiJson<{ streak: StreakInfo }>("/api/stats/streak")).streak,
    enabled,
    staleTime: 60_000,
  });
  const freezeQuery = useQuery<FreezeInfo>({
    queryKey: ["freeze-tokens"],
    queryFn: () => apiJson<FreezeInfo>("/api/retention/freeze-tokens"),
    enabled,
    staleTime: 60_000,
  });

  const useFreeze = useMutation({
    mutationFn: () => apiJson("/api/retention/freeze-tokens/use", { method: "POST" }),
    onSuccess: () => {
      localStorage.setItem(protectionKey(), "1");
      setProtectedToday(true);
      void queryClient.invalidateQueries({ queryKey: ["freeze-tokens"] });
      toast("Streak protected for today ❄️", "success");
    },
    onError: () => toast("Could not use a freeze token", "danger"),
  });

  const streak = streakQuery.data;
  const freeze = freezeQuery.data;
  if (!enabled || !streak || !freeze) return null;

  const atRisk = streak.currentStreak > 0 && streak.lastStudyDate !== todayKey() && !protectedToday;

  // Nothing meaningful to show for brand-new users with no streak and no tokens.
  if (!atRisk && !protectedToday && freeze.tokens === 0 && streak.currentStreak === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card elevation={atRisk ? "glow" : undefined} className={atRisk ? "border-[var(--warning)]/40" : undefined}>
        <CardContent className="flex flex-wrap items-center gap-4 py-4">
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--radius-lg)] [&_svg]:size-5"
            style={{
              color: atRisk ? "var(--warning)" : "var(--brand-strong)",
              background: atRisk ? "var(--warning-soft)" : "var(--brand-soft)",
            }}
          >
            {protectedToday ? <ShieldCheck /> : <Snowflake />}
          </span>

          {atRisk ? (
            <>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  Your {streak.currentStreak}-day streak is at risk{" "}
                  <Flame className="inline size-4 text-[var(--warning)]" />
                </p>
                <p className="mt-0.5 text-xs text-[var(--foreground-muted)]">
                  No session yet today. Finish one to keep it alive — or spend a freeze and stay protected.
                </p>
              </div>
              {freeze.tokens > 0 ? (
                <Button size="sm" onClick={() => useFreeze.mutate()} loading={useFreeze.isPending}>
                  <Snowflake /> Use freeze
                </Button>
              ) : (
                <Button asChild size="sm" variant="outline">
                  <Link href="/battle-pass">Earn freezes</Link>
                </Button>
              )}
              <Badge variant="secondary">❄️ {freeze.tokens} banked</Badge>
            </>
          ) : protectedToday ? (
            <>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Streak protected for today</p>
                <p className="mt-0.5 text-xs text-[var(--foreground-muted)]">
                  A freeze token is covering you — your {streak.currentStreak}-day streak keeps counting.
                </p>
              </div>
              <Badge variant="secondary">❄️ {Math.max(0, freeze.tokens)} left</Badge>
            </>
          ) : (
            <>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{freeze.tokens} freeze token{freeze.tokens === 1 ? "" : "s"} banked</p>
                <p className="mt-0.5 text-xs text-[var(--foreground-muted)]">
                  Miss a day and a token keeps your {streak.currentStreak}-day streak alive automatically.
                </p>
              </div>
              <Badge variant="secondary"><Snowflake className="size-3" /> Insurance active</Badge>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
