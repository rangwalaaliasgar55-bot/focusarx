import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getToken } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { Zap, Lock, Check, Gift, Crown, Trophy, ArrowRight } from "lucide-react";

async function apiFetch(path: string, opts?: RequestInit) {
  const token = getToken();
  const res = await fetch(path, { ...opts, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts?.headers ?? {}) } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function ProgressBar({ value, max, color = "#7C3AED" }: { value: number; max: number; color?: string }) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  return (
    <div className="h-2 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

function TierCard({ tier, claimed, reached, premiumUnlocked, onClaim }: { tier: any; claimed: number[]; reached: boolean; premiumUnlocked: boolean; onClaim: (tier: number, track: "free" | "premium") => void }) {
  const isMilestone = tier.tier % 5 === 0;
  const freeClaimedThis = claimed.includes(tier.tier) && true;
  return (
    <div className={`relative rounded-2xl border p-3 transition-all ${isMilestone ? "border-amber-500/40 bg-amber-500/5" : "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)]"} ${!reached ? "opacity-40" : ""}`}>
      {isMilestone && <div className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 text-black text-[9px] font-bold px-2 py-0.5">MILESTONE</div>}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-[#4B5563]">Tier {tier.tier}</span>
        {reached ? <Check size={12} className="text-emerald-400" /> : <Lock size={12} className="text-[#374151]" />}
      </div>
      <div className="space-y-2">
        {/* Free track */}
        <div className={`flex items-center gap-2 rounded-lg p-2 ${reached && !freeClaimedThis ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-[rgba(255,255,255,0.02)]"}`}>
          <Gift size={14} className="text-emerald-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-[#4B5563]">FREE</p>
            <p className="text-xs font-semibold text-[#E2E8F0]">+{tier.freeReward.coins}🪙 +{tier.freeReward.xp}XP</p>
          </div>
          {reached && !freeClaimedThis && (
            <button onClick={() => onClaim(tier.tier, "free")} className="rounded-lg bg-emerald-500 text-black px-2 py-1 text-[9px] font-bold hover:bg-emerald-400">CLAIM</button>
          )}
          {freeClaimedThis && <Check size={12} className="text-emerald-400 shrink-0" />}
        </div>
        {/* Premium track */}
        <div className={`flex items-center gap-2 rounded-lg p-2 ${premiumUnlocked ? "bg-amber-500/10 border border-amber-500/20" : "bg-[rgba(255,255,255,0.02)] opacity-50"}`}>
          <Crown size={14} className="text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-[#4B5563]">PREMIUM</p>
            <p className="text-xs font-semibold text-[#E2E8F0]">+{tier.premiumReward.coins}🪙 +{tier.premiumReward.xp}XP</p>
          </div>
          {premiumUnlocked && reached && <button onClick={() => onClaim(tier.tier, "premium")} className="rounded-lg bg-amber-500 text-black px-2 py-1 text-[9px] font-bold hover:bg-amber-400">CLAIM</button>}
          {!premiumUnlocked && <Lock size={11} className="text-[#4B5563]" />}
        </div>
      </div>
    </div>
  );
}

export default function BattlePassPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["battle-pass"],
    queryFn: () => apiFetch("/api/retention/battle-pass"),
    staleTime: 30_000,
  });

  const claimTier = useMutation({
    mutationFn: ({ tier, track }: { tier: number; track: "free" | "premium" }) =>
      apiFetch("/api/retention/battle-pass/claim", { method: "POST", body: JSON.stringify({ tier, track }) }),
    onSuccess: (res) => {
      toast(`Claimed! +${res.reward.coins} coins, +${res.reward.xp} XP`, "success");
      qc.invalidateQueries({ queryKey: ["battle-pass"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e: any) => toast(e.message, "error"),
  });

  if (isLoading) return <div className="flex justify-center items-center min-h-screen"><div className="h-10 w-10 animate-spin rounded-full border-2 border-[rgba(255,255,255,0.06)] border-t-[#7C3AED]" /></div>;

  const tiers: any[] = data?.tiers ?? [];
  const tier = data?.tier ?? 0;
  const seasonXp = data?.seasonXp ?? 0;
  const nextTierXp = data?.nextTierXp ?? 200;
  const claimedTiers: number[] = data?.claimedTiers ?? [];
  const premiumUnlocked = data?.premiumUnlocked ?? false;
  const xpProgress = tier > 0 ? tiers[tier - 1]?.xpRequired ?? 0 : 0;
  const xpForNext = tiers[tier]?.xpRequired ?? nextTierXp;

  return (
    <div className="min-h-screen bg-[rgba(255,255,255,0.02)] text-[#E2E8F0] p-4 sm:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="relative rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-6 mb-6 overflow-hidden">
        <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_70%_50%,_#f59e0b,_transparent)]" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-1"><Trophy size={20} className="text-amber-400" /><span className="text-xs font-bold uppercase tracking-widest text-amber-400">Season {data?.season ?? 1}</span></div>
          <h1 className="text-3xl font-black text-[#E2E8F0]">Battle Pass</h1>
          <p className="text-sm text-[#4B5563] mt-1">Earn XP, unlock rewards. Ends {data?.endsAt ?? "Sep 30"}</p>
          <div className="mt-4">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-[#4B5563]">Tier {tier} → {tier + 1}</span>
              <span className="text-amber-400 font-semibold">{seasonXp.toLocaleString()} / {xpForNext.toLocaleString()} XP</span>
            </div>
            <ProgressBar value={seasonXp - xpProgress} max={xpForNext - xpProgress} color="#f59e0b" />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1"><Zap size={12} className="text-amber-400" /><span className="text-xs font-bold text-amber-400">Tier {tier} / 50</span></div>
            {!premiumUnlocked && (
              <button className="flex items-center gap-1.5 rounded-full border border-amber-500/50 bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-400 hover:bg-amber-500/30 transition-colors">
                <Crown size={12} /> Upgrade Premium
              </button>
            )}
            {premiumUnlocked && <div className="flex items-center gap-1.5 rounded-full border border-amber-500/50 bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-400"><Crown size={12} /> Premium Active</div>}
          </div>
        </div>
      </div>

      {/* How to earn XP */}
      <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] p-4 mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#4B5563] mb-2">Earn Battle Pass XP</p>
        <div className="grid grid-cols-3 gap-2 text-xs">
          {[["🎯", "Focus session", "+50 XP"], ["✅", "Task done", "+25 XP"], ["🔥", "Daily mission", "+100 XP"]].map(([icon, label, xp]) => (
            <div key={label} className="rounded-lg bg-[rgba(255,255,255,0.02)] p-2 text-center">
              <div className="text-xl mb-1">{icon}</div>
              <p className="text-[#4B5563] text-[10px]">{label}</p>
              <p className="text-emerald-400 font-bold">{xp}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tiers grid */}
      <div>
        <p className="text-sm font-semibold text-[#E2E8F0] mb-3">All Tiers <span className="text-[#4B5563] font-normal">(50 total)</span></p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {tiers.map((t: any) => (
            <TierCard
              key={t.tier}
              tier={t}
              claimed={claimedTiers}
              reached={tier >= t.tier}
              premiumUnlocked={premiumUnlocked}
              onClaim={(tierNum, track) => claimTier.mutate({ tier: tierNum, track })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
