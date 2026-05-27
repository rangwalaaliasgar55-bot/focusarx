import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Flame, Zap, Crown } from "lucide-react";
import { getToken } from "@/lib/auth";
import { PageTransition } from "@/components/PageTransition";

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

function getInitialsColor(name: string) {
  const colors = [
    "from-[#7C3AED] to-[#4F46E5]",
    "from-[#06D6A0] to-[#0EA5E9]",
    "from-[#F59E0B] to-[#EF4444]",
    "from-[#EC4899] to-[#8B5CF6]",
    "from-[#14B8A6] to-[#3B82F6]",
  ];
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx]!;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Crown size={18} className="text-[#FFB800]" />;
  if (rank === 2) return <Crown size={18} className="text-[#C0C0C0]" />;
  if (rank === 3) return <Crown size={18} className="text-[#CD7F32]" />;
  return <span className="w-[18px] text-center text-xs font-bold text-[#4B5563]">{rank}</span>;
}

const RANK1_GRADIENT = "from-[rgba(255,184,0,0.15)] to-[rgba(255,184,0,0.03)] border-[rgba(255,184,0,0.3)]";
const RANK2_GRADIENT = "from-[rgba(192,192,192,0.12)] to-[rgba(192,192,192,0.03)] border-[rgba(192,192,192,0.25)]";
const RANK3_GRADIENT = "from-[rgba(205,127,50,0.12)] to-[rgba(205,127,50,0.03)] border-[rgba(205,127,50,0.25)]";

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("weekly");

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    fetch("/api/gamification/leaderboard", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json() as Promise<{ leaderboard: LeaderboardEntry[] }>)
      .then((d) => { setEntries(d.leaderboard ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const sorted = [...entries].sort((a, b) =>
    filter === "weekly" ? b.weeklyXp - a.weeklyXp : b.totalXp - a.totalXp
  ).map((e, i) => ({ ...e, rank: i + 1 }));

  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);
  const myRow = sorted.find((e) => e.isCurrentUser);

  return (
    <div className="relative min-h-[100dvh] overflow-hidden forge-bg-glow">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute right-0 top-0 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle_at_center,rgba(255,184,0,0.06),transparent_65%)] blur-3xl" />
      </div>
      <main className="relative z-10 mx-auto max-w-3xl px-4 py-10">
        <PageTransition>
          <header className="mb-8">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#4B5563]">Rankings</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-[#E2E8F0] sm:text-3xl">
              <Trophy size={24} className="text-[#FFB800]" /> Leaderboard
            </h1>
          </header>

          {/* Filter tabs */}
          <div className="mb-6 inline-flex rounded-xl bg-[rgba(16,23,50,0.7)] p-1 border border-[var(--forge-border)]">
            {(["weekly", "total"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-4 py-1.5 text-xs font-semibold capitalize transition-all ${
                  filter === f
                    ? "bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] text-white shadow-[0_0_12px_rgba(124,58,237,0.3)]"
                    : "text-[#4B5563] hover:text-[#94A3B8]"
                }`}
              >
                {f === "weekly" ? "This Week" : "All Time"}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[rgba(124,58,237,0.3)] border-t-[#7C3AED]" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-12 text-center backdrop-blur-xl">
              <Trophy size={40} className="mx-auto mb-3 text-[#4B5563]" />
              <p className="text-sm text-[#94A3B8]">No leaderboard data yet.</p>
              <p className="mt-1 text-xs text-[#4B5563]">Complete focus sessions to earn XP and appear here!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Top 3 hero cards */}
              {top3.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-3">
                  {top3.map((entry, i) => {
                    const gradients = [RANK1_GRADIENT, RANK2_GRADIENT, RANK3_GRADIENT];
                    const grad = gradients[i] ?? "";
                    return (
                      <motion.div
                        key={entry.userId}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className={`relative overflow-hidden rounded-2xl border bg-gradient-to-b p-5 text-center backdrop-blur-xl ${grad} ${entry.isCurrentUser ? "ring-2 ring-[#7C3AED]" : ""}`}
                      >
                        {i === 0 && (
                          <div className="pointer-events-none absolute inset-0 overflow-hidden">
                            {[...Array(6)].map((_, j) => (
                              <motion.div
                                key={j}
                                className="absolute h-1 w-1 rounded-full bg-[#FFB800]"
                                style={{ left: `${15 + j * 14}%`, top: `${10 + (j % 3) * 20}%` }}
                                animate={{ y: [0, -8, 0], opacity: [0.4, 1, 0.4] }}
                                transition={{ repeat: Infinity, duration: 2 + j * 0.3, delay: j * 0.2 }}
                              />
                            ))}
                          </div>
                        )}
                        <div className="relative">
                          <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br ${getInitialsColor(entry.name)} text-sm font-bold text-white shadow-lg`}>
                            {entry.name.slice(0, 2).toUpperCase()}
                          </div>
                          <RankBadge rank={entry.rank} />
                          <p className="mt-1 text-sm font-semibold text-[#E2E8F0] truncate">{entry.name}</p>
                          <p className="mt-2 text-lg font-black text-[#A78BFA]">
                            {filter === "weekly" ? entry.weeklyXp.toLocaleString() : entry.totalXp.toLocaleString()}
                            <span className="ml-1 text-xs font-normal text-[#4B5563]">XP</span>
                          </p>
                          <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-[#F97316]">
                            <Flame size={10} /> {entry.streak}d
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Rest of the list */}
              {rest.length > 0 && (
                <div className="rounded-2xl border border-[var(--forge-border)] overflow-hidden backdrop-blur-xl">
                  {rest.map((entry, i) => (
                    <motion.div
                      key={entry.userId}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.04 }}
                      className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${
                        entry.isCurrentUser
                          ? "bg-[rgba(124,58,237,0.12)] border-l-2 border-[#7C3AED]"
                          : "hover:bg-[rgba(124,58,237,0.05)]"
                      } ${i < rest.length - 1 ? "border-b border-[rgba(124,58,237,0.08)]" : ""}`}
                    >
                      <span className="w-6 text-center text-xs font-bold text-[#4B5563]">{entry.rank}</span>
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${getInitialsColor(entry.name)} text-xs font-bold text-white`}>
                        {entry.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-[#E2E8F0]">
                          {entry.name}
                          {entry.isCurrentUser && <span className="ml-1.5 text-[10px] text-[#A78BFA]">(you)</span>}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-0.5 text-[10px] text-[#F97316]">
                            <Flame size={9} />{entry.streak}d
                          </span>
                          <span className="flex items-center gap-0.5 text-[10px] text-[#FFB800]">
                            🪙{entry.coins.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-[#A78BFA]">
                          {(filter === "weekly" ? entry.weeklyXp : entry.totalXp).toLocaleString()}
                        </p>
                        <p className="text-[10px] text-[#4B5563]">XP</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Sticky "you" row if not in top view */}
              {myRow && myRow.rank > top3.length + rest.length && (
                <div className="rounded-2xl border border-[#7C3AED] bg-[rgba(124,58,237,0.1)] p-4 flex items-center gap-4">
                  <span className="text-xs font-bold text-[#A78BFA]">#{myRow.rank}</span>
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${getInitialsColor(myRow.name)} text-xs font-bold text-white`}>
                    {myRow.name.slice(0, 2).toUpperCase()}
                  </div>
                  <p className="flex-1 text-sm font-medium text-[#E2E8F0]">You</p>
                  <p className="text-sm font-bold text-[#A78BFA]">{filter === "weekly" ? myRow.weeklyXp : myRow.totalXp} XP</p>
                </div>
              )}
            </div>
          )}
        </PageTransition>
      </main>
    </div>
  );
}
