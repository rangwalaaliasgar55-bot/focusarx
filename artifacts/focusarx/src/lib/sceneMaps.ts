/**
 * Scene data mappings (Phase 7.4 — Deep Sea + Study Room).
 *
 * Pure functions shared by the R3F scenes so every visual decision is
 * unit-testable and identical across tiers. All inputs derive from the
 * live session snapshot — never wall-clock decoration.
 */

export function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

/** Deep Sea: depth 0 (surface) → 1 (trench) follows elapsed time. */
export function seaDepth(pct: number): number {
  return clamp01(pct);
}

/** Creatures appear as uninterrupted work accumulates (25/50/75%). */
export function seaCreatures(pct: number): number {
  const p = clamp01(pct);
  return (p >= 0.25 ? 1 : 0) + (p >= 0.5 ? 1 : 0) + (p >= 0.75 ? 1 : 0);
}

/**
 * Camera depth offset. Tab-switch pulls the diver UP (visible penalty):
 * stale snapshots rise toward the surface regardless of progress.
 */
export function seaCameraY(pct: number, stale: boolean): number {
  const depth = seaDepth(pct);
  const surfaced = stale ? 0 : depth;
  return 2 - surfaced * 5;
}

/** Fog density thickens with depth (0.02 surface → 0.09 trench). */
export function seaFogDensity(pct: number): number {
  return 0.02 + seaDepth(pct) * 0.07;
}

/** Study Room: lamp glow follows progress (0.3 idle → 1.6 done). */
export function lampIntensity(pct: number, paused: boolean): number {
  const base = 0.3 + clamp01(pct) * 1.3;
  return paused ? base * 0.55 : base;
}

/** Window sky: dusk blue → night, driven by elapsed time. */
export function windowSky(pct: number): { top: string; bottom: string } {
  const p = clamp01(pct);
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * p);
  return {
    top: `rgb(${lerp(96, 8)},${lerp(125, 10)},${lerp(180, 40)})`,
    bottom: `rgb(${lerp(237, 30)},${lerp(178, 30)},${lerp(150, 70)})`,
  };
}

/** Books stacked per completed weekly session (cap 7). */
export function bookStack(weeklySessions: number): number {
  if (!Number.isFinite(weeklySessions)) return 0;
  return Math.min(7, Math.max(0, Math.floor(weeklySessions)));
}
