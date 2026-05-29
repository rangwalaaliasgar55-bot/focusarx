import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getToken } from "@/lib/auth";
import { Clock } from "lucide-react";

type Task = { id: string; text: string; completed: boolean; estimatedMinutes: number | null; order: number };

const COLORS = ["#7C3AED", "#4F46E5", "#06B6D4", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

interface Props {
  tasks?: Task[];
  elapsedSeconds?: number;
  isRunning?: boolean;
  onOverrun?: (task: Task, overrunMinutes: number) => void;
}

export default function TaskTimeline({ tasks: propTasks, elapsedSeconds = 0, isRunning = false, onOverrun }: Props) {
  const [apiTasks, setApiTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(!propTasks);
  const [overrunShown, setOverrunShown] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const overrunRef = useRef(false);

  useEffect(() => {
    if (propTasks !== undefined) { setLoading(false); return; }
    const token = getToken();
    fetch("/api/tasks", {
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
      .then(r => r.ok ? r.json() : { tasks: [] })
      .then((d: { tasks?: Task[] }) => { setApiTasks(d.tasks?.filter(t => !t.completed) ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [propTasks]);

  const tasks = propTasks?.filter(t => !t.completed) ?? apiTasks;
  const tasksWithTime = tasks.filter(t => t.estimatedMinutes && t.estimatedMinutes > 0);
  const totalMinutes = tasksWithTime.reduce((sum, t) => sum + (t.estimatedMinutes ?? 0), 0);
  const elapsedMinutes = elapsedSeconds / 60;
  const totalElapsedPct = totalMinutes > 0 ? Math.min((elapsedMinutes / totalMinutes) * 100, 100) : 0;
  const remainingMinutes = Math.max(0, totalMinutes - elapsedMinutes);

  useEffect(() => {
    if (!isRunning || overrunRef.current || tasksWithTime.length === 0) return;
    const firstTask = tasksWithTime[0];
    if (!firstTask?.estimatedMinutes) return;
    if (elapsedMinutes > firstTask.estimatedMinutes) {
      const overrun = Math.round(elapsedMinutes - firstTask.estimatedMinutes);
      overrunRef.current = true;
      onOverrun?.(firstTask, overrun);
    }
  }, [elapsedSeconds, isRunning, tasksWithTime, onOverrun]);

  const saveEstimate = async (taskId: string, minutes: number) => {
    const token = getToken();
    await fetch(`/api/tasks/${taskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ estimatedMinutes: minutes }),
    });
    setApiTasks(ts => ts.map(t => t.id === taskId ? { ...t, estimatedMinutes: minutes } : t));
    setEditingId(null);
  };

  if (loading) return null;

  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-5 backdrop-blur-xl">
        <p className="text-[10px] uppercase tracking-widest text-[#4B5563] mb-1">Task Timeline</p>
        <p className="text-sm text-[#4B5563] text-center py-4">No pending tasks. Add tasks with time estimates to see the timeline.</p>
      </div>
    );
  }

  const now = new Date();
  const startHour = now.getHours();
  const startMin = now.getMinutes();

  return (
    <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-5 backdrop-blur-xl space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[#4B5563]">Task Timeline</p>
          <h3 className="mt-0.5 text-sm font-semibold text-[#E2E8F0]">
            {totalMinutes > 0
              ? isRunning
                ? `${Math.round(remainingMinutes)}m remaining`
                : `${totalMinutes}m scheduled`
              : "Add time estimates"}
          </h3>
        </div>
        {isRunning && totalMinutes > 0 && (
          <span className="text-xs text-emerald-400 animate-pulse">● Live</span>
        )}
      </div>

      {/* Overall progress bar */}
      {totalMinutes > 0 && (
        <div className="space-y-1">
          <div className="relative h-2 rounded-full bg-[rgba(124,58,237,0.08)] overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#7C3AED] to-[#06B6D4]"
              animate={{ width: `${totalElapsedPct}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-[#4B5563]">
            <span>{Math.round(elapsedMinutes)}m elapsed</span>
            <span>{Math.round(totalElapsedPct)}%</span>
            <span>{totalMinutes}m total</span>
          </div>
        </div>
      )}

      {/* Per-task timeline bars */}
      {tasksWithTime.length > 0 && (
        <div className="space-y-2">
          {(() => {
            let offset = 0;
            return tasksWithTime.map((task, i) => {
              const pct = totalMinutes > 0 ? ((task.estimatedMinutes ?? 0) / totalMinutes) * 100 : 0;
              const blockStart = offset;
              offset += pct;

              // Elapsed progress within this block
              const blockStartMin = (blockStart / 100) * totalMinutes;
              const blockEndMin = blockStartMin + (task.estimatedMinutes ?? 0);
              const blockElapsed = Math.min(Math.max(elapsedMinutes - blockStartMin, 0), task.estimatedMinutes ?? 0);
              const blockElapsedPct = (task.estimatedMinutes ?? 0) > 0 ? (blockElapsed / (task.estimatedMinutes ?? 1)) * 100 : 0;

              const blockHour = Math.floor((startMin + blockStartMin) / 60) + startHour;
              const blockMin = Math.floor((startMin + blockStartMin) % 60);
              const endHour = Math.floor((startMin + blockEndMin) / 60) + startHour;
              const endMin = Math.floor((startMin + blockEndMin) % 60);
              const startLabel = `${(blockHour % 24).toString().padStart(2, "0")}:${blockMin.toString().padStart(2, "0")}`;
              const endLabel = `${(endHour % 24).toString().padStart(2, "0")}:${endMin.toString().padStart(2, "0")}`;

              const color = COLORS[i % COLORS.length]!;
              const isDone = blockElapsedPct >= 100;

              return (
                <div key={task.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="truncate text-[11px] text-[#94A3B8] font-medium">{task.text}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[9px] text-[#4B5563]">{startLabel}–{endLabel}</span>
                      <span
                        className="rounded-md px-1.5 py-0.5 text-[9px] font-semibold"
                        style={{ background: `${color}18`, color }}
                      >
                        {task.estimatedMinutes}m
                      </span>
                    </div>
                  </div>
                  <div className="relative h-5 rounded-lg overflow-hidden bg-[rgba(124,58,237,0.06)]">
                    {/* Background fill */}
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-lg flex items-center px-2"
                      style={{ width: `${pct}%`, backgroundColor: color + "18", borderLeft: `2px solid ${color}44` }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                    {/* Progress overlay */}
                    {isRunning && (
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-lg"
                        style={{ backgroundColor: color + (isDone ? "55" : "30"), maxWidth: `${pct}%` }}
                        animate={{ width: `${Math.min(blockElapsedPct, 100) * pct / 100}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    )}
                    {/* Task name inside bar */}
                    <div
                      className="absolute inset-y-0 left-0 flex items-center px-2 pointer-events-none"
                      style={{ width: `${pct}%` }}
                    >
                      <span className="truncate text-[9px] font-medium" style={{ color }}>
                        {isDone && isRunning ? "✓ " : ""}{task.text}
                      </span>
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* Task list with time editing */}
      <div className="space-y-1.5 pt-1 border-t border-white/5">
        {tasks.map((task, i) => {
          const hasTime = task.estimatedMinutes && task.estimatedMinutes > 0;
          const color = COLORS[i % COLORS.length]!;
          return (
            <div key={task.id} className="flex items-center gap-2 group">
              <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <p className="flex-1 truncate text-xs text-[#94A3B8]">{task.text}</p>

              {editingId === task.id ? (
                <div className="flex items-center gap-1">
                  <Clock size={10} className="text-[#4B5563]" />
                  <input
                    type="number"
                    autoFocus
                    value={editVal}
                    onChange={e => setEditVal(e.target.value)}
                    onBlur={() => {
                      const v = parseInt(editVal);
                      if (!isNaN(v) && v > 0) void saveEstimate(task.id, v);
                      else setEditingId(null);
                    }}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        const v = parseInt(editVal);
                        if (!isNaN(v) && v > 0) void saveEstimate(task.id, v);
                        else setEditingId(null);
                      }
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="w-14 rounded-lg border border-[rgba(124,58,237,0.3)] bg-transparent px-2 py-0.5 text-xs text-[#A78BFA] focus:outline-none"
                    placeholder="min"
                  />
                </div>
              ) : (
                <button
                  onClick={() => { setEditingId(task.id); setEditVal(task.estimatedMinutes?.toString() ?? ""); }}
                  className={`flex items-center gap-1 text-[10px] transition-colors rounded-md px-1.5 py-0.5 ${
                    hasTime
                      ? "font-semibold opacity-100"
                      : "opacity-0 group-hover:opacity-100 text-[#4B5563] hover:text-[#A78BFA]"
                  }`}
                  style={hasTime ? { background: `${color}15`, color } : undefined}
                >
                  {hasTime ? (
                    <><Clock size={8} />{task.estimatedMinutes}m</>
                  ) : (
                    "+ time"
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function OverrunModal({ task, overrunMinutes, onReschedule, onDefer, onDrop }: {
  task: { text: string };
  overrunMinutes: number;
  onReschedule: () => void;
  onDefer: () => void;
  onDrop: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 pb-8 px-4 backdrop-blur-sm sm:items-center sm:pb-0"
    >
      <motion.div
        initial={{ y: 40, scale: 0.95 }}
        animate={{ y: 0, scale: 1 }}
        className="w-full max-w-sm rounded-2xl border border-[rgba(255,184,0,0.3)] bg-[rgba(8,12,28,0.98)] p-6 shadow-2xl"
      >
        <div className="mb-1 flex items-center gap-2">
          <span className="text-lg">⏱️</span>
          <p className="text-[10px] uppercase tracking-widest text-[rgba(255,184,0,0.8)]">Overrun detected</p>
        </div>
        <h3 className="mb-1 text-base font-bold text-[#E2E8F0]">You're {overrunMinutes}m over on:</h3>
        <p className="mb-5 text-sm text-[#94A3B8] italic">"{task.text}"</p>
        <p className="mb-4 text-xs text-[#4B5563]">Auto-reschedule remaining tasks?</p>
        <div className="space-y-2.5">
          <button onClick={onReschedule}
            className="flex w-full items-center gap-3 rounded-xl border border-[rgba(255,184,0,0.3)] bg-[rgba(255,184,0,0.06)] px-4 py-3 text-left transition hover:bg-[rgba(255,184,0,0.12)]"
          >
            <span>🔄</span>
            <div>
              <p className="text-sm font-semibold text-[#E2E8F0]">Compress & reschedule</p>
              <p className="text-[11px] text-[#4B5563]">Shift remaining tasks to fit today</p>
            </div>
          </button>
          <button onClick={onDefer}
            className="flex w-full items-center gap-3 rounded-xl border border-[rgba(124,58,237,0.2)] px-4 py-3 text-left transition hover:bg-[rgba(124,58,237,0.08)]"
          >
            <span>📅</span>
            <div>
              <p className="text-sm font-semibold text-[#E2E8F0]">Move to tomorrow</p>
              <p className="text-[11px] text-[#4B5563]">Defer remaining tasks</p>
            </div>
          </button>
          <button onClick={onDrop}
            className="flex w-full items-center gap-3 rounded-xl border border-[rgba(239,68,68,0.2)] px-4 py-3 text-left transition hover:bg-[rgba(239,68,68,0.06)]"
          >
            <span>❌</span>
            <div>
              <p className="text-sm font-semibold text-[#E2E8F0]">Drop remaining tasks</p>
              <p className="text-[11px] text-[#4B5563]">Focus only on current task</p>
            </div>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
