import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getToken } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { Zap, Lock, Check, Gift, Crown, Trophy, Clock, Coins, Sparkles, ArrowRight } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";
import { Link } from "wouter";
import { usePremium } from "@/hooks/usePremium";

async function apiFetch(path: string, opts?: RequestInit) {
  const token = getToken();
  const res = await fetch(path, { ...opts, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts?.headers ?? {}) } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function Countdown({ endsAt, graceEndsAt }: { endsAt: string; graceEndsAt?: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const end = new Date(endsAt).getTime();
  const diff = end - now;
  if (diff <= 0) {
    const grace = graceEndsAt ? new Date(graceEndsAt).getTime() - now : 0;
    if (grace > 0) {
      const d = Math.floor(grace / 86400000);
      const h = Math.floor((grace % 86400000) / 3600000);
      return <span className="text-[var(--palette-amber-400)]">Grace period: {d}d {h}h left to claim!</span>;
    }
    return <span className="text-[var(--palette-red-400)]">Season ended</span>;
  }
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return <span>{d}d {h}h {m}m left</span>;
}

export default function BattlePassPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { isPremium } = usePremium();
  const [previewTier, setPreviewTier] = useState<number | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["battle-pass-enhanced"],
    queryFn: () => apiFetch("/api/battle-pass/current"),
    staleTime: 30_000,
  });

  const claimMutation = useMutation({
    mutationFn: ({ tier, isPremiumReward }: { tier: number; isPremiumReward?: boolean }) =>
      apiFetch("/api/battle-pass/claim", { method: "POST", body: JSON.stringify({ tier, isPremiumReward, battlePassId: data?.seasonId }) }),
    onSuccess: (res: any) => {
      if (res.alreadyClaimed) toast("Already claimed", "info");
      else toast(`Claimed! +${res.tokenReward ?? 0} Focus Tokens`, "success");
      qc.invalidateQueries({ queryKey: ["battle-pass-enhanced"] });
    },
    onError: (e: any) => toast(e.message || "Claim failed", "error"),
  });

  const claimAllMutation = useMutation({
    mutationFn: () => apiFetch("/api/battle-pass/claim-all", { method: "POST", body: JSON.stringify({ battlePassId: data?.seasonId }) }),
    onSuccess: (res: any) => {
      toast(`Claimed ${res.claimedCount} rewards!`, "success");
      qc.invalidateQueries({ queryKey: ["battle-pass-enhanced"] });
    },
    onError: (e: any) => toast(e.message, "error"),
  });

  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--brand-600)] border-t-transparent" /></div>;
  if (isError || !data) return <div className="p-8 text-center"><p className="text-sm text-[var(--foreground-muted)]">Battle pass unavailable</p><button onClick={() => void refetch()} className="mt-3 rounded-xl bg-[var(--brand-600)] px-4 py-2 text-xs font-bold text-white">Retry</button></div>;

  const tiers = data.tiers ?? [];
  const currentTier = data.progress?.currentTier ?? 0;
  const seasonXp = data.progress?.seasonXp ?? 0;
  const claimedFree = new Set(data.progress?.claimedFree ?? []);
  const claimedPremium = new Set(data.progress?.claimedPremium ?? []);
  const nextTier = tiers[currentTier];
  const xpForNext = nextTier?.xpRequired ?? seasonXp;
  const xpPrev = currentTier > 0 ? tiers[currentTier - 1]?.xpRequired ?? 0 : 0;
  const progressPct = Math.min(100, Math.round(((seasonXp - xpPrev) / Math.max(1, xpForNext - xpPrev)) * 100));

  return (
    <PageTransition>
      <PageSEO {...PAGE_SEO.battlePass} />
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header with season countdown */}
        <div className="relative overflow-hidden rounded-2xl border border-[var(--palette-amber-500)]/20 bg-gradient-to-br from-[var(--palette-amber-500)]/10 via-[var(--palette-orange-500)]/5 to-[var(--surface-1)] p-6">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_70%_30%,var(--palette-amber-500),transparent_60%)]" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2"><Trophy size={18} className="text-[var(--palette-amber-400)]" /><span className="text-xs font-bold uppercase tracking-widest text-[var(--palette-amber-400)]">Season {data.seasonId}</span><span className="rounded-full bg-[var(--surface-1)] px-2 py-0.5 text-[10px]">{tiers.length} tiers • 28-30 days</span></div>
              <h1 className="mt-2 text-3xl font-semibold">Battle Pass</h1>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--foreground-muted)]"><Clock size={12} /><Countdown endsAt={data.countdown?.endsAt ?? data.endDate} graceEndsAt={data.countdown?.graceEndsAt ?? data.graceEndsAt} /></p>
              {data.inGracePeriod && <p className="mt-1 text-xs font-bold text-[var(--palette-amber-400)]">Grace period active — claim your rewards before they expire!</p>}
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-[var(--foreground-subtle)]">Your progress</p>
              <p className="text-2xl font-semibold">{seasonXp.toLocaleString()} XP</p>
              <p className="text-xs text-[var(--foreground-muted)]">Tier {currentTier} / {tiers.length}</p>
              <div className="mt-2 h-2 w-48 overflow-hidden rounded-full bg-[var(--surface-1)]"><div className="h-full bg-[var(--palette-amber-500)] transition-all" style={{ width: `${progressPct}%` }} /></div>
              <p className="mt-1 text-[10px] text-[var(--foreground-subtle)]">{seasonXp - xpPrev} / {xpForNext - xpPrev} to next tier</p>
            </div>
          </div>

          <div className="relative mt-4 flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--palette-amber-500)]/20 bg-[var(--palette-amber-500)]/10 px-3 py-1 text-xs font-bold text-[var(--palette-amber-400)]"><Coins size={12} /> {data.tokenBalance?.toLocaleString?.() ?? data.tokenBalance ?? 0} Focus Tokens</div>
            {isPremium ? <span className="inline-flex items-center gap-1 rounded-full bg-[var(--palette-amber-500)] px-3 py-1 text-xs font-bold text-white"><Crown size={12}/> Premium active</span> : <Link href="/premium" className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-1)] px-3 py-1 text-xs font-bold text-[var(--foreground-muted)] hover:text-[var(--palette-amber-400)]"><Crown size={12}/> Unlock premium track with tokens</Link>}
            <button onClick={() => claimAllMutation.mutate()} disabled={claimAllMutation.isPending} className="ml-auto inline-flex items-center gap-1 rounded-full bg-[var(--brand-600)] px-4 py-1.5 text-xs font-bold text-white hover:bg-[var(--brand-500)] disabled:opacity-50">
              <Gift size={12}/> Claim all eligible
            </button>
          </div>

          <div className="relative mt-4 rounded-xl border border-[var(--forge-border)] bg-[var(--surface-1)]/80 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--foreground-subtle)]">How to earn Battle Pass XP — no real money, tokens only</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
              <div className="rounded-lg bg-[var(--surface-2)] p-2 text-center">🎯 Focus session<br/><span className="font-bold text-[var(--brand-400)]">+50 XP</span></div>
              <div className="rounded-lg bg-[var(--surface-2)] p-2 text-center">✅ Quest complete<br/><span className="font-bold text-[var(--palette-emerald-400)]">+100 XP</span></div>
              <div className="rounded-lg bg-[var(--surface-2)] p-2 text-center">🔥 Streak bonus<br/><span className="font-bold text-[var(--palette-amber-400)]">+25 XP</span></div>
              <div className="rounded-lg bg-[var(--surface-2)] p-2 text-center">🏆 City upgrade<br/><span className="font-bold text-[var(--palette-violet-400)]">+75 XP</span></div>
            </div>
          </div>
        </div>

        {/* Tiers grid with preview */}
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold">All Tiers — free + premium tracks</h2>
            <p className="text-[11px] text-[var(--foreground-subtle)]">Idempotent claims • Grace period 3 days • Preview on hover</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tiers.map((t: any) => {
              const reached = currentTier >= t.tier;
              const freeClaimed = claimedFree.has(t.tier);
              const premClaimed = claimedPremium.has(t.tier);
              const isMilestone = t.tier % 5 === 0;
              return (
                <div key={t.tier} onMouseEnter={() => setPreviewTier(t.tier)} onMouseLeave={() => setPreviewTier(null)} className={`relative rounded-2xl border p-4 transition-all ${isMilestone ? "border-[var(--palette-amber-500)]/30 bg-[var(--palette-amber-500)]/5" : "border-[var(--forge-border)] bg-[var(--card)]"} ${!reached ? "opacity-60" : ""} ${previewTier === t.tier ? "ring-2 ring-[var(--brand-400)]/20" : ""}`}>
                  {isMilestone && <div className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-[var(--palette-amber-500)] px-2 py-0.5 text-[9px] font-bold text-black">MILESTONE</div>}
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold">Tier {t.tier}</span>
                    <span className="text-[10px] text-[var(--foreground-subtle)]">{t.xpRequired} XP</span>
                    {reached ? <Check size={12} className="text-[var(--palette-emerald-400)]" /> : <Lock size={12} className="text-[var(--foreground-subtle)]" />}
                  </div>
                  {/* Free */}
                  <div className={`mb-2 flex items-center gap-2 rounded-xl p-2.5 ${reached ? "bg-[var(--palette-emerald-500)]/10 border border-[var(--palette-emerald-500)]/20" : "bg-[var(--surface-1)]"}`}>
                    <Gift size={14} className="text-[var(--palette-emerald-400)]" />
                    <div className="flex-1">
                      <p className="text-[10px] font-bold uppercase text-[var(--foreground-subtle)]">Free</p>
                      <p className="text-xs font-semibold">{t.freeReward?.label ?? `${t.freeReward?.coins ?? 0} coins`}</p>
                      {t.freeReward?.tokenAmount && <p className="text-[10px] text-[var(--palette-amber-400)]">🪙 {t.freeReward.tokenAmount} tokens</p>}
                    </div>
                    {reached && !freeClaimed ? <button onClick={() => claimMutation.mutate({ tier: t.tier })} className="rounded-full bg-[var(--palette-emerald-500)] px-3 py-1 text-[10px] font-bold text-black">Claim</button> : freeClaimed ? <Check size={14} className="text-[var(--palette-emerald-400)]" /> : null}
                  </div>
                  {/* Premium */}
                  <div className={`flex items-center gap-2 rounded-xl p-2.5 ${isPremium ? (reached ? "bg-[var(--palette-amber-500)]/10 border border-[var(--palette-amber-500)]/20" : "bg-[var(--surface-1)]") : "bg-[var(--surface-1)] opacity-60"}`}>
                    <Crown size={14} className="text-[var(--palette-amber-400)]" />
                    <div className="flex-1">
                      <p className="text-[10px] font-bold uppercase text-[var(--foreground-subtle)]">Premium</p>
                      <p className="text-xs font-semibold">{t.premiumReward?.label ?? `${t.premiumReward?.coins ?? 0} coins`}</p>
                      {t.premiumReward?.tokenAmount && <p className="text-[10px] text-[var(--palette-amber-400)]">🪙 {t.premiumReward.tokenAmount} tokens {t.premiumReward?.cosmeticId ? "• Cosmetic" : ""} {t.premiumReward?.petId ? "• Pet" : ""}</p>}
                    </div>
                    {isPremium ? (reached && !premClaimed ? <button onClick={() => claimMutation.mutate({ tier: t.tier, isPremiumReward: true })} className="rounded-full bg-[var(--palette-amber-500)] px-3 py-1 text-[10px] font-bold text-black">Claim</button> : premClaimed ? <Check size={14} className="text-[var(--palette-emerald-400)]" /> : null) : <Lock size={12} className="text-[var(--foreground-subtle)]" />}
                  </div>
                  {!isPremium && reached && <Link href="/premium" className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl bg-[var(--surface-1)] py-1.5 text-[10px] font-bold text-[var(--palette-amber-400)]"><Crown size={10}/> Unlock premium track with tokens</Link>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Season builder note for admin */}
        <div className="mt-8 rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-bold"><Sparkles size={14}/> Admin Builder (draft/preview/publish/rollback)</h3>
          <p className="mt-1 text-xs text-[var(--foreground-muted)]">Admins can create 28-30d seasons with 30-50 tiers, free+premium tracks, token-only unlock, no real-money. Builder supports draft → preview → publish → rollback with audit.</p>
          <Link href="/admin" className="mt-3 inline-flex items-center gap-1 rounded-full bg-[var(--surface-1)] px-4 py-2 text-xs font-bold">Go to Admin <ArrowRight size={12}/></Link>
        </div>
      </div>
    </PageTransition>
  );
}
