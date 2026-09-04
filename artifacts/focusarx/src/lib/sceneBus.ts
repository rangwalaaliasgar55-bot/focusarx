/**
 * Reactive scene bus (Phase 7 — Focus Core data layer).
 *
 * The scene is a visualisation of REAL session state, never decoration.
 * `usePomodoro` publishes throttled snapshots; any visual (3D Core, 2D
 * canvas, CSS Minimal Ring) subscribes via `useSceneState` and renders the
 * same meaning:
 *
 * - elapsedPct   → ring fill / core intensity / particle count
 * - paused       → dim + slow flicker (rings stop)
 * - stale        → tab hidden: desaturate + drift (visible penalty)
 * - complete     → burst, then re-form
 * - streak/facets→ satellites / weekly crystal structure
 *
 * Snapshots stop while the tab is hidden (Worker ticks stop), so staleness
 * doubles as the hidden-tab signal — no separate plumbing needed.
 */

import { useEffect, useState } from "react";
import type { TimerMode, TimerStatus } from "@/types/timer";

export const SCENE_SNAPSHOT_EVENT = "focusarx:scene-snapshot";
/** Fired once when a focus phase completes (burst, then re-form). */
export const SCENE_COMPLETE_EVENT = "focusarx:scene-complete";

export function publishSceneComplete(): void {
  try {
    window.dispatchEvent(new CustomEvent(SCENE_COMPLETE_EVENT));
  } catch {
    /* visuals must never break the timer */
  }
}

export interface SceneSnapshot {
  mode: TimerMode;
  status: Extract<TimerStatus, "running" | "paused" | "idle">;
  secondsLeft: number;
  totalSeconds: number;
  /** Wall-clock ms when published. */
  at: number;
}

export function publishSceneSnapshot(snap: Omit<SceneSnapshot, "at">): void {
  try {
    window.dispatchEvent(
      new CustomEvent(SCENE_SNAPSHOT_EVENT, {
        detail: { ...snap, at: Date.now() } satisfies SceneSnapshot,
      }),
    );
  } catch {
    /* visuals must never break the timer */
  }
}

/** Elapsed fraction 0..1 (clamped, NaN-proof). Same math every renderer uses. */
export function sceneElapsedPct(snap: Pick<SceneSnapshot, "secondsLeft" | "totalSeconds"> | null): number {
  if (!snap || !Number.isFinite(snap.secondsLeft) || !Number.isFinite(snap.totalSeconds)) return 0;
  if (snap.totalSeconds <= 0) return 0;
  const pct = 1 - snap.secondsLeft / snap.totalSeconds;
  return Math.min(1, Math.max(0, pct));
}

/** True when the snapshot is too old to be live (tab hidden, timer idle). */
export function sceneIsStale(snap: SceneSnapshot | null, now: number = Date.now()): boolean {
  if (!snap) return true;
  return now - snap.at > 2500;
}

/** Subscribe to live snapshots. Returns the latest (possibly stale) one. */
export function useSceneState(): SceneSnapshot | null {
  const [snap, setSnap] = useState<SceneSnapshot | null>(null);
  useEffect(() => {
    const handler = (e: Event) => {
      setSnap((e as CustomEvent<SceneSnapshot>).detail);
    };
    window.addEventListener(SCENE_SNAPSHOT_EVENT, handler);
    return () => window.removeEventListener(SCENE_SNAPSHOT_EVENT, handler);
  }, []);
  return snap;
}
