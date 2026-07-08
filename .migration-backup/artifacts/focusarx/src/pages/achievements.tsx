import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Lock } from "lucide-react";
import { getToken } from "@/lib/auth";
import { PageTransition } from "@/components/PageTransition";

interface Badge {
  id: string;
  name: string;
  description: string;
  tier: "bronze" | "silver" | "gold" | "legendary";
  category: "time" | "streak" | "sessions" | "quality" | "special";
  icon: string;
  threshold: number;
  unit: string;
  unlocked: boolean;
  unlockedAt: string | null;
  progress: number;
  newlyUnlocked: boolean;
}

interface Stats {
  totalMinutes: number;
  sessions: number;
  streak: number;
  maxScore: number;
  perfectSessions: number;
  maxSessionMinutes: number;
  maxDayMinutes: number;
  nightSessions: number;
  earlySessions: number;
}

type CategoryFilter = "all" | "time" | "streak" | "sessions" | "quality" | "special";

const TIER_STYLES: Record<string, string> = {
  bronze:    "tier-bronze-bg border",
  silver:    "tier-silver-bg border",
  gold:      "tier-gold-bg border",
  legendary: "tier-legendary-bg border",
};

const TIER_GLOW: Record<string, string> = {
  bronze:    "rgba(205,127,50,0.3)",
  silver:    "rgba(192,192,192,0.3)",
  gold:      "rgba(255,184,0,0.4)",
  legendary: "rgba(167,139,250,0.5)",
};

const TIER_TEXT: Record<string, string> = {
  bronze:    "text-[#CD7F32]",
  silver:    "text-[#C0C0C0]",
  gold:      "text-[#FFB800]",
  legendary: "text-[#A78BFA]",
};

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  all: "All",
  time: "⏱️ Time",
  streak: "🔥 Streaks",
  sessions: "🎯 Sessions",
  quality: "🧠 Quality",
  special: "⚡ Special",
};

export default function AchievementsPage() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const [celebratingId, setCelebratingId] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    fetch("/api/gamification/badges", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json() as Promise<{ badges: Badge[]; stats: Stats }>)
      .then((d) => {
        setBadges(d.badges ?? []);
        setStats(d.stats ?? null);
        const newOnes = (d.badges ?? []).filter((b) => b.newlyUnlocked);
        if (newOnes.length > 0) setCelebratingId(newOnes[0]!.id);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = badges.filter((b) => filter === "all" || b.category === filter);
  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return (
    <div className="relative min-h-[100dvh] overflow-hidden forge-bg-glow">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_at_center,rgba(167,139,250,0.08),transparent_65%)] blur-3xl" />
      </div>
      <main className="relative z-10 mx-auto max-w-3xl px-4 py-10">
        <PageTransition>
          <header className="mb-8">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#4B5563]">Vault</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-[#E2E8F0] sm:text-3xl">
              <Star size={24} className="text-[#A78BFA]" /> Achievements
            </h1>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-2 flex-1 max-w-xs overflow-hidden rounded-full bg-[rgba(167,139,250,0.1)]">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#A78BFA]"
                  initial={{ width: 0 }}
                  animate={{ width: badges.length > 0 ? `${(unlockedCount / badges.length) * 100}%` : "0%" }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </div>
              <span className="text-xs text-[#94A3B8]">
                {unlockedCount} / {badges.length} unlocked
              </span>
            </div>
          </header>

          {/* Stats strip */}
          {stats && (
            <div className="mb-6 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {[
                { label: "Total hrs", value: Math.round(stats.totalMinutes / 60) },
                { label: "Sessions", value: stats.sessions },
                { label: "Best streak", value: `${stats.streak}d` },
                { label: "Max score", value: stats.maxScore ? Math.round(stats.maxScore) : "—" },
                { label: "Best day", value: `${stats.maxDayMinutes}m` },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl border border-[var(--forge-border)] bg-[var(--card)] p-3 text-center backdrop-blur-xl">
                  <p className="text-[10px] text-[#4B5563]">{label}</p>
                  <p className="mt-0.5 text-base font-bold text-[#E2E8F0]">{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Category filter */}
          <div className="mb-6 flex flex-wrap gap-2">
            {(Object.keys(CATEGORY_LABELS) as CategoryFilter[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  filter === cat
                    ? "bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] text-white shadow-[0_0_10px_rgba(124,58,237,0.3)]"
                    : "border border-[var(--forge-border)] text-[#4B5563] hover:border-[rgba(124,58,237,0.4)] hover:text-[#94A3B8]"
                }`}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[rgba(124,58,237,0.3)] border-t-[#7C3AED]" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {filtered.map((badge, i) => (
                <motion.div
                  key={badge.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className={`relative flex flex-col items-center rounded-2xl p-4 text-center transition-all ${
                    badge.unlocked
                      ? `${TIER_STYLES[badge.tier]} ${badge.newlyUnlocked || badge.id === celebratingId ? "shimmer" : ""}`
                      : "border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)]"
                  }`}
                  style={badge.unlocked ? { boxShadow: `0 0 20px ${TIER_GLOW[badge.tier]}` } : undefined}
                >
                  {/* Icon */}
                  <div className={`relative mb-2 text-3xl ${!badge.unlocked ? "opacity-30 grayscale" : ""}`}>
                    {badge.icon}
                    {!badge.unlocked && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-full bg-[rgba(0,0,0,0.6)]">
                        <Lock size={12} className="text-[#4B5563]" />
                      </div>
                    )}
                  </div>

                  {/* Tier label */}
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${badge.unlocked ? TIER_TEXT[badge.tier] : "text-[#2D3748]"}`}>
                    {badge.tier}
                  </span>

                  {/* Name */}
                  <p className={`mt-1 text-xs font-semibold leading-tight ${badge.unlocked ? "text-[#E2E8F0]" : "text-[#2D3748]"}`}>
                    {badge.name}
                  </p>

                  {/* Description */}
                  <p className={`mt-0.5 text-[10px] leading-snug ${badge.unlocked ? "text-[#94A3B8]" : "text-[#1F2937]"}`}>
                    {badge.description}
                  </p>

                  {/* Progress bar */}
                  {!badge.unlocked && (
                    <div className="mt-2 w-full">
                      <div className="h-1 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
                        <div
                          className="h-full rounded-full bg-[rgba(124,58,237,0.4)]"
                          style={{ width: `${(badge.progress / badge.threshold) * 100}%` }}
                        />
                      </div>
                      <p className="mt-0.5 text-[9px] text-[#374151]">
                        {badge.progress}/{badge.threshold}
                      </p>
                    </div>
                  )}

                  {/* Unlocked date */}
                  {badge.unlocked && badge.unlockedAt && (
                    <p className="mt-1 text-[9px] text-[#4B5563]">
                      {new Date(badge.unlockedAt).toLocaleDateString()}
                    </p>
                  )}

                  {/* Newly unlocked indicator */}
                  {badge.newlyUnlocked && (
                    <div className="absolute -top-1 -right-1 rounded-full bg-[#06D6A0] px-1.5 py-0.5 text-[8px] font-bold text-[#0A0F1E]">
                      NEW
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </PageTransition>
      </main>
    </div>
  );
}
