import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { aiRoadmapSchema } from "@/lib/validators";
import { getToken } from "@/lib/auth";
import { trackSiteEvent } from "@/lib/site-analytics";
import { BookmarkPlus, Trash2, Map, Sparkles, Target, Clock, ArrowRight } from "lucide-react";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";
import { BLUR_IN, STAGGER } from "@/lib/animations";

type RoadmapDay = {
  day: number;
  focusSessions: string[];
  tasks: string[];
  estimatedTime: number;
  milestone?: string;
  progressCheck?: string;
  resources?: Array<{ title: string; url: string; type: string }>;
};

type SavedRoadmap = {
  id: string;
  subject: string;
  createdAt: string;
};

export default function RoadmapPage() {
  const { status: authStatus } = useAuth();
  const { toast } = useToast();
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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedRoadmaps, setSavedRoadmaps] = useState<SavedRoadmap[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const validPayload = useMemo(() => ({ goal, dailyHours, level, deadline: deadline || undefined, currentProgress: currentProgress || undefined }), [goal, dailyHours, level, deadline, currentProgress]);

  const authHeaders = () => {
    const token = getToken();
    return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  };

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    void fetchSavedList();
  }, [authStatus]);

  async function fetchSavedList() {
    setLoadingList(true);
    try {
      const r = await fetch("/api/roadmap/list", { headers: authHeaders() });
      if (r.ok) {
        const d = await r.json() as { roadmaps: SavedRoadmap[] };
        setSavedRoadmaps(d.roadmaps ?? []);
      }
    } catch { /* ignore */ }
    setLoadingList(false);
  }

  async function generate() {
    setError(null);
    const parsed = aiRoadmapSchema.safeParse(validPayload);
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => `${i.path.join(".") || "form"}: ${i.message}`).join(" · ") || "Please check your inputs.");
      return;
    }
    setLoading(true);
    setSaved(false);
    try {
      const res = await fetch("/api/ai/roadmap", {
        method: "POST",
        headers: authHeaders(),
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
      trackSiteEvent("roadmap_generated", { days: days.length });
    } catch { setError("Network error — is the dev server running?"); }
    finally { setLoading(false); }
  }

  async function saveRoadmap() {
    if (!roadmap || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/roadmap/save", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ subject: goal, data: roadmap }),
      });
      if (res.ok) {
        setSaved(true);
        toast("Roadmap saved.", "success");
        await fetchSavedList();
      } else {
        toast("Couldn't save the roadmap. Try again.", "error");
      }
    } catch { toast("Network error — roadmap not saved.", "error"); }
    setSaving(false);
  }

  async function loadRoadmap(id: string) {
    try {
      const res = await fetch(`/api/roadmap/${id}`, { headers: authHeaders() });
      if (res.ok) {
        const d = await res.json() as { roadmap: { subject: string; data: RoadmapDay[] } };
        setRoadmap(Array.isArray(d.roadmap.data) ? d.roadmap.data : []);
        setGoal(d.roadmap.subject);
        setOpenDay(1);
        setChecked(new Set());
        setSaved(true);
      } else {
        toast("Couldn't open that roadmap.", "error");
      }
    } catch { toast("Network error — couldn't open the roadmap.", "error"); }
  }

  async function deleteRoadmap(id: string) {
    try {
      const res = await fetch(`/api/roadmap/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) { toast("Couldn't delete the roadmap.", "error"); return; }
      setSavedRoadmaps(prev => prev.filter(r => r.id !== id));
    } catch { toast("Network error — roadmap not deleted.", "error"); }
  }

  return (
    <div className="relative min-h-[100dvh] overflow-hidden forge-bg-glow">
      <PageSEO {...PAGE_SEO.roadmap} />
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -left-24 top-0 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle_at_center,var(--rgba-124-58-237-0_15),transparent_70%)] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_center,var(--rgba-6-214-160-0_08),transparent_70%)] blur-3xl" />
      </div>
      <main className="relative z-[var(--z-content)] mx-auto max-w-7xl px-6 py-12 md:py-20">
        <header className="mb-16 text-center max-w-2xl mx-auto">
          <motion.div variants={BLUR_IN} initial="initial" animate="animate">
             <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-600)]/10 mb-6">
                <Map className="text-[var(--brand-400)]" />
             </div>
             <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--foreground-subtle)] mb-4">Strategic Planning</p>
             <h1 className="text-4xl font-semibold text-[var(--palette-white)] sm:text-6xl tracking-tight leading-none mb-6">AI Study <span className="text-[var(--brand-400)]">Roadmap</span></h1>
             <p className="text-[var(--foreground-muted)] leading-relaxed">Turn your goals into daily actionable deep-work protocols using our advanced generation engine.</p>
          </motion.div>
        </header>

        <div className="grid gap-12 lg:grid-cols-[400px_1fr]">
          <motion.aside variants={STAGGER} initial="initial" animate="animate" className="h-fit rounded-[32px] border border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.01] p-8 backdrop-blur-2xl shadow-2xl">
            <div className="space-y-6">
               <h2 className="text-lg font-semibold text-[var(--palette-white)] flex items-center gap-2 mb-8">
                  <Sparkles size={18} className="text-[var(--brand-400)]" /> Configuration
               </h2>

               <div>
                 <label htmlFor="your-goal-164" className="block text-[11px] font-semibold uppercase tracking-widest text-[var(--foreground-subtle)] mb-3">Your Goal</label>
                 <textarea id="your-goal-164" value={goal} onChange={(e) => setGoal(e.target.value)} rows={3} className="w-full rounded-2xl bg-[var(--palette-white)]/[0.02] border border-[var(--palette-white)]/5 p-4 text-sm text-[var(--palette-white)] focus:border-[var(--brand-400)] outline-none transition-all resize-none" placeholder="e.g. Master React in 30 days" />
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="daily-hours-170" className="block text-[11px] font-semibold uppercase tracking-widest text-[var(--foreground-subtle)] mb-3">Daily Hours</label>
                    <input id="daily-hours-170" type="number" min={0.5} max={12} step={0.25} value={dailyHours} onChange={(e) => setDailyHours(Number(e.target.value))} className="w-full rounded-2xl bg-[var(--palette-white)]/[0.02] border border-[var(--palette-white)]/5 p-4 text-sm text-[var(--palette-white)] focus:border-[var(--brand-400)] outline-none transition-all" />
                  </div>
                  <div>
                    <label htmlFor="level-174" className="block text-[11px] font-semibold uppercase tracking-widest text-[var(--foreground-subtle)] mb-3">Level</label>
                    <select id="level-174" value={level} onChange={(e) => setLevel(e.target.value as typeof level)} className="w-full rounded-2xl bg-[var(--palette-white)]/[0.02] border border-[var(--palette-white)]/5 p-4 text-sm text-[var(--palette-white)] focus:border-[var(--brand-400)] outline-none transition-all">
                       <option value="beginner">Beginner</option>
                       <option value="intermediate">Intermediate</option>
                       <option value="advanced">Advanced</option>
                    </select>
                  </div>
               </div>

               <div>
                 <label htmlFor="roadmap-deadline" className="block text-[11px] font-semibold uppercase tracking-widest text-[var(--foreground-subtle)] mb-3">Deadline <span className="normal-case tracking-normal opacity-60">(optional)</span></label>
                 <input id="roadmap-deadline" type="date" value={deadline} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDeadline(e.target.value)} className="w-full rounded-2xl bg-[var(--palette-white)]/[0.02] border border-[var(--palette-white)]/5 p-4 text-sm text-[var(--palette-white)] focus:border-[var(--brand-400)] outline-none transition-all" />
               </div>

               <div>
                 <label htmlFor="current-progress-184" className="block text-[11px] font-semibold uppercase tracking-widest text-[var(--foreground-subtle)] mb-3">Current Progress</label>
                 <textarea id="current-progress-184" value={currentProgress} onChange={(e) => setCurrentProgress(e.target.value)} rows={2} className="w-full rounded-2xl bg-[var(--palette-white)]/[0.02] border border-[var(--palette-white)]/5 p-4 text-sm text-[var(--palette-white)] focus:border-[var(--brand-400)] outline-none transition-all resize-none" />
               </div>

               <button disabled={loading} onClick={() => void generate()} className="w-full h-14 rounded-2xl bg-[var(--palette-white)] text-[var(--palette-black)] font-semibold text-lg hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                 {loading ? "Generating..." : <>Generate <ArrowRight size={18} /></>}
               </button>
               {error && <p className="text-[11px] text-[var(--palette-red-400)] font-bold uppercase text-center">{error}</p>}

               {authStatus === "authenticated" && loadingList && savedRoadmaps.length === 0 && (
                 <p className="text-[11px] uppercase tracking-widest text-[var(--foreground-subtle)]">Loading saved protocols…</p>
               )}
               {authStatus === "authenticated" && savedRoadmaps.length > 0 && (
                 <div className="pt-8 mt-8 border-t border-[var(--palette-white)]/5">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--foreground-subtle)] mb-4">Saved Protocols</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 scrollbar-none">
                       {savedRoadmaps.map((r) => (
                         /*
                           Was a clickable div wrapping another button: the row
                           could not be reached by keyboard at all, and the
                           delete control only appeared on hover, so keyboard
                           users could never delete a saved protocol. Now two
                           sibling buttons — the row is real, focusable, and
                           the delete button reveals itself on focus too.
                         */
                         <div key={r.id} className="group flex items-center gap-1 rounded-xl transition-all hover:bg-[var(--palette-white)]/5">
                            <button
                              type="button"
                              onClick={() => void loadRoadmap(r.id)}
                              className="flex min-w-0 flex-1 items-center gap-2 rounded-xl p-3 text-left"
                            >
                               <span className="flex-1 min-w-0">
                                  <span className="block text-xs font-bold text-[var(--palette-white)] truncate">{r.subject}</span>
                                  <span className="block text-[11px] text-[var(--palette-zinc-500)] font-bold uppercase mt-1">{new Date(r.createdAt).toLocaleDateString()}</span>
                               </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteRoadmap(r.id)}
                              aria-label={`Delete saved protocol: ${r.subject}`}
                              className="shrink-0 rounded-lg p-1 text-[var(--palette-zinc-500)] opacity-0 transition-all hover:text-[var(--palette-red-400)] group-hover:opacity-100 focus-visible:opacity-100"
                            >
                               <Trash2 size={12} />
                            </button>
                         </div>
                       ))}
                    </div>
                 </div>
               )}
            </div>
          </motion.aside>

          <section className="space-y-6">
            <AnimatePresence mode="wait">
              {loading && (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-32 text-center">
                   <div className="h-16 w-16 rounded-full border-2 border-[var(--palette-white)]/5 border-t-[var(--brand-400)] animate-spin mb-8" />
                   <h3 className="text-2xl font-semibold text-[var(--palette-white)] mb-2">Assembling Protocol</h3>
                   <p className="text-[var(--foreground-subtle)] uppercase tracking-widest text-[11px] font-bold">Synchronizing with high-performance datasets</p>
                </motion.div>
              )}

              {!loading && roadmap && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                   <div className="flex items-center justify-between mb-8">
                      <div className="text-left">
                         <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--foreground-subtle)] mb-1">Active Roadmap</p>
                         <h2 className="text-2xl font-semibold text-[var(--palette-white)]">{goal}</h2>
                      </div>
                      {authStatus === "authenticated" && !saved && (
                        <button onClick={() => void saveRoadmap()} className="flex items-center gap-2 rounded-xl border border-[var(--brand-400)]/30 bg-[var(--brand-400)]/10 px-4 py-2 text-xs font-semibold text-[var(--brand-400)] hover:bg-[var(--brand-400)]/20 transition-all">
                           <BookmarkPlus size={14} /> Save Protocol
                        </button>
                      )}
                   </div>

                   <div className="grid gap-4">
                      {roadmap.map((day) => (
                        <motion.div key={day.day} className="rounded-3xl border border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.01] overflow-hidden">
                           <button type="button" onClick={() => setOpenDay(openDay === day.day ? null : day.day)} aria-expanded={openDay === day.day} className="w-full p-6 flex items-center justify-between border-b border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.01] text-left">
                              <div className="flex items-center gap-4">
                                 <div className="h-10 w-10 rounded-xl bg-[var(--palette-white)]/5 flex items-center justify-center text-xs font-semibold">D{day.day}</div>
                                 <div>
                                   <h3 className="font-semibold text-lg text-[var(--palette-white)]">Day {day.day}</h3>
                                   <p className="text-[11px] text-[var(--foreground-subtle)] tabular-nums">{day.tasks.filter((_, i) => checked.has(`${day.day}:${i}`)).length}/{day.tasks.length} tasks done</p>
                                 </div>
                              </div>
                              <div className="flex items-center gap-6">
                                 <div className="flex items-center gap-2">
                                    <Target size={14} className="text-[var(--brand-400)]" />
                                    <span className="text-xs font-bold text-[var(--palette-zinc-400)]">{day.focusSessions.length} Blocks</span>
                                 </div>
                                 <div className="flex items-center gap-2">
                                    <Clock size={14} className="text-[var(--brand-400)]" />
                                    <span className="text-xs font-bold text-[var(--palette-zinc-400)]">{day.estimatedTime}m</span>
                                 </div>
                              </div>
                           </button>
                           {openDay === day.day && <>
                           <div className="p-8 grid gap-8 md:grid-cols-2">
                              <div>
                                 <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--foreground-subtle)] mb-4">Focus Protocol</p>
                                 <ul className="space-y-3">
                                    {day.focusSessions.map((s, i) => (
                                      <li key={i} className="flex gap-3 text-sm text-[var(--palette-zinc-200)]">
                                         <span className="text-[var(--brand-400)] font-semibold">{i+1}.</span> {s}
                                      </li>
                                    ))}
                                 </ul>
                              </div>
                              <div>
                                 <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--foreground-subtle)] mb-4">Tactical Tasks</p>
                                 <ul className="space-y-3">
                                    {day.tasks.map((t, i) => {
                                      const key = `${day.day}:${i}`;
                                      const done = checked.has(key);
                                      return (
                                        <li key={i}>
                                          <label className={`flex cursor-pointer items-center gap-3 p-3 rounded-xl border text-xs font-bold transition-colors ${done ? "border-[var(--brand-500)]/40 bg-[var(--brand-soft)] text-[var(--foreground-subtle)] line-through" : "bg-[var(--palette-white)]/[0.02] border-[var(--palette-white)]/5 text-[var(--palette-zinc-400)]"}`}>
                                            <input type="checkbox" className="accent-[var(--brand-500)]" checked={done} onChange={() => setChecked((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; })} />
                                            {t}
                                          </label>
                                        </li>
                                      );
                                    })}
                                 </ul>
                              </div>
                           </div>
                           {(day.milestone || day.progressCheck || day.resources?.length) && <div className="border-t border-[var(--brand-500)]/20 bg-[var(--brand-soft)] p-6">
                             <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--brand-400)]">Premium depth</p>
                             {day.milestone && <p className="mt-2 text-sm"><strong>Milestone:</strong> {day.milestone}</p>}
                             {day.progressCheck && <p className="mt-1 text-sm"><strong>Progress check:</strong> {day.progressCheck}</p>}
                             {!!day.resources?.length && <div className="mt-3 flex flex-wrap gap-2">{day.resources.map((resource) => <a key={resource.url} href={resource.url} target="_blank" rel="noreferrer" className="rounded-lg border border-[var(--brand-500)]/30 px-3 py-2 text-xs text-[var(--brand-400)]">{resource.title} ↗</a>)}</div>}
                           </div>}
                           </>}
                        </motion.div>
                      ))}
                   </div>
                </motion.div>
              )}

              {!loading && !roadmap && (
                <div className="flex flex-col items-center justify-center py-32 text-center opacity-30">
                   <Map size={48} className="mb-6" />
                   <p className="text-sm font-semibold uppercase tracking-[0.2em]">Ready for Strategic Mapping</p>
                </div>
              )}
            </AnimatePresence>
          </section>
        </div>
      </main>
    </div>
  );
}
