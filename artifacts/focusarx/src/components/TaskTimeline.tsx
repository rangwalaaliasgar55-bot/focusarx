import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getToken } from "@/lib/auth";

type Task = { id: string; text: string; completed: boolean; estimatedMinutes: number | null; order: number };

const COLORS = ["#7C3AED", "#4F46E5", "#06B6D4", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

interface Props {
  elapsedSeconds?: number;
  isRunning?: boolean;
  onOverrun?: (task: Task, overrunMinutes: number) => void;
}

export default function TaskTimeline({ elapsedSeconds = 0, isRunning = false, onOverrun }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [overrunShown, setOverrunShown] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const overrunRef = useRef(false);

  const headers = () => {
    const token = getToken();
    return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  };

  useEffect(() => {
    fetch("/api/tasks", { headers: headers() })
      .then(r => r.ok ? r.json() : { tasks: [] })
      .then((d: { tasks?: Task[] }) => { setTasks(d.tasks?.filter(t => !t.completed) ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const tasksWithTime = tasks.filter(t => t.estimatedMinutes && t.estimatedMinutes > 0);
  const totalMinutes = tasksWithTime.reduce((sum, t) => sum + (t.estimatedMinutes ?? 0), 0);

  useEffect(() => {
    if (!isRunning || overrunRef.current || tasksWithTime.length === 0) return;
    const firstTask = tasksWithTime[0];
    if (!firstTask?.estimatedMinutes) return;
    const elapsedMinutes = elapsedSeconds / 60;
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
    setTasks(ts => ts.map(t => t.id === taskId ? { ...t, estimatedMinutes: minutes } : t));
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
    <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-5 backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[#4B5563]">Task Timeline</p>
          <h3 className="mt-0.5 text-sm font-semibold text-[#E2E8F0]">
            {totalMinutes > 0 ? `${totalMinutes}m scheduled` : "Add time estimates"}
          </h3>
        </div>
        {isRunning && totalMinutes > 0 && (
          <span className="text-xs text-emerald-400 animate-pulse">● Live</span>
        )}
      </div>

      {tasksWithTime.length > 0 && (
        <div className="mb-5 space-y-2">
          {(() => {
            let offset = 0;
            return tasksWithTime.map((task, i) => {
              const pct = totalMinutes > 0 ? ((task.estimatedMinutes ?? 0) / totalMinutes) * 100 : 0;
              const blockStart = offset;
              offset += pct;
              const elapsedPct = totalMinutes > 0 ? Math.min(((elapsedSeconds / 60) / totalMinutes) * 100, 100) : 0;
              const color = COLORS[i % COLORS.length]!;

              const blockHour = Math.floor((startMin + blockStart * totalMinutes / 100) / 60) + startHour;
              const blockMin = Math.floor((startMin + blockStart * totalMinutes / 100) % 60);
              const timeLabel = `${blockHour % 24}:${blockMin.toString().padStart(2, "0")}`;

              return (
                <div key={task.id} className="flex items-center gap-2">
                  <span className="w-10 text-right text-[9px] text-[#4B5563]">{timeLabel}</span>
                  <div className="relative flex-1 h-7 rounded-lg overflow-hidden bg-[rgba(124,58,237,0.06)]">
                    <motion.div
                      className="absolute inset-y-0 left-0 flex items-center px-2 rounded-lg"
                      style={{ width: `${pct}%`, backgroundColor: color + "22", borderLeft: `3px solid ${color}` }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    >
                      <span className="truncate text-[10px] font-medium" style={{ color }}>{task.text}</span>
                    </motion.div>
                    {isRunning && i === 0 && (
                      <motion.div
                        className="absolute inset-y-0 left-0 bg-white/5 rounded-r"
                        animate={{ width: `${elapsedPct}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    )}
                  </div>
                  <span className="w-8 text-[9px] text-[#4B5563]">{task.estimatedMinutes}m</span>
                </div>
              );
            });
          })()}
        </div>
      )}

      <div className="space-y-2">
        {tasks.map((task, i) => (
          <div key={task.id} className="flex items-center gap-2 group">
            <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
            <p className="flex-1 truncate text-xs text-[#94A3B8]">{task.text}</p>
            {editingId === task.id ? (
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
                className="w-14 rounded-lg border border-[rgba(124,58,237,0.3)] bg-transparent px-2 py-1 text-xs text-[#A78BFA] focus:outline-none"
                placeholder="min"
              />
            ) : (
              <button
                onClick={() => { setEditingId(task.id); setEditVal(task.estimatedMinutes?.toString() ?? ""); }}
                className="text-[10px] text-[#4B5563] hover:text-[#A78BFA] transition-colors opacity-0 group-hover:opacity-100"
              >
                {task.estimatedMinutes ? `${task.estimatedMinutes}m` : "+ time"}
              </button>
            )}
          </div>
        ))}
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
        <h3 className="mb-1 text-base font-bold text-[#E2E8F0]">
          You're {overrunMinutes}m over on:
        </h3>
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
