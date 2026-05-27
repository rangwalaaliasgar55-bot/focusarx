import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { PageTransition } from "@/components/PageTransition";
import FocusGarden from "@/components/FocusGarden";
import { LayoutDashboard, Zap, Clock, Target, Flame, CheckCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type DashboardStats = {
  totalStudyMinutesToday: number;
  avgFocusScore: number | null;
  dominantStability: string;
  sessionsToday: number;
  currentStreak: number;
  completedTasks: number;
  chartData: Array<{ day: string; date: string; minutes: number }>;
  recentSessions: Array<{
    id: string;
    mode: string;
    durationSec: number;
    completedAt: string;
    focusScore: number | null;
    focusQuality: string | null;
    stabilityRating: string | null;
  }>;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[rgba(124,58,237,0.3)] bg-[rgba(12,17,40,0.95)] px-3 py-2 text-xs text-[#E2E8F0] shadow-xl backdrop-blur-xl">
      <p className="font-semibold">{label}</p>
      <p className="text-[#A78BFA]">{payload[0]?.value}m</p>
    </div>
  );
};

export default function DashboardPage() {
  const { status } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") { setLoading(false); return; }
    const token = localStorage.getItem("focusarx-auth-token");
    fetch("/api/stats", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json() as Promise<DashboardStats>)
      .then((d) => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [status]);

  const overviewCards = stats ? [
    { icon: Clock,       label: "Study today",  value: `${stats.totalStudyMinutesToday}m`,                              color: "#A78BFA" },
    { icon: Zap,         label: "Avg focus",    value: stats.avgFocusScore != null ? `${stats.avgFocusScore}` : "—",    color: "#06D6A0" },
    { icon: Target,      label: "Sessions",     value: `${stats.sessionsToday}`,                                        color: "#FFB800" },
    { icon: Flame,       label: "Streak",       value: `${stats.currentStreak}d`,                                       color: "#F97316" },
    { icon: CheckCircle, label: "Tasks done",   value: `${stats.completedTasks}`,                                       color: "#4ADE80" },
    { icon: LayoutDashboard, label: "Stability", value: stats.dominantStability.split(" ")[0] ?? "—",                  color: "#60A5FA" },
  ] : [];

  return (
    <div className="relative min-h-[100dvh] overflow-hidden forge-bg-glow">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -left-32 top-0 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.1),transparent_68%)] blur-2xl" />
      </div>
      <main className="relative z-10 mx-auto max-w-3xl px-4 py-10">
        <PageTransition>
          <header className="mb-8">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#4B5563]">Your progress</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-[#E2E8F0] sm:text-3xl">
              <LayoutDashboard size={22} className="text-[#A78BFA]" /> Dashboard
            </h1>
          </header>

          {status === "unauthenticated" && (
            <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-8 text-center backdrop-blur-xl">
              <p className="text-[#94A3B8] text-sm">Sign in to see your dashboard stats.</p>
              <Link href="/login" className="mt-4 inline-block rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] px-6 py-2 text-sm font-medium text-white shadow-[0_0_12px_rgba(124,58,237,0.3)]">
                Sign in
              </Link>
            </div>
          )}

          {loading && status !== "unauthenticated" && (
            <div className="flex h-48 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[rgba(124,58,237,0.3)] border-t-[#7C3AED]" />
            </div>
          )}

          {!loading && stats && (
            <div className="space-y-6">
              {/* Focus Garden + Stats grid */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-[rgba(74,222,128,0.2)] bg-[rgba(74,222,128,0.04)] p-5 backdrop-blur-xl flex flex-col items-center">
                  <FocusGarden minutesToday={stats.totalStudyMinutesToday} />
                </div>
                <div className="sm:col-span-2 grid grid-cols-3 gap-3">
                  {overviewCards.map(({ icon: Icon, label, value, color }) => (
                    <div key={label} className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-3 text-center backdrop-blur-xl hover:-translate-y-0.5 transition-transform">
                      <Icon size={14} className="mx-auto mb-1" style={{ color }} />
                      <p className="text-[9px] uppercase tracking-wider text-[#4B5563]">{label}</p>
                      <p className="mt-0.5 text-base font-bold" style={{ color }}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bar chart */}
              <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-6 backdrop-blur-xl">
                <h2 className="mb-5 text-sm font-semibold text-[#E2E8F0]">Weekly focus (minutes)</h2>
                {stats.chartData.every((d) => d.minutes === 0) ? (
                  <div className="flex h-40 flex-col items-center justify-center gap-2 text-[#4B5563]">
                    <p className="text-sm">No focus time this week yet.</p>
                    <Link href="/" className="text-xs text-[#A78BFA] hover:text-[#7C3AED]">Start your first session →</Link>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={stats.chartData} margin={{ top: 0, right: 4, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,0.08)" />
                      <XAxis dataKey="day" tick={{ fill: "#4B5563", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#4B5563", fontSize: 10 }} axisLine={false} tickLine={false} unit="m" />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="minutes" fill="#7C3AED" radius={[4, 4, 0, 0]} opacity={0.85} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Recent sessions */}
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-[#E2E8F0]">Recent sessions</h2>
                {stats.recentSessions.length === 0 ? (
                  <p className="text-center text-sm text-[#4B5563]">Complete a focus block to see insights.</p>
                ) : (
                  stats.recentSessions.map((s) => (
                    <div key={s.id} className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-4 backdrop-blur-xl hover:border-[rgba(124,58,237,0.35)] transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-[rgba(124,58,237,0.12)] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#A78BFA]">{s.mode}</span>
                        <span className="text-xs text-[#4B5563]">{Math.round(s.durationSec / 60)}m</span>
                      </div>
                      {s.focusScore != null && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[rgba(124,58,237,0.1)]">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#A78BFA]"
                              style={{ width: `${s.focusScore}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-[#A78BFA]">{s.focusScore}</span>
                        </div>
                      )}
                      <p className="mt-1.5 text-[10px] text-[#4B5563]">{new Date(s.completedAt).toLocaleString()}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </PageTransition>
      </main>
    </div>
  );
}
