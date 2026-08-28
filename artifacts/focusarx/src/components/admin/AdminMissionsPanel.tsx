import { SectionHeader, StatCard, Badge, MotionTab, EmptyState } from "./AdminHelpers";

type MissionData = {
  missions: { key: string; title: string; icon: string; type: string; difficulty?: string; completions: number; claims: number; completionRate: number; xpReward: number; coinReward: number }[];
  totalCompletions: number;
  totalClaims: number;
} | null;

export function AdminMissionsPanel({ data }: { data: MissionData }) {
  if (!data || data.missions.length === 0) {
    return (
      <MotionTab>
        <SectionHeader title="Mission Analytics" sub="Track completion rates and engagement across all mission types." />
        <EmptyState title="No mission data yet" description="Mission analytics will appear once users start completing missions." />
      </MotionTab>
    );
  }

  return (
    <MotionTab>
      <SectionHeader title="Mission Analytics" sub="Track completion rates and engagement across all mission types." />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total completions" value={String(data.totalCompletions)} accent="violet" />
        <StatCard label="Rewards claimed" value={String(data.totalClaims)} accent="sky" />
        <StatCard label="Mission types" value={String(data.missions.length)} />
      </div>

      <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/40 overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--palette-zinc-800)] flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--palette-zinc-500)]">Mission Performance</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--palette-zinc-900)]/80 text-xs uppercase tracking-wider text-[var(--palette-zinc-500)]">
              <tr>
                <th className="px-4 py-2.5 font-medium">Mission</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Difficulty</th>
                <th className="px-4 py-2.5 font-medium">Completions</th>
                <th className="px-4 py-2.5 font-medium">Claims</th>
                <th className="px-4 py-2.5 font-medium">Rate</th>
                <th className="px-4 py-2.5 font-medium">Rewards</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--palette-zinc-800)]/50">
              {data.missions.map((m) => (
                <tr key={m.key} className="hover:bg-[var(--palette-zinc-900)]/30 transition">
                  <td className="px-4 py-2.5">
                    <span className="mr-1.5">{m.icon}</span>
                    <span className="text-[var(--palette-zinc-200)] text-xs font-medium">{m.title}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge label={m.type} color={m.type === "daily" ? "bg-[var(--palette-blue-950)] text-[var(--palette-blue-400)]" : "bg-[var(--palette-purple-950)] text-[var(--palette-purple-400)]"} />
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-medium ${m.difficulty === "epic" ? "text-[var(--palette-purple-400)]" : m.difficulty === "hard" ? "text-[var(--palette-red-400)]" : m.difficulty === "medium" ? "text-[var(--palette-amber-400)]" : "text-[var(--palette-emerald-400)]"}`}>{m.difficulty}</span>
                  </td>
                  <td className="px-4 py-2.5 text-[var(--palette-zinc-300)] text-xs">{m.completions}</td>
                  <td className="px-4 py-2.5 text-[var(--palette-zinc-300)] text-xs">{m.claims}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 rounded-full bg-[var(--palette-zinc-800)] overflow-hidden">
                        <div className="h-full rounded-full bg-[var(--palette-violet-500)]/70" style={{ width: `${m.completionRate}%` }} />
                      </div>
                      <span className="text-[10px] text-[var(--palette-zinc-500)]">{m.completionRate}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-[10px] text-[var(--palette-violet-400)]">+{m.xpReward}xp</span>
                    <span className="text-[10px] text-[var(--palette-zinc-600)] mx-1">·</span>
                    <span className="text-[10px] text-[var(--palette-amber-400)]">{m.coinReward}🪙</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </MotionTab>
  );
}
