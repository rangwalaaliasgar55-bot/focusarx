import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crown,
  Zap,
  Star,
  Gift,
  BarChart2,
  Brain,
  CheckCircle,
  Coins,
  AlertTriangle,
  Clock,
  History,
  Timer,
  Palette,
  Target,
} from "lucide-react";
import { getToken } from "@/lib/auth";
import { PageSEO } from "@/components/PageSEO";
import StripeCheckoutCard from "@/components/StripeCheckoutCard";
import { Link } from "wouter";

async function apiFetch(url: string, opts?: RequestInit) {
  const token = getToken();
  const res = await fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json", ...(opts?.headers as any) },
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({ error: "Error" }));
    throw new Error(j.error ?? "Request failed");
  }
  return res.json();
}

const BENEFITS = [
  { icon: Brain, label: "AI Focus Coach", desc: "Personalized plans, session analysis, weekly summaries, distraction patterns" },
  { icon: Timer, label: "Premium Timer Rituals", desc: "Unlimited presets, 10-180min sessions, full-screen focus, ambient mixing, intentions" },
  { icon: BarChart2, label: "Advanced Analytics", desc: "Full history, best hours, streak consistency, export, premium charts" },
  { icon: Palette, label: "Premium Focus City", desc: "Night/sunset modes, weather, seasonal decor, premium buildings, private districts" },
  { icon: Star, label: "Premium Profile", desc: "Avatar frames, animated nameplates, backgrounds, aura, streak effects" },
  { icon: Zap, label: "Premium Convenience", desc: "More pets, presets, private rooms, daily quests, recovery tokens" },
  { icon: Gift, label: "Exclusive Pets & Cosmetics", desc: "Rare legendary companions, skins, accessories" },
  { icon: Crown, label: "Premium Battle Pass", desc: "Unlock premium reward track, exclusive pet near end" },
];

export default function PremiumPage() {
  const qc = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<any>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>("");

  const { data: status, isLoading } = useQuery({
    queryKey: ["premium-status"],
    queryFn: () => apiFetch("/api/premium/status"),
    staleTime: 30_000,
  });

  const { data: wallet } = useQuery({
    queryKey: ["wallet"],
    queryFn: () => apiFetch("/api/gamification/wallet"),
    staleTime: 30_000,
  });

  const { data: ledgerData } = useQuery({
    queryKey: ["premium-ledger"],
    queryFn: () => apiFetch("/api/premium/ledger?limit=10"),
    staleTime: 60_000,
  });

  const balance: number = status?.balance ?? wallet?.coins ?? 0;
  const isPremium: boolean = status?.isPremium ?? false;
  const expiresAt: string | null = status?.expiresAt ?? null;
  const plans: any[] = status?.plans ?? [];
  const entitlements: any[] = status?.entitlements ?? [];
  const cheapest = plans.sort((a, b) => a.tokenCost - b.tokenCost)[0];

  const selected = plans.find((p) => p.id === selectedPlan || p.slug === selectedPlan) ?? cheapest;

  const canAffordSelected = selected ? balance >= selected.tokenCost : false;
  const needed = selected ? Math.max(0, selected.tokenCost - balance) : 0;

  // Expiring soon warning
  const daysLeft = expiresAt ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const expiringSoon = daysLeft !== null && daysLeft <= 3 && daysLeft > 0;

  const handlePurchaseClick = (planId: string) => {
    setSelectedPlan(planId);
    const key = `premium_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setIdempotencyKey(key);
    setShowConfirm(true);
    setError(null);
  };

  const handleConfirmPurchase = async () => {
    if (!selected) return;
    setActivating(true);
    setError(null);
    try {
      const res = await apiFetch("/api/premium/purchase", {
        method: "POST",
        body: JSON.stringify({ planId: selected.id, idempotencyKey }),
      });
      setSuccess(res);
      setShowConfirm(false);
      qc.invalidateQueries({ queryKey: ["premium-status"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["premium-ledger"] });
    } catch (e: any) {
      setError(e.message ?? "Failed to purchase");
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="min-h-[100dvh] px-4 py-6 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <PageSEO
        title="Premium Membership — Unlock with Focus Tokens | FocusArx"
        description="Unlock Premium access using Focus Tokens earned through productivity. AI coach, advanced analytics, premium Focus City, exclusive pets, and more."
        canonical="/premium"
      />
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Crown className="text-[var(--palette-amber-400)]" /> Premium Membership
            </h1>
            <p className="mt-1 text-sm text-[var(--foreground-muted)]">
              Unlock with <span className="font-semibold text-[var(--brand-400)]">Focus Tokens</span> — no real-money payments. Earn tokens through focus.
            </p>
          </div>
          <Link href="/dashboard" className="text-xs font-medium text-[var(--brand-400)] hover:underline">
            ← Dashboard
          </Link>
        </div>

        <StripeCheckoutCard />

        {/* Current status */}
        {isLoading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-[var(--surface-1)]" />
        ) : isPremium ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border p-5 ${expiringSoon ? "border-[var(--warning)]/30 bg-[var(--warning-soft)]" : "border-[var(--success)]/30 bg-[var(--success-soft)]"}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className={`grid h-10 w-10 place-items-center rounded-xl ${expiringSoon ? "bg-[var(--warning)]/20 text-[var(--warning)]" : "bg-[var(--success)]/20 text-[var(--success)]"}`}>
                  {expiringSoon ? <Clock size={20} /> : <CheckCircle size={20} />}
                </span>
                <div>
                  <p className={`text-sm font-bold ${expiringSoon ? "text-[var(--warning)]" : "text-[var(--success)]"}`}>
                    {expiringSoon ? "Premium expiring soon" : "Premium Active"} 👑
                  </p>
                  {expiresAt && (
                    <p className="text-xs text-[var(--foreground-muted)]">
                      {expiringSoon
                        ? `Expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"} — ${new Date(expiresAt).toLocaleDateString()}`
                        : `Active until ${new Date(expiresAt).toLocaleDateString()} • ${daysLeft} days left`}
                    </p>
                  )}
                </div>
              </div>
              <span className="rounded-full bg-[var(--surface-1)] px-3 py-1 text-xs font-bold">
                {status?.activatedAt ? `Since ${new Date(status.activatedAt).toLocaleDateString()}` : ""}
              </span>
            </div>
            {expiringSoon && (
              <div className="mt-4 flex flex-wrap gap-2">
                <p className="w-full text-xs text-[var(--foreground-muted)]">Renew now to keep your premium features without interruption.</p>
                {plans.slice(0, 2).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handlePurchaseClick(p.id)}
                    className="min-h-[44px] rounded-full bg-[var(--brand-600)] px-5 text-xs font-bold text-white"
                  >
                    Renew {p.durationDays}d for {p.tokenCost.toLocaleString()} tokens
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand-500)]">
                <Coins size={20} />
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold">Your Focus Tokens</p>
                <p className="text-xs text-[var(--foreground-muted)]">
                  <span className="font-bold tabular-nums text-[var(--brand-400)]">{balance.toLocaleString()}</span> tokens available
                  {selected && !canAffordSelected && (
                    <span className="ml-2 text-[var(--danger)]">• Need {needed.toLocaleString()} more for {selected.name}</span>
                  )}
                </p>
              </div>
              <Link href="/quests" className="min-h-[36px] rounded-full border border-[var(--border-subtle)] bg-[var(--surface-hover)] px-4 py-2 text-xs font-semibold">
                Earn tokens
              </Link>
            </div>
          </motion.div>
        )}

        {/* Plans */}
        <div>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-[var(--foreground-subtle)]">Choose your membership</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {plans.map((plan, i) => {
              const afford = balance >= plan.tokenCost;
              const isSelected = selectedPlan === plan.id || (!selectedPlan && i === 0);
              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`relative flex flex-col rounded-2xl border p-5 transition-all ${
                    isSelected ? "border-[var(--brand-500)] bg-[var(--brand-soft)] shadow-[var(--shadow-violet-sm)]" : "border-[var(--border-subtle)] bg-[var(--surface-1)] hover:border-[var(--border-strong)]"
                  } ${plan.slug === "premium_90" ? "ring-1 ring-[var(--brand-400)]/20" : ""}`}
                >
                  {plan.slug === "premium_90" && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-[var(--brand-600)] px-2.5 py-0.5 text-[10px] font-bold text-white">Best Value</span>
                  )}
                  {plan.slug === "premium_365" && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-[var(--palette-amber-500)] px-2.5 py-0.5 text-[10px] font-bold text-white">Save 33%</span>
                  )}
                  <h3 className="text-sm font-bold">{plan.name}</h3>
                  <p className="mt-1 text-xs text-[var(--foreground-muted)]">{plan.description}</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-2xl font-semibold tabular-nums">{plan.tokenCost.toLocaleString()}</span>
                    <span className="text-xs text-[var(--foreground-subtle)]">tokens</span>
                  </div>
                  <p className="text-xs text-[var(--foreground-subtle)]">{plan.durationDays} days • {(plan.tokenCost / plan.durationDays).toFixed(0)} tokens/day</p>

                  <div className="mt-4 flex-1 space-y-1.5">
                    {(plan.benefits ?? []).slice(0, 4).map((b: string) => (
                      <div key={b} className="flex items-center gap-1.5 text-[11px] text-[var(--foreground-muted)]">
                        <CheckCircle size={12} className="text-[var(--success)]" />
                        {b.replace(/_/g, " ")}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => handlePurchaseClick(plan.id)}
                    disabled={activating}
                    className={`mt-5 min-h-[44px] w-full rounded-full px-4 py-2.5 text-sm font-bold transition-transform active:scale-[0.98] ${
                      isPremium ? "bg-[var(--surface-hover)] text-[var(--foreground-muted)]" : afford ? "bg-[var(--brand-600)] text-white shadow-[var(--shadow-violet-sm)]" : "bg-[var(--surface-hover)] text-[var(--foreground-subtle)]"
                    }`}
                  >
                    {isPremium ? "Extend membership" : afford ? `Unlock for ${plan.tokenCost.toLocaleString()} tokens` : `Need ${(plan.tokenCost - balance).toLocaleString()} more`}
                  </button>
                </motion.div>
              );
            })}
          </div>
          {plans.length === 0 && !isLoading && (
            <div className="rounded-xl border border-dashed border-[var(--border-subtle)] p-6 text-center text-sm text-[var(--foreground-muted)]">
              No premium plans configured yet. Admins can create plans in Admin → Premium.
            </div>
          )}
        </div>

        {/* Benefits comparison */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-[var(--foreground-subtle)]">Premium benefits</h3>
            <div className="grid gap-2">
              {BENEFITS.map((b) => (
                <div key={b.label} className="flex items-start gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand-500)]">
                    <b.icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{b.label}</p>
                    <p className="mt-0.5 text-xs leading-snug text-[var(--foreground-muted)]">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {/* How to earn tokens */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Target size={16} className="text-[var(--brand-400)]" /> How to earn Focus Tokens
              </h3>
              <div className="mt-3 grid gap-2 text-xs">
                {[
                  ["🎯 Focus Session", "50 tokens per 25min+ session (max 500/day)"],
                  ["🔥 Streak", "20 tokens/day for maintaining streak"],
                  ["📋 Daily Quest", "30 tokens per quest (max 150/day)"],
                  ["📅 Weekly Quest", "100 tokens per weekly quest"],
                  ["🏆 Achievement", "50 tokens per badge unlock"],
                  ["🎁 Daily Reward", "25 tokens daily"],
                  ["👥 Referral", "200 tokens per invited friend"],
                  ["🌟 Battle Pass", "50 tokens per tier"],
                ].map(([title, desc]) => (
                  <div key={title as string} className="flex justify-between gap-2 rounded-lg bg-[var(--surface-hover)] px-3 py-2">
                    <span className="font-medium">{title}</span>
                    <span className="text-[var(--foreground-subtle)]">{desc}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-[var(--foreground-subtle)]">No real-money payments. Premium is unlocked purely through productivity.</p>
            </div>

            {/* Free vs Premium */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5">
              <h3 className="text-sm font-semibold">Free vs Premium</h3>
              <div className="mt-3 space-y-2 text-xs">
                <div className="grid grid-cols-3 gap-2 font-bold text-[var(--foreground-subtle)] uppercase tracking-widest">
                  <span>Feature</span>
                  <span>Free</span>
                  <span>Premium</span>
                </div>
                {[
                  ["Focus Timer", "Standard presets", "Unlimited 10-180min, rituals, full-screen"],
                  ["AI Coach", "Locked", "Full access + weekly summaries"],
                  ["Analytics", "Basic history", "Full history, best hours, export"],
                  ["Focus City", "Starter", "Night/sunset, weather, premium buildings"],
                  ["Pets", "1 active", "Multiple, exclusive, accessories"],
                  ["Battle Pass", "Free track", "Free + Premium track"],
                  ["Profile", "Standard", "Frames, nameplates, aura, effects"],
                ].map(([feat, free, prem]) => (
                  <div key={feat as string} className="grid grid-cols-3 gap-2 rounded-lg bg-[var(--surface-hover)] px-3 py-2">
                    <span className="font-medium">{feat}</span>
                    <span className="text-[var(--foreground-subtle)]">{free}</span>
                    <span className="text-[var(--brand-400)] font-medium">{prem}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Purchase history */}
            {entitlements.length > 0 && (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <History size={16} /> Purchase history
                </h3>
                <div className="mt-3 space-y-2">
                  {entitlements.slice(0, 5).map((e: any) => (
                    <div key={e.id} className="flex items-center justify-between rounded-lg bg-[var(--surface-hover)] px-3 py-2 text-xs">
                      <div>
                        <p className="font-medium">
                          {e.planId ? plans.find((p) => p.id === e.planId)?.name ?? "Premium" : "Premium (Admin grant)"} • {e.tokenCost ? `${e.tokenCost} tokens` : "Granted"}
                        </p>
                        <p className="text-[var(--foreground-subtle)]">
                          {new Date(e.startsAt).toLocaleDateString()} → {new Date(e.endsAt).toLocaleDateString()} • {e.status}
                        </p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${e.status === "active" ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--surface-1)] text-[var(--foreground-subtle)]"}`}>
                        {e.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Token ledger recent */}
        {ledgerData?.entries && ledgerData.entries.length > 0 && (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Coins size={16} /> Recent token activity
            </h3>
            <div className="mt-3 space-y-1">
              {ledgerData.entries.slice(0, 8).map((entry: any) => (
                <div key={entry.id} className="flex items-center justify-between rounded-lg px-3 py-2 text-xs hover:bg-[var(--surface-hover)]">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{entry.source.replace(/_/g, " ")} • {entry.transactionType}</p>
                    <p className="text-[var(--foreground-subtle)]">{new Date(entry.createdAt).toLocaleString()}</p>
                  </div>
                  <span className={`font-bold tabular-nums ${entry.amount > 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                    {entry.amount > 0 ? "+" : ""}{entry.amount} • {entry.balanceAfter} total
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Confirmation modal */}
      <AnimatePresence>
        {showConfirm && selected && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[var(--z-modal)] bg-black/60 backdrop-blur-sm" onClick={() => setShowConfirm(false)} />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[var(--z-modal)] rounded-[1.5rem] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6 shadow-2xl md:left-1/2 md:top-1/2 md:bottom-auto md:w-full md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2"
              role="dialog"
              aria-modal="true"
            >
              <h3 className="text-lg font-bold">Confirm Premium unlock?</h3>
              <p className="mt-2 text-sm text-[var(--foreground-muted)]">
                You are about to unlock <span className="font-semibold text-[var(--foreground)]">{selected.name}</span> for <span className="font-bold text-[var(--brand-400)]">{selected.tokenCost.toLocaleString()} Focus Tokens</span>.
              </p>

              <div className="mt-4 rounded-xl bg-[var(--surface-hover)] p-4 text-xs space-y-2">
                <div className="flex justify-between"><span>Current balance</span><span className="font-bold tabular-nums">{balance.toLocaleString()} tokens</span></div>
                <div className="flex justify-between"><span>Cost</span><span className="font-bold tabular-nums">{selected.tokenCost.toLocaleString()} tokens</span></div>
                <div className="flex justify-between border-t border-[var(--border-subtle)] pt-2 font-bold"><span>Balance after</span><span className="tabular-nums">{(balance - selected.tokenCost).toLocaleString()} tokens</span></div>
                <div className="flex justify-between"><span>Duration</span><span>{selected.durationDays} days</span></div>
                <div className="flex justify-between"><span>Expires</span><span>{new Date(Date.now() + selected.durationDays * 86400000).toLocaleDateString()}</span></div>
              </div>

              {!canAffordSelected && (
                <div className="mt-4 flex items-center gap-2 rounded-lg bg-[var(--danger-soft)] px-3 py-2.5 text-xs text-[var(--danger)]">
                  <AlertTriangle size={14} />
                  You need {needed.toLocaleString()} more tokens. Complete quests and focus sessions to earn.
                </div>
              )}

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  className="min-h-[44px] flex-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-hover)] px-4 py-2.5 text-sm font-medium"
                  disabled={activating}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmPurchase()}
                  disabled={activating || !canAffordSelected}
                  className="min-h-[44px] flex-1 rounded-full bg-[var(--brand-600)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {activating ? "Processing…" : `Unlock for ${selected.tokenCost.toLocaleString()} tokens`}
                </button>
              </div>

              {error && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-[var(--danger)]" role="alert">
                  <AlertTriangle size={12} />
                  {error}
                </p>
              )}

              <p className="mt-3 text-[11px] text-[var(--foreground-subtle)]">No real-money charge. Tokens are deducted atomically with idempotency protection. No auto-renewal without confirmation.</p>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Success */}
      <AnimatePresence>
        {success && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="w-full max-w-sm rounded-[1.5rem] bg-[var(--surface-1)] p-6 text-center shadow-2xl">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--success-soft)] text-[var(--success)]">
                <CheckCircle size={28} />
              </div>
              <h3 className="mt-4 text-lg font-bold">Premium unlocked! 👑</h3>
              <p className="mt-1 text-sm text-[var(--foreground-muted)]">Active until {new Date(success.expiresAt ?? success.entitlement?.endsAt).toLocaleDateString()}</p>
              <div className="mt-4 flex justify-center gap-2">
                <Link href="/" className="min-h-[44px] rounded-full bg-[var(--brand-600)] px-5 py-2.5 text-sm font-bold text-white">
                  Start focusing
                </Link>
                <button onClick={() => setSuccess(null)} className="min-h-[44px] rounded-full border border-[var(--border-subtle)] px-5 py-2.5 text-sm font-medium">
                  Continue
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
