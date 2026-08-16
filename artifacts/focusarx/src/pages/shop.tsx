import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getToken } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { ShoppingBag, Zap, Palette, Star, Crown, LucideIcon } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { ShopItem } from "@/types/gamification";

async function apiFetch(path: string, opts?: RequestInit) {
  const token = getToken();
  const res = await fetch(path, { ...opts, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts?.headers ?? {}) } });
  if (!res.ok) { const t = await res.text(); throw new Error(t); }
  return res.json();
}

const CATEGORY_META: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  boost:    { label: "Boosts",    icon: Zap,         color: "text-amber-400" },
  theme:    { label: "Themes",    icon: Palette,     color: "text-blue-400" },
  title:    { label: "Titles",    icon: Crown,       color: "text-violet-400" },
  cosmetic: { label: "Cosmetics", icon: Star,        color: "text-emerald-400" },
};

interface PurchaseResponse {
  xpGained: number;
  coinsRemaining: number;
}

export default function ShopPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const { data, isLoading } = useQuery<{ items: ShopItem[], coins: number }>({
    queryKey: ["shop-items"],
    queryFn: () => apiFetch("/api/shop/items"),
    staleTime: 300_000,
  });

  const purchase = useMutation<PurchaseResponse, Error, string>({
    mutationFn: (itemId: string) => apiFetch(`/api/shop/purchase/${itemId}`, { method: "POST" }),
    onSuccess: (res) => {
      const msg = res.xpGained > 0
        ? `Purchased! +${res.xpGained.toLocaleString()} XP. ${res.coinsRemaining.toLocaleString()} coins left.`
        : `Purchased! ${res.coinsRemaining.toLocaleString()} coins remaining.`;
      toast(msg, "success");
      qc.invalidateQueries({ queryKey: ["shop-items"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e) => toast(e.message, "error"),
  });

  const items = data?.items ?? [];
  const coins = data?.coins ?? 0;
  const categories = ["all", ...Object.keys(CATEGORY_META)];
  const filtered = activeCategory === "all" ? items : items.filter((i) => i.category === activeCategory);

  return (
    <div className="min-h-screen forge-bg-glow text-[#E2E8F0] px-4 sm:px-6 py-8 max-w-3xl mx-auto">
      <PageHeader
        icon={<ShoppingBag size={18} className="text-amber-400" />}
        badgeColor="#F59E0B"
        title="Coin Shop"
        subtitle="Spend your hard-earned coins on boosts and cosmetics"
        actions={
          <div className="flex items-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2">
            <span className="text-base">🪙</span>
            <span className="text-sm font-bold text-amber-400">{coins.toLocaleString()}</span>
          </div>
        }
      />

      {/* Category filter */}
      <div className="flex gap-1.5 mb-5 flex-wrap">
        {categories.map(cat => {
          const meta = CATEGORY_META[cat];
          const IconComp = meta?.icon;
          return (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all border ${activeCategory === cat ? "bg-[#7C3AED] text-white border-[#7C3AED]" : "border-[rgba(255,255,255,0.06)] text-[#4B5563] hover:text-[#E2E8F0] hover:border-[#7C3AED]/40"}`}>
              {IconComp && <IconComp size={12} className={meta.color} />}
              {cat === "all" ? "All Items" : meta?.label ?? cat}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-[rgba(255,255,255,0.025)]" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((item) => {
            const meta = CATEGORY_META[item.category];
            const canAfford = coins >= item.price;
            return (
              <div key={item.id} className={`rounded-2xl border p-4 transition-all ${canAfford ? "border-[rgba(255,255,255,0.06)] hover:border-[#7C3AED]/40" : "border-[rgba(255,255,255,0.06)]/50 opacity-60"} bg-[rgba(255,255,255,0.025)]`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{item.icon}</span>
                    <div>
                      <p className="text-sm font-bold text-[#E2E8F0]">{item.name}</p>
                      <span className={`text-[10px] font-semibold uppercase tracking-wider ${meta?.color ?? "text-[#4B5563]"}`}>{item.category}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-base">🪙</span>
                    <span className={`text-sm font-bold ${canAfford ? "text-amber-400" : "text-[#4B5563]"}`}>{item.price.toLocaleString()}</span>
                  </div>
                </div>
                <p className="text-xs text-[#4B5563] mb-3 leading-relaxed">{item.description}</p>
                <button
                  onClick={() => purchase.mutate(item.id)}
                  disabled={!canAfford || purchase.isPending}
                  className={`w-full rounded-xl py-2 text-xs font-semibold transition-all ${canAfford ? "bg-[#7C3AED] text-white hover:bg-[#6d31d4]" : "bg-[rgba(255,255,255,0.06)] text-[#374151] cursor-not-allowed"}`}>
                  {purchase.isPending ? "Purchasing…" : canAfford ? "Purchase" : "Not enough coins"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-16">
          <ShoppingBag size={40} className="mx-auto mb-4 text-[#7C3AED] opacity-30" />
          <p className="text-[#4B5563]">No items in this category yet.</p>
        </div>
      )}
    </div>
  );
}
