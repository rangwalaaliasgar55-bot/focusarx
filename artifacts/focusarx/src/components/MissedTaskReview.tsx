import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getToken } from "@/lib/auth";
import { isOnboarded, tryAcquireModal, releaseModal } from "@/lib/onboarding";

interface MissedTask {
  id: string;
  text: string;
  createdAt: string;
  category?: string | null;
  priority?: string | null;
  dueDate?: string | null;
}

interface Props {
  open: boolean;
  tasks: MissedTask[];
  onDone: () => void;
}

type Action = "keep" | "move_today" | "archive" | "delete";

const ACTIONS: { id: Action; label: string; desc: string; color: string }[] = [
  { id: "keep", label: "Keep Task", desc: "Stay on active list", color: "bg-[var(--rgba-255-255-255-0_06)] border-[var(--palette-2a2d3a)] text-[var(--foreground)] hover:border-[var(--brand-600)]/50" },
  { id: "move_today", label: "Move to Today", desc: "Set due date to today", color: "bg-[var(--brand-600)]/10 border-[var(--brand-600)]/30 text-[var(--brand-400)] hover:bg-[var(--brand-600)]/20" },
  { id: "archive", label: "Archive", desc: "Store for later reference", color: "bg-[var(--palette-amber-500)]/10 border-[var(--palette-amber-500)]/20 text-[var(--palette-amber-400)] hover:bg-[var(--palette-amber-500)]/20" },
  { id: "delete", label: "Delete", desc: "Remove permanently", color: "bg-[var(--palette-red-500)]/10 border-[var(--palette-red-500)]/20 text-[var(--palette-red-400)] hover:bg-[var(--palette-red-500)]/20" },
];

function authHeaders() {
  const token = getToken();
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export default function MissedTaskReview({ open, tasks, onDone }: Props) {
  const [current, setCurrent] = useState(0);
  const [pending, setPending] = useState<boolean>(false);
  const [resolved, setResolved] = useState<Record<string, Action>>({});

  useEffect(() => {
    if (open) { setCurrent(0); setResolved({}); }
  }, [open]);

  if (!open || tasks.length === 0) return null;

  const task = tasks[current];
  const isLast = current === tasks.length - 1;
  const doneCount = Object.keys(resolved).length;

  const handleAction = async (action: Action) => {
    if (!task || pending) return;
    setPending(true);
    try {
      await fetch("/api/tasks/missed-review", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ taskId: task.id, action }),
      });
    } catch { }
    setResolved(prev => ({ ...prev, [task.id]: action }));
    setPending(false);
    if (isLast) {
      onDone();
    } else {
      setCurrent(c => c + 1);
    }
  };

  const priorityColor = (p: string | null | undefined) => {
    if (p === "urgent") return "text-[var(--palette-red-400)] bg-[var(--palette-red-500)]/10 border-[var(--palette-red-500)]/20";
    if (p === "high") return "text-[var(--palette-orange-400)] bg-[var(--palette-orange-500)]/10 border-[var(--palette-orange-500)]/20";
    if (p === "medium") return "text-[var(--palette-amber-400)] bg-[var(--palette-amber-500)]/10 border-[var(--palette-amber-500)]/20";
    return "text-[var(--foreground-subtle)] bg-[var(--rgba-255-255-255-0_06)] border-[var(--palette-2a2d3a)]";
  };

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-[var(--palette-black)]/70 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="w-full max-w-md rounded-2xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_025)] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[var(--rgba-255-255-255-0_06)]">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">📋</span>
            <div>
              <h2 className="text-base font-bold text-[var(--foreground)]">Daily Task Review</h2>
              <p className="text-xs text-[var(--foreground-subtle)]">You didn't complete these tasks yesterday</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <div className="flex-1 h-1.5 bg-[var(--rgba-255-255-255-0_06)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--brand-600)] rounded-full transition-all duration-[var(--duration-slow)]"
                style={{ width: `${((current) / tasks.length) * 100}%` }}
              />
            </div>
            <span className="text-xs text-[var(--foreground-subtle)] font-mono shrink-0">{current + 1}/{tasks.length}</span>
          </div>
        </div>

        {/* Task Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={task?.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.15 }}
            className="px-6 py-5"
          >
            <div className="rounded-xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_02)] p-4 mb-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-lg">⚠️</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--foreground)] leading-snug">{task?.text}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {task?.category && task.category !== "General" && (
                      <span className="rounded-full border border-[var(--palette-2a2d3a)] bg-[var(--rgba-255-255-255-0_06)] px-2 py-0.5 text-[10px] text-[var(--foreground-subtle)]">{task.category}</span>
                    )}
                    {task?.priority && (
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${priorityColor(task.priority)}`}>{task.priority}</span>
                    )}
                    <span className="text-[10px] text-[var(--foreground-subtle)]">
                      Created {new Date(task?.createdAt ?? "").toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-xs text-[var(--foreground-subtle)] mb-3 font-medium">What would you like to do?</p>
            <div className="grid grid-cols-2 gap-2">
              {ACTIONS.map(a => (
                <button
                  key={a.id}
                  onClick={() => handleAction(a.id)}
                  disabled={pending}
                  className={`rounded-xl border p-3 text-left transition-all disabled:opacity-50 ${a.color}`}
                >
                  <p className="text-xs font-semibold">{a.label}</p>
                  <p className="text-[10px] opacity-70 mt-0.5">{a.desc}</p>
                </button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Footer */}
        <div className="px-6 pb-5 flex items-center justify-between">
          <p className="text-[10px] text-[var(--foreground-subtle)]">{doneCount} resolved · {tasks.length - doneCount} remaining</p>
          <button
            onClick={onDone}
            className="text-xs text-[var(--foreground-subtle)] hover:text-[var(--palette-6b7080)] transition-colors"
          >
            Skip all →
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// Hook to check for missed tasks daily
export function useMissedTaskReview() {
  const [showReview, setShowReview] = useState(false);
  const [missedTasks, setMissedTasks] = useState<MissedTask[]>([]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    if (!isOnboarded()) return;

    const STORAGE_KEY = "focusarx-last-review-date";
    const today = new Date().toISOString().slice(0, 10);
    const lastReview = localStorage.getItem(STORAGE_KEY);
    if (lastReview === today) return;

    // Fetch tasks needing review
    const timer = setTimeout(() => {
      fetch("/api/tasks/missed-review", { headers: authHeaders() })
        .then(r => r.ok ? r.json() : null)
        .then((d: { tasks?: MissedTask[] } | null) => {
          if (d?.tasks && d.tasks.length > 0 && tryAcquireModal()) {
            setMissedTasks(d.tasks);
            setShowReview(true);
          }
          localStorage.setItem(STORAGE_KEY, today);
        })
        .catch(() => { });
    }, 3000); // Delay 3s after mount to not interrupt initial load

    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setShowReview(false);
    setMissedTasks([]);
    releaseModal();
  };

  return { showReview, missedTasks, dismiss };
}
