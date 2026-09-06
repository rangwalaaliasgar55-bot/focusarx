import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Target, Gift, ChevronRight } from "lucide-react";
import { apiJson } from "@/lib/api";

interface MissionDef {
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

const DIFF_COLOR: Record<string, string> = {
  easy:   "var(--success)",
  medium: "var(--color-warning)",
  hard:   "var(--danger)",
  epic:   "var(--brand-400)",
};

type MissionsData = { daily: MissionDef[]; weekly: MissionDef[]; stats: { dailyCompleted: number; totalDaily: number } | null };

// apiJson rather than a bare fetch: the access token is refreshed silently on
// 401, so the widget no longer blanks out after the first token rotation.
function fetchMissions(): Promise<MissionsData> {
  return apiJson<MissionsData>("/api/missions");
}

function claimMission(key: string) {
  return apiJson(`/api/missions/${key}/claim`, { method: "POST", body: "{}" });
}

export default function MissionsWidget() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["missions-badge"],
    queryFn: fetchMissions,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const claimMut = useMutation({
    mutationFn: claimMission,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["missions-badge"] });
      qc.invalidateQueries({ queryKey: ["missions"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
  });

  if (isLoading) {
    return (
      <div className="ui-panel p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-3 w-24 rounded bg-[var(--surface-hover)]" />
          <div className="h-8 w-full rounded bg-[var(--surface-hover)]" />
          <div className="h-8 w-full rounded bg-[var(--surface-hover)]" />
        </div>
      </div>
    );
  }

  const daily = data?.daily ?? [];
  const claimable = daily.filter((m) => m.completed && !m.rewardClaimed);
  const active = daily.filter((m) => !m.completed).slice(0, 3);
  const stats = data?.stats;

  const displayMissions = claimable.length > 0 ? claimable.slice(0, 2) : active.slice(0, 3);

  return (
    <div className="ui-panel p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target size={14} className="text-[var(--brand-400)]" />
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--brand-400)]">Daily Missions</span>
          {claimable.length > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--success)] text-[0.6875rem] font-bold text-[var(--neutral-0)]">
              {claimable.length}
            </span>
          )}
        </div>
        <Link href="/missions" className="flex items-center gap-1 text-[0.6875rem] text-[var(--foreground-subtle)] hover:text-[var(--brand-400)] transition-colors">
          View all <ChevronRight size={10} />
        </Link>
      </div>

      {/* Progress bar */}
      {stats && (
        <div className="mb-3">
          <div className="flex justify-between text-[0.6875rem] text-[var(--foreground-subtle)] mb-1">
            <span>{stats.dailyCompleted}/{stats.totalDaily} completed</span>
            <span>{Math.round((stats.dailyCompleted / Math.max(stats.totalDaily, 1)) * 100)}%</span>
          </div>
          <div className="h-1 rounded-full bg-[var(--surface-hover)] overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[var(--brand-600)] to-[var(--brand-400)]"
              initial={{ width: 0 }}
              animate={{ width: `${(stats.dailyCompleted / Math.max(stats.totalDaily, 1)) * 100}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
        </div>
      )}

      {/* Mission list */}
      <div className="space-y-2">
        {displayMissions.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-2xl mb-1">🎯</p>
            <p className="text-xs text-[var(--foreground-subtle)]">All daily missions done!</p>
            <Link href="/missions" className="text-[0.6875rem] text-[var(--brand-400)] hover:underline">Check weekly missions →</Link>
          </div>
        ) : (
          displayMissions.map((m) => {
            const pct = m.completed ? 100 : Math.min(99, Math.round((m.currentValue / Math.max(m.targetValue, 1)) * 100));
            const canClaim = m.completed && !m.rewardClaimed;

            return (
              <div
                key={m.key}
                className={`rounded-xl p-3 border transition-colors ${
                  canClaim
                    ? "border-[color-mix(in_srgb,var(--success)_35%,transparent)] bg-[var(--success-soft)]"
                    : "border-[var(--border-subtle)] bg-[var(--surface-hover)]"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <span className="text-lg leading-none mt-0.5 shrink-0">{m.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-[var(--foreground)] truncate">{m.title}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[0.6875rem] text-[var(--brand-400)] font-semibold">+{m.xpReward}xp</span>
                        {canClaim && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => claimMut.mutate(m.key)}
                            disabled={claimMut.isPending}
                            className="flex items-center gap-1 rounded-lg bg-[var(--success-soft)] border border-[color-mix(in_srgb,var(--success)_45%,transparent)] px-2 py-0.5 text-[0.6875rem] font-bold text-[var(--success)] hover:bg-[color-mix(in_srgb,var(--success)_35%,transparent)] transition-colors disabled:opacity-50"
                          >
                            <Gift size={9} /> Claim
                          </motion.button>
                        )}
                      </div>
                    </div>
                    <div className="mt-1.5 h-1 w-full rounded-full bg-[var(--surface-hover)] overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{
                          background: canClaim
                            ? "linear-gradient(90deg, var(--success), var(--success))"
                            : `linear-gradient(90deg, ${DIFF_COLOR[m.difficulty] ?? "var(--brand-600)"}, var(--brand-400))`,
                        }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                      />
                    </div>
                    <div className="flex justify-between mt-0.5">
                      <span className="text-[0.6875rem] text-[var(--foreground-subtle)]">
                        {m.completed ? "✓ Complete" : `${m.currentValue}/${m.targetValue}`}
                      </span>
                      <span className="text-[0.6875rem]" style={{ color: DIFF_COLOR[m.difficulty] ?? "var(--brand-600)" }}>
                        {m.difficulty}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* CTA if all done */}
      {stats && stats.totalDaily > 0 && stats.dailyCompleted === stats.totalDaily && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 rounded-xl border border-[color-mix(in_srgb,var(--success)_35%,transparent)] bg-[var(--success-soft)] p-3 text-center"
        >
          <p className="text-xs font-semibold text-[var(--success)]">🏆 All daily missions complete!</p>
          <Link href="/missions" className="mt-1 block text-[0.6875rem] text-[var(--foreground-subtle)] hover:text-[var(--success)] transition-colors">
            Check weekly missions →
          </Link>
        </motion.div>
      )}
    </div>
  );
}
