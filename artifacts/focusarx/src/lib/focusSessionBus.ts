import { useSyncExternalStore } from "react";
import type { TimerMode } from "@/types/timer";

/**
 * Live timer state shared with the rest of the interface.
 *
 * Both timer implementations (`Timer.tsx` on desktop, `FocusTimerMobileFirst`
 * on phones) own their own `usePomodoro` instance. Anything outside them that
 * wants to react to the running session — the battle arena, the YouTube
 * companion, the topbar's live pill — used to receive hardcoded `isActive=false`
 * props and therefore never activated. Publishing a snapshot here lets those
 * surfaces subscribe without threading props through three lazy boundaries.
 *
 * The bus is intentionally tiny: a module-level snapshot + listeners, read via
 * `useSyncExternalStore`, so subscribers re-render only when the snapshot
 * reference changes (once per timer tick while running, otherwise never).
 */
export type FocusSessionState = {
  /** True only while a *focus* block is actively running. */
  active: boolean;
  mode: TimerMode;
  status: "idle" | "running" | "paused";
  secondsLeft: number;
  totalSeconds: number;
  /** 0–100, progress through the current block. */
  progress: number;
};

const IDLE: FocusSessionState = {
  active: false,
  mode: "focus",
  status: "idle",
  secondsLeft: 0,
  totalSeconds: 0,
  progress: 0,
};

let snapshot: FocusSessionState = IDLE;
const listeners = new Set<() => void>();

export function publishFocusState(next: Omit<FocusSessionState, "active" | "progress">) {
  const total = Math.max(1, next.totalSeconds);
  const progress = Math.min(100, Math.max(0, ((total - next.secondsLeft) / total) * 100));
  const active = next.status === "running" && next.mode === "focus";
  const candidate: FocusSessionState = { ...next, active, progress };
  const prev = snapshot;
  if (
    prev.active === candidate.active &&
    prev.mode === candidate.mode &&
    prev.status === candidate.status &&
    prev.secondsLeft === candidate.secondsLeft &&
    prev.totalSeconds === candidate.totalSeconds
  ) {
    return;
  }
  snapshot = candidate;
  listeners.forEach((listener) => listener());
}

export function resetFocusState() {
  if (snapshot === IDLE) return;
  snapshot = IDLE;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot() {
  return IDLE;
}

export function useFocusSessionState(): FocusSessionState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function formatClock(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safe / 60).toString().padStart(2, "0");
  const s = (safe % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
