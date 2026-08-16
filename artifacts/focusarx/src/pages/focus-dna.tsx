import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { PageTransition } from "@/components/PageTransition";
import { Dna, RefreshCw, Zap, Clock, Calendar, AlertTriangle, Share2 } from "lucide-react";

type FocusDna = {
  id: string;
  archetype: string;
  description: string;
  colorPrimary: string;
  colorSecondary: string;
  icon: string;
  topFocusHour: number | null;
  avgSessionMin: number | null;
  strongestDay: string | null;
  biggestWeakness: string | null;
  sessionCountAtGeneration: number;
  generatedAt: string;
};

function formatHour(h: number | null) {
  if (h == null) return "—";
  if (h === 0) return "12am";
  if (h < 12) return `${h}am`;
  if (h === 12) return "12pm";
  return `${h - 12}pm`;
}

function CardFace({
  dna,
  flipped,
}: {
  dna: FocusDna;
  flipped: boolean;
}) {
  return (
    <motion.div
      className="absolute inset-0 rounded-3xl overflow-hidden"
      style={{ backfaceVisibility: "hidden" }}
      animate={{ rotateY: flipped ? 0 : 180 }}
      transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${dna.colorPrimary}22 0%, ${dna.colorSecondary}11 100%)`,
          border: `1.5px solid ${dna.colorPrimary}44`,
        }}
      />
      {/* Shimmer overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.06),transparent_60%)]" />

      <div className="relative z-10 flex flex-col h-full p-7">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em]" style={{ color: dna.colorSecondary }}>
              Focus DNA
            </p>
            <p className="text-[10px] text-[#4B5563] mt-0.5">
              After {dna.sessionCountAtGeneration} sessions
            </p>
          </div>
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
            style={{ background: `${dna.colorPrimary}22`, border: `1px solid ${dna.colorPrimary}44` }}
          >
            {dna.icon}
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-3xl font-black tracking-tight leading-tight" style={{ color: dna.colorSecondary }}>
            {dna.archetype}
          </h2>
          <p className="mt-2 text-sm text-[#94A3B8] leading-relaxed">{dna.description}</p>
        </div>

        <div className="mt-auto grid grid-cols-2 gap-3">
          <div className="rounded-xl p-3" style={{ background: `${dna.colorPrimary}12`, border: `1px solid ${dna.colorPrimary}22` }}>
            <div className="flex items-center gap-1.5 mb-1">
              <Clock size={11} style={{ color: dna.colorSecondary }} />
              <span className="text-[9px] uppercase tracking-wider text-[#4B5563]">Peak Hour</span>
            </div>
            <p className="text-base font-bold" style={{ color: dna.colorSecondary }}>{formatHour(dna.topFocusHour)}</p>
          </div>
          <div className="rounded-xl p-3" style={{ background: `${dna.colorPrimary}12`, border: `1px solid ${dna.colorPrimary}22` }}>
            <div className="flex items-center gap-1.5 mb-1">
              <Zap size={11} style={{ color: dna.colorSecondary }} />
              <span className="text-[9px] uppercase tracking-wider text-[#4B5563]">Avg Session</span>
            </div>
            <p className="text-base font-bold" style={{ color: dna.colorSecondary }}>{dna.avgSessionMin ?? "—"}m</p>
          </div>
        </div>

        <p className="mt-4 text-[9px] text-[#4B5563] text-center">
          Updated {new Date(dna.generatedAt).toLocaleDateString()}
        </p>
      </div>
    </motion.div>
  );
}

export default function FocusDnaPage() {
  const { status } = useAuth();
  const [dna, setDna] = useState<FocusDna | null>(null);
  const [totalSessions, setTotalSessions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = () => localStorage.getItem("focusarx-auth-token");

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") { setLoading(false); return; }
    fetch("/api/focus-dna", { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => r.json())
      .then((d: { dna: FocusDna | null; totalSessions: number }) => {
        setDna(d.dna);
        setTotalSessions(d.totalSessions);
        if (d.dna) setFlipped(true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status]);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const r = await fetch("/api/focus-dna/generate", {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
      });
      const d = await r.json() as { dna: FocusDna; error?: string };
      if (!r.ok) { setError(d.error ?? "Failed to generate"); return; }
      setFlipped(false);
      setTimeout(() => {
        setDna(d.dna);
        setFlipped(true);
      }, 300);
    } catch {
      setError("Failed to generate Focus DNA");
    } finally {
      setGenerating(false);
    }
  };

  const shareToX = () => {
    if (!dna) return;
    const text = `I am a ${dna.archetype} on @FocusArx! 🧬\n\nPeak Hour: ${formatHour(dna.topFocusHour)}\nAvg Session: ${dna.avgSessionMin}m\n\nFind your archetype at https://focusarx.site`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank");
  };

  const sessionsNeeded = Math.max(0, 3 - totalSessions);
  const sessionsUntilUpgrade = dna ? 10 - ((totalSessions - dna.sessionCountAtGeneration) % 10) : 0;

  return (
    <div className="relative min-h-[100dvh] overflow-hidden forge-bg-glow">
      <main className="relative z-10 mx-auto max-w-2xl px-4 py-10">
        <PageTransition>
          <header className="mb-8">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#4B5563]">Identity</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-[#E2E8F0] sm:text-3xl">
              <Dna size={22} className="text-[#A78BFA]" /> Focus DNA
            </h1>
          </header>

          {loading ? (
            <div className="flex h-48 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[rgba(124,58,237,0.3)] border-t-[#7C3AED]" /></div>
          ) : status === "authenticated" && dna ? (
            <div className="flex flex-col items-center gap-6">
              <div className="relative w-full max-w-sm" style={{ height: 400, perspective: 1200 }}>
                <CardFace dna={dna} flipped={flipped} />
              </div>
              <div className="flex gap-3">
                <button onClick={shareToX} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-bold text-white hover:bg-white/10">
                  <Share2 size={16} /> Share Archetype
                </button>
                <button onClick={generate} disabled={generating} className="flex items-center gap-2 rounded-xl border border-[rgba(124,58,237,0.4)] bg-[rgba(124,58,237,0.08)] px-6 py-3 text-sm font-bold text-[#A78BFA] hover:bg-[rgba(124,58,237,0.15)] disabled:opacity-50">
                  <RefreshCw size={14} className={generating ? "animate-spin" : ""} />
                  {generating ? "Analyzing..." : "Re-analyze"}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/20 p-12 text-center">
               <Dna size={40} className="mx-auto mb-4 text-[#4B5563]" />
               <p className="text-[#94A3B8]">{sessionsNeeded > 0 ? `Complete ${sessionsNeeded} more sessions to unlock.` : "Your DNA is ready to be analyzed."}</p>
               {sessionsNeeded === 0 && (
                 <button onClick={generate} disabled={generating} className="mt-6 rounded-xl bg-[#7C3AED] px-6 py-3 font-bold text-white">Generate DNA</button>
               )}
            </div>
          )}
        </PageTransition>
      </main>
    </div>
  );
}
