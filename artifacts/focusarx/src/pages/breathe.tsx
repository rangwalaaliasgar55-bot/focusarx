import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { Wind } from "lucide-react";

type BreathMode = {
  id: string;
  label: string;
  description: string;
  phases: { label: string; seconds: number; color: string }[];
};

const MODES: BreathMode[] = [
  {
    id: "box",
    label: "Box Breathing",
    description: "4-4-4-4 — Balance stress response",
    phases: [
      { label: "Inhale",  seconds: 4, color: "#7C3AED" },
      { label: "Hold",    seconds: 4, color: "#A78BFA" },
      { label: "Exhale",  seconds: 4, color: "#4F46E5" },
      { label: "Hold",    seconds: 4, color: "#6366F1" },
    ],
  },
  {
    id: "deep_calm",
    label: "Deep Calm",
    description: "4-7-8 — Activate the relaxation response",
    phases: [
      { label: "Inhale",  seconds: 4, color: "#0EA5E9" },
      { label: "Hold",    seconds: 7, color: "#38BDF8" },
      { label: "Exhale",  seconds: 8, color: "#0284C7" },
    ],
  },
  {
    id: "quick_reset",
    label: "Quick Reset",
    description: "2-2-2 — Fast energize before a session",
    phases: [
      { label: "Inhale",  seconds: 2, color: "#10B981" },
      { label: "Hold",    seconds: 2, color: "#34D399" },
      { label: "Exhale",  seconds: 2, color: "#059669" },
    ],
  },
];

function BreathingCircle({
  phase,
  progress,
  totalSeconds,
}: {
  phase: { label: string; seconds: number; color: string };
  progress: number;
  totalSeconds: number;
}) {
  const isInhale = phase.label === "Inhale";
  const isHold = phase.label === "Hold";
  const scale = isInhale ? 0.6 + progress * 0.4 : isHold ? 1 : 1 - progress * 0.4;
  const secondsLeft = Math.ceil(phase.seconds * (1 - progress));

  return (
    <div className="relative flex items-center justify-center" style={{ width: 280, height: 280 }}>
      {/* Outer ring */}
      <svg className="absolute inset-0" width={280} height={280}>
        <circle
          cx={140}
          cy={140}
          r={130}
          fill="none"
          stroke={`${phase.color}18`}
          strokeWidth={2}
        />
        <circle
          cx={140}
          cy={140}
          r={130}
          fill="none"
          stroke={phase.color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={2 * Math.PI * 130}
          strokeDashoffset={2 * Math.PI * 130 * (1 - progress)}
          transform="rotate(-90 140 140)"
          style={{ transition: "stroke-dashoffset 0.1s linear" }}
        />
      </svg>

      {/* Breathing circle */}
      <motion.div
        className="rounded-full flex items-center justify-center"
        animate={{ scale }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        style={{
          width: 180,
          height: 180,
          background: `radial-gradient(circle at 40% 35%, ${phase.color}40, ${phase.color}18)`,
          border: `1.5px solid ${phase.color}44`,
          boxShadow: `0 0 40px ${phase.color}22, 0 0 80px ${phase.color}11`,
        }}
      >
        <div className="text-center">
          <p className="text-3xl font-bold text-white">{secondsLeft}</p>
          <p className="text-sm font-medium" style={{ color: phase.color }}>{phase.label}</p>
        </div>
      </motion.div>
    </div>
  );
}

export default function BreathePage() {
  const [selectedMode, setSelectedMode] = useState<BreathMode>(MODES[0]!);
  const [running, setRunning] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [cycles, setCycles] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tick = 50; // ms

  const phase = selectedMode.phases[phaseIdx % selectedMode.phases.length]!;
  const progress = Math.min(1, elapsed / (phase.seconds * 1000));

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setElapsed((e) => {
        const limit = phase.seconds * 1000;
        if (e + tick >= limit) {
          setPhaseIdx((p) => {
            const next = (p + 1) % selectedMode.phases.length;
            if (next === 0) setCycles((c) => c + 1);
            return next;
          });
          return 0;
        }
        return e + tick;
      });
    }, tick);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, phaseIdx, phase.seconds, selectedMode]);

  const stop = () => {
    setRunning(false);
    setPhaseIdx(0);
    setElapsed(0);
  };

  const switchMode = (mode: BreathMode) => {
    stop();
    setSelectedMode(mode);
    setCycles(0);
  };

  return (
    <div className="relative min-h-[100dvh] overflow-hidden forge-bg-glow flex flex-col">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.06),transparent_68%)] blur-3xl" />
      </div>

      <main className="relative z-10 mx-auto max-w-xl px-4 py-10 flex-1 flex flex-col">
        <PageTransition>
          <header className="mb-8">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#4B5563]">Recovery</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-[#E2E8F0] sm:text-3xl">
              <Wind size={22} className="text-[#A78BFA]" /> Breathe
            </h1>
            <p className="mt-1 text-sm text-[#4B5563]">Micro-recovery between sessions. Activate your rest response.</p>
          </header>

          {/* Mode selector */}
          <div className="grid grid-cols-3 gap-2 mb-8">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => switchMode(m)}
                className={`rounded-xl p-3 text-left border transition-all ${selectedMode.id === m.id ? "border-[rgba(124,58,237,0.5)] bg-[rgba(124,58,237,0.12)]" : "border-[rgba(124,58,237,0.12)] bg-[rgba(124,58,237,0.04)] hover:bg-[rgba(124,58,237,0.08)]"}`}
              >
                <p className="text-xs font-semibold text-[#E2E8F0] leading-tight">{m.label}</p>
                <p className="text-[9px] text-[#4B5563] mt-0.5">{m.description.split("—")[0]}</p>
              </button>
            ))}
          </div>

          {/* Breathing circle */}
          <div className="flex flex-col items-center gap-6 flex-1 justify-center">
            <BreathingCircle phase={phase} progress={progress} totalSeconds={phase.seconds} />

            {cycles > 0 && (
              <p className="text-xs text-[#4B5563]">
                {cycles} cycle{cycles !== 1 ? "s" : ""} complete
              </p>
            )}

            <div className="flex gap-3 mt-2">
              <button
                onClick={() => running ? stop() : setRunning(true)}
                className="rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] px-8 py-3 text-sm font-semibold text-white shadow-[0_0_20px_rgba(124,58,237,0.3)] transition-all hover:shadow-[0_0_30px_rgba(124,58,237,0.5)]"
              >
                {running ? "Stop" : "Start"}
              </button>
              {running && (
                <button
                  onClick={stop}
                  className="rounded-xl border border-[rgba(124,58,237,0.2)] px-5 py-3 text-sm text-[#6B7280] hover:text-[#94A3B8]"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Phase timeline */}
            <div className="flex items-center gap-2">
              {selectedMode.phases.map((p, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: p.seconds * 8,
                      background: (phaseIdx % selectedMode.phases.length) === i && running ? p.color : `${p.color}30`,
                    }}
                  />
                  <span className="text-[9px] text-[#4B5563]">{p.label} {p.seconds}s</span>
                </div>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="mt-8 rounded-2xl border border-[rgba(124,58,237,0.12)] bg-[rgba(124,58,237,0.04)] p-4 text-center">
            <p className="text-xs text-[#94A3B8]">{selectedMode.description}</p>
          </div>
        </PageTransition>
      </main>
    </div>
  );
}
