/**
 * The week's target, as one row inside the week's card.
 *
 * This used to be a card of its own sitting next to the focus chart, and both
 * read the same seven-day array to compute the same total — two numbers that
 * could disagree. The chart card now owns the target: one total, one bar, one
 * sentence.
 *
 * Two things the previous card did not do:
 *   • A refused write is visible. `safeSet` returns false when the browser
 *     keeps the value in memory instead of localStorage, and the row says so
 *     rather than implying a target that will be gone after a reload.
 *   • An out-of-range target is rejected with a reason, instead of silently
 *     snapping back to the old number with the editor closed.
 */

import { useState } from "react";
import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  MAX_WEEKLY_GOAL_MIN,
  MIN_WEEKLY_GOAL_MIN,
  saveWeeklyGoal,
  weeklyGoalMin,
  weeklyGoalProgress,
  weeklyGoalSentence,
} from "@/lib/weeklyGoal";

type Notice = { kind: "error" | "warning"; text: string };

export function WeeklyGoalBar({ minutes }: { minutes: number }) {
  const [goal, setGoal] = useState<number>(() => weeklyGoalMin());
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const progress = weeklyGoalProgress(minutes, goal);

  const openEditor = () => {
    setDraft(String(goal));
    setNotice(null);
    setEditing(true);
  };

  const save = () => {
    const next = Number.parseInt(draft, 10);
    if (!Number.isFinite(next) || next < MIN_WEEKLY_GOAL_MIN || next > MAX_WEEKLY_GOAL_MIN) {
      setNotice({
        kind: "error",
        text: `Enter a whole number of minutes between ${MIN_WEEKLY_GOAL_MIN} and ${MAX_WEEKLY_GOAL_MIN.toLocaleString()}.`,
      });
      return;
    }
    const persisted = saveWeeklyGoal(next);
    setGoal(next);
    setEditing(false);
    setNotice(
      persisted
        ? null
        : { kind: "warning", text: "Saved for this visit only — this browser is blocking local storage." },
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm text-[var(--foreground-muted)]">
          <Target size={14} aria-hidden="true" className="shrink-0 text-[var(--brand-strong)]" />
          {weeklyGoalSentence(progress)}
        </p>
        {!editing && (
          <button
            type="button"
            onClick={openEditor}
            className="min-h-11 text-xs font-semibold text-[var(--brand-strong)]"
          >
            {progress.done ? `Raise the target (${progress.goal.toLocaleString()} min)` : `Change target (${progress.goal.toLocaleString()} min)`}
          </button>
        )}
      </div>

      <Progress value={progress.percent} aria-label={`Weekly goal ${progress.percent} percent`} />

      {editing && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") save();
              if (event.key === "Escape") {
                setEditing(false);
                setNotice(null);
              }
            }}
            inputMode="numeric"
            aria-label="Weekly goal in minutes"
            className="h-11 max-w-32"
          />
          <Button size="sm" onClick={save} className="min-h-11">
            Save target
          </Button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setNotice(null);
            }}
            className="min-h-11 text-xs font-semibold text-[var(--foreground-muted)]"
          >
            Cancel
          </button>
        </div>
      )}

      {notice && (
        <p
          role="alert"
          className={
            notice.kind === "error"
              ? "text-xs text-[var(--danger)]"
              : "text-xs text-[var(--foreground-muted)]"
          }
        >
          {notice.text}
        </p>
      )}
    </div>
  );
}

export default WeeklyGoalBar;
