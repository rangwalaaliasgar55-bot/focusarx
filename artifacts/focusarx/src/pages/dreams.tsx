import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { getToken } from "@/lib/auth";
import { Target, ChevronRight, Flame, TrendingUp, Calendar, CheckCircle, Edit2, ArrowRight } from "lucide-react";

const DREAM_TYPES = [
  { id: "iit",      label: "IIT / JEE",           emoji: "⚙️", color: "#F59E0B", desc: "Crack India's toughest engineering exam", target: 360 },
  { id: "neet",     label: "NEET / AIIMS",         emoji: "🩺", color: "#10B981", desc: "Become a doctor and heal the world",       target: 360 },
  { id: "upsc",     label: "UPSC / Civil Services",emoji: "🏛️", color: "#3B82F6", desc: "Serve the nation as a civil servant",      target: 300 },
  { id: "cat",      label: "CAT / MBA",             emoji: "💼", color: "#8B5CF6", desc: "Lead organizations, build your future",    target: 240 },
  { id: "startup",  label: "Launch a Startup",      emoji: "🚀", color: "#EC4899", desc: "Build something people love",              target: 240 },
  { id: "coding",   label: "Crack Coding Interviews",emoji: "💻",color: "#06B6D4", desc: "Land your dream tech job",                 target: 240 },
  { id: "research", label: "Research / PhD",        emoji: "🔬", color: "#6366F1", desc: "Push boundaries of knowledge",            target: 300 },
  { id: "language", label: "Learn a Language",      emoji: "🌍", color: "#F97316", desc: "Connect with the world",                  target: 120 },
  { id: "creative", label: "Creative Mastery",      emoji: "🎨", color: "#A78BFA", desc: "Master your art form",                    target: 180 },
  { id: "fitness",  label: "Get Fit & Healthy",     emoji: "💪", color: "#22D3EE", desc: "Build the body you deserve",              target: 90  },
  { id: "promotion",label: "Career Promotion",      emoji: "📈", color: "#34D399", desc: "Rise to the top of your field",           target: 180 },
  { id: "custom",   label: "My Own Dream",          emoji: "✨", color: "#7C3AED", desc: "Define your own path",                    target: 180 },
];

function authHeaders() {
  const t = getToken();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (t) h["Authorization"] = `Bearer ${t}`;
  return h;
}

function getMotivation(progressPct: number, dreamLabel: string): string {
  if (progressPct >= 100) return `You're on fire! Your commitment to ${dreamLabel} is extraordinary. 🔥`;
  if (progressPct >= 80) return `Outstanding effort! You're ahead of schedule for ${dreamLabel}. Keep going!`;
  if (progressPct >= 60) return `Great consistency! You're building real momentum toward ${dreamLabel}.`;
  if (progressPct >= 40) return `Solid progress! Every session brings you closer to ${dreamLabel}.`;
  if (progressPct >= 20) return `You've started the journey. The path to ${dreamLabel} is one session at a time.`;
  return `Every expert begins here. Your dream of ${dreamLabel} is worth fighting for.`;
}

function formatHours(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatDays(days: number | null) {
  if (days === null) return "Open";
  if (days === 0) return "Today!";
  if (days === 1) return "Tomorrow";
  if (days < 30) return `${days} days`;
  return `${Math.round(days / 30)} months`;
}

export default function DreamsPage() {
  const [dream, setDream] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [customGoal, setCustomGoal] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/dreams", { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { setDream(d.dream); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function saveDream() {
    if (!selected) return;
    setSaving(true);
    const type = DREAM_TYPES.find(d => d.id === selected)!;
    try {
      const r = await fetch("/api/dreams", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          dreamType: selected,
          customGoal: selected === "custom" ? customGoal : null,
          targetDate: targetDate || null,
          dailyTargetMinutes: type.target,
          emoji: type.emoji,
        }),
      });
      const data = await r.json();
      // Refetch with progress data
      const r2 = await fetch("/api/dreams", { headers: authHeaders() });
      const data2 = await r2.json();
      setDream(data2.dream);
      setSelecting(false);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#7C3AED] border-t-transparent" />
    </div>
  );

  const type = dream ? DREAM_TYPES.find(d => d.id === dream.dreamType) : null;

  if (!dream || selecting) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-4xl px-4 py-8">
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(124,58,237,0.3)] bg-[rgba(124,58,237,0.1)] px-4 py-1.5 mb-4">
              <Target size={14} className="text-[#A78BFA]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[#A78BFA]">Dreams System</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">What is your dream?</h1>
            <p className="text-[#94A3B8] text-sm max-w-md mx-auto">Every study session moves you closer. Choose your path and FocusArx will track your journey.</p>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
            {DREAM_TYPES.map((dt, i) => (
              <motion.button
                key={dt.id}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                onClick={() => setSelected(dt.id)}
                className={`relative rounded-2xl border p-4 text-left transition-all duration-200 ${
                  selected === dt.id
                    ? "border-[rgba(124,58,237,0.6)] bg-[rgba(124,58,237,0.15)] shadow-[0_0_20px_rgba(124,58,237,0.25)]"
                    : "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] hover:border-[rgba(124,58,237,0.3)] hover:bg-[rgba(124,58,237,0.07)]"
                }`}
              >
                {selected === dt.id && (
                  <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#7C3AED]">
                    <CheckCircle size={12} className="text-white" />
                  </span>
                )}
                <div className="text-2xl mb-2">{dt.emoji}</div>
                <div className="text-sm font-semibold text-white leading-tight mb-1">{dt.label}</div>
                <div className="text-[10px] text-[#64748B] leading-relaxed">{dt.desc}</div>
                <div className="mt-2 text-[10px] text-[#4B5563]">~{dt.target}m/day</div>
              </motion.button>
            ))}
          </div>

          {selected && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-[rgba(124,58,237,0.2)] bg-[rgba(124,58,237,0.06)] p-5 mb-6 space-y-4">
              {selected === "custom" && (
                <div>
                  <label className="text-xs font-medium text-[#94A3B8] uppercase tracking-wider mb-2 block">Your Goal</label>
                  <input
                    className="w-full rounded-xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] px-3 py-2 text-sm text-white placeholder:text-[#4B5563] focus:outline-none focus:border-[#7C3AED]"
                    placeholder="e.g. Become a product designer at a top startup"
                    value={customGoal}
                    onChange={e => setCustomGoal(e.target.value)}
                  />
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-[#94A3B8] uppercase tracking-wider mb-2 block">Target Date <span className="text-[#4B5563] font-normal">(optional)</span></label>
                <input
                  type="date"
                  className="rounded-xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7C3AED]"
                  value={targetDate}
                  onChange={e => setTargetDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                />
              </div>
            </motion.div>
          )}

          {selected && (
            <div className="flex justify-center">
              <motion.button
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                onClick={saveDream}
                disabled={saving || (selected === "custom" && !customGoal.trim())}
                className="flex items-center gap-2 rounded-xl bg-[#7C3AED] px-6 py-3 text-sm font-semibold text-white hover:bg-[#6D28D9] disabled:opacity-50 transition-colors"
              >
                {saving ? "Setting dream..." : "Set My Dream"}
                <ArrowRight size={15} />
              </motion.button>
            </div>
          )}
        </div>
      </PageTransition>
    );
  }

  const progressPct = dream.progressPct ?? 0;
  const label = type ? (dream.dreamType === "custom" ? dream.customGoal || "Custom Dream" : type.label) : "Your Dream";
  const color = type?.color ?? "#7C3AED";
  const emoji = type?.emoji ?? dream.emoji ?? "🎯";

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(124,58,237,0.3)] bg-[rgba(124,58,237,0.1)] px-4 py-1.5 mb-3">
                <Target size={14} className="text-[#A78BFA]" />
                <span className="text-xs font-semibold uppercase tracking-wider text-[#A78BFA]">Your Dream</span>
              </div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <span className="text-4xl">{emoji}</span>
                {label}
              </h1>
              {type && <p className="text-[#64748B] text-sm mt-1">{type.desc}</p>}
            </div>
            <button onClick={() => setSelecting(true)} className="flex items-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.08)] px-3 py-1.5 text-xs text-[#64748B] hover:text-[#94A3B8] hover:border-[rgba(255,255,255,0.15)] transition-all">
              <Edit2 size={12} /> Change
            </button>
          </div>
        </motion.div>

        {/* Progress Hero */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-6 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[#94A3B8]">Progress toward your goal</span>
            <span className="text-lg font-bold" style={{ color }}>{progressPct}%</span>
          </div>
          <div className="h-3 w-full rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden mb-1">
            <motion.div
              initial={{ width: 0 }} animate={{ width: `${Math.min(100, progressPct)}%` }} transition={{ duration: 1.2, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${color}, ${color}cc)`, boxShadow: `0 0 12px ${color}80` }}
            />
          </div>
          <p className="text-xs text-[#4B5563] mt-2">{getMotivation(progressPct, label)}</p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total Logged", value: formatHours(dream.totalMinutesLogged ?? 0), icon: Flame, color: "#F59E0B" },
            { label: "Days Active",  value: `${dream.daysSinceStart ?? 0}`, icon: Calendar, color: "#10B981" },
            { label: "Daily Target", value: formatHours(dream.dailyTargetMinutes ?? 120), icon: Target, color: "#3B82F6" },
            { label: "Days Left",    value: formatDays(dream.daysLeft ?? null), icon: TrendingUp, color: "#A78BFA" },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.05 }}
              className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-4">
              <stat.icon size={16} style={{ color: stat.color }} className="mb-2" />
              <div className="text-xl font-bold text-white">{stat.value}</div>
              <div className="text-[10px] text-[#64748B] uppercase tracking-wider mt-0.5">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* On-track indicator */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className={`rounded-xl border p-4 flex items-center gap-3 ${
            dream.onTrack
              ? "border-[rgba(34,211,135,0.25)] bg-[rgba(34,211,135,0.06)]"
              : "border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.05)]"
          }`}>
          <div className={`h-2 w-2 rounded-full animate-pulse ${dream.onTrack ? "bg-[#22D387]" : "bg-[#EF4444]"}`} />
          <div>
            <p className="text-sm font-medium text-white">
              {dream.onTrack ? "On Track ✓" : "Behind Schedule"}
            </p>
            <p className="text-xs text-[#64748B]">
              {dream.onTrack
                ? `You've studied ${formatHours(dream.totalMinutesLogged ?? 0)} out of an expected ${formatHours(dream.expectedMinutes ?? 0)} — you're keeping up!`
                : `Expected ${formatHours(dream.expectedMinutes ?? 0)} by now. Keep pushing to close the gap.`
              }
            </p>
          </div>
        </motion.div>

        {/* Motivational quote */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          className="mt-6 text-center">
          <p className="text-sm italic text-[#4B5563]">
            "Your current effort has moved you <span style={{ color }} className="font-semibold">{progressPct.toFixed(1)}%</span> closer to {label}."
          </p>
        </motion.div>
      </div>
    </PageTransition>
  );
}
