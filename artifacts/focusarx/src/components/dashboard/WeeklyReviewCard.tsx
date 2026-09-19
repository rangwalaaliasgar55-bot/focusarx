import { useMemo } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { CalendarRange, Lightbulb } from "lucide-react";
import { apiJson } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendPill } from "@/components/ui/trend-pill";
import type { Trend } from "@/types/trend";

/**
 * Rebuild a `Trend` for a payload that predates `weekComparison.trend`.
 *
 * Deliberately derived from the two minute totals rather than from the legacy
 * `changePercent`, which is the field this exists to stop trusting.
 */
function legacyWeekTrend(wc: { thisWeekMinutes: number; lastWeekMinutes: number }): Trend {
  const delta = wc.thisWeekMinutes - wc.lastWeekMinutes;
  const bothEmpty = wc.thisWeekMinutes === 0 && wc.lastWeekMinutes === 0;
  return {
    direction: bothEmpty ? "unknown" : delta === 0 ? "flat" : delta > 0 ? "up" : "down",
    delta,
    percent: !bothEmpty && wc.lastWeekMinutes >= 5 ? (delta / wc.lastWeekMinutes) * 100 : null,
    comparison: "last week",
    comparable: !bothEmpty,
  };
}

type AnalyticsPayload = {
  hourDist: Array<{ hour: number; minutes: number }>;
  weekBarData: Array<{ day: string; date: string; minutes: number }>;
  weekComparison: {
    thisWeekMinutes: number;
    lastWeekMinutes: number;
    /** Legacy and untrustworthy (the server fabricated 100 / 0). Use `trend`. */
    changePercent: number;
    /** Optional so a response cached before this field existed still loads. */
    trend?: Trend;
  };
  personalBests: {
    longestSessionMinutes: number;
    bestDayMinutes: number;
    totalSessions: number;
    totalMinutes: number;
    longestStreak: number;
  };
};

function peakHourLabel(hourDist: AnalyticsPayload["hourDist"]): string | null {
  const best = [...hourDist].sort((a, b) => b.minutes - a.minutes)[0];
  if (!best || best.minutes < 30) return null; // not enough signal
  const h = best.hour % 12 === 0 ? 12 : best.hour % 12;
  const suffix = best.hour < 12 ? "AM" : "PM";
  return `${h} ${suffix}`;
}

/**
 * Weekly review / wrapped card (audit H4): this-week vs last-week minutes,
 * personal-best context and one pattern insight. Reads the existing
 * /api/stats/analytics payload — no new backend surface.
 */
export default function WeeklyReviewCard() {
  const { status } = useAuth();
  const query = useQuery<AnalyticsPayload>({
    queryKey: ["stats-analytics"],
    queryFn: () => apiJson<AnalyticsPayload>("/api/analytics"),
    enabled: status === "authenticated",
    staleTime: 5 * 60_000,
  });

  const data = query.data;

  const insights = useMemo(() => {
    if (!data) return [] as string[];
    const out: string[] = [];
    const peak = peakHourLabel(data.hourDist);
    if (peak) out.push(`You focus sharpest around ${peak} — protect that slot.`);
    const bestDay = [...data.weekBarData].sort((a, b) => b.minutes - a.minutes)[0];
    if (bestDay && bestDay.minutes > 0) out.push(`Strongest day this week: ${bestDay.day} with ${bestDay.minutes} focused minutes.`);
    if (data.personalBests.longestStreak > 0) out.push(`Longest streak on record: ${data.personalBests.longestStreak} days.`);
    return out.slice(0, 2);
  }, [data]);

  // Stay hidden while loading, on failure, or when there is nothing to review yet.
  if (status !== "authenticated" || !query.isSuccess || !data) return null;
  if (data.weekComparison.thisWeekMinutes === 0 && data.weekComparison.lastWeekMinutes === 0) return null;

  const { thisWeekMinutes, lastWeekMinutes } = data.weekComparison;
  // The badge used to read `changePercent`, which the server fabricated as 100
  // when last week was empty and 0 when both weeks were — so a first-ever week
  // showed a confident "+100%" and a dormant account showed "+0%". The trend
  // distinguishes those from a real measurement.
  const trend = data.weekComparison.trend ?? legacyWeekTrend(data.weekComparison);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25}}>
      <Card>
        <CardHeader className="flex-row items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><CalendarRange className="text-[var(--brand-strong)]" /> Your week in review</CardTitle>
            <CardDescription>This week vs last week of protected focus time.</CardDescription>
          </div>
          <TrendPill trend={trend} className="text-xs" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
            <div>
              <p className="text-3xl font-semibold tabular-nums leading-none">{thisWeekMinutes.toLocaleString()}<span className="ml-1 text-sm font-normal text-[var(--foreground-subtle)]">min</span></p>
              <p className="mt-1 text-xs text-[var(--foreground-muted)]">this week</p>
            </div>
            <div>
              <p className="text-xl font-semibold tabular-nums leading-none text-[var(--foreground-muted)]">{lastWeekMinutes.toLocaleString()}<span className="ml-1 text-sm font-normal text-[var(--foreground-subtle)]">min</span></p>
              <p className="mt-1 text-xs text-[var(--foreground-subtle)]">last week</p>
            </div>
          </div>

          {insights.length > 0 && (
            <ul className="mt-4 space-y-2 border-t border-[var(--border-subtle)] pt-4">
              {insights.map((insight) => (
                <li key={insight} className="flex items-start gap-2 text-sm text-[var(--foreground-muted)]">
                  <Lightbulb className="mt-0.5 size-4 shrink-0 text-[var(--warning)]" />
                  {insight}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
