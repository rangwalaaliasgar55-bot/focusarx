/**
 * Flowtime stopwatch (Phase 9.1).
 *
 * No preset slice: work until a natural stopping point, then Finish.
 * A suggested break (~5 min per 25 worked, capped at 30) is shown at the
 * end. Completion flows through the same pipeline as countdown sessions
 * (record → sounds → cloud sync → summary), so XP/streaks behave alike.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Check } from "lucide-react";
import { generateId } from "@/lib/timerUtils";
import { flowSuggestedBreakMin } from "@/lib/sessionPresets";
import { haptic } from "@/lib/haptics";
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

export default function FlowTimer({ taskName, onFinish, onExitPreset }: FlowTimerProps) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const accRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    startedAtRef.current = Date.now();
    const id = window.setInterval(() => {
      const base = accRef.current + (Date.now() - (startedAtRef.current ?? Date.now())) / 1000;
      setElapsed(Math.floor(base));
    }, 250);
    return () => {
      window.clearInterval(id);
      if (startedAtRef.current != null) {
        accRef.current += (Date.now() - startedAtRef.current) / 1000;
        startedAtRef.current = null;
      }
    };
  }, [running]);

  const toggle = useCallback(() => {
    if (running) haptic("tap");
    else haptic("select");
    setRunning((r) => !r);
  }, [running]);

  const reset = useCallback(() => {
    setRunning(false);
    setElapsed(0);
    accRef.current = 0;
    startedAtRef.current = null;
  }, []);

  const finish = useCallback(() => {
    const total = startedAtRef.current != null
      ? accRef.current + (Date.now() - startedAtRef.current) / 1000
      : accRef.current;
    const durationSeconds = Math.floor(total);
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
      focusScore: null,
      focusQuality: null,
      focusTimeline: null,
      stabilityRating: null,
      sessionInsights: null,
    });
    reset();
  }, [onFinish, reset]);

  const workedMin = Math.floor(elapsed / 60);

  return (
    <div className="flex w-full flex-col items-center gap-4 py-4" role="timer" aria-label={`Flowtime elapsed ${fmt(elapsed)}`}>
      <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[var(--brand-strong)]">
        Flowtime
      </span>
      <div className="select-none font-mono text-[4.5rem] font-semibold leading-none tracking-[-0.05em] tabular-nums" aria-live="polite">
        {fmt(elapsed)}
      </div>
      {taskName ? (
        <p className="line-clamp-2 max-w-xs text-center text-sm font-medium">{taskName}</p>
      ) : (
        <p className="text-xs text-[var(--foreground-subtle)]">Work until a natural stopping point.</p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          className="flex min-h-[56px] min-w-[56px] items-center justify-center rounded-full bg-[var(--brand-600)] px-6 font-bold text-white active:scale-[0.97]"
          aria-label={running ? "Pause flowtime" : elapsed > 0 ? "Resume flowtime" : "Start flowtime"}
        >
          {running ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" className="ml-0.5" />}
          <span className="ml-2">{running ? "Pause" : elapsed > 0 ? "Resume" : "Start"}</span>
        </button>
        <button
          type="button"
          onClick={reset}
          className="grid min-h-[44px] min-w-[44px] place-items-center rounded-full border border-[var(--border-subtle)] text-[var(--foreground-subtle)]"
          aria-label="Reset flowtime"
        >
          <RotateCcw size={18} />
        </button>
        {elapsed >= 60 && (
          <button
            type="button"
            onClick={finish}
            className="flex min-h-[44px] items-center gap-1.5 rounded-full bg-[var(--success-soft)] px-5 text-xs font-bold text-[var(--success)]"
          >
            <Check size={16} /> Finish
          </button>
        )}
      </div>
      {elapsed >= 60 && (
        <p className="text-xs text-[var(--foreground-subtle)]">
          Suggested break: {flowSuggestedBreakMin(workedMin)} min.
        </p>
      )}
      <button
        type="button"
        onClick={onExitPreset}
        className="text-[11px] font-medium text-[var(--foreground-subtle)] underline-offset-2 hover:underline"
      >
        Back to timed presets
      </button>
    </div>
  );
}
