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
  easy:   { color: "var(--palette-10b981)", bg: "var(--rgba-16-185-129-0_08)",  border: "var(--rgba-16-185-129-0_2)"  },
  medium: { color: "var(--color-warning)", bg: "var(--rgba-245-158-11-0_08)",  border: "var(--rgba-245-158-11-0_2)"  },
  hard:   { color: "var(--color-error)", bg: "var(--rgba-239-68-68-0_08)",   border: "var(--rgba-239-68-68-0_2)"   },
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
      style={{ borderColor: isComplete && !isClaimed ? "var(--rgba-6-214-160-0_4)" : "var(--rgba-255-255-255-0_06)", background: isComplete && !isClaimed ? "var(--rgba-6-214-160-0_04)" : "var(--rgba-255-255-255-0_02)" }}>
      <div className="flex items-start gap-3">
        <div className="text-2xl shrink-0">{quest.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">{quest.title}</h3>
            <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase" style={{ color: diff.color, background: diff.bg, border: `1px solid ${diff.border}` }}>
              {quest.difficulty}
            </span>
            {isClaimed && <span className="rounded-full bg-[var(--rgba-16-185-129-0_12)] border border-[var(--rgba-16-185-129-0_25)] px-2 py-0.5 text-[9px] font-bold text-[var(--palette-10b981)]">CLAIMED</span>}
          </div>
          <p className="text-[11px] text-[var(--foreground-subtle)] mb-3">{quest.description}</p>

          {/* Progress bar */}
          <div className="mb-2">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-[var(--foreground-subtle)]">{progress.current ?? 0} / {quest.target} {quest.metric?.replace(/_/g, " ")}</span>
              <span className="text-[10px] font-semibold" style={{ color: diff.color }}>{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--rgba-255-255-255-0_06)] overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                style={{ background: isComplete ? "var(--palette-10b981)" : diff.color }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[10px] text-[var(--brand-400)]"><Zap size={10} /> +{quest.xpReward} XP</span>
              <span className="flex items-center gap-1 text-[10px] text-[var(--color-warning)]">🪙 +{quest.coinReward}</span>
            </div>
            {isComplete && !isClaimed && (
              <button
                onClick={() => onClaim(quest.id)}
                disabled={!!claiming}
                className="rounded-xl bg-[var(--rgba-6-214-160-0_2)] border border-[var(--rgba-6-214-160-0_3)] px-3 py-1.5 text-xs font-bold text-[var(--brand-teal)] hover:bg-[var(--rgba-6-214-160-0_3)] transition-all disabled:opacity-50"
              >
                {claiming === quest.id ? "Claiming…" : "Claim!"}
              </button>
            )}
            {isComplete && isClaimed && (
              <CheckCircle size={16} className="text-[var(--palette-10b981)]" />
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
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Quests <span className="text-[var(--color-warning)]">🗺️</span></h1>
            <p className="text-sm text-[var(--foreground-subtle)] mt-0.5">Complete challenges, earn rewards</p>
          </div>
          <div className="flex items-center gap-2">
            {claimable > 0 && (
              <span className="rounded-full bg-[var(--rgba-6-214-160-0_15)] border border-[var(--rgba-6-214-160-0_3)] px-3 py-1 text-xs font-bold text-[var(--brand-teal)]">
                {claimable} ready to claim!
              </span>
            )}
            <button onClick={load} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--muted)] p-2 text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)] transition-colors">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--palette-zinc-700)] border-t-[var(--brand-600)]" />
          </div>
        ) : (
          <>
            {/* Daily */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock size={14} className="text-[var(--brand-teal)]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--brand-teal)]">Daily Quests</h2>
                <span className="text-[10px] text-[var(--foreground-subtle)]">(resets at midnight)</span>
              </div>
              {quests.daily.length === 0 ? (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--muted)] p-6 text-center text-sm text-[var(--foreground-subtle)]">
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
                <Calendar size={14} className="text-[var(--brand-400)]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--brand-400)]">Weekly Quests</h2>
                <span className="text-[10px] text-[var(--foreground-subtle)]">(resets Monday)</span>
              </div>
              {quests.weekly.length === 0 ? (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--muted)] p-6 text-center text-sm text-[var(--foreground-subtle)]">
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
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[var(--z-modal)] rounded-2xl border border-[var(--rgba-124-58-237-0_3)] bg-[var(--palette-0d0f1c)] px-5 py-3 text-sm font-semibold text-[var(--brand-400)] shadow-lg">
              ✅ {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </PageTransition>
  );
}
