import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { PageTransition } from "@/components/PageTransition";
import { getToken } from "@/lib/auth";
import { User, Award, Zap, Star, Lock } from "lucide-react";

type BadgeDef = {
  id: string;
  name: string;
  description: string;
  tier: "bronze" | "silver" | "gold" | "legendary";
  category: string;
  icon: string;
  threshold: number;
  unit: string;
  unlocked: boolean;
  unlockedAt: string | null;
  progress: number;
  newlyUnlocked: boolean;
};

type UserStats = {
  totalMinutes: number;
  sessions: number;
  streak: number;
  maxScore: number;
  perfectSessions: number;
  maxSessionMinutes: number;
  maxDayMinutes: number;
  nightSessions: number;
  earlySessions: number;
};

type WalletData = {
  coins: number;
  totalXp: number;
  weeklyXp: number;
  rank: number | null;
};

const TIER_COLORS = {
  bronze:    { text: "#CD7F32", bg: "rgba(205,127,50,0.12)",  border: "rgba(205,127,50,0.3)"  },
  silver:    { text: "#94A3B8", bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.3)" },
  gold:      { text: "#F59E0B", bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.3)"  },
  legendary: { text: "#A78BFA", bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.4)" },
};

function getLevel(totalXp: number) {
  return Math.floor(Math.sqrt(totalXp / 100)) + 1;
}
function xpForLevel(level: number) {
  return (level - 1) ** 2 * 100;
}
function xpForNextLevel(level: number) {
  return level ** 2 * 100;
}

function LevelBar({ totalXp }: { totalXp: number }) {
  const level = getLevel(totalXp);
  const xpStart = xpForLevel(level);
  const xpEnd = xpForNextLevel(level);
  const progress = (totalXp - xpStart) / (xpEnd - xpStart);
  const xpInLevel = totalXp - xpStart;
  const xpNeeded = xpEnd - xpStart;

  return (
    <div className="rounded-2xl border border-[rgba(124,58,237,0.3)] bg-[rgba(124,58,237,0.06)] p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] flex items-center justify-center">
            <span className="text-lg font-black text-white">{level}</span>
          </div>
          <div>
            <p className="text-base font-bold text-[#E2E8F0]">Level {level}</p>
            <p className="text-xs text-[#4B5563]">{totalXp.toLocaleString()} total XP</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#4B5563]">Next level</p>
          <p className="text-sm font-semibold text-[#A78BFA]">{xpInLevel} / {xpNeeded} XP</p>
        </div>
      </div>
      <div className="h-2.5 rounded-full bg-[rgba(124,58,237,0.1)] overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#A78BFA]"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, progress * 100)}%` }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </div>
      <p className="mt-2 text-[10px] text-[#4B5563]">{xpNeeded - xpInLevel} XP to level {level + 1}</p>
    </div>
  );
}

function BadgeCard({ badge }: { badge: BadgeDef }) {
  const colors = TIER_COLORS[badge.tier];
  const pct = badge.unlocked ? 100 : Math.round((badge.progress / badge.threshold) * 100);

  return (
    <motion.div
      layout
      className="rounded-2xl border p-4 flex flex-col gap-2"
      style={{
        borderColor: badge.unlocked ? colors.border : "rgba(124,58,237,0.1)",
        background: badge.unlocked ? colors.bg : "rgba(124,58,237,0.03)",
        opacity: badge.unlocked ? 1 : 0.7,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`text-2xl ${!badge.unlocked ? "grayscale" : ""}`}>{badge.icon}</span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#E2E8F0] leading-tight truncate">{badge.name}</p>
            <p
              className="text-[9px] font-semibold uppercase tracking-wider"
              style={{ color: badge.unlocked ? colors.text : "#4B5563" }}
            >
              {badge.tier}
            </p>
          </div>
        </div>
        {!badge.unlocked && <Lock size={11} className="text-[#4B5563] shrink-0 mt-0.5" />}
      </div>
      <p className="text-[10px] text-[#4B5563] leading-snug">{badge.description}</p>
      {!badge.unlocked && (
        <div>
          <div className="h-1 rounded-full bg-[rgba(124,58,237,0.1)] overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${pct}%`, background: colors.text }}
            />
          </div>
          <p className="text-[9px] text-[#4B5563] mt-0.5">{badge.progress}/{badge.threshold}</p>
        </div>
      )}
      {badge.unlocked && badge.unlockedAt && (
        <p className="text-[9px] text-[#4B5563]">{new Date(badge.unlockedAt).toLocaleDateString()}</p>
      )}
    </motion.div>
  );
}

export default function ProfilePage() {
  const { status, data: authData } = useAuth();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [badges, setBadges] = useState<BadgeDef[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unlocked" | "locked">("all");
  const [newlyUnlocked, setNewlyUnlocked] = useState<BadgeDef[]>([]);
  const [showUnlock, setShowUnlock] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") { setLoading(false); return; }
    const token = getToken();
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch("/api/gamification/wallet", { headers }).then((r) => r.json()),
      fetch("/api/gamification/badges", { headers }).then((r) => r.json()),
    ])
      .then(([walletData, badgeData]) => {
        setWallet(walletData as WalletData);
        const bd = (badgeData as { badges: BadgeDef[]; stats: UserStats });
        setBadges(bd.badges);
        setStats(bd.stats);
        const newOnes = bd.badges.filter((b) => b.newlyUnlocked);
        if (newOnes.length > 0) {
          setNewlyUnlocked(newOnes);
          setShowUnlock(true);
          setTimeout(() => setShowUnlock(false), 4000);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status]);

  const user = authData?.user;
  const filteredBadges = badges.filter((b) => {
    if (filter === "unlocked") return b.unlocked;
    if (filter === "locked") return !b.unlocked;
    return true;
  });
  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return (
    <div className="relative min-h-[100dvh] overflow-hidden forge-bg-glow">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -right-32 top-0 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.07),transparent_68%)] blur-2xl" />
      </div>

      {/* Badge unlock toast */}
      <AnimatePresence>
        {showUnlock && newlyUnlocked.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl border border-[rgba(245,158,11,0.4)] bg-[rgba(245,158,11,0.1)] px-5 py-3 backdrop-blur-xl shadow-2xl"
          >
            <span className="text-xl">{newlyUnlocked[0]?.icon}</span>
            <div>
              <p className="text-xs font-bold text-amber-400">Badge Unlocked!</p>
              <p className="text-[11px] text-[#94A3B8]">{newlyUnlocked[0]?.name}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="relative z-10 mx-auto max-w-2xl px-4 py-10">
        <PageTransition>
          <header className="mb-8">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#4B5563]">Identity</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-[#E2E8F0] sm:text-3xl">
              <User size={22} className="text-[#A78BFA]" /> Profile
            </h1>
          </header>

          {loading && (
            <div className="flex h-48 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[rgba(124,58,237,0.3)] border-t-[#7C3AED]" />
            </div>
          )}

          {!loading && status === "unauthenticated" && (
            <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-8 text-center">
              <p className="text-[#94A3B8] text-sm">Sign in to see your profile.</p>
            </div>
          )}

          {!loading && status === "authenticated" && wallet && (
            <div className="space-y-6">
              {/* User info */}
              <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-5 flex items-center gap-4 backdrop-blur-xl">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] flex items-center justify-center text-xl font-black text-white shrink-0">
                  {(user?.name?.slice(0, 1) || user?.email?.slice(0, 1) || "?").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#E2E8F0] truncate">{user?.name || user?.email?.split("@")[0] || "User"}</p>
                  <p className="text-xs text-[#4B5563] truncate">{user?.email || ""}</p>
                </div>
                <div className="flex gap-4 shrink-0 text-center">
                  <div>
                    <p className="text-base font-bold text-[#A78BFA]">{wallet.coins}</p>
                    <p className="text-[9px] text-[#4B5563]">Coins</p>
                  </div>
                  {wallet.rank && (
                    <div>
                      <p className="text-base font-bold text-amber-400">#{wallet.rank}</p>
                      <p className="text-[9px] text-[#4B5563]">Rank</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Level bar */}
              <LevelBar totalXp={wallet.totalXp} />

              {/* Quick stats */}
              {stats && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Sessions",    value: stats.sessions,                          color: "#A78BFA" },
                    { label: "Focus hours", value: `${Math.round(stats.totalMinutes / 60)}h`, color: "#06D6A0" },
                    { label: "Best streak", value: `${stats.streak}d`,                     color: "#F59E0B" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-3 text-center backdrop-blur-xl">
                      <p className="text-base font-bold" style={{ color }}>{value}</p>
                      <p className="text-[10px] text-[#4B5563]">{label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* XP this week */}
              <div className="rounded-2xl border border-[rgba(124,58,237,0.15)] bg-[rgba(124,58,237,0.04)] p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap size={16} className="text-[#A78BFA]" />
                  <span className="text-sm text-[#94A3B8]">Weekly XP</span>
                </div>
                <span className="text-sm font-bold text-[#A78BFA]">{wallet.weeklyXp.toLocaleString()} XP</span>
              </div>

              {/* Badges section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-[#E2E8F0] flex items-center gap-2">
                    <Award size={14} className="text-amber-400" />
                    Badges
                    <span className="rounded-full bg-[rgba(124,58,237,0.15)] px-2 py-0.5 text-[10px] text-[#A78BFA]">
                      {unlockedCount}/{badges.length}
                    </span>
                  </h2>
                  <div className="flex gap-1">
                    {(["all", "unlocked", "locked"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`rounded-lg px-2.5 py-1 text-[10px] font-medium transition-all ${filter === f ? "bg-[rgba(124,58,237,0.2)] text-[#A78BFA]" : "text-[#4B5563] hover:text-[#94A3B8]"}`}
                      >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {filteredBadges.map((badge) => (
                    <BadgeCard key={badge.id} badge={badge} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </PageTransition>
      </main>
    </div>
  );
}
