import { motion } from "framer-motion";
import { useLocation } from "wouter";

const SPECIES_EMOJI: Record<string, string> = {
  owl:     "🦉",
  fox:     "🦊",
  dragon:  "🐉",
  robot:   "🤖",
  cat:     "🐱",
  phoenix: "🦅",
};

interface PetWidgetProps {
  species?: string;
  name?: string;
  level?: number;
  mood?: string;
}

export function PetWidget({ species = "owl", name = "Buddy", level = 1, mood = "happy" }: PetWidgetProps) {
  const [, navigate] = useLocation();
  const emoji = SPECIES_EMOJI[species] ?? "🦉";
  const moodEmoji = mood === "happy" ? "😊" : mood === "hungry" ? "😋" : mood === "sad" ? "😔" : "😐";

  return (
    <motion.button
      onClick={() => navigate("/pets")}
      className="relative flex flex-col items-center gap-1 cursor-pointer group"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      title={`${name} · Lv.${level}`}
    >
      <motion.span
        className="text-5xl select-none"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        {emoji}
      </motion.span>
      <span className="text-xs">{moodEmoji}</span>
      <div className="w-full h-1 bg-white/5 rounded-full mt-1 overflow-hidden">
        <div className="h-full bg-emerald-500 w-2/3" />
      </div>
      <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-black/80 text-white text-[10px] px-2 py-1 rounded-md pointer-events-none">
        {name} · Lv.{level} (66% to next level)
      </div>
    </motion.button>
  );
}
