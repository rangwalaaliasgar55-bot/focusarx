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
  unlockRate?: number;
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
  bronze:    { label: "Bronze",    text: "var(--palette-cd7f32)", bg: "var(--rgba-205-127-50-0_12)",  border: "var(--rgba-205-127-50-0_35)",  glow: "var(--rgba-205-127-50-0_3)"  },
  silver:    { label: "Silver",    text: "var(--palette-c0c0c0)", bg: "var(--rgba-192-192-192-0_12)", border: "var(--rgba-192-192-192-0_3)",  glow: "var(--rgba-192-192-192-0_25)" },
  gold:      { label: "Gold",      text: "var(--brand-gold)", bg: "var(--rgba-255-184-0-0_12)",   border: "var(--rgba-255-184-0-0_4)",    glow: "var(--rgba-255-184-0-0_4)"   },
  legendary: { label: "Legendary", text: "var(--brand-400)", bg: "var(--rgba-167-139-250-0_15)", border: "var(--rgba-167-139-250-0_5)",  glow: "var(--rgba-167-139-250-0_5)" },
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
      className="relative flex flex-col items-center rounded-2xl p-4 text-center transition-all duration-[var(--duration-fast)] hover:scale-[1.02]"
      style={
        badge.unlocked
          ? {
              background: `linear-gradient(135deg, ${tier.bg}, var(--rgba-0-0-0-0))`,
              border: `1px solid ${tier.border}`,
              boxShadow: isCelebrating ? `0 0 24px ${tier.glow}, 0 0 8px ${tier.glow}` : `0 0 14px ${tier.glow}`,
            }
          : {
              background: "var(--rgba-255-255-255-0_02)",
              border: "1px solid var(--rgba-255-255-255-0_05)",
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
        <div className="absolute -top-1.5 -right-1.5 z-[var(--z-content)] rounded-full bg-[var(--brand-teal)] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-[var(--palette-0a0f1e)] shadow-lg">
          NEW
        </div>
      )}

      <div className={`relative mb-2 text-3xl leading-none ${!badge.unlocked ? "opacity-20 grayscale saturate-0" : ""}`}>
        {badge.icon}
      </div>

      {!badge.unlocked && (
        <div className="absolute top-4 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--rgba-0-0-0-0_5)]">
          <Lock size={12} className="text-[var(--foreground-subtle)]" />
        </div>
      )}

      <span
        className="text-[9px] font-bold uppercase tracking-widest"
        style={{ color: badge.unlocked ? tier.text : "var(--palette-1f2937)" }}
      >
        {tier.label}
      </span>

      <p
        className="mt-1 text-xs font-semibold leading-tight"
        style={{ color: badge.unlocked ? "var(--foreground)" : "var(--foreground-subtle)" }}
      >
        {badge.name}
      </p>

      <p
        className="mt-0.5 text-[10px] leading-snug"
        style={{ color: badge.unlocked ? "var(--muted-fg)" : "var(--palette-1f2937)" }}
      >
        {badge.description}
      </p>

      {typeof badge.unlockRate === "number" && (
        <p
          className="mt-1 flex items-center gap-1 text-[9px] font-medium"
          style={{ color: badge.unlocked ? "var(--foreground-subtle)" : "var(--palette-1f2937)" }}
        >
          <Users size={8} />
          {badge.unlocked
            ? `${badge.unlockRate}% of learners have this`
            : `Only ${badge.unlockRate}% of learners have this`}
        </p>
      )}

      {!badge.unlocked && (
        <div className="mt-2.5 w-full">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-[var(--palette-1f2937)]">{badge.progress}</span>
            <span className="text-[9px] text-[var(--foreground-subtle)]">{badge.threshold}</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--muted)]">
            <div
              className="h-full rounded-full bg-[var(--rgba-124-58-237-0_35)] transition-all duration-[var(--duration-slow)]"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-0.5 text-[9px] text-[var(--foreground-subtle)]">{pct}%</p>
        </div>
      )}

      {badge.unlocked && badge.unlockedAt && (
        <p className="mt-1.5 flex items-center gap-1 text-[9px]" style={{ color: "var(--foreground-subtle)" }}>
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
        <div className="absolute left-1/4 top-0 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle_at_center,var(--rgba-167-139-250-0_07),transparent_65%)] blur-3xl" />
        <div className="absolute right-0 bottom-0 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle_at_center,var(--rgba-6-214-160-0_04),transparent_65%)] blur-3xl" />
      </div>

      <main id="main-content" className="relative z-[var(--z-content)] mx-auto max-w-3xl px-4 py-10">
        <PageTransition>

          {/* Header */}
          <header className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--foreground-subtle)]">Achievement Vault</p>
            <h1 className="mt-1 flex items-center gap-2.5 text-2xl font-bold text-[var(--foreground)] sm:text-3xl">
              <Star size={26} className="text-[var(--brand-400)]" aria-hidden />
              Achievements
              <span className="ml-2 rounded-full bg-[var(--rgba-124-58-237-0_2)] border border-[var(--rgba-124-58-237-0_3)] px-2.5 py-0.5 text-sm font-semibold text-[var(--brand-400)]">
                {unlockedCount}/{totalCount}
              </span>
            </h1>

            {/* Next Unlock spotlight */}
            {nextUnlock && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-5 flex items-center gap-3 rounded-2xl border border-[var(--rgba-124-58-237-0_25)] bg-[var(--rgba-124-58-237-0_07)] px-4 py-3"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--rgba-124-58-237-0_15)] text-xl">
                  {nextUnlock.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-400)]">Next Unlock</p>
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">{nextUnlock.tier}</span>
                  </div>
                  <p className="text-sm font-semibold text-[var(--foreground)] truncate">{nextUnlock.name}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-[var(--rgba-124-58-237-0_15)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[var(--brand-600)] to-[var(--brand-400)] transition-all duration-[var(--duration-slow)]"
                        style={{ width: `${Math.min(99, Math.round((nextUnlock.progress / nextUnlock.threshold) * 100))}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-[10px] font-bold text-[var(--brand-400)]">
                      {nextUnlock.threshold - nextUnlock.progress} {nextUnlock.unit} to go
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            <div className="mt-4 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--foreground-muted)]">
                  <span className="font-bold text-[var(--brand-400)]">{unlockedCount}</span>
                  <span className="text-[var(--foreground-subtle)]"> / {totalCount} unlocked</span>
                </span>
                <span className="font-bold text-[var(--brand-400)]">{completionPct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--rgba-167-139-250-0_08)]">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--brand-600)] via-[var(--brand-400)] to-[var(--brand-300)]"
                  style={{ boxShadow: "0 0 8px var(--rgba-167-139-250-0_4)" }}
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
                className="mb-5 rounded-2xl border border-[var(--rgba-6-214-160-0_3)] bg-[var(--rgba-6-214-160-0_07)] p-4"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base" aria-hidden>🎉</span>
                  <p className="text-sm font-bold text-[var(--brand-teal)]">
                    {newlyUnlocked.length === 1 ? "New achievement unlocked!" : `${newlyUnlocked.length} new achievements!`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {newlyUnlocked.map((b) => (
                    <span key={b.id} className="flex items-center gap-1 rounded-full border border-[var(--rgba-6-214-160-0_2)] bg-[var(--rgba-6-214-160-0_1)] px-2 py-0.5 text-[11px] font-medium text-[var(--brand-teal)]">
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
                    <div className="rounded-xl border border-[var(--rgba-124-58-237-0_15)] bg-[var(--rgba-16-23-50-0_5)] p-3 text-center backdrop-blur-xl shadow-3d-violet">
                      <p className="text-[9px] font-medium uppercase tracking-wider text-[var(--foreground-subtle)]">{label}</p>
                      <p className="mt-1 text-sm font-bold text-[var(--foreground)]">{value}{suffix}</p>
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
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-[var(--duration-fast)] ${
                      active
                        ? "bg-[var(--brand-600)] hover:bg-[var(--brand-700)] text-[var(--palette-white)] shadow-[0_0_12px_var(--rgba-124-58-237-0_3)]"
                        : "border border-[var(--rgba-124-58-237-0_18)] text-[var(--muted-fg)] hover:border-[var(--rgba-124-58-237-0_4)] hover:text-[var(--foreground-muted)] hover:bg-[var(--rgba-124-58-237-0_06)]"
                    }`}
                  >
                    <span aria-hidden>{cfg.icon}</span>
                    {cfg.label}
                    <span className={`ml-0.5 rounded-full px-1 text-[9px] font-bold ${active ? "bg-[var(--palette-white)]/20 text-[var(--palette-white)]" : "bg-[var(--rgba-124-58-237-0_12)] text-[var(--muted-fg)]"}`}>
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
            <div className="flex gap-1 rounded-xl border border-[var(--rgba-124-58-237-0_15)] bg-[var(--rgba-8-12-28-0_6)] p-1">
              {(["all", "bronze", "silver", "gold", "legendary"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTierFilter(t)}
                  className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold capitalize transition-all ${
                    tierFilter === t
                      ? "bg-[var(--rgba-124-58-237-0_3)] text-[var(--brand-400)]"
                      : "text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)]"
                  }`}
                >
                  {t === "all" ? "All Tiers" : t}
                </button>
              ))}
            </div>
            {/* Locked/unlocked filter */}
            <div className="flex gap-1 rounded-xl border border-[var(--rgba-124-58-237-0_15)] bg-[var(--rgba-8-12-28-0_6)] p-1">
              {(["all", "unlocked", "locked"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setShowUnlocked(s)}
                  className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold capitalize transition-all ${
                    showUnlocked === s
                      ? "bg-[var(--rgba-124-58-237-0_3)] text-[var(--brand-400)]"
                      : "text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)]"
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
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--rgba-124-58-237-0_3)] border-t-[var(--brand-600)]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-[var(--rgba-124-58-237-0_15)] bg-[var(--rgba-16-23-50-0_5)] p-12 text-center">
              <Star size={36} className="mx-auto mb-3 text-[var(--foreground-subtle)]" />
              <p className="text-sm text-[var(--foreground-subtle)]">No achievements in this category yet.</p>
              <p className="mt-1 text-xs text-[var(--foreground-subtle)]">Keep focusing to unlock them!</p>
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
            <div className="mt-8 rounded-xl border border-[var(--rgba-124-58-237-0_1)] bg-[var(--rgba-16-23-50-0_4)] p-4">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--foreground-subtle)]">Tier Legend</p>
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
