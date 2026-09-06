import { useState, useEffect } from "react";
import { Save, X, Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import { Badge, EmptyState, LoadingState, MotionTab, SectionHeader, adminFetch } from "./AdminHelpers";
import type { MarketplaceItem, AdminPanelProps } from "./AdminTypes";

const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];
const TYPES = ["frame", "avatar", "effect", "accessory", "decoration", "booster"];

const RARITY_COLORS: Record<string, string> = {
  legendary: "bg-[var(--palette-amber-950)] text-[var(--palette-amber-400)]",
  epic: "bg-[var(--palette-purple-950)] text-[var(--palette-purple-400)]",
  rare: "bg-[var(--palette-blue-950)] text-[var(--palette-blue-400)]",
  uncommon: "bg-[var(--palette-emerald-950)] text-[var(--palette-emerald-400)]",
  common: "bg-[var(--palette-zinc-800)] text-[var(--palette-zinc-400)]",
};

export function AdminMarketplacePanel({ authHeaders }: AdminPanelProps) {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<MarketplaceItem>>({});
  const [addMode, setAddMode] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await adminFetch("/api/admin/cms/marketplace", { headers: authHeaders(), credentials: "include" });
      if (r.ok) { const d = await r.json(); setItems(d.items ?? []); }
    } finally { setLoading(false); }
  }

  async function saveItem(isNew: boolean) {
    const url = isNew ? "/api/admin/cms/marketplace" : `/api/admin/cms/marketplace/${form.id}`;
    const method = isNew ? "POST" : "PATCH";
    try {
      const r = await adminFetch(url, {
        method, headers: { ...authHeaders(), "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify(form),
      });
      if (r.ok) {
        const d = await r.json();
        if (isNew) setItems(prev => [...prev, d.item]);
        else setItems(prev => prev.map(i => i.id === d.item.id ? d.item : i));
        setEditId(null); setAddMode(false); setForm({});
      }
    } catch { /* ignore */ }
  }

  async function deleteItem(itemId: string) {
    if (!window.confirm("Delete this item?")) return;
    const r = await adminFetch(`/api/admin/cms/marketplace/${itemId}`, {
      method: "DELETE", headers: authHeaders(), credentials: "include",
    });
    if (r.ok) setItems(prev => prev.filter(i => i.id !== itemId));
  }

  return (
    <MotionTab>
      <SectionHeader title="Marketplace CMS" sub="Manage all purchasable cosmetic items and boosters." />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-xs text-[var(--palette-zinc-500)]">{items.length} items total · {items.filter(i => i.isActive).length} active</p>
        <div className="flex items-center gap-2">
          <button onClick={load} className="rounded-lg border border-[var(--palette-zinc-700)] px-3 py-1.5 text-xs text-[var(--palette-zinc-400)] hover:text-[var(--palette-zinc-200)] transition">
            <RefreshCw size={12} className="inline mr-1" />Refresh
          </button>
          <button
            onClick={() => { setAddMode(true); setForm({ isActive: true, rarity: "common", type: "frame" }); setEditId(null); }}
            className="rounded-lg bg-[var(--palette-violet-700)] hover:bg-[var(--palette-violet-600)] px-3 py-1.5 text-xs text-[var(--palette-white)] font-medium flex items-center gap-1"
          >
            <Plus size={12} /> Add Item
          </button>
        </div>
      </div>

      {/* Add form */}
      {addMode && (
        <div className="rounded-xl border border-[var(--palette-violet-800)]/50 bg-[var(--palette-violet-950)]/20 p-5 space-y-3">
          <p className="text-xs font-semibold text-[var(--palette-violet-300)] uppercase tracking-wider">New Item</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input className="admin-input" placeholder="Item ID (unique)" value={form.id ?? ""} onChange={e => setForm(p => ({ ...p, id: e.target.value }))} />
            <input className="admin-input" placeholder="Name" value={form.name ?? ""} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            <input className="admin-input" placeholder="Emoji" value={form.emoji ?? ""} onChange={e => setForm(p => ({ ...p, emoji: e.target.value }))} />
            <input className="admin-input" placeholder="Description" value={form.description ?? ""} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            <input className="admin-input" placeholder="Cost (coins)" type="number" value={form.costCoins ?? ""} onChange={e => setForm(p => ({ ...p, costCoins: Number(e.target.value) }))} />
            <select className="admin-input" value={form.type ?? "frame"} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="admin-input" value={form.rarity ?? "common"} onChange={e => setForm(p => ({ ...p, rarity: e.target.value }))}>
              {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => saveItem(true)} className="rounded-lg bg-[var(--palette-violet-700)] hover:bg-[var(--palette-violet-600)] px-3 py-1.5 text-xs text-[var(--palette-white)] font-medium flex items-center gap-1">
              <Save size={12} /> Save
            </button>
            <button onClick={() => { setAddMode(false); setForm({}); }} className="rounded-lg border border-[var(--palette-zinc-700)] px-3 py-1.5 text-xs text-[var(--palette-zinc-400)] hover:text-[var(--palette-zinc-200)]">
              <X size={12} className="inline mr-1" />Cancel
            </button>
          </div>
        </div>
      )}

      {loading
        ? <LoadingState />
        : items.length === 0 ? (
          <EmptyState
            title="No marketplace items"
            description="Add your first cosmetic item to the shop."
            action={
              <button onClick={() => { setAddMode(true); setForm({ isActive: true, rarity: "common", type: "frame" }); }} className="rounded-lg bg-[var(--palette-violet-700)] px-4 py-2 text-xs text-[var(--palette-white)] font-medium">
                <Plus size={12} className="inline mr-1" /> Add First Item
              </button>
            }
          />
        ) : (
          <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[40rem] w-full text-left text-xs">
                <thead className="bg-[var(--palette-zinc-900)]/80 text-[var(--palette-zinc-500)] uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 font-medium">Item</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Rarity</th>
                    <th className="px-4 py-3 font-medium">Cost</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--palette-zinc-800)]/50">
                  {items.map(item => (
                    editId === item.id ? (
                      <tr key={item.id} className="bg-[var(--palette-violet-950)]/20">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                            <input className="admin-input" placeholder="Name" value={form.name ?? item.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                            <input className="admin-input" placeholder="Emoji" value={form.emoji ?? item.emoji} onChange={e => setForm(p => ({ ...p, emoji: e.target.value }))} />
                            <input className="admin-input" placeholder="Cost" type="number" value={form.costCoins ?? item.costCoins} onChange={e => setForm(p => ({ ...p, costCoins: Number(e.target.value) }))} />
                            <select className="admin-input" value={form.rarity ?? item.rarity} onChange={e => setForm(p => ({ ...p, rarity: e.target.value }))}>
                              {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                            <input className="admin-input sm:col-span-2" placeholder="Description" value={form.description ?? item.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                            <label className="flex items-center gap-2 text-[var(--palette-zinc-400)]">
                              <input type="checkbox" checked={form.isActive ?? item.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} />
                              Active
                            </label>
                          </div>
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => saveItem(false)} className="rounded-lg bg-[var(--palette-violet-700)] px-3 py-1 text-xs text-[var(--palette-white)] flex items-center gap-1"><Save size={10} /> Save</button>
                            <button onClick={() => { setEditId(null); setForm({}); }} className="rounded-lg border border-[var(--palette-zinc-700)] px-3 py-1 text-xs text-[var(--palette-zinc-400)]"><X size={10} className="inline" /></button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={item.id} className="hover:bg-[var(--palette-zinc-900)]/30 transition">
                        <td className="px-4 py-3">
                          <span className="mr-1.5">{item.emoji}</span>
                          <span className="text-[var(--palette-zinc-200)] font-medium">{item.name}</span>
                          <p className="text-[10px] text-[var(--palette-zinc-600)] font-mono">{item.id}</p>
                        </td>
                        <td className="px-4 py-3 text-[var(--palette-zinc-400)]">{item.type}</td>
                        <td className="px-4 py-3">
                          <Badge label={item.rarity} color={RARITY_COLORS[item.rarity] ?? RARITY_COLORS.common} />
                        </td>
                        <td className="px-4 py-3 text-[var(--palette-amber-400)]">{item.costCoins.toLocaleString()} 🪙</td>
                        <td className="px-4 py-3">
                          <Badge label={item.isActive ? "Active" : "Inactive"} color={item.isActive ? "bg-[var(--palette-emerald-950)] text-[var(--palette-emerald-400)]" : "bg-[var(--palette-zinc-800)] text-[var(--palette-zinc-500)]"} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => { setEditId(item.id); setForm({}); }} className="rounded p-1 text-[var(--palette-zinc-500)] hover:text-[var(--palette-violet-400)] transition"><Pencil size={12} /></button>
                            <button onClick={() => void deleteItem(item.id)} className="rounded p-1 text-[var(--palette-zinc-500)] hover:text-[var(--palette-red-400)] transition"><Trash2 size={12} /></button>
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
