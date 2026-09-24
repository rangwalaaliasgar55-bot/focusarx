import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { FocusRunway } from "@/components/dashboard/FocusRunway";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTasks } from "@/hooks/useTasks";
import { localDayKey, readFocusRunways } from "@/lib/focusRunway";

function atLocalMidnight(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function shiftDays(date: Date, amount: number): Date {
  const next = atLocalMidnight(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function mondayFor(date: Date): Date {
  const day = atLocalMidnight(date);
  const offset = (day.getDay() + 6) % 7;
  return shiftDays(day, -offset);
}

function formatDayInput(date: Date): string { return localDayKey(date); }

function parseDayInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const next = new Date(year, month - 1, day);
  return Number.isNaN(next.valueOf()) ? null : next;
}

/**
 * A week-aware planner for the browser: each date owns a local day runway and
 * task metadata remains in the account. It deliberately avoids claiming it
 * can create operating-system calendar events or block desktop applications.
 */
export default function PlannerPage() {
  const [, navigate] = useLocation();
  const { activeTasks, toggleDone } = useTasks();
  const [selectedDate, setSelectedDate] = useState(() => atLocalMidnight(new Date()));
  const selectedDay = localDayKey(selectedDate);
  const weekStart = mondayFor(selectedDate);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => shiftDays(weekStart, index)), [weekStart]);
  const dayKeys = useMemo(() => days.map(localDayKey), [days]);
  const savedPlans = readFocusRunways(dayKeys);
  const today = localDayKey();

  // Undated work is intentionally offered only on today: scheduling it on
  // several future dates would create duplicate commitments. Give a task a
  // due date in Tasks to put it on a future runway.
  const availableTasks = selectedDay === today
    ? activeTasks
    : activeTasks.filter((task) => task.dueDate === selectedDay);

  const startPlannedFocus = ({ title, minutes }: { title: string; minutes: number }) => {
    navigate(`/?duration=${Math.max(1, Math.min(240, Math.round(minutes)))}&task=${encodeURIComponent(title)}`);
  };

  const rangeLabel = `${weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Planning"
        title="Week runway"
        subtitle="Give important work a real place in the week, then protect one block at a time."
        icon={<CalendarDays />}
        actions={<Button variant="secondary" onClick={() => setSelectedDate(atLocalMidnight(new Date()))}>Today</Button>}
      />

      <section className="ui-panel mb-5 overflow-hidden" aria-labelledby="week-picker-title">
        <div className="flex flex-col gap-3 border-b border-[var(--border-subtle)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="week-picker-title" className="text-sm font-semibold">{rangeLabel}</h2>
            <p className="mt-0.5 text-xs text-[var(--foreground-muted)]">Each day keeps its own browser-local runway. Your tasks and their planning details still sync to your account.</p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setSelectedDate((date) => shiftDays(date, -7))} aria-label="Previous week"><ChevronLeft /></Button>
            <input aria-label="Jump to date" type="date" value={formatDayInput(selectedDate)} onChange={(event) => { const next = parseDayInput(event.target.value); if (next) setSelectedDate(next); }} className="h-10 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]" />
            <Button variant="ghost" size="icon" onClick={() => setSelectedDate((date) => shiftDays(date, 7))} aria-label="Next week"><ChevronRight /></Button>
          </div>
        </div>
        <div className="grid grid-cols-7 divide-x divide-[var(--border-subtle)]" role="tablist" aria-label="Days in this week">
          {days.map((date) => {
            const key = localDayKey(date);
            const plan = savedPlans[key];
            const dueCount = activeTasks.filter((task) => task.dueDate === key).length;
            const isSelected = key === selectedDay;
            const isToday = key === today;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedDate(date)}
                className={`min-h-20 p-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-500)] ${isSelected ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "hover:bg-[var(--surface-hover)]"}`}
              >
                <span className="block text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-[var(--foreground-subtle)]">{date.toLocaleDateString(undefined, { weekday: "short" })}</span>
                <span className={`mt-1 inline-grid size-8 place-items-center rounded-full text-sm font-semibold ${isToday ? "bg-[var(--brand-600)] text-white" : ""}`}>{date.getDate()}</span>
                <span className="mt-1 block text-[0.6875rem] text-[var(--foreground-subtle)]">{plan ? `${plan.blocks.filter((block) => block.kind === "focus").length} blocks` : dueCount ? `${dueCount} due` : "Open"}</span>
              </button>
            );
          })}
        </div>
      </section>

      {selectedDay !== today && availableTasks.length === 0 ? (
        <EmptyState
          icon={<ClipboardList />}
          title="Nothing is due this day"
          description="Set a due date on a task to include it in a future runway. Undated tasks remain available in today’s plan so they cannot be accidentally scheduled more than once."
          action={{ label: "Manage tasks", onClick: () => navigate("/tasks") }}
        />
      ) : (
        <FocusRunway tasks={availableTasks} date={selectedDate} onStart={startPlannedFocus} onToggleTask={toggleDone} />
      )}

      <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-[var(--foreground-subtle)]"><Sparkles aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-[var(--brand-strong)]" /> Plans are intentionally reviewable, not opaque AI commitments. Re-plan from a selected day whenever your day changes.</p>
    </div>
  );
}
