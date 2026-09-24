import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Check, Gift, Target, Users, Flame } from "lucide-react";
import { apiJson, asArray, asNumber, asRecord, asString, errorMessage } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

/**
 * Today's missions, on the dashboard.
 *
 * The mission board already existed — twelve daily missions, ten weekly, a
 * featured mission of the day, and a count of how many students have cleared it
 * — but it lives behind `/missions`, which means a student has to *choose* to go
 * and look. The daily loop is the opposite of that: the thing that brings
 * someone back has to be on the page they land on, with the progress and the
 * one next step already visible.
 *
 * Three things make this a loop rather than a list:
 *   • **progress you can see** — "3 of 12" with a bar, so today's work has a
 *     visible end;
 *   • **one mission in front** — the featured pick, with its reward in coins and
 *     XP stated, and a Claim button the moment it is done;
 *   • **other people** — how many students have cleared that same mission in the
 *     last 24 hours, because a shared daily goal is what makes a streak feel
 *     like a habit rather than a chore.
 *
 * Everything is normalised before render: this sits above the fold on the page
 * students open most, so a missing field must degrade to a smaller card, never a
 * blank dashboard.
 */
interface Mission {
  key: string;
  title: string;
  description: string;
  type: "daily" | "weekly" | string;
  xpReward: number;
  coinReward: number;
  targetValue: number;
  unit: string;
  currentValue: number;
  completed: boolean;
  rewardClaimed: boolean;
}

interface MissionsPayload {
  daily: Mission[];
  weekly: Mission[];
  featured: (Mission & { completionsLast24h?: number; reason?: string }) | null;
  stats: { dailyCompleted: number; totalDaily: number; weeklyCompleted: number; totalWeekly: number };
}

function readMission(value: unknown): Mission {
  const raw = asRecord(value);
  return {
    key: asString(raw.key),
    title: asString(raw.title, "Mission"),
    description: asString(raw.description),
    type: asString(raw.type, "daily"),
    xpReward: asNumber(raw.xpReward),
    coinReward: asNumber(raw.coinReward),
    targetValue: asNumber(raw.targetValue),
    unit: asString(raw.unit),
    currentValue: asNumber(raw.currentValue),
    completed: raw.completed === true,
    rewardClaimed: raw.rewardClaimed === true,
  };
}

function readMissions(payload: unknown): MissionsPayload {
  const raw = asRecord(payload);
  const stats = asRecord(raw.stats);
  const daily = asArray<unknown>(raw.daily).map(readMission);
  const featuredRaw = raw.featured;
  return {
    daily,
    weekly: asArray<unknown>(raw.weekly).map(readMission),
    featured: featuredRaw ? { ...readMission(featuredRaw), completionsLast24h: asNumber(asRecord(featuredRaw).completionsLast24h) } : null,
    stats: {
      dailyCompleted: asNumber(stats.dailyCompleted),
      totalDaily: asNumber(stats.totalDaily, daily.length),
      weeklyCompleted: asNumber(stats.weeklyCompleted),
      totalWeekly: asNumber(stats.totalWeekly),
    },
  };
}

/** "25 of 60 minutes" — the unit is what the mission counts, so show it. */
function progressLabel(mission: Mission): string {
  const unit = mission.unit === "streak_days" ? "days" : mission.unit;
  return `${Math.min(mission.currentValue, mission.targetValue)} of ${mission.targetValue} ${unit}`;
}

export function DailyMissionsStrip() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery<MissionsPayload>({
    queryKey: ["missions"],
    queryFn: async () => readMissions(await apiJson("/api/missions")),
    staleTime: 60_000,
  });

  const claim = useMutation({
    mutationFn: (key: string) => apiJson<Record<string, unknown>>(`/api/missions/${key}/claim`, { method: "POST" }),
    onSuccess: (res) => {
      const r = asRecord(res);
      const coins = asNumber(r.coinsEarned);
      const xp = asNumber(r.xpEarned);
      const parts = [coins > 0 ? `+${coins} coins` : "", xp > 0 ? `+${xp} XP` : ""].filter(Boolean);
      toast(parts.length > 0 ? `Claimed ${parts.join(" · ")}` : "Reward claimed", "success");
      void qc.invalidateQueries({ queryKey: ["missions"] });
      void qc.invalidateQueries({ queryKey: ["wallet"] });
      void qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      void qc.invalidateQueries({ queryKey: ["battle-pass-enhanced"] });
    },
    onError: (e: unknown) => toast(errorMessage(e, "Could not claim that reward"), "error"),
  });

  if (isLoading || isError || !data || data.stats.totalDaily === 0) return null;

  const { dailyCompleted, totalDaily } = data.stats;
  const allDailyDone = totalDaily > 0 && dailyCompleted >= totalDaily;
  const featured = data.featured;
  const featuredProgress = featured
    ? Math.min(100, Math.round((Math.min(featured.currentValue, featured.targetValue) / Math.max(1, featured.targetValue)) * 100))
    : 0;
  const claimable = data.daily.filter((m) => m.completed && !m.rewardClaimed).length;

  return (
    <section
      aria-labelledby="daily-missions-title"
      className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface)] p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="daily-missions-title" className="flex items-center gap-2 text-sm font-semibold">
            <Target aria-hidden className="size-4 text-[var(--brand-teal)]" />
            {allDailyDone ? "Today's missions — all cleared" : "Today's missions"}
          </h2>
          <p className="mt-1 text-xs text-[var(--foreground-muted)]">
            {allDailyDone
              ? "Every daily mission is done. They reset at midnight, and tomorrow's streak continues from here."
              : `${dailyCompleted} of ${totalDaily} done today · resets at midnight`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {claimable > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--palette-emerald-500)]/15 px-3 py-1 text-[11px] font-semibold text-[var(--palette-emerald-400)]">
              <Gift aria-hidden className="size-3" />
              {claimable} to claim
            </span>
          )}
          <Link
            href="/missions"
            className="inline-flex min-h-9 items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 text-xs font-semibold text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
          >
            All missions
          </Link>
        </div>
      </div>

      <Progress
        value={(dailyCompleted / Math.max(1, totalDaily)) * 100}
        aria-label={`${dailyCompleted} of ${totalDaily} daily missions completed`}
        className="mt-3"
      />

      {featured && (
        <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">
                Mission of the day{featured.type === "weekly" ? " · weekly" : ""}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
                <Flame aria-hidden className="size-4 text-[var(--palette-amber-400)]" />
                {featured.title}
              </p>
              <p className="mt-1 text-xs text-[var(--foreground-muted)]">{featured.description}</p>
              <p className="mt-1.5 text-[11px] text-[var(--foreground-subtle)]">
                {progressLabel(featured)} · pays {featured.coinReward} coins and {featured.xpReward} XP
              </p>
              {(featured.completionsLast24h ?? 0) > 0 && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-[var(--foreground-subtle)]">
                  <Users aria-hidden className="size-3" />
                  {featured.completionsLast24h} students cleared this in the last 24 hours
                </p>
              )}
            </div>
            <div className="shrink-0">
              {featured.rewardClaimed ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--palette-emerald-400)]">
                  <Check aria-hidden className="size-3.5" /> Claimed
                </span>
              ) : featured.completed ? (
                <Button
                  size="sm"
                  onClick={() => claim.mutate(featured.key)}
                  disabled={claim.isPending}
                >
                  <Gift aria-hidden className="size-3.5" />
                  {claim.isPending ? "Claiming…" : "Claim reward"}
                </Button>
              ) : (
                <div className="w-28">
                  <Progress value={featuredProgress} aria-label={progressLabel(featured)} />
                  <p className="mt-1 text-right text-[11px] text-[var(--foreground-subtle)]">{featuredProgress}%</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
