import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { PageTransition } from "@/components/PageTransition";

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

export default function DashboardPage() {
  const { status, data: session } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      setLoading(false);
      return;
    }
    const token = localStorage.getItem("focusarx-auth-token");
    fetch("/api/stats", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json() as Promise<DashboardStats>)
      .then((d) => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [status]);

  const maxMinutes = Math.max(1, ...(stats?.chartData ?? []).map((d) => d.minutes));

  return (
    <div className="relative min-h-[100dvh] overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden>
        <div className="absolute -left-32 top-0 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.15),transparent_68%)] blur-2xl" />
        <div className="absolute -right-24 top-1/3 h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle_at_center,rgba(236,72,153,0.12),transparent_65%)] blur-2xl" />
      </div>
      <main className="relative z-10 mx-auto flex min-h-[100dvh] max-w-lg flex-col items-center px-4 pb-16 pt-12 sm:max-w-xl sm:pt-16">
        <PageTransition>
          <header className="mb-10 w-full text-center">
            <nav className="mb-6 flex justify-center gap-4 text-xs font-medium text-zinc-500">
              <Link href="/" className="transition-colors hover:text-zinc-200">Timer</Link>
              <span className="text-zinc-200">Dashboard</span>
              <Link href="/roadmap" className="transition-colors hover:text-zinc-200">AI roadmap</Link>
            </nav>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-500">Your progress</p>
            <h1 className="mt-2 bg-gradient-to-br from-zinc-100 via-zinc-200 to-zinc-500 bg-clip-text text-3xl font-semibold tracking-tight text-transparent sm:text-4xl">
              Dashboard
            </h1>
          </header>

          {status === "unauthenticated" && (
            <div className="w-full rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-8 text-center backdrop-blur-xl">
              <p className="text-zinc-400 text-sm">Sign in to see your dashboard stats.</p>
              <Link href="/login" className="mt-4 inline-block rounded-xl bg-rose-600 px-6 py-2 text-sm font-medium text-white hover:bg-rose-500">Sign in</Link>
            </div>
          )}

          {loading && status !== "unauthenticated" && (
            <div className="flex h-48 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-rose-400" />
            </div>
          )}

          {!loading && stats && (
            <section className="w-full space-y-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <OverviewCard label="Study today" value={`${stats.totalStudyMinutesToday}m`} />
                <OverviewCard label="Avg focus" value={stats.avgFocusScore != null ? `${stats.avgFocusScore}` : "—"} />
                <OverviewCard label="Stability" value={stats.dominantStability.split(" ")[0] ?? "—"} sub={stats.dominantStability} />
                <OverviewCard label="Sessions" value={`${stats.sessionsToday}`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <OverviewCard label="Day streak" value={`${stats.currentStreak}`} />
                <OverviewCard label="Tasks done" value={`${stats.completedTasks}`} />
              </div>
              <div className="rounded-[1.75rem] border border-[var(--card-border)] bg-[var(--card)] p-6 shadow-xl backdrop-blur-xl">
                <h2 className="mb-8 text-center text-sm font-medium text-zinc-400">Weekly focus (minutes)</h2>
                {maxMinutes <= 1 && stats.sessionsToday === 0 ? (
                  <div className="flex h-48 flex-col items-center justify-center gap-2 text-zinc-500">
                    <p className="text-sm">No focus time this week yet.</p>
                    <Link href="/" className="text-xs text-rose-400 hover:text-rose-300">Start your first session →</Link>
                  </div>
                ) : (
                  <div className="flex h-48 items-end justify-between gap-3 px-2">
                    {stats.chartData.map((d) => (
                      <div key={d.date} className="flex flex-1 flex-col items-center gap-3">
                        <div
                          className="w-full max-w-[24px] rounded-full bg-rose-400/80 transition-colors hover:bg-rose-400"
                          style={{ height: `${Math.max(8, (d.minutes / maxMinutes) * 100)}%` }}
                          title={`${d.minutes} mins`}
                        />
                        <span className="text-[10px] font-medium text-zinc-500">{d.day}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <h2 className="text-sm font-medium text-zinc-400">Recent sessions</h2>
                {stats.recentSessions.length === 0 ? (
                  <p className="text-center text-sm text-zinc-500">Complete a focus block to see insights.</p>
                ) : (
                  stats.recentSessions.map((s) => (
                    <div key={s.id} className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4 shadow-lg backdrop-blur-xl">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">{s.mode}</span>
                        <span className="text-xs text-zinc-500">{Math.round(s.durationSec / 60)}m</span>
                      </div>
                      {s.focusScore != null && (
                        <p className="mt-1 text-sm text-zinc-300">Focus score: <span className="font-semibold text-zinc-100">{s.focusScore}</span></p>
                      )}
                      <p className="mt-0.5 text-xs text-zinc-600">{new Date(s.completedAt).toLocaleString()}</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}
        </PageTransition>
      </main>
    </div>
  );
}

function OverviewCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--card-border)] bg-[var(--card)] p-4 text-center shadow-lg backdrop-blur-xl transition-transform hover:-translate-y-0.5">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-zinc-100 sm:text-2xl">{value}</div>
      {sub && <p className="mt-0.5 text-[9px] text-zinc-500">{sub}</p>}
    </div>
  );
}
