import { Flame, TrendingUp } from "lucide-react";
import { SectionHeader, StatCard, MotionTab } from "./AdminHelpers";
import type { AdminStats, AdminData, CmsOverview, AdminUser } from "./AdminTypes";

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (email.endsWith("@guest.focusarx.internal")) return "guest";
  return local.slice(0, 2) + "***@" + domain;
}

function displayName(user: { name?: string | null; email?: string | null }) {
  return user.name || (user.email ? maskEmail(user.email) : "") || "Unnamed";
}

function formatDuration(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  return `${hours >= 10 ? Math.round(hours) : hours.toFixed(1)}h`;
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
  const chart = stats?.dailyChart ?? [];
  const weekTotal = chart.reduce((sum, day) => sum + (day.sessions || 0), 0);

  return (
    <MotionTab>
      <SectionHeader title="Platform Overview" sub="Real-time snapshot of platform health and user activity." />

      {/* Platform KPIs */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Registered users" value={String(stats?.totalUsers ?? users.length)} />
        <StatCard label="New this week" value={String(stats?.newUsersThisWeek ?? 0)} accent="sky" />
        <StatCard label="Active sessions" value={String(stats?.activeSessions ?? data.activeCount ?? 0)} accent="emerald" />
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
        <div className="ui-panel lg:col-span-3 p-5">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="text-sm font-semibold tracking-tight text-[var(--foreground)]">Sessions — last 7 days</p>
              <p className="mt-0.5 text-xs text-[var(--foreground-subtle)]">Server-verified focus completions</p>
            </div>
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold tabular-nums text-[var(--brand-strong)]">
              <TrendingUp size={13} aria-hidden /> {weekTotal.toLocaleString()} total
            </p>
          </div>
          <div className="mt-5 flex h-36 items-end gap-2" role="img" aria-label="Bar chart of focus sessions per day for the last seven days">
            {chart.length === 0 && (
              <p className="pb-6 text-sm text-[var(--foreground-subtle)]">No session data yet — it appears here as soon as users finish focus blocks.</p>
            )}
            {chart.map((d, index) => {
              const ratio = d.sessions > 0 ? Math.max(0.04, d.sessions / maxSessions) : 0;
              return (
                <div key={`${d.date || d.day}-${index}`} className="flex min-w-0 flex-1 flex-col items-center gap-1.5" title={`${d.sessions} sessions · ${d.minutes}m on ${d.day}`}>
                  <span className="text-[0.625rem] font-medium tabular-nums text-[var(--foreground-subtle)]">
                    {d.sessions > 0 ? d.sessions : ""}
                  </span>
                  <div
                    className="w-full rounded-full bg-[linear-gradient(180deg,var(--brand-400),var(--brand-600))] opacity-90 transition-opacity hover:opacity-100"
                    style={{ height: `calc(${Math.round(ratio * 100)}% - 1.25rem)` }}
                  />
                  <span className="text-[0.6875rem] tabular-nums text-[var(--foreground-muted)]">{d.day}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top users */}
        <div className="ui-panel p-5 lg:col-span-2">
          <p className="text-sm font-semibold tracking-tight text-[var(--foreground)]">Top focusers</p>
          <p className="mt-0.5 text-xs text-[var(--foreground-subtle)]">By verified minutes this week</p>
          <div className="mt-4 space-y-3">
            {(stats?.topUsers ?? []).length === 0 && <p className="text-sm text-[var(--foreground-subtle)]">No sessions yet.</p>}
            {(stats?.topUsers ?? []).map((u, i) => {
              const leader = Math.max(1, stats?.topUsers?.[0]?.minutes ?? 1);
              const rank = i === 0 ? "text-[var(--palette-amber-500)]" : i === 1 ? "text-[var(--foreground-muted)]" : i === 2 ? "text-[var(--palette-orange-500)]" : "text-[var(--foreground-subtle)]";
              return (
                <div key={u.id} className="flex items-center gap-3">
                  <span className={`w-5 shrink-0 text-center text-xs font-bold tabular-nums ${rank}`}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--foreground)]">{displayName(u)}</p>
                    <p className="text-xs text-[var(--foreground-subtle)]">{formatDuration(u.minutes)} focused</p>
                  </div>
                  <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-[var(--surface-hover)]">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,var(--brand-500),var(--brand-400))]"
                      style={{ width: `${Math.round((u.minutes / leader) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent signups */}
      <div className="ui-panel p-5">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold tracking-tight text-[var(--foreground)]">Recent signups</p>
          {users.length > 5 && (
            <button
              type="button"
              onClick={onNavigateToUsers}
              className="text-xs font-medium text-[var(--brand-strong)] transition-colors hover:underline"
            >
              View all {users.length} users →
            </button>
          )}
        </div>
        <div className="divide-y divide-[var(--border-subtle)]">
          {users.slice(0, 5).map((u) => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
              <div className="min-w-0">
                <span className="truncate text-sm font-medium text-[var(--foreground)]">{displayName(u)}</span>
                <span className="ml-2 text-xs text-[var(--foreground-subtle)]">{maskEmail(u.email)}</span>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs text-[var(--foreground-muted)]">
                <span className="tabular-nums">{u.sessionCount} sessions</span>
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Flame size={12} className={u.streak > 0 ? "text-[var(--palette-orange-500)]" : "text-[var(--foreground-subtle)]"} aria-hidden />
                  {u.streak}
                </span>
                <span className="tabular-nums">{new Date(u.createdAt).toLocaleDateString()}</span>
                {u.role === "admin" && (
                  <span className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 font-medium text-[var(--brand-strong)]">Admin</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </MotionTab>
  );
}
