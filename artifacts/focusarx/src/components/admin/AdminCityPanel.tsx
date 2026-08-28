import { SectionHeader, MotionTab } from "./AdminHelpers";

const BUILDINGS = [
  { id: "town_hall", name: "Town Hall", emoji: "🏛️", desc: "Central building — unlocked at start", unlock: 0, color: "text-[var(--palette-amber-400)]" },
  { id: "library", name: "Library", emoji: "📚", desc: "Unlocked at 1,000 XP", unlock: 1000, color: "text-[var(--palette-sky-400)]" },
  { id: "coffee_shop", name: "Coffee Shop", emoji: "☕", desc: "Unlocked at 2,500 XP", unlock: 2500, color: "text-[var(--palette-orange-400)]" },
  { id: "lab", name: "Research Lab", emoji: "🔬", desc: "Unlocked at 5,000 XP", unlock: 5000, color: "text-[var(--palette-violet-400)]" },
  { id: "stadium", name: "Focus Stadium", emoji: "🏟️", desc: "Unlocked at 10,000 XP", unlock: 10000, color: "text-[var(--palette-rose-400)]" },
  { id: "observatory", name: "Observatory", emoji: "🔭", desc: "Unlocked at 25,000 XP", unlock: 25000, color: "text-[var(--palette-emerald-400)]" },
];

export function AdminCityPanel() {
  return (
    <MotionTab>
      <SectionHeader title="Focus City CMS" sub="Building types and experience-based unlock configuration." />

      <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/20 p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--palette-zinc-500)] mb-4">Building Configuration</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BUILDINGS.map(b => (
            <div key={b.id} className="rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/40 px-4 py-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{b.emoji}</span>
                <div>
                  <p className="text-sm font-medium text-[var(--palette-zinc-200)]">{b.name}</p>
                  <p className={`text-xs font-semibold ${b.color}`}>
                    {b.unlock === 0 ? "Free" : `${b.unlock.toLocaleString()} XP`}
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-[var(--palette-zinc-500)]">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/20 p-4">
        <p className="text-xs text-[var(--palette-zinc-500)]">💡 City building configs are stored in code (<code className="font-mono text-[var(--palette-violet-400)]">routes/city.ts</code>). Modify unlock thresholds and add new buildings by editing the server config.</p>
      </div>
    </MotionTab>
  );
}
