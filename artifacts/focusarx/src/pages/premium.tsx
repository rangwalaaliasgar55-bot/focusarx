import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Crown, Zap, Star, Shield, Sparkles, Gift, BarChart2, Brain, CheckCircle, Coins, AlertTriangle } from "lucide-react";
import { getToken } from "@/lib/auth";

async function apiFetch(url: string, opts?: RequestInit) {
  const token = getToken();
  const res = await fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json", ...opts?.headers },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({ error: "Error" }))).error ?? "Request failed");
  return res.json();
}

const BENEFITS = [
  { icon: Star,       label: "Exclusive Pets",          desc: "Unlock rare and legendary pet companions" },
  { icon: Gift,       label: "Premium Loot Boxes",       desc: "Access exclusive loot boxes with higher drop rates" },
  { icon: Sparkles,   label: "Premium Themes",           desc: "Apply rare visual themes to your workspace" },
  { icon: Zap,        label: "XP Multiplier",            desc: "Earn 1.5× XP on every focus session" },
  { icon: Coins,      label: "Coin Multiplier",          desc: "Earn 1.25× coins on every session" },
  { icon: BarChart2,  label: "Premium Analytics",        desc: "Deep-dive focus patterns, heatmaps, and AI reports" },
  { icon: Shield,     label: "Profile Badge",            desc: "Crown badge on your public profile & leaderboard" },
  { icon: Brain,      label: "Premium Battle Pass",      desc: "Unlock all battle pass tiers instantly" },
];

export default function PremiumPage() {
  const qc = useQueryClient();
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);
  const [activateSuccess, setActivateSuccess] = useState(false);

  const { data: premiumStatus, isLoading } = useQuery({
    queryKey: ["premium-status"],
    queryFn: () => apiFetch("/api/premium/status"),
    staleTime: 30_000,
  });

  const { data: wallet } = useQuery({
    queryKey: ["wallet"],
    queryFn: () => apiFetch("/api/gamification/wallet"),
    staleTime: 30_000,
  });

  const coins: number = wallet?.coins ?? 0;
  const isPremium: boolean = premiumStatus?.isPremium ?? false;
  const cost: number = premiumStatus?.cost ?? 9000;
  const expiresAt: string | null = premiumStatus?.expiresAt ?? null;
  const canAfford = coins >= cost;

  async function handleActivate() {
    if (!canAfford || isPremium) return;
    setActivating(true); setActivateError(null);
    try {
      await apiFetch("/api/premium/activate", { method: "POST" });
      setActivateSuccess(true);
      qc.invalidateQueries({ queryKey: ["premium-status"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    } catch (e: any) {
      setActivateError(e.message ?? "Failed to activate");
    } finally {
      setActivating(false);
    }
  }

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-8">

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl border border-[var(--palette-amber-500)]/20 bg-gradient-to-br from-[var(--palette-amber-950)]/30 via-[var(--rgba-6-7-18-0_98)] to-[var(--rgba-6-7-18-0_98)] p-8 text-center"
          style={{ boxShadow: "0 0 60px var(--rgba-251-191-36-0_08)" }}
        >
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-[var(--palette-amber-500)]/10 blur-3xl rounded-full" />
          </div>
          <div className="relative">
            <div className="flex items-center justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--palette-amber-400)] to-[var(--palette-amber-600)] shadow-[0_0_30px_var(--rgba-251-191-36-0_4)]">
                <Crown size={28} className="text-[var(--palette-white)]" />
              </div>
            </div>
            <h1 className="text-3xl font-black text-[var(--palette-white)] mb-2">FocusArx <span className="text-[var(--palette-amber-400)]">Premium</span></h1>
            <p className="text-[var(--foreground-muted)] text-sm max-w-md mx-auto">
              Unlock the full power of FocusArx. More XP, exclusive cosmetics, deeper analytics, and rare collectibles — for 30 days.
            </p>

            {isLoading ? (
              <div className="mt-6 h-8 w-32 rounded-lg bg-[var(--palette-zinc-800)] animate-pulse mx-auto" />
            ) : isPremium ? (
              <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[var(--palette-emerald-500)]/30 bg-[var(--palette-emerald-500)]/10 px-5 py-2.5 text-[var(--palette-emerald-400)] font-semibold text-sm">
                <CheckCircle size={16} />
                Premium Active
                {expiresAt && <span className="text-[var(--palette-emerald-500)]/70 text-xs font-normal ml-1">— expires {new Date(expiresAt).toLocaleDateString()}</span>}
              </div>
            ) : activateSuccess ? (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="mt-6 inline-flex items-center gap-2 rounded-full border border-[var(--palette-emerald-500)]/30 bg-[var(--palette-emerald-500)]/10 px-5 py-2.5 text-[var(--palette-emerald-400)] font-semibold text-sm"
              >
                <CheckCircle size={16} />
                Premium Activated! Welcome to the club 👑
              </motion.div>
            ) : (
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-center gap-2 text-sm text-[var(--foreground-muted)]">
                  <Coins size={16} className="text-[var(--palette-amber-400)]" />
                  Your balance: <span className={`font-bold ${canAfford ? "text-[var(--palette-amber-400)]" : "text-[var(--palette-red-400)]"}`}>{coins.toLocaleString()} coins</span>
                  <span className="text-[var(--palette-zinc-600)]">/ {cost.toLocaleString()} needed</span>
                </div>

                <motion.button
                  onClick={() => void handleActivate()}
                  disabled={activating || !canAfford}
                  whileHover={canAfford ? { scale: 1.03 } : {}}
                  whileTap={canAfford ? { scale: 0.97 } : {}}
                  className={`inline-flex items-center gap-2 rounded-xl px-8 py-3 text-base font-bold transition-all ${
                    canAfford
                      ? "bg-gradient-to-r from-[var(--palette-amber-500)] to-[var(--palette-amber-600)] text-[var(--palette-white)] shadow-[0_0_20px_var(--rgba-251-191-36-0_3)] hover:shadow-[0_0_30px_var(--rgba-251-191-36-0_5)]"
                      : "bg-[var(--palette-zinc-800)] text-[var(--palette-zinc-500)] cursor-not-allowed"
                  } disabled:opacity-60`}
                >
                  {activating ? "Activating…" : canAfford ? `👑 Activate for ${cost.toLocaleString()} Coins` : `Need ${(cost - coins).toLocaleString()} more coins`}
                </motion.button>

                {!canAfford && (
                  <p className="text-xs text-[var(--palette-zinc-600)]">Complete focus sessions to earn coins. Each session rewards 25–100 coins.</p>
                )}
                {activateError && (
                  <div className="flex items-center justify-center gap-2 text-[var(--palette-red-400)] text-sm">
                    <AlertTriangle size={14} />
                    {activateError}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* Benefits grid */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--palette-zinc-500)] mb-4">What you unlock</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {BENEFITS.map((b, i) => (
              <motion.div
                key={b.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 + 0.2 }}
                className={`rounded-xl border p-4 flex items-start gap-3 transition-all ${
                  isPremium || activateSuccess
                    ? "border-[var(--palette-amber-500)]/20 bg-[var(--palette-amber-950)]/10"
                    : "border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/30"
                }`}
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isPremium || activateSuccess ? "bg-[var(--palette-amber-500)]/15 text-[var(--palette-amber-400)]" : "bg-[var(--palette-zinc-800)] text-[var(--palette-zinc-500)]"}`}>
                  <b.icon size={16} />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${isPremium || activateSuccess ? "text-[var(--palette-amber-300)]" : "text-[var(--palette-zinc-300)]"}`}>{b.label}</p>
                  <p className="text-xs text-[var(--palette-zinc-500)] mt-0.5">{b.desc}</p>
                </div>
                {(isPremium || activateSuccess) && <CheckCircle size={14} className="shrink-0 ml-auto text-[var(--palette-emerald-500)] mt-0.5" />}
              </motion.div>
            ))}
          </div>
        </div>

        {/* How to earn coins */}
        {!isPremium && !activateSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/30 p-5 space-y-3"
          >
            <p className="text-sm font-semibold text-[var(--palette-zinc-300)]">How to earn coins fast</p>
            <div className="grid gap-2 sm:grid-cols-3 text-xs text-[var(--palette-zinc-500)]">
              {[
                ["🕐 Focus Session", "25–100 coins per session based on duration"],
                ["🔥 Daily Streak", "Bonus coins for maintaining streaks"],
                ["🎯 Missions", "Complete daily & weekly missions"],
                ["🏆 Achievements", "Unlock badges for bonus coin rewards"],
                ["🎁 Daily Reward", "Claim your free daily reward"],
                ["🃏 Loot Boxes", "Open loot boxes for coin drops"],
              ].map(([title, desc]) => (
                <div key={title as string} className="rounded-lg border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/20 p-3">
                  <p className="font-semibold text-[var(--palette-zinc-400)] mb-1">{title}</p>
                  <p>{desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
