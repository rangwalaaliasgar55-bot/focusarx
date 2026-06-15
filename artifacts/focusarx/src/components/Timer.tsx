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
import { XPBurst } from "./XPBurst";
import { getToken } from "@/lib/auth";
import { useCoinXP } from "./CoinXPBar";
import PetCompanion from "./PetCompanion";

const MODES: TimerMode[] = ["focus", "break", "longBreak"];

const MODEUI: Record<TimerMode, { icon: string; label: string; accent: string; pill: string }> = {
  focus:     { icon: "⚔️", label: "Focus",      accent: "text-rose-400",    pill: "bg-rose-500/15 border-rose-500/30 text-rose-300" },
  break:     { icon: "☕", label: "Break",      accent: "text-emerald-400", pill: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300" },
  longBreak: { icon: "🌙", label: "Long Break", accent: "text-violet-400",  pill: "bg-violet-500/15 border-violet-500/30 text-violet-300" },
};

const LEVEL_AVATARS = ["🌱","⚡","🔥","💎","🌟","👑","🦅","🚀","🌌","🏆"];
function getLevelAvatar(level: number) { return LEVEL_AVATARS[Math.min(Math.floor((level - 1) / 5), LEVEL_AVATARS.length - 1)] ?? "🌱"; }
function getLevel(xp: number) { return Math.floor(Math.sqrt(xp / 100)) + 1; }
function xpForLevel(level: number) { return (level - 1) ** 2 * 100; }
function xpForNextLevel(level: number) { return level ** 2 * 100; }

const playSessionNotification = (mode: TimerMode) => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
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

export default function Timer({ onSessionComplete: onSessionCompleteProp }: { onSessionComplete?: () => void } = {}) {
  const { addSession, focusSessionsToday } = useSessionHistory();
  const { toast } = useToast();
  const { requestMonitorRecovery, monitorEnabled } = useSessionRecovery();
  const { activeTasks, completedTasks, refreshTasks } = useTasks();
  const { wallet, refresh: refreshWallet } = useCoinXP();

  const [storageReady, setStorageReady] = useState(false);
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
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("unsupported");
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
  const [overrunTask, setOverrunTask] = useState<{ text: string } | null>(null);
  const [overrunMinutes, setOverrunMinutes] = useState(0);

  monitorEnabledRef.current = monitorEnabled;

  useEffect(() => { setStorageReady(true); }, []);

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

  const {
    mode, status, secondsLeft, progress, completedFocusSessions,
    toggle, reset, skipToNext, selectMode, setCustomDuration,
    getSnapshot, restoreFromSnapshot, getActiveSeconds,
  } = usePomodoro({
    onSessionComplete: async (session) => {
      addSession(session);
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
        setTimeout(() => setShowConfetti(false), 3500);
        onSessionCompleteProp?.();
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
    setNotificationPermission("Notification" in window ? Notification.permission : "unsupported");
  }, []);

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

  const isRunning = status === "running";
  const canPickMode = status !== "running";
  const activeSeconds = isRunning ? getActiveSeconds() : 0;

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
    if (type === "recharge") { window.location.href = "/breathe"; return; }
    setShowLockPicker(true);
  }, []);

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

  const savePartialSessionIfNeeded = useCallback(() => {
    if (mode !== "focus") return;
    const activeSeconds = getActiveSeconds();
    if (activeSeconds < 60) return;
    const dbSessionId = persistenceRef.current?.getDbSessionId() ?? null;
    void syncFocusSessionToCloud(
      { id: `partial-${Date.now()}`, mode: "focus", completedAt: new Date().toISOString(), durationSeconds: Math.floor(activeSeconds), focusScore: null, focusQuality: null, focusTimeline: null, stabilityRating: null, sessionInsights: null },
      dbSessionId
    ).then((res) => {
      if (res.success) toast(`Saved ${Math.floor(activeSeconds / 60)}m of focus time`, "info");
    });
  }, [mode, getActiveSeconds, toast]);

  const handleReset = useCallback(() => {
    if (status === "running" && mode === "focus") { setShowExitConfirm(true); return; }
    persistence.clearDbSession();
    reset(false);
    setLockMode("none");
    setExitPhrase("");
  }, [status, mode, persistence, reset]);

  const handleCancelNoSave = useCallback(() => {
    setShowExitConfirm(false);
    setShowDistractionModal(true);
    persistence.clearDbSession();
    reset(false);
    setLockMode("none");
    setExitPhrase("");
  }, [persistence, reset]);

  const handleLockExit = useCallback(() => { setShowExitConfirm(true); }, []);

  const handleEditTime = () => {
    if (status !== "idle") return;
    const currentMins = Math.floor(secondsLeft / 60);
    const input = prompt(`Enter custom duration for ${mode} (in minutes):`, currentMins.toString());
    if (input) {
      const val = parseInt(input, 10);
      if (!isNaN(val) && val > 0 && val <= 180) setCustomDuration(mode, val * 60);
      else toast("Please enter a valid number of minutes (1-180).", "error");
    }
  };

  if (!recoveryReady) {
    return (
      <div className="w-full max-w-md">
        <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900/80 p-8 shadow-2xl">
          <motion.div animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ repeat: Infinity, duration: 1.5 }}
            className="mx-auto h-52 w-52 rounded-full bg-zinc-800/40" />
          <p className="mt-6 text-center text-sm text-zinc-500">Loading arena…</p>
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
        className={`relative overflow-hidden rounded-[2rem] border bg-[#0d0f17] ${isRunning ? "border-violet-500/30" : "border-zinc-800/80"} shadow-[0_32px_80px_-24px_rgba(0,0,0,0.7)]`}
        style={typeTint ? { borderColor: `${typeTint.accent}35` } : undefined}
      >
        {/* Animated background orb when running */}
        {isRunning && (
          <motion.div
            className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full opacity-20 blur-3xl"
            animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.25, 0.15] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            style={{ background: typeTint?.accent ?? "#7C3AED" }}
          />
        )}

        {/* ── PLAYER HUD ──────────────────────────────────────────────── */}
        <div className="relative px-6 pt-5 pb-3 border-b border-zinc-800/60">
          <div className="flex items-center gap-3">
            {/* Avatar + level */}
            <div className="relative flex-shrink-0">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-800/80 text-2xl border border-zinc-700/50 shadow-inner">
                {avatar}
              </div>
              <div className="absolute -bottom-1 -right-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-violet-600 text-[10px] font-black text-white px-1 border border-[#0d0f17]">
                {level}
              </div>
            </div>

            {/* XP bar + info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-zinc-300">Level {level}</span>
                <span className="text-[10px] text-zinc-500">{totalXp.toLocaleString()} XP</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                  initial={false}
                  animate={{ width: `${xpPct}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
              <div className="mt-1 flex items-center gap-3 text-[10px] text-zinc-600">
                <span>{xpEnd - totalXp} XP to level {level + 1}</span>
              </div>
            </div>

            {/* Coins */}
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <div className="flex items-center gap-1 rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-2 py-1">
                <span className="text-sm">🪙</span>
                <span className="text-xs font-bold text-yellow-400">{coins.toLocaleString()}</span>
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
                className="flex items-center gap-1.5 rounded-full border border-orange-500/25 bg-orange-500/10 px-3 py-1 text-xs font-bold text-orange-400"
              >
                🔥 {currentStreak}-day streak
              </motion.div>
            ) : (
              <div className="text-[11px] text-zinc-600">Start your streak today!</div>
            )}
            <div className="text-[11px] text-zinc-600">
              {storageReady ? focusSessionsToday : 0} block{(storageReady ? focusSessionsToday : 0) !== 1 ? "s" : ""} today
            </div>
          </div>
        </div>

        {/* ── MODE TABS ───────────────────────────────────────────────── */}
        <div className="relative px-4 pt-4">
          <div className="flex gap-1.5 rounded-xl bg-zinc-950/60 p-1 ring-1 ring-zinc-800/50">
            {MODES.map((m) => {
              const active = mode === m;
              const ui = MODEUI[m];
              return (
                <button
                  key={m}
                  type="button"
                  disabled={!canPickMode}
                  onClick={() => selectMode(m)}
                  className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-semibold transition-all ${
                    active ? "text-zinc-50" : "text-zinc-500 hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-40"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="mode-pill"
                      className="absolute inset-0 -z-10 rounded-lg bg-zinc-800/90 ring-1 ring-white/5 shadow-inner shadow-black/30"
                      transition={{ type: "spring", stiffness: 400, damping: 36 }}
                    />
                  )}
                  <span>{ui.icon}</span>
                  <span className="hidden sm:inline">{ui.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── TIMER DISPLAY ───────────────────────────────────────────── */}
        <div className="flex flex-col items-center px-6 pb-2">
          {isRunning && mode === "focus" && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 w-full"
            >
              <div className="flex items-center justify-between mb-1 text-[10px] font-bold uppercase tracking-wider">
                <span className="text-zinc-600">Procrastination HP</span>
                <span className="text-rose-400">{Math.round((1 - progress) * 100)}% defeated</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-rose-600 to-rose-400"
                  initial={false}
                  animate={{ width: `${(1 - progress) * 100}%` }}
                  transition={{ duration: 0.9, ease: [0.22, 0.61, 0.36, 1] }}
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
            <p className="text-[10px] text-zinc-600 font-medium">
              {completedFocusSessions}/{DEFAULT_CONFIG.sessionsBeforeLongBreak} rounds
            </p>
          </div>

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
                transition={{ duration: 0.2 }}
                onClick={() => setShowExitConfirm(true)}
                className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-4 py-2.5 text-xs font-bold text-emerald-400 transition-all hover:bg-emerald-500/15 hover:border-emerald-500/45 active:scale-95"
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
              className="mt-3 rounded-lg border border-zinc-800 px-3 py-1.5 text-[11px] text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-300"
            >
              🔔 Enable session alerts
            </button>
          )}
        </div>

        {/* ── BOTTOM STRIP ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-t border-zinc-800/60 px-5 py-3">
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
              transition={{ duration: 0.2 }}
              className={`text-xs font-semibold ${modeUi.accent}`}
            >
              {isSaving ? (
                <span className="flex items-center gap-1.5 text-zinc-500">
                  <span className="h-1.5 w-1.5 animate-ping rounded-full bg-zinc-400/60" />
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

      {/* Break Activity Card */}
      <AnimatePresence>
        {isRunning && (mode === "break" || mode === "longBreak") && (
          <motion.div
            key="break-activity"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
          >
            <BreakActivityCard
              mode={mode}
              secondsLeft={secondsLeft}
              breakDurationSeconds={mode === "longBreak" ? DEFAULT_CONFIG.longBreakDuration : DEFAULT_CONFIG.breakDuration}
            />
          </motion.div>
        )}
      </AnimatePresence>


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
            transition={{ duration: 0.45, type: "spring", stiffness: 240, damping: 24 }}
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

    {/* Ambient Sound Bar */}
    <AmbientSoundBar visible={true} />

    {/* ── OVERLAYS ──────────────────────────────────────────────────── */}
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

    {/* Exit Confirmation */}
    <AnimatePresence>
      {showExitConfirm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.92, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: 10, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            className="w-full max-w-xs rounded-2xl border border-zinc-800 bg-[#0d0f17] p-5 shadow-2xl"
          >
            <div className="mb-5 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 ring-1 ring-amber-500/25 text-3xl">⚡</div>
              <h3 className="text-sm font-black text-zinc-100">End focus session?</h3>
              <p className="mt-1 text-xs text-zinc-500">
                You've focused for{" "}
                <span className="font-bold text-emerald-400">
                  {Math.floor(getActiveSeconds() / 60)}m {Math.floor(getActiveSeconds() % 60)}s
                </span>
              </p>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => void handleCompleteEarly()}
                disabled={isSaving}
                className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-left transition-all hover:bg-emerald-500/18 disabled:opacity-50"
              >
                <p className="text-xs font-bold text-emerald-400">✅ Complete & Save Progress</p>
                <p className="text-[10px] text-emerald-400/60 mt-0.5">Earn XP and coins for time spent</p>
              </button>
              <button
                onClick={() => setShowExitConfirm(false)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-left transition-all hover:border-violet-500/30"
              >
                <p className="text-xs font-bold text-zinc-200">▶ Continue Session</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">Keep the timer running</p>
              </button>
              <button
                onClick={handleCancelNoSave}
                className="w-full rounded-xl border border-red-500/15 bg-red-500/8 px-4 py-3 text-left transition-all hover:bg-red-500/15"
              >
                <p className="text-xs font-bold text-red-400">✕ Abandon Session</p>
                <p className="text-[10px] text-red-400/60 mt-0.5">Discard all progress</p>
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

    <XPBurst
      active={showConfetti}
      earnedXp={summaryData?.earnedXp ?? 0}
      earnedCoins={summaryData?.earnedCoins ?? 0}
    />

    <ConfettiCelebration active={showConfetti} count={90} duration={3500} />
    </>
  );
}
