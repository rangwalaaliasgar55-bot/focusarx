import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { getToken } from "@/lib/auth";
import { Heart, Zap, Star, TrendingUp, Edit2, ArrowRight, CheckCircle } from "lucide-react";

const PET_TYPES = [
  { id: "owl",     name: "Sage Owl",       emoji: "🦉", color: "#F59E0B", desc: "Wise and calm. Perfect for deep study.",   evolutions: ["Owlet", "Wise Owl", "Elder Sage", "Celestial Owl"],     moods: { happy: "😌", excited: "🤩", sleepy: "😴", focused: "🤓" } },
  { id: "fox",     name: "Focus Fox",      emoji: "🦊", color: "#EF4444", desc: "Sharp and cunning. Thrives on consistency.", evolutions: ["Fox Kit", "Quick Fox", "Silver Fox", "Phantom Fox"],   moods: { happy: "😊", excited: "🥳", sleepy: "😪", focused: "😤" } },
  { id: "dragon",  name: "Study Dragon",   emoji: "🐲", color: "#8B5CF6", desc: "Fierce and powerful. Grows with ambition.", evolutions: ["Hatchling", "Drake", "Fire Drake", "Legend Dragon"],  moods: { happy: "😄", excited: "🔥", sleepy: "😴", focused: "💪" } },
  { id: "robot",   name: "Study Bot",      emoji: "🤖", color: "#06B6D4", desc: "Logical and precise. Optimizes sessions.", evolutions: ["Prototype", "StudyBot v2", "Neural Bot", "Quantum AI"], moods: { happy: "🙂", excited: "⚡", sleepy: "💤", focused: "🎯" } },
  { id: "cat",     name: "Neko Scholar",   emoji: "🐱", color: "#EC4899", desc: "Curious and playful. Keeps you motivated.", evolutions: ["Kitten", "Scholar Cat", "Mystic Cat", "Cosmic Neko"], moods: { happy: "😸", excited: "🙀", sleepy: "😿", focused: "😼" } },
  { id: "phoenix", name: "Rising Phoenix", emoji: "🦅", color: "#F97316", desc: "Reborn every session. Symbolizes growth.", evolutions: ["Fledgling", "Ember Bird", "Phoenix", "Eternal Flame"],  moods: { happy: "😎", excited: "🌟", sleepy: "😮‍💨", focused: "🦾" } },
];

const XP_PER_LEVEL = 500;

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

function PetDisplay({ pet, petType }: { pet: any; petType: typeof PET_TYPES[0] }) {
  const evolutionStage = Math.min(3, Math.floor((pet.petLevel - 1) / 10));
  const evolutionName = petType.evolutions[evolutionStage] ?? petType.name;
  const xpInCurrentLevel = pet.petXp % XP_PER_LEVEL;
  const xpPct = Math.round((xpInCurrentLevel / XP_PER_LEVEL) * 100);

  return (
    <div className="space-y-6">
      {/* Pet Card */}
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-8 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{ background: `radial-gradient(circle at center, ${petType.color}, transparent 70%)` }} />
        <motion.div
          animate={{ y: [0, -8, 0], rotate: [0, 2, -2, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          className="text-8xl mb-3 inline-block"
        >{petType.emoji}</motion.div>
        <div className="text-2xl mb-0.5">{getMoodEmoji(petType, pet.mood ?? "happy")}</div>
        <h2 className="text-xl font-bold text-white mt-1">{pet.petName || petType.name}</h2>
        <p className="text-xs text-[#64748B] mt-0.5">{evolutionName} · {getMoodLabel(pet.mood ?? "happy")}</p>
        <div className="flex items-center justify-center gap-2 mt-2">
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold border" style={{ color: petType.color, borderColor: petType.color + "40", background: petType.color + "12" }}>
            LVL {pet.petLevel}
          </span>
          <span className="rounded-full bg-[rgba(255,255,255,0.06)] px-2 py-0.5 text-[10px] text-[#64748B]">
            Stage {evolutionStage + 1}/4
          </span>
        </div>
      </motion.div>

      {/* XP Bar */}
      <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs text-[#94A3B8]">
            <Zap size={12} style={{ color: petType.color }} />
            <span>Pet XP</span>
          </div>
          <span className="text-xs text-[#64748B]">{xpInCurrentLevel}/{XP_PER_LEVEL}</span>
        </div>
        <div className="h-2 w-full rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${xpPct}%` }} transition={{ duration: 1, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${petType.color}, ${petType.color}aa)` }} />
        </div>
        <p className="text-[10px] text-[#4B5563] mt-1.5">Earn XP by completing focus sessions. Every minute = 1 pet XP.</p>
      </div>

      {/* Evolution path */}
      <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-3">Evolution Path</p>
        <div className="flex items-center gap-2">
          {petType.evolutions.map((evo, i) => (
            <div key={evo} className="flex items-center gap-2">
              <div className={`flex flex-col items-center gap-1 ${i <= evolutionStage ? "" : "opacity-30"}`}>
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-base border ${i <= evolutionStage ? "border-[rgba(124,58,237,0.5)] bg-[rgba(124,58,237,0.15)]" : "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]"}`}>
                  {i === evolutionStage ? petType.emoji : i < evolutionStage ? "✅" : "🔒"}
                </div>
                <span className="text-[9px] text-[#4B5563] text-center max-w-[48px] leading-tight">{evo}</span>
              </div>
              {i < 3 && <div className="h-px flex-1 bg-[rgba(255,255,255,0.06)]" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PetsPage() {
  const [pet, setPet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [petName, setPetName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/pets", { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { setPet(d.pet); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

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

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#7C3AED] border-t-transparent" />
    </div>
  );

  const petType = pet ? PET_TYPES.find(p => p.id === pet.petType) : null;

  if (!pet || selecting) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-3xl px-4 py-8">
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(124,58,237,0.3)] bg-[rgba(124,58,237,0.1)] px-4 py-1.5 mb-4">
              <Heart size={14} className="text-[#A78BFA]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[#A78BFA]">Pet Companion</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Choose your study companion</h1>
            <p className="text-[#94A3B8] text-sm max-w-md mx-auto">Your pet grows with you. It levels up as you study, evolves through stages, and reflects your dedication.</p>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
            {PET_TYPES.map((pt, i) => (
              <motion.button key={pt.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                onClick={() => setSelected(pt.id)}
                className={`relative rounded-2xl border p-5 text-left transition-all duration-200 ${
                  selected === pt.id
                    ? "border-[rgba(124,58,237,0.6)] bg-[rgba(124,58,237,0.12)] shadow-[0_0_24px_rgba(124,58,237,0.2)]"
                    : "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(124,58,237,0.3)]"
                }`}>
                {selected === pt.id && (
                  <span className="absolute top-2 right-2"><CheckCircle size={16} style={{ color: pt.color }} /></span>
                )}
                <motion.div animate={selected === pt.id ? { y: [0, -4, 0] } : {}} transition={{ repeat: Infinity, duration: 2 }}
                  className="text-4xl mb-3">{pt.emoji}</motion.div>
                <div className="text-sm font-semibold text-white mb-1">{pt.name}</div>
                <div className="text-[10px] text-[#64748B]">{pt.desc}</div>
              </motion.button>
            ))}
          </div>

          {selected && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-[rgba(124,58,237,0.2)] bg-[rgba(124,58,237,0.06)] p-5 mb-6 max-w-md mx-auto">
              <label className="text-xs font-medium text-[#94A3B8] uppercase tracking-wider mb-2 block">Name your companion <span className="text-[#4B5563] font-normal">(optional)</span></label>
              <input
                className="w-full rounded-xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] px-3 py-2 text-sm text-white placeholder:text-[#4B5563] focus:outline-none focus:border-[#7C3AED]"
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
                className="flex items-center gap-2 rounded-xl bg-[#7C3AED] px-6 py-3 text-sm font-semibold text-white hover:bg-[#6D28D9] disabled:opacity-50 transition-colors">
                {saving ? "Adopting..." : "Adopt Companion"}
                <ArrowRight size={15} />
              </motion.button>
            </div>
          )}
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(124,58,237,0.3)] bg-[rgba(124,58,237,0.1)] px-4 py-1.5 mb-2">
              <Heart size={14} className="text-[#A78BFA]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[#A78BFA]">Your Companion</span>
            </div>
            <h1 className="text-2xl font-bold text-white">{pet.petName || petType?.name}</h1>
          </div>
          <button onClick={() => setSelecting(true)} className="flex items-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.08)] px-3 py-1.5 text-xs text-[#64748B] hover:text-[#94A3B8] transition-all">
            <Edit2 size={12} /> Change
          </button>
        </div>
        {petType && <PetDisplay pet={pet} petType={petType} />}
      </div>
    </PageTransition>
  );
}
