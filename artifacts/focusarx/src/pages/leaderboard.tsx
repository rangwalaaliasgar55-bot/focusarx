import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Flame, Crown, Medal, RefreshCw } from "lucide-react";
import { getToken } from "@/lib/auth";
import { PageTransition } from "@/components/PageTransition";
import { TiltCard } from "@/components/TiltCard";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  weeklyXp: number;
  totalXp: number;
  coins: number;
  streak: number;
  isCurrentUser: boolean;
}

type Filter = "weekly" | "total";

const AVATAR_GRADIENTS = [
  "from-[#7C3AED] to-[#4F46E5]",
  "from-[#06D6A0] to-[#0EA5E9]",
  "from-[#F59E0B] to-[#EF4444]",
  "from-[#EC4899] to-[#8B5CF6]",
  "from-[#14B8A6] to-[#3B82F6]",
  "from-[#F97316] to-[#EF4444]",
];

function getAvatarGradient(name: string) {
  return AVATAR_GRADIENTS[name.charCodeAt(0) % AVATAR_GRADIENTS.length]!;
}

const RANK_META = {
  1: { crown: "#FFB800", glow: "rgba(255,184,0,0.35)", bg: "from-[rgba(255,184,0,0.12)] to-[rgba(255,184,0,0.02)]", border: "rgba(255,184,0,0.3)",  height: "h-28" },
  2: { crown: "#C0C0C0", glow: "rgba(192,192,192,0.25)", bg: "from-[rgba(192,192,192,0.1)] to-[rgba(192,192,192,0.02)]", border: "rgba(192,192,192,0.22)", height: "h-24" },
  3: { crown: "#CD7F32", glow: "rgba(205,127,50,0.25)", bg: "from-[rgba(205,127,50,0.1)] to-[rgba(205,127,50,0.02)]", border: "rgba(205,127,50,0.22)", height: "h-20" },
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
      className={`relative flex flex-col items-center rounded-2xl border bg-gradient-to-b p-4 text-center backdrop-blur-xl h-full ${entry.isCurrentUser ? "ring-2 ring-[#7C3AED]" : ""}`}
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
        className={`relative mb-2 flex ${podiumRank === 1 ? "h-14 w-14" : "h-11 w-11"} items-center justify-center rounded-full bg-gradient-to-br ${getAvatarGradient(entry.name)} font-bold text-white shadow-lg`}
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
      <p className="max-w-[80px] truncate text-xs font-bold text-[#E2E8F0]">{entry.name}</p>
      {entry.isCurrentUser && <span className="text-[9px] text-[#A78BFA]">(you)</span>}

      {/* XP */}
      <p className="mt-1.5 text-base font-black" style={{ color: "#A78BFA" }}>
        {xp.toLocaleString()}
        <span className="ml-0.5 text-[9px] font-normal text-[#4B5563]">XP</span>
      </p>

      {/* Streak */}
      <div className="mt-1 flex items-center gap-1 text-[10px] text-[#F97316]">
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
    fetch("/api/gamification/leaderboard", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json() as Promise<{ leaderboard: LeaderboardEntry[] }>;
      })
      .then((d) => { setEntries(d.leaderboard ?? []); setLoading(false); })
      .catch(() => { setFetchError(true); setLoading(false); });
  }, []);

  useEffect(() => { loadLeaderboard(); }, [loadLeaderboard]);

  const DEMO_ENTRIES: LeaderboardEntry[] = [
    { rank: 1, userId: "d1", name: "Alex R.",   weeklyXp: 840, totalXp: 6400, coins: 160, streak: 24, isCurrentUser: false },
    { rank: 2, userId: "d2", name: "Priya S.",  weeklyXp: 760, totalXp: 5800, coins: 140, streak: 18, isCurrentUser: false },
    { rank: 3, userId: "d3", name: "Kai M.",    weeklyXp: 620, totalXp: 4200, coins: 110, streak: 14, isCurrentUser: false },
    { rank: 4, userId: "d4", name: "Jordan T.", weeklyXp: 540, totalXp: 3600, coins: 80,  streak: 10, isCurrentUser: false },
    { rank: 5, userId: "d5", name: "Sam W.",    weeklyXp: 380, totalXp: 2400, coins: 60,  streak: 6,  isCurrentUser: false },
    { rank: 6, userId: "d6", name: "River B.",  weeklyXp: 260, totalXp: 1700, coins: 40,  streak: 4,  isCurrentUser: false },
    { rank: 7, userId: "me", name: "You",       weeklyXp: 0,   totalXp: 0,    coins: 0,   streak: 0,  isCurrentUser: true  },
  ];

  const isDemo = entries.length < 3;
  const sorted = [...(isDemo ? DEMO_ENTRIES : entries)]
    .sort((a, b) => filter === "weekly" ? b.weeklyXp - a.weeklyXp : b.totalXp - a.totalXp)
    .map((e, i) => ({ ...e, rank: i + 1 }));

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
        <div className="absolute right-0 top-0 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_at_center,rgba(255,184,0,0.05),transparent_65%)] blur-3xl" />
        <div className="absolute left-0 bottom-0 h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.06),transparent_65%)] blur-3xl" />
      </div>

      <main id="main-content" className="relative z-10 mx-auto max-w-3xl px-4 py-10">
        <PageTransition>

          {/* Header */}
          <header className="mb-6 flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#4B5563]">Rankings</p>
              <h1 className="mt-1 flex items-center gap-2.5 text-2xl font-bold text-[#E2E8F0] sm:text-3xl">
                <Trophy size={26} className="text-[#FFB800]" aria-hidden />
                Leaderboard
              </h1>
            </div>
            <button
              onClick={loadLeaderboard}
              disabled={loading}
              aria-label="Refresh leaderboard"
              className="mt-1 rounded-xl border border-[rgba(124,58,237,0.2)] bg-[rgba(124,58,237,0.07)] p-2 text-[#64748B] transition-all hover:border-[rgba(124,58,237,0.4)] hover:text-[#A78BFA] disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </header>

          {/* Weekly reset chip */}
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(6,214,160,0.2)] bg-[rgba(6,214,160,0.06)] px-3 py-1">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-[#06D6A0]">Weekly reset</span>
              <span className="text-[10px] font-bold text-[#06D6A0]">{resetCountdown}</span>
            </div>
            {fetchError && (
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.06)] px-3 py-1">
                <Medal size={10} className="text-[#EF4444]" />
                <p className="text-[10px] text-[#EF4444]">Could not load rankings — showing sample</p>
              </div>
            )}
            {!fetchError && isDemo && (
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(124,58,237,0.2)] bg-[rgba(124,58,237,0.06)] px-3 py-1">
                <Medal size={10} className="text-[#A78BFA]" />
                <p className="text-[10px] text-[#A78BFA]">Demo data — complete a session to appear</p>
              </div>
            )}
          </div>

          {/* Filter tabs */}
          <div className="mb-6 inline-flex rounded-xl border border-[rgba(124,58,237,0.2)] bg-[rgba(16,23,50,0.7)] p-1">
            {(["weekly", "total"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`rounded-lg px-5 py-1.5 text-xs font-semibold capitalize transition-all duration-150 ${
                  filter === f
                    ? "bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] text-white shadow-[0_0_14px_rgba(124,58,237,0.35)]"
                    : "text-[#4B5563] hover:text-[#94A3B8]"
                }`}
              >
                {f === "weekly" ? "🗓 This Week" : "🏆 All Time"}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex h-52 items-center justify-center" role="status" aria-label="Loading leaderboard">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[rgba(124,58,237,0.3)] border-t-[#7C3AED]" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="rounded-2xl border border-[rgba(124,58,237,0.15)] bg-[rgba(16,23,50,0.5)] p-14 text-center">
              <Trophy size={40} className="mx-auto mb-3 text-[#2D3748]" />
              <p className="text-sm text-[#64748B]">No one's on the board yet.</p>
              <p className="mt-1 text-xs text-[#374151]">Complete a focus session to earn XP and claim a rank!</p>
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
                <div className="overflow-hidden rounded-2xl border border-[rgba(124,58,237,0.12)] backdrop-blur-xl">
                  {rest.map((entry, i) => (
                    <motion.div
                      key={entry.userId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.04 }}
                      className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                        entry.isCurrentUser
                          ? "bg-[rgba(124,58,237,0.1)] border-l-2 border-[#7C3AED]"
                          : "hover:bg-[rgba(124,58,237,0.04)]"
                      } ${i < rest.length - 1 ? "border-b border-[rgba(124,58,237,0.07)]" : ""}`}
                    >
                      <span className="w-6 text-center text-xs font-black text-[#374151]">{entry.rank}</span>
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarGradient(entry.name)} text-[11px] font-bold text-white`}
                      >
                        {entry.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-semibold text-[#E2E8F0]">
                          {entry.name}
                          {entry.isCurrentUser && <span className="ml-1.5 text-[9px] font-normal text-[#A78BFA]">(you)</span>}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-0.5 text-[10px] text-[#F97316]">
                            <Flame size={9} />{entry.streak}d
                          </span>
                          <span className="text-[10px] text-[#FFB800]">🪙{entry.coins.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-[#A78BFA]">
                          {(filter === "weekly" ? entry.weeklyXp : entry.totalXp).toLocaleString()}
                        </p>
                        <p className="text-[10px] text-[#374151]">XP</p>
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
                    className="rounded-2xl border border-[#7C3AED] bg-[rgba(124,58,237,0.09)] p-4 flex items-center gap-3"
                  >
                    <span className="text-xs font-black text-[#A78BFA]">#{myRow.rank}</span>
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarGradient(myRow.name)} text-xs font-bold text-white`}>
                      {myRow.name.slice(0, 2).toUpperCase()}
                    </div>
                    <p className="flex-1 text-sm font-semibold text-[#E2E8F0]">You</p>
                    <p className="text-sm font-bold text-[#A78BFA]">
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
