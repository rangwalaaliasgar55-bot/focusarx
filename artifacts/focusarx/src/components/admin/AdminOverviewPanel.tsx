import { SectionHeader, StatCard, MotionTab } from "./AdminHelpers";
import type { AdminStats, AdminData, CmsOverview, AdminUser } from "./AdminTypes";

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (email.endsWith("@guest.focusarx.internal")) return "guest";
  return local.slice(0, 2) + "***@" + domain;
}

interface OverviewPanelProps {
  stats: AdminStats | null;
  data: AdminData;
  users: AdminUser[];
  cmsOverview: CmsOverview;
  maxSessions: number;
  onNavigateToUsers: () => void;
}

export function AdminOverviewPanel({ stats, data, users, cmsOverview, maxSessions, onNavigateToUsers }: OverviewPanelProps) {
  return (
    <MotionTab>
      <SectionHeader title="Platform Overview" sub="Real-time snapshot of platform health and user activity." />

      {/* Platform KPIs */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Registered users" value={String(stats?.totalUsers ?? users.length)} />
        <StatCard label="New this week" value={String(stats?.newUsersThisWeek ?? 0)} accent="sky" />
        <StatCard label="Active sessions" value={String(stats?.activeSessions ?? data.activeCount ?? 0)} accent="rose" />
        <StatCard label="Total focus hrs" value={String(stats?.totalFocusHours ?? 0)} accent="violet" />
        <StatCard label="Total sessions" value={String(stats?.totalSessions ?? 0)} />
        <StatCard label="Guest accounts" value={String(stats?.guestCount ?? data.guestCount ?? 0)} accent="amber" />
      </div>

      {/* CMS Overview */}
      {cmsOverview.wallets && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total coins in circulation" value={Number(cmsOverview.wallets.totalCoins).toLocaleString()} accent="amber" />
          <StatCard label="Total XP earned" value={Number(cmsOverview.wallets.totalXp).toLocaleString()} accent="violet" />
          <StatCard label="Avg coins / user" value={Math.round(cmsOverview.wallets.avgCoins).toLocaleString()} />
          <StatCard label="Marketplace items" value={`${cmsOverview.marketplace?.activeItems ?? 0} active`} accent="sky" />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Activity chart */}
        <div className="lg:col-span-3 rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/40 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--palette-zinc-500)]">Platform activity — last 7 days</p>
          <div className="mt-4 flex items-end gap-1.5 h-32">
            {(stats?.dailyChart ?? Array.from({ length: 7 }, (_, i) => ({
              day: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][i] ?? "?", date: "", sessions: 0, minutes: 0,
            }))).map((d, index) => (
              <div key={`${d.date || d.day}-${index}`} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-md bg-[var(--palette-rose-500)]/70 hover:bg-[var(--palette-rose-400)]/90 transition-all"
                  style={{ height: `${Math.round((d.sessions / maxSessions) * 100)}%`, minHeight: d.sessions > 0 ? "4px" : "2px" }}
                  title={`${d.sessions} sessions · ${d.minutes}m`}
                />
                <span className="text-[10px] text-[var(--palette-zinc-600)]">{d.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top users */}
        <div className="lg:col-span-2 rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/40 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--palette-zinc-500)]">Top focusers</p>
          <div className="mt-3 space-y-2.5">
            {(stats?.topUsers ?? []).length === 0 && <p className="text-sm text-[var(--palette-zinc-600)]">No sessions yet.</p>}
            {(stats?.topUsers ?? []).map((u, i) => (
              <div key={u.id} className="flex items-center gap-3">
                <span className={`w-5 shrink-0 text-center text-xs font-bold ${i === 0 ? "text-[var(--palette-amber-400)]" : i === 1 ? "text-[var(--palette-zinc-300)]" : i === 2 ? "text-[var(--palette-orange-600)]" : "text-[var(--palette-zinc-600)]"}`}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-[var(--palette-zinc-200)]">{u.name || maskEmail(u.email)}</p>
                  <p className="text-xs text-[var(--palette-zinc-500)]">{u.minutes}m focused</p>
                </div>
                <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-[var(--palette-zinc-800)]">
                  <div className="h-full rounded-full bg-[var(--palette-violet-500)]/70"
                    style={{ width: `${Math.round((u.minutes / Math.max(1, stats?.topUsers[0]?.minutes ?? 1)) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent signups */}
      <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/40 p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--palette-zinc-500)] mb-3">Recent signups</p>
        <div className="divide-y divide-[var(--palette-zinc-800)]/60">
          {users.slice(0, 5).map(u => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div>
                <span className="text-sm text-[var(--palette-zinc-200)]">{u.name ?? "Unnamed"}</span>
                <span className="ml-2 text-xs text-[var(--palette-zinc-500)]">{maskEmail(u.email)}</span>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs text-[var(--palette-zinc-500)]">
                <span>{u.sessionCount} sessions</span>
                <span>{u.streak} 🔥</span>
                <span>{new Date(u.createdAt).toLocaleDateString()}</span>
                {u.role === "admin" && <span className="rounded-full bg-[var(--palette-violet-950)] px-2 py-0.5 text-[var(--palette-violet-300)]">Admin</span>}
              </div>
            </div>
          ))}
        </div>
        {users.length > 5 && (
          <button onClick={onNavigateToUsers} className="mt-3 text-xs text-[var(--palette-zinc-500)] hover:text-[var(--palette-zinc-300)] transition">
            View all {users.length} users →
          </button>
        )}
      </div>
    </MotionTab>
  );
}
