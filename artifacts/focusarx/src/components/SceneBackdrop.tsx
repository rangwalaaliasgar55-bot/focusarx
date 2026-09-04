/**
 * Scene backdrop for /focus (Phase 6.1/7 — one signature, three tiers).
 *
 * - Tier Essential (or preset Minimal Ring): the live Minimal Ring —
 *   elapsed fill, paused dim, hidden-tab desaturation, completion burst,
 *   streak satellites, weekly facets. Same meaning as the 3D Core.
 * - Tier Full/Lite with Core preset: the existing ambient chamber glow
 *   (static radial, no new animation budget).
 *
 * Decorative only: aria-hidden, pointer-events-none, zero layout effect.
 */

import { useEffect, useState } from "react";
import MinimalRing, { type RingStatus } from "./MinimalRing";
import { SCENE_COMPLETE_EVENT, sceneElapsedPct, sceneIsStale, useSceneState } from "@/lib/sceneBus";
import { getDeviceTier } from "@/lib/deviceTier";
import { getScenePreset } from "@/lib/scenePreset";
import { weeklyFacets } from "@/lib/weeklyFacets";
import { useSessionHistory } from "@/hooks/useSessionHistory";
import { getToken } from "@/lib/auth";

function timeOfDayHue(): number {
  const h = new Date().getHours();
  // Cool morning → warm night: hue 222 (blue) → 28 (amber).
  if (h < 6) return 250;
  if (h < 12) return 222 - (h - 6) * 4;
  if (h < 18) return 198 - (h - 12) * 22;
  return Math.max(28, 66 - (h - 18) * 6);
}

export default function SceneBackdrop() {
  const snap = useSceneState();
  const { sessions } = useSessionHistory();
  const [tier] = useState(() => {
    try {
      return getDeviceTier();
    } catch {
      return "full" as const;
    }
  });
  const [preset, setPreset] = useState(getScenePreset);
  const [streak, setStreak] = useState(0);
  const [burstKey, setBurstKey] = useState(0);
  const [, forceStaleTick] = useState(0);

  useEffect(() => {
    const onPreset = (e: Event) => setPreset((e as CustomEvent).detail);
    const onComplete = () => setBurstKey((k) => k + 1);
    window.addEventListener("focusarx:scene-preset", onPreset);
    window.addEventListener(SCENE_COMPLETE_EVENT, onComplete);
    return () => {
      window.removeEventListener("focusarx:scene-preset", onPreset);
      window.removeEventListener(SCENE_COMPLETE_EVENT, onComplete);
    };
  }, []);

  // Re-render on a slow cadence so hidden-tab staleness visibly lands.
  useEffect(() => {
    const id = window.setInterval(() => forceStaleTick((t) => t + 1), 2000);
    return () => window.clearInterval(id);
  }, []);

  // Streak count (authed only, best-effort — the ring works without it).
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch("/api/streak", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { streak?: { currentStreak?: number } } | null) => {
        const n = d?.streak?.currentStreak;
        if (typeof n === "number" && Number.isFinite(n)) setStreak(Math.max(0, Math.floor(n)));
      })
      .catch(() => {});
  }, []);

  const showRing = tier === "essential" || preset === "minimal-ring";
  if (!showRing) {
    const hue = timeOfDayHue();
    return (
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[var(--z-background)]"
        style={{
          background: `radial-gradient(ellipse 60% 45% at 50% 32%, hsla(${hue}, 70%, 60%, 0.10) 0%, transparent 70%)`,
        }}
      />
    );
  }

  const stale = sceneIsStale(snap);
  const pct = sceneElapsedPct(snap);
  const status: RingStatus =
    burstKey > 0 && pct < 0.05 && snap?.status !== "running"
      ? "complete"
      : !snap || snap.status === "idle"
        ? "idle"
        : snap.status === "paused" || stale
          ? "paused"
          : "running";
  const facets = weeklyFacets(
    sessions.map((s) => ({ completedAt: s.completedAt, mode: s.mode })),
  );

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[var(--z-background)] flex items-start justify-center overflow-hidden pt-10 opacity-60"
    >
      <MinimalRing
        elapsedPct={pct}
        status={status}
        streakCount={streak}
        weekFacets={facets}
        stale={stale && snap?.status === "running"}
        burstKey={status === "complete" ? burstKey : 0}
        size={300}
      />
    </div>
  );
}
