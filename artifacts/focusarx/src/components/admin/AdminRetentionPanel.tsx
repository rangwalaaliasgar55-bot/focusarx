import { SectionHeader, StatCard, MotionTab, EmptyState } from "./AdminHelpers";
import type { RetentionData } from "./AdminTypes";

export function AdminRetentionPanel({ data }: { data: RetentionData | null }) {
  if (!data) {
    return (
      <MotionTab>
        <SectionHeader title="Retention Analytics" sub="Login rewards, streak freeze usage, and battle pass engagement." />
        <EmptyState title="No retention data yet" description="Analytics will appear once users start engaging with the platform." />
      </MotionTab>
    );
  }

  return (
    <MotionTab>
      <SectionHeader title="Retention Analytics" sub="Are people coming back — and who is about to leave? Mechanics below." />

      {/* Cohort health first: the actual retention question, before the
          engagement furniture that used to open this tab. */}
      {data.cohorts && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--palette-zinc-500)] mb-3">Cohort health</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Active today (DAU)" value={String(data.cohorts.dau)} accent="sky" />
            <StatCard label="Active this week (WAU)" value={String(data.cohorts.wau)} accent="violet" />
            <StatCard label="Active this month (MAU)" value={String(data.cohorts.mau)} />
            <StatCard label="Stickiness (DAU/MAU)" value={`${data.cohorts.stickiness}%`} accent="rose" />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="New signups (7d)" value={String(data.cohorts.signedUp7d)} />
            <StatCard label="Activated (studied once)" value={`${data.cohorts.activated7d} · ${data.cohorts.activationRate}%`} accent="sky" />
            <StatCard label="Returning users (7d)" value={`${data.cohorts.returned7d} · ${data.cohorts.returningShare}%`} accent="violet" />
            <StatCard label="Streaks 7d+" value={String(data.cohorts.healthyStreaks)} accent="sky" />
          </div>

          {/* The two lists an admin can act on today. */}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--palette-amber-900)]/60 bg-[var(--palette-amber-950)]/20 p-4">
              <p className="text-sm font-semibold text-[var(--palette-amber-300)]">{data.cohorts.atRisk} learner(s) at risk</p>
              <p className="mt-1 text-[11px] text-[var(--palette-zinc-400)]">
                Studied within the last 30 days but not the last 7. One good nudge lands here — a mission, a streak save, or a message from someone they follow.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/40 p-4">
              <p className="text-sm font-semibold text-[var(--palette-zinc-300)]">{data.cohorts.dormant} dormant account(s)</p>
              <p className="mt-1 text-[11px] text-[var(--palette-zinc-400)]">
                No focus session in 30 days. {data.cohorts.endangeredStreaks} live streak(s) are unprotected right now — they break tonight without a session.
              </p>
            </div>
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--palette-zinc-500)] mb-3">Daily Login Rewards</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Total claims" value={String(data.loginRewards?.totalClaims ?? 0)} accent="sky" />
          <StatCard label="Avg claim streak" value={`${data.loginRewards?.avgStreak ?? 0}d`} accent="violet" />
          <StatCard label="Users with claims" value={String(data.loginRewards?.usersWithClaims ?? 0)} />
        </div>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--palette-zinc-500)] mb-3">Streak Freeze Tokens</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Tokens issued" value={String(data.streakFreeze?.totalTokensGiven ?? 0)} />
          <StatCard label="Tokens used" value={String(data.streakFreeze?.totalTokensUsed ?? 0)} accent="rose" />
          <StatCard label="Users with tokens" value={String(data.streakFreeze?.usersWithTokens ?? 0)} accent="sky" />
        </div>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--palette-zinc-500)] mb-3">Battle Pass — Season 1</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Users enrolled" value={String(data.battlePass?.totalUsers ?? 0)} />
          <StatCard label="Avg tier" value={`Tier ${data.battlePass?.avgTier ?? 0}`} accent="violet" />
          <StatCard label="Avg season XP" value={String(data.battlePass?.avgSeasonXp ?? 0)} accent="sky" />
          <StatCard label="Premium unlocked" value={String(data.battlePass?.premiumCount ?? 0)} accent="rose" />
        </div>
        {(data.battlePass?.tierDistribution?.length ?? 0) > 0 && (
          <div className="mt-4 rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/40 p-5">
            <p className="text-xs text-[var(--palette-zinc-500)] mb-3">Tier distribution</p>
            <div className="flex items-end gap-1 h-20">
              {(data.battlePass?.tierDistribution ?? []).map((d) => {
                const maxC = Math.max(1, ...(data.battlePass?.tierDistribution ?? []).map((x) => x.count));
                return (
                  <div key={d.tier} className="flex flex-1 flex-col items-center gap-1">
                    <div className="w-full rounded-t bg-[var(--palette-violet-500)]/60 hover:bg-[var(--palette-violet-400)]/80 transition-colors"
                      style={{ height: `${Math.round((d.count / maxC) * 100)}%`, minHeight: "2px" }}
                      title={`Tier ${d.tier}: ${d.count} users`}
                    />
                    {d.tier % 10 === 0 && <span className="text-[11px] text-[var(--palette-zinc-600)]">{d.tier}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--palette-zinc-500)] mb-3">Notifications</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard label="Total sent" value={String(data.notifications?.total ?? 0)} />
          <StatCard label="Unread" value={String(data.notifications?.unread ?? 0)} accent="rose" />
        </div>
      </div>
    </MotionTab>
  );
}
