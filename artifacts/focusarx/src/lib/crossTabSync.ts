/**
 * Cross-tab timer mirror (P0.3 — one timer across tabs).
 *
 * `timerLeader` elects a single leading tab via `navigator.locks`; this
 * module is the follower side of that contract. The leader broadcasts a
 * 1 Hz state heartbeat on the shared channel; every other tab mirrors it so
 * a second tab shows the live session ("Running in another tab · 24:31")
 * instead of a dead duplicate clock.
 *
 * Protocol (same envelope `timerLeader` already posts):
 *   - `state`    leader heartbeat: { mode, status, secondsLeft, deadlineMs, totalSeconds }
 *   - `complete` leader recorded a phase (followers clear, heartbeats resume for the next phase)
 *   - `resign`   leader stood down (posted by `timerLeader` on release)
 *   - `leader`   claim announcements — ignored here
 *
 * Rules: never throw, never surface NaN (all numbers validated + clamped),
 * ignore own tabId, ignore malformed payloads. A mirror with no heartbeat
 * for MIRROR_STALE_MS is dead (leader crashed — locks auto-release, so no
 * resign ever arrives) and must be dropped.
 */

import type { TimerMode, TimerStatus } from "@/types/timer";

/** Shared channel with `timerLeader`'s claim/resign announcements. */
export const TIMER_SYNC_CHANNEL = "focusarx-timer";

/** Heartbeats arrive ~1 Hz; three missed beats means the leader is gone. */
export const MIRROR_STALE_MS = 3000;

export interface LeaderMirror {
  tabId: string;
  mode: TimerMode;
  status: Extract<TimerStatus, "running" | "paused">;
  /** Point-in-time slice; prefer the wall-clock derivation below. */
  secondsLeft: number;
  /** Wall-clock deadline for `running` mirrors; null for `paused`. */
  deadlineMs: number | null;
  totalSeconds: number;
  receivedAt: number;
}

const VALID_MODES: ReadonlySet<string> = new Set(["focus", "break", "longBreak"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toClampedInt(value: unknown, fallback: number, min: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.floor(n));
}

function readStatePayload(raw: unknown): Omit<LeaderMirror, "tabId" | "receivedAt"> | null {
  if (!isRecord(raw)) return null;
  if (!VALID_MODES.has(String(raw.mode))) return null;
  if (raw.status !== "running" && raw.status !== "paused") return null;
  const deadlineMs = raw.status === "running" ? toClampedInt(raw.deadlineMs, NaN, 0) : null;
  if (raw.status === "running" && !Number.isFinite(deadlineMs)) return null;
  return {
    mode: raw.mode as TimerMode,
    status: raw.status,
    secondsLeft: toClampedInt(raw.secondsLeft, 0, 0),
    deadlineMs,
    totalSeconds: toClampedInt(raw.totalSeconds, 1, 1),
  };
}

function post(type: string, tabId: string, payload: Record<string, unknown>): void {
  try {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(TIMER_SYNC_CHANNEL);
    ch.postMessage({ type, payload, timestamp: Date.now(), tabId });
    ch.close();
  } catch {
    /* BroadcastChannel unavailable — the timer never depends on it */
  }
}

/** Leader heartbeat (~1 Hz while running). Fire-and-forget. */
export function broadcastLeaderState(
  tabId: string,
  snapshot: { mode: TimerMode; status: "running"; secondsLeft: number; deadlineMs: number; totalSeconds: number },
): void {
  post("state", tabId, { ...snapshot });
}

/** Leader recorded a phase. Followers clear; next-phase heartbeats resume. */
export function broadcastLeaderComplete(tabId: string, mode: TimerMode): void {
  post("complete", tabId, { mode });
}

export type LeaderSyncHandlers = {
  ownTabId: string;
  onMirror: (mirror: LeaderMirror) => void;
  onResign: (tabId: string) => void;
  onComplete: (tabId: string) => void;
};

/** Subscribe to foreign leader traffic. Returns an unsubscribe function. */
export function subscribeToLeader(handlers: LeaderSyncHandlers): () => void {
  const noop = () => {};
  try {
    if (typeof BroadcastChannel === "undefined") return noop;
    const ch = new BroadcastChannel(TIMER_SYNC_CHANNEL);
    ch.onmessage = (event: MessageEvent) => {
      try {
        const msg = event?.data;
        if (!isRecord(msg)) return;
        if (typeof msg.tabId !== "string" || msg.tabId === handlers.ownTabId) return;
        if (msg.type === "state") {
          const payload = readStatePayload(msg.payload);
          if (!payload) return;
          handlers.onMirror({ ...payload, tabId: msg.tabId, receivedAt: Date.now() });
        } else if (msg.type === "resign") {
          handlers.onResign(msg.tabId);
        } else if (msg.type === "complete") {
          handlers.onComplete(msg.tabId);
        }
      } catch {
        /* a bad message must never break the timer */
      }
    };
    return () => {
      try { ch.close(); } catch { /* ignore */ }
    };
  } catch {
    return noop;
  }
}

/** True when the leader has missed ~3 heartbeats (crashed or closed). */
export function isMirrorStale(mirror: LeaderMirror, now: number = Date.now()): boolean {
  return now - mirror.receivedAt > MIRROR_STALE_MS;
}

/**
 * Live remaining seconds for a mirror. Wall-clock derived from the
 * leader's deadline (sleep/clock-safe); falls back to the point-in-time
 * slice for paused mirrors, which carry no deadline.
 */
export function deriveMirrorSeconds(mirror: LeaderMirror, now: number = Date.now()): number {
  if (typeof mirror.deadlineMs === "number" && Number.isFinite(mirror.deadlineMs)) {
    return Math.max(0, Math.ceil((mirror.deadlineMs - now) / 1000));
  }
  return Math.max(0, Math.floor(mirror.secondsLeft));
}
