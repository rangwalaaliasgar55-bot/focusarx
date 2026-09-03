import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Waves } from "lucide-react";

const DISTRACTIONS = [
  { icon: "💧", label: "Drink cold water", sub: "Stand up, go to the kitchen, drink a full glass slowly." },
  { icon: "💪", label: "Do 20 push-ups", sub: "Drop and give 20. Physical effort overrides the urge." },
  { icon: "🚶", label: "Go for a walk", sub: "Step outside, even just around the block. Move your body." },
  { icon: "📞", label: "Call someone you trust", sub: "You don't have to explain why. Just connect with someone." },
];

// 4-7-8 breathing pattern
const BREATHING_PHASES = [
  { label: "Inhale", duration: 4, color: "var(--palette-2dd4bf)" },
  { label: "Hold", duration: 7, color: "var(--brand-400)" },
  { label: "Exhale", duration: 8, color: "var(--info)" },
];

function BreathingCircle() {
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [seconds, setSeconds] = useState(BREATHING_PHASES[0]!.duration);
  const phase = BREATHING_PHASES[phaseIdx]!;
  const totalSec = BREATHING_PHASES[phaseIdx]!.duration;

  useEffect(() => {
    const t = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          setPhaseIdx((i) => (i + 1) % BREATHING_PHASES.length);
          const next = BREATHING_PHASES[(phaseIdx + 1) % BREATHING_PHASES.length]!;
          return next.duration;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phaseIdx]);

  const progress = (totalSec - seconds) / totalSec;
  const isInhale = phase.label === "Inhale";
  const isHold = phase.label === "Hold";
  const circleSize = isInhale ? 1 : isHold ? 1 : 0.65;
  const circumference = 2 * Math.PI * 60;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative flex items-center justify-center">
        <motion.div
          animate={{ scale: circleSize }}
          transition={{ duration: phase.duration, ease: "linear" }}
          className="w-40 h-40 rounded-full"
          style={{ background: `radial-gradient(circle, color-mix(in srgb, ${phase.color} 13%, transparent) 0%, color-mix(in srgb, ${phase.color} 3%, transparent) 100%)`, border: `2px solid color-mix(in srgb, ${phase.color} 27%, transparent)` }}
        />
        <svg className="absolute" width="160" height="160" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r="60" fill="none" stroke={`color-mix(in srgb, ${phase.color} 13%, transparent)`} strokeWidth="4" />
          <motion.circle
            cx="80"
            cy="80"
            r="60"
            fill="none"
            stroke={phase.color}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            transform="rotate(-90 80 80)"
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: totalSec, ease: "linear" }}
            key={`${phaseIdx}-${seconds}`}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-3xl font-bold tabular-nums" style={{ color: phase.color }}>{seconds}</span>
          <span className="text-xs font-semibold tracking-wider" style={{ color: `color-mix(in srgb, ${phase.color} 80%, transparent)` }}>{phase.label}</span>
        </div>
      </div>
      <p className="text-xs text-[var(--palette-4a6060)] text-center">
        4s inhale · 7s hold · 8s exhale
      </p>
    </div>
  );
}

function Countdown({ totalSec, onUnlock }: { totalSec: number; onUnlock: () => void }) {
  const [left, setLeft] = useState(totalSec);

  useEffect(() => {
    const t = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) { clearInterval(t); onUnlock(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [onUnlock]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-5xl font-semibold tabular-nums text-[var(--palette-teal-300)] font-mono">
        {mm}:{ss}
      </span>
      <p className="text-xs text-[var(--palette-3a5050)]">hang on — ride the wave</p>
    </div>
  );
}

export default function UrgeSurfing() {
  const [open, setOpen] = useState(false);
  const [canClose, setCanClose] = useState(false);

  function handleOpen() {
    setOpen(true);
    setCanClose(false);
  }

  return (
    <>
      <div className="flex flex-col items-center py-6 px-4">
        <p className="text-xs text-[var(--palette-3a5050)] mb-4 text-center max-w-xs">
          Urges peak and pass in 5–10 minutes. Use this tool to ride it out.
        </p>
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleOpen}
          className="flex items-center gap-3 rounded-2xl border border-[var(--palette-teal-600)]/30 bg-gradient-to-r from-[var(--palette-teal-900)]/40 to-[var(--palette-blue-900)]/40 px-7 py-4 text-base font-semibold text-[var(--palette-teal-200)] shadow-lg hover:shadow-[var(--palette-teal-900)]/30 transition-shadow"
        >
          <Waves size={20} className="text-[var(--palette-teal-400)]" />
          I'm struggling right now 🌊
        </motion.button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[var(--z-command)] flex flex-col items-center justify-start overflow-y-auto"
            style={{
              background: "linear-gradient(160deg, var(--palette-020e12) 0%, var(--palette-021018) 40%, var(--palette-020c14) 100%)",
            }}
          >
            {/* Close button */}
            <div className="w-full flex justify-end p-4">
              <AnimatePresence>
                {canClose && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-xl border border-[var(--palette-teal-900)]/40 bg-[var(--palette-teal-900)]/20 px-4 py-2 text-sm text-[var(--palette-teal-400)] hover:text-[var(--palette-teal-200)] transition-colors"
                  >
                    <X size={14} /> Close
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            <div className="flex flex-col items-center gap-8 px-6 pb-12 w-full max-w-md">
              <div>
                <h2 className="text-xl font-bold text-[var(--palette-teal-100)] text-center">You're doing great. 🌊</h2>
                <p className="text-sm text-[var(--palette-teal-600)] text-center mt-1">Breathe with this. The wave will pass.</p>
              </div>

              {/* Breathing */}
              <BreathingCircle />

              {/* Countdown */}
              <Countdown totalSec={300} onUnlock={() => setCanClose(true)} />

              {/* Distraction cards */}
              <div className="w-full">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--palette-2a4040)] mb-3 text-center">
                  Try one of these instead
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {DISTRACTIONS.map((d) => (
                    <div
                      key={d.label}
                      className="rounded-xl border border-[var(--palette-teal-900)]/30 bg-[var(--palette-teal-900)]/10 p-3"
                    >
                      <p className="text-xl mb-1">{d.icon}</p>
                      <p className="text-xs font-semibold text-[var(--palette-teal-200)]">{d.label}</p>
                      <p className="text-[10px] text-[var(--palette-teal-700)] mt-0.5 leading-snug">{d.sub}</p>
                    </div>
                  ))}
                </div>
              </div>

              {!canClose && (
                <p className="text-xs text-[var(--palette-1a3030)] text-center">
                  Close button appears in 60 seconds — stay with it.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
