import { SectionHeader, StatCard, MotionTab, EmptyState } from "./AdminHelpers";

export function AdminRetentionPanel({ data }: { data: any }) {
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
      <SectionHeader title="Retention Analytics" sub="Login rewards, streak freeze usage, and battle pass engagement." />

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
              {data.battlePass.tierDistribution.map((d: any) => {
                const maxC = Math.max(1, ...data.battlePass.tierDistribution.map((x: any) => x.count));
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
