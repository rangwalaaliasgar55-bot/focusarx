import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getToken } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { Target, Plus, Trash2, CheckCircle2, Circle, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { TiltCard } from "@/components/TiltCard";
import PageHeader from "@/components/PageHeader";

async function apiFetch(path: string, opts?: RequestInit) {
  const token = getToken();
  const res = await fetch(path, { ...opts, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts?.headers ?? {}) } });
  if (!res.ok) { const t = await res.text(); throw new Error(t); }
  return res.json();
}

type Goal = {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  createdAt: string;
};

export default function GoalsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const { data, isLoading } = useQuery<{ goals: Goal[] }>({
    queryKey: ["goals"],
    queryFn: () => apiFetch("/api/goals"),
    staleTime: 60_000,
  });

  const createGoal = useMutation({
    mutationFn: (body: { title: string; description: string }) => apiFetch("/api/goals", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      setTitle(""); setDescription(""); setShowForm(false);
      toast("Goal created!", "success");
    },
    onError: (e: any) => toast(e.message, "error"),
  });

  const toggleGoal = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      apiFetch(`/api/goals/${id}/complete`, { method: "PATCH", body: JSON.stringify({ completed }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
    onError: (e: any) => toast(e.message, "error"),
  });

  const deleteGoal = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/goals/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["goals"] }); toast("Goal removed", "success"); },
    onError: (e: any) => toast(e.message, "error"),
  });

  const goals = data?.goals ?? [];
  const active = goals.filter(g => !g.completed);
  const completed = goals.filter(g => g.completed);
  const completionRate = goals.length > 0 ? Math.round((completed.length / goals.length) * 100) : 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    createGoal.mutate({ title, description });
  }

  return (
    <div className="min-h-screen forge-bg-glow text-[var(--foreground)] px-4 sm:px-6 py-8 max-w-2xl mx-auto">
      <PageHeader
        icon={<Target size={18} className="text-[var(--brand-400)]" />}
        badgeColor="var(--brand-600)"
        title="Focus Goals"
        subtitle="Set ambitious goals and track your journey"
        actions={
          <button
            onClick={() => setShowForm(s => !s)}
            className="flex items-center gap-1.5 rounded-xl bg-[var(--brand-600)] px-4 py-2 text-[12px] font-bold text-[var(--palette-white)] hover:bg-[var(--palette-6d31d4)] transition-colors shadow-lg shadow-[var(--rgba-124-58-237-0_25)]"
          >
            <Plus size={14} /> New Goal
          </button>
        }
      />

      {/* Stats bar */}
      {goals.length > 0 && (
        <div className="mb-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[var(--foreground-subtle)]">{completed.length} of {goals.length} goals completed</span>
            <span className="text-xs font-bold text-[var(--brand-600)]">{completionRate}%</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--rgba-255-255-255-0_06)] overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[var(--brand-600)] to-[var(--brand-400)]"
              initial={{ width: 0 }}
              animate={{ width: `${completionRate}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
        </div>
      )}

      {/* Create form */}
      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmit}
            className="mb-5 rounded-2xl border border-[var(--rgba-124-58-237-0_3)] bg-[var(--surface-hover)] p-4 space-y-3 overflow-hidden"
          >
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Goal title (e.g. Complete ML course)"
              maxLength={100}
              autoFocus
              className="w-full rounded-xl border border-[var(--rgba-124-58-237-0_2)] bg-[var(--rgba-124-58-237-0_06)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder-[var(--palette-4a4f62)] focus:border-[var(--brand-600)] focus:outline-none transition-colors"
            />
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Description (optional)…"
              maxLength={300}
              rows={2}
              className="w-full rounded-xl border border-[var(--rgba-124-58-237-0_2)] bg-[var(--rgba-124-58-237-0_06)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder-[var(--palette-4a4f62)] focus:border-[var(--brand-600)] focus:outline-none transition-colors resize-none"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 rounded-xl border border-[var(--border-subtle)] py-2 text-sm text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors">Cancel</button>
              <button type="submit" disabled={!title.trim() || createGoal.isPending} className="flex-1 rounded-xl bg-[var(--brand-600)] py-2 text-sm font-semibold text-[var(--palette-white)] hover:bg-[var(--palette-6d31d4)] disabled:opacity-60 transition-colors">
                {createGoal.isPending ? "Creating…" : "Create Goal"}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-[var(--surface-hover)]" />)}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active goals */}
          {active.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--foreground-subtle)] mb-3 flex items-center gap-1.5">
                <Sparkles size={11} className="text-[var(--brand-600)]" /> Active ({active.length})
              </p>
              <div className="space-y-2">
                <AnimatePresence>
                  {active.map(goal => (
                    <GoalCard key={goal.id} goal={goal} onToggle={id => toggleGoal.mutate({ id, completed: true })} onDelete={id => deleteGoal.mutate(id)} />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Completed goals */}
          {completed.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--foreground-subtle)] mb-3 flex items-center gap-1.5">
                <CheckCircle2 size={11} className="text-[var(--palette-emerald-500)]" /> Completed ({completed.length})
              </p>
              <div className="space-y-2">
                <AnimatePresence>
                  {completed.map(goal => (
                    <GoalCard key={goal.id} goal={goal} onToggle={id => toggleGoal.mutate({ id, completed: false })} onDelete={id => deleteGoal.mutate(id)} />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {goals.length === 0 && (
            <div className="py-16 text-center">
              <Target size={40} className="mx-auto mb-4 text-[var(--brand-600)] opacity-30" />
              <p className="text-sm text-[var(--foreground-subtle)] mb-1">No goals yet</p>
              <p className="text-xs text-[var(--foreground-subtle)]">Set meaningful objectives to guide your focus journey</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GoalCard({ goal, onToggle, onDelete }: { goal: Goal; onToggle: (id: string) => void; onDelete: (id: string) => void }) {
  return (
    <TiltCard intensity={6}>
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`flex items-start gap-3 rounded-2xl border p-4 transition-all shadow-3d ${goal.completed ? "border-[var(--palette-emerald-900)]/30 bg-[var(--palette-emerald-900)]/10 opacity-70" : "border-[var(--border-subtle)] bg-[var(--surface-hover)] hover:border-[var(--brand-600)]/30"}`}
    >
      <button onClick={() => onToggle(goal.id)} className="mt-0.5 shrink-0 transition-transform hover:scale-110">
        {goal.completed
          ? <CheckCircle2 size={18} className="text-[var(--palette-emerald-500)]" />
          : <Circle size={18} className="text-[var(--foreground-subtle)] hover:text-[var(--brand-600)]" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${goal.completed ? "line-through text-[var(--foreground-subtle)]" : "text-[var(--foreground)]"}`}>{goal.title}</p>
        {goal.description && <p className="text-xs text-[var(--foreground-subtle)] mt-0.5 line-clamp-2">{goal.description}</p>}
        <p className="text-[11px] text-[var(--foreground-subtle)] mt-1">{new Date(goal.createdAt).toLocaleDateString()}</p>
      </div>
      <button onClick={() => onDelete(goal.id)} className="shrink-0 text-[var(--foreground-subtle)] hover:text-[var(--palette-red-400)] transition-colors mt-0.5">
        <Trash2 size={14} />
      </button>
    </motion.div>
    </TiltCard>
  );
}
