import { Coins, Sparkles, Timer as TimerIcon } from "lucide-react";
import { computeSessionRewards } from "@/lib/sessionRewards";

/**
 * What this block is worth, on the screen where the decision is made.
 *
 * The timer is the one place in the product where the student is being asked to
 * keep going, and it was the one place that did not say what staying was worth.
 * The value only appeared *after* a session, on the summary card — which is the
 * wrong moment: a reward you learn about after the fact cannot motivate the
 * twenty minutes you are deciding about right now.
 *
 * So the projected payout is printed under the ring, using the server's own
 * arithmetic (`lib/sessionRewards`, drift-tested against
 * `api-server/src/lib/sessionRewards.ts`). Two states:
 *
 *   • **idle** — "a 45-minute block pays 900 XP and 90 coins", plus the
 *     milestone if it is within reach: the 50-coin bonus lands at 25 focused
 *     minutes, which is a real reason to pick 25 over 20.
 *   • **running** — the same projection, with the minutes already banked and
 *     what finishing adds. It is derived from the active seconds, so an early
 *     exit shows the honest smaller number instead of an estimate that never
 *     arrives.
 *
 * Only the marathon taper matters for longer blocks (75% beyond two hours), and
 * it is stated rather than hidden: a four-hour session that quietly pays less
 * per minute would be the same "fake logic" the timer was already fixed for.
 */
export function SessionWorth({
  minutes,
  activeSeconds = 0,
  isPremium = false,
  running = false,
}: {
  /** Length of the session as configured, in minutes. */
  minutes: number;
  /** Seconds of focus already banked in this session. */
  activeSeconds?: number;
  isPremium?: boolean;
  running?: boolean;
}) {
  const planned = Math.max(1, Math.round(minutes));
  const projection = computeSessionRewards({ minutes: planned, isPremium });
  const banked = computeSessionRewards({ minutes: Math.floor(Math.max(0, activeSeconds) / 60), isPremium });
  const remaining = Math.max(0, planned - Math.floor(Math.max(0, activeSeconds) / 60));
  const milestoneReached = planned >= 25;
  const taper = planned > 120;

  if (running) {
    return (
      <p
        className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-[11px] font-medium tabular-nums text-[var(--foreground-subtle)]"
        data-testid="session-worth"
      >
        <span className="inline-flex items-center gap-1">
          <Sparkles size={11} aria-hidden="true" />
          <span className="text-[var(--foreground-muted)]">{banked.xp.toLocaleString()} XP</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <Coins size={11} aria-hidden="true" />
          <span className="text-[var(--foreground-muted)]">{banked.coins.toLocaleString()} coins</span>
        </span>
        <span>
          {remaining > 0
            ? `finishing adds ${(projection.xp - banked.xp).toLocaleString()} XP and ${(projection.coins - banked.coins).toLocaleString()} coins`
            : "full block earned"}
        </span>
      </p>
    );
  }

  return (
    <div className="mt-2 flex flex-col items-center gap-0.5 text-[11px] font-medium tabular-nums text-[var(--foreground-subtle)]" data-testid="session-worth">
      <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5">
        <TimerIcon size={11} aria-hidden="true" />
        <span>
          This {planned}-minute block pays{" "}
          <span className="font-semibold text-[var(--foreground-muted)]">{projection.xp.toLocaleString()} XP</span>
          {" and "}
          <span className="font-semibold text-[var(--foreground-muted)]">{projection.coins.toLocaleString()} coins</span>
          {isPremium ? " (premium rate)" : ""}
        </span>
      </p>
      {milestoneReached ? (
        <p className="text-[var(--brand-gold)]">
          includes the +50 coin bonus for a full 25 minutes
        </p>
      ) : (
        <p>
          {25 - planned} more {25 - planned === 1 ? "minute" : "minutes"} to reach the 25-minute bonus — 50 extra coins
        </p>
      )}
      {taper && (
        <p>
          past 2 hours pays 75% per minute — a break pays better than the taper
        </p>
      )}
    </div>
  );
}
