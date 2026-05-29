import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { aiRoadmapSchema } from "@/lib/validators";
import { getToken } from "@/lib/auth";

type RoadmapDay = {
  day: number;
  focusSessions: string[];
  tasks: string[];
  estimatedTime: number;
};

export default function RoadmapPage() {
  const { status: authStatus } = useAuth();
  const [goal, setGoal] = useState("Ship a production-ready SaaS MVP");
  const [dailyHours, setDailyHours] = useState(2);
  const [level, setLevel] = useState<"beginner" | "intermediate" | "advanced">("intermediate");
  const [deadline, setDeadline] = useState("");
  const [currentProgress, setCurrentProgress] = useState("Timer engine + auth baseline in place");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapDay[] | null>(null);
  const [openDay, setOpenDay] = useState<number | null>(1);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const validPayload = useMemo(() => ({ goal, dailyHours, level, deadline: deadline || undefined, currentProgress: currentProgress || undefined }), [goal, dailyHours, level, deadline, currentProgress]);

  async function generate() {
    setError(null);
    const parsed = aiRoadmapSchema.safeParse(validPayload);
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => `${i.path.join(".") || "form"}: ${i.message}`).join(" · ") || "Please check your inputs.");
      return;
    }
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch("/api/ai/roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(parsed.data),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; roadmap?: RoadmapDay[] };
      if (!res.ok) {
        setError(res.status === 401 ? "Not signed in yet. Wait a few seconds and try again." : (typeof data.error === "string" ? data.error : `Could not generate roadmap (${res.status}).`));
        setRoadmap(null);
        return;
      }
      const days = Array.isArray(data.roadmap) ? data.roadmap : [];
      if (days.length === 0) { setError("The server returned an empty roadmap. Please try again."); setRoadmap(null); return; }
      setRoadmap(days);
      setOpenDay(1);
      setChecked(new Set());
    } catch { setError("Network error — is the dev server running?"); }
    finally { setLoading(false); }
  }

  return (
    <div className="relative min-h-[100dvh] overflow-hidden forge-bg-glow">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -left-24 top-0 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.15),transparent_70%)] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_center,rgba(6,214,160,0.08),transparent_70%)] blur-3xl" />
      </div>
      <main className="relative z-10 mx-auto max-w-6xl px-4 py-10 sm:py-12">
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#4B5563]">Plan your success</p>
          <h1 className="mt-1 text-2xl font-bold text-[#E2E8F0] sm:text-3xl">AI Study Roadmap</h1>
        </div>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,380px)_1fr]">
          <motion.aside layout className="h-fit rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6 shadow-2xl backdrop-blur-2xl">
            <h2 className="text-sm font-semibold text-zinc-200">Plan inputs</h2>
            <p className="mt-1 text-xs text-zinc-500">We will shape Pomodoro-sized blocks to match your day.</p>
            {authStatus === "loading" && (
              <p className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
                <span className="h-3 w-3 animate-spin rounded-full border border-zinc-700 border-t-zinc-400" />
                Connecting…
              </p>
            )}
            <label className="mt-5 block text-xs font-medium text-zinc-400">Goal
              <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={3} className="mt-1.5 w-full resize-none rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-sky-500/40" />
            </label>
            <label className="mt-4 block text-xs font-medium text-zinc-400">Daily hours
              <input type="number" min={0.5} max={12} step={0.25} value={dailyHours} onChange={(e) => setDailyHours(Number(e.target.value))} className="mt-1.5 w-full rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-sky-500/40" />
            </label>
            <label className="mt-4 block text-xs font-medium text-zinc-400">Level
              <select value={level} onChange={(e) => setLevel(e.target.value as typeof level)} className="mt-1.5 w-full rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-sky-500/40">
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>
            <label className="mt-4 block text-xs font-medium text-zinc-400">Deadline (optional)
              <input value={deadline} onChange={(e) => setDeadline(e.target.value)} placeholder="e.g. June 30" className="mt-1.5 w-full rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-sky-500/40" />
            </label>
            <label className="mt-4 block text-xs font-medium text-zinc-400">Current progress
              <textarea value={currentProgress} onChange={(e) => setCurrentProgress(e.target.value)} rows={2} className="mt-1.5 w-full resize-none rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-sky-500/40" />
            </label>
            <motion.button type="button" disabled={loading} onClick={() => void generate()} whileHover={{ scale: loading ? 1 : 1.02 }} whileTap={{ scale: loading ? 1 : 0.98 }} className="mt-6 flex w-full items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? "AI is planning your success…" : "Generate roadmap"}
            </motion.button>
            {error && <p className="mt-3 text-xs text-rose-400" role="alert">{error}</p>}
          </motion.aside>
          <section className="space-y-4">
            <AnimatePresence mode="wait">
              {loading && (
                <motion.div key="loading" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="rounded-2xl border border-dashed border-zinc-700/70 bg-zinc-950/30 px-6 py-10 text-center text-sm text-zinc-400 backdrop-blur-xl">
                  <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-zinc-600 border-t-indigo-400" />
                  AI is planning your success…
                </motion.div>
              )}
            </AnimatePresence>
            {!loading && roadmap !== null && roadmap.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                {roadmap.map((day) => {
                  const open = openDay === day.day;
                  return (
                    <motion.article key={day.day} layout className="overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card)] shadow-xl backdrop-blur-2xl">
                      <button type="button" onClick={() => setOpenDay(open ? null : day.day)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-white/5">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Day plan</p>
                          <h3 className="text-lg font-semibold text-zinc-50">
                            Day {day.day}
                            {day.focusSessions[0] && (
                              <span className="ml-2 text-sm font-normal text-zinc-500">
                                — {day.focusSessions[0].split("—")[0]?.trim()}
                              </span>
                            )}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-indigo-950/60 border border-indigo-800/40 px-2 py-0.5 text-[10px] text-indigo-400">
                            {day.focusSessions.length} sessions
                          </span>
                          <span className="text-xs text-zinc-500">~{day.estimatedTime} min</span>
                          <span className="text-xs text-zinc-500">{open ? "Hide" : "Expand"}</span>
                        </div>
                      </button>
                      <AnimatePresence initial={false}>
                        {open && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: "easeInOut" }} className="border-t border-zinc-800/60">
                            <div className="space-y-4 px-5 py-4 text-sm text-zinc-300">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Focus sessions</p>
                                <ul className="mt-2 list-disc space-y-1 pl-4">{day.focusSessions.map((s) => <li key={s}>{s}</li>)}</ul>
                              </div>
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Tasks</p>
                                <ul className="mt-2 space-y-1.5">
                                  {day.tasks.map((t) => {
                                    const key = `${day.day}-${t}`;
                                    const done = checked.has(key);
                                    return (
                                      <li
                                        key={t}
                                        className="flex items-center gap-2 cursor-pointer"
                                        onClick={() => {
                                          setChecked(prev => {
                                            const next = new Set(prev);
                                            done ? next.delete(key) : next.add(key);
                                            return next;
                                          });
                                        }}
                                      >
                                        <span className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors ${done ? "bg-emerald-500 border-emerald-500" : "border-zinc-700"}`}>
                                          {done && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                        </span>
                                        <span className={`text-sm ${done ? "line-through text-zinc-600" : "text-zinc-300"}`}>{t}</span>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.article>
                  );
                })}
              </motion.div>
            )}
            {!loading && (roadmap === null || roadmap.length === 0) && (
              <div className="rounded-2xl border border-zinc-800/60 bg-zinc-950/30 px-6 py-12 text-center text-sm text-zinc-500 backdrop-blur-xl">
                Generate a roadmap to see your week unfold here.
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
