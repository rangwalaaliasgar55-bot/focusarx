import { deriveMirrorSeconds, type LeaderMirror } from "@/lib/crossTabSync";
import { getModeLabel } from "@/lib/timerUtils";

/**
 * Follower notice: another tab is leading the timer. Shows the leader's
 * live wall-clock countdown (heartbeats refresh it ~1 Hz, so no local
 * ticker is needed). Calm, display-only — the local clock stays untouched.
 */
export function LeaderMirrorChip({ mirror }: { mirror: LeaderMirror }) {
  const total = deriveMirrorSeconds(mirror);
  const m = Math.floor(total / 60).toString().padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return (
    <div
      role="status"
      aria-live="polite"
      className="glass-chip inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold text-[var(--foreground-subtle)]"
    >
      <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
      <span className="truncate tabular-nums">
        Running in another tab · {getModeLabel(mirror.mode)} {m}:{s}
      </span>
    </div>
  );
}
