"use client";

import { motion } from "framer-motion";
import { Pause, Play, RotateCcw, SkipForward, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TimerMode, TimerStatus } from "@/types/timer";

interface MobileTimerControlsProps {
  status: TimerStatus;
  mode: TimerMode;
  onToggle: () => void;
  onReset: () => void;
  onSkip: () => void;
  onCompleteEarly?: () => void;
  isSaving?: boolean;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
}

export function MobileTimerControls({
  status,
  mode,
  onToggle,
  onReset,
  onSkip,
  onCompleteEarly,
  isSaving,
  soundEnabled,
  onToggleSound,
}: MobileTimerControlsProps) {
  const isRunning = status === "running";
  const isPaused = status === "paused";
  const isIdle = status === "idle";

  return (
    <div className="mt-6 flex w-full max-w-[20rem] flex-col items-center gap-4">
      {/* Primary Start/Pause - one obvious button, large, 44px+ */}
      <motion.button
        type="button"
        onClick={onToggle}
        disabled={isSaving}
        whileTap={{ scale: 0.96 }}
        className={cn(
          "relative flex min-h-[64px] w-full items-center justify-center gap-3 rounded-full",
          "text-base font-bold text-white shadow-xl",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand-500)]/40",
          "disabled:opacity-60",
          isRunning
            ? "bg-gradient-to-br from-[var(--brand-500)] to-[var(--brand-700)]"
            : "bg-gradient-to-br from-[var(--brand-500)] to-[var(--brand-700)]"
        )}
        style={{
          boxShadow: `0 0 0 8px var(--brand-soft), 0 12px 32px rgba(124,58,237,0.35)`,
        }}
        aria-label={isRunning ? "Pause focus session" : isPaused ? "Resume focus session" : "Start focus session"}
      >
        {isRunning ? (
          <>
            <Pause size={22} fill="currentColor" />
            <span>Pause</span>
          </>
        ) : isPaused ? (
          <>
            <Play size={22} fill="currentColor" className="ml-0.5" />
            <span>Resume</span>
          </>
        ) : (
          <>
            <Play size={22} fill="currentColor" className="ml-0.5" />
            <span>Start focusing</span>
          </>
        )}
      </motion.button>

      {/* Secondary row - Finish separated from Pause, sound controls */}
      <div className="flex w-full items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            disabled={isSaving}
            className="grid min-h-[44px] min-w-[44px] place-items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--foreground-subtle)] hover:text-[var(--foreground)] disabled:opacity-50"
            aria-label="Reset timer"
          >
            <RotateCcw size={18} />
          </button>
          {onToggleSound && (
            <button
              type="button"
              onClick={onToggleSound}
              className="grid min-h-[44px] min-w-[44px] place-items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--foreground-subtle)] hover:text-[var(--foreground)]"
              aria-label={soundEnabled ? "Mute sounds" : "Enable sounds"}
            >
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {mode === "focus" && !isIdle && onCompleteEarly && (
            <button
              type="button"
              onClick={onCompleteEarly}
              disabled={isSaving}
              className="min-h-[44px] rounded-full border border-[var(--success)]/30 bg-[var(--success-soft)] px-4 py-2 text-xs font-bold text-[var(--success)] hover:bg-[var(--success)]/20 disabled:opacity-50"
            >
              Finish
            </button>
          )}
          <button
            type="button"
            onClick={onSkip}
            disabled={isSaving}
            className="grid min-h-[44px] min-w-[44px] place-items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--foreground-subtle)] hover:text-[var(--foreground)] disabled:opacity-50"
            aria-label="Skip to next"
          >
            <SkipForward size={18} />
          </button>
        </div>
      </div>

      {/* Hint */}
      <p className="text-center text-[11px] text-[var(--foreground-subtle)]">
        {isRunning ? "Stay focused — screen will stay awake" : isPaused ? "Paused — tap Resume to continue" : "Choose a task and start your first block"}
      </p>
    </div>
  );
}
