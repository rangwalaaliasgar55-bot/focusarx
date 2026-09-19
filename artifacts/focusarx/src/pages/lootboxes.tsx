import { useState, useEffect, useMemo } from "react";
import { Coins, Gift, Lock, Package, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { getToken } from "@/lib/auth";

import { PAGE, CARD, STAGGER, POP } from "@/lib/animations";
import { ErrorState } from "@/components/ErrorState";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { useFeatureFlags, FEATURE_FLAG_KEYS } from "@/hooks/useFeatureFlags";

function authHeaders() {
  const t = getToken();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (t) h["Authorization"] = `Bearer ${t}`;
  return h;
}

const RARITY_STYLES: Record<string, { border: string; bg: string; glow: string; label: string; color: string }> = {
  common:    { border: "var(--rgba-148-163-184-0_2)", bg: "var(--rgba-148-163-184-0_05)", glow: "0 0 0 transparent",              label: "Common",    color: "var(--foreground-muted)" },
  uncommon:  { border: "var(--rgba-16-185-129-0_25)",  bg: "var(--rgba-16-185-129-0_06)",  glow: "0 0 12px var(--rgba-16-185-129-0_12)",  label: "Uncommon",  color: "var(--palette-10b981)" },
  rare:      { border: "var(--rgba-59-130-246-0_3)",   bg: "var(--rgba-59-130-246-0_06)",  glow: "0 0 16px var(--rgba-59-130-246-0_15)",  label: "Rare",      color: "var(--color-info)" },
  epic:      { border: "var(--rgba-139-92-246-0_35)",  bg: "var(--rgba-139-92-246-0_08)",  glow: "0 0 20px var(--rgba-139-92-246-0_2)",   label: "Epic",      color: "var(--brand-500)" },
  legendary: { border: "var(--rgba-245-158-11-0_4)",   bg: "var(--rgba-245-158-11-0_08)",  glow: "0 0 28px var(--rgba-245-158-11-0_25)",  label: "Legendary", color: "var(--color-warning)" },
};

function BoxTypeCard({ boxType, myBoxes, wallet, onBuy, onOpen }: {
  boxType: any; myBoxes: any[]; wallet: any; onBuy: (id: string) => void; onOpen: (id: string) => void;
}) {
  const style = RARITY_STYLES[boxType.rarity] ?? RARITY_STYLES.common;
  const owned = myBoxes.filter((b: any) => b.boxTypeId === boxType.id && b.status === "unopened");
  const canAfford = wallet && wallet.coins >= boxType.coinCost;

  return (
    <motion.div variants={CARD}
      className="rounded-2xl border p-5 transition-all"
      style={{ border: `1px solid ${style.border}`, background: style.bg, boxShadow: style.glow }}>
      <div className="text-center mb-4">
        <motion.div
          animate={{ rotateY: [0, 5, -5, 0] }}
          transition={{ duration: 4, repeat: Infinity }}
          className="text-5xl mb-3 cursor-pointer"
          onClick={() => owned.length > 0 && onOpen(owned[0].id)}
        >
          {boxType.icon}
        </motion.div>
        <h3 className="text-sm font-bold text-[var(--foreground)]">{boxType.name}</h3>
        <span className="inline-block mt-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase" style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}>
          {style.label}
        </span>
        {boxType.premiumOnly && (
          <span className="inline-block mt-1 ml-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase bg-[var(--brand-gold)]/10 text-[var(--brand-gold)] border border-[var(--brand-gold)]/30">
            <Lock size={8} className="inline -mt-px" /> Premium
          </span>
        )}
      </div>

      <p className="text-[11px] text-[var(--foreground-subtle)] text-center mb-4 leading-relaxed">{boxType.description}</p>

      {owned.length > 0 && (
        <div className="mb-3 flex items-center justify-center gap-2 rounded-xl bg-[var(--rgba-6-214-160-0_08)] border border-[var(--rgba-6-214-160-0_2)] py-2">
          <Package size={12} className="text-[var(--brand-teal)]" />
          <span className="text-xs font-semibold text-[var(--brand-teal)]">You own {owned.length}</span>
        </div>
      )}

      <div className="space-y-2">
        {owned.length > 0 && (
          <button onClick={() => onOpen(owned[0].id)}
            className="w-full rounded-xl py-2 text-xs font-bold text-[var(--palette-white)] transition-all"
            style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${style.color} 67%, transparent), color-mix(in srgb, ${style.color} 40%, transparent))` }}>
            ✨ Open Now!
          </button>
        )}
        {boxType.coinCost > 0 && (
          <button onClick={() => onBuy(boxType.id)}
            disabled={!canAfford}
            className="w-full rounded-xl border py-2 text-xs font-semibold transition-all disabled:opacity-40"
            style={{ borderColor: style.border, color: style.color }}>
            🪙 {boxType.coinCost.toLocaleString()} coins
          </button>
        )}
        {boxType.sessionsRequired > 0 && boxType.coinCost === 0 && (
          <div className="flex items-center justify-center gap-1 text-[11px] text-[var(--foreground-subtle)]">
            <Star size={10} /> Earn by completing {boxType.sessionsRequired} sessions
          </div>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Rarity palette for the reveal. The animation is the reward's only chance to
 * feel like one, so the tier is legible from across the room: colour, glow,
 * label, and how hard the box shakes before it opens.
 */
const REVEAL_RARITY: Record<string, { label: string; color: string; glow: string; burst: number; shake: number }> = {
  common:    { label: "Common",    color: "var(--foreground-muted)", glow: "var(--rgba-148-163-184-0_35)", burst: 10, shake: 0.18 },
  uncommon:  { label: "Uncommon",  color: "var(--palette-10b981)",   glow: "var(--rgba-16-185-129-0_45)",  burst: 16, shake: 0.26 },
  rare:      { label: "Rare",      color: "var(--color-info)",       glow: "var(--rgba-59-130-246-0_5)",   burst: 24, shake: 0.36 },
  epic:      { label: "Epic",      color: "var(--brand-500)",        glow: "var(--rgba-139-92-246-0_55)",  burst: 32, shake: 0.48 },
  legendary: { label: "Legendary", color: "var(--color-warning)",    glow: "var(--rgba-245-158-11-0_6)",   burst: 44, shake: 0.62 },
};

type RevealStage = "shake" | "burst" | "reveal";

/**
 * Three beats, because a one-frame popup that says "You got a reward!" is how
 * you make a legendary feel like a form submission:
 *
 *  1. **shake** — the box rattles, harder for higher tiers, building the idea
 *     that what is inside matters before you can see it.
 *  2. **burst** — rings and rays expand from the box.
 *  3. **reveal** — the reward card flips in under its own colour, coins count
 *     up, and an item reward offers the one action that makes it real: wear it.
 */
function OpeningAnimation({ reward, rarity = "rare", grantedItem, inventoryId, onClose, onEquip }: {
  reward: any;
  rarity?: string;
  grantedItem?: { itemId: string; name: string; emoji: string | null; type: string; rarity: string; alreadyOwned: boolean } | null;
  inventoryId?: string | null;
  onClose: () => void;
  onEquip?: (inventoryId: string, itemId: string) => Promise<void> | void;
}) {
  const r = REVEAL_RARITY[rarity] ?? REVEAL_RARITY.rare!;
  const [stage, setStage] = useState<RevealStage>("shake");
  const [equipping, setEquipping] = useState(false);
  const [equipped, setEquipped] = useState(false);

  useEffect(() => {
    const toBurst = setTimeout(() => setStage("burst"), 900);
    const toReveal = setTimeout(() => setStage("reveal"), 1350);
    return () => { clearTimeout(toBurst); clearTimeout(toReveal); };
  }, []);

  // Deterministic-ish particle ring: fixed angles, jittered distance, so the
  // burst never looks like the same screenshot twice but costs no animation lib.
  const sparks = useMemo(() => Array.from({ length: r.burst }, (_, i) => {
    const angle = (i / r.burst) * Math.PI * 2;
    const distance = 120 + Math.random() * 90;
    return { id: i, x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, size: 4 + Math.random() * 6 };
  }), [r.burst]);

  const coinReward = reward?.type === "coins" ? Number(reward.value ?? 0) : 0;

  const canEquip = Boolean(grantedItem && !grantedItem.alreadyOwned && inventoryId && onEquip);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-[var(--palette-black)]/85 backdrop-blur-sm"
      onClick={stage === "reveal" ? onClose : undefined}
    >
      <div className="relative w-full max-w-sm mx-4">
        {/* Ambient tier glow behind the card */}
        <div aria-hidden className="pointer-events-none absolute inset-[-40%] opacity-70"
          style={{ background: `radial-gradient(circle at 50% 45%, ${r.glow} 0%, transparent 62%)` }} />

        <motion.div
          variants={POP}
          initial="initial"
          animate="animate"
          className="relative rounded-3xl border bg-[var(--palette-0d0f1c)] p-8 text-center"
          style={{ borderColor: r.color, boxShadow: `0 0 40px ${r.glow}` }}
          onClick={e => e.stopPropagation()}
        >
          <div className="relative flex h-40 items-center justify-center">
            {stage !== "reveal" && (
              <motion.div
                animate={stage === "shake"
                  ? { rotate: [0, -6, 6, -5, 5, 0], scale: [1, 1 + r.shake * 0.12, 1], x: [0, -3, 3, -2, 2, 0] }
                  : { scale: [1, 1.5], opacity: [1, 0] }}
                transition={stage === "shake" ? { duration: 0.42, repeat: Infinity, ease: "easeInOut" } : { duration: 0.4 }}
                className="text-7xl"
              >
                📦
              </motion.div>
            )}

            {stage === "burst" && (
              <>
                {[0, 1] .map(ring => (
                  <motion.span key={ring} aria-hidden className="absolute rounded-full border-2"
                    style={{ borderColor: r.color, width: 70, height: 70 }}
                    initial={{ scale: 0.4, opacity: 0.9 }}
                    animate={{ scale: 4.6 + ring, opacity: 0 }}
                    transition={{ duration: 0.75, delay: ring * 0.12, ease: "easeOut" }}
                  />
                ))}
                {sparks.map(s => (
                  <motion.span key={s.id} aria-hidden className="absolute rounded-full"
                    style={{ background: r.color, width: s.size, height: s.size }}
                    initial={{ x: 0, y: 0, opacity: 1 }}
                    animate={{ x: s.x, y: s.y, opacity: 0, scale: 0.4 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                ))}
              </>
            )}

            {stage === "reveal" && (
              <motion.div
                initial={{ scale: 0.3, rotate: -25, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 14 }}
                className="text-8xl drop-shadow-[0_0_24px_var(--rgba-0-0-0-0_6)]"
                style={{ filter: `drop-shadow(0 0 18px ${r.glow})` }}
              >
                {reward.emoji ?? grantedItem?.emoji ?? "🎁"}
              </motion.div>
            )}
          </div>

          {stage === "reveal" ? (
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
              <span className="inline-block rounded-full px-3 py-0.5 text-[11px] font-bold uppercase tracking-[0.18em]"
                style={{ color: r.color, border: `1px solid ${r.color}` }}>
                {r.label}
              </span>
              <h2 className="mt-3 text-xl font-bold text-[var(--foreground)]">{reward.label}</h2>
              <p className="mt-1 text-sm text-[var(--foreground-subtle)]">{reward.description}</p>

              {coinReward > 0 && (
                <p className="mt-3 text-3xl font-bold tabular-nums text-[var(--color-warning)]">
                  <AnimatedCounter value={coinReward} duration={0.9} />
                </p>
              )}

              {grantedItem && !grantedItem.alreadyOwned && (
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--palette-22d387)]">
                  Added to your collection
                </p>
              )}

              <div className="mt-6 space-y-2">
                {canEquip && !equipped && (
                  <button
                    onClick={async () => {
                      if (!inventoryId || !onEquip) return;
                      setEquipping(true);
                      try { await onEquip(inventoryId, grantedItem!.itemId); setEquipped(true); }
                      finally { setEquipping(false); }
                    }}
                    disabled={equipping}
                    className="w-full rounded-xl py-2.5 text-sm font-bold text-[var(--palette-white)] transition-transform hover:scale-[1.02] disabled:opacity-60"
                    style={{ background: `linear-gradient(135deg, ${r.color}, color-mix(in srgb, ${r.color} 60%, transparent))` }}>
                    {equipping ? "Equipping…" : `✨ Equip ${grantedItem!.name} now`}
                  </button>
                )}
                {equipped && (
                  <p className="rounded-xl border py-2.5 text-sm font-semibold"
                    style={{ borderColor: r.color, color: r.color }}>
                    ✓ Equipped — it's on your profile
                  </p>
                )}
                <button onClick={onClose}
                  className="w-full rounded-xl border border-[var(--rgba-124-58-237-0_3)] bg-[var(--rgba-124-58-237-0_2)] py-2.5 text-sm font-semibold text-[var(--brand-400)]">
                  {equipped ? "Done" : "Keep in collection"}
                </button>
              </div>
            </motion.div>
          ) : (
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--foreground-subtle)]">
              Opening…
            </p>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}

export default function LootBoxesPage() {
  const [boxTypes, setBoxTypes] = useState<any[]>([]);
  const [myBoxes, setMyBoxes] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  /** The reveal payload: reward copy plus what (if anything) was granted, so the
   *  modal can offer "Equip now" instead of ending at a congratulations screen. */
  const [reveal, setReveal] = useState<{ reward: any; rarity: string; grantedItem: any; inventoryId: string | null } | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [tr, mr, wr] = await Promise.all([
        fetch("/api/lootboxes/types", { headers: authHeaders() }),
        fetch("/api/lootboxes/mine", { headers: authHeaders() }),
        fetch("/api/gamification/wallet", { headers: authHeaders() }),
      ]);
      if (!tr.ok || !mr.ok || !wr.ok) throw new Error("Unable to load loot boxes");
      setBoxTypes(await tr.json());
      setMyBoxes(await mr.json());
      setWallet(await wr.json());
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, []);

  const handleBuy = async (typeId: string) => {
    if (processing) return;
    setProcessing(typeId);
    try {
      const res = await fetch("/api/lootboxes/buy", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ typeId }),
      });
      const data = await res.json();
      if (!res.ok) { setToast(data.error || "Failed to buy"); setTimeout(() => setToast(null), 3000); return; }
      setWallet((w: any) => w ? { ...w, coins: data.newCoins } : w);
      setMyBoxes(prev => [data.box, ...prev]);
      setToast("📦 Box added to your collection!");
      setTimeout(() => setToast(null), 3000);
    } finally {
      setProcessing(null);
    }
  };

  const handleOpen = async (boxId: string) => {
    if (processing) return;
    setProcessing(boxId);
    try {
      const res = await fetch(`/api/lootboxes/${boxId}/open`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) { setToast(data.error || "Failed to open"); setTimeout(() => setToast(null), 3000); return; }
      setReveal({ reward: data.reward, rarity: data.rarity ?? "rare", grantedItem: data.grantedItem ?? null, inventoryId: data.inventoryId ?? null });
      setMyBoxes(prev => prev.filter(b => b.id !== boxId));
      if (data.newCoins !== undefined) setWallet((w: any) => w ? { ...w, coins: data.newCoins } : w);
    } finally {
      setProcessing(null);
    }
  };

  const { isOn, ready: flagsReady } = useFeatureFlags();
  const totalOwned = myBoxes.filter(b => b.status === "unopened").length;

  /*
    Feature-flag gate. "Loot Boxes" is a switchable subsystem — an admin turning
    it off in Feature Flags must take the whole mechanic out of the product, not
    just hide a link. Failing open (flag missing → visible) is handled by the hook.
  */
  if (flagsReady && !isOn(FEATURE_FLAG_KEYS.lootBoxes)) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <p className="text-3xl">📦</p>
          <h1 className="mt-3 text-xl font-bold text-[var(--foreground)]">Loot boxes are switched off</h1>
          <p className="mt-2 text-sm text-[var(--foreground-subtle)]">
            An admin has paused this feature for now. Your unopened boxes are safe — they'll be here when it's back.
          </p>
        </div>
      </PageTransition>
    );
  }

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--palette-zinc-700)] border-t-[var(--brand-600)]" />
    </div>
  );
  if (loadError) return <ErrorState title="Loot boxes unavailable" onRetry={() => { void load(); }} />;

  return (
    <PageTransition>
      <motion.div variants={PAGE} initial="initial" animate="animate" className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">Loot Boxes <span className="text-[var(--color-warning)]"><Package size={16} aria-hidden="true" /></span></h1>
          <p className="text-sm text-[var(--foreground-subtle)]">Earn boxes from sessions, open them for exciting rewards</p>
          {totalOwned > 0 && (
            <motion.div variants={POP} initial="initial" animate="animate"
              className="inline-flex items-center gap-2 mt-3 rounded-full border border-[var(--rgba-6-214-160-0_3)] bg-[var(--rgba-6-214-160-0_08)] px-4 py-1.5 text-sm text-[var(--brand-teal)]">
              <Package size={14} /> {totalOwned} unopened box{totalOwned !== 1 ? "es" : ""}
            </motion.div>
          )}
        </div>

        {wallet && (
          <div className="flex justify-center">
            <div className="flex items-center gap-2 rounded-xl border border-[var(--rgba-245-158-11-0_2)] bg-[var(--rgba-245-158-11-0_07)] px-4 py-2">
              <span className="text-lg"><Coins size={16} aria-hidden="true" /></span>
              <span className="text-sm font-bold text-[var(--color-warning)]">{wallet.coins.toLocaleString()} coins</span>
            </div>
          </div>
        )}

        {/* Box types grid */}
        <motion.div variants={STAGGER} initial="initial" animate="animate" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {boxTypes.map((bt: any) => (
            <BoxTypeCard key={bt.id} boxType={bt} myBoxes={myBoxes} wallet={wallet} onBuy={handleBuy} onOpen={handleOpen} />
          ))}
        </motion.div>

        {boxTypes.length === 0 && (
          <div className="py-16 text-center">
            <Gift size={40} className="mx-auto mb-3 text-[var(--foreground-subtle)]" />
            <p className="text-sm text-[var(--foreground-subtle)]">No loot box types are configured.</p>
          </div>
        )}

        {/* Reward popup */}
        <AnimatePresence>
          {reveal && (
            <OpeningAnimation
              reward={reveal.reward}
              rarity={reveal.rarity}
              grantedItem={reveal.grantedItem}
              inventoryId={reveal.inventoryId}
              onClose={() => setReveal(null)}
              onEquip={async (invId) => {
                const res = await fetch(`/api/marketplace/inventory/${invId}/equip`, { method: "POST", headers: authHeaders() });
                if (!res.ok) throw new Error("Could not equip");
              }}
            />
          )}
        </AnimatePresence>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[var(--z-modal)] rounded-2xl border border-[var(--rgba-124-58-237-0_3)] bg-[var(--palette-0d0f1c)] px-5 py-3 text-sm font-semibold text-[var(--brand-400)] shadow-lg">
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </PageTransition>
  );
}
