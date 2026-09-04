/**
 * Weekly goal card (Phase 9.5).
 *
 * One sentence + one progress bar: minutes protected this week against a
 * personal target (default 300 min ≈ 12 pomodoros). The target lives in
 * localStorage so it works instantly with zero schema; progress comes from
 * the server's 7-day chart already on the dashboard.
 */

import { useState } from "react";
import { Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { safeGet, safeSet } from "@/lib/safeStorage";

const GOAL_KEY = "focusarx-weekly-goal-min";
const DEFAULT_GOAL = 300;

export function getWeeklyGoal(): number {
  const raw = Number.parseInt(safeGet(GOAL_KEY) || "", 10);
  return Number.isFinite(raw) && raw >= 30 && raw <= 6000 ? raw : DEFAULT_GOAL;
}

export default function WeeklyGoalCard({ weekMinutes }: { weekMinutes: number }) {
  const [goal, setGoal] = useState<number>(() => getWeeklyGoal());
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(getWeeklyGoal()));

  const pct = goal > 0 ? Math.min(100, Math.round((weekMinutes / goal) * 100)) : 0;
  const done = weekMinutes >= goal;

  const save = () => {
    const v = Number.parseInt(draft, 10);
    if (Number.isFinite(v) && v >= 30 && v <= 6000) {
      safeSet(GOAL_KEY, String(v));
      setGoal(v);
    }
    setEditing(false);
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><Target size={16} /> Weekly goal</CardTitle>
          <CardDescription>
            {done
              ? `Target hit — ${weekMinutes.toLocaleString()} of ${goal.toLocaleString()} min.`
              : `${weekMinutes.toLocaleString()} of ${goal.toLocaleString()} min protected.`}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <Progress value={pct} aria-label={`Weekly goal ${pct} percent`} />
        <div className="mt-3 flex items-center gap-2">
          {editing ? (
            <>
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                inputMode="numeric"
                aria-label="Weekly goal in minutes"
                className="h-11 max-w-32"
              />
              <Button size="sm" onClick={save} className="min-h-[44px]">Save</Button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => { setDraft(String(goal)); setEditing(true); }}
              className="min-h-[44px] text-xs font-semibold text-[var(--brand-strong)]"
            >
              Change target ({goal} min)
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
