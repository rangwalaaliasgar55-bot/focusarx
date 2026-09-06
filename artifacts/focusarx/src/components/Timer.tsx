
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { syncFocusSessionToCloud } from "@/lib/sync-focus-session";
import { useSessionRecovery } from "@/components/SessionRecoveryContext";
import { usePomodoro } from "@/hooks/usePomodoro";
import { publishFocusState, resetFocusState } from "@/lib/focusSessionBus";
import { useSessionHistory } from "@/hooks/useSessionHistory";
import { useSessionPersistence } from "@/hooks/useSessionPersistence";
import { TimerDisplay } from "./TimerDisplay";
import { TimerControls } from "./TimerControls";
import { SessionDots } from "./SessionDots";
import { useToast } from "./Toast";
import { getModeLabel } from "@/lib/timerUtils";
import { DEFAULT_CONFIG } from "@/lib/constants";
import { FOCUS_DEEP_LINK_EVENT } from "@/lib/focusDeepLink";
import FlowTimer from "./FlowTimer";
import { SESSION_PRESETS, getPresetById, getSessionPreset, setSessionPreset } from "@/lib/sessionPresets";
import { isDocumentPipSupported, openMiniTimer, writePipSnapshot } from "@/lib/miniTimer";
import { trackSiteEvent } from "@/lib/site-analytics";
import { trackSessionStart, trackSessionComplete, trackSessionAbandoned } from "@/lib/analytics";
import { haptic } from "@/lib/haptics";
import type { PersistedActiveSession } from "@/types/session-persistence";
import type { Session, TimerMode } from "@/types/timer";
import FocusLockOverlay, { LockModePicker } from "./FocusLockOverlay";
import type { LockMode } from "./FocusLockOverlay";
import DistractionModal from "./DistractionModal";
import TaskTimeline, { OverrunModal } from "./TaskTimeline";
import { SoundEngine } from "./SoundEngine";
import SessionTypePicker, { type SessionType, SESSION_TYPE_TINTS } from "./SessionTypePicker";
import AmbientSoundBar from "./AmbientSoundBar";
import ZenOverlay from "./ZenOverlay";
import { useTasks } from "@/hooks/useTasks";
import BreakActivityCard from "./BreakActivityCard";
import SessionSummaryCard from "./SessionSummaryCard";
import ConfettiCelebration from "./ConfettiCelebration";
import { XPBurst } from "./XPBurst";
import { getToken } from "@/lib/auth";
import { useCoinXP } from "./CoinXPBar";
import PetCompanion from "./PetCompanion";
import { TimerRitualsPanel, ReflectionModal } from "./TimerRituals";
import { usePremium } from "@/hooks/usePremium";

const MODES: TimerMode[] = ["focus", "break", "longBreak"];

const MODEUI: Record<TimerMode, { icon: string; label: string; accent: string; pill: string }> = {
  focus:     { icon: "⚔️", label: "Focus",      accent: "text-[var(--palette-rose-400)]",    pill: "bg-[var(--palette-rose-500)]/15 border-[var(--palette-rose-500)]/30 text-[var(--palette-rose-300)]" },
  break:     { icon: "☕", label: "Break",      accent: "text-[var(--palette-emerald-400)]", pill: "bg-[var(--palette-emerald-500)]/15 border-[var(--palette-emerald-500)]/30 text-[var(--palette-emerald-300)]" },
  longBreak: { icon: "🌙", label: "Long Break", accent: "text-[var(--palette-violet-400)]",  pill: "bg-[var(--palette-violet-500)]/15 border-[var(--palette-violet-500)]/30 text-[var(--palette-violet-300)]" },
};

const LEVEL_AVATARS = ["🌱","⚡","🔥","💎","🌟","👑","🦅","🚀","🌌","🏆"];
function getLevelAvatar(level: number) { return LEVEL_AVATARS[Math.min(Math.floor((level - 1) / 5), LEVEL_AVATARS.length - 1)] ?? "🌱"; }
function getLevel(xp: number) { return Math.floor(Math.sqrt(xp / 100)) + 1; }
function xpForLevel(level: number) { return (level - 1) ** 2 * 100; }
function xpForNextLevel(level: number) { return level ** 2 * 100; }

const playSessionNotification = (mode: TimerMode) => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    // Fired from a Worker tick, not a gesture: resume opportunistically so
    // the completion chime is not swallowed by the autoplay policy.
    if (audioContext.state === "suspended") {
      void audioContext.resume().catch(() => {});
    }
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    if (mode === "focus") {
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.setValueAtTime(600, now + 0.1);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.setValueAtTime(0, now + 0.2);
    } else {
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.setValueAtTime(800, now + 0.1);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.setValueAtTime(0, now + 0.3);
    }
    osc.start(now);
    osc.stop(now + 0.3);
  } catch { /* silently ignore */ }
};

import { playCoachVoice } from "@/lib/soundEngine";

export default function Timer({ onSessionComplete: onSessionCompleteProp }: { onSessionComplete?: () => void } = {}) {
  const { addSession, focusSessionsToday } = useSessionHistory();
  const { toast } = useToast();
  const { requestMonitorRecovery, monitorEnabled } = useSessionRecovery();
  const { activeTasks, completedTasks, refreshTasks } = useTasks();
  const { wallet, refresh: refreshWallet } = useCoinXP();
  const { isPremium } = usePremium();
  const [intention] = useState("");
  const [showReflection, setShowReflection] = useState(false);
  const [reflectionDuration, setReflectionDuration] = useState(0);
  const [ritualHistory, setRitualHistory] = useState<Array<{ date: string; template: string; intention: string; duration: number }>>([]);

  // SPA-only: localStorage is available on first render, so no mount gate.
  const [storageReady] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState<{
    durationSeconds: number; completedTaskCount: number;
    focusScore: number | null; earnedXp: number; earnedCoins: number;
    completedEarly: boolean; completionPercentage: number | null;
  } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(
    () => ("Notification" in window ? Notification.permission : "unsupported"),
  );
  const prevStatusRef = useRef<string>("idle");
  const monitorEnabledRef = useRef(false);
  const persistenceRef = useRef<ReturnType<typeof useSessionPersistence> | null>(null);

  const [showSessionTypePicker, setShowSessionTypePicker] = useState(false);
  const [sessionType, setSessionType] = useState<SessionType>("deep_work");
  const [showLockPicker, setShowLockPicker] = useState(false);
  const [lockMode, setLockMode] = useState<LockMode>("none");
  const [exitPhrase, setExitPhrase] = useState("");
  const [activeTaskName, setActiveTaskName] = useState("");
  const [totalFocusSec, setTotalFocusSec] = useState(0);
  const [showDistractionModal, setShowDistractionModal] = useState(false);
  const [showZen, setShowZen] = useState(false);
  const [overrunTask, setOverrunTask] = useState<{ text: string } | null>(null);
  const [overrunMinutes, setOverrunMinutes] = useState(0);
  const [showMarathonConfirm, setShowMarathonConfirm] = useState(false);
  // Session-mode preset (9.1): chosen once, remembered. Durations apply
  // through the normal custom path; Flowtime swaps in the stopwatch.
  const [presetId, setPresetIdState] = useState<string>(() => getSessionPreset());
  const marathonNudgeRef = useRef(0);
  const prefersReducedMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  monitorEnabledRef.current = monitorEnabled;


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

  const handleRecovered = useCallback((session: PersistedActiveSession) => {
    if (session.monitorEnabled) requestMonitorRecovery();
    if (session.timerStatus === "running" || session.timerStatus === "paused") {
      toast("Session restored — pick up where you left off.", "info");
    }
  }, [requestMonitorRecovery, toast]);

  // Shared completion pipeline: countdown sessions AND Flowtime runs land
  // here (record → sounds → cloud sync → summary → reflection → notify).
  const handleSessionRecorded = async (session: Session) => {
      addSession(session);
      playSessionNotification(session.mode);
      if (session.mode === "focus") {
        playCoachVoice("session_complete");
      } else {
        playCoachVoice("break_time");
      }
      setJustCompleted(true);
      setTimeout(() => setJustCompleted(false), 800);
      // Analytics: track session completion
      if (session.mode === "focus") {
        trackSessionComplete(
          session.durationSeconds,
          session.focusScore ?? 0,
          0, // earnedXp resolved after API call below
          false
        );
      }
      setIsSaving(true);
      const dbSessionId = persistenceRef.current?.getDbSessionId() ?? null;
      const res = await syncFocusSessionToCloud(session, dbSessionId);
      setIsSaving(false);
      await persistenceRef.current?.onPhaseCompleted();
      if (res.offline) {
        toast("Saved locally (offline mode).", "info");
      } else if (res.success) {
        if (res.shieldUsed) {
          setTimeout(() => { toast("A Streak Shield covered yesterday. Streak protected.", "info"); }, 900);
        }
        if (session.mode === "focus" && session.sessionInsights?.summary) {
          setTimeout(() => { toast(session.sessionInsights!.summary, "info"); }, 600);
        }
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
        void refreshWallet();
      } else {
        toast(`Failed to save: ${res.error || "Unknown"}`, "error");
      }
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
        haptic("celebrate");
        setTimeout(() => setShowConfetti(false), 3500);
        onSessionCompleteProp?.();
        // Premium reflection prompt
        if (isPremium) {
          setReflectionDuration(session.durationSeconds);
          setTimeout(() => setShowReflection(true), 1200);
        }
      }
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(session.mode === "focus"
          ? "Focus session complete — time for a break."
          : "Break finished — ready to focus again."
        );
      }
      if (session.mode === "focus" && session.durationSeconds > 0) {
        const token = localStorage.getItem("focusarx-auth-token");
        if (token) {
          let longestUnbroken = 0, cur = 0;
          const tl = Array.isArray(session.focusTimeline) ? session.focusTimeline : [];
          for (const ev of tl) {
            if (ev.state === "focus") { cur++; if (cur > longestUnbroken) longestUnbroken = cur; }
            else cur = 0;
          }
          fetch("/api/ghosts", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ taskCategory: "General", durationSec: session.durationSeconds, unbrokenSec: longestUnbroken * 10, sessionId: res.sessionId ?? null }),
          }).catch(() => {});
        }
      }
  };

  const {
    mode, status, secondsLeft, totalSeconds, progress, completedFocusSessions,
    leaderBlocked, toggle, reset, skipToNext, selectMode, setCustomDuration,
    getSnapshot, restoreFromSnapshot, getActiveSeconds,
  } = usePomodoro({
    // Guest-local snapshot: first sessions (Instagram funnel) survive
    // refresh/back-swipe/close even before any account exists.
    persistKey: "focusarx-guest-timer",
    onSessionComplete: handleSessionRecorded,
  });

  useEffect(() => {
    if (status === "running" && mode === "focus") {
      window.dispatchEvent(new CustomEvent("fx:focus-start"));
    } else {
      window.dispatchEvent(new CustomEvent("fx:focus-stop"));
    }
  }, [status, mode]);

  // Publish the live block to the shared bus so companions (battle arena,
  // YouTube player, topbar pill) can follow the real session instead of the
  // hardcoded `isActive={false}` they used to receive.
  useEffect(() => {
    publishFocusState({ mode, status, secondsLeft, totalSeconds });
  }, [mode, status, secondsLeft, totalSeconds]);
  useEffect(() => () => resetFocusState(), []);

  const applyPreset = useCallback((id: string) => {
    const p = getPresetById(id);
    setSessionPreset(id);
    setPresetIdState(id);
    if (!p.flow && p.focusMin && getSnapshot().status === "idle") {
      setCustomDuration("focus", p.focusMin * 60);
      if (p.breakMin) setCustomDuration("break", p.breakMin * 60);
      if (p.longBreakMin) setCustomDuration("longBreak", p.longBreakMin * 60);
    }
  }, [getSnapshot, setCustomDuration]);

  // Apply the remembered preset to a fresh idle timer (never over a
  // restored running/paused snapshot or deep-linked duration). Deferred to
  // an animation frame so mount stays a pure render (no cascading setState).
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (getSnapshot().status !== "idle") return;
      if (secondsLeft !== DEFAULT_CONFIG.focusDuration) return;
      const remembered = getSessionPreset();
      if (remembered && remembered !== "pomodoro" && remembered !== "custom") {
        applyPreset(remembered);
      }
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const startFromCommand = () => {
      if (status !== "running") toggle();
    };
    window.addEventListener("focusarx:start-focus", startFromCommand);
    return () => window.removeEventListener("focusarx:start-focus", startFromCommand);
  }, [status, toggle]);

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

  // Another tab won the timer lock: explain why this one stood down.
  useEffect(() => {
    if (leaderBlocked) toast("Timer is already running in another tab.", "info");
  }, [leaderBlocked, toast]);

  // Document PiP mini-timer (desktop): snapshot the countdown for the
  // always-on-top window while running.
  const [pipSupported] = useState(() => isDocumentPipSupported());
  useEffect(() => {
    if (status !== "running" || !pipSupported) return;
    const push = () => {
      const s = getSnapshot();
      writePipSnapshot({ secondsLeft: s.secondsLeft, task: activeTaskName, mode: s.mode, status: s.status });
    };
    push();
    const id = window.setInterval(push, 1000);
    return () => window.clearInterval(id);
  }, [status, pipSupported, getSnapshot, activeTaskName]);

  const popOutMiniTimer = useCallback(() => {
    const s = getSnapshot();
    writePipSnapshot({ secondsLeft: s.secondsLeft, task: activeTaskName, mode: s.mode, status: s.status });
    void openMiniTimer().then((ok) => {
      if (!ok) toast("Mini-timer is not supported in this browser.", "error");
    });
  }, [getSnapshot, activeTaskName, toast]);

  // Instagram funnel: pre-arm the idle timer from ?duration= and prefill the
  // intention from ?task=. Applies only when idle/empty — never mid-session.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ seconds?: number | null; task?: string | null }>).detail;
      if (!detail) return;
      if (detail.seconds && getSnapshot().status === "idle") {
        setCustomDuration("focus", detail.seconds);
      }
      if (detail.task) {
        const t = detail.task;
        setActiveTaskName((prev) => prev || t);
      }
    };
    window.addEventListener(FOCUS_DEEP_LINK_EVENT, handler);
    return () => window.removeEventListener(FOCUS_DEEP_LINK_EVENT, handler);
  }, [getSnapshot, setCustomDuration]);

  const requestNotificationAlerts = useCallback(async () => {
    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      toast("This browser does not support notifications.", "error");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === "granted") toast("Session alerts enabled.", "success");
    else if (permission === "denied") toast("Notifications are blocked in browser settings.", "error");
  }, [toast]);

  useEffect(() => {
    const m = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
    const s = (secondsLeft % 60).toString().padStart(2, "0");
    document.title = status === "running" ? `${m}:${s} · FocusArx` : "FocusArx";
    return () => { document.title = "FocusArx"; };
  }, [secondsLeft, status]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const el = e.target as HTMLElement | null;
      if (!el) return;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (el.isContentEditable) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  // Distraction parking (9.4): D jots a thought, hidden until the break.
  useEffect(() => {
    const onParkKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "d" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (el?.isContentEditable) return;
      e.preventDefault();
      setShowDistractionModal(true);
    };
    window.addEventListener("keydown", onParkKey);
    return () => window.removeEventListener("keydown", onParkKey);
  }, []);

  const isRunning = status === "running";
  const canPickMode = status !== "running";
  const isFlow = getPresetById(presetId).flow === true;
  const activeSeconds = isRunning ? getActiveSeconds() : 0;
  // Workstream H: a "marathon" is a running focus session planned beyond 2h.
  const isMarathon = isRunning && mode === "focus" && totalFocusSec > 2 * 60 * 60;

  const beginMarathonStart = useCallback(() => {
    setShowMarathonConfirm(false);
    setTotalFocusSec(secondsLeft);
    setShowSessionTypePicker(true);
  }, [secondsLeft]);

  const handleToggle = useCallback(() => {
    if (status === "idle" && mode === "focus") {
      setTotalFocusSec(secondsLeft);
      // Workstream H: micro-confirm before any focus session beyond 2h.
      if (secondsLeft > 2 * 60 * 60) {
        setShowMarathonConfirm(true);
        return;
      }
      setShowSessionTypePicker(true);
    } else {
      toggle();
    }
  }, [status, mode, secondsLeft, toggle]);

  // Workstream H: hourly break nudge during marathons (>2h planned).
  useEffect(() => {
    if (!isRunning || mode !== "focus" || totalFocusSec < 2 * 60 * 60) return;
    const hourMark = Math.floor(activeSeconds / 3600);
    if (hourMark >= 1 && hourMark > marathonNudgeRef.current) {
      marathonNudgeRef.current = hourMark;
      toast(`🚶 Hour ${hourMark} of the marathon — step away for 5 minutes? Beyond 2h, XP pays at 75%.`, "info", 12000);
    }
  }, [isRunning, mode, totalFocusSec, activeSeconds, toast]);

  const handleSessionTypeSelected = useCallback((type: SessionType) => {
    setSessionType(type);
    if (type === "recharge") { window.location.href = "/breathe"; return; }
    playCoachVoice("session_start");
    // Analytics: track session start (fired when user picks session type)
    trackSessionStart(type, totalFocusSec, activeTasks.length > 0);
    setShowLockPicker(true);
  }, [totalFocusSec, activeTasks.length]);

  const handleCompleteEarly = useCallback(async () => {
    if (mode !== "focus") return;
    const activeSeconds = getActiveSeconds();
    if (activeSeconds < 10) {
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
      { id: `early-${Date.now()}`, mode: "focus", completedAt: new Date().toISOString(), durationSeconds: actualSec, focusScore: null, focusQuality: null, focusTimeline: null, stabilityRating: null, sessionInsights: null },
      dbSessionId,
      { plannedDurationSec: plannedSec, completedEarly: true, completionPercentage: pct ?? 0, sessionStatus: "completed_early" }
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
      setSummaryData({ durationSeconds: actualSec, completedTaskCount: completedTasks.length, focusScore: null, earnedXp: res.earnedXp ?? 0, earnedCoins: res.earnedCoins ?? 0, completedEarly: true, completionPercentage: pct });
      setShowSummary(true);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    } else if (res.offline) {
      toast(`Saved ${Math.floor(actualSec / 60)}m locally (offline)`, "info");
    } else {
      toast("Failed to save session progress", "error");
    }
  }, [mode, getActiveSeconds, totalFocusSec, persistence, reset, toast, completedTasks.length]);

  const handleReset = useCallback(() => {
    const snap = getSnapshot();
    if (snap.status === "running" && snap.mode === "focus") { setShowExitConfirm(true); return; }
    persistence.clearDbSession();
    reset(false);
    setLockMode("none");
    setExitPhrase("");
  }, [status, mode, persistence, reset]);

  const handleCancelNoSave = useCallback(() => {
    setShowExitConfirm(false);
    setShowDistractionModal(true);
    // Analytics: track abandoned session
    if (mode === "focus") {
      trackSessionAbandoned(Math.floor(getActiveSeconds()), "user_exit");
    }
    persistence.clearDbSession();
    reset(false);
    setLockMode("none");
    setExitPhrase("");
  }, [persistence, reset, mode, getActiveSeconds]);

  const handleLockExit = useCallback(() => { setShowExitConfirm(true); }, []);

  const handleEditTime = () => {
    if (status !== "idle") return;
    const currentMins = Math.floor(secondsLeft / 60);
    const input = prompt(`Enter custom duration for ${mode} (in minutes):`, currentMins.toString());
    if (input) {
      const val = parseInt(input, 10);
      if (!isNaN(val) && val > 0 && val <= 240) {
        // Free users limited to 15,25,50 — premium 10-180
        if (!isPremium && mode === "focus" && ![15,25,50].includes(val) && (val < 10 || val > 50)) {
          toast("Custom 10-180m is Premium only. Free: 15, 25, 50m.", "error");
          return;
        }
        setCustomDuration(mode, val * 60);
        setSessionPreset("custom");
        setPresetIdState("custom");
      } else toast("Please enter a valid number of minutes (1-240).", "error");
    }
  };

  if (!recoveryReady) {
    return (
      <div className="w-full max-w-md">
        <div className="rounded-[2rem] border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/80 p-8 shadow-2xl">
          <motion.div animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ repeat: Infinity, duration: 1.5 }}
            className="mx-auto h-52 w-52 rounded-full bg-[var(--palette-zinc-800)]/40" />
          <p className="mt-6 text-center text-sm text-[var(--palette-zinc-500)]">Loading arena…</p>
        </div>
      </div>
    );
  }

  // Wallet / level data
  const totalXp = wallet?.totalXp ?? 0;
  const coins = wallet?.coins ?? 0;
  const level = getLevel(totalXp);
  const xpStart = xpForLevel(level);
  const xpEnd = xpForNextLevel(level);
  const xpPct = Math.min(100, Math.round(((totalXp - xpStart) / (xpEnd - xpStart)) * 100));
  const avatar = getLevelAvatar(level);
  const typeTint = isRunning ? SESSION_TYPE_TINTS[sessionType] : null;

  const modeUi = MODEUI[mode];

  return (
    <>
    <div className="flex w-full flex-col items-center gap-6 md:flex-row md:items-start md:gap-8">

    {/* ── MAIN TIMER CARD ─────────────────────────────────────────────── */}
    <motion.section
      layout
      animate={justCompleted ? { scale: [1, 1.02, 1] } : { scale: 1 }}
      className="w-full max-w-md shrink-0"
      transition={{ type: "spring", stiffness: 260, damping: 32 }}
    >
      <div
        className={`relative overflow-hidden rounded-[2rem] border bg-[var(--palette-0d0f17)] ${
          isMarathon ? "border-[var(--brand-400)]/45"
          : isRunning ? "border-[var(--palette-violet-500)]/30"
          : "border-[var(--palette-zinc-800)]/80"
        } shadow-[0_32px_80px_-24px_var(--rgba-0-0-0-0_7)]`}
        style={typeTint ? { borderColor: `color-mix(in srgb, ${typeTint.accent} 21%, transparent)` } : undefined}
      >
        {/* Animated background orb when running */}
        {isRunning && (
          <motion.div
            className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full opacity-20 blur-3xl"
            animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.25, 0.15] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            style={{ background: typeTint?.accent ?? "var(--brand-600)" }}
          />
        )}
        {/* Workstream H: marathon pulse — slow heartbeat glow on the card */}
        {isMarathon && !prefersReducedMotion && (
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-[2rem]"
            animate={{
              boxShadow: [
                "0 0 0 0 var(--rgba-167-139-250-0_0)",
                "0 0 44px 3px var(--rgba-167-139-250-0_4)",
                "0 0 0 0 var(--rgba-167-139-250-0_0)",
              ],
            }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          />
        )}

        {/* ── PLAYER HUD ──────────────────────────────────────────────── */}
        <div className="relative px-6 pt-5 pb-3 border-b border-[var(--palette-zinc-800)]/60">
          <div className="flex items-center gap-3">
            {/* Avatar + level */}
            <div className="relative flex-shrink-0">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--palette-zinc-800)]/80 text-2xl border border-[var(--palette-zinc-700)]/50 shadow-inner">
                {avatar}
              </div>
              <div className="absolute -bottom-1 -right-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--palette-violet-600)] text-[10px] font-semibold text-[var(--palette-white)] px-1 border border-[var(--palette-0d0f17)]">
                {level}
              </div>
            </div>

            {/* XP bar + info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-[var(--palette-zinc-300)]">Level {level}</span>
                <span className="text-[10px] text-[var(--palette-zinc-500)]">{totalXp.toLocaleString()} XP</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-[var(--palette-zinc-800)] overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--palette-violet-500)] to-[var(--palette-fuchsia-500)]"
                  initial={false}
                  animate={{ width: `${xpPct}%` }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                />
              </div>
              <div className="mt-1 flex items-center gap-3 text-[10px] text-[var(--palette-zinc-600)]">
                <span>{xpEnd - totalXp} XP to level {level + 1}</span>
              </div>
            </div>

            {/* Coins */}
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <div className="flex items-center gap-1 rounded-lg bg-[var(--palette-yellow-500)]/10 border border-[var(--palette-yellow-500)]/20 px-2 py-1">
                <span className="text-sm">🪙</span>
                <span className="text-xs font-bold text-[var(--palette-yellow-400)]">{coins.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Streak row */}
          <div className="mt-3 flex items-center justify-between">
            {currentStreak > 0 ? (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.3 }}
                className="flex items-center gap-1.5 rounded-full border border-[var(--palette-orange-500)]/25 bg-[var(--palette-orange-500)]/10 px-3 py-1 text-xs font-bold text-[var(--palette-orange-400)]"
              >
                🔥 {currentStreak}-day streak
              </motion.div>
            ) : (
              <div className="text-[11px] text-[var(--palette-zinc-600)]">Start your streak today!</div>
            )}
            <div className="text-[11px] text-[var(--palette-zinc-600)]">
              {storageReady ? focusSessionsToday : 0} block{(storageReady ? focusSessionsToday : 0) !== 1 ? "s" : ""} today
            </div>
          </div>
        </div>

        {/* ── MODE TABS ───────────────────────────────────────────────── */}
        {isFlow ? (
          <div className="relative px-4 pt-4">
            <FlowTimer
              taskName={activeTaskName}
              onFinish={handleSessionRecorded}
              onExitPreset={() => applyPreset("pomodoro")}
            />
          </div>
        ) : (
        <div className="relative px-4 pt-4">
          <div className="flex gap-1.5 rounded-xl bg-[var(--palette-zinc-950)]/60 p-1 ring-1 ring-[var(--palette-zinc-800)]/50">
            {MODES.map((m) => {
              const active = mode === m;
              const ui = MODEUI[m];
              return (
                <button
                  key={m}
                  type="button"
                  disabled={!canPickMode}
                  onClick={() => selectMode(m)}
                  className={`relative z-[var(--z-content)] flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-semibold transition-all ${
                    active ? "text-[var(--palette-zinc-50)]" : "text-[var(--palette-zinc-500)] hover:text-[var(--palette-zinc-300)] disabled:cursor-not-allowed disabled:opacity-40"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="mode-pill"
                      className="absolute inset-0 -z-[var(--z-content)] rounded-lg bg-[var(--palette-zinc-800)]/90 ring-1 ring-[var(--palette-white)]/5 shadow-inner shadow-[var(--palette-black)]/30"
                      transition={{ type: "spring", stiffness: 400, damping: 36 }}
                    />
                  )}
                  <span>{ui.icon}</span>
                  <span className="hidden sm:inline">{ui.label}</span>
                </button>
              );
            })}
          </div>

          {/* Session presets (9.1): Pomodoro, Extended, Deep, Animedoro, Flow, Custom */}
          {mode === "focus" && status === "idle" && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Session mode">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--palette-zinc-600)] mr-0.5">
                Mode
              </span>
              {SESSION_PRESETS.map((p) => {
                const active = presetId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p.id)}
                    title={p.blurb}
                    aria-pressed={active}
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-bold transition-all min-h-[28px] ${
                      active
                        ? "border-[var(--brand-400)]/50 bg-[var(--rgba-124-58-237-0_15)] text-[var(--brand-400)]"
                        : "border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/60 text-[var(--palette-zinc-500)] hover:text-[var(--palette-zinc-300)]"
                    }`}
                  >
                    {p.label}{p.focusMin ? ` ${p.focusMin}m` : ""}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={handleEditTime}
                className="rounded-full border border-dashed border-[var(--palette-zinc-700)] px-2.5 py-1 text-[10px] font-bold text-[var(--palette-zinc-500)] hover:text-[var(--palette-zinc-300)] min-h-[28px]"
              >
                Custom…
              </button>
            </div>
          )}
        </div>
        )}

        {/* ── TIMER DISPLAY ───────────────────────────────────────────── */}
        {!isFlow && (
        <div className="flex flex-col items-center px-6 pb-2">
          {isRunning && mode === "focus" && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 w-full"
            >
              <div className="flex items-center justify-between mb-1 text-[10px] font-bold uppercase tracking-wider">
                <span className="text-[var(--palette-zinc-600)]">Procrastination HP</span>
                <span className="text-[var(--palette-rose-400)]">{Math.round((1 - progress) * 100)}% defeated</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--palette-zinc-800)]">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--palette-rose-600)] to-[var(--palette-rose-400)]"
                  initial={false}
                  animate={{ width: `${(1 - progress) * 100}%` }}
                  transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
                />
              </div>
            </motion.div>
          )}

          <div className="mt-4">
            <TimerDisplay
              secondsLeft={secondsLeft}
              progress={progress}
              mode={mode}
              isRunning={isRunning}
              onEditClick={status === "idle" ? handleEditTime : undefined}
              sessionType={sessionType}
              activeSecondsEarned={activeSeconds}
            />
          </div>

          {/* Session dots */}
          <div className="mt-2 flex flex-col items-center gap-1">
            <SessionDots
              completed={completedFocusSessions}
              total={DEFAULT_CONFIG.sessionsBeforeLongBreak}
            />
            <p className="text-[10px] text-[var(--palette-zinc-600)] font-medium">
              {completedFocusSessions}/{DEFAULT_CONFIG.sessionsBeforeLongBreak} rounds
            </p>
          </div>

          {/* Deep-linked / chosen task — the visible intention line on desktop */}
          {activeTaskName ? (
            <div className="mt-2 flex max-w-full items-center gap-2 rounded-full border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/60 px-3 py-1.5">
              <span className="truncate text-[11px] font-semibold text-[var(--palette-zinc-200)]">{activeTaskName}</span>
              <button
                type="button"
                onClick={() => setActiveTaskName("")}
                aria-label="Clear current task"
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[var(--palette-zinc-500)] hover:text-[var(--palette-zinc-200)]"
              >
                ×
              </button>
            </div>
          ) : null}

          {/* Controls */}
          <TimerControls
            status={status}
            mode={mode}
            onToggle={handleToggle}
            onReset={handleReset}
            onSkip={skipToNext}
          />

          {/* Complete Early */}
          <AnimatePresence>
            {isRunning && mode === "focus" && (
              <motion.button
                key="complete-early"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15 }}
                onClick={() => setShowExitConfirm(true)}
                className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--palette-emerald-500)]/25 bg-[var(--palette-emerald-500)]/8 px-4 py-2.5 text-xs font-bold text-[var(--palette-emerald-400)] transition-all hover:bg-[var(--palette-emerald-500)]/15 hover:border-[var(--palette-emerald-500)]/45 active:scale-95"
                type="button"
              >
                <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Complete Session Early
              </motion.button>
            )}
          </AnimatePresence>

          {/* Notification bell */}
          {notificationPermission === "default" && (
            <button
              type="button"
              onClick={() => void requestNotificationAlerts()}
              className="mt-3 rounded-lg border border-[var(--palette-zinc-800)] px-3 py-1.5 text-[11px] text-[var(--palette-zinc-500)] transition-colors hover:border-[var(--palette-zinc-700)] hover:text-[var(--palette-zinc-300)]"
            >
              🔔 Enable session alerts
            </button>
          )}

          {/* Zen mode */}
          <button
            type="button"
            onClick={() => setShowZen(true)}
            className="mt-3 flex items-center gap-2 rounded-xl border border-[var(--palette-violet-500)]/25 bg-[var(--palette-violet-500)]/8 px-4 py-2.5 text-xs font-bold text-[var(--palette-violet-400)] transition-all hover:border-[var(--palette-violet-500)]/45 hover:bg-[var(--palette-violet-500)]/15 active:scale-95"
          >
            🧘 Zen Mode
            <span className="text-[10px] font-medium text-[var(--palette-zinc-600)]">full-screen focus</span>
          </button>

          {/* Distraction parking — jot it, review at the break */}
          <button
            type="button"
            onClick={() => setShowDistractionModal(true)}
            title="Park a distracting thought for the break (D)"
            className="mt-3 flex items-center gap-2 rounded-xl border border-[var(--palette-zinc-800)] px-4 py-2.5 text-xs font-bold text-[var(--palette-zinc-500)] transition-colors hover:border-[var(--palette-zinc-700)] hover:text-[var(--palette-zinc-300)]"
          >
            📝 Park a thought
            <kbd className="rounded border border-[var(--palette-zinc-700)] px-1 text-[10px] font-bold">D</kbd>
          </button>

          {/* Document PiP mini-timer (desktop Chrome/Edge) */}
          {pipSupported && status !== "idle" && (
            <button
              type="button"
              onClick={popOutMiniTimer}
              className="mt-3 flex items-center gap-2 rounded-xl border border-[var(--palette-zinc-800)] px-4 py-2.5 text-xs font-bold text-[var(--palette-zinc-500)] transition-colors hover:border-[var(--palette-zinc-700)] hover:text-[var(--palette-zinc-300)]"
            >
              🗔 Pop out mini-timer
            </button>
          )}
        </div>
        )}

        {/* ── BOTTOM STRIP ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-t border-[var(--palette-zinc-800)]/60 px-5 py-3">
          <SoundEngine
            sessionActive={isRunning && mode === "focus"}
            sessionMinutesLeft={Math.floor(secondsLeft / 60)}
            sessionTotalMinutes={Math.floor(totalFocusSec / 60)}
          />
          <AnimatePresence mode="wait">
            <motion.p
              key={`${mode}-${status}`}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -4 }}
              transition={{ duration: 0.15 }}
              className={`text-xs font-semibold ${modeUi.accent}`}
            >
              {isSaving ? (
                <span className="flex items-center gap-1.5 text-[var(--palette-zinc-500)]">
                  <span className="h-1.5 w-1.5 animate-ping rounded-full bg-[var(--palette-zinc-400)]/60" />
                  Saving…
                </span>
              ) : status === "running" ? (
                <>{modeUi.icon} {getModeLabel(mode)} in progress</>
              ) : status === "paused" ? (
                <>⏸ Paused</>
              ) : mode === "focus" ? (
                <>Press play to enter the arena</>
              ) : (
                <>Ready for {getModeLabel(mode).toLowerCase()}</>
              )}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </motion.section>

    {/* ── RIGHT COLUMN ────────────────────────────────────────────────── */}
    <div className="flex w-full max-w-md flex-col gap-4">

      {/* Ambient mixer — always visible on desktop, no scrolling needed */}
      <div className="hidden lg:block">
        <AmbientSoundBar />
      </div>

      {/* Break Activity Card */}
      <AnimatePresence>
        {isRunning && (mode === "break" || mode === "longBreak") && (
          <motion.div
            key="break-activity"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <BreakActivityCard
              mode={mode}
              secondsLeft={secondsLeft}
              breakDurationSeconds={mode === "longBreak" ? DEFAULT_CONFIG.longBreakDuration : DEFAULT_CONFIG.breakDuration}
            />
          </motion.div>
        )}
      </AnimatePresence>


      {/* Premium Rituals */}
      <TimerRitualsPanel
        currentFocusMin={Math.floor(secondsLeft / 60)}
        onCustomDuration={(mins) => setCustomDuration("focus", mins * 60)}
        onSelectTemplate={(t) => {
          setCustomDuration("focus", t.focusMin * 60);
          setCustomDuration("break", t.breakMin * 60);
          setCustomDuration("longBreak", t.longBreakMin * 60);
          toast(`Template ${t.name} applied — ${t.focusMin}m focus`, "success");
        }}
      />

      {/* Task Timeline */}
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
        onOverrun={(task, mins) => { setOverrunTask({ text: task.text }); setOverrunMinutes(mins); }}
        onEstimateChange={() => { void refreshTasks(); }}
      />

      {/* ── PET COMPANION — below task timeline in right column ──────── */}
      <AnimatePresence>
        {mode === "focus" && (
          <motion.div
            key="pet-companion-main"
            initial={{ opacity: 0, y: 24, scale: 0.88 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.92 }}
            transition={{ duration: 0.4, type: "spring", stiffness: 240, damping: 24 }}
            className="flex justify-center py-4"
          >
            <PetCompanion
              isRunning={isRunning}
              elapsedSeconds={isRunning ? (totalFocusSec - secondsLeft) : 0}
              mode={mode}
              progress={progress}
              sessionDurationSeconds={totalFocusSec}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </div>

    {/* Ambient Sound Bar — floating pill on mobile/tablet (hidden on lg where the panel lives) */}
    <AmbientSoundBar />

    {/* ── OVERLAYS ──────────────────────────────────────────────────── */}
    <AnimatePresence>
      {showZen && (
        <ZenOverlay
          secondsLeft={secondsLeft}
          progress={progress}
          mode={mode}
          isRunning={isRunning}
          accent={typeTint?.accent ?? (mode === "break" ? "var(--palette-emerald-500)" : mode === "longBreak" ? "var(--palette-violet-500)" : "var(--brand-600)")}
          onToggle={toggle}
          onExit={() => setShowZen(false)}
        />
      )}
    </AnimatePresence>

    <SessionTypePicker
      open={showSessionTypePicker}
      onClose={() => setShowSessionTypePicker(false)}
      onSelect={handleSessionTypeSelected}
      selected={sessionType}
    />

    <AnimatePresence>
      {showLockPicker && (
        <LockModePicker
          onConfirm={(m, phrase) => { setLockMode(m); setExitPhrase(phrase); setShowLockPicker(false); toggle(); }}
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
        <DistractionModal onDone={() => setShowDistractionModal(false)} onSkip={() => setShowDistractionModal(false)} />
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

    {/* Workstream H: marathon micro-confirm (>2h) */}
    <AnimatePresence>
      {showMarathonConfirm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-[var(--palette-black)]/75 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.92, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: 10, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            className="w-full max-w-sm rounded-2xl border border-[var(--rgba-167-139-250-0_35)] bg-[var(--palette-0d0f17)] p-5 shadow-2xl"
          >
            <div className="mb-4 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--rgba-167-139-250-0_15)] ring-1 ring-[var(--rgba-167-139-250-0_3)] text-3xl">🏔️</div>
              <h3 className="text-sm font-semibold text-[var(--palette-zinc-100)]">Marathon ahead — {Math.floor(secondsLeft / 60)} minutes</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--palette-zinc-500)]">
                You're planning <span className="font-bold text-[var(--brand-400)]">more than 2 hours</span> of
                unbroken focus. Beyond the first 2h, XP and coins pay at 75%, and I'll nudge you for a break at
                every hour mark. Hydrate before you start.
              </p>
            </div>
            <div className="space-y-2">
              <button
                onClick={beginMarathonStart}
                className="w-full rounded-xl border border-[var(--brand-400)]/40 bg-[var(--rgba-124-58-237-0_15)] px-4 py-3 text-left transition-all hover:bg-[var(--rgba-124-58-237-0_25)]"
              >
                <p className="text-xs font-bold text-[var(--brand-400)]">🏔️ Let's ride the marathon</p>
                <p className="text-[10px] text-[var(--palette-zinc-500)] mt-0.5">Break nudges on · 75% XP beyond 2h</p>
              </button>
              <button
                onClick={() => { setShowMarathonConfirm(false); setCustomDuration(mode, 2 * 60 * 60); }}
                className="w-full rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/60 px-4 py-3 text-left transition-all hover:border-[var(--palette-violet-500)]/30"
              >
                <p className="text-xs font-bold text-[var(--palette-zinc-200)]"> Cap it at 2 hours</p>
                <p className="text-[10px] text-[var(--palette-zinc-600)] mt-0.5">Full XP rate the whole way</p>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Exit Confirmation */}
    <AnimatePresence>
      {showExitConfirm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-[var(--palette-black)]/75 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.92, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: 10, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            className="w-full max-w-xs rounded-2xl border border-[var(--palette-zinc-800)] bg-[var(--palette-0d0f17)] p-5 shadow-2xl"
          >
            <div className="mb-5 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--palette-amber-500)]/15 ring-1 ring-[var(--palette-amber-500)]/25 text-3xl">⚡</div>
              <h3 className="text-sm font-semibold text-[var(--palette-zinc-100)]">End focus session?</h3>
              <p className="mt-1 text-xs text-[var(--palette-zinc-500)]">
                You've focused for{" "}
                <span className="font-bold text-[var(--palette-emerald-400)]">
                  {Math.floor(getActiveSeconds() / 60)}m {Math.floor(getActiveSeconds() % 60)}s
                </span>
              </p>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => void handleCompleteEarly()}
                disabled={isSaving}
                className="w-full rounded-xl border border-[var(--palette-emerald-500)]/30 bg-[var(--palette-emerald-500)]/10 px-4 py-3 text-left transition-all hover:bg-[var(--palette-emerald-500)]/18 disabled:opacity-50"
              >
                <p className="text-xs font-bold text-[var(--palette-emerald-400)]">✅ Complete & Save Progress</p>
                <p className="text-[10px] text-[var(--palette-emerald-400)]/60 mt-0.5">Earn XP and coins for time spent</p>
              </button>
              <button
                onClick={() => setShowExitConfirm(false)}
                className="w-full rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/60 px-4 py-3 text-left transition-all hover:border-[var(--palette-violet-500)]/30"
              >
                <p className="text-xs font-bold text-[var(--palette-zinc-200)]">▶ Continue Session</p>
                <p className="text-[10px] text-[var(--palette-zinc-600)] mt-0.5">Keep the timer running</p>
              </button>
              <button
                onClick={handleCancelNoSave}
                className="w-full rounded-xl border border-[var(--palette-red-500)]/15 bg-[var(--palette-red-500)]/8 px-4 py-3 text-left transition-all hover:bg-[var(--palette-red-500)]/15"
              >
                <p className="text-xs font-bold text-[var(--palette-red-400)]">✕ Abandon Session</p>
                <p className="text-[10px] text-[var(--palette-red-400)]/60 mt-0.5">Discard all progress</p>
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
      streakDays={currentStreak}
      onStartBreak={() => { setShowSummary(false); skipToNext(); }}
      onKeepGoing={() => { setShowSummary(false); }}
      onClose={() => { setShowSummary(false); }}
    />

    <ReflectionModal
      open={showReflection}
      durationSeconds={reflectionDuration}
      onClose={() => setShowReflection(false)}
      onSubmit={(txt) => {
        if (isPremium) {
          const entry = { date: new Date().toISOString(), template: sessionType, intention, duration: reflectionDuration };
          setRitualHistory((h) => [entry, ...h].slice(0, 20));
          try { localStorage.setItem("focusarx-ritual-history", JSON.stringify([entry, ...ritualHistory].slice(0,20))); } catch {}
        }
        toast(txt ? "Reflection saved!" : "Session completed", "success");
        setShowReflection(false);
      }}
    />

    <XPBurst
      active={showConfetti}
      earnedXp={summaryData?.earnedXp ?? 0}
      earnedCoins={summaryData?.earnedCoins ?? 0}
    />

    <ConfettiCelebration active={showConfetti} count={90} duration={3500} />
    </>
  );
}
