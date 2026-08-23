import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Flame, Crown, Medal, RefreshCw } from "lucide-react";
import { getToken } from "@/lib/auth";
import { PageTransition } from "@/components/PageTransition";
import { TiltCard } from "@/components/TiltCard";
import { ErrorState } from "@/components/ErrorState";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  weeklyXp: number;
  totalXp: number;
  coins: number;
  streak: number;
  isPremium?: boolean;
  isCurrentUser: boolean;
}

type Filter = "weekly" | "total";

const AVATAR_GRADIENTS = [
  "from-[var(--brand-600)] to-[var(--palette-4f46e5)]",
  "from-[var(--brand-teal)] to-[var(--palette-0ea5e9)]",
  "from-[var(--color-warning)] to-[var(--color-error)]",
  "from-[var(--palette-ec4899)] to-[var(--brand-500)]",
  "from-[var(--palette-14b8a6)] to-[var(--color-info)]",
  "from-[var(--palette-f97316)] to-[var(--color-error)]",
];

function getAvatarGradient(name: string) {
  return AVATAR_GRADIENTS[name.charCodeAt(0) % AVATAR_GRADIENTS.length]!;
}

const RANK_META = {
  1: { crown: "var(--brand-gold)", glow: "var(--rgba-255-184-0-0_35)", bg: "from-[var(--rgba-255-184-0-0_12)] to-[var(--rgba-255-184-0-0_02)]", border: "var(--rgba-255-184-0-0_3)",  height: "h-28" },
  2: { crown: "var(--palette-c0c0c0)", glow: "var(--rgba-192-192-192-0_25)", bg: "from-[var(--rgba-192-192-192-0_1)] to-[var(--rgba-192-192-192-0_02)]", border: "var(--rgba-192-192-192-0_22)", height: "h-24" },
  3: { crown: "var(--palette-cd7f32)", glow: "var(--rgba-205-127-50-0_25)", bg: "from-[var(--rgba-205-127-50-0_1)] to-[var(--rgba-205-127-50-0_02)]", border: "var(--rgba-205-127-50-0_22)", height: "h-20" },
};

function getMsUntilMonday(): number {
  const now = new Date();
  const msPerDay = 86400000;
  const day = now.getDay(); // 0=Sun, 1=Mon
  const daysUntilMon = day === 0 ? 1 : 8 - day;
  const nextMon = new Date(now);
  nextMon.setDate(now.getDate() + daysUntilMon);
  nextMon.setHours(0, 0, 0, 0);
  return nextMon.getTime() - now.getTime();
}

function useCountdown(targetMs: number) {
  const [remaining, setRemaining] = useState(targetMs);
  useEffect(() => {
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const d = Math.floor(remaining / 86400000);
  if (d > 0) return `${d}d ${h % 24}h`;
  return `${h}h ${m}m`;
}

function PodiumCard({ entry, podiumRank, filter }: { entry: LeaderboardEntry; podiumRank: 1 | 2 | 3; filter: Filter }) {
  const meta = RANK_META[podiumRank];
  const xp = filter === "weekly" ? entry.weeklyXp : entry.totalXp;

  return (
    <TiltCard intensity={podiumRank === 1 ? 12 : 8}>
    <motion.div
      initial={{ opacity: 0, y: 20 + podiumRank * 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: podiumRank === 1 ? 0 : podiumRank === 2 ? 0.1 : 0.15, type: "spring", stiffness: 300, damping: 28 }}
      className={`relative flex flex-col items-center rounded-2xl border bg-gradient-to-b p-4 text-center backdrop-blur-xl h-full ${entry.isCurrentUser ? "ring-2 ring-[var(--brand-600)]" : ""}`}
      style={{
        background: `linear-gradient(to bottom, ${meta.bg.replace("from-", "").replace("to-", "").split("]")[0].trim()})`,
        borderColor: meta.border,
        boxShadow: `0 0 20px ${meta.glow}`,
      }}
    >
      {/* Rank-1 floating particles */}
      {podiumRank === 1 && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          {[...Array(6)].map((_, j) => (
            <motion.div
              key={j}
              className="absolute h-1 w-1 rounded-full"
              style={{ background: meta.crown, left: `${12 + j * 15}%`, top: `${8 + (j % 3) * 25}%` }}
              animate={{ y: [0, -10, 0], opacity: [0.3, 0.9, 0.3] }}
              transition={{ repeat: Infinity, duration: 2.2 + j * 0.25, delay: j * 0.18 }}
            />
          ))}
        </div>
      )}

      {/* Avatar */}
      <div
        className={`relative mb-2 flex ${podiumRank === 1 ? "h-14 w-14" : "h-11 w-11"} items-center justify-center rounded-full bg-gradient-to-br ${getAvatarGradient(entry.name)} font-bold text-[var(--palette-white)] shadow-lg`}
        style={{ fontSize: podiumRank === 1 ? "15px" : "12px" }}
      >
        {entry.name.slice(0, 2).toUpperCase()}
        {/* Crown */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Crown size={podiumRank === 1 ? 18 : 14} style={{ color: meta.crown, filter: `drop-shadow(0 0 4px ${meta.glow})` }} />
        </div>
      </div>

      {/* Rank number */}
      <div className="mb-0.5 flex items-center justify-center">
        <span className="text-[10px] font-black" style={{ color: meta.crown }}>#{podiumRank}</span>
      </div>

      {/* Name */}
      <p className="max-w-[80px] truncate text-xs font-bold text-[var(--foreground)]">{entry.name}</p>
      {entry.isCurrentUser && <span className="text-[9px] text-[var(--brand-400)]">(you)</span>}

      {/* XP */}
      <p className="mt-1.5 text-base font-black" style={{ color: "var(--brand-400)" }}>
        {xp.toLocaleString()}
        <span className="ml-0.5 text-[9px] font-normal text-[var(--foreground-subtle)]">XP</span>
      </p>

      {/* Streak */}
      <div className="mt-1 flex items-center gap-1 text-[10px] text-[var(--palette-f97316)]">
        <Flame size={9} />
        {entry.streak}d
      </div>
    </motion.div>
    </TiltCard>
  );
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [filter, setFilter] = useState<Filter>("weekly");
  const resetCountdown = useCountdown(getMsUntilMonday());

  const loadLeaderboard = useCallback(() => {
    const token = getToken();
    setLoading(true);
    setFetchError(false);
    fetch(`/api/social/leaderboard?period=${filter === "weekly" ? "weekly" : "total"}`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    )
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json() as Promise<LeaderboardEntry[]>;
      })
      .then((d) => { setEntries(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => { setFetchError(true); setLoading(false); });
  }, [filter]);

  useEffect(() => { loadLeaderboard(); }, [loadLeaderboard]);

  const sorted = [...entries]
    .sort((a, b) => filter === "weekly" ? b.weeklyXp - a.weeklyXp : b.totalXp - a.totalXp)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  // Podium order: 2nd, 1st, 3rd for visual balance
  const top3 = sorted.slice(0, 3);
  const podiumOrder = top3.length === 3
    ? [top3[1]!, top3[0]!, top3[2]!]
    : top3;
  const podiumRanks: (1 | 2 | 3)[] = top3.length === 3 ? [2, 1, 3] : [1, 2, 3];

  const rest = sorted.slice(3);
  const myRow = sorted.find((e) => e.isCurrentUser);
  const myRankInRest = myRow ? rest.findIndex((e) => e.isCurrentUser) : -1;

  return (
    <div className="relative min-h-[100dvh] overflow-hidden forge-bg-glow">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute right-0 top-0 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_at_center,var(--rgba-255-184-0-0_05),transparent_65%)] blur-3xl" />
        <div className="absolute left-0 bottom-0 h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle_at_center,var(--rgba-124-58-237-0_06),transparent_65%)] blur-3xl" />
      </div>

      <main id="main-content" className="relative z-[var(--z-content)] mx-auto max-w-3xl px-4 py-10">
        <PageTransition>

          {/* Header */}
          <header className="mb-6 flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--foreground-subtle)]">Rankings</p>
              <h1 className="mt-1 flex items-center gap-2.5 text-2xl font-bold text-[var(--foreground)] sm:text-3xl">
                <Trophy size={26} className="text-[var(--brand-gold)]" aria-hidden />
                Leaderboard
              </h1>
            </div>
            <button
              onClick={loadLeaderboard}
              disabled={loading}
              aria-label="Refresh leaderboard"
              className="mt-1 rounded-xl border border-[var(--rgba-124-58-237-0_2)] bg-[var(--rgba-124-58-237-0_07)] p-2 text-[var(--muted-fg)] transition-all hover:border-[var(--rgba-124-58-237-0_4)] hover:text-[var(--brand-400)] disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </header>

          {/* Weekly reset chip */}
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--rgba-6-214-160-0_2)] bg-[var(--rgba-6-214-160-0_06)] px-3 py-1">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--brand-teal)]">Weekly reset</span>
              <span className="text-[10px] font-bold text-[var(--brand-teal)]">{resetCountdown}</span>
            </div>
            {fetchError && (
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--rgba-239-68-68-0_25)] bg-[var(--rgba-239-68-68-0_06)] px-3 py-1">
                <Medal size={10} className="text-[var(--color-error)]" />
                <p className="text-[10px] text-[var(--color-error)]">Could not load rankings</p>
              </div>
            )}

          </div>

          {/* Filter tabs */}
          <div className="mb-6 inline-flex rounded-xl border border-[var(--rgba-124-58-237-0_2)] bg-[var(--rgba-16-23-50-0_7)] p-1">
            {(["weekly", "total"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`rounded-lg px-5 py-1.5 text-xs font-semibold capitalize transition-all duration-[var(--duration-fast)] ${
                  filter === f
                    ? "bg-gradient-to-br from-[var(--brand-600)] to-[var(--palette-4f46e5)] text-[var(--palette-white)] shadow-[0_0_14px_var(--rgba-124-58-237-0_35)]"
                    : "text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)]"
                }`}
              >
                {f === "weekly" ? "🗓 This Week" : "🏆 All Time"}
              </button>
            ))}
          </div>

          {fetchError ? (
            <ErrorState title="Rankings unavailable" onRetry={loadLeaderboard} />
          ) : loading ? (
            <div className="flex h-52 items-center justify-center" role="status" aria-label="Loading leaderboard">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--rgba-124-58-237-0_3)] border-t-[var(--brand-600)]" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="rounded-2xl border border-[var(--rgba-124-58-237-0_15)] bg-[var(--rgba-16-23-50-0_5)] p-14 text-center">
              <Trophy size={40} className="mx-auto mb-3 text-[var(--foreground-subtle)]" />
              <p className="text-sm text-[var(--muted-fg)]">No one's on the board yet.</p>
              <p className="mt-1 text-xs text-[var(--foreground-subtle)]">Complete a focus session to earn XP and claim a rank!</p>
            </div>
          ) : (
            <div className="space-y-4">

              {/* Podium (2-1-3 order for visual height hierarchy) */}
              {top3.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:gap-3 items-end">
                  {podiumOrder.map((entry, i) => (
                    <PodiumCard
                      key={entry.userId}
                      entry={entry}
                      podiumRank={podiumRanks[i]!}
                      filter={filter}
                    />
                  ))}
                </div>
              )}

              {/* List rows (rank 4+) */}
              {rest.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-[var(--rgba-124-58-237-0_12)] backdrop-blur-xl">
                  {rest.map((entry, i) => (
                    <motion.div
                      key={entry.userId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.04 }}
                      className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                        entry.isCurrentUser
                          ? "bg-[var(--rgba-124-58-237-0_1)] border-l-2 border-[var(--brand-600)]"
                          : "hover:bg-[var(--rgba-124-58-237-0_04)]"
                      } ${i < rest.length - 1 ? "border-b border-[var(--rgba-124-58-237-0_07)]" : ""}`}
                    >
                      <span className="w-6 text-center text-xs font-black text-[var(--foreground-subtle)]">{entry.rank}</span>
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarGradient(entry.name)} text-[11px] font-bold text-[var(--palette-white)]`}
                      >
                        {entry.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                          {entry.name}
                          {entry.isPremium && <Crown size={10} className="ml-1 inline text-[var(--brand-gold)]" aria-label="Premium" />}
                          {entry.isCurrentUser && <span className="ml-1.5 text-[9px] font-normal text-[var(--brand-400)]">(you)</span>}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-0.5 text-[10px] text-[var(--palette-f97316)]">
                            <Flame size={9} />{entry.streak}d
                          </span>
                          <span className="text-[10px] text-[var(--brand-gold)]">🪙{entry.coins.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-[var(--brand-400)]">
                          {(filter === "weekly" ? entry.weeklyXp : entry.totalXp).toLocaleString()}
                        </p>
                        <p className="text-[10px] text-[var(--foreground-subtle)]">XP</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Sticky "you" row — if your rank is > visible list */}
              {myRow && myRankInRest === -1 && myRow.rank > sorted.length && (
                <AnimatePresence>
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-[var(--brand-600)] bg-[var(--rgba-124-58-237-0_09)] p-4 flex items-center gap-3"
                  >
                    <span className="text-xs font-black text-[var(--brand-400)]">#{myRow.rank}</span>
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarGradient(myRow.name)} text-xs font-bold text-[var(--palette-white)]`}>
                      {myRow.name.slice(0, 2).toUpperCase()}
                    </div>
                    <p className="flex-1 text-sm font-semibold text-[var(--foreground)]">You</p>
                    <p className="text-sm font-bold text-[var(--brand-400)]">
                      {(filter === "weekly" ? myRow.weeklyXp : myRow.totalXp).toLocaleString()} XP
                    </p>
                  </motion.div>
                </AnimatePresence>
              )}

            </div>
          )}

        </PageTransition>
      </main>
    </div>
  );
}
