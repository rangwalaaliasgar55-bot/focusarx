/**
 * Minimal Ring (Phase 6.1 Tier-C default scene + Phase 7 preset).
 *
 * The same session meaning as the 3D Core, rendered as a CSS
 * conic-gradient ring with opacity fades only — zero GPU cost:
 *
 * - elapsedPct  → ring fill angle + glow intensity
 * - paused      → dims to 0.3-opacity stillness (flicker off when
 *                 reduced-motion; opacity-only per Tier C)
 * - stale       → desaturated (visible hidden-tab penalty)
 * - complete    → one-shot particle burst, then re-forms
 * - streak      → satellite dots in stable orbit (cap 30, then a halo)
 * - weekFacets  → 7 outer ticks, lit per completed day
 */

export type RingStatus = "running" | "paused" | "idle" | "complete";

export interface MinimalRingProps {
  elapsedPct: number;
  status: RingStatus;
  /** Current streak (satellites, capped at 30 → halo). */
  streakCount?: number;
  /** Last-7-days completion flags, oldest → today. */
  weekFacets?: boolean[];
  /** Hidden-tab penalty state. */
  stale?: boolean;
  /** px diameter. */
  size?: number;
  /** Change to retrigger the completion burst. */
  burstKey?: number | string;
}

const SATELLITE_CAP = 30;

export function clampPct(p: number): number {
  if (!Number.isFinite(p)) return 0;
  return Math.min(1, Math.max(0, p));
}

export default function MinimalRing({
  elapsedPct,
  status,
  streakCount = 0,
  weekFacets = [],
  stale = false,
  size = 320,
  burstKey,
}: MinimalRingProps) {
  const pct = clampPct(elapsedPct);
  const safeStreak = Number.isFinite(streakCount) ? Math.max(0, Math.floor(streakCount)) : 0;
  const satellites = Math.min(safeStreak, SATELLITE_CAP);
  const halo = safeStreak > SATELLITE_CAP;
  const complete = status === "complete";
  const dimmed = status === "paused" || status === "idle";

  const angle = Math.round(pct * 360);
  const glow = 0.25 + pct * 0.75;

  return (
    <div
      role="img"
      aria-label={
        complete
          ? "Session complete"
          : status === "paused"
            ? `Paused at ${Math.round(pct * 100)} percent`
            : `${Math.round(pct * 100)} percent elapsed`
      }
      className={stale ? "scene-stale" : undefined}
      style={{
        width: size,
        height: size,
        position: "relative",
        opacity: complete ? 1 : dimmed ? 0.55 : 0.4 + glow * 0.6,
        transition: "opacity 600ms",
      }}
    >
      {/* progress ring */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: `conic-gradient(var(--brand-500) ${angle}deg, rgba(255,255,255,0.08) ${angle}deg)`,
          filter: `drop-shadow(0 0 ${Math.round(12 + glow * 28)}px rgba(124,58,237,${(0.25 + glow * 0.45).toFixed(2)}))`,
          WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 14px), black calc(100% - 13px))",
          mask: "radial-gradient(farthest-side, transparent calc(100% - 14px), black calc(100% - 13px))",
        }}
      />
      {/* weekly facet ticks */}
      {Array.from({ length: 7 }).map((_, i) => {
        const lit = weekFacets[i] === true;
        const a = (i / 7) * Math.PI * 2 - Math.PI / 2;
        const r = size / 2 + 16;
        return (
          <div
            key={i}
            aria-hidden
            style={{
              position: "absolute",
              left: size / 2 + Math.cos(a) * r - 3,
              top: size / 2 + Math.sin(a) * r - 3,
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: lit ? "var(--brand-400)" : "rgba(255,255,255,0.12)",
              opacity: lit ? 1 : 0.6,
            }}
          />
        );
      })}
      {/* streak satellites (stable orbit positions, cap 30, then a halo) */}
      {halo ? (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: -10,
            borderRadius: "50%",
            border: "1px solid rgba(167,139,250,0.5)",
          }}
        />
      ) : (
        Array.from({ length: satellites }).map((_, i) => {
          const a = (i / Math.max(1, satellites)) * Math.PI * 2;
          const r = size / 2 - 26;
          return (
            <div
              key={i}
              aria-hidden
              style={{
                position: "absolute",
                left: size / 2 + Math.cos(a) * r - 2,
                top: size / 2 + Math.sin(a) * r - 2,
                width: 4,
                height: 4,
                borderRadius: "50%",
                background: "var(--brand-300)",
                opacity: 0.9,
              }}
            />
          );
        })
      )}
      {/* completion burst (one-shot; remounts on burstKey change) */}
      {complete && (
        <div key={String(burstKey)} aria-hidden className="scene-burst" style={{ position: "absolute", inset: 0 }} />
      )}
      {/* core glow */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: size * 0.32,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.5) 0%, transparent 70%)",
          opacity: complete ? 1 : 0.35 + glow * 0.5,
        }}
      />
    </div>
  );
}
