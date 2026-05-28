import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { PageTransition } from "@/components/PageTransition";
import { Dna, RefreshCw, Zap, Clock, Calendar, AlertTriangle } from "lucide-react";

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
      {/* Noise texture */}
      <div className="absolute inset-0 opacity-[0.04] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJuIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iMC42NSIgbnVtT2N0YXZlcz0iMyIgc3RpdGNoVGlsZXM9InN0aXRjaCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIiBmaWx0ZXI9InVybCgjbikiIG9wYWNpdHk9IjEiLz48L3N2Zz4=')]" />

      <div className="relative z-10 flex flex-col h-full p-7">
        {/* Header */}
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

        {/* Archetype name */}
        <div className="mb-6">
          <h2
            className="text-3xl font-black tracking-tight leading-tight"
            style={{ color: dna.colorSecondary }}
          >
            {dna.archetype}
          </h2>
          <p className="mt-2 text-sm text-[#94A3B8] leading-relaxed">{dna.description}</p>
        </div>

        {/* Stats grid */}
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
          <div className="rounded-xl p-3" style={{ background: `${dna.colorPrimary}12`, border: `1px solid ${dna.colorPrimary}22` }}>
            <div className="flex items-center gap-1.5 mb-1">
              <Calendar size={11} style={{ color: dna.colorSecondary }} />
              <span className="text-[9px] uppercase tracking-wider text-[#4B5563]">Best Day</span>
            </div>
            <p className="text-base font-bold" style={{ color: dna.colorSecondary }}>{dna.strongestDay ?? "—"}</p>
          </div>
          <div className="rounded-xl p-3" style={{ background: `${dna.colorPrimary}12`, border: `1px solid ${dna.colorPrimary}22` }}>
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle size={11} style={{ color: dna.colorSecondary }} />
              <span className="text-[9px] uppercase tracking-wider text-[#4B5563]">Weakness</span>
            </div>
            <p className="text-[13px] font-bold leading-tight" style={{ color: dna.colorSecondary }}>{dna.biggestWeakness ?? "—"}</p>
          </div>
        </div>

        {/* Footer */}
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
  const [isNew, setIsNew] = useState(false);
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
      const d = await r.json() as { dna: FocusDna; isNew: boolean; error?: string };
      if (!r.ok) { setError(d.error ?? "Failed to generate"); return; }
      setFlipped(false);
      await new Promise((resolve) => setTimeout(resolve, 100));
      setDna(d.dna);
      setIsNew(d.isNew);
      setTimeout(() => setFlipped(true), 300);
    } catch {
      setError("Failed to generate Focus DNA");
    } finally {
      setGenerating(false);
    }
  };

  const sessionsNeeded = Math.max(0, 3 - totalSessions);
  const progressToNext = totalSessions > 0 ? Math.min(1, (totalSessions % 10) / 10) : 0;
  const sessionsUntilUpgrade = dna ? 10 - ((totalSessions - dna.sessionCountAtGeneration) % 10) : 0;

  return (
    <div className="relative min-h-[100dvh] overflow-hidden forge-bg-glow">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -right-32 top-0 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.08),transparent_68%)] blur-2xl" />
      </div>
      <main className="relative z-10 mx-auto max-w-2xl px-4 py-10">
        <PageTransition>
          <header className="mb-8">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#4B5563]">Identity</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-[#E2E8F0] sm:text-3xl">
              <Dna size={22} className="text-[#A78BFA]" /> Focus DNA
            </h1>
            <p className="mt-1 text-sm text-[#4B5563]">Your personal focus archetype, evolved from your session history.</p>
          </header>

          {status === "unauthenticated" && (
            <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-8 text-center">
              <p className="text-[#94A3B8] text-sm">Sign in to unlock your Focus DNA.</p>
            </div>
          )}

          {loading && (
            <div className="flex h-48 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[rgba(124,58,237,0.3)] border-t-[#7C3AED]" />
            </div>
          )}

          {!loading && status === "authenticated" && (
            <div className="space-y-6">
              {/* Progress bar */}
              {dna && (
                <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-4 backdrop-blur-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-[#94A3B8]">Next archetype upgrade</span>
                    <span className="text-xs font-semibold text-[#A78BFA]">{sessionsUntilUpgrade} sessions away</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[rgba(124,58,237,0.1)] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#A78BFA]"
                      initial={{ width: 0 }}
                      animate={{ width: `${(1 - (sessionsUntilUpgrade / 10)) * 100}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                    />
                  </div>
                </div>
              )}

              {/* The card */}
              {dna ? (
                <div className="flex flex-col items-center gap-6">
                  {/* 3D flip card */}
                  <div
                    className="relative w-full max-w-sm"
                    style={{ height: 400, perspective: 1200 }}
                  >
                    {/* Card back (shows while flipping) */}
                    <motion.div
                      className="absolute inset-0 rounded-3xl border border-[rgba(124,58,237,0.3)] bg-[rgba(12,8,30,0.9)] flex items-center justify-center"
                      style={{ backfaceVisibility: "hidden" }}
                      animate={{ rotateY: flipped ? -180 : 0 }}
                      transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
                    >
                      <Dna size={48} className="text-[#7C3AED] opacity-40" />
                    </motion.div>

                    {/* Card front */}
                    <CardFace dna={dna} flipped={flipped} />
                  </div>

                  {isNew && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="rounded-2xl border border-[rgba(124,58,237,0.4)] bg-[rgba(124,58,237,0.1)] px-6 py-3 text-center"
                    >
                      <p className="text-sm font-semibold text-[#A78BFA]">✨ Archetype upgraded!</p>
                    </motion.div>
                  )}

                  <button
                    onClick={() => void generate()}
                    disabled={generating}
                    className="flex items-center gap-2 rounded-xl border border-[rgba(124,58,237,0.4)] bg-[rgba(124,58,237,0.08)] px-5 py-2.5 text-sm font-medium text-[#A78BFA] transition-all hover:bg-[rgba(124,58,237,0.15)] disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={generating ? "animate-spin" : ""} />
                    {generating ? "Analyzing sessions…" : "Re-analyze"}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-6 py-8">
                  {/* Empty state */}
                  <div
                    className="w-full max-w-sm rounded-3xl border border-dashed border-[rgba(124,58,237,0.3)] flex flex-col items-center justify-center gap-4 py-16 px-8 text-center"
                    style={{ height: 400 }}
                  >
                    <Dna size={56} className="text-[#4B5563]" />
                    <div>
                      <p className="text-base font-semibold text-[#94A3B8]">No Focus DNA yet</p>
                      {sessionsNeeded > 0 ? (
                        <p className="mt-1 text-sm text-[#4B5563]">
                          Complete {sessionsNeeded} more focus session{sessionsNeeded !== 1 ? "s" : ""} to unlock your archetype.
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-[#4B5563]">
                          You have {totalSessions} sessions. Ready to generate your archetype.
                        </p>
                      )}
                    </div>
                    {sessionsNeeded === 0 && (
                      <button
                        onClick={() => void generate()}
                        disabled={generating}
                        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(124,58,237,0.3)] transition-all hover:shadow-[0_0_30px_rgba(124,58,237,0.5)] disabled:opacity-50"
                      >
                        <Dna size={14} />
                        {generating ? "Analyzing…" : "Generate Focus DNA"}
                      </button>
                    )}
                  </div>

                  {/* Sessions progress */}
                  <div className="w-full max-w-sm rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-xs text-[#94A3B8]">Sessions completed</span>
                      <span className="text-xs font-semibold text-[#A78BFA]">{totalSessions} / 3</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[rgba(124,58,237,0.1)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] transition-all"
                        style={{ width: `${Math.min(100, (totalSessions / 3) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <p className="text-center text-sm text-red-400">{error}</p>
              )}
            </div>
          )}
        </PageTransition>
      </main>
    </div>
  );
}
