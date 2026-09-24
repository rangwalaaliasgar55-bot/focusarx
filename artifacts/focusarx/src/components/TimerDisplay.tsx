import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { formatTime } from "@/lib/timerUtils";
import { computeSessionRewards } from "@/lib/sessionRewards";
import { RollingClock } from "@/components/RollingClock";
import { getTimerSkin, skinTextGradient, type MembershipTier } from "@/lib/membershipSkin";
import type { TimerTheme } from "@/lib/timerTheme";
import { useNow } from "@/hooks/useNow";
import type { TimerMode } from "@/types/timer";
import { FlipClockDisplay } from "@/components/FlipClockDisplay";
import { TimerFaceBars, TimerFaceDots, TimerFaceRounds, TimerFaceSegments } from "@/components/timerfaces/TimerFaces";

interface TimerDisplayProps {
  secondsLeft: number;
  progress: number;
  mode: TimerMode;
  isRunning: boolean;
  onEditClick?: () => void;
  sessionType?: string;
  activeSecondsEarned?: number;
  /** Cosmetic membership tier — drives the ring skin. Defaults to `free`. */
  tier?: MembershipTier;
  /** Cosmetic face design (Classic / Neon / Zen). Paid skins override it. */
  theme?: TimerTheme;
  /** Fires the completion burst for one beat. Owned by the timer, not the ring. */
  justCompleted?: boolean;
}

/**
 * Timer face — the centrepiece of the product.
 *
 * The ring is a real instrument rather than a progress bar bent into a circle:
 *
 *   • a **gradient arc** traces the mode's hue over a recessed track, so the
 *     countdown has direction and colour instead of one flat stroke;
 *   • a **head node** rides the tip of the arc while running — the eye tracks
 *     motion, so the session's progress is legible at a glance from across a
 *     room without reading a single digit;
 *   • a **breathing halo** sits behind everything, tinted to the mode and
 *     brightening while the clock runs, so "working" and "resting" are
 *     distinguishable by colour and rhythm alone;
 *   • **minute ticks** around the bezel give the empty track a scale, which is
 *     what makes a ring read as a clock face rather than a loading spinner.
 *
 * Everything that moves is transform/opacity, every animation collapses under
 * `prefers-reduced-motion`, and the finish-time label and accessible name are
 * unchanged (see `TimerDisplay.test.tsx`).
 *
 * `theme === "segments"` and `theme === "bars"` hand the whole face to
 * `timerfaces/TimerFaces.tsx` — different layouts rather than different colours,
 * wired through the same `AnimatePresence` so switching a face cross-fades
 * instead of snapping.
 *
 * Membership skins (see `lib/membershipSkin.ts`) tint the focus ring:
 *   free  — solid brand ring
 *   plus  — brand → cyan gradient ring, stronger halo
 *   pro   — violet → pink gradient, head node
 *   elite — gold → amber gradient, node, metallic digits, crown chip
 * Break / long-break always keep their green / blue so the rest-vs-work
 * signal is identical for every member.
 */

/**
 * Natural-language remaining time for the accessible name.
 *
 * The visible digits are zero-padded for the clock face (`05:00`), but an
 * `aria-label` built from them reads "zero five minutes zero zero seconds" —
 * the padding is a typographic device, not a spoken one. Unit-less values are
 * dropped so the common case is just "5 minutes remaining".
 */
function spokenRemaining(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  const parts: string[] = [];
  if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
  if (seconds > 0 || minutes === 0) parts.push(`${seconds} ${seconds === 1 ? "second" : "seconds"}`);
  return `${parts.join(" ")} remaining`;
}

function formatEndTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

const SIZE = 300;
const STROKE = 14;
const EASE = [0.32, 0.72, 0, 1] as const;

interface ModePalette {
  label: string;
  /** Primary arc colour. */
  ring: string;
  /** Second gradient stop — only used when `gradient` is on. */
  ringAlt: string;
  /** Recessed track behind the arc. */
  track: string;
  /** Halo tint. */
  glow: string;
  label2: string;
}

const MODE_CONFIG: Record<TimerMode, ModePalette & { gradient: boolean }> = {
  focus: {
    label: "Focus",
    ring: "var(--brand-500)",
    ringAlt: "var(--brand-violet)",
    track: "var(--brand-soft)",
    glow: "var(--brand-500)",
    gradient: true,
    label2: "focus",
  },
  break: {
    label: "Break",
    ring: "var(--success)",
    ringAlt: "var(--palette-teal-300, var(--success))",
    track: "var(--success-soft)",
    glow: "var(--success)",
    gradient: true,
    label2: "break",
  },
  longBreak: {
    label: "Long break",
    ring: "var(--info)",
    ringAlt: "var(--palette-sky-300, var(--info))",
    track: "var(--info-soft)",
    glow: "var(--info)",
    gradient: true,
    label2: "long break",
  },
};

export function TimerDisplay({
  secondsLeft,
  progress,
  mode,
  isRunning,
  onEditClick,
  sessionType,
  activeSecondsEarned = 0,
  tier = "free",
  theme = "classic",
  justCompleted = false,
}: TimerDisplayProps) {
  const { minutes, seconds } = formatTime(secondsLeft);
  const modeCfg = MODE_CONFIG[mode];
  const skin = getTimerSkin(tier);
  const skinned = mode === "focus" && skin.tier !== "free";
  const ring = skinned ? skin.ring : modeCfg.ring;
  const ringAlt = skinned ? skin.ringAlt : modeCfg.ringAlt;
  const track = skinned ? skin.track : modeCfg.track;
  const glowColor = skinned ? skin.ring : modeCfg.glow;
  const glow = skinned ? skin.glow : theme === "neon" ? 0.34 : theme === "zen" ? 0.08 : 0.22;
  // A gradient arc is the default face now; Zen deliberately opts out of every
  // flourish (thinner stroke, no gradient, no head node) and is the one design
  // that is purely a line and a number.
  const zen = !skinned && theme === "zen";
  const useGradient = !zen && (skinned ? skin.gradient : true);
  const strokeWidth = zen ? 8 : STROKE;
  const radius = (SIZE - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const reduced = !!useReducedMotion();
  const clamped = Math.min(1, Math.max(0, progress));
  const dashOffset = circumference * (1 - clamped);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const gradId = `ring-grad-${uid}`;
  const shadowId = `ring-shadow-${uid}`;
  const haloId = `ring-halo-${uid}`;

  // A single soft breath when the timer starts, not a per-second pulse.
  const wasRunning = useRef(isRunning);
  const [breathe, setBreathe] = useState(false);
  useEffect(() => {
    if (isRunning && !wasRunning.current && !reduced) {
      setBreathe(true);
      const t = setTimeout(() => setBreathe(false), 700);
      return () => clearTimeout(t);
    }
    wasRunning.current = isRunning;
  }, [isRunning, reduced]);

  // Wall-clock finish label, read from the shared 1 Hz clock. `now + secondsLeft`
  // is invariant while the clock runs, so the label is stable rather than
  // counting down — which is exactly the point: the user wants the fixed
  // instant they are working towards, not another moving number.
  const now = useNow(isRunning);
  const endsAt = now === null ? null : formatEndTime(now + secondsLeft * 1000);

  // What this session will actually pay — the server's own arithmetic, mirrored
  // in lib/sessionRewards (drift-tested against the api-server source). The
  // previous flat `minutes * 20` / `blocks * 10` ignored the 2-hour taper, the
  // 25-minute bonus and the premium multipliers, so a long session showed a
  // number the wallet would never receive.
  const projected = computeSessionRewards({
    minutes: activeSecondsEarned / 60,
    isPremium: tier !== "free",
  });
  const xpEarned = projected.xp;
  const coinsEarned = projected.coins;
  const label = sessionType ? sessionType.replace(/_/g, " ") : modeCfg.label;

  // Head node position. The SVG is rotated -90°, so angle 0 is 12 o'clock and
  // progress sweeps clockwise.
  const sparkAngle = clamped * Math.PI * 2 - Math.PI / 2;
  const sparkX = SIZE / 2 + radius * Math.cos(sparkAngle);
  const sparkY = SIZE / 2 + radius * Math.sin(sparkAngle);
  const showSpark = clamped > 0.004 && clamped < 0.996;
  // Zen has no node; members with the spark flag get an extra pulsing halo on
  // the node so a paid face still reads as the fancier one.
  const sparkRing = skinned && skin.spark;

  if (!skinned && theme === "flip") {
    return (
      <FlipClockDisplay
        secondsLeft={secondsLeft}
        mode={mode}
        isRunning={isRunning}
        onEditClick={onEditClick}
        sessionType={sessionType}
      />
    );
  }

  // Layout faces own the whole face, skin or not: the geometry is the point, and
  // a membership skin only supplies the accent colour it is drawn in. They are
  // listed once, here, so a face added to the registry cannot silently render as
  // a ring because this branch was not extended.
  const LAYOUT_FACES = new Set<TimerTheme>(["segments", "bars", "dots", "rounds"]);
  if (LAYOUT_FACES.has(theme)) {
    const FaceProps = {
      secondsLeft,
      mode,
      isRunning,
      progress: clamped,
      onEditClick,
      sessionType,
      accent: ring,
      accentSoft: track,
    };
    return (
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={theme}
          initial={reduced ? false : { opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.01 }}
          transition={{ duration: 0.25, ease: EASE }}
        >
          {theme === "segments" ? <TimerFaceSegments {...FaceProps} />
            : theme === "bars" ? <TimerFaceBars {...FaceProps} />
            : theme === "dots" ? <TimerFaceDots {...FaceProps} />
            : <TimerFaceRounds {...FaceProps} />}
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <motion.div
      className="relative grid place-items-center"
      style={{ width: SIZE, height: SIZE }}
      initial={false}
      animate={{ scale: breathe ? 1.025 : 1 }}
      transition={{ duration: 0.25, ease: EASE }}
      data-tier={skin.tier}
      data-mode={mode}
    >
      {/* Ambient halo — breathes slowly while running, tints to the mode */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-[-12%] rounded-full"
        style={{
          background: `conic-gradient(from 180deg, color-mix(in srgb, ${glowColor} ${Math.round(glow * 100)}%, transparent), color-mix(in srgb, ${ringAlt} ${Math.round(glow * 100)}%, transparent), color-mix(in srgb, ${glowColor} ${Math.round(glow * 100)}%, transparent))`,
          filter: "blur(26px)",
          maskImage: "radial-gradient(circle, black 0%, black 38%, transparent 68%)",
          WebkitMaskImage: "radial-gradient(circle, black 0%, black 38%, transparent 68%)",
        }}
        animate={
          isRunning && !reduced && !zen
            ? { opacity: [0.55, 0.95, 0.55], scale: [0.98, 1.04, 0.98], rotate: 360 }
            : { opacity: zen ? 0.16 : isRunning ? 0.75 : 0.4, scale: 1 }
        }
        transition={
          isRunning && !reduced
            ? {
                opacity: { duration: 4.2, repeat: Infinity, ease: "easeInOut" },
                scale: { duration: 4.2, repeat: Infinity, ease: "easeInOut" },
                rotate: { duration: 38, repeat: Infinity, ease: "linear" },
              }
            : { duration: 0.25 }
        }
      />

      {/* Inner disc — one tone step down from the card, plus a faint radial
          lift under the digits so the face has a floor rather than sitting
          flat on the panel. */}
      <div
        aria-hidden
        className="absolute rounded-full border border-[var(--border-subtle)] bg-[var(--surface-1)]"
        style={{
          inset: STROKE + 8,
          boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--neutral-0) 8%, transparent), inset 0 -18px 36px -24px color-mix(in srgb, var(--foreground) 30%, transparent)",
          backgroundImage: `radial-gradient(circle at 50% 78%, color-mix(in srgb, ${glowColor} ${Math.round((zen ? 0.04 : 0.1) * 100)}%, transparent) 0%, transparent 62%)`,
        }}
      />

      {/* Ring */}
      <svg width={SIZE} height={SIZE} className="absolute inset-0 -rotate-90" aria-hidden>
        <defs>
          <filter id={shadowId} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow
              dx="0"
              dy="0"
              stdDeviation={zen ? 2 : skinned ? 3 + glow * 4 : 3}
              floodColor={ring}
              floodOpacity={zen ? 0.25 : skinned ? 0.55 : 0.45}
            />
          </filter>
          {/* Wide, faint copy of the arc used for the halo pass: one extra
              draw, no compositor layer, and it keeps the glow attached to the
              progress rather than washing the whole circle. */}
          <filter id={haloId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={zen ? 3 : 8} />
          </filter>
          {useGradient && (
            <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={SIZE} y2={SIZE}>
              <stop offset="0%" stopColor={ring} />
              <stop offset="55%" stopColor={ringAlt} />
              <stop offset="100%" stopColor={ring} />
            </linearGradient>
          )}
        </defs>

        {/* Track */}
        <circle cx={SIZE / 2} cy={SIZE / 2} r={radius} fill="none" stroke={track} strokeWidth={strokeWidth} />

        {/* Bezel ticks — twelve marks, every fifth one longer. Gives the empty
            track a scale so the ring reads as a clock face. Hidden in Zen. */}
        {!zen && (
          <g opacity={0.32}>
            {Array.from({ length: 60 }, (_, i) => {
              const major = i % 5 === 0;
              const a = (i / 60) * Math.PI * 2;
              const r1 = radius + strokeWidth / 2 + 3;
              const r0 = r1 + (major ? 5 : 2.5);
              return (
                <line
                  key={i}
                  x1={SIZE / 2 + r0 * Math.cos(a)}
                  y1={SIZE / 2 + r0 * Math.sin(a)}
                  x2={SIZE / 2 + r1 * Math.cos(a)}
                  y2={SIZE / 2 + r1 * Math.sin(a)}
                  stroke={major ? ring : "var(--border-strong)"}
                  strokeWidth={major ? 1.5 : 1}
                  strokeLinecap="round"
                  opacity={major ? 0.75 : 0.5}
                />
              );
            })}
          </g>
        )}

        {/* Elite: a slightly heavier bezel, like a chronograph. */}
        {skinned && skin.tier === "elite" && (
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={radius + strokeWidth / 2 + 8}
            fill="none"
            stroke={ring}
            strokeWidth={1}
            opacity={0.35}
          />
        )}

        {/* Halo pass — the same arc, blurred, drawn only while running. */}
        {isRunning && !zen && clamped > 0.01 && (
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={radius}
            fill="none"
            stroke={useGradient ? `url(#${gradId})` : ring}
            strokeWidth={strokeWidth + 6}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            filter={`url(#${haloId})`}
            opacity={0.5}
          />
        )}

        {/* Progress arc */}
        <motion.circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={radius}
          fill="none"
          stroke={useGradient ? `url(#${gradId})` : ring}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={false}
          animate={{ strokeDashoffset: dashOffset }}
          transition={reduced ? { duration: 0 } : { duration: isRunning ? 1 : 0.6, ease: isRunning ? "linear" : EASE }}
          filter={`url(#${shadowId})`}
        />

        {/* Head node — the tip of the arc. Tracks motion, so progress is
            readable without reading the digits. */}
        {!zen && showSpark && (
          <g>
            {sparkRing && (
              <motion.circle
                cx={sparkX}
                cy={sparkY}
                r={STROKE * 0.85}
                fill={ringAlt}
                opacity={0.35}
                initial={false}
                animate={reduced ? {} : { r: [STROKE * 0.7, STROKE * 1.1, STROKE * 0.7], opacity: [0.4, 0.12, 0.4] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
            <circle cx={sparkX} cy={sparkY} r={STROKE / 2 + 2.5} fill="var(--surface-1)" />
            <circle cx={sparkX} cy={sparkY} r={(STROKE / 2 + 2.5) * 0.62} fill={useGradient ? ringAlt : ring} />
          </g>
        )}
      </svg>

      {/* Completion burst — one expanding ring, once, on the phase boundary. */}
      <AnimatePresence>
        {justCompleted && !reduced && (
          <motion.div
            aria-hidden
            key="burst"
            className="pointer-events-none absolute rounded-full border-2"
            style={{ inset: 0, borderColor: ring }}
            initial={{ opacity: 0.9, scale: 0.92 }}
            animate={{ opacity: 0, scale: 1.35 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>

      {/* Face */}
      <div className="relative z-[var(--z-content)] flex flex-col items-center text-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={`${isRunning}-${label}-${skin.tier}`}
            initial={reduced ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: ring }}
          >
            {isRunning && (
              <motion.span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: ring }}
                animate={reduced ? {} : { opacity: [1, 0.35, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
            {label}
            {skinned && (
              <span
                className="ml-1 inline-flex items-center gap-1 rounded-full px-1.5 py-[1px] text-[11px] font-bold tracking-[0.12em]"
                style={{
                  background: `color-mix(in srgb, ${ring} 14%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${ring} 35%, transparent)`,
                  color: ring,
                }}
                title={`${skin.label} member timer`}
              >
                {skin.glyph && <span aria-hidden className="text-[11px] leading-none">{skin.glyph}</span>}
                {skin.label}
              </span>
            )}
          </motion.span>
        </AnimatePresence>

        <div className="group relative flex items-center">
          <button
            type="button"
            onClick={onEditClick}
            disabled={!onEditClick || isRunning}
            aria-label={[
              `${spokenRemaining(secondsLeft)}.`,
              onEditClick ? "Edit duration." : null,
              endsAt ? `Finishes at ${endsAt}.` : null,
            ]
              .filter(Boolean)
              .join(" ")}
            className="rounded-md font-display text-[4.25rem] font-semibold leading-none tracking-[-0.055em] text-[var(--foreground)] tabular-nums outline-none transition-opacity disabled:cursor-default enabled:hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--brand-500)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--surface)]"
            style={{
              fontFeatureSettings: '"tnum" 1, "ss01" 1',
              textShadow: zen ? undefined : `0 0 34px color-mix(in srgb, ${glowColor} 26%, transparent)`,
              ...(skinned && skin.metallicDigits
                ? {
                    backgroundImage: skinTextGradient(skin),
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                    WebkitTextFillColor: "transparent",
                    filter: `drop-shadow(0 1px 0 color-mix(in srgb, ${ring} 35%, transparent))`,
                  }
                : {}),
            }}
          >
            <RollingClock value={`${minutes}:${seconds}`} />
          </button>
          {onEditClick && !isRunning && (
            <span
              aria-hidden
              className="pointer-events-none absolute -right-8 top-1/2 -translate-y-1/2 text-[var(--foreground-subtle)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            >
              <Pencil size={14} />
            </span>
          )}
        </div>

        <span className="mt-2 text-xs font-medium text-[var(--foreground-subtle)]">
          {isRunning ? (endsAt ? <>In progress <span aria-hidden="true">·</span> ends {endsAt}</> : "In progress") : "Ready"}
        </span>

        <AnimatePresence>
          {isRunning && mode === "focus" && activeSecondsEarned > 30 && (
            <motion.div
              initial={reduced ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="mt-2 flex items-center gap-2 text-[11px] font-semibold tabular-nums"
            >
              <span className="text-[var(--brand-strong)]">+{xpEarned} XP</span>
              <span className="text-[var(--foreground-subtle)]">·</span>
              <span className="text-[var(--brand-gold)]">+{coinsEarned} coins</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
