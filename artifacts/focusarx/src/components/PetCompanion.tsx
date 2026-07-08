import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getToken } from "@/lib/auth";

// ── Speech messages ────────────────────────────────────────────────────────────
const SPEECH_MESSAGES = [
  "Keep going! 💪",
  "You're doing amazing! 🌟",
  "Another few minutes! ⏱️",
  "Your streak is growing! 🔥",
  "FocusArx believes in you! ✨",
  "Stay locked in! 🧠",
  "You're unstoppable! 🚀",
  "Almost there, champ! 💎",
  "Every minute counts! ⚡",
  "Deep work mode: ON 🎯",
];

const PHASE_MESSAGES: Record<string, string[]> = {
  start:    ["Focus mode: activated! 🚀", "Let's build something great! 🎯", "Starting strong! 💪"],
  building: ["Building momentum! 🔥", "Keep that energy! ⚡", "You're getting there! 💫"],
  crushing: ["You're crushing it! 🌟", "Over halfway! 🏆", "Don't stop now! 🔥"],
  final:    ["Final stretch! 💎", "Almost done! 🚀", "Sprint to the finish! 🏅"],
  complete: ["SESSION COMPLETE! 🎉", "You're incredible! 🌟", "Perfect session! 🏆"],
};

// ── Pet visuals ────────────────────────────────────────────────────────────────
const PET_EMOJIS: Record<string, string> = {
  owl: "🦉", fox: "🦊", dragon: "🐲", robot: "🤖", cat: "🐱", phoenix: "🦅",
};

const PET_COLORS: Record<string, string> = {
  owl: "#F59E0B", fox: "#EF4444", dragon: "#8B5CF6",
  robot: "#06B6D4", cat: "#EC4899", phoenix: "#F97316",
};

// ── Accessory system ───────────────────────────────────────────────────────────
type AccessorySlot = "hat" | "glasses" | "back" | "wings" | "frame" | "bg";

interface AccessoryDef {
  slot: AccessorySlot;
  emoji: string;
  label: string;
  bgColor?: string;
  frameColor?: string;
}

const ACCESSORY_DEFS: Record<string, AccessoryDef> = {
  // Hats
  "acc-crown":      { slot: "hat",     emoji: "👑", label: "Royal Crown" },
  "acc-hat":        { slot: "hat",     emoji: "🎩", label: "Top Hat" },
  "acc-party":      { slot: "hat",     emoji: "🥳", label: "Party Hat" },
  "acc-witch":      { slot: "hat",     emoji: "🧙", label: "Witch Hat" },
  "acc-santa":      { slot: "hat",     emoji: "🎅", label: "Santa Hat" },
  "acc-grad":       { slot: "hat",     emoji: "🎓", label: "Graduation Cap" },
  "acc-halo":       { slot: "hat",     emoji: "😇", label: "Angel Halo" },
  // Glasses
  "acc-glasses":    { slot: "glasses", emoji: "🤓", label: "Study Glasses" },
  "acc-sunglasses": { slot: "glasses", emoji: "😎", label: "Cool Shades" },
  "acc-monocle":    { slot: "glasses", emoji: "🧐", label: "Monocle" },
  // Back / Cape
  "acc-cape":       { slot: "back",    emoji: "🦸", label: "Hero Cape" },
  "acc-hoodie":     { slot: "back",    emoji: "🧥", label: "Hoodie" },
  "acc-scarf":      { slot: "back",    emoji: "🧣", label: "Lucky Scarf" },
  // Wings
  "acc-wings":      { slot: "wings",   emoji: "🪽", label: "Angel Wings" },
  "acc-fire-wings": { slot: "wings",   emoji: "🔥", label: "Fire Wings" },
  "acc-butterfly":  { slot: "wings",   emoji: "🦋", label: "Butterfly Wings" },
  // Frames
  "frame-gold":     { slot: "frame",   emoji: "🏆", label: "Gold Frame",    frameColor: "#FFB800" },
  "frame-diamond":  { slot: "frame",   emoji: "💎", label: "Diamond Frame", frameColor: "#A5F3FC" },
  "frame-fire":     { slot: "frame",   emoji: "🔥", label: "Fire Ring",     frameColor: "#F97316" },
  // Background effects
  "frame-nebula":    { slot: "bg", emoji: "🌌", label: "Nebula Aura",    bgColor: "rgba(139,92,246,0.22)" },
  "effect-sparkle":  { slot: "bg", emoji: "✨", label: "Sparkle Aura",   bgColor: "rgba(167,139,250,0.18)" },
  "effect-lightning":{ slot: "bg", emoji: "⚡", label: "Lightning Aura", bgColor: "rgba(250,204,21,0.15)" },
  "effect-aurora":   { slot: "bg", emoji: "🌅", label: "Aurora Effect",  bgColor: "rgba(6,214,160,0.15)" },
};

function resolveAccessories(inventory: { itemId: string; equipped: boolean }[]) {
  const slots: Partial<Record<AccessorySlot, AccessoryDef>> = {};
  for (const inv of inventory) {
    if (!inv.equipped) continue;
    const def = ACCESSORY_DEFS[inv.itemId];
    if (def && !slots[def.slot]) slots[def.slot] = def;
  }
  return slots;
}

// ── Confetti ───────────────────────────────────────────────────────────────────
const CONFETTI_COLORS = ["#7C3AED","#A78BFA","#06D6A0","#FFB800","#F97316","#EC4899","#3B82F6","#FFFFFF","#FDE047"];

function ConfettiEffect() {
  const particles = Array.from({ length: 32 }, (_, i) => ({
    id: i,
    x: 5 + Math.random() * 90,
    delay: Math.random() * 0.7,
    duration: 1.6 + Math.random() * 1.2,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
    w: 7 + Math.random() * 9,
    h: 4 + Math.random() * 6,
    rot: Math.random() * 360,
  }));
  return (
    <div className="pointer-events-none absolute inset-x-[-20%] -top-12 h-[200%] overflow-hidden z-50">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-sm"
          style={{ left: `${p.x}%`, top: -14, width: p.w, height: p.h, background: p.color, rotate: p.rot }}
          animate={{ y: ["0%", "110%"], rotate: [p.rot, p.rot + 720], opacity: [1, 1, 0] }}
          transition={{ duration: p.duration, delay: p.delay, ease: "linear" }}
        />
      ))}
    </div>
  );
}

// ── XP reward popup ────────────────────────────────────────────────────────────
function XpReward({ amount }: { amount: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 0, scale: 0.7 }}
      animate={{ opacity: [0, 1, 1, 0], y: [0, -70], scale: [0.7, 1.3, 1.1] }}
      transition={{ duration: 2.2, ease: "easeOut" }}
      className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 z-50 whitespace-nowrap text-xl font-black text-yellow-300"
      style={{ textShadow: "0 0 16px rgba(251,191,36,0.9), 0 0 4px rgba(0,0,0,0.8)" }}
    >
      +{amount} Pet XP ⚡
    </motion.div>
  );
}

// ── Phase helpers ──────────────────────────────────────────────────────────────
type Phase = "idle" | "start" | "building" | "crushing" | "final" | "complete";

function getPhase(progress: number, active: boolean): Phase {
  if (!active) return "idle";
  if (progress >= 1)    return "complete";
  if (progress >= 0.75) return "final";
  if (progress >= 0.5)  return "crushing";
  if (progress >= 0.25) return "building";
  return "start";
}

const PHASE_ANIM: Record<Phase, Record<string, number[]>> = {
  idle:     { y: [0, -5, 0],             scale: [1, 1.02, 1] },
  start:    { y: [0, -8, 0],             scale: [1, 1.04, 1] },
  building: { y: [0, -12, 0],            scale: [1, 1.06, 1], x: [-1.5, 1.5, -1, 0] },
  crushing: { y: [0, -16, 0],            scale: [1, 1.09, 1], rotate: [0, 3, -3, 0] },
  final:    { y: [0, -20, 0, -14, 0],    scale: [1, 1.13, 1], rotate: [0, 6, -6, 0] },
  complete: { y: [0, -26, 0, -20, 0],   scale: [1, 1.22, 0.94, 1.16, 1], rotate: [0, 14, -14, 8, 0] },
};

const PHASE_DUR: Record<Phase, number> = {
  idle: 4, start: 3.5, building: 2.5, crushing: 2, final: 1.5, complete: 1,
};

const PHASE_LABELS: Record<Phase, string | null> = {
  idle: null, start: "Focusing 🎯", building: "Momentum ↑ 🔥",
  crushing: "Crushing It! 🌟", final: "Final Push! 💎", complete: "Complete! 🎉",
};

// ── Props ──────────────────────────────────────────────────────────────────────
export interface PetCompanionProps {
  isRunning: boolean;
  elapsedSeconds: number;
  mode: "focus" | "break" | "longBreak";
  progress?: number;
  sessionDurationSeconds?: number;
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function PetCompanion({
  isRunning, elapsedSeconds, mode,
  progress = 0,
  sessionDurationSeconds = 1500,
}: PetCompanionProps) {
  const [pet, setPet] = useState<any>(null);
  const [inventory, setInventory] = useState<{ itemId: string; equipped: boolean; type?: string }[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [showXp, setShowXp] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [blinkKey, setBlinkKey] = useState(0);

  const msgIndexRef = useRef(0);
  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPhaseRef = useRef<Phase>("idle");
  const confettiShownRef = useRef(false);
  const blinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch data ─────────────────────────────────────────────────────────────
  function authH() {
    const t = getToken();
    const h: Record<string, string> = {};
    if (t) h["Authorization"] = `Bearer ${t}`;
    return h;
  }

  useEffect(() => {
    const h = authH();
    Promise.all([
      fetch("/api/pets", { headers: h }).then(r => r.json()),
      fetch("/api/marketplace/inventory", { headers: h }).then(r => r.json()),
    ]).then(([pd, id_]) => {
      if (pd.pet) setPet(pd.pet);
      if (id_.inventory) setInventory(id_.inventory);
    }).catch(() => {});
  }, []);

  // Refresh inventory when session ends or after purchases
  useEffect(() => {
    const h = authH();
    fetch("/api/marketplace/inventory", { headers: h })
      .then(r => r.json())
      .then(d => { if (d.inventory) setInventory(d.inventory); })
      .catch(() => {});
  }, [isRunning]);

  // ── Blink every 3–7 seconds ────────────────────────────────────────────────
  useEffect(() => {
    function scheduleBlink() {
      blinkTimerRef.current = setTimeout(() => {
        setBlinkKey(k => k + 1);
        scheduleBlink();
      }, 3000 + Math.random() * 4000);
    }
    scheduleBlink();
    return () => { if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current); };
  }, []);

  // ── Regular speech bubble (every 2 min during session) ────────────────────
  useEffect(() => {
    if (!isRunning || mode !== "focus") return;
    const id = setInterval(() => {
      showMsg(SPEECH_MESSAGES[msgIndexRef.current % SPEECH_MESSAGES.length]!);
      msgIndexRef.current++;
    }, 120_000);
    return () => clearInterval(id);
  }, [isRunning, mode]);

  function showMsg(msg: string, dur = 5000) {
    setMessage(msg);
    if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
    msgTimerRef.current = setTimeout(() => setMessage(null), dur);
  }

  // ── Phase-change reactions ─────────────────────────────────────────────────
  const phase = getPhase(progress, isRunning && mode === "focus");

  useEffect(() => {
    if (phase === prevPhaseRef.current) return;
    prevPhaseRef.current = phase;

    const msgs = PHASE_MESSAGES[phase] ?? SPEECH_MESSAGES;
    showMsg(msgs[Math.floor(Math.random() * msgs.length)]!, 6000);

    if (phase === "complete" && !confettiShownRef.current) {
      confettiShownRef.current = true;
      setShowConfetti(true);
      setShowXp(true);
      setTimeout(() => setShowConfetti(false), 3500);
      setTimeout(() => setShowXp(false), 3000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (isRunning && progress < 0.05) confettiShownRef.current = false;
  }, [isRunning, progress]);

  if (!pet) return null;

  const petEmoji  = PET_EMOJIS[pet.petType] ?? "🦉";
  const petColor  = PET_COLORS[pet.petType] ?? "#7C3AED";
  const accs      = resolveAccessories(inventory);
  const anim      = PHASE_ANIM[phase];
  const dur       = PHASE_DUR[phase];
  const phaseLabel = PHASE_LABELS[phase];

  // Background effect
  const bgColor = accs.bg?.bgColor ?? null;
  // Frame color
  const frameColor = accs.frame?.frameColor ?? null;

  return (
    <div className="flex w-full flex-col items-center gap-2 select-none">

      {/* ── Speech bubble ──────────────────────────────────────────────────── */}
      <div className="relative h-12 flex items-end justify-center pb-1">
        <AnimatePresence mode="wait">
          {message && (
            <motion.div
              key={message}
              initial={{ opacity: 0, y: 8, scale: 0.88 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.92 }}
              transition={{ duration: 0.22 }}
              className="relative rounded-2xl border border-[rgba(124,58,237,0.38)] bg-[rgba(10,12,24,0.97)] px-4 py-2 text-sm font-bold text-[#A78BFA] shadow-2xl backdrop-blur-md whitespace-nowrap max-w-[90vw] text-center"
              style={{ textShadow: "0 0 10px rgba(167,139,250,0.5)" }}
            >
              {message}
              {/* bubble tail */}
              <div className="absolute -bottom-[7px] left-1/2 -translate-x-1/2 w-3.5 h-3.5 rotate-45 bg-[rgba(10,12,24,0.97)] border-b border-r border-[rgba(124,58,237,0.38)]" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Pet body ───────────────────────────────────────────────────────── */}
      <div
        className="relative flex items-center justify-center"
        style={{ width: "min(180px, 45vw)", height: "min(180px, 45vw)" }}
      >
        {/* Confetti */}
        <AnimatePresence>{showConfetti && <ConfettiEffect />}</AnimatePresence>

        {/* XP popup */}
        <AnimatePresence>
          {showXp && <XpReward amount={Math.round(sessionDurationSeconds / 60)} />}
        </AnimatePresence>

        {/* Background glow aura */}
        <motion.div
          className="absolute rounded-full pointer-events-none"
          style={{
            inset: "-30%",
            background: bgColor
              ? `radial-gradient(circle, ${bgColor}, transparent 70%)`
              : `radial-gradient(circle, ${petColor}28, transparent 70%)`,
          }}
          animate={{ opacity: phase === "complete" ? [0.7, 1, 0.7] : [0.4, 0.7, 0.4], scale: [1, 1.12, 1] }}
          transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
        />

        {/* Frame ring */}
        {frameColor && (
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              inset: "-8%",
              border: `3px solid ${frameColor}`,
              boxShadow: `0 0 18px ${frameColor}70, inset 0 0 8px ${frameColor}30`,
            }}
          />
        )}

        {/* Wings (behind pet, z-0) */}
        {accs.wings && (
          <div className="absolute inset-0 flex items-center justify-between pointer-events-none" style={{ left: "-45%", right: "-45%", width: "190%", margin: "0 auto" }}>
            <motion.span
              animate={{ rotate: [-18, -6, -18], y: [0, -4, 0] }}
              transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
              style={{ fontSize: "clamp(22px, 5vw, 38px)", display: "block", lineHeight: 1 }}
            >
              {accs.wings.emoji}
            </motion.span>
            <motion.span
              animate={{ rotate: [18, 6, 18], y: [0, -4, 0] }}
              transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
              style={{ fontSize: "clamp(22px, 5vw, 38px)", display: "block", lineHeight: 1, transform: "scaleX(-1)" }}
            >
              {accs.wings.emoji}
            </motion.span>
          </div>
        )}

        {/* ── Main pet emoji ─────────────────────────────────────────────── */}
        <div className="relative z-10 flex items-center justify-center">
          {/* Breathing layer wraps blink key */}
          <motion.div
            animate={{ scale: [1, 1.035, 1] }}
            transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}
          >
            {/* Blink layer */}
            <motion.div
              key={blinkKey}
              animate={{ scaleY: [1, 0.08, 1] }}
              transition={{ duration: 0.1, times: [0, 0.5, 1] }}
              style={{ transformOrigin: "center" }}
            >
              {/* Phase bounce layer */}
              <motion.div
                animate={anim}
                transition={{ repeat: Infinity, duration: dur, ease: "easeInOut" }}
                className="cursor-pointer leading-none"
                style={{ fontSize: "clamp(80px, 18vw, 130px)" }}
                onClick={() => {
                  showMsg(SPEECH_MESSAGES[msgIndexRef.current % SPEECH_MESSAGES.length]!, 4500);
                  msgIndexRef.current++;
                }}
                whileHover={{ scale: 1.1, transition: { duration: 0.15 } }}
                whileTap={{ scale: 0.88, transition: { duration: 0.1 } }}
                title="Click your companion!"
              >
                {petEmoji}
              </motion.div>
            </motion.div>
          </motion.div>

          {/* Hat accessory */}
          {accs.hat && (
            <motion.div
              animate={{ y: [0, -2.5, 0] }}
              transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
              className="absolute pointer-events-none"
              style={{
                top: "-22%", left: "50%", transform: "translateX(-50%)",
                fontSize: "clamp(18px, 4vw, 30px)", lineHeight: 1, zIndex: 20,
              }}
            >
              {accs.hat.emoji}
            </motion.div>
          )}

          {/* Glasses accessory */}
          {accs.glasses && (
            <div
              className="absolute pointer-events-none"
              style={{
                top: "24%", left: "50%", transform: "translateX(-50%)",
                fontSize: "clamp(14px, 3vw, 24px)", lineHeight: 1, zIndex: 20,
              }}
            >
              {accs.glasses.emoji}
            </div>
          )}

          {/* Cape / hoodie (below pet) */}
          {accs.back && (
            <div
              className="absolute pointer-events-none"
              style={{
                bottom: "-6%", left: "50%", transform: "translateX(-50%)",
                fontSize: "clamp(16px, 3.5vw, 26px)", lineHeight: 1, zIndex: 5,
              }}
            >
              {accs.back.emoji}
            </div>
          )}
        </div>
      </div>

      {/* ── Pet info row ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mt-1 flex-wrap justify-center">
        <span
          className="rounded-full px-2.5 py-0.5 text-[10px] font-black border"
          style={{ color: petColor, borderColor: `${petColor}45`, background: `${petColor}18` }}
        >
          LVL {pet.petLevel}
        </span>
        <p className="text-xs font-semibold text-[#94A3B8]">
          {pet.petName || pet.petType}
        </p>
        <AnimatePresence mode="wait">
          {phaseLabel && (
            <motion.span
              key={phase}
              initial={{ opacity: 0, scale: 0.75, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.25 }}
              className="rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{
                background: phase === "complete" ? "rgba(6,214,160,0.15)" : "rgba(124,58,237,0.12)",
                color:      phase === "complete" ? "#06D6A0" : "#A78BFA",
                border:     `1px solid ${phase === "complete" ? "rgba(6,214,160,0.3)" : "rgba(124,58,237,0.2)"}`,
              }}
            >
              {phaseLabel}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
