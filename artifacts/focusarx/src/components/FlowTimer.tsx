/**
 * Flowtime stopwatch (Phase 9.1).
 *
 * No preset slice: work until a natural stopping point, then Finish.
 * A suggested break (~5 min per 25 worked, capped at 30) is shown at the
 * end. Completion flows through the same pipeline as countdown sessions
 * (record → sounds → cloud sync → summary), so XP/streaks behave alike.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Check, Sparkles, Coffee, Flame, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { generateId } from "@/lib/timerUtils";
import { flowSuggestedBreakMin } from "@/lib/sessionPresets";
import { haptic } from "@/lib/haptics";
import { publishFocusState, resetFocusState } from "@/lib/focusSessionBus";
import type { Session } from "@/types/timer";

interface FlowTimerProps {
  taskName?: string;
  onFinish: (session: Session) => void;
  onExitPreset: () => void;
}

function fmt(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function getFlowMilestone(minutes: number): { label: string; icon: React.ReactNode; color: string } | null {
  if (minutes >= 90) return { label: "Ultradian Peak (90m+)", icon: <Flame size={13} />, color: "var(--palette-amber-400)" };
  if (minutes >= 60) return { label: "Gold Flow Block (60m+)", icon: <Zap size={13} />, color: "var(--brand-gold)" };
  if (minutes >= 45) return { label: "Deep Work (45m+)", icon: <Sparkles size={13} />, color: "var(--brand-400)" };
  if (minutes >= 25) return { label: "Classic Block (25m+)", icon: <Check size={13} />, color: "var(--brand-teal)" };
  return null;
}

export default function FlowTimer({ taskName, onFinish, onExitPreset }: FlowTimerProps) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const accRef = useRef(0);

  // Sync with Focus Session Bus & Document Title
  useEffect(() => {
    if (running) {
      publishFocusState({
        mode: "focus",
        status: "running",
        secondsLeft: elapsed,
        totalSeconds: Math.max(elapsed, 1500),
      });
      document.title = `[${fmt(elapsed)} Flow] FocusArx`;
      window.dispatchEvent(new CustomEvent("fx:focus-start"));
    } else {
      if (elapsed > 0) {
        publishFocusState({
          mode: "focus",
          status: "paused",
          secondsLeft: elapsed,
          totalSeconds: Math.max(elapsed, 1500),
        });
        document.title = `[Paused Flow] FocusArx`;
      } else {
        resetFocusState();
        document.title = "FocusArx — Deep work, made clear";
      }
      window.dispatchEvent(new CustomEvent("fx:focus-stop"));
    }
  }, [running, elapsed]);

  // High-precision tick with drift compensation
  useEffect(() => {
    if (!running) return;
    startedAtRef.current = Date.now();
    const id = window.setInterval(() => {
      const base = accRef.current + (Date.now() - (startedAtRef.current ?? Date.now())) / 1000;
      setElapsed(Math.floor(base));
    }, 200);
    return () => {
      window.clearInterval(id);
      if (startedAtRef.current != null) {
        accRef.current += (Date.now() - startedAtRef.current) / 1000;
        startedAtRef.current = null;
      }
    };
  }, [running]);

  const toggle = useCallback(() => {
    if (running) {
      haptic("tap");
      setRunning(false);
    } else {
      haptic("select");
      setRunning(true);
    }
  }, [running]);

  const reset = useCallback(() => {
    setRunning(false);
    setElapsed(0);
    accRef.current = 0;
    startedAtRef.current = null;
    resetFocusState();
  }, []);

  const finish = useCallback(() => {
    const total = startedAtRef.current != null
      ? accRef.current + (Date.now() - startedAtRef.current) / 1000
      : accRef.current;
    const durationSeconds = Math.max(0, Math.floor(total));
    if (durationSeconds < 10) {
      reset();
      return;
    }
    setRunning(false);
    haptic("celebrate");
    onFinish({
      id: generateId(),
      mode: "focus",
      completedAt: new Date().toISOString(),
      durationSeconds,
      focusScore: 100,
      focusQuality: "high",
      focusTimeline: null,
      stabilityRating: "High Stability",
      sessionInsights: {
        summary: `Completed ${Math.floor(durationSeconds / 60)} minutes of continuous flow!`,
        bestFocusPeriod: "All session",
        worstDistractionPeriod: "None",
        totalInterruptions: 0,
        stabilityRating: "High Stability",
      },
    });
    reset();
  }, [onFinish, reset]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        toggle();
      } else if (e.code === "KeyR") {
        e.preventDefault();
        reset();
      } else if (e.code === "KeyF" && elapsed >= 60) {
        e.preventDefault();
        finish();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggle, reset, finish, elapsed]);

  const workedMin = Math.floor(elapsed / 60);
  const milestone = getFlowMilestone(workedMin);
  const suggestedBreak = flowSuggestedBreakMin(workedMin);

  return (
    <div className="relative flex w-full flex-col items-center gap-5 py-4" role="timer" aria-label={`Flowtime elapsed ${fmt(elapsed)}`}>
      {/* Ambient Breathing Glow */}
      <motion.div
        className="pointer-events-none absolute -inset-6 rounded-full"
        style={{
          background: running
            ? "radial-gradient(circle, var(--rgba-124-58-237-0_22) 0%, transparent 70%)"
            : "radial-gradient(circle, var(--rgba-124-58-237-0_08) 0%, transparent 70%)",
          filter: "blur(32px)",
        }}
        animate={running ? { scale: [0.95, 1.06, 0.95], opacity: [0.6, 0.9, 0.6] } : { scale: 1, opacity: 0.3 }}
        transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
      />

      {/* Mode Badge & Active Milestone */}
      <div className="relative z-10 flex flex-wrap items-center justify-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full bg-[var(--brand-soft)] px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[var(--brand-strong)] border border-[var(--brand-500)]/30">
          <Sparkles size={12} /> Flowtime Mode
        </span>
        {milestone && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold border"
            style={{ color: milestone.color, borderColor: `color-mix(in srgb, ${milestone.color} 30%, transparent)`, background: `color-mix(in srgb, ${milestone.color} 12%, transparent)` }}
          >
            {milestone.icon}
            {milestone.label}
          </motion.span>
        )}
      </div>

      {/* Main Stopwatch Face */}
      <div className="relative z-10 flex flex-col items-center">
        <motion.div
          animate={running ? { scale: [1, 1.015, 1] } : { scale: 1 }}
          transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          className="select-none font-display text-[4.5rem] sm:text-[5.25rem] font-semibold leading-none tracking-[-0.055em] tabular-nums text-[var(--foreground)]"
          style={{
            fontFeatureSettings: '"tnum" 1, "ss01" 1',
            textShadow: running ? "0 0 32px var(--rgba-139-92-246-0_35)" : "none",
          }}
          aria-live="polite"
        >
          {fmt(elapsed)}
        </motion.div>

        {taskName ? (
          <p className="mt-2 line-clamp-2 max-w-xs text-center text-sm font-semibold text-[var(--foreground)]">{taskName}</p>
        ) : (
          <p className="mt-2 text-xs text-[var(--foreground-muted)]">Work continuously until you reach a natural stopping point.</p>
        )}
      </div>

      {/* Controls */}
      <div className="relative z-10 flex flex-wrap items-center justify-center gap-3">
        <motion.button
          type="button"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={toggle}
          className={`flex min-h-[54px] min-w-[140px] items-center justify-center gap-2 rounded-full px-6 text-sm font-bold shadow-lg transition-all ${
            running
              ? "bg-[var(--surface-raised)] border border-[var(--border-strong)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
              : "bg-gradient-to-r from-[var(--brand-600)] to-[var(--brand-500)] text-white hover:from-[var(--brand-500)] hover:to-[var(--brand-400)] shadow-[0_8px_24px_-6px_var(--rgba-124-58-237-0_5)]"
          }`}
          aria-label={running ? "Pause flowtime" : elapsed > 0 ? "Resume flowtime" : "Start flowtime"}
        >
          {running ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
          <span>{running ? "Pause" : elapsed > 0 ? "Resume" : "Start Flow"}</span>
        </motion.button>

        <button
          type="button"
          onClick={reset}
          title="Reset Stopwatch (R)"
          className="grid min-h-[46px] min-w-[46px] place-items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition"
          aria-label="Reset flowtime"
        >
          <RotateCcw size={16} />
        </button>

        <AnimatePresence>
          {elapsed >= 60 && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.85, x: -6 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.85 }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={finish}
              className="flex min-h-[46px] items-center gap-1.5 rounded-full bg-[var(--success-soft)] border border-[var(--success)]/40 px-5 text-xs font-bold text-[var(--success)] hover:bg-[var(--success)]/20 shadow-md transition"
              title="Finish flow session and earn XP (F)"
            >
              <Check size={16} /> Finish Session
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Suggested Break Pill */}
      {elapsed >= 60 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3.5 py-1 text-xs text-[var(--foreground-muted)]"
        >
          <Coffee size={13} className="text-[var(--brand-teal)]" />
          <span>Suggested break after this block: <strong className="text-[var(--foreground)] font-semibold">{suggestedBreak} min</strong></span>
        </motion.div>
      )}

      {/* Back to presets */}
      <button
        type="button"
        onClick={onExitPreset}
        className="relative z-10 text-[11px] font-semibold text-[var(--foreground-subtle)] hover:text-[var(--foreground)] underline-offset-2 hover:underline transition-colors"
      >
        ← Back to Pomodoro & timed presets
      </button>
    </div>
  );
}
