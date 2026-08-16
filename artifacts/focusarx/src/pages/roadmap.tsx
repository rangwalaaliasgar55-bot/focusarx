import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { aiRoadmapSchema } from "@/lib/validators";
import { getToken } from "@/lib/auth";
import { trackSiteEvent } from "@/lib/site-analytics";
import { BookmarkPlus, Trash2, Map, Sparkles, Target, Clock, ArrowRight } from "lucide-react";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";
import { BLUR_IN, STAGGER, STAGGER_CHILD } from "@/lib/animations";

type RoadmapDay = {
  day: number;
  focusSessions: string[];
  tasks: string[];
  estimatedTime: number;
};

type SavedRoadmap = {
  id: string;
  subject: string;
  createdAt: string;
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
        await fetchSavedList();
      }
    } catch { /* ignore */ }
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
      }
    } catch { /* ignore */ }
  }

  async function deleteRoadmap(id: string) {
    try {
      await fetch(`/api/roadmap/${id}`, { method: "DELETE", headers: authHeaders() });
      setSavedRoadmaps(prev => prev.filter(r => r.id !== id));
    } catch { /* ignore */ }
  }

  return (
    <div className="relative min-h-[100dvh] overflow-hidden forge-bg-glow">
      <PageSEO {...PAGE_SEO.roadmap} />
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -left-24 top-0 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.15),transparent_70%)] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_center,rgba(6,214,160,0.08),transparent_70%)] blur-3xl" />
      </div>
      <main className="relative z-10 mx-auto max-w-7xl px-6 py-12 md:py-20">
        <header className="mb-16 text-center max-w-2xl mx-auto">
          <motion.div variants={BLUR_IN} initial="initial" animate="animate">
             <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#7C3AED]/10 mb-6">
                <Map className="text-[#A78BFA]" />
             </div>
             <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#4B5563] mb-4">Strategic Planning</p>
             <h1 className="text-4xl font-black text-white sm:text-6xl tracking-tight leading-none mb-6">AI Study <span className="text-[#A78BFA]">Roadmap</span></h1>
             <p className="text-[#94A3B8] leading-relaxed">Turn your goals into daily actionable deep-work protocols using our advanced generation engine.</p>
          </motion.div>
        </header>

        <div className="grid gap-12 lg:grid-cols-[400px_1fr]">
          <motion.aside variants={STAGGER} initial="initial" animate="animate" className="h-fit rounded-[32px] border border-white/5 bg-white/[0.01] p-8 backdrop-blur-2xl shadow-2xl">
            <div className="space-y-6">
               <h2 className="text-lg font-black text-white flex items-center gap-2 mb-8">
                  <Sparkles size={18} className="text-[#A78BFA]" /> Configuration
               </h2>

               <div>
                 <label className="block text-[10px] font-black uppercase tracking-widest text-[#4B5563] mb-3">Your Goal</label>
                 <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={3} className="w-full rounded-2xl bg-white/[0.02] border border-white/5 p-4 text-sm text-white focus:border-[#A78BFA] outline-none transition-all resize-none" placeholder="e.g. Master React in 30 days" />
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-[#4B5563] mb-3">Daily Hours</label>
                    <input type="number" min={0.5} max={12} step={0.25} value={dailyHours} onChange={(e) => setDailyHours(Number(e.target.value))} className="w-full rounded-2xl bg-white/[0.02] border border-white/5 p-4 text-sm text-white focus:border-[#A78BFA] outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-[#4B5563] mb-3">Level</label>
                    <select value={level} onChange={(e) => setLevel(e.target.value as typeof level)} className="w-full rounded-2xl bg-white/[0.02] border border-white/5 p-4 text-sm text-white focus:border-[#A78BFA] outline-none transition-all">
                       <option value="beginner">Beginner</option>
                       <option value="intermediate">Intermediate</option>
                       <option value="advanced">Advanced</option>
                    </select>
                  </div>
               </div>

               <div>
                 <label className="block text-[10px] font-black uppercase tracking-widest text-[#4B5563] mb-3">Current Progress</label>
                 <textarea value={currentProgress} onChange={(e) => setCurrentProgress(e.target.value)} rows={2} className="w-full rounded-2xl bg-white/[0.02] border border-white/5 p-4 text-sm text-white focus:border-[#A78BFA] outline-none transition-all resize-none" />
               </div>

               <button disabled={loading} onClick={() => void generate()} className="w-full h-14 rounded-2xl bg-white text-black font-black text-lg hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                 {loading ? "Generating..." : <>Generate <ArrowRight size={18} /></>}
               </button>
               {error && <p className="text-[10px] text-red-400 font-bold uppercase text-center">{error}</p>}

               {authStatus === "authenticated" && savedRoadmaps.length > 0 && (
                 <div className="pt-8 mt-8 border-t border-white/5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#4B5563] mb-4">Saved Protocols</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 scrollbar-none">
                       {savedRoadmaps.map((r) => (
                         <div key={r.id} className="group flex items-center gap-2 p-3 rounded-xl hover:bg-white/5 transition-all cursor-pointer" onClick={() => void loadRoadmap(r.id)}>
                            <div className="flex-1 min-w-0">
                               <p className="text-xs font-bold text-white truncate">{r.subject}</p>
                               <p className="text-[9px] text-zinc-500 font-bold uppercase mt-1">{new Date(r.createdAt).toLocaleDateString()}</p>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); deleteRoadmap(r.id); }} className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-all p-1">
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
                   <div className="h-16 w-16 rounded-full border-2 border-white/5 border-t-[#A78BFA] animate-spin mb-8" />
                   <h3 className="text-2xl font-black text-white mb-2">Assembling Protocol</h3>
                   <p className="text-[#4B5563] uppercase tracking-widest text-[10px] font-bold">Synchronizing with high-performance datasets</p>
                </motion.div>
              )}

              {!loading && roadmap && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                   <div className="flex items-center justify-between mb-8">
                      <div className="text-left">
                         <p className="text-[10px] font-black uppercase tracking-widest text-[#4B5563] mb-1">Active Roadmap</p>
                         <h2 className="text-2xl font-black text-white">{goal}</h2>
                      </div>
                      {authStatus === "authenticated" && !saved && (
                        <button onClick={() => void saveRoadmap()} className="flex items-center gap-2 rounded-xl border border-[#A78BFA]/30 bg-[#A78BFA]/10 px-4 py-2 text-xs font-black text-[#A78BFA] hover:bg-[#A78BFA]/20 transition-all">
                           <BookmarkPlus size={14} /> Save Protocol
                        </button>
                      )}
                   </div>

                   <div className="grid gap-4">
                      {roadmap.map((day) => (
                        <motion.div key={day.day} className="rounded-3xl border border-white/5 bg-white/[0.01] overflow-hidden">
                           <div className="p-6 flex items-center justify-between border-b border-white/5 bg-white/[0.01]">
                              <div className="flex items-center gap-4">
                                 <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center text-xs font-black">D{day.day}</div>
                                 <h3 className="font-black text-lg text-white">Daily Operations</h3>
                              </div>
                              <div className="flex items-center gap-6">
                                 <div className="flex items-center gap-2">
                                    <Target size={14} className="text-[#A78BFA]" />
                                    <span className="text-xs font-bold text-zinc-400">{day.focusSessions.length} Blocks</span>
                                 </div>
                                 <div className="flex items-center gap-2">
                                    <Clock size={14} className="text-[#A78BFA]" />
                                    <span className="text-xs font-bold text-zinc-400">{day.estimatedTime}m</span>
                                 </div>
                              </div>
                           </div>
                           <div className="p-8 grid gap-8 md:grid-cols-2">
                              <div>
                                 <p className="text-[10px] font-black uppercase tracking-widest text-[#4B5563] mb-4">Focus Protocol</p>
                                 <ul className="space-y-3">
                                    {day.focusSessions.map((s, i) => (
                                      <li key={i} className="flex gap-3 text-sm text-zinc-200">
                                         <span className="text-[#A78BFA] font-black">{i+1}.</span> {s}
                                      </li>
                                    ))}
                                 </ul>
                              </div>
                              <div>
                                 <p className="text-[10px] font-black uppercase tracking-widest text-[#4B5563] mb-4">Tactical Tasks</p>
                                 <ul className="space-y-3">
                                    {day.tasks.map((t, i) => (
                                      <li key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-zinc-400 font-bold">
                                         <div className="h-2 w-2 rounded-full bg-[#A78BFA]" /> {t}
                                      </li>
                                    ))}
                                 </ul>
                              </div>
                           </div>
                        </motion.div>
                      ))}
                   </div>
                </motion.div>
              )}

              {!loading && !roadmap && (
                <div className="flex flex-col items-center justify-center py-32 text-center opacity-30">
                   <Map size={48} className="mb-6" />
                   <p className="text-sm font-black uppercase tracking-[0.2em]">Ready for Strategic Mapping</p>
                </div>
              )}
            </AnimatePresence>
          </section>
        </div>
      </main>
    </div>
  );
}
