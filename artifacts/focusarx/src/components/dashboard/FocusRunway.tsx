import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Check, Circle, Clock3, Play, RefreshCw, Sparkles, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  buildFocusRunway,
  formatRunwayTime,
  localDayKey,
  minuteOfDay,
  nextRunwayBlock,
  readFocusRunway,
  runwayStatus,
  saveFocusRunway,
  type FocusRunwayPlan,
  type RunwayBlock,
  type RunwayStatus,
  type RunwayTask,
} from "@/lib/focusRunway";

const statusCopy: Record<RunwayStatus, string> = {
  done: "Done",
  running: "Now",
  "up-next": "Up next",
  missed: "Passed",
  planned: "Later",
};

function statusClass(status: RunwayStatus): string {
  if (status === "done") return "border-[var(--success)]/30 bg-[var(--success-soft)] text-[var(--success)]";
  if (status === "running") return "border-[var(--brand-500)]/30 bg-[var(--brand-soft)] text-[var(--brand-strong)]";
  if (status === "missed") return "border-[var(--warning)]/30 bg-[var(--warning-soft)] text-[var(--warning)]";
  return "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--foreground-subtle)]";
}

function blockIcon(block: RunwayBlock, status: RunwayStatus) {
  if (status === "done") return <Check aria-hidden="true" className="size-3.5" />;
  if (block.kind === "reset") return <Wind aria-hidden="true" className="size-3.5" />;
  return <Circle aria-hidden="true" className="size-3.5" />;
}

export function FocusRunway({
  tasks,
  onStart,
  onToggleTask,
  date,
}: {
  tasks: RunwayTask[];
  onStart: (block: Pick<RunwayBlock, "title" | "minutes">) => void;
  onToggleTask: (taskId: string) => void;
  /** Omitting this keeps the compact dashboard experience on today. */
  date?: Date;
}) {
  const [now, setNow] = useState(() => new Date());
  const day = localDayKey(date ?? now);
  const [plan, setPlan] = useState<FocusRunwayPlan | null>(() => readFocusRunway(localDayKey(date ?? new Date())));
  // Date changes should never flash the previously selected day's commitments.
  const currentPlan = plan?.day === day ? plan : null;

  // Keep the live "now / passed" labels useful without a second-by-second
  // render. The timer itself owns precise countdown rendering.
  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = window.setInterval(tick, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  // A plan belongs to a calendar day. Never surface yesterday's schedule as if
  // it were actionable when a tab stays open past midnight.
  useEffect(() => {
    setPlan((current) => current?.day === day ? current : readFocusRunway(day));
  }, [day]);

  const completedTaskIds = useMemo(() => new Set<string>(), []);
  const activeTaskIds = useMemo(() => new Set(tasks.map((task) => task.id)), [tasks]);
  // `tasks` only includes open work on the dashboard. A planned focus block
  // whose task has disappeared is therefore complete, while resets remain live.
  const completedIds = useMemo(() => {
    const result = new Set(completedTaskIds);
    for (const block of currentPlan?.blocks ?? []) {
      if (block.kind === "focus" && block.taskId && !activeTaskIds.has(block.taskId)) result.add(block.taskId);
    }
    return result;
  }, [activeTaskIds, completedTaskIds, currentPlan?.blocks]);
  const realNowMinute = minuteOfDay(now);
  const today = localDayKey(now);
  // A future day starts at the beginning of its runway; a past day is rendered
  // honestly as passed. Only today's plan should be driven by the live clock.
  const nowMinute = day === today ? realNowMinute : day > today ? -1 : 24 * 60;

  // A task with a future due date is not silently pulled into today's calendar.
  // Undated work remains available, while planners can explicitly select a due
  // date from the Week Runway page.
  const eligibleTasks = tasks.filter((task) => !task.dueDate || task.dueDate <= day);

  const generate = () => {
    const next = buildFocusRunway(eligibleTasks, { day, startAtMinute: day === today ? realNowMinute : 9 * 60 });
    setPlan(next);
    saveFocusRunway(next);
  };

  const next = currentPlan ? nextRunwayBlock(currentPlan.blocks, nowMinute, completedIds) : null;
  const hasPlan = Boolean(currentPlan?.blocks.length);
  const plannedTaskIds = new Set(currentPlan?.blocks.filter((block) => block.taskId).map((block) => block.taskId));
  const unplannedCount = eligibleTasks.filter((task) => !plannedTaskIds.has(task.id)).length;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="relative gap-3 border-b border-[var(--border-subtle)] bg-[linear-gradient(118deg,color-mix(in_srgb,var(--brand-500)_10%,transparent),transparent_62%)] pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand-strong)]"><Sparkles aria-hidden="true" className="size-3.5" /></span>
            <span className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-[var(--foreground-subtle)]">Adaptive day plan</span>
          </div>
          <CardTitle>Focus runway</CardTitle>
          <CardDescription className="mt-1 max-w-2xl">A calm, time-aware path from your task list to the next protected block. Plans stay in this browser until you choose to start or complete work.</CardDescription>
        </div>
        <Button variant="secondary" size="sm" onClick={generate} disabled={!eligibleTasks.length}>
          <RefreshCw aria-hidden="true" /> {hasPlan ? "Re-plan from now" : "Make today’s plan"}
        </Button>
      </CardHeader>

      <CardContent className="p-0">
        {!eligibleTasks.length ? (
          <div className="px-6 py-10 text-center">
            <Check className="mx-auto size-5 text-[var(--success)]" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold">The runway is clear.</p>
            <p className="mt-1 text-sm text-[var(--foreground-muted)]">Add an undated task or give one a due date for this day when there is something worth protecting time for.</p>
          </div>
        ) : !hasPlan ? (
          <div className="px-6 py-10 text-center">
            <Clock3 className="mx-auto size-5 text-[var(--brand-strong)]" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold">Turn {eligibleTasks.length} open {eligibleTasks.length === 1 ? "task" : "tasks"} into a realistic day.</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-[var(--foreground-muted)]">High-priority and due-today work comes first, with room to reset between deeper blocks.</p>
          </div>
        ) : (
          <>
            {next ? (
              <div className="flex flex-col gap-3 border-b border-[var(--border-subtle)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-[var(--brand-strong)]">{runwayStatus(next, nowMinute, completedIds) === "running" ? "In this window" : "Next on your runway"}</p>
                  <p className="mt-0.5 truncate text-sm font-semibold">{next.title}</p>
                  <p className="mt-0.5 text-xs text-[var(--foreground-muted)]">{formatRunwayTime(next.startsAtMinute)} · {next.minutes} min{next.kind === "reset" ? " reset" : " focus block"}</p>
                </div>
                {next.kind === "focus" ? <Button size="sm" onClick={() => onStart(next)}><Play aria-hidden="true" /> Start block</Button> : <Button asChild size="sm" variant="secondary"><Link href="/breathe"><Wind aria-hidden="true" /> Start reset</Link></Button>}
              </div>
            ) : null}

            <ol className="divide-y divide-[var(--border-subtle)]" aria-label="Today’s timed plan">
              {currentPlan!.blocks.map((block) => {
                const status = runwayStatus(block, nowMinute, completedIds);
                return (
                  <li key={block.id} className="flex min-h-16 items-center gap-3 px-5 py-3">
                    <time className="w-[4.8rem] shrink-0 text-xs font-medium tabular-nums text-[var(--foreground-subtle)]" dateTime={`${day}T${String(Math.floor(block.startsAtMinute / 60)).padStart(2, "0")}:${String(block.startsAtMinute % 60).padStart(2, "0")}`}>{formatRunwayTime(block.startsAtMinute).replace(" ", "\u00a0")}</time>
                    <span className={`grid size-7 shrink-0 place-items-center rounded-full border ${statusClass(status)}`}>{blockIcon(block, status)}</span>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm ${status === "done" ? "text-[var(--foreground-subtle)] line-through" : "font-medium"}`}>{block.title}</p>
                      <p className="mt-0.5 text-xs text-[var(--foreground-subtle)]">{block.minutes} min · ends {formatRunwayTime(block.endsAtMinute)}</p>
                    </div>
                    <Badge className={statusClass(status)}>{statusCopy[status]}</Badge>
                    {block.kind === "focus" && block.taskId && status !== "done" ? (
                      <button type="button" onClick={() => onToggleTask(block.taskId!)} className="grid size-9 shrink-0 place-items-center rounded-lg text-[var(--foreground-subtle)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--success)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)]" aria-label={`Mark ${block.title} complete`} title="Mark complete"><Check aria-hidden="true" className="size-4" /></button>
                    ) : null}
                  </li>
                );
              })}
            </ol>
            {unplannedCount > 0 ? <p className="border-t border-[var(--border-subtle)] px-5 py-3 text-xs text-[var(--foreground-muted)]">{unplannedCount} {unplannedCount === 1 ? "task does" : "tasks do"} not fit before 7 PM. Re-plan when you have more time instead of silently overbooking your day.</p> : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
