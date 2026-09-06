import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { getToken } from "@/lib/auth";
import { Heart, PawPrint, CheckCircle, Crown, Search, Sparkles, Trophy, X } from "lucide-react";
import { ErrorState } from "@/components/ErrorState";
import { is3DCapable } from "@/lib/webglCapability";

// Lazy so three.js stays out of this page's static chunk graph.
const Pet3D = lazy(() => import("@/components/Pet3D").then(m => ({ default: m.Pet3D })));
import { usePremium } from "@/hooks/usePremium";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";


const CATEGORY_META: Record<string, { label: string; emoji: string; color: string }> = {
  starter: { label: "Starter", emoji: "🌱", color: "var(--palette-10b981)" },
  free: { label: "Free", emoji: "🐾", color: "var(--palette-06b6d4)" },
  achievement: { label: "Achievement", emoji: "🏆", color: "var(--brand-gold)" },
  premium: { label: "Premium", emoji: "👑", color: "var(--palette-amber-400)" },
  seasonal: { label: "Seasonal", emoji: "🍂", color: "var(--palette-f97316)" },
  event: { label: "Event", emoji: "🎉", color: "var(--palette-ec4899)" },
  legendary: { label: "Legendary", emoji: "🌟", color: "var(--brand-500)" },
  exclusive: { label: "Exclusive", emoji: "💎", color: "var(--palette-violet-400)" },
  admin_drop: { label: "Admin", emoji: "🛡️", color: "var(--palette-red-400)" },
};

const RARITY_COLOR: Record<string, string> = {
  common: "var(--foreground-subtle)",
  rare: "var(--palette-06b6d4)",
  epic: "var(--brand-500)",
  legendary: "var(--palette-amber-400)",
  exclusive: "var(--palette-ec4899)",
};

const LEVEL_UNLOCKS: Record<number, string[]> = {
  1: ["Pet unlocked"],
  3: ["Custom nickname", "10 Focus Tokens"],
  5: ["Hat accessory slot"],
  8: ["Glasses accessory slot", "50 Focus Tokens"],
  10: ["Evolution stage 2", "100 Focus Tokens", "New animation"],
  15: ["Evolution stage 3", "Aura slot", "150 Focus Tokens"],
  20: ["Legendary evolution", "500 Focus Tokens", "Exclusive badge", "Premium emote"],
};

function authHeaders() {
  const t = getToken();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (t) h["Authorization"] = `Bearer ${t}`;
  return h;
}

export default function PetsPage() {
  const { isPremium } = usePremium();
  const [catalog, setCatalog] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [activePet, setActivePet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedDetail, setSelectedDetail] = useState<any>(null);
  const [showQuality, setShowQuality] = useState<"low" | "med" | "high" | "auto">("auto");
  const [view3d, setView3d] = useState(() => is3DCapable());
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"collection" | "inventory" | "progression">("collection");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [catRes, invRes] = await Promise.all([
        fetch("/api/pets/catalog", { headers: authHeaders() }),
        fetch("/api/pets/inventory", { headers: authHeaders() }),
      ]);
      if (!catRes.ok) throw new Error("catalog");
      const catData = await catRes.json();
      setCatalog(catData.pets ?? []);
      if (invRes.ok) {
        const invData = await invRes.json();
        const inv = invData.inventory ?? [];
        setInventory(inv);
        const active = inv.find((i: any) => i.inventory?.isActive || i.isActive);
        setActivePet(active ?? inv[0] ?? null);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);

  const filteredCatalog = useMemo(() => {
    let list = catalog;
    if (filter !== "all") list = list.filter(p => p.category === filter || p.rarity === filter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.slug.includes(q));
    }
    return list;
  }, [catalog, filter, search]);

  const ownedSlugs = useMemo(() => new Set(inventory.map((i: any) => i.catalog?.slug ?? i.slug)), [inventory]);

  async function unlockPet(slug: string) {
    setSaving(slug);
    try {
      const res = await fetch(`/api/pets/catalog/${slug}/unlock`, { method: "POST", headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) {
        setToast(data.error || "Failed to unlock");
        setTimeout(() => setToast(null), 3000);
        return;
      }
      setToast(`Unlocked ${data.catalog?.name ?? slug}!`);
      setTimeout(() => setToast(null), 3000);
      await load();
    } finally {
      setSaving(null);
    }
  }

  async function activatePet(invId: string) {
    setSaving(invId);
    try {
      const res = await fetch(`/api/pets/inventory/${invId}/activate`, { method: "POST", headers: authHeaders() });
      if (!res.ok) throw new Error("activate failed");
      setToast("Active pet updated");
      setTimeout(() => setToast(null), 2500);
      await load();
    } catch {
      setToast("Failed to activate");
      setTimeout(() => setToast(null), 2500);
    } finally {
      setSaving(null);
    }
  }

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--brand-600)] border-t-transparent" />
    </div>
  );
  if (loadError) return <ErrorState title="Pet companion unavailable" onRetry={() => void load()} />;

  return (
    <PageTransition>
      <PageSEO {...PAGE_SEO.pets} />
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--rgba-124-58-237-0_3)] bg-[var(--rgba-124-58-237-0_1)] px-4 py-1.5">
              <Heart size={14} className="text-[var(--brand-400)]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-400)]">Pet Companions</span>
            </div>
            <h1 className="mt-3 text-3xl font-bold">Your Focus Companions</h1>
            <p className="mt-1 text-sm text-[var(--foreground-muted)]">Collect, bond level 1-20, unlock animations and rewards. Premium unlocks exclusive pets.</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={showQuality} onChange={(e) => setShowQuality(e.target.value as any)} className="rounded-xl border border-[var(--forge-border)] bg-[var(--surface-1)] px-3 py-2 text-xs">
              <option value="auto">Auto quality</option>
              <option value="low">Low (mobile)</option>
              <option value="med">Medium</option>
              <option value="high">High</option>
            </select>
            {is3DCapable() && (
              <div className="flex gap-1 rounded-xl bg-[var(--surface-1)] p-1">
                <button onClick={() => setView3d(true)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${view3d ? "bg-[var(--brand-600)] text-white" : "text-[var(--foreground-subtle)]"}`}>3D</button>
                <button onClick={() => setView3d(false)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${!view3d ? "bg-[var(--brand-600)] text-white" : "text-[var(--foreground-subtle)]"}`}>2D</button>
              </div>
            )}
          </div>
        </div>

        {/* Active pet showcase */}
        {activePet && (
          <div className="mb-6 rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="text-center">
                {view3d ? (
                  <div className="mx-auto h-64 max-w-sm">
                    <Suspense fallback={<div className="text-8xl">{activePet.catalog?.thumbnailUrl ? "🐾" : "🦉"}</div>}>
                      <Pet3D petType={activePet.catalog?.slug ?? activePet.petType ?? "owl"} mood="happy" evolutionStage={Math.min(3, Math.floor(((activePet.inventory?.level ?? 1) - 1) / 5))} accessories={[]} onCrash={() => setView3d(false)} />
                    </Suspense>
                  </div>
                ) : (
                  <div className="text-8xl">{activePet.catalog?.thumbnailUrl ? "🐾" : "🦉"}</div>
                )}
                <h2 className="mt-3 text-xl font-bold">{activePet.inventory?.nickname ?? activePet.catalog?.name ?? activePet.petName ?? "Companion"}</h2>
                <p className="text-xs text-[var(--foreground-subtle)]">{activePet.catalog?.description ?? ""}</p>
                <div className="mt-3 flex justify-center gap-2">
                  <span className="rounded-full border border-[var(--brand-400)]/30 bg-[var(--brand-soft)] px-3 py-1 text-xs font-bold text-[var(--brand-400)]">Lvl {activePet.inventory?.level ?? activePet.petLevel ?? 1}/20</span>
                  <span className="rounded-full bg-[var(--surface-1)] px-3 py-1 text-xs" style={{ color: RARITY_COLOR[activePet.catalog?.rarity ?? "common"] }}>{activePet.catalog?.rarity ?? "common"}</span>
                </div>
                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-1)]">
                  <div className="h-full bg-[var(--brand-600)]" style={{ width: `${Math.min(100, ((activePet.inventory?.bondXp ?? 0) / ((activePet.inventory?.level ?? 1) * 100)) * 100)}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-[var(--foreground-subtle)]">{activePet.inventory?.bondXp ?? 0} / {(activePet.inventory?.level ?? 1) * 100} XP to next level</p>
              </div>
              <div>
                <h3 className="text-sm font-bold">Progression unlocks</h3>
                <div className="mt-3 space-y-2">
                  {Array.from({ length: 20 }, (_, i) => i + 1).map(lvl => {
                    const current = activePet.inventory?.level ?? 1;
                    const isUnlocked = lvl <= current;
                    const isNext = lvl === current + 1;
                    const unlocks = LEVEL_UNLOCKS[lvl];
                    if (!unlocks) return null;
                    return (
                      <div key={lvl} className={`flex gap-2 rounded-xl border p-2.5 ${isUnlocked ? "border-[var(--brand-400)]/20 bg-[var(--brand-soft)]" : isNext ? "border-[var(--palette-amber-500)]/20 bg-[var(--palette-amber-950)]/10" : "border-[var(--forge-border)] opacity-60"}`}>
                        <div className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold ${isUnlocked ? "bg-[var(--brand-600)] text-white" : "bg-[var(--surface-1)] text-[var(--foreground-subtle)]"}`}>{lvl}</div>
                        <div className="flex-1">
                          <p className="text-xs font-semibold">Level {lvl}</p>
                          <p className="text-[11px] text-[var(--foreground-subtle)]">{unlocks.join(" • ")}</p>
                        </div>
                        {isUnlocked && <CheckCircle size={14} className="text-[var(--brand-400)]" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-4 flex gap-1 rounded-xl bg-[var(--surface-1)] p-1">
          {[
            { id: "collection", label: "Collection", icon: "🗂️" },
            { id: "inventory", label: `My Pets (${inventory.length})`, icon: "🐾" },
            { id: "progression", label: "Progression", icon: "📈" },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`flex-1 rounded-lg py-2 text-xs font-bold ${activeTab === t.id ? "bg-[var(--brand-600)] text-white" : "text-[var(--foreground-subtle)]"}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {activeTab === "collection" && (
          <>
            {/* Filters + search */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--foreground-subtle)]" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search pets..." className="rounded-xl border border-[var(--forge-border)] bg-[var(--surface-1)] py-2 pl-8 pr-3 text-xs outline-none focus:border-[var(--brand-400)]/40" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {["all", "starter", "free", "premium", "seasonal", "event", "legendary", "exclusive"].map(cat => (
                  <button key={cat} onClick={() => setFilter(cat)} className={`rounded-full px-3 py-1.5 text-[11px] font-semibold capitalize ${filter === cat ? "bg-[var(--brand-600)] text-white" : "bg-[var(--surface-1)] text-[var(--foreground-subtle)]"}`}>
                    {cat === "all" ? "All" : `${CATEGORY_META[cat]?.emoji ?? ""} ${CATEGORY_META[cat]?.label ?? cat}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {filteredCatalog.map((pet) => {
                const owned = ownedSlugs.has(pet.slug);
                const lockedPremium = pet.isPremium && !isPremium;
                return (
                  <motion.div key={pet.id} layout className={`group relative rounded-2xl border p-4 transition-all ${owned ? "border-[var(--brand-400)]/30 bg-[var(--brand-soft)]" : "border-[var(--forge-border)] bg-[var(--card)] hover:border-[var(--brand-400)]/20"}`}>
                    {pet.isPremium && <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-[var(--palette-amber-500)]/15 px-2 py-0.5 text-[11px] font-bold text-[var(--palette-amber-400)]"><Crown size={8}/> Premium</span>}
                    {owned && <span className="absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-[var(--brand-600)] text-white"><CheckCircle size={12}/></span>}
                    <div className="text-center">
                      <div className="text-4xl">{pet.thumbnailUrl ? "🐾" : CATEGORY_META[pet.category]?.emoji ?? "🐾"}</div>
                      <h3 className="mt-2 text-sm font-bold">{pet.name}</h3>
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-[var(--foreground-subtle)]">{pet.description}</p>
                      <div className="mt-2 flex justify-center gap-1">
                        <span className="rounded-full bg-[var(--surface-1)] px-2 py-0.5 text-[11px] font-bold" style={{ color: RARITY_COLOR[pet.rarity] }}>{pet.rarity}</span>
                        <span className="rounded-full bg-[var(--surface-1)] px-2 py-0.5 text-[11px]">{pet.category}</span>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-1.5">
                      <button onClick={() => setSelectedDetail(pet)} className="flex-1 rounded-xl border border-[var(--forge-border)] py-1.5 text-[11px] font-semibold">Details</button>
                      {!owned ? (
                        <button disabled={!!saving} onClick={() => unlockPet(pet.slug)} className={`flex-1 rounded-xl py-1.5 text-[11px] font-bold ${lockedPremium ? "bg-[var(--palette-amber-500)]/15 text-[var(--palette-amber-400)]" : "bg-[var(--brand-600)] text-white"}`}>
                          {saving === pet.slug ? "..." : pet.tokenCost > 0 ? `🪙 ${pet.tokenCost}` : lockedPremium ? "Premium" : "Unlock"}
                        </button>
                      ) : (
                        <span className="flex-1 rounded-xl bg-[var(--surface-1)] py-1.5 text-center text-[11px] font-bold text-[var(--brand-400)]">Owned</span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}

        {activeTab === "inventory" && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {inventory.map((entry: any) => {
              const inv = entry.inventory ?? entry;
              const cat = entry.catalog ?? catalog.find(c => c.id === inv.petId);
              return (
                <div key={inv.id} className={`rounded-2xl border p-4 ${inv.isActive ? "border-[var(--brand-400)] bg-[var(--brand-soft)]" : "border-[var(--forge-border)] bg-[var(--card)]"}`}>
                  <div className="text-center">
                    <div className="text-4xl">{cat?.slug ? CATEGORY_META[cat.category]?.emoji ?? "🐾" : "🐾"}</div>
                    <h3 className="mt-2 text-sm font-bold">{inv.nickname ?? cat?.name ?? "Pet"}</h3>
                    <p className="text-xs text-[var(--foreground-subtle)]">Lvl {inv.level}/20 • {inv.bondXp} XP</p>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--surface-1)]"><div className="h-full rounded-full bg-[var(--brand-600)]" style={{ width: `${(inv.bondXp / (inv.level * 100)) * 100}%` }} /></div>
                  </div>
                  <button disabled={!!saving} onClick={() => activatePet(inv.id)} className={`mt-3 w-full rounded-xl py-2 text-xs font-bold ${inv.isActive ? "bg-[var(--surface-1)] text-[var(--brand-400)]" : "bg-[var(--brand-600)] text-white"}`}>
                    {inv.isActive ? "Active" : saving === inv.id ? "..." : "Set Active"}
                  </button>
                </div>
              );
            })}
            {inventory.length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-[var(--forge-border)] p-12 text-center">
                <PawPrint size={32} className="mx-auto mb-2 text-[var(--foreground-subtle)]" />
                <p className="text-sm text-[var(--foreground-muted)]">No pets yet — unlock from collection</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "progression" && (
          <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-5">
            <h3 className="text-sm font-bold">Bond Level 1-20 Progression</h3>
            <p className="mt-1 text-xs text-[var(--foreground-muted)]">Each level needs level*100 XP. Earn XP from focus sessions. Unlocks at milestones.</p>
            <div className="mt-4 grid gap-2">
              {Array.from({ length: 20 }, (_, i) => i + 1).map(lvl => (
                <div key={lvl} className="flex items-center gap-3 rounded-xl border border-[var(--forge-border)] bg-[var(--surface-1)] p-3">
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-[var(--brand-600)] text-xs font-bold text-white">{lvl}</div>
                  <div className="flex-1">
                    <p className="text-xs font-bold">Level {lvl} — {lvl * 100} XP needed</p>
                    <p className="text-[11px] text-[var(--foreground-subtle)]">{LEVEL_UNLOCKS[lvl]?.join(" • ") ?? "—"}</p>
                  </div>
                  <Trophy size={14} className={LEVEL_UNLOCKS[lvl] ? "text-[var(--palette-amber-400)]" : "text-[var(--foreground-subtle)]"} />
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-xl border border-[var(--palette-amber-500)]/20 bg-[var(--palette-amber-950)]/10 p-4">
              <p className="flex items-center gap-1 text-xs font-bold"><Sparkles size={12} className="text-[var(--palette-amber-400)]" /> 3D Pets</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[11px] text-[var(--foreground-muted)]">
                <li>GLB/GLTF models with compressed textures, lazy loaded</li>
                <li>Quality Low/Med/High/Auto — auto reduces on mobile</li>
                <li>Fallback to 2D emoji if WebGL unavailable or crash</li>
                <li>Mixer for animations (idle, celebration, sleep, focus), dispose geometries on unmount</li>
                <li>Mobile low-poly variant used when quality=low</li>
              </ul>
            </div>
          </div>
        )}

        {/* Detail modal */}
        <AnimatePresence>
          {selectedDetail && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[var(--z-modal)] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setSelectedDetail(null)}>
              <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-md rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-5" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-4xl">{CATEGORY_META[selectedDetail.category]?.emoji ?? "🐾"}</div>
                    <div>
                      <h3 className="text-lg font-bold">{selectedDetail.name}</h3>
                      <p className="text-xs text-[var(--foreground-subtle)]">{selectedDetail.category} • {selectedDetail.rarity}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedDetail(null)} className="grid h-8 w-8 place-items-center rounded-full bg-[var(--surface-1)]"><X size={14}/></button>
                </div>
                <p className="mt-4 text-sm text-[var(--foreground-muted)]">{selectedDetail.description}</p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-[var(--surface-1)] p-3"><p className="text-[11px] text-[var(--foreground-subtle)]">Rarity</p><p className="font-bold" style={{ color: RARITY_COLOR[selectedDetail.rarity] }}>{selectedDetail.rarity}</p></div>
                  <div className="rounded-xl bg-[var(--surface-1)] p-3"><p className="text-[11px] text-[var(--foreground-subtle)]">Max Level</p><p className="font-bold">{selectedDetail.maxLevel ?? 20}</p></div>
                  <div className="rounded-xl bg-[var(--surface-1)] p-3"><p className="text-[11px] text-[var(--foreground-subtle)]">Cost</p><p className="font-bold">{selectedDetail.tokenCost ? `🪙 ${selectedDetail.tokenCost}` : "Free"}</p></div>
                  <div className="rounded-xl bg-[var(--surface-1)] p-3"><p className="text-[11px] text-[var(--foreground-subtle)]">Source</p><p className="font-bold">{selectedDetail.unlockSource}</p></div>
                </div>
                {selectedDetail.modelUrl && <p className="mt-3 text-[11px] text-[var(--foreground-subtle)]">3D Model: {selectedDetail.modelUrl} — GLB compressed, lazy, mixer, fallback</p>}
                <div className="mt-5 flex gap-2">
                  <button onClick={() => setSelectedDetail(null)} className="flex-1 rounded-xl border border-[var(--forge-border)] py-2.5 text-xs font-bold">Close</button>
                  {!ownedSlugs.has(selectedDetail.slug) && (
                    <button onClick={() => { setSelectedDetail(null); void unlockPet(selectedDetail.slug); }} className="flex-1 rounded-xl bg-[var(--brand-600)] py-2.5 text-xs font-bold text-white">Unlock</button>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed bottom-6 left-1/2 z-[var(--z-modal)] -translate-x-1/2 rounded-full bg-[var(--foreground)] px-5 py-2.5 text-xs font-bold text-[var(--background)] shadow-xl">
            {toast}
          </motion.div>
        )}
      </div>
    </PageTransition>
  );
}
