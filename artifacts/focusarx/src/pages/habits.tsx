import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getToken } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { Plus, Flame, CheckCircle2, Circle, BarChart2, X, ChevronUp, Trash2 } from "lucide-react";
import { TiltCard } from "@/components/TiltCard";
import PageHeader from "@/components/PageHeader";
import { resolveColorToken } from "@/lib/color-tokens";

async function apiFetch(path: string, opts?: RequestInit) {
  const token = getToken();
  const res = await fetch(path, { ...opts, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts?.headers ?? {}) } });
  if (!res.ok) { const t = await res.text(); throw new Error(t); }
  return res.json();
}

const ICONS = ["⭐", "💪", "📚", "🏃", "🧘", "💧", "🥗", "😴", "📝", "🎯", "🎸", "💻", "🌿", "🧠", "🔥", "⚡", "🎨", "🌅", "☕", "🏋️"];
const COLORS = ["var(--brand-600)", "var(--palette-4f46e5)", "var(--palette-0891b2)", "var(--palette-059669)", "var(--palette-d97706)", "var(--palette-dc2626)", "var(--palette-db2777)", "var(--palette-9333ea)", "var(--palette-16a34a)", "var(--palette-ea580c)"];

function HabitHeatmap({ dates, color }: { dates: string[]; color: string }) {
  const dateSet = new Set(dates);
  const cells = useMemo(() => {
    const arr: string[] = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      arr.push(d.toISOString().split("T")[0]!);
    }
    return arr;
  }, []);

  return (
    <div className="grid gap-0.5" style={{ gridTemplateColumns: "repeat(18, 1fr)" }}>
      {cells.map(d => (
        <div
          key={d}
          title={d}
          className="aspect-square rounded-sm transition-colors"
          style={{
            background: dateSet.has(d) ? color : "var(--rgba-255-255-255-0_05)",
            minWidth: 8,
          }}
        />
      ))}
    </div>
  );
}

function CreateHabitModal({ onClose, onCreate }: { onClose: () => void; onCreate: (data: any) => void }) {
  const [form, setForm] = useState({ name: "", icon: "⭐", color: "var(--brand-600)", frequency: "daily" });

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-[var(--palette-black)]/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-[var(--foreground)]">New Habit</h2>
          <button onClick={onClose}><X size={18} className="text-[var(--foreground-subtle)]" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label htmlFor="name-71" className="text-xs font-semibold uppercase tracking-widest text-[var(--foreground-subtle)] block mb-1.5">Name *</label>
            <input id="name-71"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Read for 30 minutes…"
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--muted)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand-600)]"
              autoFocus
            />
          </div>
          <div>
            <p id="group-icon-81" className="text-xs font-semibold uppercase tracking-widest text-[var(--foreground-subtle)] block mb-1.5">Icon</p>
            <div role="group" aria-labelledby="group-icon-81" className="flex flex-wrap gap-1.5">
              {ICONS.map(ic => (
                <button key={ic} onClick={() => setForm(f => ({ ...f, icon: ic }))}
                  className={`text-xl rounded-lg p-1.5 transition-all ${form.icon === ic ? "bg-[var(--brand-600)]/30 ring-1 ring-[var(--brand-600)]" : "hover:bg-[var(--muted)]"}`}>
                  {ic}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p id="group-color-92" className="text-xs font-semibold uppercase tracking-widest text-[var(--foreground-subtle)] block mb-1.5">Color</p>
            <div role="group" aria-labelledby="group-color-92" className="flex gap-2">
              {COLORS.map(c => (
                <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                  className={`h-7 w-7 rounded-full transition-all ${form.color === c ? "ring-2 ring-[var(--palette-white)] ring-offset-1 ring-offset-[var(--rgba-8-9-20-1)] scale-110" : ""}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>
          <div>
            <p id="group-frequency-102" className="text-xs font-semibold uppercase tracking-widest text-[var(--foreground-subtle)] block mb-1.5">Frequency</p>
            <div role="group" aria-labelledby="group-frequency-102" className="flex gap-2">
              {["daily", "weekdays", "weekends"].map(f => (
                <button key={f} onClick={() => setForm(fr => ({ ...fr, frequency: f }))}
                  className={`flex-1 rounded-lg py-1.5 text-xs capitalize transition-all ${form.frequency === f ? "bg-[var(--brand-600)] text-[var(--palette-white)]" : "bg-[var(--muted)] text-[var(--foreground-subtle)] hover:text-[var(--foreground)] border border-[var(--border-subtle)]"}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 rounded-xl border border-[var(--border-subtle)] py-2 text-sm text-[var(--foreground-subtle)] hover:text-[var(--foreground)]">Cancel</button>
            <button
              onClick={() => { if (form.name.trim()) onCreate(form); }}
              disabled={!form.name.trim()}
              className="flex-1 rounded-xl bg-[var(--brand-600)] py-2 text-sm font-semibold text-[var(--palette-white)] disabled:opacity-50 hover:bg-[var(--palette-6d31d4)]">
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HabitCard({ habit, onComplete, onUncomplete, onDelete }: { habit: any; onComplete: () => void; onUncomplete: () => void; onDelete: () => void }) {
  const [showHeatmap, setShowHeatmap] = useState(false);

  return (
    <TiltCard intensity={6}>
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] p-4 transition-all hover:border-[var(--brand-600)]/20 shadow-3d">
      <div className="flex items-center gap-3">
        <button
          onClick={habit.completedToday ? onUncomplete : onComplete}
          className="relative shrink-0 transition-transform active:scale-90"
        >
          {habit.completedToday ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-full transition-all" style={{ background: `color-mix(in srgb, ${habit.color} 20%, transparent)`, border: `2px solid ${habit.color}` }}>
              <CheckCircle2 size={22} style={{ color: habit.color }} />
            </div>
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--palette-2a2d3a)] hover:border-[var(--brand-600)] transition-colors">
              <Circle size={22} className="text-[var(--palette-2a2d3a)]" />
            </div>
          )}
        </button>

        <span className="text-2xl shrink-0">{habit.icon}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-semibold truncate ${habit.completedToday ? "line-through text-[var(--foreground-subtle)]" : "text-[var(--foreground)]"}`}>{habit.name}</p>
            {habit.completedToday && <span className="shrink-0 text-[11px] font-bold text-[var(--palette-emerald-400)] bg-[var(--palette-emerald-500)]/10 border border-[var(--palette-emerald-500)]/20 rounded-full px-2 py-0.5">Done!</span>}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-[var(--palette-amber-400)] flex items-center gap-1"><Flame size={10} /> {habit.streak}d streak</span>
            <span className="text-xs text-[var(--foreground-subtle)]">{habit.totalCompletions} total</span>
            <span className="text-xs capitalize text-[var(--foreground-subtle)]">{habit.frequency}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setShowHeatmap(s => !s)} className="rounded-lg p-1.5 text-[var(--foreground-subtle)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors">
            {showHeatmap ? <ChevronUp size={14} /> : <BarChart2 size={14} />}
          </button>
          <button onClick={onDelete} className="rounded-lg p-1.5 text-[var(--foreground-subtle)] hover:text-[var(--palette-red-400)] hover:bg-[var(--palette-red-900)]/20 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {showHeatmap && (
        <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
          <p className="text-[11px] uppercase tracking-wider text-[var(--foreground-subtle)] mb-2">Last 90 days</p>
          <HabitHeatmap dates={habit.recentDates ?? []} color={habit.color} />
        </div>
      )}
    </div>
    </TiltCard>
  );
}

export default function HabitsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const today = new Date().toISOString().split("T")[0]!;

  const { data: habits = [], isLoading } = useQuery({
    queryKey: ["habits"],
    queryFn: () => apiFetch("/api/habits"),
    staleTime: 30_000,
  });

  const { data: stats } = useQuery({
    queryKey: ["habits-stats"],
    queryFn: () => apiFetch("/api/habits/stats"),
    staleTime: 60_000,
  });

  const createHabit = useMutation({
    mutationFn: (data: any) => {
      const token = typeof data.color === "string" ? data.color.match(/^var\((--[\w-]+)\)$/)?.[1] : undefined;
      const payload = token ? { ...data, color: resolveColorToken(token as `--${string}`) } : data;
      return apiFetch("/api/habits", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: () => { toast("Habit created! 🎯", "success"); setShowCreate(false); qc.invalidateQueries({ queryKey: ["habits"] }); qc.invalidateQueries({ queryKey: ["habits-stats"] }); },
    onError: (e: any) => toast(e.message, "error"),
  });

  const completeHabit = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/habits/${id}/complete`, { method: "POST", body: JSON.stringify({ date: today }) }),
    onSuccess: () => { toast("+10 coins +25 XP 🔥", "success"); qc.invalidateQueries({ queryKey: ["habits"] }); qc.invalidateQueries({ queryKey: ["habits-stats"] }); },
    onError: (e: any) => toast(e.message, "error"),
  });

  const uncompleteHabit = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/habits/${id}/complete?date=${today}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["habits"] }); qc.invalidateQueries({ queryKey: ["habits-stats"] }); },
  });

  const deleteHabit = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/habits/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast("Habit deleted", "success"); qc.invalidateQueries({ queryKey: ["habits"] }); qc.invalidateQueries({ queryKey: ["habits-stats"] }); },
  });

  const completedCount = (habits as any[]).filter((h: any) => h.completedToday).length;
  const totalCount = (habits as any[]).length;
  const completionPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="min-h-screen forge-bg-glow text-[var(--foreground)] px-4 sm:px-6 py-8 max-w-2xl mx-auto">
      {showCreate && <CreateHabitModal onClose={() => setShowCreate(false)} onCreate={d => createHabit.mutate(d)} />}

      <PageHeader
        icon={<Flame size={18} className="text-[var(--palette-f97316)]" />}
        badgeColor="var(--palette-f97316)"
        title="Habit Tracker"
        subtitle="Build consistency, one day at a time"
        actions={
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 rounded-xl bg-[var(--brand-600)] px-4 py-2 text-[12px] font-bold text-[var(--palette-white)] hover:bg-[var(--palette-6d31d4)] transition-colors shadow-lg shadow-[var(--rgba-124-58-237-0_25)]">
            <Plus size={14} /> New Habit
          </button>
        }
      />

      {/* Daily progress ring */}
      {totalCount > 0 && (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] p-5 mb-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--foreground-subtle)]">Today's Progress</p>
              <p className="mt-1 text-3xl font-semibold" style={{ color: completionPct === 100 ? "var(--palette-4ade80)" : "var(--brand-600)" }}>
                {completedCount}<span className="text-lg text-[var(--foreground-subtle)] font-normal">/{totalCount}</span>
              </p>
              <p className="text-sm text-[var(--foreground-subtle)]">{completionPct === 100 ? "🎉 All done for today!" : `${totalCount - completedCount} remaining`}</p>
            </div>
            <div className="relative">
              <svg width={80} height={80} className="-rotate-90">
                <circle cx={40} cy={40} r={32} fill="none" stroke="var(--rgba-124-58-237-0_1)" strokeWidth={6} />
                <circle
                  cx={40} cy={40} r={32}
                  fill="none"
                  stroke={completionPct === 100 ? "var(--palette-4ade80)" : "var(--brand-600)"}
                  strokeWidth={6}
                  strokeLinecap="round"
                  strokeDasharray={`${(completionPct / 100) * 201} 201`}
                  style={{ transition: "stroke-dasharray 0.6s ease" }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-base font-bold text-[var(--foreground)]">{completionPct}%</span>
              </div>
            </div>
          </div>

          {stats && (
            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-[var(--border-subtle)]">
              <div className="text-center">
                <p className="text-lg font-bold text-[var(--palette-amber-400)]">{stats.longestStreak}</p>
                <p className="text-[11px] text-[var(--foreground-subtle)] uppercase tracking-wider">Best Streak</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-[var(--brand-400)]">{stats.avgStreak}</p>
                <p className="text-[11px] text-[var(--foreground-subtle)] uppercase tracking-wider">Avg Streak</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-[var(--palette-emerald-400)]">{stats.total}</p>
                <p className="text-[11px] text-[var(--foreground-subtle)] uppercase tracking-wider">Active Habits</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Habits list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 animate-pulse rounded-2xl bg-[var(--surface-hover)]" />)}
        </div>
      ) : (habits as any[]).length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">🌱</p>
          <p className="text-lg font-semibold text-[var(--foreground)] mb-2">No habits yet</p>
          <p className="text-sm text-[var(--foreground-subtle)] mb-6">Start building your first habit and track your consistency</p>
          <button onClick={() => setShowCreate(true)} className="rounded-xl bg-[var(--brand-600)] px-6 py-2.5 text-sm font-semibold text-[var(--palette-white)] hover:bg-[var(--palette-6d31d4)]">
            Create your first habit
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Incomplete first */}
          {(habits as any[]).filter((h: any) => !h.completedToday).map((h: any) => (
            <HabitCard
              key={h.id} habit={h}
              onComplete={() => completeHabit.mutate(h.id)}
              onUncomplete={() => uncompleteHabit.mutate(h.id)}
              onDelete={() => { if (confirm(`Delete "${h.name}"?`)) deleteHabit.mutate(h.id); }}
            />
          ))}
          {/* Completed */}
          {(habits as any[]).filter((h: any) => h.completedToday).length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--foreground-subtle)] mb-2 mt-4">Completed today ✓</p>
              {(habits as any[]).filter((h: any) => h.completedToday).map((h: any) => (
                <HabitCard
                  key={h.id} habit={h}
                  onComplete={() => completeHabit.mutate(h.id)}
                  onUncomplete={() => uncompleteHabit.mutate(h.id)}
                  onDelete={() => { if (confirm(`Delete "${h.name}"?`)) deleteHabit.mutate(h.id); }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
