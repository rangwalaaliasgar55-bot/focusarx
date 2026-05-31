import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

export default function HeroBanner({ onStart }: { onStart: () => void }) {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem("hasCompletedFirstSession") === "true"
  );

  if (dismissed) return null;

  const pills = [
    { icon: "🎯", label: "AI Focus Monitor" },
    { icon: "🗺️", label: "Personalized Roadmap" },
    { icon: "🏆", label: "Leaderboard" },
    { icon: "⚡", label: "Deep Work Streaks" },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        transition={{ duration: 0.5 }}
        className="w-full rounded-2xl border border-[rgba(124,58,237,0.25)] bg-gradient-to-br from-[rgba(124,58,237,0.12)] to-[rgba(79,70,229,0.06)] p-6 mb-2 relative overflow-hidden"
      >
        {/* Background glow */}
        <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(124,58,237,0.15),transparent_70%)] blur-2xl" />

        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#7C3AED] mb-2">Welcome to FocusArx</p>
        <h2 className="text-xl font-black text-[#E2E8F0] mb-1 leading-tight">
          Don't just study harder.<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#A78BFA] to-[#818CF8]">Study smarter.</span>
        </h2>
        <p className="text-xs text-[#4B5563] mb-4">AI tracks your focus, builds your roadmap, and keeps you accountable.</p>

        <div className="flex flex-wrap gap-2 mb-5">
          {pills.map(p => (
            <span key={p.label} className="flex items-center gap-1.5 rounded-full border border-[rgba(124,58,237,0.25)] bg-[rgba(124,58,237,0.1)] px-3 py-1 text-[11px] font-medium text-[#A78BFA]">
              {p.icon} {p.label}
            </span>
          ))}
        </div>

        <button
          onClick={() => {
            localStorage.setItem("hasCompletedFirstSession", "true");
            setDismissed(true);
            onStart();
          }}
          className="rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] px-6 py-2.5 text-sm font-bold text-white hover:opacity-90 transition-opacity shadow-lg shadow-[rgba(124,58,237,0.3)]"
        >
          Start Your First Session →
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
