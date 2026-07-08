import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Lock, Trophy, Flame, Target, Clock, Zap, CheckCircle2, ListTodo, TrendingUp, Users } from "lucide-react";
import { getToken } from "@/lib/auth";
import { PageTransition } from "@/components/PageTransition";
import { TiltCard, StaggerContainer, StaggerItem } from "@/components/TiltCard";

interface Badge {
  id: string;
  name: string;
  description: string;
  tier: "bronze" | "silver" | "gold" | "legendary";
  category: "time" | "streak" | "sessions" | "quality" | "special" | "tasks" | "social" | "milestones";
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
  totalTasks: number;
  level: number;
  totalXp: number;
}

type CategoryFilter = "all" | "time" | "streak" | "sessions" | "quality" | "special" | "tasks" | "social" | "milestones";

const TIER_CONFIG = {
  bronze:    { label: "Bronze",    text: "#CD7F32", bg: "rgba(205,127,50,0.12)",  border: "rgba(205,127,50,0.35)",  glow: "rgba(205,127,50,0.3)"  },
  silver:    { label: "Silver",    text: "#C0C0C0", bg: "rgba(192,192,192,0.12)", border: "rgba(192,192,192,0.3)",  glow: "rgba(192,192,192,0.25)" },
  gold:      { label: "Gold",      text: "#FFB800", bg: "rgba(255,184,0,0.12)",   border: "rgba(255,184,0,0.4)",    glow: "rgba(255,184,0,0.4)"   },
  legendary: { label: "Legendary", text: "#A78BFA", bg: "rgba(167,139,250,0.15)", border: "rgba(167,139,250,0.5)",  glow: "rgba(167,139,250,0.5)" },
} as const;

const CATEGORY_CONFIG: Record<CategoryFilter, { label: string; icon: React.ReactNode }> = {
  all:        { label: "All",        icon: <Star size={12} />       },
  time:       { label: "Time",       icon: <Clock size={12} />      },
  streak:     { label: "Streaks",    icon: <Flame size={12} />      },
  sessions:   { label: "Sessions",   icon: <Target size={12} />     },
  quality:    { label: "Quality",    icon: <Zap size={12} />        },
  special:    { label: "Special",    icon: <Trophy size={12} />     },
  tasks:      { label: "Tasks",      icon: <ListTodo size={12} />   },
  social:     { label: "Social",     icon: <Users size={12} />      },
  milestones: { label: "Milestones", icon: <TrendingUp size={12} /> },
};

const STAT_ITEMS = (stats: Stats) => [
  { label: "Total hours",  value: Math.round(stats.totalMinutes / 60), suffix: "h"  },
  { label: "Sessions",     value: stats.sessions,                       suffix: ""   },
  { label: "Best streak",  value: stats.streak,                         suffix: "d"  },
  { label: "Top score",    value: stats.maxScore ? Math.round(stats.maxScore) : "—", suffix: "" },
  { label: "Level",        value: stats.level,                          suffix: ""   },
];

function BadgeCard({ badge, isCelebrating }: { badge: Badge; isCelebrating: boolean }) {
  const tier = TIER_CONFIG[badge.tier];
  const pct = badge.unlocked ? 100 : Math.min(99, Math.round((badge.progress / badge.threshold) * 100));

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.88 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="relative flex flex-col items-center rounded-2xl p-4 text-center transition-all duration-200 hover:scale-[1.02]"
      style={
        badge.unlocked
          ? {
              background: `linear-gradient(135deg, ${tier.bg}, rgba(0,0,0,0))`,
              border: `1px solid ${tier.border}`,
              boxShadow: isCelebrating ? `0 0 24px ${tier.glow}, 0 0 8px ${tier.glow}` : `0 0 14px ${tier.glow}`,
            }
          : {
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
            }
      }
      aria-label={`${badge.name} — ${badge.unlocked ? "Unlocked" : `${pct}% complete`}`}
    >
      {isCelebrating && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          <div className="shimmer absolute inset-0" />
        </div>
      )}

      {badge.newlyUnlocked && (
        <div className="absolute -top-1.5 -right-1.5 z-10 rounded-full bg-[#06D6A0] px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-[#0A0F1E] shadow-lg">
          NEW
        </div>
      )}

      <div className={`relative mb-2 text-3xl leading-none ${!badge.unlocked ? "opacity-20 grayscale saturate-0" : ""}`}>
        {badge.icon}
      </div>

      {!badge.unlocked && (
        <div className="absolute top-4 flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(0,0,0,0.5)]">
          <Lock size={12} className="text-[#374151]" />
        </div>
      )}

      <span
        className="text-[9px] font-bold uppercase tracking-widest"
        style={{ color: badge.unlocked ? tier.text : "#1F2937" }}
      >
        {tier.label}
      </span>

      <p
        className="mt-1 text-xs font-semibold leading-tight"
        style={{ color: badge.unlocked ? "#E2E8F0" : "#374151" }}
      >
        {badge.name}
      </p>

      <p
        className="mt-0.5 text-[10px] leading-snug"
        style={{ color: badge.unlocked ? "#64748B" : "#1F2937" }}
      >
        {badge.description}
      </p>

      {!badge.unlocked && (
        <div className="mt-2.5 w-full">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-[#1F2937]">{badge.progress}</span>
            <span className="text-[9px] text-[#374151]">{badge.threshold}</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.04)]">
            <div
              className="h-full rounded-full bg-[rgba(124,58,237,0.35)] transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-0.5 text-[9px] text-[#374151]">{pct}%</p>
        </div>
      )}

      {badge.unlocked && badge.unlockedAt && (
        <p className="mt-1.5 flex items-center gap-1 text-[9px]" style={{ color: "#374151" }}>
          <CheckCircle2 size={8} style={{ color: tier.text }} />
          {new Date(badge.unlockedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </p>
      )}
    </motion.div>
  );
}

export default function AchievementsPage() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [showUnlocked, setShowUnlocked] = useState<"all" | "unlocked" | "locked">("all");
  const [celebratingId, setCelebratingId] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    fetch("/api/gamification/badges", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json() as Promise<{ badges: Badge[]; stats: Stats; unlockedCount: number; totalCount: number; completionPct: number }>)
      .then((d) => {
        setBadges(d.badges ?? []);
        setStats(d.stats ?? null);
        const newOnes = (d.badges ?? []).filter((b) => b.newlyUnlocked);
        if (newOnes.length > 0) {
          setCelebratingId(newOnes[0]!.id);
          setTimeout(() => setCelebratingId(null), 4000);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  let filtered = filter === "all" ? badges : badges.filter((b) => b.category === filter);
  if (tierFilter !== "all") filtered = filtered.filter((b) => b.tier === tierFilter);
  if (showUnlocked === "unlocked") filtered = filtered.filter((b) => b.unlocked);
  if (showUnlocked === "locked") filtered = filtered.filter((b) => !b.unlocked);

  const unlockedCount = badges.filter((b) => b.unlocked).length;
  const totalCount = badges.length;
  const completionPct = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  const newlyUnlocked = badges.filter((b) => b.newlyUnlocked);

  const nextUnlock = badges
    .filter((b) => !b.unlocked && b.threshold > 0)
    .sort((a, b) => (b.progress / b.threshold) - (a.progress / a.threshold))[0] ?? null;

  return (
    <div className="relative min-h-[100dvh] overflow-hidden forge-bg-glow">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute left-1/4 top-0 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle_at_center,rgba(167,139,250,0.07),transparent_65%)] blur-3xl" />
        <div className="absolute right-0 bottom-0 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle_at_center,rgba(6,214,160,0.04),transparent_65%)] blur-3xl" />
      </div>

      <main id="main-content" className="relative z-10 mx-auto max-w-3xl px-4 py-10">
        <PageTransition>

          {/* Header */}
          <header className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#4B5563]">Achievement Vault</p>
            <h1 className="mt-1 flex items-center gap-2.5 text-2xl font-bold text-[#E2E8F0] sm:text-3xl">
              <Star size={26} className="text-[#A78BFA]" aria-hidden />
              Achievements
              <span className="ml-2 rounded-full bg-[rgba(124,58,237,0.2)] border border-[rgba(124,58,237,0.3)] px-2.5 py-0.5 text-sm font-semibold text-[#A78BFA]">
                {unlockedCount}/{totalCount}
              </span>
            </h1>

            {/* Next Unlock spotlight */}
            {nextUnlock && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-5 flex items-center gap-3 rounded-2xl border border-[rgba(124,58,237,0.25)] bg-[rgba(124,58,237,0.07)] px-4 py-3"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(124,58,237,0.15)] text-xl">
                  {nextUnlock.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#A78BFA]">Next Unlock</p>
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-[#4B5563]">{nextUnlock.tier}</span>
                  </div>
                  <p className="text-sm font-semibold text-[#E2E8F0] truncate">{nextUnlock.name}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-[rgba(124,58,237,0.15)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] transition-all duration-700"
                        style={{ width: `${Math.min(99, Math.round((nextUnlock.progress / nextUnlock.threshold) * 100))}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-[10px] font-bold text-[#A78BFA]">
                      {nextUnlock.threshold - nextUnlock.progress} {nextUnlock.unit} to go
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            <div className="mt-4 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#94A3B8]">
                  <span className="font-bold text-[#A78BFA]">{unlockedCount}</span>
                  <span className="text-[#4B5563]"> / {totalCount} unlocked</span>
                </span>
                <span className="font-bold text-[#A78BFA]">{completionPct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[rgba(167,139,250,0.08)]">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] via-[#A78BFA] to-[#C4B5FD]"
                  style={{ boxShadow: "0 0 8px rgba(167,139,250,0.4)" }}
                  initial={{ width: 0 }}
                  animate={{ width: totalCount > 0 ? `${completionPct}%` : "0%" }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                />
              </div>
            </div>
          </header>

          {/* Newly Unlocked Banner */}
          <AnimatePresence>
            {newlyUnlocked.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="mb-5 rounded-2xl border border-[rgba(6,214,160,0.3)] bg-[rgba(6,214,160,0.07)] p-4"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base" aria-hidden>🎉</span>
                  <p className="text-sm font-bold text-[#06D6A0]">
                    {newlyUnlocked.length === 1 ? "New achievement unlocked!" : `${newlyUnlocked.length} new achievements!`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {newlyUnlocked.map((b) => (
                    <span key={b.id} className="flex items-center gap-1 rounded-full border border-[rgba(6,214,160,0.2)] bg-[rgba(6,214,160,0.1)] px-2 py-0.5 text-[11px] font-medium text-[#06D6A0]">
                      {b.icon} {b.name}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stats strip */}
          {stats && (
            <StaggerContainer className="mb-6 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {STAT_ITEMS(stats).map(({ label, value, suffix }) => (
                <StaggerItem key={label}>
                  <TiltCard intensity={10} className="h-full">
                    <div className="rounded-xl border border-[rgba(124,58,237,0.15)] bg-[rgba(16,23,50,0.5)] p-3 text-center backdrop-blur-xl shadow-3d-violet">
                      <p className="text-[9px] font-medium uppercase tracking-wider text-[#4B5563]">{label}</p>
                      <p className="mt-1 text-sm font-bold text-[#E2E8F0]">{value}{suffix}</p>
                    </div>
                  </TiltCard>
                </StaggerItem>
              ))}
            </StaggerContainer>
          )}

          {/* Filters row */}
          <div className="mb-4 flex flex-wrap gap-2 items-center">
            {/* Category pills */}
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
              {(Object.keys(CATEGORY_CONFIG) as CategoryFilter[]).map((cat) => {
                const cfg = CATEGORY_CONFIG[cat];
                const active = filter === cat;
                const count = cat === "all" ? badges.length : badges.filter((b) => b.category === cat).length;
                if (count === 0 && cat !== "all") return null;
                return (
                  <button
                    key={cat}
                    onClick={() => setFilter(cat)}
                    aria-pressed={active}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                      active
                        ? "bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] text-white shadow-[0_0_12px_rgba(124,58,237,0.3)]"
                        : "border border-[rgba(124,58,237,0.18)] text-[#64748B] hover:border-[rgba(124,58,237,0.4)] hover:text-[#94A3B8] hover:bg-[rgba(124,58,237,0.06)]"
                    }`}
                  >
                    <span aria-hidden>{cfg.icon}</span>
                    {cfg.label}
                    <span className={`ml-0.5 rounded-full px-1 text-[9px] font-bold ${active ? "bg-white/20 text-white" : "bg-[rgba(124,58,237,0.12)] text-[#64748B]"}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Secondary filters */}
          <div className="mb-6 flex flex-wrap gap-2 items-center">
            {/* Tier filter */}
            <div className="flex gap-1 rounded-xl border border-[rgba(124,58,237,0.15)] bg-[rgba(8,12,28,0.6)] p-1">
              {(["all", "bronze", "silver", "gold", "legendary"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTierFilter(t)}
                  className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold capitalize transition-all ${
                    tierFilter === t
                      ? "bg-[rgba(124,58,237,0.3)] text-[#A78BFA]"
                      : "text-[#4B5563] hover:text-[#6B7280]"
                  }`}
                >
                  {t === "all" ? "All Tiers" : t}
                </button>
              ))}
            </div>
            {/* Locked/unlocked filter */}
            <div className="flex gap-1 rounded-xl border border-[rgba(124,58,237,0.15)] bg-[rgba(8,12,28,0.6)] p-1">
              {(["all", "unlocked", "locked"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setShowUnlocked(s)}
                  className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold capitalize transition-all ${
                    showUnlocked === s
                      ? "bg-[rgba(124,58,237,0.3)] text-[#A78BFA]"
                      : "text-[#4B5563] hover:text-[#6B7280]"
                  }`}
                >
                  {s === "all" ? "All" : s === "unlocked" ? "✓ Unlocked" : "🔒 Locked"}
                </button>
              ))}
            </div>
          </div>

          {/* Badge grid */}
          {loading ? (
            <div className="flex h-48 items-center justify-center" role="status" aria-label="Loading achievements">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[rgba(124,58,237,0.3)] border-t-[#7C3AED]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-[rgba(124,58,237,0.15)] bg-[rgba(16,23,50,0.5)] p-12 text-center">
              <Star size={36} className="mx-auto mb-3 text-[#2D3748]" />
              <p className="text-sm text-[#4B5563]">No achievements in this category yet.</p>
              <p className="mt-1 text-xs text-[#374151]">Keep focusing to unlock them!</p>
            </div>
          ) : (
            <motion.div layout className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <AnimatePresence mode="popLayout">
                {filtered.map((badge) => (
                  <BadgeCard
                    key={badge.id}
                    badge={badge}
                    isCelebrating={badge.id === celebratingId}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          )}

          {/* Tier legend */}
          {!loading && filtered.length > 0 && (
            <div className="mt-8 rounded-xl border border-[rgba(124,58,237,0.1)] bg-[rgba(16,23,50,0.4)] p-4">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[#4B5563]">Tier Legend</p>
              <div className="flex flex-wrap gap-4">
                {(Object.keys(TIER_CONFIG) as (keyof typeof TIER_CONFIG)[]).map((tier) => (
                  <div key={tier} className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ background: TIER_CONFIG[tier].text, boxShadow: `0 0 6px ${TIER_CONFIG[tier].glow}` }} />
                    <span className="text-xs font-medium" style={{ color: TIER_CONFIG[tier].text }}>
                      {TIER_CONFIG[tier].label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </PageTransition>
      </main>
    </div>
  );
}
