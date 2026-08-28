import { useState, useEffect } from "react";
import { Save, X, Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import { SectionHeader, Badge, MotionTab, EmptyState, LoadingState } from "./AdminHelpers";
import type { QuestDef, AdminPanelProps } from "./AdminTypes";

const TYPES = ["daily", "weekly"];
const REQ_TYPES = ["focus_minutes", "session_count", "streak_days", "coins_earned", "xp_earned"];

export function AdminQuestsPanel({ authHeaders }: AdminPanelProps) {
  const [quests, setQuests] = useState<QuestDef[]>([]);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<QuestDef>>({});
  const [addMode, setAddMode] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/cms/quests", { headers: authHeaders(), credentials: "include" });
      if (r.ok) { const d = await r.json(); setQuests(d.quests ?? []); }
    } finally { setLoading(false); }
  }

  async function saveQuest(isNew: boolean) {
    const url = isNew ? "/api/admin/cms/quests" : `/api/admin/cms/quests/${form.id}`;
    const method = isNew ? "POST" : "PATCH";
    try {
      const r = await fetch(url, {
        method, headers: { ...authHeaders(), "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify(form),
      });
      if (r.ok) {
        const d = await r.json();
        if (isNew) setQuests(prev => [...prev, d.quest]);
        else setQuests(prev => prev.map(q => q.id === d.quest.id ? d.quest : q));
        setEditId(null); setAddMode(false); setForm({});
      }
    } catch { /* ignore */ }
  }

  async function deactivateQuest(questId: string) {
    if (!window.confirm("Deactivate this quest?")) return;
    const r = await fetch(`/api/admin/cms/quests/${questId}`, {
      method: "DELETE", headers: authHeaders(), credentials: "include",
    });
    if (r.ok) setQuests(prev => prev.map(q => q.id === questId ? { ...q, isActive: false } : q));
  }

  async function seedQuests() {
    const r = await fetch("/api/admin/cms/seed/quests", { method: "POST", headers: authHeaders(), credentials: "include" });
    const d = await r.json();
    alert(`Seeded ${d.seeded ?? 0} new quests (${d.total ?? 0} total)`);
    load();
  }

  return (
    <MotionTab>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <SectionHeader title="Quest Builder" sub="Create and manage daily and weekly quests for users." />
        <div className="flex items-center gap-2">
          <button onClick={load} className="rounded-lg border border-[var(--palette-zinc-700)] px-3 py-1.5 text-xs text-[var(--palette-zinc-400)] hover:text-[var(--palette-zinc-200)] transition">
            <RefreshCw size={12} className="inline mr-1" />Refresh
          </button>
          <button
            onClick={() => { setAddMode(true); setForm({ type: "daily", metric: "focus_minutes", isActive: true }); setEditId(null); }}
            className="rounded-lg bg-[var(--palette-violet-700)] hover:bg-[var(--palette-violet-600)] px-3 py-1.5 text-xs text-[var(--palette-white)] font-medium flex items-center gap-1"
          >
            <Plus size={12} /> New Quest
          </button>
        </div>
      </div>

      {addMode && (
        <div className="rounded-xl border border-[var(--palette-violet-800)]/50 bg-[var(--palette-violet-950)]/20 p-5 space-y-3">
          <p className="text-xs font-semibold text-[var(--palette-violet-300)] uppercase tracking-wider">New Quest</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input className="admin-input" placeholder="Title" value={form.title ?? ""} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            <input className="admin-input" placeholder="Icon (emoji)" value={form.icon ?? ""} onChange={e => setForm(p => ({ ...p, icon: e.target.value }))} />
            <select className="admin-input" value={form.type ?? "daily"} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="admin-input" value={form.metric ?? "focus_minutes"} onChange={e => setForm(p => ({ ...p, metric: e.target.value }))}>
              {REQ_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <input className="admin-input" placeholder="Target Value" type="number" value={form.target ?? ""} onChange={e => setForm(p => ({ ...p, target: Number(e.target.value) }))} />
            <input className="admin-input" placeholder="XP Reward" type="number" value={form.xpReward ?? ""} onChange={e => setForm(p => ({ ...p, xpReward: Number(e.target.value) }))} />
            <input className="admin-input" placeholder="Coin Reward" type="number" value={form.coinReward ?? ""} onChange={e => setForm(p => ({ ...p, coinReward: Number(e.target.value) }))} />
            <input className="admin-input lg:col-span-2" placeholder="Description" value={form.description ?? ""} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <button onClick={() => void saveQuest(true)} className="rounded-lg bg-[var(--palette-violet-700)] px-3 py-1.5 text-xs text-[var(--palette-white)] font-medium flex items-center gap-1"><Save size={12} /> Save Quest</button>
            <button onClick={() => { setAddMode(false); setForm({}); }} className="rounded-lg border border-[var(--palette-zinc-700)] px-3 py-1.5 text-xs text-[var(--palette-zinc-400)]"><X size={12} className="inline mr-1" />Cancel</button>
          </div>
        </div>
      )}

      {loading
        ? <LoadingState />
        : quests.length === 0 ? (
          <EmptyState
            title="No quests found"
            description="Seed default quests to get started."
            action={
              <button onClick={seedQuests} className="rounded-lg bg-[var(--palette-violet-700)] hover:bg-[var(--palette-violet-600)] px-4 py-2 text-xs text-[var(--palette-white)] font-medium inline-flex items-center gap-1">
                <Plus size={12} /> Seed Default Quests
              </button>
            }
          />
        ) : (
          <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[40rem] w-full text-left text-xs">
                <thead className="bg-[var(--palette-zinc-900)]/80 text-[var(--palette-zinc-500)] uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 font-medium">Quest</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Requirement</th>
                    <th className="px-4 py-3 font-medium">Rewards</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--palette-zinc-800)]/50">
                  {quests.map(q => (
                    editId === q.id ? (
                      <tr key={q.id} className="bg-[var(--palette-violet-950)]/20">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="grid gap-2 sm:grid-cols-3">
                            <input className="admin-input" placeholder="Title" value={form.title ?? q.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
                            <input className="admin-input" placeholder="Icon (emoji)" value={form.icon ?? q.icon} onChange={e => setForm(p => ({ ...p, icon: e.target.value }))} />
                            <input className="admin-input" placeholder="Target Value" type="number" value={form.target ?? q.target} onChange={e => setForm(p => ({ ...p, target: Number(e.target.value) }))} />
                            <input className="admin-input" placeholder="XP Reward" type="number" value={form.xpReward ?? q.xpReward} onChange={e => setForm(p => ({ ...p, xpReward: Number(e.target.value) }))} />
                            <input className="admin-input" placeholder="Coin Reward" type="number" value={form.coinReward ?? q.coinReward} onChange={e => setForm(p => ({ ...p, coinReward: Number(e.target.value) }))} />
                            <label className="flex items-center gap-2 text-[var(--palette-zinc-400)]">
                              <input type="checkbox" checked={form.isActive ?? q.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} />
                              Active
                            </label>
                          </div>
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => void saveQuest(false)} className="rounded-lg bg-[var(--palette-violet-700)] px-3 py-1 text-xs text-[var(--palette-white)] flex items-center gap-1"><Save size={10} /> Save</button>
                            <button onClick={() => { setEditId(null); setForm({}); }} className="rounded-lg border border-[var(--palette-zinc-700)] px-3 py-1 text-xs text-[var(--palette-zinc-400)]"><X size={10} className="inline" /></button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={q.id} className="hover:bg-[var(--palette-zinc-900)]/30 transition">
                        <td className="px-4 py-3">
                          <span className="mr-1.5">{q.icon}</span>
                          <span className="text-[var(--palette-zinc-200)] font-medium">{q.title}</span>
                          {q.description && <p className="text-[var(--palette-zinc-600)] text-[10px] mt-0.5">{q.description}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <Badge label={q.type} color={q.type === "daily" ? "bg-[var(--palette-blue-950)] text-[var(--palette-blue-400)]" : "bg-[var(--palette-purple-950)] text-[var(--palette-purple-400)]"} />
                        </td>
                        <td className="px-4 py-3 text-[var(--palette-zinc-400)]">{q.metric}: <span className="text-[var(--palette-zinc-200)]">{q.target}</span></td>
                        <td className="px-4 py-3">
                          <span className="text-[var(--palette-violet-400)]">+{q.xpReward}xp</span>
                          <span className="text-[var(--palette-zinc-600)] mx-1">·</span>
                          <span className="text-[var(--palette-amber-400)]">{q.coinReward}🪙</span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge label={q.isActive ? "Active" : "Inactive"} color={q.isActive ? "bg-[var(--palette-emerald-950)] text-[var(--palette-emerald-400)]" : "bg-[var(--palette-zinc-800)] text-[var(--palette-zinc-500)]"} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => { setEditId(q.id); setForm({}); }} className="rounded p-1 text-[var(--palette-zinc-500)] hover:text-[var(--palette-violet-400)]"><Pencil size={12} /></button>
                            {q.isActive && <button onClick={() => void deactivateQuest(q.id)} className="rounded p-1 text-[var(--palette-zinc-500)] hover:text-[var(--palette-red-400)]"><Trash2 size={12} /></button>}
                          </div>
                        </td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
    </MotionTab>
  );
}
