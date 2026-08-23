import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { getToken } from "@/lib/auth";
import { Heart, Zap, Star, Edit2, ArrowRight, CheckCircle, ShoppingBag, CheckSquare, Square, Lock } from "lucide-react";
import { ErrorState } from "@/components/ErrorState";

const PET_TYPES = [
  { id: "owl",     name: "Sage Owl",       emoji: "🦉", color: "var(--color-warning)", desc: "Wise and calm. Perfect for deep study.",   evolutions: ["Owlet", "Wise Owl", "Elder Sage", "Celestial Owl"],     moods: { happy: "😌", excited: "🤩", sleepy: "😴", focused: "🤓" }, premiumOnly: false },
  { id: "fox",     name: "Focus Fox",      emoji: "🦊", color: "var(--color-error)", desc: "Sharp and cunning. Thrives on consistency.", evolutions: ["Fox Kit", "Quick Fox", "Silver Fox", "Phantom Fox"],   moods: { happy: "😊", excited: "🥳", sleepy: "😪", focused: "😤" }, premiumOnly: false },
  { id: "dragon",  name: "Study Dragon",   emoji: "🐲", color: "var(--brand-500)", desc: "Fierce and powerful. Grows with ambition.", evolutions: ["Hatchling", "Drake", "Fire Drake", "Legend Dragon"],  moods: { happy: "😄", excited: "🔥", sleepy: "😴", focused: "💪" }, premiumOnly: true },
  { id: "robot",   name: "Study Bot",      emoji: "🤖", color: "var(--palette-06b6d4)", desc: "Logical and precise. Optimizes sessions.", evolutions: ["Prototype", "StudyBot v2", "Neural Bot", "Quantum AI"], moods: { happy: "🙂", excited: "⚡", sleepy: "💤", focused: "🎯" }, premiumOnly: false },
  { id: "cat",     name: "Neko Scholar",   emoji: "🐱", color: "var(--palette-ec4899)", desc: "Curious and playful. Keeps you motivated.", evolutions: ["Kitten", "Scholar Cat", "Mystic Cat", "Cosmic Neko"], moods: { happy: "😸", excited: "🙀", sleepy: "😿", focused: "😼" }, premiumOnly: false },
  { id: "phoenix", name: "Rising Phoenix", emoji: "🦅", color: "var(--palette-f97316)", desc: "Reborn every session. Symbolizes growth.", evolutions: ["Fledgling", "Ember Bird", "Phoenix", "Eternal Flame"],  moods: { happy: "😎", excited: "🌟", sleepy: "😮‍💨", focused: "🦾" }, premiumOnly: true },
];

const XP_PER_LEVEL = 500;

const ACC_SLOT_LABELS: Record<string, string> = {
  hat: "Hat", glasses: "Glasses", back: "Cape / Back", wings: "Wings", frame: "Frame", bg: "Aura / BG",
};

// Derive slot from item ID
function getItemSlot(itemId: string): string {
  if (["acc-crown","acc-hat","acc-grad","acc-party","acc-halo","acc-santa"].includes(itemId)) return "hat";
  if (["acc-glasses","acc-sunglasses","acc-monocle"].includes(itemId)) return "glasses";
  if (["acc-cape","acc-hoodie","acc-scarf"].includes(itemId)) return "back";
  if (["acc-wings","acc-fire-wings","acc-butterfly"].includes(itemId)) return "wings";
  if (["frame-gold","frame-diamond","frame-fire"].includes(itemId)) return "frame";
  if (["frame-nebula","effect-sparkle","effect-lightning","effect-aurora"].includes(itemId)) return "bg";
  return "other";
}

function authHeaders() {
  const t = getToken();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (t) h["Authorization"] = `Bearer ${t}`;
  return h;
}

function getMoodEmoji(pt: typeof PET_TYPES[0], mood: string) {
  return (pt.moods as any)[mood] ?? "😊";
}

function getMoodLabel(mood: string) {
  return { happy: "Happy", excited: "Excited", sleepy: "Sleepy", focused: "Focused" }[mood] ?? "Happy";
}

// ── Pet display card with live accessory overlays ─────────────────────────────
function PetDisplay({ pet, petType, accessories }: { pet: any; petType: typeof PET_TYPES[0]; accessories: any[] }) {
  const evolutionStage = Math.min(3, Math.floor((pet.petLevel - 1) / 10));
  const evolutionName = petType.evolutions[evolutionStage] ?? petType.name;
  const xpInCurrentLevel = pet.petXp % XP_PER_LEVEL;
  const xpPct = Math.round((xpInCurrentLevel / XP_PER_LEVEL) * 100);

  const equipped = accessories.filter(a => a.equipped);
  const hat     = equipped.find(a => getItemSlot(a.itemId) === "hat");
  const glasses = equipped.find(a => getItemSlot(a.itemId) === "glasses");
  const back    = equipped.find(a => getItemSlot(a.itemId) === "back");
  const wings   = equipped.find(a => getItemSlot(a.itemId) === "wings");
  const frame   = equipped.find(a => getItemSlot(a.itemId) === "frame");
  const bg      = equipped.find(a => getItemSlot(a.itemId) === "bg");

  const frameColors: Record<string, string> = { "frame-gold": "var(--brand-gold)", "frame-diamond": "var(--palette-a5f3fc)", "frame-fire": "var(--palette-f97316)" };
  const bgColors: Record<string, string> = {
    "frame-nebula": "var(--rgba-139-92-246-0_22)", "effect-sparkle": "var(--rgba-167-139-250-0_18)",
    "effect-lightning": "var(--rgba-250-204-21-0_15)", "effect-aurora": "var(--rgba-6-214-160-0_15)",
  };

  return (
    <div className="space-y-5">
      {/* Pet Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border border-[var(--rgba-255-255-255-0_08)] bg-[var(--rgba-255-255-255-0_02)] p-8 text-center relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-5" style={{ background: `radial-gradient(circle at center, ${petType.color}, transparent 70%)` }} />

        {/* Background aura */}
        {bg && (
          <div className="absolute inset-0 rounded-2xl" style={{ background: bgColors[bg.itemId] ?? "transparent" }} />
        )}

        {/* Pet with accessories */}
        <div className="relative inline-block mb-3">
          {/* Wings behind */}
          {wings && (
            <div className="absolute inset-0 flex items-center justify-between pointer-events-none" style={{ left: "-50%", right: "-50%", width: "200%" }}>
              <motion.span animate={{ rotate: [-14, -5, -14] }} transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }} className="text-4xl block">{wings.emoji}</motion.span>
              <motion.span animate={{ rotate: [14, 5, 14] }}  transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }} className="text-4xl block" style={{ transform: "scaleX(-1)" }}>{wings.emoji}</motion.span>
            </div>
          )}

          {/* Frame ring */}
          {frame && (
            <div className="absolute inset-0 rounded-full" style={{ border: `3px solid ${frameColors[frame.itemId] ?? "var(--brand-600)"}`, boxShadow: `0 0 16px color-mix(in srgb, ${frameColors[frame.itemId] ?? "var(--brand-600)"} 31%, transparent)`, inset: "-10%" }} />
          )}

          <motion.div
            animate={{ y: [0, -8, 0], rotate: [0, 2, -2, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            className="text-8xl relative z-[var(--z-content)] inline-block"
          >
            {petType.emoji}
          </motion.div>

          {/* Hat */}
          {hat && (
            <motion.div
              animate={{ y: [0, -2, 0] }} transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
              className="absolute -top-5 left-1/2 -translate-x-1/2 text-3xl pointer-events-none z-[var(--z-sticky)]"
            >
              {hat.emoji}
            </motion.div>
          )}

          {/* Glasses */}
          {glasses && (
            <div className="absolute top-[28%] left-1/2 -translate-x-1/2 text-2xl pointer-events-none z-[var(--z-sticky)]">
              {glasses.emoji}
            </div>
          )}

          {/* Cape */}
          {back && (
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-2xl pointer-events-none z-[var(--z-content)]">
              {back.emoji}
            </div>
          )}
        </div>

        <div className="text-2xl mb-0.5 relative z-[var(--z-content)]">{getMoodEmoji(petType, pet.mood ?? "happy")}</div>
        <h2 className="text-xl font-bold text-[var(--palette-white)] mt-1 relative z-[var(--z-content)]">{pet.petName || petType.name}</h2>
        <p className="text-xs text-[var(--muted-fg)] mt-0.5 relative z-[var(--z-content)]">{evolutionName} · {getMoodLabel(pet.mood ?? "happy")}</p>

        <div className="flex items-center justify-center gap-2 mt-2 relative z-[var(--z-content)]">
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold border" style={{ color: petType.color, borderColor: `color-mix(in srgb, ${petType.color} 25%, transparent)`, background: `color-mix(in srgb, ${petType.color} 7%, transparent)` }}>
            LVL {pet.petLevel}
          </span>
          <span className="rounded-full bg-[var(--rgba-255-255-255-0_06)] px-2 py-0.5 text-[10px] text-[var(--muted-fg)]">
            Stage {evolutionStage + 1}/4
          </span>
        </div>

        {/* Active accessories badges */}
        {equipped.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1 mt-3 relative z-[var(--z-content)]">
            {equipped.map(a => (
              <span key={a.itemId} className="text-sm rounded-full bg-[var(--rgba-124-58-237-0_12)] border border-[var(--rgba-124-58-237-0_2)] px-2 py-0.5 text-[10px] text-[var(--brand-400)]">
                {a.emoji} {a.name}
              </span>
            ))}
          </div>
        )}
      </motion.div>

      {/* XP Bar */}
      <div className="rounded-xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_02)] p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs text-[var(--foreground-muted)]">
            <Zap size={12} style={{ color: petType.color }} />
            <span>Pet XP</span>
          </div>
          <span className="text-xs text-[var(--muted-fg)]">{xpInCurrentLevel}/{XP_PER_LEVEL}</span>
        </div>
        <div className="h-2 w-full rounded-full bg-[var(--rgba-255-255-255-0_06)] overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${xpPct}%` }} transition={{ duration: 0.4, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${petType.color}, color-mix(in srgb, ${petType.color} 67%, transparent))` }} />
        </div>
        <p className="text-[10px] text-[var(--foreground-subtle)] mt-1.5">Earn XP by completing focus sessions. Every minute = 1 pet XP.</p>
      </div>

      {/* Evolution path */}
      <div className="rounded-xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_02)] p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-fg)] mb-3">Evolution Path</p>
        <div className="flex items-center gap-2">
          {petType.evolutions.map((evo, i) => (
            <div key={evo} className="flex items-center gap-2">
              <div className={`flex flex-col items-center gap-1 ${i <= evolutionStage ? "" : "opacity-30"}`}>
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-base border ${i <= evolutionStage ? "border-[var(--rgba-124-58-237-0_5)] bg-[var(--rgba-124-58-237-0_15)]" : "border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_02)]"}`}>
                  {i === evolutionStage ? petType.emoji : i < evolutionStage ? "✅" : "🔒"}
                </div>
                <span className="text-[9px] text-[var(--foreground-subtle)] text-center max-w-[48px] leading-tight">{evo}</span>
              </div>
              {i < 3 && <div className="h-px flex-1 bg-[var(--rgba-255-255-255-0_06)]" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Accessory inventory panel ─────────────────────────────────────────────────
function AccessoryInventory({ inventory, onEquipToggle }: {
  inventory: any[];
  onEquipToggle: (invId: string, equipped: boolean) => void;
}) {
  const accessoryItems = inventory.filter(i =>
    ["accessory", "frame", "effect"].includes(i.type ?? "")
    || i.itemId?.startsWith("acc-") || i.itemId?.startsWith("frame-") || i.itemId?.startsWith("effect-")
  );

  if (accessoryItems.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--rgba-255-255-255-0_08)] bg-[var(--rgba-255-255-255-0_01)] p-6 text-center">
        <div className="text-4xl mb-2">🛍️</div>
        <p className="text-sm text-[var(--muted-fg)]">No accessories yet</p>
        <p className="text-xs text-[var(--foreground-subtle)] mt-1">Visit the Marketplace to equip your companion</p>
      </div>
    );
  }

  // Group by slot
  const bySlot: Record<string, any[]> = {};
  for (const item of accessoryItems) {
    const slot = getItemSlot(item.itemId);
    if (!bySlot[slot]) bySlot[slot] = [];
    bySlot[slot]!.push(item);
  }

  return (
    <div className="space-y-4">
      {Object.entries(bySlot).map(([slot, items]) => (
        <div key={slot}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--foreground-subtle)] mb-2">
            {ACC_SLOT_LABELS[slot] ?? slot}
          </p>
          <div className="space-y-2">
            {items.map(item => (
              <motion.div
                key={item.id}
                layout
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
                  item.equipped
                    ? "border-[var(--rgba-124-58-237-0_5)] bg-[var(--rgba-124-58-237-0_1)]"
                    : "border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_02)] hover:border-[var(--rgba-124-58-237-0_25)]"
                }`}
              >
                <span className="text-2xl">{item.emoji ?? "✨"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--palette-white)] truncate">{item.name}</p>
                  <p className="text-[10px] text-[var(--muted-fg)] capitalize">{item.rarity ?? ""}</p>
                </div>
                <button
                  onClick={() => onEquipToggle(item.id, item.equipped)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    item.equipped
                      ? "bg-[var(--rgba-124-58-237-0_25)] text-[var(--brand-400)] hover:bg-[var(--rgba-124-58-237-0_35)]"
                      : "border border-[var(--rgba-255-255-255-0_1)] text-[var(--muted-fg)] hover:text-[var(--brand-400)] hover:border-[var(--rgba-124-58-237-0_3)]"
                  }`}
                >
                  {item.equipped ? (
                    <><CheckSquare size={12} /> Equipped</>
                  ) : (
                    <><Square size={12} /> Equip</>
                  )}
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PetsPage() {
  const [pet, setPet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [petName, setPetName] = useState("");
  const [saving, setSaving] = useState(false);
  const [inventory, setInventory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"companion" | "accessories">("companion");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const h = authHeaders();
      const [petResponse, inventoryResponse] = await Promise.all([
        fetch("/api/pets", { headers: h }),
        fetch("/api/marketplace/inventory", { headers: h }),
      ]);
      if (!petResponse.ok || !inventoryResponse.ok) throw new Error("Unable to load pet data");
      const [petData, inventoryData] = await Promise.all([petResponse.json(), inventoryResponse.json()]);
      setPet(petData.pet);
      setInventory(inventoryData.inventory ?? []);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function savePet() {
    if (!selected) return;
    setSaving(true);
    try {
      const type = PET_TYPES.find(p => p.id === selected)!;
      await fetch("/api/pets", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ petType: selected, petName: petName || type.name }),
      });
      const r = await fetch("/api/pets", { headers: authHeaders() });
      const d = await r.json();
      setPet(d.pet);
      setSelecting(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleEquipToggle(invId: string, currentlyEquipped: boolean) {
    try {
      const r = await fetch(`/api/marketplace/inventory/${invId}/equip`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (r.ok) {
        setInventory(prev => prev.map(i => i.id === invId ? { ...i, equipped: !currentlyEquipped } : i));
      }
    } catch { }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--brand-600)] border-t-transparent" />
    </div>
  );
  if (loadError) return <ErrorState title="Pet companion unavailable" onRetry={() => { void load(); }} />;

  const petType = pet ? PET_TYPES.find(p => p.id === pet.petType) : null;

  // ── Pet selection screen ──────────────────────────────────────────────────
  if (!pet || selecting) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-3xl px-4 py-8">
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--rgba-124-58-237-0_3)] bg-[var(--rgba-124-58-237-0_1)] px-4 py-1.5 mb-4">
              <Heart size={14} className="text-[var(--brand-400)]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-400)]">Pet Companion</span>
            </div>
            <h1 className="text-3xl font-bold text-[var(--palette-white)] mb-2">Choose your study companion</h1>
            <p className="text-[var(--foreground-muted)] text-sm max-w-md mx-auto">Your pet grows with you. It levels up as you study, evolves through stages, and reflects your dedication.</p>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
            {PET_TYPES.map((pt, i) => (
              <motion.button key={pt.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                onClick={() => { if (!pt.premiumOnly) setSelected(pt.id); }}
                className={`relative rounded-2xl border p-5 text-left transition-all duration-[var(--duration-fast)] ${
                  pt.premiumOnly ? "opacity-70" : ""
                } ${
                  selected === pt.id
                    ? "border-[var(--rgba-124-58-237-0_6)] bg-[var(--rgba-124-58-237-0_12)] shadow-[0_0_24px_var(--rgba-124-58-237-0_2)]"
                    : "border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_02)] hover:border-[var(--rgba-124-58-237-0_3)]"
                }`}>
                {pt.premiumOnly && (
                  <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-[var(--brand-gold)]/15 border border-[var(--brand-gold)]/30 px-2 py-0.5 text-[9px] font-bold text-[var(--brand-gold)]"><Lock size={8} /> Premium</span>
                ) || selected === pt.id && (
                  <span className="absolute top-2 right-2"><CheckCircle size={16} style={{ color: pt.color }} /></span>
                )}
                <motion.div animate={selected === pt.id ? { y: [0, -4, 0] } : {}} transition={{ repeat: Infinity, duration: 2 }}
                  className="text-4xl mb-3">{pt.emoji}</motion.div>
                <div className="text-sm font-semibold text-[var(--palette-white)] mb-1">{pt.name}</div>
                <div className="text-[10px] text-[var(--muted-fg)]">{pt.desc}</div>
              </motion.button>
            ))}
          </div>

          {selected && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-[var(--rgba-124-58-237-0_2)] bg-[var(--rgba-124-58-237-0_06)] p-5 mb-6 max-w-md mx-auto">
              <label className="text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider mb-2 block">Name your companion <span className="text-[var(--foreground-subtle)] font-normal">(optional)</span></label>
              <input
                className="w-full rounded-xl bg-[var(--rgba-255-255-255-0_05)] border border-[var(--rgba-255-255-255-0_1)] px-3 py-2 text-sm text-[var(--palette-white)] placeholder:text-[var(--foreground-subtle)] focus:outline-none focus:border-[var(--brand-600)]"
                placeholder={PET_TYPES.find(p => p.id === selected)?.name}
                value={petName}
                onChange={e => setPetName(e.target.value)}
              />
            </motion.div>
          )}

          {selected && (
            <div className="flex justify-center">
              <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                onClick={savePet} disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-[var(--brand-600)] px-6 py-3 text-sm font-semibold text-[var(--palette-white)] hover:bg-[var(--brand-700)] disabled:opacity-50 transition-colors">
                {saving ? "Adopting..." : "Adopt Companion"}
                <ArrowRight size={15} />
              </motion.button>
            </div>
          )}
        </div>
      </PageTransition>
    );
  }

  // ── Active companion screen ───────────────────────────────────────────────
  return (
    <PageTransition>
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--rgba-124-58-237-0_3)] bg-[var(--rgba-124-58-237-0_1)] px-4 py-1.5 mb-2">
              <Heart size={14} className="text-[var(--brand-400)]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-400)]">Your Companion</span>
            </div>
            <h1 className="text-2xl font-bold text-[var(--palette-white)]">{pet.petName || petType?.name}</h1>
          </div>
          <button onClick={() => setSelecting(true)} className="flex items-center gap-1.5 rounded-lg border border-[var(--rgba-255-255-255-0_08)] px-3 py-1.5 text-xs text-[var(--muted-fg)] hover:text-[var(--foreground-muted)] transition-all">
            <Edit2 size={12} /> Change
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl bg-[var(--rgba-255-255-255-0_03)] p-1 border border-[var(--rgba-255-255-255-0_06)] mb-6">
          {([["companion", "🐾 Companion"], ["accessories", "✨ Accessories"]] as [string, string][]).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as "companion" | "accessories")}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                activeTab === tab
                  ? "bg-[var(--rgba-124-58-237-0_25)] text-[var(--brand-400)]"
                  : "text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "companion" && petType && (
            <motion.div key="companion" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.15 }}>
              <PetDisplay pet={pet} petType={petType} accessories={inventory} />
            </motion.div>
          )}

          {activeTab === "accessories" && (
            <motion.div key="accessories" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.15 }}>
              <div className="mb-4 flex items-center gap-2">
                <Star size={14} className="text-[var(--brand-400)]" />
                <h2 className="text-sm font-semibold text-[var(--foreground-muted)]">Equipped accessories appear on your companion in real-time</h2>
              </div>
              <AccessoryInventory inventory={inventory} onEquipToggle={handleEquipToggle} />
              <div className="mt-6 rounded-xl border border-[var(--rgba-124-58-237-0_2)] bg-[var(--rgba-124-58-237-0_06)] p-4 flex items-center gap-3">
                <ShoppingBag size={16} className="text-[var(--brand-400)] shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-[var(--foreground-muted)]">Want more accessories?</p>
                  <p className="text-[11px] text-[var(--foreground-subtle)]">Visit the Marketplace to browse hats, glasses, wings, auras and more.</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}
