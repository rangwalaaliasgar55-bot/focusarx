import { usePremium } from "@/hooks/usePremium";
import { Crown, Lock, Coins, Flame, Target, Trophy, Gift } from "lucide-react";
import { Link } from "wouter";

/**
 * Wraps a premium-only feature. When the user doesn't have Premium,
 * shows a tasteful upgrade gate instead of the content.
 * Blocks AI model load and AI requests when not premium.
 * Shows cost/balance/earn actions per spec.
 */
export function PremiumGate({
  feature,
  children,
  description,
}: {
  feature: string;
  children: React.ReactNode;
  description?: string;
}) {
  const { isPremium, isLoading, balance, cheapestCost } = usePremium();

  if (isLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--palette-1a1d27)] border-t-[var(--brand-600)]" />
      </div>
    );
  }

  if (isPremium) return <>{children}</>;

  const needed = Math.max(0, cheapestCost - balance);
  const canAfford = balance >= cheapestCost;

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center py-12">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-[var(--palette-amber-500)]/20 to-[var(--palette-amber-600)]/10 mb-6 ring-1 ring-[var(--palette-amber-500)]/20">
        <Lock className="h-8 w-8 text-[var(--palette-amber-400)]" />
      </div>
      <h2 className="text-2xl font-black tracking-tight text-[var(--foreground)] mb-2">
        {feature} is Premium
      </h2>
      <p className="text-sm text-[var(--foreground-muted)] max-w-md mb-6 leading-relaxed">
        {description ?? `Unlock FocusArx Premium to access ${feature.toLowerCase()} and other exclusive tools. No real-money payments — earn Focus Tokens through focus.`}
      </p>

      {/* Cost / balance card */}
      <div className="w-full max-w-sm rounded-2xl border border-[var(--rgba-255-255-255-0_08)] bg-[var(--rgba-255-255-255-0_03)] p-4 mb-6 text-left">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-[var(--foreground-subtle)] uppercase tracking-wide">Your Balance</span>
          <span className="flex items-center gap-1 text-sm font-bold text-[var(--foreground)]"><Coins size={14} className="text-[var(--brand-400)]" /> {balance.toLocaleString()} Tokens</span>
        </div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-[var(--foreground-subtle)] uppercase tracking-wide">Premium Cost</span>
          <span className="text-sm font-bold text-[var(--palette-amber-400)]">{cheapestCost.toLocaleString()} Tokens (30d)</span>
        </div>
        {!canAfford && (
          <div className="rounded-xl bg-[var(--warning-soft)] border border-[var(--warning)]/20 px-3 py-2 text-xs text-[var(--warning)]">
            Need {needed.toLocaleString()} more tokens to unlock
          </div>
        )}
        {canAfford && (
          <div className="rounded-xl bg-[var(--success-soft)] border border-[var(--success)]/20 px-3 py-2 text-xs text-[var(--success)]">
            You can unlock now! 🎉
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
        <Link
          href="/premium"
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--palette-amber-500)] to-[var(--palette-amber-600)] px-6 py-3 text-sm font-bold text-white shadow-[0_0_15px_var(--rgba-251-191-36-0_25)] hover:shadow-[0_0_25px_var(--rgba-251-191-36-0_4)] transition-all min-h-[44px]"
        >
          <Crown className="h-4 w-4" />
          {canAfford ? "Unlock Premium" : "View Premium"}
        </Link>
        <Link
          href="/quests"
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--rgba-255-255-255-0_10)] bg-[var(--rgba-255-255-255-0_04)] px-6 py-3 text-sm font-semibold text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors min-h-[44px]"
        >
          <Gift className="h-4 w-4" />
          Earn Tokens
        </Link>
      </div>

      {/* Earn actions */}
      <div className="mt-8 w-full max-w-sm">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--foreground-subtle)] mb-3 text-left">How to earn Focus Tokens</p>
        <div className="grid grid-cols-3 gap-2">
          <Link href="/focus" className="rounded-xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_02)] p-3 hover:bg-[var(--rgba-255-255-255-0_05)] transition-colors">
            <Flame size={18} className="mx-auto mb-1 text-[var(--palette-f97316)]" />
            <p className="text-[11px] font-semibold text-[var(--foreground-muted)]">Focus 25m+</p>
            <p className="text-[10px] text-[var(--brand-400)] font-bold">+50</p>
          </Link>
          <Link href="/quests" className="rounded-xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_02)] p-3 hover:bg-[var(--rgba-255-255-255-0_05)] transition-colors">
            <Target size={18} className="mx-auto mb-1 text-[var(--palette-22d387)]" />
            <p className="text-[11px] font-semibold text-[var(--foreground-muted)]">Daily Quest</p>
            <p className="text-[10px] text-[var(--brand-400)] font-bold">+30</p>
          </Link>
          <Link href="/dashboard" className="rounded-xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_02)] p-3 hover:bg-[var(--rgba-255-255-255-0_05)] transition-colors">
            <Trophy size={18} className="mx-auto mb-1 text-[var(--palette-amber-400)]" />
            <p className="text-[11px] font-semibold text-[var(--foreground-muted)]">Streaks & BP</p>
            <p className="text-[10px] text-[var(--brand-400)] font-bold">+20-100</p>
          </Link>
        </div>
        <p className="mt-3 text-[11px] text-[var(--foreground-subtle)] text-center">No real-money. Premium is unlocked purely with earned tokens.</p>
      </div>
    </div>
  );
}
