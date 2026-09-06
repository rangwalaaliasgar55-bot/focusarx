import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Clock, Zap, Calendar, Award, ArrowUp, ArrowDown, Minus, Crown, Lock } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  BarChart, Bar,
} from "recharts";
import { getToken } from "@/lib/auth";
import { PageTransition } from "@/components/PageTransition";
import PageHeader from "@/components/PageHeader";
import { format, parseISO } from "date-fns";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";
import { usePremium } from "@/hooks/usePremium";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";

interface AnalyticsData {
  heatmap: Record<string, number>;
  chartData14: Array<{ date: string; minutes: number }>;
  hourDist: Array<{ hour: number; minutes: number }>;
  timeDayHeatmap: Array<{ day: number; hour: number; minutes: number; sessions: number }>;
  historyDays?: number;
  isPremium?: boolean;
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
  const color = `color-mix(in srgb, var(--brand-600) ${(alpha * 100).toFixed(0)}%, transparent)`;
  return (
    <div
      className="aspect-square rounded-sm cursor-default transition-transform hover:scale-125"
      style={{ background: color, outline: "1px solid var(--rgba-124-58-237-0_06)" }}
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

const HOUR_COLORS = ["var(--brand-600)", "var(--brand-400)", "var(--brand-teal)", "var(--brand-gold)", "var(--palette-f97316)"];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--rgba-124-58-237-0_3)] bg-[var(--rgba-12-17-40-0_95)] px-3 py-2 text-xs text-[var(--foreground)] shadow-xl backdrop-blur-xl">
      <p className="font-semibold">{label}</p>
      <p className="text-[var(--brand-400)]">{payload[0]?.value}m focused</p>
    </div>
  );
};

const BarTooltip = ({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--rgba-124-58-237-0_3)] bg-[var(--rgba-12-17-40-0_95)] px-3 py-2 text-xs text-[var(--foreground)] shadow-xl backdrop-blur-xl">
      <p className="font-semibold">{label}</p>
      <p className="text-[var(--brand-teal)]">{payload[0]?.value}m</p>
    </div>
  );
};

function PremiumLock({ feature, description }: { feature: string; description: string }) {
  const { data: premiumStatus } = useQuery({
    queryKey: ["premium-status"],
    queryFn: async () => {
      const token = getToken();
      const res = await fetch("/api/premium/status", { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (!res.ok) return { balance: 0, plans: [] };
      return res.json();
    },
    staleTime: 60_000,
  });
  const balance = premiumStatus?.balance ?? 0;
  const cheapest = premiumStatus?.plans?.[0];
  const needed = cheapest ? Math.max(0, cheapest.tokenCost - balance) : 0;
  return (
    <div className="rounded-2xl border border-[var(--palette-amber-500)]/20 bg-gradient-to-br from-[var(--palette-amber-950)]/20 to-[var(--surface-1)] p-6 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[var(--palette-amber-500)]/15 text-[var(--palette-amber-400)]">
        <Lock size={20} />
      </div>
      <h3 className="mt-3 text-sm font-bold">{feature} — Premium only</h3>
      <p className="mx-auto mt-1 max-w-sm text-xs text-[var(--foreground-muted)]">{description}</p>
      {cheapest && (
        <p className="mt-2 text-xs text-[var(--foreground-subtle)]">
          You have <span className="font-bold text-[var(--brand-400)]">{balance.toLocaleString()}</span> Focus Tokens
          {needed > 0 ? `, need ${needed.toLocaleString()} more for ${cheapest.durationDays} days` : ""}.
        </p>
      )}
      <Link href="/premium" className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-gradient-to-r from-[var(--palette-amber-500)] to-[var(--palette-amber-600)] px-5 py-2 text-xs font-bold text-white">
        <Crown size={14} /> Unlock Premium
      </Link>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(() => Boolean(getToken()));
  const { isPremium } = usePremium();

  useEffect(() => {
    const token = getToken();
    if (!token) return;
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
      fill: HOUR_COLORS[i] ?? "var(--brand-600)",
    }));

  const wc = data?.weekComparison;
  const weekBar = data?.weekBarData ?? [];

  return (
    <div className="relative min-h-[100dvh] overflow-hidden forge-bg-glow">
      <PageSEO {...PAGE_SEO.analytics} />
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -left-32 top-1/3 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle_at_center,var(--rgba-6-214-160-0_06),transparent_65%)] blur-3xl" />
      </div>
      <main className="relative z-[var(--z-content)] mx-auto max-w-4xl px-4 py-10">
        <PageTransition>
          <PageHeader
            icon={<TrendingUp size={18} className="text-[var(--brand-teal)]" />}
            badgeColor="var(--brand-teal)"
            title="Analytics"
            subtitle="Your deep focus patterns and performance trends"
          />

          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--rgba-124-58-237-0_3)] border-t-[var(--brand-600)]" />
            </div>
          ) : !data ? (
            <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-12 text-center backdrop-blur-xl">
              <TrendingUp size={40} className="mx-auto mb-3 text-[var(--foreground-subtle)]" />
              <p className="text-sm text-[var(--foreground-muted)]">Complete sessions to see your analytics.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* All-time personal bests — free */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  { icon: Clock,      label: "Total hours",    value: `${Math.round((data.personalBests.totalMinutes ?? 0) / 60)}h`, color: "var(--brand-400)" },
                  { icon: Zap,        label: "Total sessions", value: `${data.personalBests.totalSessions}`,                         color: "var(--brand-teal)" },
                  { icon: TrendingUp, label: "Best session",   value: `${data.personalBests.longestSessionMinutes}m`,                color: "var(--brand-gold)" },
                  { icon: Calendar,   label: "Best day",       value: `${data.personalBests.bestDayMinutes}m`,                      color: "var(--palette-f97316)" },
                  { icon: Award,      label: "Best streak",    value: `${data.personalBests.longestStreak}d`,                       color: "var(--palette-ec4899)" },
                ].map(({ icon: Icon, label, value, color }) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-4 text-center backdrop-blur-xl"
                  >
                    <Icon size={16} className="mx-auto mb-1.5" style={{ color }} />
                    <p className="text-[11px] text-[var(--foreground-subtle)]">{label}</p>
                    <p className="mt-0.5 text-lg font-bold" style={{ color }}>{value}</p>
                  </motion.div>
                ))}
              </div>

              {/* Weekly comparison — premium */}
              {wc ? (
                isPremium ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-5 backdrop-blur-xl">
                      <div className="mb-3 flex items-start justify-between">
                        <div>
                          <p className="text-xs text-[var(--foreground-subtle)]">Compared to last week</p>
                          <div className="mt-1 flex items-center gap-2">
                            {wc.changePercent > 0 ? (
                              <div className="flex items-center gap-1 text-[var(--palette-emerald-400)]">
                                <ArrowUp size={14} />
                                <span className="text-lg font-bold">+{wc.changePercent}%</span>
                              </div>
                            ) : wc.changePercent < 0 ? (
                              <div className="flex items-center gap-1 text-[var(--palette-red-400)]">
                                <ArrowDown size={14} />
                                <span className="text-lg font-bold">{wc.changePercent}%</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-[var(--foreground-muted)]">
                                <Minus size={14} />
                                <span className="text-lg font-bold">0%</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] text-[var(--foreground-subtle)]">This week</p>
                          <p className="text-sm font-bold text-[var(--foreground)]">{Math.round(wc.thisWeekMinutes / 60)}h {wc.thisWeekMinutes % 60}m</p>
                          <p className="mt-1 text-[11px] text-[var(--foreground-subtle)]">Last week</p>
                          <p className="text-sm font-bold text-[var(--foreground-muted)]">{Math.round(wc.lastWeekMinutes / 60)}h {wc.lastWeekMinutes % 60}m</p>
                        </div>
                      </div>
                    </div>

                    {weekBar.length > 0 && (
                      <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-5 backdrop-blur-xl">
                        <p className="mb-3 text-xs font-semibold text-[var(--foreground)]">This week — daily focus</p>
                        <ResponsiveContainer width="100%" height={100}>
                          <BarChart data={weekBar} margin={{ top: 2, right: 0, bottom: 0, left: -24 }}>
                            <XAxis dataKey="day" tick={{ fill: "var(--foreground-subtle)", fontSize: 9 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: "var(--foreground-subtle)", fontSize: 9 }} axisLine={false} tickLine={false} unit="m" />
                            <Tooltip content={<BarTooltip />} />
                            <Bar dataKey="minutes" fill="var(--brand-teal)" radius={[4, 4, 0, 0]} opacity={0.85} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                ) : (
                  <PremiumLock feature="Weekly comparison" description="Compare this week vs last week, daily breakdown, and trends. Premium unlocks full historical comparisons." />
                )
              ) : null}

              {/* 14-day focus chart — free */}
              <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-6 backdrop-blur-xl">
                <h2 className="mb-5 text-sm font-semibold text-[var(--foreground)]">Focus time — last 14 days</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chart14} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="focusGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--brand-600)" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="var(--brand-600)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--rgba-124-58-237-0_08)" />
                    <XAxis dataKey="label" tick={{ fill: "var(--foreground-subtle)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "var(--foreground-subtle)", fontSize: 10 }} axisLine={false} tickLine={false} unit="m" />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="minutes"
                      stroke="var(--brand-600)"
                      strokeWidth={2}
                      fill="url(#focusGrad)"
                      dot={{ r: 3, fill: "var(--brand-600)", strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: "var(--brand-400)", strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Hour & weekday heatmap — premium */}
              {isPremium ? (
                <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-5 backdrop-blur-xl">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-semibold">Focus time by hour and weekday</h2>
                      <p className="mt-1 text-xs text-[var(--foreground-subtle)]">{data.historyDays ?? 60}-day view · hover a cell for session detail</p>
                    </div>
                    {data.isPremium && <span className="rounded-full bg-[var(--brand-soft)] px-2 py-1 text-[11px] font-bold text-[var(--brand-400)]">180-day Premium</span>}
                  </div>
                  <div className="overflow-x-auto">
                    <div className="grid min-w-[42rem] grid-cols-[3rem_repeat(24,1fr)] gap-1 text-[11px]">
                      <span />
                      {Array.from({ length: 24 }, (_, hour) => (
                        <span key={hour} className="text-center text-[var(--foreground-subtle)]">{hour % 3 === 0 ? hour : ""}</span>
                      ))}
                      {Array.from({ length: 7 }, (_, day) => (
                        <div key={day} className="contents">
                          <span className="self-center text-[var(--foreground-subtle)]">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][day]}</span>
                          {Array.from({ length: 24 }, (_, hour) => {
                            const cell = data.timeDayHeatmap?.find((item) => item.day === day && item.hour === hour);
                            const intensity = Math.min(100, 8 + (cell?.minutes ?? 0) / 3);
                            return (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: (day * 24 + hour) * 0.002 }}
                                key={hour}
                                className="aspect-square min-h-4 rounded-sm"
                                title={`${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][day]} ${hour}:00 — ${cell?.minutes ?? 0} minutes across ${cell?.sessions ?? 0} sessions`}
                                style={{ background: `color-mix(in srgb, var(--brand-600) ${intensity}%, transparent)` }}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <PremiumLock feature="Hour & weekday heatmap" description="See your best focus hours and best days of the week with Premium analytics. Full historical data up to 180 days." />
              )}

              {/* Two-column: hour distribution + heatmap */}
              <div className="grid gap-4 lg:grid-cols-2">
                {isPremium ? (
                  <>
                    {topHours.length > 0 && (
                      <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-6 backdrop-blur-xl">
                        <h2 className="mb-5 text-sm font-semibold text-[var(--foreground)]">Most productive hours</h2>
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
                              formatter={(value) => <span className="text-[11px] text-[var(--foreground-muted)]">{value}</span>}
                              wrapperStyle={{ fontSize: "10px" }}
                            />
                            <Tooltip
                              formatter={(v: number) => [`${v}m`, "Focus"]}
                              contentStyle={{ background: "var(--rgba-12-17-40-0_95)", border: "1px solid var(--rgba-124-58-237-0_3)", borderRadius: 8, fontSize: 11 }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-6 backdrop-blur-xl">
                      <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">Activity — last 91 days</h2>
                      <div className="mb-2 flex gap-1 text-[11px] text-[var(--foreground-subtle)]">
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
                      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[var(--foreground-subtle)]">
                        <span>Less</span>
                        {[0.08, 0.3, 0.55, 0.8, 0.95].map((a) => (
                          <div key={a} className="h-2.5 w-2.5 rounded-sm" style={{ background: `color-mix(in srgb, var(--brand-600) ${a * 100}%, transparent)` }} />
                        ))}
                        <span>More</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <PremiumLock feature="Productive hours" description="Discover your best focus hours and peak productivity windows." />
                    <PremiumLock feature="Advanced trends" description="Full historical data, completion rate, abandonment, streak consistency, and export." />
                  </>
                )}
              </div>
            </div>
          )}
        </PageTransition>
      </main>
    </div>
  );
}
