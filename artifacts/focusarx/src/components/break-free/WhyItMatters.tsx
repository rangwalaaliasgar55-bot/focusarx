import { useRef } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

const CARDS = [
  {
    icon: "🧠",
    title: "The Dopamine Loop",
    body: "Excessive pornography spikes dopamine far beyond natural levels, dulling your brain's response to everyday rewards like connection, food, or achievement. Over time, ordinary life feels flat — not because it is, but because your reward system has been recalibrated.",
  },
  {
    icon: "📅",
    title: "Your Brain's Timeline",
    body: "Day 7: withdrawal eases and sleep improves. Day 14: focus and mental clarity return. Day 30: motivation rebuilds and energy stabilises. Day 90: your dopamine baseline fully resets — the world becomes vivid again.",
  },
  {
    icon: "❤️",
    title: "Real Relationships Win",
    body: "Studies consistently link high pornography use with reduced intimacy satisfaction, emotional disconnection, and difficulty being present with real people. Quitting doesn't just help you — it deepens your most important relationships.",
  },
  {
    icon: "🙋",
    title: "You Are Not Broken",
    body: "This is one of the most common struggles globally — millions are fighting it silently. It isn't a character flaw. It's a learned response, and learned responses can be unlearned. You reached out. That already took courage.",
  },
];

export default function WhyItMatters() {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scroll(dir: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -300 : 300, behavior: "smooth" });
  }

  return (
    <div className="w-full py-4">
      <div className="flex items-center justify-between px-4 mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--palette-2a4040)]">
          The science
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => scroll("left")}
            className="rounded-lg p-1.5 border border-[var(--palette-teal-900)]/30 text-[var(--palette-teal-700)] hover:text-[var(--palette-teal-400)] transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => scroll("right")}
            className="rounded-lg p-1.5 border border-[var(--palette-teal-900)]/30 text-[var(--palette-teal-700)] hover:text-[var(--palette-teal-400)] transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto px-4 pb-2 scrollbar-none"
        style={{ scrollbarWidth: "none" }}
      >
        {CARDS.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
            className="shrink-0 w-72 rounded-2xl border border-[var(--palette-teal-900)]/25 bg-[var(--palette-061212)] p-5"
          >
            <div className="text-3xl mb-3">{card.icon}</div>
            <h4 className="text-sm font-bold text-[var(--palette-teal-100)] mb-2">{card.title}</h4>
            <p className="text-xs text-[var(--palette-teal-700)] leading-relaxed">{card.body}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
