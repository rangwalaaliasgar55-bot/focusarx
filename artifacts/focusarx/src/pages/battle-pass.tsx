import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getToken } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { Zap, Lock, Check, Gift, Crown, Trophy, ArrowRight } from "lucide-react";
import { BattlePassTier, BattlePassData } from "@/types/gamification";

async function apiFetch(path: string, opts?: RequestInit) {
  const token = getToken();
  const res = await fetch(path, { ...opts, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts?.headers ?? {}) } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function ProgressBar({ value, max, color = "var(--brand-600)" }: { value: number; max: number; color?: string }) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  return (
    <div className="h-2 rounded-full bg-[var(--rgba-255-255-255-0_06)] overflow-hidden">
      <div className="h-full rounded-full transition-all duration-[var(--duration-slow)]" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

function TierCard({ tier, claimed, reached, premiumUnlocked, onClaim }: {
  tier: BattlePassTier;
  claimed: number[];
  reached: boolean;
  premiumUnlocked: boolean;
  onClaim: (tier: number, track: "free" | "premium") => void
}) {
  const isMilestone = tier.tier % 5 === 0;
  const freeClaimedThis = claimed.includes(tier.tier);
  const premiumClaimedThis = claimed.includes(tier.tier + 100); // premium tiers use offset IDs in claimedTiers

  return (
    <div className={`relative rounded-2xl border p-3 transition-all ${isMilestone ? "border-[var(--palette-amber-500)]/40 bg-[var(--palette-amber-500)]/5" : "border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_025)]"} ${!reached ? "opacity-40" : ""}`}>
      {isMilestone && <div className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-[var(--palette-amber-500)] text-[var(--palette-black)] text-[9px] font-bold px-2 py-0.5">MILESTONE</div>}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-[var(--foreground-subtle)]">Tier {tier.tier}</span>
        {reached ? <Check size={12} className="text-[var(--palette-emerald-400)]" /> : <Lock size={12} className="text-[var(--foreground-subtle)]" />}
      </div>
      <div className="space-y-2">
        {/* Free track */}
        <div className={`flex items-center gap-2 rounded-lg p-2 ${reached && !freeClaimedThis ? "bg-[var(--palette-emerald-500)]/10 border border-[var(--palette-emerald-500)]/20" : "bg-[var(--rgba-255-255-255-0_02)]"}`}>
          <Gift size={14} className="text-[var(--palette-emerald-400)] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-[var(--foreground-subtle)]">FREE</p>
            <p className="text-xs font-semibold text-[var(--foreground)]">+{tier.freeReward.value} {tier.freeReward.type}</p>
          </div>
          {reached && !freeClaimedThis && (
            <button onClick={() => onClaim(tier.tier, "free")} className="rounded-lg bg-[var(--palette-emerald-500)] text-[var(--palette-black)] px-2 py-1 text-[9px] font-bold hover:bg-[var(--palette-emerald-400)]">CLAIM</button>
          )}
          {freeClaimedThis && <Check size={12} className="text-[var(--palette-emerald-400)] shrink-0" />}
        </div>
        {/* Premium track */}
        <div className={`flex items-center gap-2 rounded-lg p-2 ${premiumUnlocked ? "bg-[var(--palette-amber-500)]/10 border border-[var(--palette-amber-500)]/20" : "bg-[var(--rgba-255-255-255-0_02)] opacity-50"}`}>
          <Crown size={14} className="text-[var(--palette-amber-400)] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-[var(--foreground-subtle)]">PREMIUM</p>
            <p className="text-xs font-semibold text-[var(--foreground)]">+{tier.premiumReward.value} {tier.premiumReward.type}</p>
          </div>
          {premiumUnlocked && reached && !premiumClaimedThis && <button onClick={() => onClaim(tier.tier, "premium")} className="rounded-lg bg-[var(--palette-amber-500)] text-[var(--palette-black)] px-2 py-1 text-[9px] font-bold hover:bg-[var(--palette-amber-400)]">CLAIM</button>}
          {premiumClaimedThis && <Check size={12} className="text-[var(--palette-emerald-400)] shrink-0" />}
          {!premiumUnlocked && <Lock size={11} className="text-[var(--foreground-subtle)]" />}
        </div>
      </div>
    </div>
  );
}

export default function BattlePassPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<BattlePassData & { tier: number, seasonXp: number, nextTierXp: number, claimedTiers: number[], season: number }>({
    queryKey: ["battle-pass"],
    queryFn: () => apiFetch("/api/retention/battle-pass"),
    staleTime: 30_000,
  });

  const claimTier = useMutation({
    mutationFn: ({ tier, track }: { tier: number; track: "free" | "premium" }) =>
      apiFetch("/api/retention/battle-pass/claim", { method: "POST", body: JSON.stringify({ tier, track }) }),
    onSuccess: (res: any) => {
      toast(`Claimed! +${res.reward.coins} coins, +${res.reward.xp} XP`, "success");
      qc.invalidateQueries({ queryKey: ["battle-pass"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e: any) => toast(e.message, "error"),
  });

  if (isLoading) return <div className="flex justify-center items-center min-h-screen"><div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--rgba-255-255-255-0_06)] border-t-[var(--brand-600)]" /></div>;

  const tiers = data?.tiers ?? [];
  const currentTier = data?.tier ?? 0;
  const seasonXp = data?.seasonXp ?? 0;
  const nextTierXp = data?.nextTierXp ?? 200;
  const claimedTiers = data?.claimedTiers ?? [];
  const premiumUnlocked = data?.premiumUnlocked ?? false;
  const xpProgress = currentTier > 0 ? tiers[currentTier - 1]?.xpRequired ?? 0 : 0;
  const xpForNext = tiers[currentTier]?.xpRequired ?? nextTierXp;

  return (
    <div className="min-h-screen bg-[var(--rgba-255-255-255-0_02)] text-[var(--foreground)] p-4 sm:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="relative rounded-2xl border border-[var(--palette-amber-500)]/30 bg-gradient-to-br from-[var(--palette-amber-500)]/10 to-[var(--palette-orange-500)]/5 p-6 mb-6 overflow-hidden">
        <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_70%_50%,_var(--color-warning),_transparent)]" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-1"><Trophy size={20} className="text-[var(--palette-amber-400)]" /><span className="text-xs font-bold uppercase tracking-widest text-[var(--palette-amber-400)]">Season {data?.season ?? 1}</span></div>
          <h1 className="text-3xl font-black text-[var(--foreground)]">Battle Pass</h1>
          <p className="text-sm text-[var(--foreground-subtle)] mt-1">Earn XP, unlock rewards. Ends {data?.endsAt ?? "Sep 30"}</p>
          <div className="mt-4">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-[var(--foreground-subtle)]">Tier {currentTier} → {currentTier + 1}</span>
              <span className="text-[var(--palette-amber-400)] font-semibold">{seasonXp.toLocaleString()} / {xpForNext.toLocaleString()} XP</span>
            </div>
            <ProgressBar value={seasonXp - xpProgress} max={xpForNext - xpProgress} color="var(--color-warning)" />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full border border-[var(--palette-amber-500)]/30 bg-[var(--palette-amber-500)]/10 px-3 py-1"><Zap size={12} className="text-[var(--palette-amber-400)]" /><span className="text-xs font-bold text-[var(--palette-amber-400)]">Tier {currentTier} / 50</span></div>
            {!premiumUnlocked && (
              <button className="flex items-center gap-1.5 rounded-full border border-[var(--palette-amber-500)]/50 bg-[var(--palette-amber-500)]/20 px-3 py-1 text-xs font-bold text-[var(--palette-amber-400)] hover:bg-[var(--palette-amber-500)]/30 transition-colors">
                <Crown size={12} /> Upgrade Premium
              </button>
            )}
            {premiumUnlocked && <div className="flex items-center gap-1.5 rounded-full border border-[var(--palette-amber-500)]/50 bg-[var(--palette-amber-500)]/20 px-3 py-1 text-xs font-bold text-[var(--palette-amber-400)]"><Crown size={12} /> Premium Active</div>}
          </div>
        </div>
      </div>

      {/* How to earn XP */}
      <div className="rounded-xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_025)] p-4 mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--foreground-subtle)] mb-2">Earn Battle Pass XP</p>
        <div className="grid grid-cols-3 gap-2 text-xs">
          {[["🎯", "Focus session", "+50 XP"], ["✅", "Task done", "+25 XP"], ["🔥", "Daily mission", "+100 XP"]].map(([icon, label, xp]) => (
            <div key={label} className="rounded-lg bg-[var(--rgba-255-255-255-0_02)] p-2 text-center">
              <div className="text-xl mb-1">{icon}</div>
              <p className="text-[var(--foreground-subtle)] text-[10px]">{label}</p>
              <p className="text-[var(--palette-emerald-400)] font-bold">{xp}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tiers grid */}
      <div>
        <p className="text-sm font-semibold text-[var(--foreground)] mb-3">All Tiers <span className="text-[var(--foreground-subtle)] font-normal">(50 total)</span></p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {tiers.map((t) => (
            <TierCard
              key={t.tier}
              tier={t}
              claimed={claimedTiers}
              reached={currentTier >= t.tier}
              premiumUnlocked={premiumUnlocked}
              onClaim={(tierNum, track) => claimTier.mutate({ tier: tierNum, track })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
