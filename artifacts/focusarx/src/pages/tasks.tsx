import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarClock,
  Check,
  CheckCheck,
  CheckSquare2,
  ListTodo,
  Plus,
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
import { cn } from "@/lib/utils";
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
  onDelete,
}: {
  task: Task;
  selected: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const pending = task.id.startsWith("pending-");
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 24, height: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn("group flex min-h-16 items-center gap-2 border-b border-[var(--border-subtle)] px-3 last:border-0 sm:gap-3 sm:px-4", selected && "bg-[var(--brand-soft)]")}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target === event.currentTarget) onToggle();
        if ((event.key === "Delete" || event.key === "Backspace") && event.target === event.currentTarget) onDelete();
      }}
      tabIndex={0}
    >
      <label className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center" aria-label={`Select ${task.title}`}>
        <Checkbox checked={selected} onCheckedChange={onSelect} />
      </label>
      <button type="button" onClick={onToggle} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[var(--foreground-subtle)] hover:bg-[var(--surface-hover)] hover:text-[var(--brand-strong)]" aria-label={task.done ? `Mark ${task.title} active` : `Complete ${task.title}`}>
        <span className={cn("grid h-6 w-6 place-items-center rounded-full border-2 border-[var(--border-strong)]", task.done && "border-[var(--success)] bg-[var(--success)] text-[var(--neutral-0)]")}>
          {task.done && <Check size={14} strokeWidth={3} />}
        </span>
      </button>
      <div className="min-w-0 flex-1 py-3">
        <p className={cn("truncate text-sm font-medium text-[var(--foreground)]", task.done && "text-[var(--foreground-subtle)] line-through")}>{task.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--foreground-subtle)]">
          <Badge variant={task.priority === "high" ? "error" : task.priority === "low" ? "secondary" : "outline"} className="min-h-5 px-2 py-0 capitalize">{task.priority ?? "medium"}</Badge>
          <span>{task.category || "Uncategorized"}</span>
          <span className="hidden sm:inline">{isToday(task.createdAt) ? "Added today" : new Date(task.createdAt).toLocaleDateString()}</span>
          {pending && <span className="text-[var(--brand-strong)]">Syncing…</span>}
        </div>
      </div>
      <Button variant="ghost" size="icon" className="shrink-0 text-[var(--foreground-subtle)] opacity-100 hover:text-[var(--danger)] sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100" onClick={onDelete} aria-label={`Delete ${task.title}`}>
        <Trash2 />
      </Button>
    </motion.li>
  );
}

export default function TasksPage() {
  const { tasks, addTask, toggleDone, removeTask, isLoading, isError, refreshTasks } = useTasks();
  const { toast } = useToast();
  const [filter, setFilter] = useState<Filter>("today");
  const [query, setQuery] = useState("");
  const [newTask, setNewTask] = useState("");
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
      await addTask(title);
      toast("Task added", "success");
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

      <form onSubmit={submit} className="ui-panel mb-5 flex flex-col gap-2 p-2 sm:flex-row" aria-label="Quick add task">
        <Input ref={inputRef} value={newTask} onChange={(event) => setNewTask(event.target.value)} placeholder="What needs your attention?" className="border-transparent bg-transparent focus-within:border-transparent" aria-label="Task title" />
        <Button type="submit" loading={adding} disabled={!newTask.trim()} className="sm:w-auto"><Plus /> Add</Button>
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
                className={cn("min-h-9 shrink-0 rounded-[var(--radius-sm)] px-3 text-xs font-semibold text-[var(--foreground-muted)] transition-colors", filter === item.id && "bg-[var(--surface-raised)] text-[var(--foreground)] shadow-[var(--shadow-xs)]")}
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
                    next.has(task.id) ? next.delete(task.id) : next.add(task.id);
                    return next;
                  })}
                  onToggle={() => toggle(task)}
                  onDelete={() => deleteTask(task)}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>
    </div>
  );
}
