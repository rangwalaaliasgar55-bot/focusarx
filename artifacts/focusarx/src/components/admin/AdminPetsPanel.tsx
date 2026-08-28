import { SectionHeader, StatCard, MotionTab, EmptyState } from "./AdminHelpers";
import type { PetStats } from "./AdminTypes";

const PET_TYPES = [
  { id: "owl", emoji: "🦉", name: "Sage Owl" },
  { id: "fox", emoji: "🦊", name: "Focus Fox" },
  { id: "dragon", emoji: "🐲", name: "Study Dragon" },
  { id: "robot", emoji: "🤖", name: "Study Bot" },
  { id: "cat", emoji: "🐱", name: "Neko Scholar" },
  { id: "phoenix", emoji: "🦅", name: "Rising Phoenix" },
];

const EVOLUTION_STAGES = [
  { stage: 0, name: "Newborn", level: "Lv 1–9", color: "text-[var(--palette-zinc-400)]" },
  { stage: 1, name: "Growing", level: "Lv 10–19", color: "text-[var(--palette-emerald-400)]" },
  { stage: 2, name: "Evolved", level: "Lv 20–29", color: "text-[var(--palette-blue-400)]" },
  { stage: 3, name: "Legendary", level: "Lv 30+", color: "text-[var(--palette-amber-400)]" },
];

export function AdminPetsPanel({ petStats }: { petStats: PetStats }) {
  if (petStats.stats.length === 0) {
    return (
      <MotionTab>
        <SectionHeader title="Pet CMS" sub="Overview of all pet companions across the platform." />
        <EmptyState title="No pets adopted yet" description="Pet data will appear once users adopt companions." />
      </MotionTab>
    );
  }

  return (
    <MotionTab>
      <SectionHeader title="Pet CMS" sub="Overview of all pet companions across the platform." />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total pets" value={String(petStats.totalPets)} accent="violet" />
        <StatCard label="Pet types" value={String(PET_TYPES.length)} />
        <StatCard label="Most popular" value={petStats.stats[0]?.petType ?? "N/A"} accent="amber" />
      </div>

      <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/40 p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--palette-zinc-500)] mb-4">Pet Type Distribution</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PET_TYPES.map(pt => {
            const s = petStats.stats.find(x => x.petType === pt.id);
            return (
              <div key={pt.id} className="flex items-center gap-3 rounded-lg border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/40 px-4 py-3">
                <span className="text-2xl">{pt.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--palette-zinc-200)]">{pt.name}</p>
                  <p className="text-xs text-[var(--palette-zinc-500)]">{s?.count ?? 0} adopted · avg level {s?.avgLevel ?? 0}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-[var(--palette-violet-400)]">{s?.count ?? 0}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/20 p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--palette-zinc-500)] mb-3">Evolution System</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-xs text-[var(--palette-zinc-400)]">
          {EVOLUTION_STAGES.map(e => (
            <div key={e.stage} className="rounded-lg border border-[var(--palette-zinc-800)] px-3 py-2">
              <p className={`font-semibold ${e.color}`}>Stage {e.stage + 1}: {e.name}</p>
              <p className="text-[var(--palette-zinc-600)]">{e.level}</p>
              <p className="text-[var(--palette-zinc-600)]">500 XP per level</p>
            </div>
          ))}
        </div>
      </div>
    </MotionTab>
  );
}
