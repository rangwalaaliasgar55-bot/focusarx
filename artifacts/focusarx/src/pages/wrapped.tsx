import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { getToken } from "@/lib/auth";
import { Sparkles, Clock, Target, Flame, Trophy, Calendar, TrendingUp, Star, Share2, ChevronLeft, ChevronRight } from "lucide-react";

function authHeaders(): Record<string, string> {
  const t = getToken();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (t) h["Authorization"] = `Bearer ${t}`;
  return h;
}

const HOUR_LABELS: Record<number, string> = {
  0: "Midnight", 1: "1 AM", 2: "2 AM", 3: "3 AM", 4: "4 AM", 5: "5 AM",
  6: "6 AM", 7: "7 AM", 8: "8 AM", 9: "9 AM", 10: "10 AM", 11: "11 AM",
  12: "Noon", 13: "1 PM", 14: "2 PM", 15: "3 PM", 16: "4 PM", 17: "5 PM",
  18: "6 PM", 19: "7 PM", 20: "8 PM", 21: "9 PM", 22: "10 PM", 23: "11 PM",
};

function StatCard({ emoji, label, value, sub, delay = 0, color = "#A78BFA" }: { emoji: string; label: string; value: string; sub?: string; delay?: number; color?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 200, damping: 20 }}
      className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-5 flex flex-col gap-2 relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 h-20 w-20 opacity-10 text-6xl select-none pointer-events-none flex items-center justify-center">{emoji}</div>
      <span className="text-xl">{emoji}</span>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>{label}</div>
      {sub && <div className="text-[10px] text-[#4B5563]">{sub}</div>}
    </motion.div>
  );
}

function formatPeriodLabel(period: string, type: string) {
  if (type === "monthly") {
    const [year, month] = period.split("-");
    const d = new Date(Number(year), Number(month) - 1, 1);
    return d.toLocaleString("default", { month: "long", year: "numeric" });
  }
  return `Year ${period}`;
}

function generateShareText(wrapped: any, periodLabel: string) {
  return encodeURIComponent(
    `🎓 My FocusArx ${periodLabel} Wrapped:\n` +
    `⏱ ${wrapped.totalHours}h ${wrapped.totalMinutes % 60}m focused\n` +
    `📋 ${wrapped.tasksCompleted} tasks completed\n` +
    `🔥 ${wrapped.longestStreak} day streak\n` +
    `🏆 ${wrapped.badgesUnlocked} badges unlocked\n` +
    `#FocusArx #StudyWithMe`
  );
}

export default function WrappedPage() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentYear = String(now.getFullYear());

  const [periodType, setPeriodType] = useState<"monthly" | "yearly">("monthly");
  const [period, setPeriod] = useState(currentMonth);
  const [wrapped, setWrapped] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [noData, setNoData] = useState(false);

  const load = useCallback(async (p: string) => {
    setLoading(true);
    setNoData(false);
    setWrapped(null);
    try {
      const r = await fetch(`/api/wrapped/${p}`, { headers: authHeaders() });
      const d = await r.json();
      if (d.wrapped) setWrapped(d.wrapped);
      else setNoData(true);
    } catch {
      setNoData(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(period); }, [period, load]);

  function shiftPeriod(dir: 1 | -1) {
    if (periodType === "monthly") {
      const [year, month] = period.split("-").map(Number);
      const d = new Date(year!, month! - 1 + dir, 1);
      setPeriod(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    } else {
      setPeriod(String(Number(period) + dir));
    }
  }

  function switchType(t: "monthly" | "yearly") {
    setPeriodType(t);
    setPeriod(t === "monthly" ? currentMonth : currentYear);
  }

  const periodLabel = formatPeriodLabel(period, periodType);

  return (
    <PageTransition>
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(124,58,237,0.3)] bg-[rgba(124,58,237,0.1)] px-4 py-1.5 mb-3">
            <Sparkles size={14} className="text-[#A78BFA]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[#A78BFA]">Focus Wrapped</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">Your Study Story</h1>
          <p className="text-[#64748B] text-sm">A beautiful recap of your focus journey.</p>
        </motion.div>

        {/* Period selector */}
        <div className="flex items-center gap-4 mb-8 flex-wrap">
          <div className="flex rounded-xl border border-[rgba(255,255,255,0.08)] overflow-hidden">
            {(["monthly", "yearly"] as const).map(t => (
              <button key={t} onClick={() => switchType(t)}
                className={`px-4 py-2 text-xs font-semibold transition-all capitalize ${
                  periodType === t
                    ? "bg-[rgba(124,58,237,0.2)] text-[#A78BFA]"
                    : "text-[#64748B] hover:text-[#94A3B8]"
                }`}>{t}</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => shiftPeriod(-1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.08)] text-[#64748B] hover:text-[#94A3B8] transition-colors">
              <ChevronLeft size={14} />
            </button>
            <span className="min-w-[140px] text-center text-sm font-medium text-white">{periodLabel}</span>
            <button onClick={() => shiftPeriod(1)} disabled={period >= (periodType === "monthly" ? currentMonth : currentYear)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.08)] text-[#64748B] hover:text-[#94A3B8] disabled:opacity-30 transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#7C3AED] border-t-transparent" />
            <p className="text-sm text-[#4B5563]">Generating your wrapped...</p>
          </div>
        )}

        {noData && !loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-center py-20">
            <div className="text-5xl mb-4">📭</div>
            <h3 className="text-lg font-semibold text-white mb-2">No sessions in {periodLabel}</h3>
            <p className="text-sm text-[#4B5563]">Start studying and come back to see your wrapped!</p>
          </motion.div>
        )}

        {wrapped && !loading && (
          <div className="space-y-6">
            {/* Hero Title Card */}
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
              className="rounded-3xl border border-[rgba(124,58,237,0.3)] bg-gradient-to-br from-[rgba(124,58,237,0.15)] via-[rgba(124,58,237,0.08)] to-[rgba(0,0,0,0)] p-8 text-center relative overflow-hidden">
              <div className="absolute inset-0 pointer-events-none">
                {[...Array(12)].map((_, i) => (
                  <motion.div key={i}
                    className="absolute rounded-full bg-[rgba(124,58,237,0.15)]"
                    style={{ width: 4, height: 4, left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
                    animate={{ opacity: [0, 1, 0], scale: [0, 1.5, 0] }}
                    transition={{ repeat: Infinity, duration: 2 + Math.random() * 3, delay: Math.random() * 2 }}
                  />
                ))}
              </div>
              <div className="relative">
                <div className="text-sm font-semibold uppercase tracking-widest text-[#7C3AED] mb-2">{periodLabel}</div>
                <h2 className="text-3xl font-black text-white mb-1">{wrapped.title}</h2>
                <p className="text-[#64748B] text-sm">Here's what you accomplished</p>
              </div>
            </motion.div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <StatCard emoji="⏱" label="Total Focus" value={`${wrapped.totalHours}h ${wrapped.totalMinutes % 60}m`} sub="across all sessions" delay={0.05} color="#A78BFA" />
              <StatCard emoji="📋" label="Sessions" value={wrapped.totalSessions.toLocaleString()} sub="focus sessions completed" delay={0.1} color="#3B82F6" />
              <StatCard emoji="✅" label="Tasks Done" value={wrapped.tasksCompleted.toLocaleString()} sub="tasks checked off" delay={0.15} color="#10B981" />
              <StatCard emoji="⚡" label="XP Earned" value={wrapped.xpGained.toLocaleString()} sub="experience points" delay={0.2} color="#F59E0B" />
              {wrapped.avgFocusScore && <StatCard emoji="🎯" label="Avg Focus" value={`${wrapped.avgFocusScore}%`} sub="average focus score" delay={0.25} color="#EC4899" />}
              {wrapped.longestStreak > 0 && <StatCard emoji="🔥" label="Best Streak" value={`${wrapped.longestStreak} days`} sub="consecutive days" delay={0.3} color="#EF4444" />}
              <StatCard emoji="📅" label="Daily Avg" value={`${wrapped.dailyAvgMinutes}m`} sub="on active days" delay={0.35} color="#06B6D4" />
              <StatCard emoji="💪" label="Consistency" value={`${wrapped.consistency}%`} sub="of days with sessions" delay={0.4} color="#8B5CF6" />
            </div>

            {/* Best Day & Best Hour */}
            {(wrapped.bestDay || wrapped.bestHour) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {wrapped.bestDay && (
                  <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}
                    className="rounded-2xl border border-[rgba(245,158,11,0.2)] bg-[rgba(245,158,11,0.05)] p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Trophy size={16} className="text-[#F59E0B]" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#F59E0B]">Best Study Day</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {new Date(wrapped.bestDay.date).toLocaleDateString("default", { weekday: "long", month: "short", day: "numeric" })}
                    </div>
                    <div className="text-[#64748B] text-sm mt-1">
                      {Math.floor(wrapped.bestDay.minutes / 60)}h {wrapped.bestDay.minutes % 60}m · {wrapped.bestDay.sessions} session{wrapped.bestDay.sessions !== 1 ? "s" : ""}
                    </div>
                  </motion.div>
                )}
                {wrapped.bestHour != null && (
                  <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.55 }}
                    className="rounded-2xl border border-[rgba(99,102,241,0.2)] bg-[rgba(99,102,241,0.05)] p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Clock size={16} className="text-[#6366F1]" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#6366F1]">Peak Study Hour</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {HOUR_LABELS[wrapped.bestHour.hour] ?? `Hour ${wrapped.bestHour.hour}`}
                    </div>
                    <div className="text-[#64748B] text-sm mt-1">{wrapped.bestHour.count} session{wrapped.bestHour.count !== 1 ? "s" : ""} started</div>
                  </motion.div>
                )}
              </div>
            )}

            {/* Badges & Level */}
            {(wrapped.badgesUnlocked > 0 || wrapped.currentLevel > 1) && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
                className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-5 flex items-center justify-around flex-wrap gap-4">
                {wrapped.badgesUnlocked > 0 && (
                  <div className="text-center">
                    <div className="text-3xl font-bold text-white">{wrapped.badgesUnlocked}</div>
                    <div className="text-xs text-[#64748B] mt-1">Badges Unlocked</div>
                  </div>
                )}
                {wrapped.currentLevel > 1 && (
                  <div className="text-center">
                    <div className="text-3xl font-bold text-[#A78BFA]">Lv {wrapped.currentLevel}</div>
                    <div className="text-xs text-[#64748B] mt-1">Current Level</div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Share */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
              className="flex justify-center">
              <a
                href={`https://twitter.com/intent/tweet?text=${generateShareText(wrapped, periodLabel)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl border border-[rgba(124,58,237,0.3)] bg-[rgba(124,58,237,0.1)] px-5 py-2.5 text-sm font-semibold text-[#A78BFA] hover:bg-[rgba(124,58,237,0.18)] transition-colors">
                <Share2 size={14} />
                Share my Wrapped
              </a>
            </motion.div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
