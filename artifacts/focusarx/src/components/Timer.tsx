"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { syncFocusSessionToCloud } from "@/lib/sync-focus-session";
import { useSessionRecovery } from "@/components/SessionRecoveryContext";
import { usePomodoro } from "@/hooks/usePomodoro";
import { useSessionHistory } from "@/hooks/useSessionHistory";
import { useSessionPersistence } from "@/hooks/useSessionPersistence";
import { TimerDisplay } from "./TimerDisplay";
import { TimerControls } from "./TimerControls";
import { SessionDots } from "./SessionDots";
import { useToast } from "./Toast";
import { getModeLabel } from "@/lib/timerUtils";
import { DEFAULT_CONFIG } from "@/lib/constants";
import type { PersistedActiveSession } from "@/types/session-persistence";
import type { TimerMode } from "@/types/timer";

const MODES: TimerMode[] = ["focus", "break", "longBreak"];

const modeAccent: Record<TimerMode, string> = {
  focus: "text-rose-400",
  break: "text-emerald-400",
  longBreak: "text-sky-400",
};

// Audio notification helper
const playSessionNotification = (mode: TimerMode) => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    if (mode === "focus") {
      // Completion beep
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.setValueAtTime(600, now + 0.1);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.setValueAtTime(0, now + 0.2);
    } else {
      // Break/long break chime
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.setValueAtTime(800, now + 0.1);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.setValueAtTime(0, now + 0.3);
    }
    
    osc.start(now);
    osc.stop(now + 0.3);
  } catch {
    // Silently ignore if audio context fails
  }
};

export default function Timer() {
  const { addSession, focusSessionsToday } = useSessionHistory();
  const { toast } = useToast();
  const { requestMonitorRecovery, monitorEnabled } = useSessionRecovery();
  const [storageReady, setStorageReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission | "unsupported">("unsupported");
  const prevStatusRef = useRef<string>("idle");
  const monitorEnabledRef = useRef(false);
  const persistenceRef = useRef<ReturnType<typeof useSessionPersistence> | null>(
    null
  );

  monitorEnabledRef.current = monitorEnabled;

  useEffect(() => {
    setStorageReady(true);
  }, []);

  const handleRecovered = useCallback(
    (session: PersistedActiveSession) => {
      if (session.monitorEnabled) {
        requestMonitorRecovery();
      }
      if (session.timerStatus === "running" || session.timerStatus === "paused") {
        toast("Session restored — pick up where you left off.", "info");
      }
    },
    [requestMonitorRecovery, toast]
  );

  const {
    mode,
    status,
    secondsLeft,
    progress,
    completedFocusSessions,
    toggle,
    reset,
    skipToNext,
    selectMode,
    setCustomDuration,
    getSnapshot,
    restoreFromSnapshot,
  } = usePomodoro({
    onSessionComplete: async (session) => {
      addSession(session);

      // Play audio notification
      playSessionNotification(session.mode);

      setJustCompleted(true);
      setTimeout(() => setJustCompleted(false), 800);

      setIsSaving(true);
      const dbSessionId = persistenceRef.current?.getDbSessionId() ?? null;
      const res = await syncFocusSessionToCloud(session, dbSessionId);
      setIsSaving(false);

      await persistenceRef.current?.onPhaseCompleted();

      if (res.offline) {
        toast("Saved locally (offline mode).", "info");
      } else if (res.success) {
        toast("Session saved.", "success");
        if (session.mode === "focus" && session.sessionInsights?.summary) {
          const insight = session.sessionInsights.summary;
          setTimeout(() => {
            toast(insight, "info");
          }, 600);
        }
        if (res.streakUpdated) {
          setTimeout(() => {
            toast("Streak updated! Keep it up 🔥", "success");
          }, 800);
        }
      } else {
        toast(`Failed to save: ${res.error || "Unknown"}`, "error");
      }

      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(
          session.mode === "focus"
            ? "Focus session complete — time for a break."
            : "Break finished — ready to focus again."
        );
      }
    },
  });

  const persistence = useSessionPersistence({
    getTimerSnapshot: getSnapshot,
    restoreTimer: restoreFromSnapshot,
    isMonitorEnabled: () => monitorEnabledRef.current,
    onRecovered: handleRecovered,
    onRecoveryReady: () => setRecoveryReady(true),
  });

  persistenceRef.current = persistence;

  useEffect(() => {
    if (!recoveryReady) return;
    if (prevStatusRef.current === status) return;

    const was = prevStatusRef.current;
    prevStatusRef.current = status;

    if (status === "running" && (was === "idle" || was === "paused")) {
      void persistence.onTimerStarted();
    }
  }, [status, recoveryReady, persistence]);

  useEffect(() => {
    setNotificationPermission(
      "Notification" in window ? Notification.permission : "unsupported"
    );
  }, []);

  const requestNotificationAlerts = useCallback(async () => {
    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      toast("This browser does not support notifications.", "error");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === "granted") {
      toast("Session alerts enabled.", "success");
    } else if (permission === "denied") {
      toast("Notifications are blocked in browser settings.", "error");
    }
  }, [toast]);

  useEffect(() => {
    const m = Math.floor(secondsLeft / 60)
      .toString()
      .padStart(2, "0");
    const s = (secondsLeft % 60).toString().padStart(2, "0");
    document.title =
      status === "running" ? `${m}:${s} · FocusArx` : "FocusArx";
    return () => {
      document.title = "FocusArx";
    };
  }, [secondsLeft, status]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const el = e.target as HTMLElement | null;
      if (!el) return;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        return;
      }
      if (el.isContentEditable) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  const isRunning = status === "running";
  const canPickMode = status !== "running";

  const handleEditTime = () => {
    if (status !== "idle") return;
    const currentMins = Math.floor(secondsLeft / 60);
    const input = prompt(`Enter custom duration for ${mode} (in minutes):`, currentMins.toString());
    if (input) {
      const val = parseInt(input, 10);
      if (!isNaN(val) && val > 0 && val <= 180) {
        setCustomDuration(mode, val * 60);
      } else {
        toast("Please enter a valid number of minutes (1-180).", "error");
      }
    }
  };

  if (!recoveryReady) {
    return (
      <section className="w-full max-w-md rounded-[1.75rem] border border-[var(--card-border)] bg-[var(--card)] p-8 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:p-10">
        <motion.div
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ repeat: Infinity, duration: 1.4 }}
          className="mx-auto h-48 w-48 rounded-full bg-zinc-800/40"
        />
        <p className="mt-6 text-center text-sm text-zinc-500">Loading session…</p>
      </section>
    );
  }

  return (
    <motion.section
      layout
      animate={justCompleted ? { scale: [1, 1.02, 1] } : { scale: 1 }}
      className="w-full max-w-md rounded-[1.75rem] border border-[var(--card-border)] bg-[var(--card)] p-8 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:p-10"
      transition={{ type: "spring", stiffness: 260, damping: 32 }}
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative flex rounded-full bg-zinc-950/50 p-1 ring-1 ring-zinc-800/70 dark:bg-black/35"
      >
        {MODES.map((m) => {
          const active = mode === m;
          return (
            <button
              key={m}
              type="button"
              disabled={!canPickMode}
              onClick={() => selectMode(m)}
              className={`relative z-10 flex-1 rounded-full px-3 py-2 text-center text-xs font-medium transition-colors sm:text-sm ${
                active
                  ? "text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="mode-pill"
                  className="absolute inset-0 -z-10 rounded-full bg-zinc-800/95 shadow-inner shadow-black/40 ring-1 ring-white/5"
                  transition={{ type: "spring", stiffness: 380, damping: 34 }}
                />
              )}
              <span className="relative">{getModeLabel(m)}</span>
            </button>
          );
        })}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mt-10 flex flex-col items-center"
      >
        <TimerDisplay
          secondsLeft={secondsLeft}
          progress={progress}
          mode={mode}
          isRunning={isRunning}
          onEditClick={status === "idle" ? handleEditTime : undefined}
        />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mt-8 flex flex-col items-center gap-2"
        >
          <SessionDots
            completed={completedFocusSessions}
            total={DEFAULT_CONFIG.sessionsBeforeLongBreak}
          />
          <p className="text-xs text-zinc-500">
            {storageReady ? focusSessionsToday : 0} focus block
            {(storageReady ? focusSessionsToday : 0) !== 1 ? "s" : ""} today
          </p>
        </motion.div>

        <TimerControls
          status={status}
          onToggle={toggle}
          onReset={() => {
            persistence.clearDbSession();
            reset(false);
          }}
          onSkip={skipToNext}
        />

        {notificationPermission === "default" && (
          <button
            type="button"
            onClick={() => void requestNotificationAlerts()}
            className="mt-4 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
          >
            Enable session alerts
          </button>
        )}

        <AnimatePresence mode="wait">
          <motion.p
            key={`${mode}-${status}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className={`mt-8 text-center text-sm font-medium ${modeAccent[mode]}`}
          >
            {isSaving ? (
              <span className="flex items-center justify-center gap-2 text-zinc-400">
                <span className="h-3 w-3 animate-ping rounded-full bg-zinc-400/60" />
                Saving session...
              </span>
            ) : status === "running" ? (
              <>{getModeLabel(mode)} in progress</>
            ) : status === "paused" ? (
              <>Paused · resume when you are ready</>
            ) : (
              <>
                {mode === "focus"
                  ? "Press play to start a focus block"
                  : `Ready for your ${getModeLabel(mode).toLowerCase()}`}
              </>
            )}
          </motion.p>
        </AnimatePresence>

      </motion.div>
    </motion.section>
  );
}
