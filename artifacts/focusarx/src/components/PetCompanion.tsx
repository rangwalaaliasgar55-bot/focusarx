import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getToken } from "@/lib/auth";

const PET_MESSAGES = [
  "You're doing great! 🌟",
  "Keep focusing! 💪",
  "Another 10 minutes! ⏱️",
  "Your streak is growing! 🔥",
  "Let's finish this session! 🎯",
  "I believe in you! ✨",
  "Stay locked in! 🧠",
  "You're unstoppable! 🚀",
  "Almost there! Keep going! 💎",
  "Every minute counts! ⚡",
];

const PET_EMOJIS: Record<string, string> = {
  owl: "🦉", fox: "🦊", dragon: "🐲", robot: "🤖", cat: "🐱", phoenix: "🦅",
};

const ANIMATIONS = {
  happy: { y: [0, -6, 0], rotate: [0, 3, -3, 0] },
  excited: { y: [0, -10, 0, -8, 0], scale: [1, 1.1, 1] },
  focus: { y: [0, -3, 0], scale: [1, 1.02, 1] },
  celebrate: { y: [0, -12, 0], rotate: [0, 10, -10, 0], scale: [1, 1.15, 1] },
  cheer: { y: [0, -8, 0, -6, 0], x: [-2, 2, -2, 2, 0] },
  wave: { rotate: [0, 15, -5, 15, 0], scale: [1, 1.05, 1] },
};

function authHeaders() {
  const t = getToken();
  const h: Record<string, string> = {};
  if (t) h["Authorization"] = `Bearer ${t}`;
  return h;
}

interface PetCompanionProps {
  isRunning: boolean;
  elapsedSeconds: number;
  mode: "focus" | "break" | "longBreak";
}

export default function PetCompanion({ isRunning, elapsedSeconds, mode }: PetCompanionProps) {
  const [pet, setPet] = useState<any>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const [animationType, setAnimationType] = useState<keyof typeof ANIMATIONS>("happy");
  const [visible, setVisible] = useState(true);
  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageIndexRef = useRef(0);

  useEffect(() => {
    fetch("/api/pets", { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.pet) setPet(d.pet); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!pet || !isRunning || mode !== "focus") return;
    const interval = setInterval(() => {
      const idx = messageIndexRef.current % PET_MESSAGES.length;
      setMessage(PET_MESSAGES[idx]!);
      messageIndexRef.current++;

      const anims: (keyof typeof ANIMATIONS)[] = ["happy", "excited", "focus", "cheer", "wave"];
      setAnimationType(anims[Math.floor(Math.random() * anims.length)]!);
      setAnimKey(k => k + 1);

      if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
      msgTimerRef.current = setTimeout(() => setMessage(null), 4000);
    }, 120000); // every 2 minutes

    return () => clearInterval(interval);
  }, [pet, isRunning, mode]);

  useEffect(() => {
    if (!pet || !isRunning || mode !== "focus") return;
    if (elapsedSeconds > 0 && elapsedSeconds % 600 === 0) {
      setMessage("You're doing great! 🌟");
      setAnimationType("celebrate");
      setAnimKey(k => k + 1);
      if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
      msgTimerRef.current = setTimeout(() => setMessage(null), 5000);
    }
  }, [elapsedSeconds, pet, isRunning, mode]);

  if (!pet) return null;

  const emoji = PET_EMOJIS[pet.petType] ?? "🦉";
  const anim = ANIMATIONS[animationType];
  const moodEmoji = mode === "focus" ? (isRunning ? "😤" : "😌") : "😊";

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <div className="relative">
        <motion.div
          key={animKey}
          animate={isRunning ? anim : { y: [0, -2, 0] }}
          transition={{
            repeat: Infinity,
            duration: isRunning ? 2 : 4,
            ease: "easeInOut",
          }}
          className="text-5xl cursor-pointer"
          onClick={() => {
            const idx = messageIndexRef.current % PET_MESSAGES.length;
            setMessage(PET_MESSAGES[idx]!);
            messageIndexRef.current++;
            setAnimationType("excited");
            setAnimKey(k => k + 1);
            if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
            msgTimerRef.current = setTimeout(() => setMessage(null), 4000);
          }}
          title="Click your pet!"
        >
          {emoji}
        </motion.div>
        <span className="absolute -bottom-1 -right-1 text-base">{moodEmoji}</span>
      </div>

      <div className="text-center">
        <p className="text-[10px] text-[#4B5563] font-medium leading-tight">
          {pet.petName || pet.petType}
        </p>
        <p className="text-[9px] text-[#374151]">Lv.{pet.petLevel}</p>
      </div>

      <AnimatePresence>
        {message && (
          <motion.div
            key={message}
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-50 whitespace-nowrap rounded-xl border border-[rgba(124,58,237,0.3)] bg-[rgba(13,15,28,0.95)] px-3 py-2 text-xs font-medium text-[#A78BFA] shadow-lg backdrop-blur-sm"
            style={{ pointerEvents: "none" }}
          >
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45 bg-[rgba(13,15,28,0.95)] border-b border-r border-[rgba(124,58,237,0.3)]" />
            {message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
