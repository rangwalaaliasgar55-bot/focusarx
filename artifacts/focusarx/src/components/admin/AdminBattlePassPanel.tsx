import { useQuery } from "@tanstack/react-query";
import { SectionHeader, StatCard, MotionTab, LoadingState, adminFetch } from "./AdminHelpers";
import { asArray, asRecord, asString, asNumber } from "@/lib/api";
import type { BattlePassStats } from "./AdminTypes";

type SeasonRow = {
  id: string;
  title: string;
  season: string;
  isActive: boolean;
  tierCount: number;
  startDate: string | null;
  endDate: string | null;
};

/**
 * The configuration card used to be three hardcoded strings — "Season 1",
 * "1,000 XP", "50 Tiers" — none of which was true of the ladder that actually
 * runs (`requiredXp = tier * 500 + floor(tier / 5) * 250`, 30 tiers by
 * default). An admin reading it would size a season against numbers the code
 * does not use, so it now reads the live season and the live ladder instead.
 */
function seasonReader(value: unknown): SeasonRow[] {
  return asArray(asRecord(value).seasons).map((entry) => {
    const row = asRecord(entry);
    return {
      id: asString(row.id),
      title: asString(row.title),
      season: asString(row.season),
      isActive: row.isActive === true,
      tierCount: asNumber(row.tierCount, 0),
      startDate: row.startDate ? asString(row.startDate) : null,
      endDate: row.endDate ? asString(row.endDate) : null,
    };
  }).filter((row) => row.id.length > 0);
}

function formatDay(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function AdminBattlePassPanel({ bpStats }: { bpStats: BattlePassStats }) {
  const s = bpStats.stats;
  // The builder next to this panel is the place seasons are authored; this card
  // should describe the one that is actually live, not a remembered default.
  const { data: seasonRows } = useQuery({
    queryKey: ["admin-battle-pass-seasons"],
    queryFn: async () => {
      const res = await adminFetch("/api/admin/battle-pass");
      if (!res.ok) throw new Error("Could not load seasons");
      return seasonReader(await res.json().catch(() => ({})));
    },
    staleTime: 60_000,
  });
  const liveSeason = seasonRows?.find((row) => row.isActive) ?? seasonRows?.[0] ?? null;
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
            <p className="text-[var(--palette-zinc-500)] text-[11px] uppercase tracking-wider">Live season</p>
            <p className="text-[var(--palette-zinc-100)] font-semibold mt-1">{liveSeason ? liveSeason.title : "No published season"}</p>
            {liveSeason && <p className="mt-1 text-[11px] text-[var(--palette-zinc-500)]">{formatDay(liveSeason.startDate) ?? "—"} → {formatDay(liveSeason.endDate) ?? "open"}</p>}
          </div>
          <div className="rounded-lg border border-[var(--palette-zinc-800)] px-4 py-3">
            <p className="text-[var(--palette-zinc-500)] text-[11px] uppercase tracking-wider">XP ladder</p>
            <p className="text-[var(--palette-violet-400)] font-semibold mt-1">500 XP, +250 per 5 tiers</p>
            <p className="mt-1 text-[11px] text-[var(--palette-zinc-500)]">Tier 1 needs 500 XP · tier 30 needs 16,500 XP</p>
          </div>
          <div className="rounded-lg border border-[var(--palette-zinc-800)] px-4 py-3">
            <p className="text-[var(--palette-zinc-500)] text-[11px] uppercase tracking-wider">Tiers in play</p>
            <p className="text-[var(--palette-amber-400)] font-semibold mt-1">{liveSeason ? `${liveSeason.tierCount} tiers` : "30 tiers (default)"}</p>
            <p className="mt-1 text-[11px] text-[var(--palette-zinc-500)]">A season may ship 10–50</p>
          </div>
        </div>
      </div>
    </MotionTab>
  );
}
