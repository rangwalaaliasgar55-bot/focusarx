import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getToken } from "@/lib/auth";
import { Sparkles, Brain, Clock, RefreshCw, BarChart2, Target, Flame, TrendingUp, Zap } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import PageHeader from "@/components/PageHeader";

async function apiFetch(path: string) {
  const token = getToken();
  const res = await fetch(path, { headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function StatCard({ label, value, icon: Icon, color = "#7C3AED" }: { label: string; value: string | number; icon: React.ComponentType<any>; color?: string }) {
  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} style={{ color }} />
        <span className="text-[10px] text-[var(--foreground-subtle)] uppercase tracking-[0.14em] font-semibold">{label}</span>
      </div>
      <p className="text-2xl font-black text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function HabitBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.round((value / Math.max(max, 1)) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-[var(--foreground-subtle)]">{label}</span>
        <span className="text-[var(--foreground)] font-medium">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-[rgba(255,255,255,0.05)] overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="relative h-12 w-12">
        <Sparkles size={32} className="text-[#7C3AED] animate-pulse" />
      </div>
      <p className="text-[13px] text-[var(--foreground-subtle)]">Analyzing your productivity data…</p>
    </div>
  );
}

export default function AiInsightsPage() {
  const [tab, setTab] = useState<"report" | "insights" | "habits">("insights");
  const [reportKey, setReportKey] = useState(0);

  const { data: report, isLoading: reportLoading, refetch: refetchReport } = useQuery({
    queryKey: ["ai-weekly-report", reportKey],
    queryFn: () => apiFetch("/api/ai/weekly-report"),
    staleTime: 3_600_000,
    enabled: tab === "report",
  });

  const { data: insights, isLoading: insightsLoading } = useQuery({
    queryKey: ["ai-performance-insights"],
    queryFn: () => apiFetch("/api/ai/performance-insights"),
    staleTime: 300_000,
    enabled: tab === "insights",
  });

  const { data: habits, isLoading: habitsLoading } = useQuery({
    queryKey: ["ai-habit-analysis"],
    queryFn: () => apiFetch("/api/ai/habit-analysis"),
    staleTime: 300_000,
    enabled: tab === "habits",
  });

  const TABS = [
    { id: "insights", label: "Insights", icon: Brain },
    { id: "report",   label: "AI Report", icon: Sparkles },
    { id: "habits",   label: "Habits",    icon: BarChart2 },
  ] as const;

  const ICON_MAP: Record<string, React.ComponentType<any>> = {
    peak_time: Clock, focus_score: Brain, streak: Flame, task_rate: Target, level: TrendingUp,
  };
  const COLOR_MAP: Record<string, string> = {
    peak_time: "#F59E0B", focus_score: "#7C3AED", streak: "#F97316", task_rate: "#22D387", level: "#60A5FA",
  };

  return (
    <div className="min-h-screen forge-bg-glow">
      <div className="relative z-10 mx-auto max-w-3xl px-4 py-8">
        <PageTransition>
          <PageHeader
            icon={<Brain size={18} className="text-[#A78BFA]" />}
            badge="AI-Powered"
            badgeColor="#7C3AED"
            title="AI Coach"
            subtitle="Deep insights powered by your real productivity data"
          />

          {/* Tab bar */}
          <div className="flex gap-1 mb-6 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-[12px] font-semibold transition-all duration-150 ${
                  tab === t.id
                    ? "bg-[#7C3AED] text-white shadow-[0_2px_8px_rgba(124,58,237,0.3)]"
                    : "text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)]"
                }`}
              >
                <t.icon size={13} />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>

          {/* ── INSIGHTS TAB ── */}
          {tab === "insights" && (
            <div>
              {insightsLoading && <LoadingSpinner />}
              {insights && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {(insights.stats ? [
                      { label: "Sessions (7d)", value: insights.stats.totalSessions,        icon: Target, color: "#7C3AED" },
                      { label: "Focus Minutes", value: insights.stats.totalMinutes,          icon: Clock,  color: "#F59E0B" },
                      { label: "Avg Score",     value: `${insights.stats.avgFocusScore}%`,  icon: Brain,  color: "#22D387" },
                      { label: "Streak",        value: `${insights.stats.currentStreak}d`,  icon: Flame,  color: "#F97316" },
                    ] : []).map((s) => <StatCard key={s.label} {...s} />)}
                  </div>
                  <div className="space-y-3">
                    {(insights.insights ?? []).map((ins: any) => {
                      const Icon = ICON_MAP[ins.type] ?? Brain;
                      const color = COLOR_MAP[ins.type] ?? "#7C3AED";
                      return (
                        <div key={ins.type} className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl" style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
                              {ins.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <p className="text-sm font-semibold text-[var(--foreground)]">{ins.title}</p>
                                <span className="text-sm font-bold tabular-nums" style={{ color }}>{ins.value}</span>
                              </div>
                              <p className="text-[12px] text-[var(--foreground-subtle)] leading-relaxed">{ins.description}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {!insights?.insights?.length && !insightsLoading && (
                    <div className="rounded-2xl border border-dashed border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-10 text-center">
                      <Zap size={28} className="mx-auto mb-3 text-[#2D3748]" />
                      <p className="text-sm font-medium text-[var(--foreground-subtle)]">Complete more focus sessions to unlock insights</p>
                      <p className="text-[12px] text-[#2D3748] mt-1">AI needs data to analyze. Start a session now.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── REPORT TAB ── */}
          {tab === "report" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-[12px] text-[var(--foreground-subtle)]">AI-generated analysis of your last 7 days</p>
                <button
                  onClick={() => { setReportKey((k) => k + 1); refetchReport(); }}
                  disabled={reportLoading}
                  className="flex items-center gap-1.5 rounded-xl border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.025)] px-3 py-1.5 text-[12px] font-medium text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)] disabled:opacity-50 transition-colors"
                >
                  <RefreshCw size={11} className={reportLoading ? "animate-spin" : ""} />
                  Regenerate
                </button>
              </div>
              {reportLoading && <LoadingSpinner />}
              {report && !reportLoading && (
                <div className="rounded-2xl border border-[rgba(124,58,237,0.2)] bg-gradient-to-br from-[rgba(124,58,237,0.06)] to-[rgba(79,70,229,0.03)] p-5">
                  {report.aiPowered && (
                    <div className="flex items-center gap-2 mb-4 text-[10px] text-[#7C3AED] font-bold uppercase tracking-[0.14em]">
                      <Sparkles size={11} /> AI-powered report
                    </div>
                  )}
                  <div className="prose prose-invert max-w-none text-[13px] text-[var(--foreground-muted)] leading-relaxed whitespace-pre-wrap">
                    {report.report}
                  </div>
                  <p className="text-[10px] text-[#2D3748] mt-4">
                    Generated {report.generatedAt ? new Date(report.generatedAt).toLocaleString() : "now"}
                  </p>
                </div>
              )}
              {!report && !reportLoading && (
                <div className="rounded-2xl border border-dashed border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-10 text-center">
                  <Sparkles size={28} className="mx-auto mb-3 text-[#2D3748]" />
                  <p className="text-sm font-medium text-[var(--foreground-subtle)]">No report generated yet</p>
                  <p className="text-[12px] text-[#2D3748] mt-1">Click Regenerate to create your first AI report</p>
                </div>
              )}
            </div>
          )}

          {/* ── HABITS TAB ── */}
          {tab === "habits" && (
            <div>
              {habitsLoading && <LoadingSpinner />}
              {habits && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <StatCard label="Active Days (30d)" value={habits.activeDaysLast30}          icon={TrendingUp} color="#22D387" />
                    <StatCard label="Consistency"       value={`${habits.consistencyScore}%`}    icon={Target}     color="#7C3AED" />
                    <StatCard label="Avg Daily Min"     value={habits.avgDailyMinutes}            icon={Clock}      color="#F59E0B" />
                    <StatCard label="Longest Session"   value={`${habits.longestSessionMinutes}m`} icon={Brain}    color="#60A5FA" />
                  </div>
                  <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--foreground-subtle)] mb-3">Day of Week Distribution</p>
                    <div className="space-y-2.5">
                      {Object.entries(habits.weekdayDistribution ?? {}).map(([day, count]) => (
                        <HabitBar key={day} label={day} value={count as number} max={Math.max(...Object.values(habits.weekdayDistribution ?? {}) as number[])} />
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--foreground-subtle)] mb-3">Monthly Goal</p>
                    <div className="flex justify-between text-[12px] mb-2">
                      <span className="text-[var(--foreground-subtle)]">20 active days target</span>
                      <span className="text-[var(--foreground)] font-bold">{habits.activeDaysLast30}/20</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-[rgba(255,255,255,0.05)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#22D387] transition-all duration-700"
                        style={{ width: `${Math.min(100, habits.monthlyGoalProgress ?? 0)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-[var(--foreground-subtle)] mt-1.5">{habits.monthlyGoalProgress}% complete</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </PageTransition>
      </div>
    </div>
  );
}
