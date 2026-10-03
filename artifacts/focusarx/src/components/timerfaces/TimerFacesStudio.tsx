import { useId, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Flag, PawPrint } from "lucide-react";
import { RollingClock } from "@/components/RollingClock";
import { AnimalGlyph } from "@/components/pets/AnimalGlyph";
import { useActivePet } from "@/hooks/useActivePet";
import { formatTime } from "@/lib/timerUtils";
import { petBodyParams } from "@/lib/petBodyParams";
import { EditHint, sessionTotal, useFaceLabels, type TimerFaceProps } from "@/components/timerfaces/TimerFaces";

/**
 * The ported faces — Analog, Aurora, Orbit, Hourglass, Companion trail and Garden.
 *
 * These are the timer faces from the PR #99 design uploads, rebuilt against the
 * contract the existing four layout faces already share
 * (`components/timerfaces/TimerFaces.tsx`): the same props, the same
 * `RollingClock` readout, the same spoken label + finish time, the same rule
 * that the picture is `aria-hidden` and the button carries the meaning.
 *
 * They are faces, not decorations — each one answers "how much is left" in a
 * different grammar, which is the only reason to add one:
 *
 *   • **Aurora**  — the ring family, with the elapsed edge lit and a travelling
 *                   head. Reads like the classic dial but with direction.
 *   • **Orbit**   — the countdown as a body on a rail. Units are laps, not
 *                   degrees: one full orbit is the session.
 *   • **Hourglass** — falling sand. The oldest way to show time running out,
 *                   and still the clearest at a glance from across a room.
 *   • **Companion trail** — the animal one. Your pet walks a track from start
 *                   to finish; the distance left *is* the time left, and the
 *                   animal is the same body the 3D stage draws.
 *   • **Garden**  — a stem grows and a flower opens petal by petal, one petal
 *                   per remaining block. A growing thing, for breaks.
 *   • **Analog**  — the wedge dial with a hand: a wall clock that answers one
 *                   question, including its own scale at twelve o'clock.
 *
 * Design gates that shape the code (see src/quiet-interface.test.ts and
 * src/legibility.test.ts): no `backdrop-blur`, no `shadow-[0_0_…]` glow, no
 * `bg-gradient-to-*` from a brand hue, text never below 11px. Gradients that
 * carry meaning (a ring's arc, sand's fall) are inline SVG fills, which is where
 * a gradient is information rather than atmosphere.
 */

/* ────────────────────────────── shared bits ────────────────────────────── */

function FaceFrame({
  children,
  maxWidth = 300,
  className = "",
}: {
  children: React.ReactNode;
  maxWidth?: number;
  className?: string;
}) {
  return (
    <div
      className={`relative mx-auto flex aspect-square w-full flex-col items-center justify-center ${className}`}
      style={{ maxWidth }}
    >
      {children}
    </div>
  );
}

function ModeLabel({ label, accent }: { label: string; accent: string }) {
  return (
    <span className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: accent }}>
      {label}
    </span>
  );
}

function TimeButton({
  secondsLeft,
  spoken,
  endsAt,
  onEditClick,
  isRunning,
  className,
  style,
}: {
  secondsLeft: number;
  spoken: string;
  endsAt: string;
  onEditClick?: () => void;
  isRunning: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { minutes, seconds } = formatTime(secondsLeft);
  return (
    <button
      type="button"
      onClick={onEditClick}
      disabled={!onEditClick || isRunning}
      aria-label={`${spoken}.${onEditClick ? " Edit duration." : ""} Finishes at ${endsAt}.`}
      className={`font-display font-semibold leading-none tracking-[-0.05em] tabular-nums text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--surface)] disabled:cursor-default ${className ?? ""}`}
      style={{ fontFeatureSettings: '"tnum" 1', ...style }}
    >
      <RollingClock value={`${minutes}:${seconds}`} />
    </button>
  );
}

function modeWord(mode: TimerFaceProps["mode"], sessionType?: string): string {
  if (sessionType) return sessionType.replace(/_/g, " ");
  return mode === "focus" ? "Focus" : mode === "break" ? "Break" : "Long break";
}

/* ─────────────────────────────── 1 · Aurora ─────────────────────────────── */

const AURORA_R = 128;
const AURORA_C = 2 * Math.PI * AURORA_R;

/**
 * Aurora — the ring face with a lit edge and a travelling head.
 *
 * The arc is drawn twice: a dim full track, and the elapsed portion in a
 * two-stop gradient from the accent to a warm second tone. The head node rides
 * the tip, which is the one moving element; while paused it rests exactly where
 * the countdown stopped, so the picture never lies about the state.
 */
export function TimerFaceAurora({ secondsLeft, mode, isRunning, progress, totalSeconds, onEditClick, sessionType, accent, accentSoft }: TimerFaceProps) {
  const reduced = !!useReducedMotion();
  const id = useId().replace(/:/g, "");
  const { spoken, endsAt } = useFaceLabels(secondsLeft);
  const total = sessionTotal(secondsLeft, progress, totalSeconds);
  const elapsed = Math.min(1, Math.max(0, progress));
  const angle = elapsed * Math.PI * 2 - Math.PI / 2;
  const headX = 150 + AURORA_R * Math.cos(angle);
  const headY = 150 + AURORA_R * Math.sin(angle);
  const label = modeWord(mode, sessionType);
  const totalMinutes = Math.max(1, Math.round(total / 60));
  const left = Math.max(0, Math.ceil(secondsLeft / 60));

  return (
    <FaceFrame>
      <svg viewBox="0 0 300 300" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id={`aur-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={accent} />
            <stop offset="1" stopColor="var(--brand-gold)" />
          </linearGradient>
        </defs>
        <circle cx="150" cy="150" r={AURORA_R} fill="none" stroke={accentSoft} strokeWidth="10" opacity="0.5" />
        {Array.from({ length: 60 }, (_, i) => {
          const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
          const major = i % 5 === 0;
          const r1 = AURORA_R - (major ? 18 : 12);
          const r2 = AURORA_R - 5;
          return (
            <line
              key={i}
              x1={150 + r1 * Math.cos(a)}
              y1={150 + r1 * Math.sin(a)}
              x2={150 + r2 * Math.cos(a)}
              y2={150 + r2 * Math.sin(a)}
              stroke={accentSoft}
              strokeWidth={major ? 2.5 : 1.25}
              opacity={major ? 0.85 : 0.45}
            />
          );
        })}
        <motion.circle
          cx="150"
          cy="150"
          r={AURORA_R}
          fill="none"
          stroke={`url(#aur-${id})`}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={AURORA_C}
          initial={false}
          animate={{ strokeDashoffset: AURORA_C * (1 - Math.max(0.0001, elapsed)) }}
          transition={reduced ? { duration: 0 } : { duration: isRunning ? 1 : 0.4, ease: "linear" }}
          transform="rotate(-90 150 150)"
        />
        <circle cx={headX} cy={headY} r="9" fill="var(--surface-1)" />
        <circle cx={headX} cy={headY} r="5.5" fill={accent} />
      </svg>

      <div className="relative z-[var(--z-content)] flex w-[58%] flex-col items-center text-center">
        <ModeLabel label={label} accent={accent} />
        <TimeButton
          secondsLeft={secondsLeft}
          spoken={spoken}
          endsAt={endsAt}
          onEditClick={onEditClick}
          isRunning={isRunning}
          className="text-[clamp(2.25rem,7vw,3.75rem)]"
        />
        <span className="mt-1.5 text-[11px] font-medium text-[var(--foreground-subtle)]">
          {left} of {totalMinutes} min left
        </span>
      </div>
      <EditHint onClick={onEditClick} running={isRunning} label={spoken} />
    </FaceFrame>
  );
}

/* ─────────────────────────────── 2 · Orbit ──────────────────────────────── */

/**
 * Orbit — the session as one lap.
 *
 * A star sits at the top of the rail and the planet travels clockwise; a full
 * circuit is the whole block, so the angle is the progress and the remaining
 * distance is the remaining time. The moon completes the same lap at a
 * different radius: two periods for one session reads as movement even when the
 * numbers barely budge, which is the point on a 90-minute block.
 */
export function TimerFaceOrbit({ secondsLeft, mode, isRunning, progress, onEditClick, sessionType, accent, accentSoft }: TimerFaceProps) {
  const reduced = !!useReducedMotion();
  const { spoken, endsAt } = useFaceLabels(secondsLeft);
  const elapsed = Math.min(1, Math.max(0, progress));
  const orbit = elapsed * Math.PI * 2 - Math.PI / 2;
  const px = 150 + 112 * Math.cos(orbit);
  const py = 150 + 112 * Math.sin(orbit);
  const moonOrbit = elapsed * Math.PI * 4 - Math.PI / 2;
  const mx = 150 + 74 * Math.cos(moonOrbit);
  const my = 150 + 74 * Math.sin(moonOrbit);
  const label = modeWord(mode, sessionType);
  const minutesLeft = Math.max(0, Math.ceil(secondsLeft / 60));

  return (
    <FaceFrame>
      <svg viewBox="0 0 300 300" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <circle cx="150" cy="150" r="112" fill="none" stroke={accentSoft} strokeWidth="2" opacity="0.6" />
        <circle cx="150" cy="150" r="74" fill="none" stroke={accentSoft} strokeWidth="2" opacity="0.35" strokeDasharray="4 6" />
        {/* The star the session is measured against. */}
        <g transform="translate(150 38)">
          <circle r="9" fill={accent} opacity="0.9" />
          <circle r="16" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.4" />
        </g>
        {/* Trail already travelled, as a faint dashed arc. */}
        <path
          d={describeArc(150, 150, 112, -90, -90 + elapsed * 360)}
          fill="none"
          stroke={accent}
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.5"
        />
        <circle cx={mx} cy={my} r="4.5" fill="var(--brand-gold)" opacity="0.85" />
        <circle cx={px} cy={py} r="11" fill="var(--surface-1)" />
        <motion.circle
          cx={px}
          cy={py}
          r="8"
          fill={accent}
          initial={false}
          animate={reduced || !isRunning ? {} : { opacity: [1, 0.75, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
      </svg>

      <div className="relative z-[var(--z-content)] flex w-[56%] flex-col items-center text-center">
        <ModeLabel label={label} accent={accent} />
        <TimeButton
          secondsLeft={secondsLeft}
          spoken={spoken}
          endsAt={endsAt}
          onEditClick={onEditClick}
          isRunning={isRunning}
          className="text-[clamp(2rem,6.4vw,3.4rem)]"
        />
        <span className="mt-1.5 text-[11px] font-medium text-[var(--foreground-subtle)]">
          {minutesLeft} min to the finish
        </span>
      </div>
      <EditHint onClick={onEditClick} running={isRunning} label={spoken} />
    </FaceFrame>
  );
}

/** SVG arc path between two angles (degrees, 0 = 3 o'clock). */
function describeArc(cx: number, cy: number, r: number, from: number, to: number): string {
  if (Math.abs(to - from) < 0.5) return "";
  const start = polar(cx, cy, r, to);
  const end = polar(cx, cy, r, from);
  const large = to - from <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y}`;
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/* ───────────────────────────── 3 · Hourglass ────────────────────────────── */

/**
 * Hourglass — sand, because it is the one picture everyone already reads.
 *
 * The top chamber holds exactly `secondsLeft / total` of the sand and drains
 * monotonically; the bottom chamber is the complement. A single grain falls
 * while running (one animated element, and it is the state indicator). The
 * hourglass is drawn in a 300-unit box with the readout below the glass, so
 * neither the sand nor the digits have to share space.
 */
export function TimerFaceHourglass({ secondsLeft, mode, isRunning, progress, totalSeconds, onEditClick, sessionType, accent, accentSoft }: TimerFaceProps) {
  const reduced = !!useReducedMotion();
  const id = useId().replace(/:/g, "");
  const { spoken, endsAt } = useFaceLabels(secondsLeft);
  const total = sessionTotal(secondsLeft, progress, totalSeconds);
  const remaining = total > 0 ? Math.min(1, Math.max(0, secondsLeft / total)) : 0;
  const label = modeWord(mode, sessionType);
  const totalMinutes = Math.max(1, Math.round(total / 60));
  const left = Math.max(0, Math.ceil(secondsLeft / 60));

  // Chamber geometry: top bulb spans y 40..118, bottom 142..216, neck at 128–134.
  const topFull = 78;
  const topHeight = topFull * remaining;
  const bottomHeight = 62 * (1 - remaining);

  return (
    <FaceFrame>
      <svg viewBox="0 0 300 300" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id={`sand-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={accent} />
            <stop offset="1" stopColor="var(--brand-gold)" />
          </linearGradient>
          <clipPath id={`top-${id}`}>
            <path d="M96 40h108c0 34-34 60-54 84-20-24-54-50-54-84Z" />
          </clipPath>
          <clipPath id={`bottom-${id}`}>
            <path d="M96 216h108c0-34-34-60-54-84-20 24-54 50-54 84Z" />
          </clipPath>
        </defs>

        {/* Frame */}
        <path d="M92 36h116M92 220h116" stroke={accentSoft} strokeWidth="6" strokeLinecap="round" />
        <path
          d="M96 40c0 34 34 60 54 84 20-24 54-50 54-84M96 216c0-34 34-60 54-84 20 24 54 50 54 84"
          fill="none"
          stroke={accentSoft}
          strokeWidth="4"
          strokeLinejoin="round"
        />

        {/* Sand */}
        <g clipPath={`url(#top-${id})`}>
          <rect x="90" y={118 - topHeight} width="120" height={topHeight + 12} fill={`url(#sand-${id})`} />
        </g>
        <g clipPath={`url(#bottom-${id})`}>
          <rect x="90" y={222 - bottomHeight} width="120" height={bottomHeight + 12} fill={`url(#sand-${id})`} opacity="0.9" />
        </g>

        {/* Falling grain — the only moving part, and the running indicator. */}
        {isRunning && !reduced && remaining > 0.01 && (
          <motion.circle
            cx="150"
            r="2.5"
            fill={accent}
            initial={{ cy: 122 }}
            animate={{ cy: [122, 140] }}
            transition={{ duration: 0.9, repeat: Infinity, ease: "easeIn" }}
          />
        )}
        <rect x="148" y="120" width="4" height="10" fill={accent} opacity={remaining > 0.01 ? 0.9 : 0.2} />
      </svg>

      <div className="relative z-[var(--z-content)] mt-[86%] flex w-[58%] flex-col items-center text-center">
        <ModeLabel label={label} accent={accent} />
        <TimeButton
          secondsLeft={secondsLeft}
          spoken={spoken}
          endsAt={endsAt}
          onEditClick={onEditClick}
          isRunning={isRunning}
          className="text-[clamp(1.75rem,6vw,2.75rem)]"
        />
        <span className="mt-1.5 text-[11px] font-medium text-[var(--foreground-subtle)]">
          {left} of {totalMinutes} min left
        </span>
      </div>
      <EditHint onClick={onEditClick} running={isRunning} label={spoken} />
    </FaceFrame>
  );
}

/* ────────────────────────── 4 · Companion trail ─────────────────────────── */

const TRAIL_STEPS = 10;

/**
 * Companion trail — the animal face.
 *
 * The session is a walk: your companion starts beside the flag at one end of a
 * track and reaches it when the block ends, so "how far along is the dog" is
 * the answer to "how much is left", with no numbers required. The track is a
 * fixed ten steps regardless of length — a step is a tenth of the block, not a
 * minute — which keeps the picture readable on a five-minute break and a
 * two-hour deep-work block alike.
 *
 * The animal itself is drawn from `petBodyParams`, the same description the 3D
 * body is built from, so the walker here and the companion on the stage are the
 * same animal. It faces the direction of travel and mirrors at the halfway
 * point, because a walker that reaches the flag backwards looks broken.
 *
 * Which animal: the active pet, from the same query every other surface uses.
 * With no session (a guest) the walker falls back to the starter's parameters
 * rather than an empty track.
 */
export function TimerFaceCompanion({ secondsLeft, mode, isRunning, progress, totalSeconds, onEditClick, sessionType, accent, accentSoft }: TimerFaceProps) {
  const reduced = !!useReducedMotion();
  const { spoken, endsAt } = useFaceLabels(secondsLeft);
  const total = sessionTotal(secondsLeft, progress, totalSeconds);
  const elapsed = Math.min(1, Math.max(0, progress));
  const label = modeWord(mode, sessionType);
  const minutesLeft = Math.max(0, Math.ceil(secondsLeft / 60));
  const totalMinutes = Math.max(1, Math.round(total / 60));

  // The active pet comes from the shared query every other companion surface
  // uses, so this face renders whichever animal is equipped without a request
  // of its own: react-query dedupes, and the focus page has usually mounted it
  // already. Guests get `null` and the starter's shape — never an empty track.
  const { data: activePet } = useActivePet();
  const petSlug = activePet?.slug ?? "bulbasaur";
  const petName = activePet?.name ?? "Your companion";
  const params = useMemo(() => petBodyParams(petSlug, activePet?.category), [petSlug, activePet?.category]);

  // Position along the track, 0 (start) → TRAIL_STEPS (finish).
  const step = elapsed * TRAIL_STEPS;
  const trackLeft = 40;
  const trackRight = 260;
  const x = trackLeft + (trackRight - trackLeft) * elapsed;
  const passed = Math.floor(step);

  return (
    <FaceFrame>
      <div className="relative flex w-full flex-col items-center">
        <ModeLabel label={label} accent={accent} />
        <TimeButton
          secondsLeft={secondsLeft}
          spoken={spoken}
          endsAt={endsAt}
          onEditClick={onEditClick}
          isRunning={isRunning}
          className="text-[clamp(1.9rem,6.2vw,3rem)]"
        />
        <span className="mt-1.5 text-[11px] font-medium text-[var(--foreground-subtle)]">
          {petName} · {minutesLeft} of {totalMinutes} min to the flag
        </span>
      </div>

      <div className="relative mt-3 h-[104px] w-full" aria-hidden="true">
        <svg viewBox="0 0 300 104" className="absolute inset-0 h-full w-full">
          {/* Ground line + steps, so distance is countable, not estimated. */}
          <line x1={trackLeft} y1="78" x2={trackRight} y2="78" stroke={accentSoft} strokeWidth="3" strokeLinecap="round" />
          {Array.from({ length: TRAIL_STEPS + 1 }, (_, i) => {
            const sx = trackLeft + ((trackRight - trackLeft) / TRAIL_STEPS) * i;
            return <line key={i} x1={sx} y1="74" x2={sx} y2="82" stroke={accentSoft} strokeWidth="2" opacity="0.7" />;
          })}
          {/* Prints behind the walker: the trail already covered. */}
          {Array.from({ length: passed }, (_, i) => {
            const px = trackLeft + ((trackRight - trackLeft) / TRAIL_STEPS) * (i + 0.5);
            return <circle key={i} cx={px} cy={86} r="3" fill={accent} opacity="0.35" />;
          })}
          {/* Start marker and the flag at the finish. */}
          <circle cx={trackLeft} cy="78" r="4" fill={accentSoft} />
        </svg>

        <span className="absolute" style={{ left: `calc(${(x / 300) * 100}% - 18px)`, bottom: 8 }}>
          <AnimalGlyph params={params} size={40} flip={x > 150} />
        </span>

        <span className="absolute text-[var(--brand-gold)]" style={{ left: `calc(${(trackRight / 300) * 100}% - 6px)`, bottom: 30 }}>
          <Flag size={16} strokeWidth={2.4} />
        </span>
        <span className="absolute text-[var(--foreground-subtle)]" style={{ left: "2%", bottom: 30 }}>
          <PawPrint size={14} />
        </span>
      </div>

      {isRunning && !reduced && (
        <motion.span
          className="mt-1 block h-1 w-1 rounded-full"
          style={{ background: accent }}
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <EditHint onClick={onEditClick} running={isRunning} label={spoken} />
    </FaceFrame>
  );
}

/* ─────────────────────────────── 5 · Garden ─────────────────────────────── */

/**
 * Garden — a stem that grows and a flower that opens.
 *
 * Eight petals, one per remaining block of the session (a block is the session
 * divided by eight, so the last petal closes as the block ends). Leaves unfurl
 * as the stem rises. It is the one face written for breaks rather than work:
 * "how much is left" is answered by how open the flower is, and nothing counts
 * down at you.
 */
export function TimerFaceGarden({ secondsLeft, mode, isRunning, progress, totalSeconds, onEditClick, sessionType, accent, accentSoft }: TimerFaceProps) {
  const reduced = !!useReducedMotion();
  const id = useId().replace(/:/g, "");
  const { spoken, endsAt } = useFaceLabels(secondsLeft);
  const total = sessionTotal(secondsLeft, progress, totalSeconds);
  const remaining = total > 0 ? Math.min(1, Math.max(0, secondsLeft / total)) : 0;
  const elapsed = Math.min(1, Math.max(0, progress));
  const label = modeWord(mode, sessionType);
  const totalMinutes = Math.max(1, Math.round(total / 60));
  const left = Math.max(0, Math.ceil(secondsLeft / 60));
  const petalsOpen = Math.ceil(remaining * 8);

  const stemHeight = 44 + elapsed * 84;

  return (
    <FaceFrame>
      <svg viewBox="0 0 300 300" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id={`petal-${id}`} x1="0" y1="0" x2="0.6" y2="1">
            <stop offset="0" stopColor={accent} />
            <stop offset="1" stopColor="var(--brand-gold)" />
          </linearGradient>
        </defs>

        <ellipse cx="150" cy="238" rx="58" ry="9" fill="#0f172a" opacity="0.12" />
        <path d="M110 236q40 10 80 0" fill="none" stroke={accentSoft} strokeWidth="6" strokeLinecap="round" />

        {/* Stem */}
        <motion.path
          d={`M150 236v-${stemHeight}`}
          fill="none"
          stroke="#4f9a5f"
          strokeWidth="5"
          strokeLinecap="round"
          initial={false}
          animate={{ d: `M150 236v-${stemHeight}` }}
          transition={reduced ? { duration: 0 } : { duration: isRunning ? 1 : 0.4, ease: "linear" }}
        />
        {/* Leaves, one per third of the session. */}
        {[0.3, 0.6, 0.85].map((at, i) => {
          if (elapsed < at) return null;
          const y = 236 - stemHeight * at;
          const side = i % 2 === 0 ? 1 : -1;
          return (
            <path
              key={i}
              d={`M150 ${y}q${22 * side} -6 ${30 * side} 8q-${20 * side} 6 -${30 * side} -8Z`}
              fill="#5fae6d"
              opacity="0.9"
            />
          );
        })}

        {/* Flower head: eight petals around the centre, opening one at a time. */}
        <g transform={`translate(150 ${236 - stemHeight})`}>
          {Array.from({ length: 8 }, (_, i) => {
            const open = i < petalsOpen;
            const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
            const spread = open || i <= petalsOpen ? 1 : 0.55;
            const r = 26 * spread;
            return (
              <motion.ellipse
                key={i}
                cx={Math.cos(angle) * r}
                cy={Math.sin(angle) * r}
                rx={open ? 11 : 9}
                ry={open ? 16 : 13}
                transform={`rotate(${(angle * 180) / Math.PI} ${Math.cos(angle) * r} ${Math.sin(angle) * r})`}
                fill={open ? `url(#petal-${id})` : "var(--surface-3)"}
                opacity={open ? 1 : 0.5}
                initial={false}
                animate={{ opacity: open ? 1 : 0.5 }}
                transition={reduced ? { duration: 0 } : { duration: 0.4 }}
              />
            );
          })}
          <circle r="11" fill="var(--brand-gold)" />
        </g>
      </svg>

      <div className="relative z-[var(--z-content)] mt-[62%] flex w-[58%] flex-col items-center text-center">
        <ModeLabel label={label} accent={accent} />
        <TimeButton
          secondsLeft={secondsLeft}
          spoken={spoken}
          endsAt={endsAt}
          onEditClick={onEditClick}
          isRunning={isRunning}
          className="text-[clamp(1.75rem,6vw,2.75rem)]"
        />
        <span className="mt-1.5 text-[11px] font-medium text-[var(--foreground-subtle)]">
          {left} of {totalMinutes} min · {petalsOpen}/8 petals open
        </span>
      </div>
      <EditHint onClick={onEditClick} running={isRunning} label={spoken} />
    </FaceFrame>
  );
}

/** Named export used by the registry test: every face id must exist here. */
/* ───────────────────────────── 6 · Analog clock ─────────────────────────── */

const ANALOG_R = 66;
const ANALOG_C = 2 * Math.PI * ANALOG_R;

/**
 * Analog clock — the wedge dial, ported from the PR #99 uploads.
 *
 * A *wedge* from the middle fills as the block runs down, a hand points at the
 * remaining fraction, and the face is ringed with minute ticks and five-minute
 * numbers, so it reads like a wall clock that has been asked one question. The
 * hand is what makes it different from the other ring faces: it points at what
 * is left rather than sweeping past what is spent, which is the reading people
 * reach for without being taught.
 *
 * The wedge stops short of the numbers on purpose. The upload drew it out to
 * the ticks with the numerals on top of it; over a mid-tone accent those
 * numerals are the first thing to lose contrast, so here the wedge ends inside
 * them and the scale stays on the surface in the foreground colour.
 *
 * A dial only makes sense when its scale is stated, so twelve o'clock carries
 * the session's own length in minutes, and the numbers step in tens once the
 * block is longer than an hour (five *hours* of ticks is not a dial anyone can
 * read).
 */
export function TimerFaceAnalog({ secondsLeft, mode, isRunning, progress, totalSeconds, onEditClick, sessionType, accent, accentSoft }: TimerFaceProps) {
  const reduced = !!useReducedMotion();
  const { spoken, endsAt } = useFaceLabels(secondsLeft);
  const total = sessionTotal(secondsLeft, progress, totalSeconds);
  const remaining = total > 0 ? Math.min(1, Math.max(0, secondsLeft / total)) : 0;
  const label = modeWord(mode, sessionType);
  const totalMinutes = Math.max(1, Math.round(total / 60));
  const left = Math.max(0, Math.ceil(secondsLeft / 60));
  const longBlock = total > 3600;
  const handAngle = remaining * Math.PI * 2 - Math.PI / 2;
  const handX = 150 + 129 * Math.cos(handAngle);
  const handY = 150 + 129 * Math.sin(handAngle);

  return (
    <FaceFrame>
      <svg viewBox="0 0 300 300" className="absolute inset-0 h-full w-full" aria-hidden="true">
        {/* Case and dial */}
        <circle cx="150" cy="150" r="146" fill="var(--surface-1)" stroke="var(--border-strong)" strokeWidth="1.4" />
        <circle cx="150" cy="150" r="132" fill="var(--surface-2)" />

        {/* The wedge: everything still ahead of you, from the middle out. */}
        <circle
          cx="150"
          cy="150"
          r={ANALOG_R}
          fill="none"
          stroke={accent}
          strokeWidth={ANALOG_R * 2}
          strokeDasharray={`${ANALOG_C * remaining} ${ANALOG_C}`}
          transform="rotate(-90 150 150)"
          opacity="0.92"
          style={{ transition: reduced ? "none" : `stroke-dasharray ${isRunning ? "1s linear" : "0.4s ease"}` }}
        />

        {/* Minute ticks: long every five. */}
        {Array.from({ length: 60 }).map((_, i) => {
          const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
          const big = i % 5 === 0;
          const r1 = 132;
          const r2 = big ? 118 : 125;
          return (
            <line
              key={i}
              x1={150 + Math.cos(a) * r1}
              y1={150 + Math.sin(a) * r1}
              x2={150 + Math.cos(a) * r2}
              y2={150 + Math.sin(a) * r2}
              stroke="var(--foreground)"
              strokeOpacity={big ? 0.85 : 0.32}
              strokeWidth={big ? 2.2 : 1}
            />
          );
        })}

        {/* The scale. Twelve o'clock states the block's own length. */}
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
          const value = i === 0 ? totalMinutes : longBlock ? i * 10 : i * 5;
          return (
            <text
              key={i}
              x={150 + Math.cos(a) * 105}
              y={150 + Math.sin(a) * 105 + 5}
              textAnchor="middle"
              fontSize="14"
              fontWeight="600"
              fill="var(--foreground)"
              fillOpacity="0.82"
            >
              {value}
            </text>
          );
        })}

        {/* The hand, and its hub. */}
        <line x1="150" y1="150" x2={handX} y2={handY} stroke={accentSoft} strokeWidth="3.6" strokeLinecap="round" />
        <circle cx="150" cy="150" r="9" fill="var(--foreground)" />
        <circle cx="150" cy="150" r="3.6" fill={accent} />
      </svg>

      <div className="relative z-[var(--z-content)] mt-[86%] flex w-[58%] flex-col items-center text-center">
        <ModeLabel label={label} accent={accent} />
        <TimeButton
          secondsLeft={secondsLeft}
          spoken={spoken}
          endsAt={endsAt}
          onEditClick={onEditClick}
          isRunning={isRunning}
          className="text-[clamp(1.75rem,6vw,2.75rem)]"
        />
        <span className="mt-1.5 text-[11px] font-medium text-[var(--foreground-subtle)]">
          {left} of {totalMinutes} min left
        </span>
      </div>
      <EditHint onClick={onEditClick} running={isRunning} label={spoken} />
    </FaceFrame>
  );
}

export const STUDIO_FACES = {
  analog: TimerFaceAnalog,
  aurora: TimerFaceAurora,
  orbit: TimerFaceOrbit,
  hourglass: TimerFaceHourglass,
  companion: TimerFaceCompanion,
  garden: TimerFaceGarden,
} as const;
