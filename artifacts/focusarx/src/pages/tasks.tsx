import { useMemo, useRef, useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarClock,
  Check,
  CheckCheck,
  CheckSquare2,
  ListTodo,
  Plus,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import { useToast } from "@/components/Toast";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { Task } from "@/types/timer";

const FILTERS = [
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "all", label: "All" },
  { id: "done", label: "Done" },
] as const;

type Filter = (typeof FILTERS)[number]["id"];

function isToday(date: string) {
  const taskDate = new Date(date);
  const today = new Date();
  return taskDate.getFullYear() === today.getFullYear() && taskDate.getMonth() === today.getMonth() && taskDate.getDate() === today.getDate();
}

function TaskRow({
  task,
  selected,
  onSelect,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: Task;
  selected: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const pending = task.id.startsWith("pending-");
  const isMobile = useIsMobile();
  const rowRef = useRef<HTMLLIElement>(null);
  const [offsetX, setOffsetX] = useState(0);
  const startX = useRef(0);
  const [swiping, setSwiping] = useState(false);

  useEffect(() => {
    if (!isMobile) return;
    const el = rowRef.current;
    if (!el) return;
    let start = 0;
    const onTouchStart = (e: TouchEvent) => {
      start = e.touches[0]?.clientX ?? 0;
      startX.current = start;
      setSwiping(true);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!swiping) return;
      const cur = e.touches[0]?.clientX ?? 0;
      const diff = cur - start;
      // Limit swipe to ±100px
      const clamped = Math.max(-100, Math.min(100, diff));
      setOffsetX(clamped);
    };
    const onTouchEnd = () => {
      setSwiping(false);
      if (offsetX > 70) {
        onToggle();
        // Haptic
        if ("vibrate" in navigator) navigator.vibrate(20);
      } else if (offsetX < -70) {
        onDelete();
        if ("vibrate" in navigator) navigator.vibrate([20, 30, 20]);
      }
      setOffsetX(0);
    };
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [isMobile, offsetX, swiping, onToggle, onDelete]);

  return (
    <motion.li
      ref={rowRef}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, x: offsetX }}
      exit={{ opacity: 0, x: 24, height: 0 }}
      transition={{ duration: swiping ? 0 : 0.25, ease: "easeOut" }}
      className={cn("group relative flex min-h-16 items-center gap-2 border-b border-[var(--border-subtle)] px-3 last:border-0 sm:gap-3 sm:px-4", selected && "bg-[var(--brand-soft)]")}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target === event.currentTarget) onToggle();
        if ((event.key === "Delete" || event.key === "Backspace") && event.target === event.currentTarget) onDelete();
      }}
      tabIndex={0}
      aria-label={`${task.title} - swipe right to complete, swipe left to delete`}
    >
      {/* Swipe hints */}
      {isMobile && offsetX > 20 && (
        <div className="pointer-events-none absolute inset-y-0 left-0 flex w-20 items-center justify-center bg-[var(--success-soft)] text-[var(--success)]">
          <Check size={20} />
        </div>
      )}
      {isMobile && offsetX < -20 && (
        <div className="pointer-events-none absolute inset-y-0 right-0 flex w-20 items-center justify-center bg-[var(--danger-soft)] text-[var(--danger)]">
          <Trash2 size={20} />
        </div>
      )}
      <span className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center" aria-label={`Select ${task.title}`}>
        <Checkbox checked={selected} onCheckedChange={onSelect} aria-label={`Select ${task.title}`} />
      </span>
      <button type="button" onClick={onToggle} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[var(--foreground-subtle)] hover:bg-[var(--surface-hover)] hover:text-[var(--brand-strong)]" aria-label={task.done ? `Mark ${task.title} active` : `Complete ${task.title}`}>
        <span className={cn("grid h-6 w-6 place-items-center rounded-full border-2 border-[var(--border-strong)]", task.done && "border-[var(--success)] bg-[var(--success)] text-[var(--neutral-0)]")}>
          {task.done && <Check size={14} strokeWidth={3} />}
        </span>
      </button>
      <div className="min-w-0 flex-1 py-3">
        <p className={cn("truncate text-sm font-medium text-[var(--foreground)]", task.done && "text-[var(--foreground-subtle)] line-through")}>{task.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--foreground-subtle)]">
          <Badge variant={task.priority === "urgent" || task.priority === "high" ? "error" : task.priority === "low" ? "secondary" : "outline"} className="min-h-5 px-2 py-0 capitalize">{task.priority ?? "medium"}</Badge>
          <span>{task.category || "Uncategorized"}</span>
          {task.estimatedMinutes ? <span>{task.estimatedMinutes} min</span> : null}
          {task.dueDate ? <span className={task.dueDate < new Date().toISOString().slice(0, 10) && !task.done ? "text-[var(--danger)]" : ""}>Due {new Date(`${task.dueDate}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span> : null}
          {task.tags?.slice(0, 2).map((tag) => <span key={tag}>#{tag}</span>)}
          <span className="hidden sm:inline">{isToday(task.createdAt) ? "Added today" : new Date(task.createdAt).toLocaleDateString()}</span>
          {pending && <span className="text-[var(--brand-strong)]">Syncing…</span>}
        </div>
      </div>
      <Button variant="ghost" size="icon" className="shrink-0 text-[var(--foreground-subtle)] opacity-100 hover:text-[var(--brand-strong)] sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100" onClick={onEdit} aria-label={`Edit plan for ${task.title}`}>
        <Pencil />
      </Button>
      <Button variant="ghost" size="icon" className="shrink-0 text-[var(--foreground-subtle)] opacity-100 hover:text-[var(--danger)] sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100" onClick={onDelete} aria-label={`Delete ${task.title}`}>
        <Trash2 />
      </Button>
    </motion.li>
  );
}

function TaskPlanningDialog({ task, onClose, onSave }: { task: Task | null; onClose: () => void; onSave: (id: string, updates: Partial<Task>) => Promise<unknown> }) {
  const [estimateMinutes, setEstimateMinutes] = useState("");
  const [priority, setPriority] = useState<NonNullable<Task["priority"]>>("medium");
  const [dueDate, setDueDate] = useState("");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);

  // The component remains mounted for dialog focus management, so synchronize
  // its draft whenever a different task is selected.
  useEffect(() => {
    if (!task) return;
    setEstimateMinutes(task.estimatedMinutes ? String(task.estimatedMinutes) : "");
    setPriority(task.priority ?? "medium");
    setDueDate(task.dueDate ?? "");
    setTags((task.tags ?? []).join(", "));
  }, [task]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!task || saving) return;
    const parsedEstimate = Number(estimateMinutes);
    setSaving(true);
    try {
      await onSave(task.id, {
        estimatedMinutes: Number.isFinite(parsedEstimate) && parsedEstimate > 0 ? Math.min(1440, Math.round(parsedEstimate)) : null,
        priority,
        dueDate: dueDate || null,
        tags: tags.split(",").map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean).slice(0, 10),
      });
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={Boolean(task)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={save}>
          <DialogHeader>
            <DialogTitle>Plan this task</DialogTitle>
            <DialogDescription>{task?.title ?? ""}</DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">Estimate (minutes)<Input className="mt-1.5" type="number" min="1" max="1440" inputMode="numeric" value={estimateMinutes} onChange={(event) => setEstimateMinutes(event.target.value)} placeholder="25" /></label>
            <label className="text-sm font-medium">Priority<select value={priority} onChange={(event) => setPriority(event.target.value as NonNullable<Task["priority"]>)} className="mt-1.5 flex h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
            <label className="text-sm font-medium">Due date<Input className="mt-1.5" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
            <label className="text-sm font-medium">Tags<Input className="mt-1.5" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="study, writing" /></label>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={saving}>Save plan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function TasksPage() {
  const { tasks, addTask, updateTask, toggleDone, removeTask, isLoading, isError, refreshTasks } = useTasks();
  const { toast } = useToast();
  const [filter, setFilter] = useState<Filter>("today");
  const [query, setQuery] = useState("");
  const [newTask, setNewTask] = useState("");
  const [estimateMinutes, setEstimateMinutes] = useState("25");
  const [priority, setPriority] = useState<NonNullable<Task["priority"]>>("medium");
  const [dueDate, setDueDate] = useState("");
  const [tags, setTags] = useState("");
  const [showPlanningFields, setShowPlanningFields] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesSearch = !normalized || task.title.toLowerCase().includes(normalized) || task.category?.toLowerCase().includes(normalized);
      if (!matchesSearch) return false;
      if (filter === "done") return task.done;
      if (filter === "today") return !task.done && isToday(task.createdAt);
      if (filter === "upcoming") return !task.done && !isToday(task.createdAt);
      return true;
    });
  }, [filter, query, tasks]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const title = newTask.trim();
    if (!title || adding) return;
    setAdding(true);
    setNewTask("");
    try {
      const parsedEstimate = Number(estimateMinutes);
      await addTask(title, {
        estimatedMinutes: Number.isFinite(parsedEstimate) && parsedEstimate > 0 ? Math.min(1440, Math.round(parsedEstimate)) : null,
        priority,
        dueDate: dueDate || null,
        tags: tags.split(",").map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean).slice(0, 10),
      });
      toast("Task added to your plan", "success");
    } catch {
      setNewTask(title);
      toast("Task could not be added", "danger");
    } finally {
      setAdding(false);
      inputRef.current?.focus();
    }
  };

  const toggle = (task: Task) => {
    toggleDone(task.id);
    toast(task.done ? "Task moved back to active" : "Task completed", "success", 5000, {
      label: "Undo",
      onClick: () => toggleDone(task.id),
    });
  };

  const deleteTask = (task: Task) => {
    removeTask(task.id);
    setSelected((current) => {
      const next = new Set(current);
      next.delete(task.id);
      return next;
    });
    toast("Task deleted", "info");
  };

  const completeSelected = () => {
    tasks.filter((task) => selected.has(task.id) && !task.done).forEach((task) => toggleDone(task.id));
    setSelected(new Set());
    toast("Selected tasks completed", "success");
  };

  const deleteSelected = () => {
    selected.forEach((id) => removeTask(id));
    setSelected(new Set());
    toast("Selected tasks deleted", "info");
  };

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Workspace"
        title="Tasks"
        subtitle="Capture what matters, then clear the list one focused step at a time. Changes sync optimistically across FocusArx."
        icon={<CheckSquare2 />}
        actions={<Button onClick={() => inputRef.current?.focus()}><Plus /> Add task</Button>}
      />

      <form onSubmit={submit} className="ui-panel mb-5 p-2" aria-label="Add task with planning details">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input ref={inputRef} value={newTask} onChange={(event) => setNewTask(event.target.value)} placeholder="What needs your attention?" className="border-transparent bg-transparent focus-within:border-transparent" aria-label="Task title" />
          <Button type="submit" loading={adding} disabled={!newTask.trim()} className="sm:w-auto"><Plus /> Add</Button>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 px-1">
          <button type="button" onClick={() => setShowPlanningFields((value) => !value)} aria-expanded={showPlanningFields} className="min-h-9 rounded-md px-2 text-xs font-semibold text-[var(--brand-strong)] hover:bg-[var(--brand-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)]">{showPlanningFields ? "Hide planning details" : "Add time, priority, or due date"}</button>
          {!showPlanningFields ? <span className="text-xs text-[var(--foreground-subtle)]">A realistic estimate makes Focus Runway useful.</span> : null}
        </div>
        {showPlanningFields ? (
          <div className="grid gap-2 border-t border-[var(--border-subtle)] px-1 pt-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-medium text-[var(--foreground-muted)]">Estimate (minutes)<Input type="number" min="1" max="1440" inputMode="numeric" value={estimateMinutes} onChange={(event) => setEstimateMinutes(event.target.value)} className="mt-1" /></label>
            <label className="text-xs font-medium text-[var(--foreground-muted)]">Priority<select value={priority} onChange={(event) => setPriority(event.target.value as NonNullable<Task["priority"]>)} className="mt-1 flex h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
            <label className="text-xs font-medium text-[var(--foreground-muted)]">Due date<Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="mt-1" /></label>
            <label className="text-xs font-medium text-[var(--foreground-muted)]">Tags<Input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="study, writing" className="mt-1" /></label>
          </div>
        ) : null}
      </form>

      <section className="ui-panel overflow-hidden" aria-labelledby="task-list-title">
        <div className="flex flex-col gap-3 border-b border-[var(--border-subtle)] p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="flex overflow-x-auto rounded-[var(--radius-md)] bg-[var(--surface-hover)] p-1" role="tablist" aria-label="Task filters">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                role="tab"
                aria-selected={filter === item.id}
                onClick={() => { setFilter(item.id); setSelected(new Set()); }}
                className={cn("min-h-11 min-w-11 shrink-0 rounded-[var(--radius-sm)] px-3 text-xs font-semibold text-[var(--foreground-muted)] transition-colors", filter === item.id && "bg-[var(--surface-raised)] text-[var(--foreground)] shadow-[var(--shadow-xs)]")}
              >
                {item.label}
              </button>
            ))}
          </div>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter tasks" leftSlot={<Search />} className="w-full sm:w-64" aria-label="Filter tasks" />
        </div>

        <div className="flex min-h-14 items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4">
          <div>
            <h2 id="task-list-title" className="text-sm font-semibold">{FILTERS.find((item) => item.id === filter)?.label}</h2>
            <p className="text-xs text-[var(--foreground-subtle)]">{filtered.length} task{filtered.length === 1 ? "" : "s"}</p>
          </div>
          {selected.size > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1">
              <span className="mr-2 hidden text-xs text-[var(--foreground-muted)] sm:inline">{selected.size} selected</span>
              <Button variant="ghost" size="sm" onClick={completeSelected}><CheckCheck /> Complete</Button>
              <Button variant="ghost" size="sm" className="text-[var(--danger)]" onClick={deleteSelected}><Trash2 /> Delete</Button>
            </motion.div>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-px p-3" role="status" aria-label="Loading tasks">
            {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-16 rounded-none first:rounded-t-lg last:rounded-b-lg" />)}
          </div>
        ) : isError ? (
          <EmptyState icon={<RotateCcw />} title="Tasks are taking a moment" description="Your saved tasks are safe. Check your connection and try loading them again." action={{ label: "Retry", onClick: () => void refreshTasks() }} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={filter === "done" ? <CheckCheck /> : filter === "upcoming" ? <CalendarClock /> : <ListTodo />}
            title={query ? "No matching tasks" : filter === "done" ? "Nothing completed yet" : filter === "upcoming" ? "No upcoming tasks" : "Your list is clear"}
            description={query ? "Try another search term or switch filters." : "Add a task when something needs your attention. It will appear here immediately."}
            action={!query ? { label: "Add a task", onClick: () => inputRef.current?.focus() } : undefined}
          />
        ) : (
          <ul>
            <AnimatePresence initial={false}>
              {filtered.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  selected={selected.has(task.id)}
                  onSelect={() => setSelected((current) => {
                    const next = new Set(current);
                    if (next.has(task.id)) next.delete(task.id); else next.add(task.id);
                    return next;
                  })}
                  onToggle={() => toggle(task)}
                  onEdit={() => setEditingTask(task)}
                  onDelete={() => deleteTask(task)}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>

      <TaskPlanningDialog
        task={editingTask}
        onClose={() => setEditingTask(null)}
        onSave={async (id, updates) => {
          try {
            await updateTask(id, updates);
            toast("Task plan updated", "success");
          } catch {
            toast("Task plan could not be updated", "danger");
            throw new Error("Task plan update failed");
          }
        }}
      />
    </div>
  );
}
