import { SectionHeader, StatCard, MotionTab, LoadingState } from "./AdminHelpers";
import type { BattlePassStats } from "./AdminTypes";

export function AdminBattlePassPanel({ bpStats }: { bpStats: BattlePassStats }) {
  const s = bpStats.stats;
  return (
    <MotionTab>
      <SectionHeader title="Battle Pass Admin" sub="Season progress tracking and tier analytics." />
      {s ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Enrolled users" value={String(s.totalUsers)} />
            <StatCard label="Avg tier" value={`Tier ${s.avgTier}`} accent="violet" />
            <StatCard label="Avg season XP" value={String(Math.round(s.avgXp))} accent="sky" />
            <StatCard label="Premium unlocked" value={String(s.premiumCount)} accent="amber" />
            <StatCard label="Highest tier" value={`Tier ${s.maxTier}`} accent="rose" />
          </div>

          {bpStats.tierDistribution.length > 0 && (
            <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/40 p-5">
              <p className="text-xs text-[var(--palette-zinc-500)] mb-4">Tier Distribution</p>
              <div className="flex items-end gap-1 h-32">
                {bpStats.tierDistribution.map(d => {
                  const maxC = Math.max(1, ...bpStats.tierDistribution.map(x => x.count));
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
        </>
      ) : (
        <LoadingState text="Loading battle pass data…" />
      )}

      <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/20 p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--palette-zinc-500)] mb-3">Season Configuration</p>
        <div className="grid gap-2 sm:grid-cols-3 text-xs text-[var(--palette-zinc-400)]">
          <div className="rounded-lg border border-[var(--palette-zinc-800)] px-4 py-3">
            <p className="text-[var(--palette-zinc-500)] text-[11px] uppercase tracking-wider">Season</p>
            <p className="text-[var(--palette-zinc-100)] font-semibold mt-1">Season 1</p>
          </div>
          <div className="rounded-lg border border-[var(--palette-zinc-800)] px-4 py-3">
            <p className="text-[var(--palette-zinc-500)] text-[11px] uppercase tracking-wider">XP per Tier</p>
            <p className="text-[var(--palette-violet-400)] font-semibold mt-1">1,000 XP</p>
          </div>
          <div className="rounded-lg border border-[var(--palette-zinc-800)] px-4 py-3">
            <p className="text-[var(--palette-zinc-500)] text-[11px] uppercase tracking-wider">Max Tiers</p>
            <p className="text-[var(--palette-amber-400)] font-semibold mt-1">50 Tiers</p>
          </div>
        </div>
      </div>
    </MotionTab>
  );
}
