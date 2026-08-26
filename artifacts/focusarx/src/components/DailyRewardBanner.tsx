import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getToken } from "@/lib/auth";
import { isOnboarded } from "@/lib/onboarding";
import { Gift, X, Star, CheckCircle } from "lucide-react";

function authHeaders() {
  const t = getToken();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (t) h["Authorization"] = `Bearer ${t}`;
  return h;
}

const LS_KEY = "focusarx-daily-reward-dismissed";
function getTodayKey() { return new Date().toISOString().split("T")[0]; }

const STREAK_EMOJIS = ["🌟", "⭐", "🔥", "💫", "✨", "🏅", "🏆"];

interface DailyRewardStatus {
  streak: number;
  alreadyClaimed: boolean;
  nextReward?: { icon: string; label: string; description?: string; coins?: number; xp?: number };
}

interface ClaimedReward {
  coins?: number;
  xp?: number;
  label?: string;
  icon?: string;
}

export default function DailyRewardBanner() {
  const [status, setStatus] = useState<DailyRewardStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [claimedReward, setClaimedReward] = useState<ClaimedReward | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    // Don't interrupt the first-run onboarding flow with reward popups.
    if (!isOnboarded()) return;
    const dismissed = localStorage.getItem(LS_KEY);
    if (dismissed === getTodayKey()) return;

    fetch("/api/daily-reward/status", { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setStatus(d);
        if (!d.alreadyClaimed) setOpen(true);
      })
      .catch(() => {});
  }, []);

  const handleDismiss = () => {
    setOpen(false);
    localStorage.setItem(LS_KEY, getTodayKey());
  };

  const handleClaim = async () => {
    setClaiming(true);
    try {
      const res = await fetch("/api/daily-reward/claim", { method: "POST", headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) { handleDismiss(); return; }
      setClaimed(true);
      setClaimedReward(data.reward);
      setStatus((s) => s ? { ...s, alreadyClaimed: true, streak: data.streak } : s);
      setTimeout(() => { setOpen(false); localStorage.setItem(LS_KEY, getTodayKey()); }, 3000);
    } finally {
      setClaiming(false);
    }
  };

  if (!status) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="fixed top-16 left-1/2 -translate-x-1/2 z-[var(--z-modal)] w-full max-w-sm mx-4"
        >
          <div className="rounded-2xl border border-[var(--rgba-245-158-11-0_3)] bg-[var(--palette-0d0f1c)] shadow-[0_8px_40px_var(--rgba-0-0-0-0_6)] overflow-hidden">
            {/* Gradient top bar */}
            <div className="h-1 bg-gradient-to-r from-[var(--color-warning)] via-[var(--palette-fcd34d)] to-[var(--color-warning)]" />
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{STREAK_EMOJIS[(status.streak ?? 0) % 7]}</span>
                  <div>
                    <p className="text-sm font-bold text-[var(--foreground)]">{claimed ? "Reward Claimed! 🎉" : "Daily Reward Available!"}</p>
                    <p className="text-[10px] text-[var(--foreground-subtle)]">
                      {claimed ? `${status.streak}-day streak!` : `Day ${(status.streak % 7) + 1} — ${status.streak}-day streak`}
                    </p>
                  </div>
                </div>
                <button onClick={handleDismiss} className="text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)] transition-colors">
                  <X size={16} />
                </button>
              </div>

              {/* Reward preview */}
              {!claimed && status.nextReward && (
                <div className="flex items-center gap-3 rounded-xl border border-[var(--rgba-245-158-11-0_15)] bg-[var(--rgba-245-158-11-0_06)] p-3 mb-4">
                  <span className="text-2xl">{status.nextReward.icon}</span>
                  <div>
                    <p className="text-xs font-semibold text-[var(--color-warning)]">{status.nextReward.label}</p>
                    <p className="text-[10px] text-[var(--foreground-muted)]">🪙 {status.nextReward.coins} coins · ⚡ {status.nextReward.xp} XP</p>
                  </div>
                </div>
              )}

              {/* Claimed state */}
              {claimed && claimedReward && (
                <div className="flex items-center gap-3 rounded-xl border border-[var(--rgba-6-214-160-0_2)] bg-[var(--rgba-6-214-160-0_06)] p-3 mb-4">
                  <CheckCircle size={20} className="text-[var(--brand-teal)] shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-[var(--brand-teal)]">+{claimedReward.coins} coins &amp; +{claimedReward.xp} XP added!</p>
                    <p className="text-[10px] text-[var(--foreground-subtle)]">Come back tomorrow for more rewards</p>
                  </div>
                </div>
              )}

              {/* 7-day preview dots */}
              <div className="flex items-center justify-center gap-2 mb-4">
                {[1,2,3,4,5,6,7].map(day => {
                  const currentDay = (status.streak % 7) + 1;
                  const isCurrent = day === currentDay;
                  const isPast = day < currentDay;
                  return (
                    <div key={day}
                      className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        isPast ? "bg-[var(--color-warning)] text-[var(--palette-black)]" : isCurrent ? "bg-[var(--rgba-245-158-11-0_3)] border-2 border-[var(--color-warning)] text-[var(--color-warning)]" : "bg-[var(--rgba-255-255-255-0_04)] border border-[var(--rgba-255-255-255-0_06)] text-[var(--foreground-subtle)]"
                      }`}
                    >
                      {day === 7 ? "🏆" : STREAK_EMOJIS[day - 1]}
                    </div>
                  );
                })}
              </div>

              {!claimed && (
                <button
                  onClick={handleClaim}
                  disabled={claiming}
                  className="w-full rounded-xl py-2.5 text-sm font-bold text-[var(--palette-white)] transition-all disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, var(--color-warning), var(--palette-d97706))" }}
                >
                  {claiming ? "Claiming…" : "Claim Daily Reward 🎁"}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
