"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Volume2, VolumeX, Pause, Play, Music, Timer } from "lucide-react";
import { useWakeLock } from "@/hooks/useWakeLock";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

interface MobileFocusModeProps {
  isActive: boolean;
  mode: "focus" | "break" | "longBreak";
  secondsLeft: number;
  progress: number;
  taskName?: string;
  sessionNumber?: number;
  totalSessions?: number;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  isRunning: boolean;
  ambientSoundEnabled?: boolean;
  onToggleSound?: () => void;
}

function formatTimeDisplay(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function MobileFocusMode({
  isActive,
  mode,
  secondsLeft,
  progress,
  taskName,
  sessionNumber = 1,
  totalSessions = 4,
  onPause,
  onResume,
  onEnd,
  isRunning,
  ambientSoundEnabled,
  onToggleSound,
}: MobileFocusModeProps) {
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const { supported: wakeLockSupported, isLocked } = useWakeLock(isActive && isRunning);

  // Prevent accidental back navigation
  useEffect(() => {
    if (!isActive) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isActive]);

  const handleEndRequest = useCallback(() => {
    haptic("tap");
    setShowExitConfirm(true);
  }, []);

  const handleConfirmEnd = useCallback(() => {
    haptic("error");
    setShowExitConfirm(false);
    onEnd();
  }, [onEnd]);

  if (!isActive) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[var(--z-focus-overlay)] flex flex-col bg-[var(--background)] md:hidden"
        data-focus-mode="active"
        role="dialog"
        aria-modal="true"
        aria-label="Focus mode"
        style={{ minHeight: "100dvh" }}
      >
        {/* Header - minimal */}
        <div className="flex items-center justify-between p-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={handleEndRequest}
            className="flex items-center gap-1.5 rounded-full bg-[var(--surface-1)] px-3 py-2 text-xs font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
            aria-label="Exit focus mode"
          >
            <X size={16} />
            Exit
          </button>
          <div className="flex items-center gap-2">
            {wakeLockSupported && (
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest",
                  isLocked ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--surface-1)] text-[var(--foreground-subtle)]"
                )}
                title={isLocked ? "Screen will stay awake" : "Screen may dim"}
              >
                {isLocked ? "Awake" : "Dim ok"}
              </span>
            )}
            {onToggleSound && (
              <button
                type="button"
                onClick={onToggleSound}
                className="grid h-9 w-9 place-items-center rounded-full bg-[var(--surface-1)] text-[var(--foreground-subtle)] hover:text-[var(--foreground)]"
                aria-label={ambientSoundEnabled ? "Mute ambient sound" : "Enable ambient sound"}
              >
                {ambientSoundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
            )}
          </div>
        </div>

        {/* Main content - very large timer, minimal */}
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-8">
          {/* Mode indicator */}
          <div className="mb-6 flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--brand-500)]" />
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--brand-strong)]">
              {mode === "focus" ? "Deep Work" : mode === "break" ? "Break" : "Long Break"}
            </span>
          </div>

          {/* Huge timer */}
          <motion.div
            key={Math.floor(secondsLeft / 60)}
            initial={{ scale: 0.95, opacity: 0.8 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative"
          >
            <div
              className="font-mono text-[5.5rem] font-black leading-none tracking-[-0.05em] sm:text-[6rem]"
              style={{
                backgroundImage: `linear-gradient(135deg, var(--foreground), var(--brand-400))`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
              aria-live="off"
              aria-atomic="true"
            >
              {formatTimeDisplay(secondsLeft)}
            </div>
            {/* Subtle progress ring */}
            <svg className="pointer-events-none absolute inset-0 -z-10 h-full w-full" viewBox="0 0 100 100" aria-hidden="true">
              <circle cx="50" cy="50" r="48" fill="none" stroke="var(--border-subtle)" strokeWidth="0.5" />
              <circle
                cx="50"
                cy="50"
                r="48"
                fill="none"
                stroke="var(--brand-500)"
                strokeWidth="1"
                strokeDasharray={`${progress * 301} 301`}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
                className="transition-all duration-1000"
                opacity={0.3}
              />
            </svg>
          </motion.div>

          {/* Pause/Resume - one obvious button */}
          <div className="mt-10">
            <button
              type="button"
              onClick={isRunning ? onPause : onResume}
              className={cn(
                "grid h-20 w-20 place-items-center rounded-full text-white shadow-xl transition-transform active:scale-95",
                "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand-500)]/40"
              )}
              style={{
                background: isRunning
                  ? "linear-gradient(135deg, var(--brand-500), var(--brand-700))"
                  : "linear-gradient(135deg, var(--success), #059669)",
                boxShadow: `0 0 0 8px ${isRunning ? "var(--brand-soft)" : "var(--success-soft)"}, 0 12px 32px rgba(0,0,0,0.3)`,
              }}
              aria-label={isRunning ? "Pause focus session" : "Resume focus session"}
            >
              {isRunning ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
            </button>
          </div>

          {/* Task context - clearly visible */}
          {taskName && (
            <div className="mt-8 max-w-[20rem] text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--foreground-subtle)]">Focusing on</p>
              <p className="mt-1 truncate text-base font-medium text-[var(--foreground)]">{taskName}</p>
            </div>
          )}

          {/* Session dots */}
          <div className="mt-6 flex items-center gap-2">
            <span className="text-xs text-[var(--foreground-subtle)]">
              Session {sessionNumber} of {totalSessions}
            </span>
            <div className="flex gap-1.5">
              {Array.from({ length: totalSessions }).map((_, i) => (
                <span
                  key={i}
                  className={cn("h-1.5 w-1.5 rounded-full transition-colors", i < sessionNumber ? "bg-[var(--brand-500)]" : "bg-[var(--border-strong)]")}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Bottom controls - separated */}
        <div className="flex items-center justify-between gap-3 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onToggleSound}
            className="flex min-h-[44px] items-center gap-2 rounded-full bg-[var(--surface-1)] px-4 py-2.5 text-sm font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
          >
            <Music size={16} />
            <span className="hidden sm:inline">Sound</span>
          </button>
          <button
            type="button"
            onClick={handleEndRequest}
            className="min-h-[44px] rounded-full border border-[var(--border-subtle)] bg-transparent px-5 py-2.5 text-sm font-medium text-[var(--foreground-subtle)] hover:border-[var(--danger)] hover:text-[var(--danger)]"
          >
            End session
          </button>
        </div>
      </div>

      {/* Exit confirmation dialog */}
      <AnimatePresence>
        {showExitConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[calc(var(--z-focus-overlay)+10)] bg-black/70 backdrop-blur-sm"
              onClick={() => setShowExitConfirm(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[calc(var(--z-focus-overlay)+11)] rounded-[1.25rem] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5 shadow-2xl md:inset-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-sm md:-translate-x-1/2 md:-translate-y-1/2"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="end-session-title"
              aria-describedby="end-session-desc"
            >
              <h3 id="end-session-title" className="text-base font-semibold">
                End this focus session?
              </h3>
              <p id="end-session-desc" className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">
                Your progress will be saved, but the session will be marked incomplete.
              </p>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowExitConfirm(false)}
                  className="min-h-[44px] flex-1 rounded-full bg-[var(--brand-600)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-700)]"
                  autoFocus
                >
                  Continue focusing
                </button>
                <button
                  type="button"
                  onClick={handleConfirmEnd}
                  className="min-h-[44px] flex-1 rounded-full border border-[var(--border-subtle)] bg-transparent px-4 py-2.5 text-sm font-medium text-[var(--foreground-subtle)] hover:border-[var(--danger)] hover:text-[var(--danger)]"
                >
                  End session
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
