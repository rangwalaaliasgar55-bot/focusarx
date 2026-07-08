import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getToken } from "@/lib/auth";
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

export default function DailyRewardBanner() {
  const [status, setStatus] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [claimedReward, setClaimedReward] = useState<any>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
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
      setStatus((s: any) => s ? { ...s, alreadyClaimed: true, streak: data.streak } : s);
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
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm mx-4"
        >
          <div className="rounded-2xl border border-[rgba(245,158,11,0.3)] bg-[#0d0f1c] shadow-[0_8px_40px_rgba(0,0,0,0.6)] overflow-hidden">
            {/* Gradient top bar */}
            <div className="h-1 bg-gradient-to-r from-[#F59E0B] via-[#FCD34D] to-[#F59E0B]" />
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{STREAK_EMOJIS[(status.streak ?? 0) % 7]}</span>
                  <div>
                    <p className="text-sm font-bold text-[#E2E8F0]">{claimed ? "Reward Claimed! 🎉" : "Daily Reward Available!"}</p>
                    <p className="text-[10px] text-[#4B5563]">
                      {claimed ? `${status.streak}-day streak!` : `Day ${(status.streak % 7) + 1} — ${status.streak}-day streak`}
                    </p>
                  </div>
                </div>
                <button onClick={handleDismiss} className="text-[#4B5563] hover:text-[#94A3B8] transition-colors">
                  <X size={16} />
                </button>
              </div>

              {/* Reward preview */}
              {!claimed && status.nextReward && (
                <div className="flex items-center gap-3 rounded-xl border border-[rgba(245,158,11,0.15)] bg-[rgba(245,158,11,0.06)] p-3 mb-4">
                  <span className="text-2xl">{status.nextReward.icon}</span>
                  <div>
                    <p className="text-xs font-semibold text-[#F59E0B]">{status.nextReward.label}</p>
                    <p className="text-[10px] text-[#94A3B8]">🪙 {status.nextReward.coins} coins · ⚡ {status.nextReward.xp} XP</p>
                  </div>
                </div>
              )}

              {/* Claimed state */}
              {claimed && claimedReward && (
                <div className="flex items-center gap-3 rounded-xl border border-[rgba(6,214,160,0.2)] bg-[rgba(6,214,160,0.06)] p-3 mb-4">
                  <CheckCircle size={20} className="text-[#06D6A0] shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-[#06D6A0]">+{claimedReward.coins} coins &amp; +{claimedReward.xp} XP added!</p>
                    <p className="text-[10px] text-[#4B5563]">Come back tomorrow for more rewards</p>
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
                        isPast ? "bg-[#F59E0B] text-black" : isCurrent ? "bg-[rgba(245,158,11,0.3)] border-2 border-[#F59E0B] text-[#F59E0B]" : "bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-[#4B5563]"
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
                  className="w-full rounded-xl py-2.5 text-sm font-bold text-white transition-all disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #F59E0B, #D97706)" }}
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
