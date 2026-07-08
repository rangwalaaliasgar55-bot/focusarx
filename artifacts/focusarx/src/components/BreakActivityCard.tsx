import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { TimerMode } from "@/types/timer";

const ACTIVITIES = [
  {
    icon: "💧",
    title: "Hydrate",
    instruction: "Drink a full glass of water",
    tip: "Staying hydrated sharpens focus and reduces fatigue.",
    color: "#38bdf8",
    bg: "rgba(56,189,248,0.08)",
    border: "rgba(56,189,248,0.2)",
  },
  {
    icon: "🧘",
    title: "Box Breathe",
    instruction: "Inhale 4s · Hold 4s · Exhale 4s · Hold 4s",
    tip: "Resets your nervous system and clears mental fog.",
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.08)",
    border: "rgba(167,139,250,0.2)",
  },
  {
    icon: "🤸",
    title: "Stretch",
    instruction: "Roll your neck, stretch your shoulders and back",
    tip: "Sitting hunched compresses your spine. Fix it now.",
    color: "#34d399",
    bg: "rgba(52,211,153,0.08)",
    border: "rgba(52,211,153,0.2)",
  },
  {
    icon: "👁️",
    title: "Eye Rest",
    instruction: "Look at something 20 ft away for 20 seconds",
    tip: "The 20-20-20 rule prevents digital eye strain.",
    color: "#fbbf24",
    bg: "rgba(251,191,36,0.08)",
    border: "rgba(251,191,36,0.2)",
  },
  {
    icon: "🚶",
    title: "Walk",
    instruction: "Take a short stroll — even just around the room",
    tip: "Movement resets your brain for the next focus block.",
    color: "#f97316",
    bg: "rgba(249,115,22,0.08)",
    border: "rgba(249,115,22,0.2)",
  },
  {
    icon: "😌",
    title: "Relax",
    instruction: "Close your eyes, drop your shoulders, breathe slow",
    tip: "True rest between sessions amplifies your next block.",
    color: "#ec4899",
    bg: "rgba(236,72,153,0.08)",
    border: "rgba(236,72,153,0.2)",
  },
];

function useBreathingAnimation(active: boolean) {
  const [phase, setPhase] = useState<"inhale" | "hold1" | "exhale" | "hold2">("inhale");
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    if (!active) return;
    const durations = { inhale: 4000, hold1: 4000, exhale: 4000, hold2: 4000 };
    const phases: Array<"inhale" | "hold1" | "exhale" | "hold2"> = ["inhale", "hold1", "exhale", "hold2"];
    const timeout = setTimeout(() => {
      const next = (phaseIndex + 1) % 4;
      setPhaseIndex(next);
      setPhase(phases[next]!);
    }, durations[phase]);
    return () => clearTimeout(timeout);
  }, [active, phase, phaseIndex]);

  const scale = phase === "inhale" ? 1.25 : phase === "hold1" ? 1.25 : phase === "exhale" ? 0.85 : 0.85;
  const label = phase === "inhale" ? "Inhale" : phase === "hold1" ? "Hold" : phase === "exhale" ? "Exhale" : "Hold";
  return { scale, label };
}

function CountdownRing({ secondsLeft, totalSeconds, color }: { secondsLeft: number; totalSeconds: number; color: string }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const progress = totalSeconds > 0 ? secondsLeft / totalSeconds : 1;
  const dash = circ * progress;

  const m = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
  const s = (secondsLeft % 60).toString().padStart(2, "0");

  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg width="52" height="52" viewBox="0 0 52 52">
        <circle cx="26" cy="26" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
        <circle
          cx="26" cy="26" r={r} fill="none"
          stroke={color} strokeWidth="3"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          transform="rotate(-90 26 26)"
          style={{ transition: "stroke-dasharray 0.8s ease" }}
        />
        <text x="26" y="30" textAnchor="middle" fontSize="10" fontWeight="700" fill="white" fontFamily="monospace">
          {m}:{s}
        </text>
      </svg>
      <p className="text-[9px] text-zinc-500 uppercase tracking-widest">break left</p>
    </div>
  );
}

interface BreakActivityCardProps {
  mode: TimerMode;
  secondsLeft: number;
  breakDurationSeconds: number;
}

export default function BreakActivityCard({ mode, secondsLeft, breakDurationSeconds }: BreakActivityCardProps) {
  const [activityIndex, setActivityIndex] = useState(0);
  const isBreathingActivity = ACTIVITIES[activityIndex]?.title === "Box Breathe";
  const { scale, label } = useBreathingAnimation(isBreathingActivity);

  useEffect(() => {
    const idx = Math.floor(Math.random() * ACTIVITIES.length);
    setActivityIndex(idx);
  }, [mode]);

  const activity = ACTIVITIES[activityIndex]!;
  const isLong = mode === "longBreak";

  return (
    <AnimatePresence>
      <motion.div
        key={activityIndex}
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.97 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-md rounded-2xl border p-5"
        style={{
          background: activity.bg,
          borderColor: activity.border,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{activity.icon}</span>
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                  {isLong ? "Long Break" : "Break"} Activity
                </p>
                <p className="text-sm font-bold" style={{ color: activity.color }}>{activity.title}</p>
              </div>
            </div>

            {isBreathingActivity ? (
              <div className="flex items-center gap-4 mt-3">
                <motion.div
                  animate={{ scale }}
                  transition={{ duration: 4, ease: "easeInOut" }}
                  className="h-10 w-10 rounded-full shrink-0"
                  style={{ background: `radial-gradient(circle, ${activity.color}55, ${activity.color}11)`, border: `1.5px solid ${activity.color}55` }}
                />
                <div>
                  <p className="text-xs font-semibold" style={{ color: activity.color }}>{label}</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">{activity.instruction}</p>
                </div>
              </div>
            ) : (
              <p className="text-[12px] font-medium text-zinc-200 mb-1">{activity.instruction}</p>
            )}

            <p className="text-[11px] text-zinc-500 mt-2">{activity.tip}</p>
          </div>

          <CountdownRing
            secondsLeft={secondsLeft}
            totalSeconds={breakDurationSeconds}
            color={activity.color}
          />
        </div>

        <div className="mt-4 flex items-center gap-2">
          {ACTIVITIES.map((a, i) => (
            <button
              key={i}
              onClick={() => setActivityIndex(i)}
              className="rounded-full transition-all"
              style={{
                width: i === activityIndex ? 20 : 6,
                height: 6,
                background: i === activityIndex ? activity.color : "rgba(255,255,255,0.1)",
              }}
            />
          ))}
          <button
            onClick={() => setActivityIndex((activityIndex + 1) % ACTIVITIES.length)}
            className="ml-auto text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Next activity →
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
