import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getToken } from "@/lib/auth";
import { Sparkles, TrendingUp, Brain, Clock, RefreshCw, BarChart2, Target, Flame } from "lucide-react";

async function apiFetch(path: string) {
  const token = getToken();
  const res = await fetch(path, { headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function StatCard({ label, value, icon: Icon, color = "#7C3AED" }: { label: string; value: string | number; icon: React.ComponentType<any>; color?: string }) {
  return (
    <div className="rounded-xl border border-[#1e2130] bg-[#111318] p-4">
      <div className="flex items-center gap-2 mb-2"><Icon size={14} style={{ color }} /><span className="text-xs text-[#4a4f62] uppercase tracking-widest font-semibold">{label}</span></div>
      <p className="text-2xl font-black text-[#e8eaf0]">{value}</p>
    </div>
  );
}

function HabitBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.round((value / Math.max(max, 1)) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs"><span className="text-[#5a5f72]">{label}</span><span className="text-[#e8eaf0] font-medium">{value}</span></div>
      <div className="h-1.5 rounded-full bg-[#1e2130] overflow-hidden"><div className="h-full rounded-full bg-[#7C3AED] transition-all" style={{ width: `${pct}%` }} /></div>
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
    { id: "report", label: "AI Report", icon: Sparkles },
    { id: "habits", label: "Habit Analysis", icon: BarChart2 },
  ] as const;

  const ICON_MAP: Record<string, React.ComponentType<any>> = { peak_time: Clock, focus_score: Brain, streak: Flame, task_rate: Target, level: TrendingUp };
  const COLOR_MAP: Record<string, string> = { peak_time: "#f59e0b", focus_score: "#7C3AED", streak: "#f97316", task_rate: "#22d387", level: "#60a5fa" };

  return (
    <div className="min-h-screen bg-[#0a0c12] text-[#e8eaf0] p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] flex items-center justify-center"><Sparkles size={18} className="text-white" /></div>
        <div>
          <h1 className="text-2xl font-bold text-[#e8eaf0]">AI Insights</h1>
          <p className="text-sm text-[#4a4f62]">Powered by your real productivity data</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#111318] rounded-xl border border-[#1e2130] p-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-all ${tab === t.id ? "bg-[#7C3AED] text-white" : "text-[#5a5f72] hover:text-[#e8eaf0]"}`}>
            <t.icon size={12} /><span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* INSIGHTS TAB */}
      {tab === "insights" && (
        <div>
          {insightsLoading && <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1e2130] border-t-[#7C3AED]" /></div>}
          {insights && (
            <div>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {(insights.stats ? [
                  { label: "Sessions (7d)", value: insights.stats.totalSessions, icon: Target, color: "#7C3AED" },
                  { label: "Focus Minutes", value: insights.stats.totalMinutes, icon: Clock, color: "#f59e0b" },
                  { label: "Avg Score", value: `${insights.stats.avgFocusScore}%`, icon: Brain, color: "#22d387" },
                  { label: "Streak", value: `${insights.stats.currentStreak}d`, icon: Flame, color: "#f97316" },
                ] : []).map((s) => <StatCard key={s.label} {...s} />)}
              </div>
              <div className="space-y-3">
                {(insights.insights ?? []).map((ins: any) => {
                  const Icon = ICON_MAP[ins.type] ?? Brain;
                  const color = COLOR_MAP[ins.type] ?? "#7C3AED";
                  return (
                    <div key={ins.type} className="rounded-xl border border-[#1e2130] bg-[#111318] p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{ins.icon}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-semibold text-[#e8eaf0]">{ins.title}</p>
                            <span className="text-sm font-bold" style={{ color }}>{ins.value}</span>
                          </div>
                          <p className="text-xs text-[#5a5f72] leading-relaxed">{ins.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* REPORT TAB */}
      {tab === "report" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-[#4a4f62]">AI-generated analysis of your last 7 days</p>
            <button onClick={() => { setReportKey(k => k + 1); }} disabled={reportLoading} className="flex items-center gap-1.5 rounded-xl border border-[#1e2130] bg-[#111318] px-3 py-1.5 text-xs font-medium text-[#5a5f72] hover:text-[#e8eaf0] disabled:opacity-50">
              <RefreshCw size={11} className={reportLoading ? "animate-spin" : ""} /> Regenerate
            </button>
          </div>
          {reportLoading && (
            <div className="rounded-2xl border border-[#1e2130] bg-[#111318] p-8 text-center">
              <Sparkles size={32} className="mx-auto mb-3 text-[#7C3AED] animate-pulse" />
              <p className="text-sm text-[#5a5f72]">Analyzing your productivity data…</p>
            </div>
          )}
          {report && !reportLoading && (
            <div className="rounded-2xl border border-[#7C3AED]/30 bg-[#111318] p-5">
              {report.aiPowered && <div className="flex items-center gap-2 mb-4 text-[10px] text-[#7C3AED] font-semibold uppercase tracking-widest"><Sparkles size={11} /> AI-powered report</div>}
              <div className="prose prose-invert max-w-none text-sm text-[#c0c4d4] leading-relaxed whitespace-pre-wrap">
                {report.report}
              </div>
              <p className="text-[10px] text-[#3a3d4a] mt-4">Generated {report.generatedAt ? new Date(report.generatedAt).toLocaleString() : "now"}</p>
            </div>
          )}
        </div>
      )}

      {/* HABITS TAB */}
      {tab === "habits" && (
        <div>
          {habitsLoading && <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1e2130] border-t-[#7C3AED]" /></div>}
          {habits && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Active Days (30d)" value={habits.activeDaysLast30} icon={TrendingUp} color="#22d387" />
                <StatCard label="Consistency" value={`${habits.consistencyScore}%`} icon={Target} color="#7C3AED" />
                <StatCard label="Avg Daily Min" value={habits.avgDailyMinutes} icon={Clock} color="#f59e0b" />
                <StatCard label="Longest Session" value={`${habits.longestSessionMinutes}m`} icon={Brain} color="#60a5fa" />
              </div>
              <div className="rounded-xl border border-[#1e2130] bg-[#111318] p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-[#4a4f62] mb-3">Day of Week Distribution</p>
                <div className="space-y-2">
                  {Object.entries(habits.weekdayDistribution ?? {}).map(([day, count]) => (
                    <HabitBar key={day} label={day} value={count as number} max={Math.max(...Object.values(habits.weekdayDistribution ?? {}) as number[])} />
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-[#1e2130] bg-[#111318] p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-[#4a4f62] mb-2">Monthly Goal</p>
                <div className="flex justify-between text-xs mb-1.5"><span className="text-[#5a5f72]">20 active days target</span><span className="text-[#e8eaf0] font-bold">{habits.activeDaysLast30}/20 days</span></div>
                <div className="h-3 rounded-full bg-[#1e2130] overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#22d387] transition-all" style={{ width: `${habits.monthlyGoalProgress}%` }} /></div>
                <p className="text-[10px] text-[#4a4f62] mt-1">{habits.monthlyGoalProgress}% complete</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
