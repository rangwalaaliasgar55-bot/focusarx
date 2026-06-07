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
import { trackSiteEvent } from "@/lib/site-analytics";
import type { PersistedActiveSession } from "@/types/session-persistence";
import type { TimerMode } from "@/types/timer";
import FocusLockOverlay, { LockModePicker } from "./FocusLockOverlay";
import type { LockMode } from "./FocusLockOverlay";
import DistractionModal from "./DistractionModal";
import TaskTimeline, { OverrunModal } from "./TaskTimeline";
import { SoundEngine } from "./SoundEngine";
import SessionTypePicker, { type SessionType, SESSION_TYPE_TINTS } from "./SessionTypePicker";
import AmbientSoundBar from "./AmbientSoundBar";
import { useTasks } from "@/hooks/useTasks";
import BreakActivityCard from "./BreakActivityCard";
import SessionSummaryCard from "./SessionSummaryCard";
import ConfettiCelebration from "./ConfettiCelebration";
import { getToken } from "@/lib/auth";

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
  const { activeTasks, completedTasks, refreshTasks } = useTasks();
  const [storageReady, setStorageReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState<{
    durationSeconds: number;
    completedTaskCount: number;
    focusScore: number | null;
    earnedXp: number;
    earnedCoins: number;
    completedEarly: boolean;
    completionPercentage: number | null;
  } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission | "unsupported">("unsupported");
  const prevStatusRef = useRef<string>("idle");
  const monitorEnabledRef = useRef(false);
  const persistenceRef = useRef<ReturnType<typeof useSessionPersistence> | null>(
    null
  );

  // ── Session type selector ────────────────────────────────────────────────
  const [showSessionTypePicker, setShowSessionTypePicker] = useState(false);
  const [sessionType, setSessionType] = useState<SessionType>("deep_work");

  // ── Upgrade 3: Lock mode ────────────────────────────────────────────────
  const [showLockPicker, setShowLockPicker] = useState(false);
  const [lockMode, setLockMode] = useState<LockMode>("none");
  const [exitPhrase, setExitPhrase] = useState("");
  const [activeTaskName, setActiveTaskName] = useState("");
  const [totalFocusSec, setTotalFocusSec] = useState(0);

  // ── Upgrade 4: Distraction modal ────────────────────────────────────────
  const [showDistractionModal, setShowDistractionModal] = useState(false);

  // ── Upgrade 1: Overrun modal ─────────────────────────────────────────────
  const [overrunTask, setOverrunTask] = useState<{ text: string } | null>(null);
  const [overrunMinutes, setOverrunMinutes] = useState(0);

  monitorEnabledRef.current = monitorEnabled;

  useEffect(() => {
    setStorageReady(true);
  }, []);

  // Fetch current streak on mount
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch("/api/streak", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then((d: { streak?: { currentStreak?: number } } | null) => {
        if (d?.streak?.currentStreak) setCurrentStreak(d.streak.currentStreak);
      })
      .catch(() => {});
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
    getActiveSeconds,
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
        if (session.mode === "focus" && session.sessionInsights?.summary) {
          const insight = session.sessionInsights.summary;
          setTimeout(() => { toast(insight, "info"); }, 600);
        }
        if (res.streakUpdated) {
          // Re-fetch updated streak
          const token = getToken();
          if (token) {
            fetch("/api/streak", { headers: { Authorization: `Bearer ${token}` } })
              .then(r => r.ok ? r.json() : null)
              .then((d: { streak?: { currentStreak?: number } } | null) => {
                if (d?.streak?.currentStreak) setCurrentStreak(d.streak.currentStreak);
              })
              .catch(() => {});
          }
        }
      } else {
        toast(`Failed to save: ${res.error || "Unknown"}`, "error");
      }

      // Show end-of-session summary card for focus sessions
      if (session.mode === "focus" && session.durationSeconds > 0) {
        setSummaryData({
          durationSeconds: session.durationSeconds,
          completedTaskCount: completedTasks.length,
          focusScore: null,
          earnedXp: res.earnedXp ?? 0,
          earnedCoins: res.earnedCoins ?? 0,
          completedEarly: false,
          completionPercentage: null,
        });
        setShowSummary(true);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3500);
      }

      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(
          session.mode === "focus"
            ? "Focus session complete — time for a break."
            : "Break finished — ready to focus again."
        );
      }

      // Auto-save ghost when a focus session completes
      if (session.mode === "focus" && session.durationSeconds > 0) {
        const token = localStorage.getItem("focusarx-auth-token");
        if (token) {
          // Compute longest unbroken focus seconds from timeline
          let longestUnbroken = 0;
          let cur = 0;
          const tl = Array.isArray(session.focusTimeline)
            ? session.focusTimeline
            : [];
          for (const ev of tl) {
            if (ev.state === "focus") { cur++; if (cur > longestUnbroken) longestUnbroken = cur; }
            else cur = 0;
          }
          fetch("/api/ghosts", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              taskCategory: "General",
              durationSec: session.durationSeconds,
              unbrokenSec: longestUnbroken * 10,
              sessionId: res.sessionId ?? null,
            }),
          }).catch(() => {});
        }
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
      if (was === "idle") trackSiteEvent("focus_session_started");
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

  // Intercept toggle: show session type picker first (when idle+focus), then lock picker
  const handleToggle = useCallback(() => {
    if (status === "idle" && mode === "focus") {
      setTotalFocusSec(secondsLeft);
      setShowSessionTypePicker(true);
    } else {
      toggle();
    }
  }, [status, mode, secondsLeft, toggle]);

  const handleSessionTypeSelected = useCallback((type: SessionType) => {
    setSessionType(type);
    if (type === "recharge") {
      // Recharge: navigate to breathe page instead of starting timer
      window.location.href = "/breathe";
      return;
    }
    setShowLockPicker(true);
  }, []);

  // Complete session early — saves all progress to the server and shows summary
  const handleCompleteEarly = useCallback(async () => {
    if (mode !== "focus") return;
    const activeSeconds = getActiveSeconds();
    if (activeSeconds < 10) {
      // Not enough time to save — just cancel
      persistence.clearDbSession();
      reset(false);
      setLockMode("none");
      setExitPhrase("");
      setShowExitConfirm(false);
      return;
    }
    setShowExitConfirm(false);
    setIsSaving(true);
    const plannedSec = totalFocusSec;
    const actualSec = Math.floor(activeSeconds);
    const pct = plannedSec > 0 ? Math.min(100, Math.round((actualSec / plannedSec) * 100)) : null;
    const dbSessionId = persistenceRef.current?.getDbSessionId() ?? null;
    const res = await syncFocusSessionToCloud(
      {
        id: `early-${Date.now()}`,
        mode: "focus",
        completedAt: new Date().toISOString(),
        durationSeconds: actualSec,
        focusScore: null,
        focusQuality: null,
        focusTimeline: null,
        stabilityRating: null,
        sessionInsights: null,
      },
      dbSessionId,
      {
        plannedDurationSec: plannedSec,
        completedEarly: true,
        completionPercentage: pct ?? 0,
        sessionStatus: "completed_early",
      }
    );
    setIsSaving(false);

    persistence.clearDbSession();
    reset(false);
    setLockMode("none");
    setExitPhrase("");

    if (res.success) {
      toast(`Session saved — ${Math.floor(actualSec / 60)}m of focus recorded!`, "success");
      if (res.streakUpdated) {
        const token = getToken();
        if (token) {
          fetch("/api/streak", { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.ok ? r.json() : null)
            .then((d: { streak?: { currentStreak?: number } } | null) => {
              if (d?.streak?.currentStreak) setCurrentStreak(d.streak.currentStreak);
            })
            .catch(() => {});
        }
      }
      setSummaryData({
        durationSeconds: actualSec,
        completedTaskCount: completedTasks.length,
        focusScore: null,
        earnedXp: res.earnedXp ?? 0,
        earnedCoins: res.earnedCoins ?? 0,
        completedEarly: true,
        completionPercentage: pct,
      });
      setShowSummary(true);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    } else if (res.offline) {
      toast(`Saved ${Math.floor(actualSec / 60)}m locally (offline)`, "info");
    } else {
      toast("Failed to save session progress", "error");
    }
  }, [mode, getActiveSeconds, totalFocusSec, persistence, reset, toast, completedTasks.length]);

  const savePartialSessionIfNeeded = useCallback(() => {
    if (mode !== "focus") return;
    const activeSeconds = getActiveSeconds();
    if (activeSeconds < 60) return;
    const dbSessionId = persistenceRef.current?.getDbSessionId() ?? null;
    void syncFocusSessionToCloud(
      {
        id: `partial-${Date.now()}`,
        mode: "focus",
        completedAt: new Date().toISOString(),
        durationSeconds: Math.floor(activeSeconds),
        focusScore: null,
        focusQuality: null,
        focusTimeline: null,
        stabilityRating: null,
        sessionInsights: null,
      },
      dbSessionId
    ).then((res) => {
      if (res.success) {
        toast(`Saved ${Math.floor(activeSeconds / 60)}m of focus time`, "info");
      }
    });
  }, [mode, getActiveSeconds, toast]);

  // Intercept reset: show exit confirmation when running focus session
  const handleReset = useCallback(() => {
    if (status === "running" && mode === "focus") {
      setShowExitConfirm(true);
      return;
    }
    persistence.clearDbSession();
    reset(false);
    setLockMode("none");
    setExitPhrase("");
  }, [status, mode, persistence, reset]);

  // Cancel without saving — used from exit confirm dialog
  const handleCancelNoSave = useCallback(() => {
    setShowExitConfirm(false);
    setShowDistractionModal(true);
    persistence.clearDbSession();
    reset(false);
    setLockMode("none");
    setExitPhrase("");
  }, [persistence, reset]);

  // Exit lock overlay → show exit confirm first
  const handleLockExit = useCallback(() => {
    setShowExitConfirm(true);
  }, []);

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

  const typeTint = isRunning ? SESSION_TYPE_TINTS[sessionType] : null;

  return (
    <>
    <div className="flex w-full flex-col items-center gap-6 md:flex-row md:items-start md:gap-10">
    <motion.section
      layout
      animate={justCompleted ? { scale: [1, 1.02, 1] } : { scale: 1 }}
      className={`w-full max-w-md shrink-0 rounded-[1.75rem] border border-[var(--card-border)] bg-[var(--card)] p-8 backdrop-blur-2xl sm:p-10 ${isRunning ? "timer-running-glow" : "shadow-[0_24px_80px_-24px_rgba(0,0,0,0.55)]"}`}
      style={typeTint ? { background: `linear-gradient(135deg, var(--card) 60%, ${typeTint.bg})`, borderColor: `${typeTint.accent}22` } : undefined}
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
          {currentStreak > 0 && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.6 }}
              className="mt-1 flex items-center gap-1 rounded-full border border-orange-500/25 bg-orange-500/10 px-3 py-0.5 text-xs font-semibold text-orange-400"
            >
              🔥 {currentStreak} day streak
            </motion.div>
          )}
        </motion.div>

        <TimerControls
          status={status}
          onToggle={handleToggle}
          onReset={handleReset}
          onSkip={skipToNext}
        />

        {/* Complete Session Early — visible only during active focus sessions */}
        <AnimatePresence>
          {isRunning && mode === "focus" && (
            <motion.button
              key="complete-early"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.2 }}
              onClick={() => setShowExitConfirm(true)}
              className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-4 py-2 text-xs font-semibold text-emerald-400 transition-all hover:bg-emerald-500/15 hover:border-emerald-500/40 active:scale-95"
              type="button"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
                <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Complete Session
            </motion.button>
          )}
        </AnimatePresence>

        {notificationPermission === "default" && (
          <button
            type="button"
            onClick={() => void requestNotificationAlerts()}
            className="mt-4 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
          >
            Enable session alerts
          </button>
        )}

        {/* Sound Engine */}
        <div className="mt-3 flex items-center justify-center">
          <SoundEngine
            sessionActive={isRunning && mode === "focus"}
            sessionMinutesLeft={Math.floor(secondsLeft / 60)}
            sessionTotalMinutes={Math.floor(totalFocusSec / 60)}
          />
        </div>

        {/* Session type badge when running */}
        {isRunning && typeTint && (
          <div className="mt-2 flex justify-center">
            <span
              className="rounded-full px-3 py-0.5 text-[10px] font-semibold"
              style={{ background: `${typeTint.accent}18`, color: typeTint.text, border: `1px solid ${typeTint.accent}30` }}
            >
              {sessionType.replace("_", " ")}
            </span>
          </div>
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

    {/* ── Break Activity Card ─────────────────────────────────────────── */}
    <AnimatePresence>
      {isRunning && (mode === "break" || mode === "longBreak") && (
        <motion.div
          key="break-activity"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-md"
        >
          <BreakActivityCard
            mode={mode}
            secondsLeft={secondsLeft}
            breakDurationSeconds={mode === "longBreak" ? DEFAULT_CONFIG.longBreakDuration : DEFAULT_CONFIG.breakDuration}
          />
        </motion.div>
      )}
    </AnimatePresence>

    {/* ── Upgrade 1: Task Timeline + Overrun ─────────────────────────── */}
    <div className="w-full max-w-md">
      <TaskTimeline
        tasks={activeTasks.map(t => ({
          id: t.id,
          text: t.title,
          completed: t.done,
          estimatedMinutes: t.estimatedPomodoros ? t.estimatedPomodoros * 25 : null,
          order: 0,
        }))}
        elapsedSeconds={isRunning ? (totalFocusSec - secondsLeft) : 0}
        isRunning={isRunning && mode === "focus"}
        onOverrun={(task, mins) => {
          setOverrunTask({ text: task.text });
          setOverrunMinutes(mins);
        }}
        onEstimateChange={() => { void refreshTasks(); }}
      />
    </div>
    </div>{/* end timer+timeline flex wrapper */}

    {/* Ambient Sound Bar — always visible */}
    <AmbientSoundBar visible={true} />

    {/* ── Overlays ────────────────────────────────────────────────────── */}
    <SessionTypePicker
      open={showSessionTypePicker}
      onClose={() => setShowSessionTypePicker(false)}
      onSelect={handleSessionTypeSelected}
      selected={sessionType}
    />

    <AnimatePresence>
      {showLockPicker && (
        <LockModePicker
          onConfirm={(m, phrase) => {
            setLockMode(m);
            setExitPhrase(phrase);
            setShowLockPicker(false);
            toggle();
          }}
          onCancel={() => setShowLockPicker(false)}
        />
      )}
    </AnimatePresence>

    <AnimatePresence>
      {isRunning && lockMode !== "none" && (
        <FocusLockOverlay
          mode={lockMode}
          exitPhrase={exitPhrase}
          secondsLeft={secondsLeft}
          totalSeconds={totalFocusSec}
          taskName={activeTaskName}
          onExit={handleLockExit}
        />
      )}
    </AnimatePresence>

    <AnimatePresence>
      {showDistractionModal && (
        <DistractionModal
          onDone={() => setShowDistractionModal(false)}
          onSkip={() => setShowDistractionModal(false)}
        />
      )}
    </AnimatePresence>

    <AnimatePresence>
      {overrunTask && (
        <OverrunModal
          task={overrunTask}
          overrunMinutes={overrunMinutes}
          onReschedule={() => { toast("Tasks compressed — timeline updated.", "success"); setOverrunTask(null); }}
          onDefer={() => { toast("Remaining tasks deferred to tomorrow.", "info"); setOverrunTask(null); }}
          onDrop={() => { toast("Remaining tasks dropped.", "info"); setOverrunTask(null); }}
        />
      )}
    </AnimatePresence>

    {/* ── Exit Confirmation Dialog ─────────────────────────────────── */}
    <AnimatePresence>
      {showExitConfirm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.95, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            className="w-full max-w-xs rounded-2xl border border-[#1e2130] bg-[#111318] p-5 shadow-2xl"
          >
            <div className="mb-4 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 ring-1 ring-amber-500/25">
                <span className="text-2xl">⚡</span>
              </div>
              <h3 className="text-sm font-bold text-[#e8eaf0]">End focus session?</h3>
              <p className="mt-1 text-xs text-[#5a5f72]">
                You've focused for{" "}
                <span className="font-semibold text-emerald-400">
                  {Math.floor(getActiveSeconds() / 60)}m {Math.floor(getActiveSeconds() % 60)}s
                </span>
              </p>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => void handleCompleteEarly()}
                disabled={isSaving}
                className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/12 px-4 py-3 text-left text-xs transition-all hover:bg-emerald-500/20 disabled:opacity-50"
              >
                <p className="font-semibold text-emerald-400">✅ Complete Session & Save Progress</p>
                <p className="text-[10px] text-emerald-400/60 mt-0.5">Save focus time, earn XP & coins</p>
              </button>
              <button
                onClick={() => setShowExitConfirm(false)}
                className="w-full rounded-xl border border-[#1e2130] bg-[#1a1d27] px-4 py-3 text-left text-xs transition-all hover:border-[#7C3AED]/30"
              >
                <p className="font-semibold text-[#e8eaf0]">▶ Continue Session</p>
                <p className="text-[10px] text-[#4a4f62] mt-0.5">Keep the timer running</p>
              </button>
              <button
                onClick={handleCancelNoSave}
                className="w-full rounded-xl border border-red-500/15 bg-red-500/8 px-4 py-3 text-left text-xs transition-all hover:bg-red-500/15"
              >
                <p className="font-semibold text-red-400">✕ Cancel Without Saving</p>
                <p className="text-[10px] text-red-400/60 mt-0.5">Discard this session</p>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    <SessionSummaryCard
      open={showSummary}
      durationSeconds={summaryData?.durationSeconds ?? 0}
      completedTaskCount={summaryData?.completedTaskCount ?? 0}
      focusScore={summaryData?.focusScore ?? null}
      earnedXp={summaryData?.earnedXp ?? 0}
      earnedCoins={summaryData?.earnedCoins ?? 0}
      completedEarly={summaryData?.completedEarly ?? false}
      completionPercentage={summaryData?.completionPercentage ?? null}
      onStartBreak={() => { setShowSummary(false); skipToNext(); }}
      onKeepGoing={() => { setShowSummary(false); }}
      onClose={() => { setShowSummary(false); }}
    />

    <ConfettiCelebration active={showConfetti} count={90} duration={3500} />
  </>
  );
}
