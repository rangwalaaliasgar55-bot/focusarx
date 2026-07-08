import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Clock, Zap, Calendar, Award, ArrowUp, ArrowDown, Minus } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  BarChart, Bar,
} from "recharts";
import { getToken } from "@/lib/auth";
import { PageTransition } from "@/components/PageTransition";
import PageHeader from "@/components/PageHeader";
import { format, parseISO } from "date-fns";

interface AnalyticsData {
  heatmap: Record<string, number>;
  chartData14: Array<{ date: string; minutes: number }>;
  hourDist: Array<{ hour: number; minutes: number }>;
  weekBarData?: Array<{ day: string; date: string; minutes: number }>;
  weekComparison?: { thisWeekMinutes: number; lastWeekMinutes: number; changePercent: number };
  personalBests: {
    longestSessionMinutes: number;
    bestDayMinutes: number;
    totalSessions: number;
    totalMinutes: number;
    longestStreak: number;
  };
}

function HeatmapCell({ minutes, date }: { minutes: number; date: string }) {
  const intensity = Math.min(1, minutes / 120);
  const alpha = 0.08 + intensity * 0.82;
  const color = `rgba(124,58,237,${alpha.toFixed(2)})`;
  return (
    <div
      className="aspect-square rounded-sm cursor-default transition-transform hover:scale-125"
      style={{ background: color, outline: "1px solid rgba(124,58,237,0.06)" }}
      title={`${date}: ${minutes}m`}
    />
  );
}

function buildHeatmapGrid(heatmap: Record<string, number> | undefined) {
  if (!heatmap) return [];
  const cells: Array<{ date: string; minutes: number; empty?: boolean }> = [];
  const today = new Date();
  const start = new Date(today.getTime() - 91 * 86400000);
  const startDow = start.getDay();
  for (let i = 0; i < startDow; i++) cells.push({ date: "", minutes: 0, empty: true });
  for (let i = 0; i < 91; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const ds = d.toISOString().split("T")[0]!;
    cells.push({ date: ds, minutes: heatmap[ds] ?? 0 });
  }
  return cells;
}

const HOUR_COLORS = ["#7C3AED", "#A78BFA", "#06D6A0", "#FFB800", "#F97316"];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[rgba(124,58,237,0.3)] bg-[rgba(12,17,40,0.95)] px-3 py-2 text-xs text-[#E2E8F0] shadow-xl backdrop-blur-xl">
      <p className="font-semibold">{label}</p>
      <p className="text-[#A78BFA]">{payload[0]?.value}m focused</p>
    </div>
  );
};

const BarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[rgba(124,58,237,0.3)] bg-[rgba(12,17,40,0.95)] px-3 py-2 text-xs text-[#E2E8F0] shadow-xl backdrop-blur-xl">
      <p className="font-semibold">{label}</p>
      <p className="text-[#06D6A0]">{payload[0]?.value}m</p>
    </div>
  );
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    fetch("/api/analytics", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json() as Promise<AnalyticsData>; })
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const chart14 = (data?.chartData14 ?? []).map((d) => ({
    ...d,
    label: (() => { try { return format(parseISO(d.date), "MMM d"); } catch { return d.date; } })(),
  }));

  const heatCells = data ? buildHeatmapGrid(data.heatmap) : [];

  const topHours = (data?.hourDist ?? [])
    .filter((h) => h.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 5)
    .map((h, i) => ({
      name: `${h.hour}:00`,
      value: h.minutes,
      fill: HOUR_COLORS[i] ?? "#7C3AED",
    }));

  const wc = data?.weekComparison;
  const weekBar = data?.weekBarData ?? [];

  return (
    <div className="relative min-h-[100dvh] overflow-hidden forge-bg-glow">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -left-32 top-1/3 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle_at_center,rgba(6,214,160,0.06),transparent_65%)] blur-3xl" />
      </div>
      <main className="relative z-10 mx-auto max-w-4xl px-4 py-10">
        <PageTransition>
          <PageHeader
            icon={<TrendingUp size={18} className="text-[#06D6A0]" />}
            badgeColor="#06D6A0"
            title="Analytics"
            subtitle="Your deep focus patterns and performance trends"
          />

          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[rgba(124,58,237,0.3)] border-t-[#7C3AED]" />
            </div>
          ) : !data ? (
            <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-12 text-center backdrop-blur-xl">
              <TrendingUp size={40} className="mx-auto mb-3 text-[#4B5563]" />
              <p className="text-sm text-[#94A3B8]">Complete sessions to see your analytics.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* All-time personal bests */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  { icon: Clock,      label: "Total hours",    value: `${Math.round((data.personalBests.totalMinutes ?? 0) / 60)}h`, color: "#A78BFA" },
                  { icon: Zap,        label: "Total sessions", value: `${data.personalBests.totalSessions}`,                         color: "#06D6A0" },
                  { icon: TrendingUp, label: "Best session",   value: `${data.personalBests.longestSessionMinutes}m`,                color: "#FFB800" },
                  { icon: Calendar,   label: "Best day",       value: `${data.personalBests.bestDayMinutes}m`,                      color: "#F97316" },
                  { icon: Award,      label: "Best streak",    value: `${data.personalBests.longestStreak}d`,                       color: "#EC4899" },
                ].map(({ icon: Icon, label, value, color }) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-4 text-center backdrop-blur-xl"
                  >
                    <Icon size={16} className="mx-auto mb-1.5" style={{ color }} />
                    <p className="text-[10px] text-[#4B5563]">{label}</p>
                    <p className="mt-0.5 text-lg font-bold" style={{ color }}>{value}</p>
                  </motion.div>
                ))}
              </div>

              {/* Weekly comparison card */}
              {wc && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-5 backdrop-blur-xl">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-xs text-[#4B5563]">Compared to last week</p>
                        <div className="mt-1 flex items-center gap-2">
                          {wc.changePercent > 0 ? (
                            <div className="flex items-center gap-1 text-emerald-400">
                              <ArrowUp size={14} />
                              <span className="text-lg font-bold">+{wc.changePercent}%</span>
                            </div>
                          ) : wc.changePercent < 0 ? (
                            <div className="flex items-center gap-1 text-red-400">
                              <ArrowDown size={14} />
                              <span className="text-lg font-bold">{wc.changePercent}%</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-[#94A3B8]">
                              <Minus size={14} />
                              <span className="text-lg font-bold">0%</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-[#4B5563]">This week</p>
                        <p className="text-sm font-bold text-[#E2E8F0]">{Math.round(wc.thisWeekMinutes / 60)}h {wc.thisWeekMinutes % 60}m</p>
                        <p className="text-[10px] text-[#4B5563] mt-1">Last week</p>
                        <p className="text-sm font-bold text-[#6B7280]">{Math.round(wc.lastWeekMinutes / 60)}h {wc.lastWeekMinutes % 60}m</p>
                      </div>
                    </div>
                  </div>

                  {/* Weekly bar chart */}
                  {weekBar.length > 0 && (
                    <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-5 backdrop-blur-xl">
                      <p className="text-xs font-semibold text-[#E2E8F0] mb-3">This week — daily focus</p>
                      <ResponsiveContainer width="100%" height={100}>
                        <BarChart data={weekBar} margin={{ top: 2, right: 0, bottom: 0, left: -24 }}>
                          <XAxis dataKey="day" tick={{ fill: "#4B5563", fontSize: 9 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: "#4B5563", fontSize: 9 }} axisLine={false} tickLine={false} unit="m" />
                          <Tooltip content={<BarTooltip />} />
                          <Bar dataKey="minutes" fill="#06D6A0" radius={[4, 4, 0, 0]} opacity={0.85} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}

              {/* 14-day focus chart */}
              <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-6 backdrop-blur-xl">
                <h2 className="mb-5 text-sm font-semibold text-[#E2E8F0]">Focus time — last 14 days</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chart14} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="focusGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,0.08)" />
                    <XAxis dataKey="label" tick={{ fill: "#4B5563", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#4B5563", fontSize: 10 }} axisLine={false} tickLine={false} unit="m" />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="minutes"
                      stroke="#7C3AED"
                      strokeWidth={2}
                      fill="url(#focusGrad)"
                      dot={{ r: 3, fill: "#7C3AED", strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: "#A78BFA", strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Two-column: hour distribution + heatmap */}
              <div className="grid gap-4 lg:grid-cols-2">
                {/* Productive hours */}
                {topHours.length > 0 && (
                  <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-6 backdrop-blur-xl">
                    <h2 className="mb-5 text-sm font-semibold text-[#E2E8F0]">Most productive hours</h2>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={topHours}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {topHours.map((entry) => (
                            <Cell key={entry.name} fill={entry.fill} opacity={0.9} />
                          ))}
                        </Pie>
                        <Legend
                          formatter={(value) => <span className="text-[10px] text-[#94A3B8]">{value}</span>}
                          wrapperStyle={{ fontSize: "10px" }}
                        />
                        <Tooltip
                          formatter={(v: any) => [`${v}m`, "Focus"]}
                          contentStyle={{ background: "rgba(12,17,40,0.95)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 8, fontSize: 11 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Activity heatmap — 91 days */}
                <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-6 backdrop-blur-xl">
                  <h2 className="mb-4 text-sm font-semibold text-[#E2E8F0]">Activity — last 91 days</h2>
                  <div className="flex gap-1 mb-2 text-[9px] text-[#4B5563]">
                    {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
                      <div key={d} className="flex-1 text-center">{d[0]}</div>
                    ))}
                  </div>
                  <div className="grid gap-0.5" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
                    {heatCells.map((cell, i) =>
                      cell.empty ? (
                        <div key={i} className="aspect-square" />
                      ) : (
                        <HeatmapCell key={cell.date} minutes={cell.minutes} date={cell.date} />
                      )
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 text-[9px] text-[#4B5563]">
                    <span>Less</span>
                    {[0.08, 0.3, 0.55, 0.8, 0.95].map((a) => (
                      <div key={a} className="h-2.5 w-2.5 rounded-sm" style={{ background: `rgba(124,58,237,${a})` }} />
                    ))}
                    <span>More</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </PageTransition>
      </main>
    </div>
  );
}
