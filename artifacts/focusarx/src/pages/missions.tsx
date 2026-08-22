import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getToken } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageTransition } from "@/components/PageTransition";
import { TiltCard, StaggerContainer, StaggerItem } from "@/components/TiltCard";
import { Target, Zap, CheckCircle2, Lock, Trophy, Flame, Clock, ListTodo, Star, ChevronRight, Gift } from "lucide-react";
import { Mission as MissionDef } from "@/types/gamification";

interface MissionsData {
  daily: MissionDef[];
  weekly: MissionDef[];
  stats: {
    dailyCompleted: number;
    totalDaily: number;
    weeklyCompleted: number;
    totalWeekly: number;
  };
}

const DIFFICULTY_CONFIG = {
  easy:   { label: "Easy",   color: "var(--palette-22d387)", bg: "var(--rgba-34-211-135-0_12)",  border: "var(--rgba-34-211-135-0_3)"  },
  medium: { label: "Medium", color: "var(--color-warning)", bg: "var(--rgba-245-158-11-0_12)",  border: "var(--rgba-245-158-11-0_3)"  },
  hard:   { label: "Hard",   color: "var(--palette-f87171)", bg: "var(--rgba-248-113-113-0_12)", border: "var(--rgba-248-113-113-0_3)" },
  epic:   { label: "Epic",   color: "var(--brand-400)", bg: "var(--rgba-167-139-250-0_12)", border: "var(--rgba-167-139-250-0_4)" },
} as const;

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  focus:   <Zap size={14} className="text-[var(--palette-amber-400)]" />,
  tasks:   <ListTodo size={14} className="text-[var(--palette-blue-400)]" />,
  streak:  <Flame size={14} className="text-[var(--palette-orange-500)]" />,
  quality: <Star size={14} className="text-[var(--palette-yellow-400)]" />,
  social:  <Trophy size={14} className="text-[var(--palette-purple-400)]" />,
  special: <Target size={14} className="text-[var(--palette-rose-400)]" />,
};

async function fetchMissions(): Promise<MissionsData> {
  const token = getToken();
  const res = await fetch("/api/missions", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Failed to fetch missions");
  return res.json();
}

async function claimMission(key: string): Promise<{ ok: boolean; xpEarned: number; coinsEarned: number }> {
  const token = getToken();
  const res = await fetch(`/api/missions/${key}/claim`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error("Failed to claim mission");
  return res.json();
}

function ProgressBar({ current, target, completed }: { current: number; target: number; completed: boolean }) {
  const pct = completed ? 100 : Math.min(99, Math.round((current / Math.max(target, 1)) * 100));
  return (
    <div className="h-1.5 w-full rounded-full bg-[var(--rgba-255-255-255-0_025)] overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{
          background: completed
            ? "linear-gradient(90deg, var(--palette-22d387), var(--palette-16a34a))"
            : "linear-gradient(90deg, var(--brand-600), var(--brand-400))",
        }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      />
    </div>
  );
}

function MissionCard({ mission, onClaim, claiming }: { mission: MissionDef; onClaim: (key: string) => void; claiming: boolean }) {
  const diff = DIFFICULTY_CONFIG[mission.difficulty];
  const pct = mission.completed ? 100 : Math.min(99, Math.round((mission.currentValue / Math.max(mission.targetValue, 1)) * 100));
  const canClaim = mission.completed && !mission.rewardClaimed;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`relative rounded-2xl border p-4 transition-all duration-[var(--duration-fast)] ${
        mission.rewardClaimed
          ? "border-[var(--rgba-255-255-255-0_06)] bg-[var(--palette-0d0f1a)] opacity-60"
          : mission.completed
          ? "border-[var(--rgba-34-211-135-0_35)] bg-[var(--rgba-34-211-135-0_05)]"
          : "border-[var(--rgba-255-255-255-0_06)] bg-[var(--palette-0d0f1a)] hover:border-[var(--rgba-124-58-237-0_3)]"
      }`}
    >
      {mission.completed && !mission.rewardClaimed && (
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          animate={{ boxShadow: ["0 0 0 var(--rgba-34-211-135-0)", "0 0 16px var(--rgba-34-211-135-0_2)", "0 0 0 var(--rgba-34-211-135-0)"] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}

      <div className="flex items-start gap-3">
        <div className="text-2xl leading-none mt-0.5 shrink-0 flex flex-col items-center gap-2">
           {mission.icon}
           <div className="opacity-50">{CATEGORY_ICONS[mission.category]}</div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-sm font-semibold text-[var(--foreground)]">{mission.title}</span>
            <span
              className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
              style={{ color: diff.color, background: diff.bg, border: `1px solid ${diff.border}` }}
            >
              {diff.label}
            </span>
            {mission.rewardClaimed && (
              <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--palette-22d387)] bg-[var(--rgba-34-211-135-0_12)] border border-[var(--rgba-34-211-135-0_3)]">
                ✓ Done
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--foreground-subtle)] mb-3">{mission.description}</p>

          <ProgressBar current={mission.currentValue} target={mission.targetValue} completed={mission.completed} />

          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-[var(--foreground-subtle)]">
              {mission.completed ? "✓ Complete!" : `${mission.currentValue} / ${mission.targetValue}`}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-[var(--brand-400)] font-semibold">+{mission.xpReward} XP</span>
              <span className="text-[10px] text-[var(--color-warning)] font-semibold">+{mission.coinReward} 🪙</span>
              {canClaim && (
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onClaim(mission.key)}
                  disabled={claiming}
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--rgba-34-211-135-0_15)] border border-[var(--rgba-34-211-135-0_4)] px-3 py-1.5 text-[11px] font-bold text-[var(--palette-22d387)] hover:bg-[var(--rgba-34-211-135-0_25)] transition-colors disabled:opacity-50"
                >
                  <Gift size={12} />
                  Claim
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StatCard({ label, value, total, icon }: { label: string; value: number; total: number; icon: React.ReactNode }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <TiltCard intensity={8}>
      <div className="rounded-2xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--palette-0d0f1a)] p-4 flex flex-col gap-2 shadow-3d">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[var(--foreground-subtle)]">{icon}<span className="text-[10px] font-semibold uppercase tracking-[0.12em]">{label}</span></div>
          <motion.span
            className="text-sm font-bold text-[var(--foreground)]"
            key={value}
            initial={{ scale: 1.3, color: "var(--brand-400)" }}
            animate={{ scale: 1, color: "var(--palette-e8eaf0)" }}
            transition={{ duration: 0.4 }}
          >{value}/{total}</motion.span>
        </div>
        <div className="h-1.5 rounded-full bg-[var(--rgba-255-255-255-0_025)] overflow-hidden">
          <motion.div
            className="h-full rounded-full animate-wave-bar"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
      </div>
    </TiltCard>
  );
}

export default function MissionsPage() {
  const [tab, setTab] = useState<"daily" | "weekly">("daily");
  const [claimingKey, setClaimingKey] = useState<string | null>(null);
  const [claimedReward, setClaimedReward] = useState<{ xp: number; coins: number } | null>(null);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery<MissionsData>({
    queryKey: ["missions"],
    queryFn: fetchMissions,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const claimMut = useMutation({
    mutationFn: claimMission,
    onMutate: (key) => setClaimingKey(key),
    onSuccess: (result) => {
      setClaimedReward({ xp: result.xpEarned, coins: result.coinsEarned });
      qc.invalidateQueries({ queryKey: ["missions"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      setTimeout(() => setClaimedReward(null), 3000);
    },
    onSettled: () => setClaimingKey(null),
  });

  const missions = tab === "daily" ? (data?.daily ?? []) : (data?.weekly ?? []);

  const completedMissions = missions.filter((m) => m.rewardClaimed);
  const claimableMissions = missions.filter((m) => m.completed && !m.rewardClaimed);
  const activeMissions = missions.filter((m) => !m.completed);

  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  const hoursLeft = Math.max(0, Math.round((endOfDay.getTime() - now.getTime()) / 3600000));
  const dayOfWeek = now.getDay();
  const daysToMonday = ((8 - dayOfWeek) % 7) || 7;

  return (
    <PageTransition>
      <div className="min-h-[100dvh] px-4 py-6 sm:px-6 lg:px-8 max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand-600)] to-[var(--brand-400)] shadow-[0_0_20px_var(--rgba-124-58-237-0_3)]">
              <Target size={18} className="text-[var(--palette-white)]" />
            </div>
            <div>
              <div className="mb-0.5 inline-flex items-center gap-1.5 rounded-full bg-[var(--rgba-124-58-237-0_1)] border border-[var(--rgba-124-58-237-0_2)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--brand-400)]">
                <span className="h-1 w-1 rounded-full bg-[var(--brand-400)] animate-pulse" />
                Quests
              </div>
              <h1 className="text-2xl font-bold text-[var(--foreground)] tracking-tight leading-none">Missions</h1>
              <p className="text-[12px] text-[var(--foreground-subtle)] mt-0.5">Complete missions to earn XP & coins</p>
            </div>
          </div>
        </div>

        {/* Stat cards */}
        {data && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <StatCard label="Daily" value={data.stats.dailyCompleted} total={data.stats.totalDaily} icon={<Clock size={12} />} />
            <StatCard label="Weekly" value={data.stats.weeklyCompleted} total={data.stats.totalWeekly} icon={<Trophy size={12} />} />
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex rounded-xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_025)] p-1 mb-5">
          {(["daily", "weekly"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold uppercase tracking-wider transition-all duration-[var(--duration-fast)] ${
                tab === t
                  ? "bg-[var(--rgba-124-58-237-0_2)] text-[var(--brand-400)] shadow-sm"
                  : "text-[var(--foreground-subtle)] hover:text-[var(--palette-6b7280)]"
              }`}
            >
              {t === "daily" ? `⚡ Daily (${hoursLeft}h left)` : `📅 Weekly (${daysToMonday}d left)`}
            </button>
          ))}
        </div>

        {/* Claim reward toast */}
        <AnimatePresence>
          {claimedReward && (
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.95 }}
              className="mb-4 rounded-2xl border border-[var(--rgba-34-211-135-0_4)] bg-[var(--rgba-34-211-135-0_1)] p-4 flex items-center gap-3"
            >
              <span className="text-2xl">🎉</span>
              <div>
                <p className="text-sm font-bold text-[var(--palette-22d387)]">Reward Claimed!</p>
                <p className="text-xs text-[var(--foreground-subtle)]">+{claimedReward.xp} XP · +{claimedReward.coins} coins</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--rgba-255-255-255-0_06)] border-t-[var(--brand-600)]" />
            <p className="text-xs text-[var(--foreground-subtle)]">Loading missions…</p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-[var(--rgba-248-113-113-0_3)] bg-[var(--rgba-248-113-113-0_08)] p-4 text-xs text-[var(--palette-f87171)]">
            Failed to load missions. Please refresh.
          </div>
        )}

        {!isLoading && !error && (
          <div className="space-y-3">
            {/* Claimable */}
            {claimableMissions.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--palette-22d387)] mb-2 flex items-center gap-1.5">
                  <Gift size={11} /> Ready to Claim ({claimableMissions.length})
                </p>
                <div className="space-y-2">
                  {claimableMissions.map((m) => (
                    <MissionCard
                      key={m.key}
                      mission={m}
                      onClaim={(key) => claimMut.mutate(key)}
                      claiming={claimingKey === m.key}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Active */}
            {activeMissions.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--foreground-subtle)] mb-2 mt-4">
                  In Progress ({activeMissions.length})
                </p>
                <div className="space-y-2">
                  {activeMissions.map((m) => (
                    <MissionCard
                      key={m.key}
                      mission={m}
                      onClaim={(key) => claimMut.mutate(key)}
                      claiming={claimingKey === m.key}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Completed */}
            {completedMissions.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--foreground-subtle)] mb-2 mt-4">
                  Completed ({completedMissions.length})
                </p>
                <div className="space-y-2">
                  {completedMissions.map((m) => (
                    <MissionCard
                      key={m.key}
                      mission={m}
                      onClaim={(key) => claimMut.mutate(key)}
                      claiming={claimingKey === m.key}
                    />
                  ))}
                </div>
              </div>
            )}

            {missions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <span className="text-4xl">🎯</span>
                <p className="text-sm font-semibold text-[var(--foreground)]">No missions found</p>
                <p className="text-xs text-[var(--foreground-subtle)]">Start a focus session to unlock missions!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
