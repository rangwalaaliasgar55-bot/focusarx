import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getToken } from "@/lib/auth";

type ReadinessLog = {
  score: number;
  sleep: number;
  stress: number;
  energy: number;
  sessionLengthRec: number;
  date: string;
};

function CircleGauge({ score }: { score: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  const color =
    score >= 80 ? "#4ADE80" :
    score >= 50 ? "#FFB800" :
    "#F97316";

  const message =
    score >= 80 ? "Peak mode — go for 90-min deep work" :
    score >= 50 ? "Solid — 45-min blocks work best today" :
    "Low energy — 25-min Pomodoros + extra breaks";

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex h-[130px] w-[130px] items-center justify-center">
        <svg width="130" height="130" className="absolute -rotate-90">
          <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(124,58,237,0.1)" strokeWidth="10" />
          <motion.circle
            cx="65" cy="65" r={r} fill="none"
            stroke={color} strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - dash }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>
        <div className="relative flex flex-col items-center">
          <motion.span
            className="text-3xl font-bold text-[#E2E8F0]"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
          >
            {score}
          </motion.span>
          <span className="text-[10px] uppercase tracking-widest text-[#4B5563]">Readiness</span>
        </div>
      </div>
      <p className="text-center text-xs text-[#94A3B8]" style={{ color }}>{message}</p>
    </div>
  );
}

function Slider({ label, emoji, value, onChange }: { label: string; emoji: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-[#94A3B8]">{emoji} {label}</span>
        <span className="font-semibold text-[#A78BFA]">{value}/5</span>
      </div>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`h-7 flex-1 rounded-lg border text-xs font-semibold transition-all ${
              n <= value
                ? "border-[#7C3AED] bg-[rgba(124,58,237,0.25)] text-[#A78BFA]"
                : "border-[rgba(124,58,237,0.15)] bg-transparent text-[#4B5563] hover:border-[rgba(124,58,237,0.4)]"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ReadinessWidget() {
  const [log, setLog] = useState<ReadinessLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ sleep: 3, stress: 3, energy: 3, hrv: "" });

  const headers = () => {
    const token = getToken();
    return token ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` } : { "Content-Type": "application/json" };
  };

  useEffect(() => {
    fetch("/api/readiness/today", { headers: headers() })
      .then(r => r.ok ? r.json() : null)
      .then((d: { log?: ReadinessLog | null } | null) => {
        setLog(d?.log ?? null);
        setLoading(false);
        if (!d?.log) setShowForm(true);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await fetch("/api/readiness", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ sleep: form.sleep, stress: form.stress, energy: form.energy, hrv: form.hrv ? parseInt(form.hrv) : undefined }),
      });
      const d = await r.json() as { log?: ReadinessLog };
      if (d.log) { setLog(d.log); setShowForm(false); }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-5 backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[#4B5563]">Daily readiness</p>
          <h3 className="mt-0.5 text-sm font-semibold text-[#E2E8F0]">Brain State Check-in</h3>
        </div>
        {log && (
          <button onClick={() => setShowForm(!showForm)} className="text-[10px] text-[#A78BFA] hover:text-[#7C3AED] transition-colors">
            {showForm ? "Cancel" : "Update"}
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {!showForm && log ? (
          <motion.div key="gauge" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <CircleGauge score={log.score} />
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                { label: "Sleep", value: log.sleep, emoji: "😴" },
                { label: "Stress", value: log.stress, emoji: "🧠" },
                { label: "Energy", value: log.energy, emoji: "⚡" },
              ].map(({ label, value, emoji }) => (
                <div key={label} className="rounded-xl border border-[rgba(124,58,237,0.12)] bg-[rgba(124,58,237,0.04)] py-2">
                  <p className="text-base">{emoji}</p>
                  <p className="text-xs font-bold text-[#E2E8F0]">{value}/5</p>
                  <p className="text-[9px] text-[#4B5563]">{label}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-center text-xs text-[#4B5563]">
              Rec: <span className="text-[#A78BFA] font-semibold">{log.sessionLengthRec}-min sessions</span>
            </p>
          </motion.div>
        ) : showForm ? (
          <motion.div key="form" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <Slider label="Sleep quality" emoji="😴" value={form.sleep} onChange={v => setForm(f => ({ ...f, sleep: v }))} />
            <Slider label="Stress level" emoji="🧠" value={form.stress} onChange={v => setForm(f => ({ ...f, stress: v }))} />
            <Slider label="Energy level" emoji="⚡" value={form.energy} onChange={v => setForm(f => ({ ...f, energy: v }))} />
            <div className="space-y-1.5">
              <p className="text-xs text-[#4B5563]">🫀 HRV (optional, from wearable)</p>
              <input
                type="number"
                placeholder="e.g. 62"
                value={form.hrv}
                onChange={e => setForm(f => ({ ...f, hrv: e.target.value }))}
                className="w-full rounded-xl border border-[rgba(124,58,237,0.2)] bg-[rgba(124,58,237,0.05)] px-3 py-2 text-sm text-[#E2E8F0] placeholder-[#4B5563] focus:border-[#7C3AED] focus:outline-none"
              />
            </div>
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              className="w-full rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Calculate my score"}
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
