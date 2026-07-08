import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { PageTransition } from "@/components/PageTransition";
import { Play, Loader2, Radio, Sparkles } from "lucide-react";

type Session = {
  id: string;
  mode: string;
  durationSec: number;
  focusScore: number | null;
  focusQuality: string | null;
  focusTimeline: string | null;
  sessionInsights: string | null;
  completedAt: string | null;
  createdAt: string;
};

type TimelineEvent = {
  type: string;
  ts: number;
  score?: number;
};

type CaptionData = {
  caption: string;
  durationMin: number;
  distractions: number;
  pauses: number;
  peakFlowAt: number;
  longestStreak: number;
  lastDistractionAt: number;
};

const ZONE_COLORS: Record<string, string> = {
  focus:       "#22C55E",
  running:     "#22C55E",
  flow:        "#F59E0B",
  distraction: "#EF4444",
  pause:       "#F59E0B",
  paused:      "#F59E0B",
  break:       "#60A5FA",
};

function ReplayWaveform({ timeline, durationSec }: { timeline: TimelineEvent[]; durationSec: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const BARS = 120;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const barW = W / BARS;

    for (let i = 0; i < BARS; i++) {
      const t = (i / BARS) * durationSec;
      const tNext = ((i + 1) / BARS) * durationSec;

      // Find the event active at this time segment
      let activeType = "focus";
      for (const ev of timeline) {
        if (ev.ts <= t) activeType = ev.type;
        else break;
      }

      const color = ZONE_COLORS[activeType] ?? "#4B5563";
      const height = activeType === "distraction" ? H * 0.85 :
                     activeType === "flow" ? H * 0.95 :
                     activeType === "pause" || activeType === "paused" ? H * 0.35 :
                     activeType === "break" ? H * 0.25 :
                     H * 0.6 + Math.sin(i * 0.4) * H * 0.15;

      ctx.fillStyle = color + "88";
      ctx.beginPath();
      ctx.roundRect(i * barW + 1, H - height, barW - 2, height, 2);
      ctx.fill();
    }
  }, [timeline, durationSec]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={80}
      className="w-full rounded-xl"
      style={{ height: 80 }}
    />
  );
}

function SessionCard({ session }: { session: Session }) {
  const [expanded, setExpanded] = useState(false);
  const [caption, setCaption] = useState<CaptionData | null>(null);
  const [loadingCaption, setLoadingCaption] = useState(false);
  const token = () => localStorage.getItem("focusarx-auth-token");

  let timeline: TimelineEvent[] = [];
  try { timeline = JSON.parse(session.focusTimeline ?? "[]"); } catch { /* empty */ }

  const durationMin = Math.round(session.durationSec / 60);

  const loadCaption = async () => {
    if (caption || loadingCaption) return;
    setLoadingCaption(true);
    try {
      const r = await fetch(`/api/session-replay/${session.id}/caption`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}` },
      });
      const d = await r.json() as CaptionData;
      setCaption(d);
    } catch { /* empty */ }
    finally { setLoadingCaption(false); }
  };

  const handleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) void loadCaption();
  };

  const distractions = timeline.filter((t) => t.type === "distraction").length;
  const dateStr = session.completedAt
    ? new Date(session.completedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : new Date(session.createdAt).toLocaleDateString();

  return (
    <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] overflow-hidden backdrop-blur-xl">
      <button
        onClick={handleExpand}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-[rgba(124,58,237,0.04)] transition-colors"
      >
        <div className="w-9 h-9 rounded-xl bg-[rgba(124,58,237,0.12)] flex items-center justify-center shrink-0">
          <Play size={14} className="text-[#A78BFA]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="rounded-full bg-[rgba(124,58,237,0.12)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#A78BFA]">{session.mode}</span>
            <span className="text-xs font-semibold text-[#E2E8F0]">{durationMin}m</span>
            {distractions > 0 && (
              <span className="text-[10px] text-red-400">{distractions} distraction{distractions !== 1 ? "s" : ""}</span>
            )}
          </div>
          <p className="text-[10px] text-[#4B5563] mt-0.5">{dateStr}</p>
        </div>
        {session.focusScore != null && (
          <span className="text-sm font-bold text-[#A78BFA]">{session.focusScore}</span>
        )}
        <span className={`text-[10px] text-[#4B5563] transition-transform ${expanded ? "rotate-90" : ""}`}>▶</span>
      </button>

      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="border-t border-[rgba(124,58,237,0.08)] px-5 pb-5 pt-4"
        >
          {/* Waveform */}
          {timeline.length > 0 ? (
            <div className="mb-4">
              <p className="text-[10px] uppercase tracking-wider text-[#4B5563] mb-2">Session Waveform</p>
              <ReplayWaveform timeline={timeline} durationSec={session.durationSec} />
              {/* Legend */}
              <div className="flex flex-wrap gap-3 mt-2">
                {[
                  { color: "#22C55E", label: "Focus" },
                  { color: "#F59E0B", label: "Flow / Pause" },
                  { color: "#EF4444", label: "Distraction" },
                  { color: "#60A5FA", label: "Break" },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color + "88" }} />
                    <span className="text-[9px] text-[#4B5563]">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#4B5563] mb-4">No timeline data for this session.</p>
          )}

          {/* Caption */}
          <div className="rounded-xl border border-[rgba(124,58,237,0.15)] bg-[rgba(124,58,237,0.05)] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={12} className="text-[#A78BFA]" />
              <span className="text-[10px] uppercase tracking-wider text-[#4B5563]">AI Replay Caption</span>
            </div>
            {loadingCaption ? (
              <div className="flex items-center gap-2 text-xs text-[#4B5563]">
                <Loader2 size={12} className="animate-spin" /> Generating caption…
              </div>
            ) : caption ? (
              <p className="text-sm text-[#94A3B8] leading-relaxed">{caption.caption}</p>
            ) : (
              <button
                onClick={() => void loadCaption()}
                className="text-xs text-[#A78BFA] hover:text-[#7C3AED]"
              >
                Generate caption
              </button>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default function ReplayPage() {
  const { status } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const token = () => localStorage.getItem("focusarx-auth-token");

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") { setLoading(false); return; }
    fetch("/api/session-replay", { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => r.json())
      .then((d: { sessions: Session[] }) => setSessions(d.sessions))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status]);

  return (
    <div className="relative min-h-[100dvh] overflow-hidden forge-bg-glow">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute left-0 top-1/2 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.07),transparent_68%)] blur-2xl" />
      </div>
      <main className="relative z-10 mx-auto max-w-2xl px-4 py-10">
        <PageTransition>
          <header className="mb-8">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#4B5563]">Archive</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-[#E2E8F0] sm:text-3xl">
              <Radio size={22} className="text-[#A78BFA]" /> Session Archive
            </h1>
            <p className="mt-1 text-sm text-[#4B5563]">Visual replay of every session you've ever completed.</p>
          </header>

          {loading && (
            <div className="flex h-48 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[rgba(124,58,237,0.3)] border-t-[#7C3AED]" />
            </div>
          )}

          {!loading && status === "unauthenticated" && (
            <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-8 text-center">
              <p className="text-[#94A3B8] text-sm">Sign in to see your session archive.</p>
            </div>
          )}

          {!loading && status === "authenticated" && sessions.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[rgba(124,58,237,0.2)] bg-[var(--card)] p-12 text-center">
              <Radio size={48} className="mx-auto mb-4 text-[#4B5563]" />
              <p className="text-base font-semibold text-[#94A3B8]">No sessions yet</p>
              <p className="mt-1 text-sm text-[#4B5563]">Complete a focus block to see it here.</p>
            </div>
          )}

          {!loading && sessions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-xs text-[#4B5563]">{sessions.length} session{sessions.length !== 1 ? "s" : ""} recorded</span>
                <span className="text-xs text-[#4B5563]">Click to expand replay</span>
              </div>
              {sessions.map((s) => <SessionCard key={s.id} session={s} />)}
            </div>
          )}
        </PageTransition>
      </main>
    </div>
  );
}
