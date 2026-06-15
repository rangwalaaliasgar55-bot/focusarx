import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { Target, Gift, ChevronRight, Zap } from "lucide-react";
import { getToken } from "@/lib/auth";

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
  easy:   "#22d387",
  medium: "#f59e0b",
  hard:   "#f87171",
  epic:   "#a78bfa",
};

async function fetchMissions(): Promise<{ daily: MissionDef[]; weekly: MissionDef[]; stats: any }> {
  const token = getToken();
  const res = await fetch("/api/missions", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function claimMission(key: string) {
  const token = getToken();
  const res = await fetch(`/api/missions/${key}/claim`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error("Failed to claim");
  return res.json();
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
      <div className="rounded-2xl border border-[rgba(124,58,237,0.15)] bg-[rgba(13,15,26,0.6)] p-4 backdrop-blur-xl">
        <div className="animate-pulse space-y-2">
          <div className="h-3 w-24 rounded bg-[rgba(255,255,255,0.025)]" />
          <div className="h-8 w-full rounded bg-[rgba(255,255,255,0.025)]" />
          <div className="h-8 w-full rounded bg-[rgba(255,255,255,0.025)]" />
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
    <div className="rounded-2xl border border-[rgba(124,58,237,0.15)] bg-[rgba(13,15,26,0.6)] p-4 backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target size={14} className="text-[#A78BFA]" />
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#A78BFA]">Daily Missions</span>
          {claimable.length > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#22d387] text-[9px] font-bold text-black">
              {claimable.length}
            </span>
          )}
        </div>
        <Link href="/missions" className="flex items-center gap-1 text-[10px] text-[#4B5563] hover:text-[#A78BFA] transition-colors">
          View all <ChevronRight size={10} />
        </Link>
      </div>

      {/* Progress bar */}
      {stats && (
        <div className="mb-3">
          <div className="flex justify-between text-[9px] text-[#4B5563] mb-1">
            <span>{stats.dailyCompleted}/{stats.totalDaily} completed</span>
            <span>{Math.round((stats.dailyCompleted / Math.max(stats.totalDaily, 1)) * 100)}%</span>
          </div>
          <div className="h-1 rounded-full bg-[rgba(255,255,255,0.025)] overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#7c3aed] to-[#a78bfa]"
              initial={{ width: 0 }}
              animate={{ width: `${(stats.dailyCompleted / Math.max(stats.totalDaily, 1)) * 100}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>
      )}

      {/* Mission list */}
      <div className="space-y-2">
        {displayMissions.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-2xl mb-1">🎯</p>
            <p className="text-xs text-[#4B5563]">All daily missions done!</p>
            <Link href="/missions" className="text-[10px] text-[#A78BFA] hover:underline">Check weekly missions →</Link>
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
                    ? "border-[rgba(34,211,135,0.3)] bg-[rgba(34,211,135,0.05)]"
                    : "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <span className="text-lg leading-none mt-0.5 shrink-0">{m.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-[#E2E8F0] truncate">{m.title}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[9px] text-[#a78bfa] font-semibold">+{m.xpReward}xp</span>
                        {canClaim && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => claimMut.mutate(m.key)}
                            disabled={claimMut.isPending}
                            className="flex items-center gap-1 rounded-lg bg-[rgba(34,211,135,0.2)] border border-[rgba(34,211,135,0.4)] px-2 py-0.5 text-[9px] font-bold text-[#22d387] hover:bg-[rgba(34,211,135,0.3)] transition-colors disabled:opacity-50"
                          >
                            <Gift size={9} /> Claim
                          </motion.button>
                        )}
                      </div>
                    </div>
                    <div className="mt-1.5 h-1 w-full rounded-full bg-[rgba(255,255,255,0.025)] overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{
                          background: canClaim
                            ? "linear-gradient(90deg, #22d387, #16a34a)"
                            : `linear-gradient(90deg, ${DIFF_COLOR[m.difficulty] ?? "#7c3aed"}, rgba(124,58,237,0.5))`,
                        }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                      />
                    </div>
                    <div className="flex justify-between mt-0.5">
                      <span className="text-[9px] text-[#4B5563]">
                        {m.completed ? "✓ Complete" : `${m.currentValue}/${m.targetValue}`}
                      </span>
                      <span className="text-[9px]" style={{ color: DIFF_COLOR[m.difficulty] ?? "#7c3aed" }}>
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
      {stats?.dailyCompleted === stats?.totalDaily && stats?.totalDaily > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 rounded-xl border border-[rgba(34,211,135,0.3)] bg-[rgba(34,211,135,0.06)] p-3 text-center"
        >
          <p className="text-xs font-semibold text-[#22d387]">🏆 All daily missions complete!</p>
          <Link href="/missions" className="mt-1 block text-[10px] text-[#4B5563] hover:text-[#22d387] transition-colors">
            Check weekly missions →
          </Link>
        </motion.div>
      )}
    </div>
  );
}
