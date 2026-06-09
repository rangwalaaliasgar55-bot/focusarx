import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { getToken } from "@/lib/auth";
import { Target, Zap, Clock, CheckCircle, Lock, RefreshCw, Calendar } from "lucide-react";
import { PAGE, CARD, STAGGER } from "@/lib/animations";

function authHeaders() {
  const t = getToken();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (t) h["Authorization"] = `Bearer ${t}`;
  return h;
}

const DIFF_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  easy:   { color: "#10B981", bg: "rgba(16,185,129,0.08)",  border: "rgba(16,185,129,0.2)"  },
  medium: { color: "#F59E0B", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.2)"  },
  hard:   { color: "#EF4444", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.2)"   },
};

function QuestCard({ progress, onClaim, claiming }: { progress: any; onClaim: (id: string) => void; claiming: string | null }) {
  const quest = progress.quest;
  if (!quest) return null;
  const pct = Math.min(100, Math.round(((progress.current ?? 0) / quest.target) * 100));
  const diff = DIFF_STYLE[quest.difficulty] ?? DIFF_STYLE.easy;
  const isComplete = progress.completed;
  const isClaimed = !!progress.claimedAt;

  return (
    <motion.div variants={CARD}
      className="rounded-2xl border p-4 transition-all"
      style={{ borderColor: isComplete && !isClaimed ? "rgba(6,214,160,0.4)" : "rgba(255,255,255,0.06)", background: isComplete && !isClaimed ? "rgba(6,214,160,0.04)" : "rgba(255,255,255,0.02)" }}>
      <div className="flex items-start gap-3">
        <div className="text-2xl shrink-0">{quest.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-sm font-semibold text-[#E2E8F0]">{quest.title}</h3>
            <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase" style={{ color: diff.color, background: diff.bg, border: `1px solid ${diff.border}` }}>
              {quest.difficulty}
            </span>
            {isClaimed && <span className="rounded-full bg-[rgba(16,185,129,0.12)] border border-[rgba(16,185,129,0.25)] px-2 py-0.5 text-[9px] font-bold text-[#10B981]">CLAIMED</span>}
          </div>
          <p className="text-[11px] text-[#4B5563] mb-3">{quest.description}</p>

          {/* Progress bar */}
          <div className="mb-2">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-[#4B5563]">{progress.current ?? 0} / {quest.target} {quest.metric?.replace(/_/g, " ")}</span>
              <span className="text-[10px] font-semibold" style={{ color: diff.color }}>{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                style={{ background: isComplete ? "#10B981" : diff.color }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[10px] text-[#A78BFA]"><Zap size={10} /> +{quest.xpReward} XP</span>
              <span className="flex items-center gap-1 text-[10px] text-[#F59E0B]">🪙 +{quest.coinReward}</span>
            </div>
            {isComplete && !isClaimed && (
              <button
                onClick={() => onClaim(quest.id)}
                disabled={!!claiming}
                className="rounded-xl bg-[rgba(6,214,160,0.2)] border border-[rgba(6,214,160,0.3)] px-3 py-1.5 text-xs font-bold text-[#06D6A0] hover:bg-[rgba(6,214,160,0.3)] transition-all disabled:opacity-50"
              >
                {claiming === quest.id ? "Claiming…" : "Claim!"}
              </button>
            )}
            {isComplete && isClaimed && (
              <CheckCircle size={16} className="text-[#10B981]" />
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function QuestsPage() {
  const [quests, setQuests] = useState<{ daily: any[]; weekly: any[] }>({ daily: [], weekly: [] });
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/quests", { headers: authHeaders() });
      if (res.ok) setQuests(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleClaim = async (questId: string) => {
    setClaiming(questId);
    try {
      const res = await fetch(`/api/quests/${questId}/claim`, { method: "POST", headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) { setToast(data.error || "Failed to claim"); setTimeout(() => setToast(null), 3000); return; }
      setToast(`Claimed! +${data.xpReward ?? 0} XP, +${data.coinReward ?? 0} 🪙`);
      setTimeout(() => setToast(null), 3000);
      await load();
    } finally {
      setClaiming(null);
    }
  };

  const claimable = [...quests.daily, ...quests.weekly].filter(p => p.completed && !p.claimedAt).length;

  return (
    <PageTransition>
      <motion.div variants={PAGE} initial="initial" animate="animate" className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#E2E8F0]">Quests <span className="text-[#F59E0B]">🗺️</span></h1>
            <p className="text-sm text-[#4B5563] mt-0.5">Complete challenges, earn rewards</p>
          </div>
          <div className="flex items-center gap-2">
            {claimable > 0 && (
              <span className="rounded-full bg-[rgba(6,214,160,0.15)] border border-[rgba(6,214,160,0.3)] px-3 py-1 text-xs font-bold text-[#06D6A0]">
                {claimable} ready to claim!
              </span>
            )}
            <button onClick={load} className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-2 text-[#4B5563] hover:text-[#94A3B8] transition-colors">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-[#7C3AED]" />
          </div>
        ) : (
          <>
            {/* Daily */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock size={14} className="text-[#06D6A0]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#06D6A0]">Daily Quests</h2>
                <span className="text-[10px] text-[#4B5563]">(resets at midnight)</span>
              </div>
              {quests.daily.length === 0 ? (
                <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-6 text-center text-sm text-[#4B5563]">
                  Daily quests loading… Complete a session to unlock them!
                </div>
              ) : (
                <motion.div variants={STAGGER} initial="initial" animate="animate" className="space-y-3">
                  {quests.daily.map(p => <QuestCard key={p.id} progress={p} onClaim={handleClaim} claiming={claiming} />)}
                </motion.div>
              )}
            </div>

            {/* Weekly */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={14} className="text-[#A78BFA]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#A78BFA]">Weekly Quests</h2>
                <span className="text-[10px] text-[#4B5563]">(resets Monday)</span>
              </div>
              {quests.weekly.length === 0 ? (
                <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-6 text-center text-sm text-[#4B5563]">
                  No weekly quests yet. Keep completing sessions to unlock them!
                </div>
              ) : (
                <motion.div variants={STAGGER} initial="initial" animate="animate" className="space-y-3">
                  {quests.weekly.map(p => <QuestCard key={p.id} progress={p} onClaim={handleClaim} claiming={claiming} />)}
                </motion.div>
              )}
            </div>
          </>
        )}

        <AnimatePresence>
          {toast && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-2xl border border-[rgba(124,58,237,0.3)] bg-[#0d0f1c] px-5 py-3 text-sm font-semibold text-[#A78BFA] shadow-lg">
              ✅ {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </PageTransition>
  );
}
