import { useEffect, useId, useRef, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Coffee, Maximize2, Pause, Play, RotateCcw, Timer as TimerIcon, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Interactive timer preview for the landing page.
 *
 * Every design proposal we reviewed (`focusarx-resource`) led with the same
 * insight: the strongest landing hero is not a screenshot of the timer, it is
 * the timer — running, on the page, before any signup. This card is that
 * port: a real, self-contained countdown a visitor can start from the hero.
 *
 * Rules that keep it honest:
 *  - It never invents progress. No fake XP/coins, no fake streaks — nothing
 *    here is saved, and the copy says so. The reward for finishing a block is
 *    the block itself and a one-tap handoff to the real timer.
 *  - The handoff reuses the existing deep-link contract from
 *    `lib/focusDeepLink.ts`: `/focus?duration=<minutes>&src=landing` pre-arms
 *    the real session with the same duration, so the preview and the product
 *    never disagree about what "continue" means.
 *  - While it runs, the tab title carries the live countdown — the same
 *    affordance the real timer gives — and the page title is restored the
 *    moment the preview stops or unmounts.
 */

export const LANDING_TIMER_MODES = [
  { id: "pomodoro", label: "Pomodoro", minutes: 25, hint: "The classic sprint", icon: TimerIcon },
  { id: "deep", label: "Deep work", minutes: 50, hint: "One long, protected block", icon: Zap },
  { id: "break", label: "Break", minutes: 5, hint: "Recover deliberately", icon: Coffee },
] as const;

export type LandingTimerModeId = (typeof LANDING_TIMER_MODES)[number]["id"];

type Status = "idle" | "running" | "paused" | "done";

/** Remaining seconds and status live in one state object so the tick can
   complete the session atomically — no effect watching one state to write
   another. */
interface TimerState {
  remaining: number;
  status: Status;
}

const RING_SIZE = 232;
const RING_STROKE = 10;
const RING_R = (RING_SIZE - RING_STROKE) / 2;
const RING_C = 2 * Math.PI * RING_R;

export function formatLandingTimer(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function LandingTimerPreview() {
  const [modeId, setModeId] = useState<LandingTimerModeId>("pomodoro");
  const mode = LANDING_TIMER_MODES.find((m) => m.id === modeId) ?? LANDING_TIMER_MODES[0]!;
  const total = mode.minutes * 60;
  const [timer, setTimer] = useState<TimerState>({ remaining: total, status: "idle" });
  const chipGroupId = useId();
  const { remaining, status } = timer;

  /* The landing page's own title. Captured once, after PageSEO has written it
     (React runs sibling effects in tree order, and PageSEO renders before the
     sections that can mount this card), and restored whenever the countdown
     is not live and on unmount — the tab must never be left wearing a stale
     "12:34 · Deep work" title. */
  const pageTitleRef = useRef<string | null>(null);
  useEffect(() => {
    pageTitleRef.current = document.title;
    return () => {
      if (pageTitleRef.current != null) document.title = pageTitleRef.current;
    };
  }, []);

  /* One interval drives the whole card. The updater is pure state-to-state,
     including natural completion when the ring empties. */
  useEffect(() => {
    if (status !== "running") return;
    const id = window.setInterval(() => {
      setTimer((t) => {
        if (t.status !== "running") return t;
        if (t.remaining <= 1) return { remaining: 0, status: "done" };
        return { remaining: t.remaining - 1, status: "running" };
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [status]);

  useEffect(() => {
    if (status === "running") {
      document.title = `${formatLandingTimer(remaining)} · ${mode.label} — FocusArx`;
    } else if (pageTitleRef.current != null) {
      document.title = pageTitleRef.current;
    }
  }, [status, remaining, mode.label]);

  const switchMode = (id: LandingTimerModeId) => {
    const next = LANDING_TIMER_MODES.find((m) => m.id === id) ?? LANDING_TIMER_MODES[0]!;
    setModeId(next.id);
    setTimer({ remaining: next.minutes * 60, status: "idle" });
  };

  const toggle = () => {
    setTimer((t) => {
      if (t.status === "running") return { ...t, status: "paused" };
      if (t.status === "done") return { remaining: total, status: "running" };
      return { ...t, status: "running" };
    });
  };

  const reset = () => setTimer({ remaining: total, status: "idle" });

  const isBreak = mode.id === "break";
  const active = status === "running" || status === "paused";
  const fractionLeft = total === 0 ? 0 : remaining / total;
  const ringColor = isBreak ? "var(--success)" : "var(--brand-500)";
  const continueHref = `/focus?duration=${mode.minutes}&src=landing`;
  const actionLabel =
    status === "running" ? "Pause" : status === "paused" ? "Resume" : status === "done" ? "Run it again" : isBreak ? "Start break" : "Start session";

  return (
    <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6 text-left sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-subtle)]">
          <span className={cn("h-1.5 w-1.5 rounded-full", status === "running" ? "bg-[var(--success)]" : "bg-[var(--border-strong)]")} aria-hidden="true" />
          Try it — no signup
        </p>
        <Link href={continueHref} className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)]" aria-label="Open the full focus timer">
          Full timer <Maximize2 size={12} aria-hidden="true" />
        </Link>
      </div>

      {/* Session-type chips. The highlight slides between them instead of
          re-painting, so switching a mode feels like moving a dial. */}
      <div role="group" aria-label="Session type" className="mt-4 grid grid-cols-3 gap-1 rounded-[var(--radius-md)] bg-[var(--surface-2)] p-1">
        {LANDING_TIMER_MODES.map((m) => {
          const selected = m.id === modeId;
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={selected}
              aria-describedby={chipGroupId}
              onClick={() => switchMode(m.id)}
              className={cn( "relative min-h-9 rounded-[var(--radius-sm)] px-2 text-[13px] font-medium transition-colors duration-[var(--duration-fast)]",
                selected ? "text-[var(--foreground)]" : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]",
              )}
            >
              {selected && (
                <motion.span
                  layoutId="landing-timer-mode"
                  className="absolute inset-0 rounded-[var(--radius-sm)] bg-[var(--surface-3)]"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative z-10">{m.label}</span>
            </button>
          );
        })}
      </div>
      <p id={chipGroupId} className="mt-2 text-center text-xs text-[var(--foreground-subtle)]">
        {mode.hint} · {mode.minutes} minutes
      </p>

      <div className="mt-5 grid place-items-center">
        <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
          <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90" aria-hidden="true">
            <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R} stroke="var(--brand-soft)" strokeWidth={RING_STROKE} fill="none" />
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_R}
              stroke={ringColor}
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * (1 - fractionLeft)}
              className="transition-[stroke-dashoffset] duration-1000 ease-linear motion-reduce:transition-none"
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <p
                role="timer"
                className={cn("font-mono text-[2.6rem] font-semibold leading-none tabular-nums tracking-tight", status === "done" ? "text-[var(--success)]" : "text-[var(--foreground)]")}
                aria-label={`${formatLandingTimer(remaining)} remaining in ${mode.label} preview`}
              >
                {formatLandingTimer(remaining)}
              </p>
              <p className="mt-2 text-xs text-[var(--foreground-subtle)]">
                {status === "done" ? "Block complete" : status === "paused" ? "Paused" : status === "running" ? (isBreak ? "Recovering…" : "Focusing…") : `${mode.minutes} min ${mode.label.toLowerCase()}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Status changes go to a live region; the per-second digits do not. */}
      <p aria-live="polite" className="sr-only">
        {status === "running" ? `${mode.label} preview running` : status === "paused" ? "Preview paused" : status === "done" ? "Preview block complete" : "Preview ready"}
      </p>

      <div className="mt-5 flex items-center justify-center gap-2">
        <Button onClick={toggle} className="min-w-40" aria-label={actionLabel}>
          {status === "running" ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />} {actionLabel}
        </Button>
        <Button variant="outline" size="icon" onClick={reset} disabled={!active && remaining === total} aria-label="Reset preview timer">
          <RotateCcw aria-hidden="true" />
        </Button>
      </div>

      <div className="mt-6 border-t border-[var(--border-subtle)] pt-4">
        {status === "done" ? (
          <div className="text-center">
            <p className="text-sm font-medium text-[var(--foreground)]">One full block, done.</p>
            <p className="mt-1 text-xs text-[var(--foreground-muted)]">
              This preview saves nothing — keep the momentum in the real timer, where it counts toward your streak.
            </p>
          </div>
        ) : (
          <p className="text-center text-xs leading-relaxed text-[var(--foreground-subtle)]">
            A working preview — nothing is saved. Finish here, then start the same block in the full timer with tasks, coaching, and streaks.
          </p>
        )}
        <Button asChild variant={status === "done" ? "default" : "ghost"} className="mt-3 w-full">
          <Link href={continueHref}>
            Continue with this {isBreak ? "break" : "session"} <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
