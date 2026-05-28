import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { PageTransition } from "@/components/PageTransition";
import { Ghost, Trophy, Zap, Clock, Flag, Timer } from "lucide-react";

type SessionGhost = {
  id: string;
  taskCategory: string;
  bestDurationSec: number;
  bestUnbrokenSec: number;
  sessionId: string | null;
  updatedAt: string;
};

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function GhostRaceDemo({ ghost }: { ghost: SessionGhost }) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const best = ghost.bestDurationSec;
  const liveProgress = Math.min(1, elapsed / best);
  const ghostProgress = Math.min(1, elapsed / best);

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const toggle = () => {
    if (running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setRunning(false);
      setElapsed(0);
    } else {
      setRunning(true);
      intervalRef.current = setInterval(() => {
        setElapsed((e) => {
          if (e >= best) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setRunning(false);
            return best;
          }
          return e + 1;
        });
      }, 100);
    }
  };

  const beatGhost = elapsed >= best;

  return (
    <div className="rounded-2xl border border-[rgba(124,58,237,0.2)] bg-[var(--card)] p-4 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Ghost size={16} className="text-[#A78BFA]" />
          <span className="text-sm font-semibold text-[#E2E8F0]">{ghost.taskCategory}</span>
        </div>
        <span className="rounded-full bg-[rgba(124,58,237,0.12)] px-2.5 py-0.5 text-[10px] font-semibold text-[#A78BFA] uppercase tracking-wider">
          PR: {fmtTime(best)}
        </span>
      </div>

      {/* Race tracks */}
      <div className="space-y-3 mb-4">
        {/* Ghost track */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-[#4B5563] flex items-center gap-1"><Ghost size={10} /> Ghost</span>
            <span className="text-[10px] font-mono text-[#6B7280]">{fmtTime(Math.floor(elapsed * 0.95))}</span>
          </div>
          <div className="h-2 rounded-full bg-[rgba(124,58,237,0.1)] overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-[rgba(124,58,237,0.4)]"
              style={{ width: `${ghostProgress * 95}%` }}
            />
          </div>
        </div>

        {/* Live track */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-[#4B5563] flex items-center gap-1"><Zap size={10} /> You</span>
            <span className="text-[10px] font-mono text-[#A78BFA]">{fmtTime(elapsed)}</span>
          </div>
          <div className="h-2 rounded-full bg-[rgba(124,58,237,0.1)] overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#A78BFA]"
              style={{ width: `${liveProgress * 100}%` }}
            />
          </div>
        </div>
      </div>

      {beatGhost && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3 rounded-xl border border-[rgba(251,191,36,0.3)] bg-[rgba(251,191,36,0.08)] px-4 py-2 text-center"
        >
          <p className="text-sm font-bold text-amber-400">🏁 LAP COMPLETE — New PR!</p>
        </motion.div>
      )}

      <button
        onClick={toggle}
        className="w-full rounded-xl border border-[rgba(124,58,237,0.3)] bg-[rgba(124,58,237,0.08)] py-2 text-xs font-semibold text-[#A78BFA] transition-all hover:bg-[rgba(124,58,237,0.15)]"
      >
        {running ? "⏹ Stop Demo" : elapsed >= best ? "↺ Race Again" : "▶ Demo Race"}
      </button>
    </div>
  );
}

export default function GhostsPage() {
  const { status } = useAuth();
  const [ghosts, setGhosts] = useState<SessionGhost[]>([]);
  const [loading, setLoading] = useState(true);

  const token = () => localStorage.getItem("focusarx-auth-token");

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") { setLoading(false); return; }
    fetch("/api/ghosts", { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => r.json())
      .then((d: { ghosts: SessionGhost[] }) => { setGhosts(d.ghosts); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status]);

  return (
    <div className="relative min-h-[100dvh] overflow-hidden forge-bg-glow">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -left-32 top-1/3 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.07),transparent_68%)] blur-2xl" />
      </div>
      <main className="relative z-10 mx-auto max-w-2xl px-4 py-10">
        <PageTransition>
          <header className="mb-8">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#4B5563]">Racing</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-[#E2E8F0] sm:text-3xl">
              <Ghost size={22} className="text-[#A78BFA]" /> Ghost Mode
            </h1>
            <p className="mt-1 text-sm text-[#4B5563]">Race your own personal records. Beat your ghost, set a new lap time.</p>
          </header>

          {/* How it works banner */}
          <div className="mb-6 rounded-2xl border border-[rgba(124,58,237,0.2)] bg-[rgba(124,58,237,0.05)] p-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { icon: Timer, label: "Complete a session", desc: "Any focus block is recorded" },
                { icon: Ghost, label: "Ghost is saved", desc: "Your PR becomes the ghost" },
                { icon: Flag, label: "Beat your PR", desc: "Earn a lap-complete celebration" },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label}>
                  <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-[rgba(124,58,237,0.12)]">
                    <Icon size={14} className="text-[#A78BFA]" />
                  </div>
                  <p className="text-[11px] font-semibold text-[#E2E8F0]">{label}</p>
                  <p className="text-[10px] text-[#4B5563]">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {loading && (
            <div className="flex h-48 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[rgba(124,58,237,0.3)] border-t-[#7C3AED]" />
            </div>
          )}

          {!loading && status === "unauthenticated" && (
            <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-8 text-center">
              <p className="text-[#94A3B8] text-sm">Sign in to see your Ghost leaderboard.</p>
            </div>
          )}

          {!loading && status === "authenticated" && ghosts.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[rgba(124,58,237,0.2)] bg-[var(--card)] p-12 text-center">
              <Ghost size={48} className="mx-auto mb-4 text-[#4B5563]" />
              <p className="text-base font-semibold text-[#94A3B8]">No ghosts yet</p>
              <p className="mt-1 text-sm text-[#4B5563]">Complete a focus session to record your first ghost.</p>
            </div>
          )}

          {!loading && ghosts.length > 0 && (
            <div className="space-y-4">
              {/* Leaderboard header */}
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold text-[#E2E8F0] flex items-center gap-2">
                  <Trophy size={14} className="text-amber-400" /> Personal Records
                </h2>
                <span className="text-xs text-[#4B5563]">{ghosts.length} categor{ghosts.length === 1 ? "y" : "ies"}</span>
              </div>

              {/* Top 5 leaderboard */}
              <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] overflow-hidden backdrop-blur-xl">
                {ghosts.slice(0, 5).map((ghost, i) => (
                  <div
                    key={ghost.id}
                    className={`flex items-center gap-4 px-5 py-3.5 ${i < ghosts.length - 1 ? "border-b border-[rgba(124,58,237,0.08)]" : ""}`}
                  >
                    <span className={`w-6 text-center text-sm font-black ${i === 0 ? "text-amber-400" : i === 1 ? "text-[#94A3B8]" : i === 2 ? "text-amber-700" : "text-[#4B5563]"}`}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#E2E8F0] truncate">{ghost.taskCategory}</p>
                      <p className="text-[10px] text-[#4B5563]">
                        Best unbroken: {fmtTime(ghost.bestUnbrokenSec)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#A78BFA] font-mono">{fmtTime(ghost.bestDurationSec)}</p>
                      <p className="text-[10px] text-[#4B5563]">Sector time</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Demo ghost races */}
              <h2 className="mt-2 text-sm font-semibold text-[#E2E8F0] flex items-center gap-2">
                <Zap size={14} className="text-[#A78BFA]" /> Demo Race
              </h2>
              {ghosts.slice(0, 2).map((ghost) => (
                <GhostRaceDemo key={ghost.id} ghost={ghost} />
              ))}
            </div>
          )}
        </PageTransition>
      </main>
    </div>
  );
}
