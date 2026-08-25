import { useState, useEffect, useCallback } from "react";
import { haptic } from "@/lib/haptics";
import { motion, AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { getToken } from "@/lib/auth";
import { ShoppingBag, CheckCircle, Package, Zap, Crown, Lock } from "lucide-react";

const RARITY_STYLES: Record<string, { label: string; color: string; bg: string; border: string; glow: string }> = {
  common:    { label: "Common",    color: "var(--foreground-muted)", bg: "var(--rgba-148-163-184-0_08)", border: "var(--rgba-148-163-184-0_2)", glow: "0 0 0 transparent" },
  uncommon:  { label: "Uncommon",  color: "var(--palette-10b981)", bg: "var(--rgba-16-185-129-0_08)", border: "var(--rgba-16-185-129-0_25)", glow: "0 0 12px var(--rgba-16-185-129-0_15)" },
  rare:      { label: "Rare",      color: "var(--color-info)", bg: "var(--rgba-59-130-246-0_08)",  border: "var(--rgba-59-130-246-0_3)",  glow: "0 0 16px var(--rgba-59-130-246-0_2)" },
  epic:      { label: "Epic",      color: "var(--brand-500)", bg: "var(--rgba-139-92-246-0_1)",   border: "var(--rgba-139-92-246-0_35)", glow: "0 0 20px var(--rgba-139-92-246-0_25)" },
  legendary: { label: "Legendary", color: "var(--color-warning)", bg: "var(--rgba-245-158-11-0_1)",   border: "var(--rgba-245-158-11-0_4)",  glow: "0 0 24px var(--rgba-245-158-11-0_3)" },
};

const TYPE_FILTERS = [
  { id: "all",       label: "All",        icon: "🛒" },
  { id: "frame",     label: "Frames",     icon: "🖼️" },
  { id: "avatar",    label: "Avatars",    icon: "👤" },
  { id: "effect",    label: "Effects",    icon: "✨" },
  { id: "accessory", label: "Accessories",icon: "👑" },
  { id: "decoration",label: "City Decor", icon: "🏙️" },
  { id: "booster",   label: "Boosters",   icon: "⚡" },
];

function authHeaders() {
  const t = getToken();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (t) h["Authorization"] = `Bearer ${t}`;
  return h;
}

export default function MarketplacePage() {
  const [items, setItems] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [justBought, setJustBought] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bundles, setBundles] = useState<any[]>([]);
  const [inventoryMap, setInventoryMap] = useState<Record<string, string>>({}); // itemId -> inventory row id
  const [busyGift, setBusyGift] = useState<string | null>(null);
  const [selling, setSelling] = useState<string | null>(null);
  const [buyingBundle, setBuyingBundle] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [itemsRes, walletRes, invRes] = await Promise.all([
        fetch("/api/marketplace", { headers: authHeaders() }),
        fetch("/api/gamification/wallet", { headers: authHeaders() }),
        fetch("/api/marketplace/inventory", { headers: authHeaders() }),
      ]);
      const itemsData = await itemsRes.json();
      const walletData = await walletRes.json();
      const invData = await invRes.json();
      setItems(itemsData.items ?? []);
      setBundles(itemsData.bundles ?? []);
      setWallet(walletData ?? null);
      const map: Record<string, string> = {};
      for (const row of invData.inventory ?? []) map[row.itemId] = row.id;
      setInventoryMap(map);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function purchase(itemId: string) {
    setPurchasing(itemId);
    setError(null);
    try {
      const r = await fetch(`/api/marketplace/${itemId}/purchase`, { method: "POST", headers: authHeaders() });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Purchase failed"); haptic("error"); return; }
      setJustBought(itemId);
      haptic("success");
      setTimeout(() => setJustBought(null), 2000);
      await load();
    } finally {
      setPurchasing(null);
    }
  }

  async function gift(itemId: string, itemName: string) {
    const toEmail = prompt(`Gift “${itemName}” to which member?\n(They pay nothing — you pay the price + a 5% gift tax)`);
    if (!toEmail) return;
    setBusyGift(itemId);
    setError(null);
    try {
      const r = await fetch(`/api/marketplace/${itemId}/gift`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ toEmail: toEmail.trim() }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Gifting failed"); return; }
      alert(`Gifted! Tax paid: ${d.tax} coins.`);
      await load();
    } finally {
      setBusyGift(null);
    }
  }

  async function sellBack(item: any) {
    const refund = Math.floor(item.costCoins * 0.5);
    if (!confirm(`Sell “${item.name}” back for ${refund.toLocaleString()} coins (50% refund)?`)) return;
    setSelling(item.id);
    setError(null);
    try {
      const r = await fetch(`/api/marketplace/inventory/${inventoryMap[item.id]}/sell`, {
        method: "POST", headers: authHeaders(),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Sell-back failed"); return; }
      alert(`Sold! +${d.refund.toLocaleString()} coins`);
      await load();
    } finally {
      setSelling(null);
    }
  }

  async function buyBundle(bundle: any) {
    if (!confirm(`Buy “${bundle.name}” (${bundle.items.length} items) for ${bundle.price.toLocaleString()} coins?`)) return;
    setBuyingBundle(bundle.id);
    setError(null);
    try {
      const r = await fetch(`/api/marketplace/bundles/${bundle.id}/purchase`, {
        method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: "{}",
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Bundle purchase failed"); return; }
      alert(`Unpacked ${d.items} items!`);
      await load();
    } finally {
      setBuyingBundle(null);
    }
  }

  const filtered = filter === "all" ? items : items.filter(i => i.type === filter);
  const owned = items.filter(i => i.owned).length;

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--brand-600)] border-t-transparent" />
    </div>
  );

  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--rgba-124-58-237-0_3)] bg-[var(--rgba-124-58-237-0_1)] px-4 py-1.5 mb-3">
                <ShoppingBag size={14} className="text-[var(--brand-400)]" />
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-400)]">Focus Marketplace</span>
              </div>
              <h1 className="text-3xl font-bold text-[var(--palette-white)]">Marketplace</h1>
              <p className="text-[var(--muted-fg)] text-sm mt-1">Everything earned through effort. No pay-to-win.</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="rounded-xl border border-[var(--rgba-245-158-11-0_25)] bg-[var(--rgba-245-158-11-0_08)] px-4 py-2.5 flex items-center gap-2">
                <span className="text-lg">🪙</span>
                <div>
                  <div className="text-lg font-bold text-[var(--color-warning)]">{wallet?.coins?.toLocaleString() ?? 0}</div>
                  <div className="text-[10px] text-[var(--palette-92400e)] uppercase tracking-wider">Focus Coins</div>
                </div>
              </div>
              <div className="rounded-xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_02)] px-4 py-2.5 flex items-center gap-2">
                <Package size={14} className="text-[var(--muted-fg)]" />
                <div>
                  <div className="text-lg font-bold text-[var(--palette-white)]">{owned}</div>
                  <div className="text-[10px] text-[var(--foreground-subtle)] uppercase tracking-wider">Owned</div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-4 rounded-xl border border-[var(--rgba-239-68-68-0_3)] bg-[var(--rgba-239-68-68-0_08)] p-3 text-sm text-[var(--palette-fca5a5)]">
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {TYPE_FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                filter === f.id
                  ? "bg-[var(--rgba-124-58-237-0_2)] border border-[var(--rgba-124-58-237-0_4)] text-[var(--brand-400)]"
                  : "border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_02)] text-[var(--muted-fg)] hover:text-[var(--foreground-muted)]"
              }`}>
              <span>{f.icon}</span> {f.label}
            </button>
          ))}
        </div>

        {/* Bundles */}
        {bundles.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--brand-400)]">
              <Package size={14} /> Bundles — save with a multi-item pack
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {bundles.map((b) => (
                <div key={b.id} className="rounded-2xl border border-[var(--rgba-124-58-237-0_25)] bg-[var(--rgba-124-58-237-0_06)] p-4 flex flex-col gap-2">
                  <div className="text-2xl">{b.items.map((i: any) => i.emoji).join("")}</div>
                  <div className="text-sm font-semibold text-[var(--palette-white)]">{b.name}</div>
                  <div className="text-[10px] text-[var(--muted-fg)] leading-relaxed">{b.description}</div>
                  <div className="text-[10px] text-[var(--foreground-subtle)]">
                    {b.items.length} items · worth {b.fullPrice.toLocaleString()} <span className="line-through opacity-60">{b.fullPrice.toLocaleString()}</span>
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-1">
                    <div className="text-sm font-bold text-[var(--color-warning)]">🪙 {b.price.toLocaleString()} <span className="ml-1 rounded-full bg-[var(--rgba-34-211-135-0_15)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--palette-22d387)]">-{b.discountPct}%</span></div>
                    {b.owned ? (
                      <span className="text-[10px] font-semibold text-[var(--palette-22d387)]">Owned</span>
                    ) : (
                      <button
                        onClick={() => buyBundle(b)}
                        disabled={buyingBundle === b.id || (wallet?.coins ?? 0) < b.price}
                        className="rounded-lg bg-[var(--rgba-124-58-237-0_2)] px-2.5 py-1 text-[11px] font-semibold text-[var(--brand-400)] border border-[var(--rgba-124-58-237-0_3)] transition hover:bg-[var(--rgba-124-58-237-0_35)] disabled:opacity-40">
                        {buyingBundle === b.id ? "..." : "Buy"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Items grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((item, i) => {
            const rarity = RARITY_STYLES[item.rarity ?? "common"] ?? RARITY_STYLES.common!;
            const canAfford = (wallet?.coins ?? 0) >= item.costCoins;
            return (
              <motion.div key={item.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="rounded-2xl border p-4 flex flex-col gap-3 relative transition-all duration-[var(--duration-fast)] hover:-translate-y-0.5"
                style={{ background: rarity.bg, borderColor: rarity.border, boxShadow: rarity.glow }}>
                {/* Rarity badge */}
                <div className="flex items-center justify-between">
                  <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                    style={{ color: rarity.color, background: `color-mix(in srgb, ${rarity.bg} 50%, transparent)`, border: `1px solid ${rarity.border}` }}>
                    {rarity.label}
                  </span>
                  {item.owned ? <CheckCircle size={14} className="text-[var(--palette-22d387)]" /> : item.locked ? (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase text-[var(--palette-amber-400)]"><Crown size={12} /> Premium</span>
                  ) : null}
                </div>

                <div className="text-4xl text-center">{item.emoji}</div>
                <div>
                  <div className="text-sm font-semibold text-[var(--palette-white)] leading-tight">{item.name}</div>
                  <div className="text-[10px] text-[var(--muted-fg)] mt-0.5 leading-relaxed">{item.description}</div>
                </div>

                <div className="mt-auto flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-sm font-bold text-[var(--color-warning)]">
                      🪙 {item.costCoins.toLocaleString()}
                    </div>
                    {item.owned ? (
                      <span className="text-[10px] font-semibold text-[var(--palette-22d387)]">Owned</span>
                    ) : (
                    <button
                      onClick={() => purchase(item.id)}
                      disabled={purchasing === item.id || !canAfford || item.locked}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                        item.locked || !canAfford
                          ? "bg-[var(--rgba-255-255-255-0_04)] text-[var(--foreground-subtle)] cursor-not-allowed"
                          : justBought === item.id
                          ? "bg-[var(--rgba-34-211-135-0_2)] text-[var(--palette-22d387)]"
                          : "bg-[var(--rgba-124-58-237-0_2)] text-[var(--brand-400)] hover:bg-[var(--rgba-124-58-237-0_35)] border border-[var(--rgba-124-58-237-0_3)]"
                      }`}>
                      {item.locked ? <span className="inline-flex items-center gap-1"><Lock size={10} /> Premium</span> : purchasing === item.id ? "..." : justBought === item.id ? "Bought!" : !canAfford ? "Need coins" : "Buy"}
                    </button>
                  )}
                  {!item.owned && !item.locked && (
                    <button
                      onClick={() => gift(item.id, item.name)}
                      disabled={busyGift === item.id}
                      className="w-full rounded-lg border border-[var(--rgba-255-255-255-0_08)] px-2 py-1 text-[10px] font-medium text-[var(--foreground-subtle)] transition hover:text-[var(--foreground)] disabled:opacity-50">
                      {busyGift === item.id ? "Gifting…" : "🎁 Gift to a friend (+5% tax)"}
                    </button>
                  )}
                  {item.owned && (
                    <button
                      onClick={() => sellBack(item)}
                      disabled={selling === item.id}
                      className="w-full rounded-lg border border-[var(--rgba-34-211-135-0_25)] px-2 py-1 text-[10px] font-medium text-[var(--palette-22d387)] transition hover:bg-[var(--rgba-34-211-135-0_08)] disabled:opacity-50">
                      {selling === item.id ? "…" : `Sell back · +${Math.floor(item.costCoins * 0.5).toLocaleString()} coins`}
                    </button>
                  )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-[var(--foreground-subtle)]">
            <ShoppingBag size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No items in this category yet.</p>
          </div>
        )}

        {/* How to earn */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          className="mt-8 rounded-xl border border-[var(--rgba-124-58-237-0_15)] bg-[var(--rgba-124-58-237-0_05)] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={14} className="text-[var(--brand-400)]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-400)]">How to earn Focus Coins</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] text-[var(--muted-fg)]">
            <div>🎯 Complete focus sessions</div>
            <div>🔥 Maintain daily streaks</div>
            <div>🏆 Unlock achievements</div>
            <div>📋 Complete missions</div>
          </div>
        </motion.div>
      </div>
    </PageTransition>
  );
}
