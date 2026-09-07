import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { formatTime } from "@/lib/timerUtils";
import { RollingClock } from "@/components/RollingClock";
import { getTimerSkin, skinTextGradient, type MembershipTier } from "@/lib/membershipSkin";
import type { TimerMode } from "@/types/timer";

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
}

/**
 * Timer face — Apple Clock / Fitness ring idiom.
 *
 * One ring, drawn with a rounded cap and a soft trailing shadow, over a quiet
 * inner disc. The digits use the display face with tabular figures and roll
 * per-glyph as they change (the way iOS's clock does), rather than a whole
 * string that re-renders and flashes. Everything that moves is transform or
 * opacity only, and every animation collapses under `prefers-reduced-motion`.
 *
 * Membership skins (see `lib/membershipSkin.ts`) tint the *focus* ring only:
 *   free  — solid brand ring
 *   plus  — brand → cyan gradient ring, slightly stronger halo
 *   pro   — violet → pink gradient, orbiting spark on the ring head
 *   elite — gold → amber gradient, spark, metallic digits, crown chip
 * Break / long-break always keep their green / blue so the rest-vs-work
 * signal is identical for every member.
 */
const SIZE = 300;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const EASE = [0.32, 0.72, 0, 1] as const;

const MODE_CONFIG: Record<TimerMode, { label: string; ring: string; ringSoft: string }> = {
  focus:     { label: "Focus",      ring: "var(--brand-500)",  ringSoft: "var(--brand-soft)" },
  break:     { label: "Break",      ring: "var(--success)",    ringSoft: "var(--success-soft)" },
  longBreak: { label: "Long break", ring: "var(--info)",       ringSoft: "var(--info-soft)" },
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
}: TimerDisplayProps) {
  const { minutes, seconds } = formatTime(secondsLeft);
  const modeCfg = MODE_CONFIG[mode];
  const skin = getTimerSkin(tier);
  const skinned = mode === "focus" && skin.tier !== "free";
  const ring = skinned ? skin.ring : modeCfg.ring;
  const ringAlt = skinned ? skin.ringAlt : modeCfg.ring;
  const track = skinned ? skin.track : modeCfg.ringSoft;
  const glow = skinned ? skin.glow : 0.22;
  const useGradient = skinned && skin.gradient;
  const reduced = !!useReducedMotion();
  const clamped = Math.min(1, Math.max(0, progress));
  const dashOffset = CIRCUMFERENCE * (1 - clamped);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const gradId = `ring-grad-${uid}`;
  const shadowId = `ring-shadow-${uid}`;

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

  const xpEarned = Math.floor(activeSecondsEarned / 60) * 20;
  const coinsEarned = Math.floor(activeSecondsEarned / 300) * 10;
  const label = sessionType ? sessionType.replace(/_/g, " ") : modeCfg.label;

  // Spark position on the ring head (Pro / Elite). The SVG is rotated -90°,
  // so angle 0 is 12 o'clock; progress sweeps clockwise.
  const sparkAngle = clamped * Math.PI * 2 - Math.PI / 2;
  const sparkX = SIZE / 2 + RADIUS * Math.cos(sparkAngle);
  const sparkY = SIZE / 2 + RADIUS * Math.sin(sparkAngle);
  const showSpark = skinned && skin.spark && isRunning && clamped > 0.002 && clamped < 0.998;

  return (
    <motion.div
      className="relative grid place-items-center"
      style={{ width: SIZE, height: SIZE }}
      initial={false}
      animate={{ scale: breathe ? 1.02 : 1 }}
      transition={{ duration: 0.7, ease: EASE }}
      data-tier={skin.tier}
    >
      {/* Ambient halo — breathes slowly only while running */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-[-12%] rounded-full"
        style={{
          background: useGradient
            ? `conic-gradient(from 180deg, color-mix(in srgb, ${ring} ${Math.round(glow * 100)}%, transparent), color-mix(in srgb, ${ringAlt} ${Math.round(glow * 100)}%, transparent), color-mix(in srgb, ${ring} ${Math.round(glow * 100)}%, transparent))`
            : `radial-gradient(circle, color-mix(in srgb, ${ring} ${Math.round(glow * 100)}%, transparent) 0%, transparent 62%)`,
          filter: "blur(24px)",
          maskImage: useGradient ? "radial-gradient(circle, black 0%, black 40%, transparent 68%)" : undefined,
          WebkitMaskImage: useGradient ? "radial-gradient(circle, black 0%, black 40%, transparent 68%)" : undefined,
        }}
        animate={isRunning && !reduced ? { opacity: [0.55, 0.9, 0.55], scale: [0.98, 1.03, 0.98], rotate: useGradient ? 360 : 0 } : { opacity: isRunning ? 0.7 : 0.35, scale: 1 }}
        transition={isRunning && !reduced
          ? { opacity: { duration: 4.2, repeat: Infinity, ease: "easeInOut" }, scale: { duration: 4.2, repeat: Infinity, ease: "easeInOut" }, rotate: { duration: 38, repeat: Infinity, ease: "linear" } }
          : { duration: 0.6 }}
      />

      {/* Inner disc */}
      <div
        aria-hidden
        className="absolute rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-md),inset_0_1px_0_color-mix(in_srgb,var(--neutral-0)_10%,transparent)]"
        style={{ inset: STROKE + 8 }}
      />

      {/* Ring */}
      <svg width={SIZE} height={SIZE} className="absolute inset-0 -rotate-90" aria-hidden>
        <defs>
          <filter id={shadowId} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation={skinned ? 3 + glow * 4 : 3} floodColor={ring} floodOpacity={skinned ? 0.55 : 0.45} />
          </filter>
          {useGradient && (
            <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={SIZE} y2={SIZE}>
              <stop offset="0%" stopColor={ring} />
              <stop offset="55%" stopColor={ringAlt} />
              <stop offset="100%" stopColor={ring} />
            </linearGradient>
          )}
        </defs>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke={track} strokeWidth={STROKE} />
        {/* Elite: faint tick marks every 5 minutes-worth of arc, like a chronograph bezel */}
        {skinned && skin.tier === "elite" && (
          <g opacity={0.35}>
            {Array.from({ length: 12 }, (_, i) => {
              const a = (i / 12) * Math.PI * 2;
              const r0 = RADIUS - STROKE / 2 - 5;
              const r1 = RADIUS - STROKE / 2 - 1;
              return (
                <line
                  key={i}
                  x1={SIZE / 2 + r0 * Math.cos(a)} y1={SIZE / 2 + r0 * Math.sin(a)}
                  x2={SIZE / 2 + r1 * Math.cos(a)} y2={SIZE / 2 + r1 * Math.sin(a)}
                  stroke={ring} strokeWidth={1.5} strokeLinecap="round"
                />
              );
            })}
          </g>
        )}
        <motion.circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={useGradient ? `url(#${gradId})` : ring}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          initial={false}
          animate={{ strokeDashoffset: dashOffset }}
          transition={reduced ? { duration: 0 } : { duration: isRunning ? 1 : 0.6, ease: isRunning ? "linear" : EASE }}
          filter={`url(#${shadowId})`}
        />
        {showSpark && (
          <motion.circle
            cx={sparkX}
            cy={sparkY}
            r={STROKE / 2 + 1.5}
            fill="var(--surface)"
            stroke={ringAlt}
            strokeWidth={2.5}
            initial={false}
            animate={reduced ? {} : { opacity: [0.85, 1, 0.85] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            style={{ filter: `drop-shadow(0 0 6px ${ringAlt})` }}
          />
        )}
      </svg>

      {/* Face */}
      <div className="relative z-[var(--z-content)] flex flex-col items-center text-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={`${isRunning}-${label}-${skin.tier}`}
            initial={reduced ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="mb-2 inline-flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.18em]"
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
                className="ml-1 inline-flex items-center gap-1 rounded-full px-1.5 py-[1px] text-[0.5625rem] font-bold tracking-[0.12em]"
                style={{
                  background: `color-mix(in srgb, ${ring} 14%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${ring} 35%, transparent)`,
                  color: ring,
                }}
                title={`${skin.label} member timer`}
              >
                {skin.glyph && <span aria-hidden className="text-[0.625rem] leading-none">{skin.glyph}</span>}
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
            aria-label={onEditClick ? `${minutes} minutes ${seconds} seconds remaining. Edit duration.` : `${minutes} minutes ${seconds} seconds remaining`}
            className="font-display text-[4.25rem] font-semibold leading-none tracking-[-0.055em] text-[var(--foreground)] tabular-nums outline-none transition-opacity disabled:cursor-default enabled:hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--brand-500)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--surface)] rounded-md"
            style={{
              fontFeatureSettings: '"tnum" 1, "ss01" 1',
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
          {isRunning ? "In progress" : "Ready"}
        </span>

        <AnimatePresence>
          {isRunning && mode === "focus" && activeSecondsEarned > 30 && (
            <motion.div
              initial={reduced ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="mt-2 flex items-center gap-2 text-[0.6875rem] font-semibold tabular-nums"
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
