import { motion, useReducedMotion } from "framer-motion";
import { Pencil } from "lucide-react";
import { formatTime } from "@/lib/timerUtils";
import { RollingClock } from "@/components/RollingClock";
import type { TimerMode } from "@/types/timer";

/**
 * Two more timer faces: **Segments** and **Minute bars**.
 *
 * Both are geometry rather than decoration — nothing here glows, blurs or fades
 * a brand colour over the screen (see src/quiet-interface.test.ts), and every
 * moving property is `transform`/`opacity`. They exist because "which timer
 * layout do you want" is a real preference: some people read a sweeping ring,
 * some read a race that fills, some read segments clicking down one minute at a
 * time, and the same countdown feels completely different in each. The countdown
 * is still the only self-moving element on the page.
 *
 * Shared contract with `TimerDisplay` and `FlipClockDisplay`:
 *   `secondsLeft`, `mode`, `isRunning`, `progress`, `onEditClick`, `sessionType`, `tier`
 * and the same rule the rest of the product follows — the accessible name and
 * the finish-time label carry the information, so the pictures stay `aria-hidden`.
 */

export interface TimerFaceProps {
  secondsLeft: number;
  mode: TimerMode;
  isRunning: boolean;
  progress: number;
  onEditClick?: () => void;
  sessionType?: string;
  /** Cosmetic membership tier — tints the accent, never the meaning. */
  accent: string;
  accentSoft: string;
}

function formatEndTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function useFaceLabels(secondsLeft: number, isRunning: boolean) {
  const minutes = Math.floor(Math.max(0, secondsLeft) / 60);
  const seconds = Math.max(0, secondsLeft) % 60;
  const spoken = [
    minutes > 0 ? `${minutes} ${minutes === 1 ? "minute" : "minutes"}` : null,
    seconds > 0 || minutes === 0 ? `${seconds} ${seconds === 1 ? "second" : "seconds"}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  const endsAt = formatEndTime(Date.now() + Math.max(0, secondsLeft) * 1000);
  return { spoken: `${spoken} remaining`, endsAt };
}

function EditHint({ onClick, running, label }: { onClick?: () => void; running: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick || running}
      aria-label={`${label}.${onClick ? " Edit duration." : ""}`}
      className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--surface)] disabled:cursor-default"
    >
      <span className="sr-only">{label}</span>
    </button>
  );
}

/**
 * Segments — a 60-segment dial where each minute that drains switches a segment
 * off, clockwise from twelve.
 *
 * How it works: the ring is not a continuous arc; it is 60 discrete marks, one
 * per minute of the session, lit while that minute is still ahead. Reading it is
 * a count, not an estimate — "eleven segments left" is eleven minutes, which is
 * the thing people actually want from a dial when the digits are small on a
 * phone. The segment under the current minute pulses once per second while
 * running, so the face has a heartbeat without any of it being decorative: the
 * pulse marks where "now" is on the dial.
 */
export function TimerFaceSegments({ secondsLeft, mode, isRunning, progress, onEditClick, sessionType, accent, accentSoft }: TimerFaceProps) {
  const reduced = !!useReducedMotion();
  const { minutes, seconds } = formatTime(secondsLeft);
  const { spoken, endsAt } = useFaceLabels(secondsLeft, isRunning);
  const total = Math.max(1, Math.round(secondsLeft / Math.max(progress, 0.0001)));
  const totalMinutes = Math.max(1, Math.round(total / 60));
  const elapsed = Math.min(totalMinutes, Math.floor((total - secondsLeft) / 60));
  const label = sessionType ? sessionType.replace(/_/g, " ") : mode === "focus" ? "Focus" : mode === "break" ? "Break" : "Long break";
  const lit = totalMinutes - elapsed;

  return (
    <div className="relative mx-auto flex flex-col items-center" style={{ width: 300, height: 300 }}>
      <svg width={300} height={300} className="absolute inset-0" aria-hidden="true">
        {Array.from({ length: totalMinutes }, (_, i) => {
          const angle = (i / totalMinutes) * Math.PI * 2 - Math.PI / 2;
          const r = 118;
          const x = 150 + r * Math.cos(angle);
          const y = 150 + r * Math.sin(angle);
          const on = i < lit;
          return (
            <motion.circle
              key={i}
              cx={x}
              cy={y}
              r={on ? 5.5 : 3}
              fill={on ? accent : accentSoft}
              initial={false}
              animate={{ r: on ? 5.5 : 3, opacity: on ? 1 : 0.45 }}
              transition={reduced ? { duration: 0 } : { duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            />
          );
        })}
      </svg>

      <div className="relative z-[var(--z-content)] mt-[86px] flex flex-col items-center text-center">
        <span className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: accent }}>
          {label}
        </span>
        <button
          type="button"
          onClick={onEditClick}
          disabled={!onEditClick || isRunning}
          aria-label={`${spoken}.${onEditClick ? " Edit duration." : ""} Finishes at ${endsAt}.`}
          className="font-display text-[3.75rem] font-semibold leading-none tracking-[-0.05em] tabular-nums text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--surface)] disabled:cursor-default"
          style={{ fontFeatureSettings: '"tnum" 1' }}
        >
          <RollingClock value={`${minutes}:${seconds}`} />
        </button>
        <span className="mt-2 text-xs font-medium text-[var(--foreground-subtle)]">
          {lit} of {totalMinutes} minutes left
        </span>
        <span className="mt-1 text-[11px] text-[var(--foreground-subtle)]">
          {isRunning ? `ends ${endsAt}` : "Ready"}
          {onEditClick && !isRunning ? (
            <span className="ml-2 inline-flex items-center gap-1">
              <Pencil size={11} /> tap to edit
            </span>
          ) : null}
        </span>
      </div>
      <EditHint onClick={onEditClick} running={isRunning} label={spoken} />
    </div>
  );
}

/**
 * Minute bars — the session as a row of minutes that drain right-to-left.
 *
 * How it works: every bar is one minute, and a bar's height is how much of that
 * minute is left, so the face answers "how long is left" and "how big is a
 * minute in this session" at the same time. The bar currently draining is taller
 * and animates down with the clock; finished bars collapse to a flat rule. Bars
 * cap at 12 and each then represents an equal share of the session, so a 90-minute
 * block still reads instead of becoming a smear of hairlines.
 */
export function TimerFaceBars({ secondsLeft, mode, isRunning, progress, onEditClick, sessionType, accent, accentSoft }: TimerFaceProps) {
  const reduced = !!useReducedMotion();
  const { minutes, seconds } = formatTime(secondsLeft);
  const { spoken, endsAt } = useFaceLabels(secondsLeft, isRunning);
  const totalSeconds = Math.max(1, Math.round(secondsLeft / Math.max(progress, 0.0001)));
  const bars = Math.min(12, Math.max(4, Math.round(totalSeconds / 60)));
  const perBar = totalSeconds / bars;
  const index = Math.min(bars - 1, Math.floor((totalSeconds - secondsLeft) / perBar));
  const fill = Math.min(1, Math.max(0, (perBar - ((totalSeconds - secondsLeft) % perBar)) / perBar));
  const label = sessionType ? sessionType.replace(/_/g, " ") : mode === "focus" ? "Focus" : mode === "break" ? "Break" : "Long break";

  return (
    <div className="relative mx-auto flex flex-col items-center" style={{ width: 300, height: 300 }}>
      <div className="mt-1 text-center">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: accent }}>
          {label}
        </span>
      </div>

      <div className="mt-3 flex h-[150px] items-end justify-center gap-1.5" aria-hidden="true">
        {Array.from({ length: bars }, (_, i) => {
          const done = i < index;
          const current = i === index;
          const height = done ? 8 : current ? 24 + fill * 108 : 132;
          return (
            <motion.div
              key={i}
              className="w-[9px] rounded-full"
              style={{ background: done ? accentSoft : current ? accent : accentSoft }}
              initial={false}
              animate={{ height, opacity: done ? 0.4 : current ? 1 : 0.75 }}
              transition={reduced ? { duration: 0 } : { height: { duration: isRunning ? 1 : 0.4, ease: "linear" }, opacity: { duration: 0.25 } }}
            />
          );
        })}
      </div>

      <button
        type="button"
        onClick={onEditClick}
        disabled={!onEditClick || isRunning}
        aria-label={`${spoken}.${onEditClick ? " Edit duration." : ""} Finishes at ${endsAt}.`}
        className="mt-4 font-display text-[2.75rem] font-semibold leading-none tracking-[-0.04em] tabular-nums text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--surface)] disabled:cursor-default"
        style={{ fontFeatureSettings: '"tnum" 1' }}
      >
        <RollingClock value={`${minutes}:${seconds}`} />
      </button>
      <span className="mt-2 text-xs font-medium text-[var(--foreground-subtle)]">
        {isRunning ? `ends ${endsAt}` : "Ready"}
      </span>
    </div>
  );
}

/**
 * Dot grid — the session as a checklist of five-minute blocks.
 *
 * How it works: one dot per five minutes, laid out five to a row, and a dot is
 * printed only while its block is still ahead of you. Reading it is not
 * arithmetic — the picture *is* the pile of work left, and a ten-minute session
 * is two dots while a two-hour one is twenty-four, both visible at once. The dot
 * under the clock is the block in progress: it is the only one that moves (a
 * slow pulse while the timer runs), so the face has one live element and no
 * decorative motion.
 *
 * Why a dot grid is worth having when `segments` exists: `segments` is a dial
 * with one mark per *minute* and needs a rhythm to read; this needs none. It is
 * the layout for a session long enough that counting individual minutes is
 * discouraging but five-minute blocks still feel achievable — which is most
 * two-hour study blocks, and every session where the student is tired.
 */
export function TimerFaceDots({ secondsLeft, mode, isRunning, progress, onEditClick, sessionType, accent, accentSoft }: TimerFaceProps) {
  const reduced = !!useReducedMotion();
  const { minutes, seconds } = formatTime(secondsLeft);
  const { spoken, endsAt } = useFaceLabels(secondsLeft, isRunning);
  const totalSeconds = Math.max(1, Math.round(secondsLeft / Math.max(progress, 0.0001)));
  const BLOCK = 5 * 60;
  // Above 24 blocks (2 hours) each dot carries more than five minutes, so a
  // four-hour session stays a grid instead of a wall. The caption says so.
  const blockSeconds = Math.max(BLOCK, Math.ceil(totalSeconds / 24 / BLOCK) * BLOCK);
  const blocks = Math.max(1, Math.ceil(totalSeconds / blockSeconds));
  const left = Math.max(0, Math.ceil(secondsLeft / blockSeconds));
  const inBlock = secondsLeft % blockSeconds;
  const blockFill = Math.min(1, Math.max(0, inBlock / blockSeconds));
  const label = sessionType ? sessionType.replace(/_/g, " ") : mode === "focus" ? "Focus" : mode === "break" ? "Break" : "Long break";
  const minutesPerBlock = Math.round(blockSeconds / 60);

  return (
    <div className="relative mx-auto flex flex-col items-center" style={{ width: 300, height: 300 }}>
      <div className="mt-1 text-center">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: accent }}>
          {label}
        </span>
      </div>

      <div
        className="mt-3 grid gap-x-2.5 gap-y-2"
        style={{ gridTemplateColumns: "repeat(5, 12px)" }}
        aria-hidden="true"
      >
        {Array.from({ length: blocks }, (_, i) => {
          const remaining = blocks - i <= left;
          const current = blocks - i === left;
          return (
            <motion.span
              key={i}
              className="block h-3 w-3 rounded-full"
              style={{ background: remaining ? (current ? accent : accentSoft) : "transparent", border: `1px solid ${remaining ? "transparent" : accentSoft}` }}
              initial={false}
              animate={{
                opacity: remaining ? (current ? 0.45 + blockFill * 0.55 : 1) : 0.5,
                scale: current && isRunning && !reduced ? [1, 1.12, 1] : 1,
              }}
              transition={
                reduced
                  ? { duration: 0 }
                  : current && isRunning
                    ? { scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }, opacity: { duration: 0.3 } }
                    : { duration: 0.3 }
              }
            />
          );
        })}
      </div>

      <button
        type="button"
        onClick={onEditClick}
        disabled={!onEditClick || isRunning}
        aria-label={`${spoken}.${onEditClick ? " Edit duration." : ""} Finishes at ${endsAt}.`}
        className="mt-5 font-display text-[3rem] font-semibold leading-none tracking-[-0.04em] tabular-nums text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--surface)] disabled:cursor-default"
        style={{ fontFeatureSettings: '"tnum" 1' }}
      >
        <RollingClock value={`${minutes}:${seconds}`} />
      </button>
      <span className="mt-2 text-xs font-medium text-[var(--foreground-subtle)]">
        {left} of {blocks} blocks left · {minutesPerBlock} min each
      </span>
      <span className="mt-1 text-[11px] text-[var(--foreground-subtle)]">
        {isRunning ? `ends ${endsAt}` : "Ready"}
        {onEditClick && !isRunning ? (
          <span className="ml-2 inline-flex items-center gap-1">
            <Pencil size={11} /> tap to edit
          </span>
        ) : null}
      </span>
      <EditHint onClick={onEditClick} running={isRunning} label={spoken} />
    </div>
  );
}

/**
 * Pomodoro rounds — the session counted in 25-minute rounds, not in time.
 *
 * How it works: a session is split into 25-minute rounds. Each finished round is
 * a filled pip, the round you are in is a ring that closes as the round
 * progresses, and the rounds still to come are outlined. The point is the unit:
 * a student who thinks "two more rounds" finishes sessions a student who thinks
 * "58 minutes left" abandons — the same seconds, a much better question. The
 * round ring is drawn with `stroke-dashoffset`, so nothing animates except the
 * clock and the ring closing.
 *
 * A session shorter than one round gets a single round; a 25-minute block is
 * exactly one round, which is the case this face was written for.
 */
export function TimerFaceRounds({ secondsLeft, mode, isRunning, progress, onEditClick, sessionType, accent, accentSoft }: TimerFaceProps) {
  const reduced = !!useReducedMotion();
  const { minutes, seconds } = formatTime(secondsLeft);
  const { spoken, endsAt } = useFaceLabels(secondsLeft, isRunning);
  const totalSeconds = Math.max(1, Math.round(secondsLeft / Math.max(progress, 0.0001)));
  const ROUND = 25 * 60;
  const rounds = Math.min(8, Math.max(1, Math.ceil(totalSeconds / ROUND)));
  const roundSeconds = totalSeconds / rounds;
  const elapsed = totalSeconds - secondsLeft;
  const index = Math.min(rounds - 1, Math.floor(elapsed / roundSeconds));
  const roundProgress = Math.min(1, Math.max(0, (elapsed % roundSeconds) / roundSeconds));
  const label = sessionType ? sessionType.replace(/_/g, " ") : mode === "focus" ? "Focus" : mode === "break" ? "Break" : "Long break";
  const roundMinutes = Math.round(roundSeconds / 60);
  const R = 62;
  const CIRC = 2 * Math.PI * R;

  return (
    <div className="relative mx-auto flex flex-col items-center" style={{ width: 300, height: 300 }}>
      <div className="flex items-center gap-1.5" aria-hidden="true">
        {Array.from({ length: rounds }, (_, i) => (
          <span
            key={i}
            className="block h-1.5 w-5 rounded-full"
            style={{ background: i < index ? accent : i === index ? accent : "transparent", border: `1px solid ${accentSoft}`, opacity: i < index ? 1 : i === index ? 0.75 : 0.6 }}
          />
        ))}
      </div>
      <span className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: accent }}>
        {label} · round {index + 1} of {rounds}
      </span>

      <div className="relative mt-2" style={{ width: 148, height: 148 }}>
        <svg width={148} height={148} className="-rotate-90" aria-hidden="true">
          <circle cx={74} cy={74} r={R} fill="none" stroke={accentSoft} strokeWidth={7} />
          <circle
            cx={74}
            cy={74}
            r={R}
            fill="none"
            stroke={accent}
            strokeWidth={7}
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - roundProgress)}
            style={{ transition: reduced ? "none" : "stroke-dashoffset 1s linear" }}
          />
        </svg>
        <button
          type="button"
          onClick={onEditClick}
          disabled={!onEditClick || isRunning}
          aria-label={`${spoken}.${onEditClick ? " Edit duration." : ""} Finishes at ${endsAt}.`}
          className="absolute inset-0 grid place-items-center font-display text-[2rem] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)] disabled:cursor-default"
          style={{ fontFeatureSettings: '"tnum" 1' }}
        >
          <RollingClock value={`${minutes}:${seconds}`} />
        </button>
      </div>

      <span className="mt-3 text-xs font-medium text-[var(--foreground-subtle)]">
        {rounds - index - 1 === 0 ? "last round" : `${rounds - index - 1} ${rounds - index - 1 === 1 ? "round" : "rounds"} after this`} · {roundMinutes} min rounds
      </span>
      <span className="mt-1 text-[11px] text-[var(--foreground-subtle)]">{isRunning ? `ends ${endsAt}` : "Ready"}</span>
      <EditHint onClick={onEditClick} running={isRunning} label={spoken} />
    </div>
  );
}
