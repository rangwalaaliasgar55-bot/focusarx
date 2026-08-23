import { usePremium } from "@/hooks/usePremium";
import { Crown, Lock } from "lucide-react";
import { Link } from "wouter";

/**
 * Wraps a premium-only feature. When the user doesn't have Premium,
 * shows a tasteful upgrade gate instead of the content.
 *
 * ```tsx
 * <PremiumGate feature="AI Coach Pro">
 *   <AiCoachProContent />
 * </PremiumGate>
 * ```
 */
export function PremiumGate({
  feature,
  children,
}: {
  feature: string;
  children: React.ReactNode;
}) {
  const { isPremium, isLoading } = usePremium();

  if (isLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--palette-1a1d27)] border-t-[var(--brand-600)]" />
      </div>
    );
  }

  if (isPremium) return <>{children}</>;

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--palette-amber-500)]/15 to-[var(--palette-amber-600)]/10 mb-5">
        <Lock className="h-7 w-7 text-[var(--palette-amber-400)]" />
      </div>
      <h2 className="text-xl font-bold text-[var(--foreground)] mb-2">
        {feature} is a Premium feature
      </h2>
      <p className="text-sm text-[var(--foreground-muted)] max-w-sm mb-6">
        Unlock FocusArx Premium to access {feature.toLowerCase()} and other exclusive tools.
      </p>
      <Link
        href="/premium"
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--palette-amber-500)] to-[var(--palette-amber-600)] px-6 py-2.5 text-sm font-bold text-[var(--palette-white)] shadow-[0_0_15px_var(--rgba-251-191-36-0_25)] hover:shadow-[0_0_25px_var(--rgba-251-191-36-0_4)] transition-all"
      >
        <Crown className="h-4 w-4" />
        Get Premium
      </Link>
    </div>
  );
}
