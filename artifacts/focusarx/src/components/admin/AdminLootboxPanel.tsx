import { useState, useEffect } from "react";
import { Save, X, Plus, Pencil, RefreshCw } from "lucide-react";
import { SectionHeader, Badge, MotionTab, EmptyState, LoadingState } from "./AdminHelpers";
import type { LootBoxType, AdminPanelProps } from "./AdminTypes";

export function AdminLootboxPanel({ authHeaders }: AdminPanelProps) {
  const [types, setTypes] = useState<LootBoxType[]>([]);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<LootBoxType>>({});

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/cms/lootboxes", { headers: authHeaders(), credentials: "include" });
      if (r.ok) { const d = await r.json(); setTypes(d.types ?? []); }
    } finally { setLoading(false); }
  }

  async function save(typeId: string) {
    const r = await fetch(`/api/admin/cms/lootboxes/${typeId}`, {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(form),
    });
    if (r.ok) {
      const d = await r.json();
      setTypes(prev => prev.map(t => t.id === typeId ? { ...t, ...d.type } : t));
      setEditId(null); setForm({});
    }
  }

  async function seedBoxes() {
    const r = await fetch("/api/admin/cms/seed/lootboxes", { method: "POST", headers: authHeaders(), credentials: "include" });
    const d = await r.json();
    alert(`Seeded ${d.seeded ?? 0} new boxes (${d.total ?? 0} total)`);
    load();
  }

  return (
    <MotionTab>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <SectionHeader title="Loot Box CMS" sub="Edit box types, costs, and availability." />
        <div className="flex gap-2 flex-wrap">
          <button onClick={seedBoxes} className="rounded-lg bg-[var(--palette-emerald-800)] hover:bg-[var(--palette-emerald-700)] px-3 py-1.5 text-xs text-[var(--palette-white)] font-medium flex items-center gap-1">
            <Plus size={12} /> Seed 50 Boxes
          </button>
          <button onClick={load} className="rounded-lg border border-[var(--palette-zinc-700)] px-3 py-1.5 text-xs text-[var(--palette-zinc-400)] hover:text-[var(--palette-zinc-200)] transition">
            <RefreshCw size={12} className="inline mr-1" />Refresh
          </button>
        </div>
      </div>

      {loading
        ? <LoadingState />
        : types.length === 0 ? (
          <EmptyState
            title="No loot box types found"
            description="Run the seeder to add default loot box types."
            action={
              <button onClick={seedBoxes} className="rounded-lg bg-[var(--palette-emerald-800)] hover:bg-[var(--palette-emerald-700)] px-4 py-2 text-xs text-[var(--palette-white)] font-medium">
                <Plus size={12} className="inline mr-1" /> Seed Boxes
              </button>
            }
          />
        ) : (
          <div className="space-y-3">
            {types.map(lb => (
              editId === lb.id ? (
                <div key={lb.id} className="rounded-xl border border-[var(--palette-violet-800)]/50 bg-[var(--palette-violet-950)]/20 p-5 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <input className="admin-input" placeholder="Name" value={form.name ?? lb.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                    <input className="admin-input" placeholder="Icon emoji" value={form.icon ?? lb.icon} onChange={e => setForm(p => ({ ...p, icon: e.target.value }))} />
                    <input className="admin-input" placeholder="Coin Cost" type="number" value={form.coinCost ?? lb.coinCost} onChange={e => setForm(p => ({ ...p, coinCost: Number(e.target.value) }))} />
                    <input className="admin-input sm:col-span-2" placeholder="Description" value={form.description ?? lb.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                    <input className="admin-input" placeholder="Glow color (#hex)" value={form.glowColor ?? lb.glowColor} onChange={e => setForm(p => ({ ...p, glowColor: e.target.value }))} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => void save(lb.id)} className="rounded-lg bg-[var(--palette-violet-700)] px-3 py-1.5 text-xs text-[var(--palette-white)] flex items-center gap-1"><Save size={10} /> Save</button>
                    <button onClick={() => { setEditId(null); setForm({}); }} className="rounded-lg border border-[var(--palette-zinc-700)] px-3 py-1.5 text-xs text-[var(--palette-zinc-400)]"><X size={10} className="inline mr-1" />Cancel</button>
                  </div>
                </div>
              ) : (
                <div key={lb.id} className="flex items-center gap-4 rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/40 px-5 py-4">
                  <span className="text-3xl">{lb.icon ?? "📦"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[var(--palette-zinc-200)]">{lb.name}</p>
                    <p className="text-xs text-[var(--palette-zinc-500)]">{lb.description}</p>
                    <p className="text-xs text-[var(--palette-zinc-600)] mt-1">{lb.possibleRewards?.length ?? 0} possible rewards</p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-bold text-[var(--palette-amber-400)]">{lb.coinCost.toLocaleString()} 🪙</p>
                      <Badge label={lb.rarity ?? "common"} color="bg-[var(--palette-violet-950)] text-[var(--palette-violet-400)]" />
                    </div>
                    <button onClick={() => { setEditId(lb.id); setForm({}); }} className="rounded-lg border border-[var(--palette-zinc-700)] px-2.5 py-1.5 text-xs text-[var(--palette-zinc-400)] hover:text-[var(--palette-violet-400)] flex items-center gap-1 transition">
                      <Pencil size={11} /> Edit
                    </button>
                  </div>
                </div>
              )
            ))}
          </div>
        )}
    </MotionTab>
  );
}
