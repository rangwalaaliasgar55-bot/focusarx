import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiJson, errorMessage, asArray, asNumber, asRecord, asString } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Lock, Check, Gift, Crown, Trophy, Clock, Coins, Sparkles, ArrowRight, Zap, Flag } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";
import { Link } from "wouter";
import { usePremium } from "@/hooks/usePremium";
import { XP_PER_MINUTE } from "@/lib/sessionRewards";

/**
 * The season page.
 *
 * Three things were wrong with it, all of them the reason the pass read as
 * decoration rather than a goal:
 *
 *   1. **It showed the reward shape the server never sent.** The old card
 *      looked for `freeReward.coins` while `/battle-pass/current` answers with
 *      `label` / `tokenAmount` / `cosmeticId` — so every tier rendered
 *      "0 coins" next to rewards that were really tokens and cosmetics.
 *   2. **It never explained the rules.** A student could not see what earns XP,
 *      what a milestone tier is, what the grace period is for, or how the
 *      premium track is unlocked. That is now a written explanation on the page
 *      (and `docs/BATTLE_PASS.md`).
 *   3. **It showed a tier number with no distance to the next one.** XP is
 *      effort, and the page now converts it: "≈ 35 focus minutes to Tier 12".
 */
function apiFetch<T = unknown>(path: string, opts?: RequestInit): Promise<T> {
  return apiJson<T>(path, opts);
}

interface RewardView {
  name?: string;
  label?: string;
  coins?: number;
  tokenAmount?: number;
  cosmeticId?: string | null;
  petId?: string | null;
  lootbox?: string | null;
  icon?: string | null;
}
interface BattlePassTier {
  tier: number;
  xpRequired: number;
  freeReward?: RewardView | null;
  premiumReward?: RewardView | null;
}

function Countdown({ endsAt, graceEndsAt }: { endsAt: string; graceEndsAt?: string }) {
  // Lazy init: the initial value must not be computed in render body.
  const [now, setNow] = useState(() => Date.now());
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
      return <span className="text-[var(--palette-amber-400)]">Grace period: {d}d {h}h left to claim</span>;
    }
    return <span className="text-[var(--palette-red-400)]">Season ended</span>;
  }
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return <span>{d}d {h}h {m}m left</span>;
}

/** "2,400 coins · 120 XP" from whatever the server actually sent. */
function rewardText(reward?: RewardView | null): string {
  if (!reward) return "—";
  if (reward.label) return reward.label;
  const parts: string[] = [];
  if (reward.tokenAmount) parts.push(`${reward.tokenAmount.toLocaleString()} tokens`);
  if (reward.coins) parts.push(`${reward.coins.toLocaleString()} coins`);
  if (reward.cosmeticId) parts.push("cosmetic");
  if (reward.petId) parts.push("pet");
  if (reward.lootbox) parts.push("loot box");
  return parts.length > 0 ? parts.join(" · ") : "reward";
}

export default function BattlePassPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { isPremium } = usePremium();
  const [previewTier, setPreviewTier] = useState<number | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<unknown>({
    queryKey: ["battle-pass-enhanced"],
    queryFn: () => apiFetch<unknown>("/api/battle-pass/current"),
    staleTime: 30_000,
  });

  const claimMutation = useMutation({
    mutationFn: ({ tier, isPremiumReward }: { tier: number; isPremiumReward?: boolean }) =>
      apiFetch<Record<string, unknown>>("/api/battle-pass/claim", {
        method: "POST",
        body: JSON.stringify({ tier, isPremiumReward, battlePassId: seasonId }),
      }),
    onSuccess: (res) => {
      const r = asRecord(res);
      if (r.alreadyClaimed) {
        toast("Already claimed", "info");
      } else {
        const bits = [
          asNumber(r.tokenReward) > 0 ? `+${asNumber(r.tokenReward)} tokens` : "",
          asNumber(r.coinsAwarded) > 0 ? `+${asNumber(r.coinsAwarded).toLocaleString()} coins` : "",
          asString(r.cosmeticId) ? "cosmetic unlocked" : "",
          asString(r.lootbox) ? "loot box" : "",
        ].filter(Boolean);
        toast(bits.length > 0 ? `Claimed ${bits.join(" · ")}` : "Reward claimed", "success");
      }
      qc.invalidateQueries({ queryKey: ["battle-pass-enhanced"] });
    },
    onError: (e: unknown) => toast(errorMessage(e, "Claim failed"), "error"),
  });

  const claimAllMutation = useMutation({
    mutationFn: () =>
      apiFetch<Record<string, unknown>>("/api/battle-pass/claim-all", {
        method: "POST",
        body: JSON.stringify({ battlePassId: seasonId }),
      }),
    onSuccess: (res) => {
      const r = asRecord(res);
      const count = asNumber(r.claimedCount);
      const tokens = asNumber(r.tokensAwarded ?? r.tokenReward);
      if (count === 0) toast("Nothing to claim yet — keep focusing", "info");
      else toast(`Claimed ${count} reward${count === 1 ? "" : "s"}${tokens > 0 ? ` · +${tokens} tokens` : ""}`, "success");
      qc.invalidateQueries({ queryKey: ["battle-pass-enhanced"] });
    },
    onError: (e: unknown) => toast(errorMessage(e), "error"),
  });

  if (isLoading) {
    // A skeleton, not a spinner: the page has a known shape, so showing it
    // immediately reads as faster than a centred dot that then reflows.
    return (
      <div className="mx-auto max-w-5xl animate-pulse px-4 pb-8 pt-6 sm:px-6">
        <div className="h-44 rounded-2xl bg-[var(--surface-2)]" />
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 rounded-2xl bg-[var(--surface-2)]" />
          ))}
        </div>
        <span className="sr-only">Loading your season…</span>
      </div>
    );
  }

  const view = asRecord(data);
  const tiers = asArray<BattlePassTier>(view.tiers);
  const progress = asRecord(view.progress);

  if (isError || tiers.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-[var(--foreground-muted)]">The battle pass could not be loaded.</p>
        <button onClick={() => void refetch()} className="mt-3 rounded-xl bg-[var(--brand-600)] px-4 py-2 text-xs font-bold text-white">
          Retry
        </button>
      </div>
    );
  }

  const seasonId = asString(view.seasonId);
  const seasonTitle = asString(view.seasonTitle, "Focus Season");
  const tokenBalance = asNumber(view.tokenBalance);
  const daysLeft = asNumber(view.daysLeft);
  const inGrace = view.inGracePeriod === true;
  const currentTier = asNumber(progress.currentTier);
  const seasonXp = asNumber(progress.seasonXp);
  const claimedFree = new Set(asArray<number>(progress.claimedFree));
  const claimedPremium = new Set(asArray<number>(progress.claimedPremium));

  const nextTierIndex = tiers.findIndex((t) => t.tier === currentTier + 1);
  const next = nextTierIndex === -1 ? undefined : tiers[nextTierIndex];
  const prev = currentTier > 0 ? tiers.find((t) => t.tier === currentTier) : undefined;
  const xpForNext = next?.xpRequired ?? seasonXp;
  const xpPrev = prev?.xpRequired ?? 0;
  const intoTier = Math.max(0, seasonXp - xpPrev);
  const tierSpan = Math.max(1, xpForNext - xpPrev);
  const progressPct = next ? Math.min(100, Math.round((intoTier / tierSpan) * 100)) : 100;
  const xpToNext = next ? Math.max(0, next.xpRequired - seasonXp) : 0;
  // 20 XP per focused minute (see lib/sessionRewards), so the goal can be stated
  // in the unit a student actually plans with: minutes, not XP.
  const minutesToNext = xpToNext > 0 ? Math.ceil(xpToNext / XP_PER_MINUTE) : 0;
  const nextMilestone = tiers.find((t) => t.tier > currentTier && t.tier % 5 === 0);
  const claimable = tiers.filter(
    (t) => t.tier <= currentTier && (!claimedFree.has(t.tier) || (isPremium && !claimedPremium.has(t.tier))),
  ).length;

  return (
    <PageTransition>
      <PageSEO {...PAGE_SEO.battlePass} />
      <div className="mx-auto max-w-5xl px-4 pb-8 pt-6 sm:px-6 sm:pt-8">
        {/* Header with season countdown */}
        <div className="relative scroll-mt-24 overflow-hidden rounded-2xl border border-[var(--palette-amber-500)]/20 bg-[var(--palette-amber-500)]/10 p-5 sm:p-6">
          <div className="relative flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Trophy size={18} className="shrink-0 text-[var(--palette-amber-400)]" />
                <span className="text-xs font-bold uppercase tracking-widest text-[var(--palette-amber-400)]">{seasonTitle}</span>
                <span className="rounded-full bg-[var(--surface-1)] px-2 py-0.5 text-[11px]">{tiers.length} tiers</span>
                {daysLeft > 0 && !inGrace && <span className="rounded-full bg-[var(--surface-1)] px-2 py-0.5 text-[11px]">{daysLeft} day{daysLeft === 1 ? "" : "s"} left</span>}
              </div>
              <h1 className="mt-2 text-3xl font-semibold">Battle Pass</h1>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--foreground-muted)]">
                <Clock size={12} />
                <Countdown endsAt={asString(view.countdown ? asRecord(view.countdown).endsAt : "", asString(view.endDate))} graceEndsAt={asString(asRecord(view.countdown).graceEndsAt, asString(view.graceEndsAt))} />
              </p>
              {inGrace && (
                <p className="mt-1 text-xs font-bold text-[var(--palette-amber-400)]">
                  Grace period active — claim your rewards before they expire.
                </p>
              )}
            </div>

            {/* Progress block: full-width left-aligned on mobile. */}
            <div className="w-full shrink-0 text-left sm:w-auto sm:min-w-[15rem] sm:text-right">
              <p className="text-[11px] uppercase tracking-wider text-[var(--foreground-subtle)]">Your progress</p>
              <p className="text-2xl font-semibold">Tier {currentTier} <span className="text-base font-normal text-[var(--foreground-subtle)]">/ {tiers.length}</span></p>
              <p className="text-xs text-[var(--foreground-muted)]">{seasonXp.toLocaleString()} season XP</p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-1)] sm:ml-auto">
                <div className="h-full bg-[var(--palette-amber-500)] transition-all" style={{ width: `${progressPct}%` }} />
              </div>
              {next ? (
                <p className="mt-1 text-[11px] text-[var(--foreground-muted)]">
                  {intoTier.toLocaleString()} / {tierSpan.toLocaleString()} XP to <span className="font-semibold text-[var(--foreground)]">Tier {next.tier}</span>
                  {" · "}
                  <span className="font-semibold text-[var(--palette-amber-400)]">≈ {minutesToNext} focus min</span>
                </p>
              ) : (
                <p className="mt-1 text-[11px] font-semibold text-[var(--palette-emerald-400)]">Season complete — every tier unlocked</p>
              )}
            </div>
          </div>

          <div className="relative mt-4 flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--palette-amber-500)]/20 bg-[var(--palette-amber-500)]/10 px-3 py-1 text-xs font-bold text-[var(--palette-amber-400)]">
              <Coins size={12} /> {tokenBalance.toLocaleString()} Focus Tokens
            </div>
            {isPremium ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--palette-amber-500)] px-3 py-1 text-xs font-bold text-white">
                <Crown size={12} /> Premium track active
              </span>
            ) : (
              <Link href="/premium" className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-1)] px-3 py-1 text-xs font-bold text-[var(--foreground-muted)] hover:text-[var(--palette-amber-400)]">
                <Crown size={12} /> Unlock the premium track with tokens
              </Link>
            )}
            <button
              onClick={() => claimAllMutation.mutate()}
              disabled={claimAllMutation.isPending || claimable === 0}
              className="ml-auto inline-flex items-center gap-1 rounded-full bg-[var(--brand-600)] px-4 py-1.5 text-xs font-bold text-white hover:bg-[var(--brand-700)] disabled:opacity-50"
            >
              <Gift size={12} /> {claimAllMutation.isPending ? "Claiming…" : claimable > 0 ? `Claim ${claimable} reward${claimable === 1 ? "" : "s"}` : "Nothing to claim"}
            </button>
          </div>

          {/* The next goal, in one line. A tier list is a plan; this is the step. */}
          {(next || nextMilestone) && (
            <div className="relative mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-[var(--forge-border)] bg-[var(--surface-1)]/80 p-3 text-[11px]">
              {next && (
                <span className="inline-flex items-center gap-1.5">
                  <Zap size={12} className="text-[var(--palette-amber-400)]" />
                  <span className="text-[var(--foreground-muted)]">Next:</span>
                  <span className="font-semibold text-[var(--foreground)]">Tier {next.tier}</span>
                  <span className="text-[var(--foreground-subtle)]">— {rewardText(next.freeReward)}</span>
                </span>
              )}
              {nextMilestone && (
                <span className="inline-flex items-center gap-1.5">
                  <Flag size={12} className="text-[var(--palette-violet-400)]" />
                  <span className="text-[var(--foreground-muted)]">Next milestone:</span>
                  <span className="font-semibold text-[var(--foreground)]">Tier {nextMilestone.tier}</span>
                  <span className="text-[var(--foreground-subtle)]">— {nextMilestone.tier - currentTier} tiers away, cosmetic on the premium track</span>
                </span>
              )}
            </div>
          )}

          <div className="relative mt-4 rounded-xl border border-[var(--forge-border)] bg-[var(--surface-1)]/80 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--foreground-subtle)]">How to earn season XP</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
              <div className="rounded-lg bg-[var(--surface-2)] p-2 text-center">
                Focus session<br /><span className="font-bold text-[var(--brand-400)]">{XP_PER_MINUTE} XP / min</span>
              </div>
              <div className="rounded-lg bg-[var(--surface-2)] p-2 text-center">
                Session milestones<br /><span className="font-bold text-[var(--palette-emerald-400)]">bonus XP at 25 min+</span>
              </div>
              <div className="rounded-lg bg-[var(--surface-2)] p-2 text-center">
                Quest complete<br /><span className="font-bold text-[var(--palette-sky-400)]">bonus XP</span>
              </div>
              <div className="rounded-lg bg-[var(--surface-2)] p-2 text-center">
                Daily streak<br /><span className="font-bold text-[var(--palette-amber-400)]">keeps it going</span>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-[var(--foreground-subtle)]">
              A 25-minute focus session is 500 XP — enough for Tier 1 on its own. Everything is earned by focusing; nothing
              here costs money.
            </p>
          </div>
        </div>

        {/* Tiers grid */}
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold">All tiers — free and premium tracks</h2>
            <p className="text-[11px] text-[var(--foreground-subtle)]">Claims are idempotent · 3-day grace period after the season ends</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tiers.map((t) => {
              const reached = currentTier >= t.tier;
              const freeClaimed = claimedFree.has(t.tier);
              const premClaimed = claimedPremium.has(t.tier);
              const isMilestone = t.tier % 5 === 0;
              const isNext = next?.tier === t.tier;
              return (
                <div
                  key={t.tier}
                  onMouseEnter={() => setPreviewTier(t.tier)}
                  onMouseLeave={() => setPreviewTier(null)}
                  className={`relative rounded-2xl border p-4 transition-all ${isMilestone ? "border-[var(--palette-amber-500)]/30 bg-[var(--palette-amber-500)]/5" : "border-[var(--forge-border)] bg-[var(--card)]"} ${!reached ? "opacity-60" : ""} ${previewTier === t.tier || isNext ? "ring-2 ring-[var(--brand-400)]/20" : ""}`}
                >
                  {isMilestone && (
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-[var(--palette-amber-500)] px-2 py-0.5 text-[11px] font-bold text-black">
                      Milestone
                    </div>
                  )}
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold">Tier {t.tier}</span>
                    <span className="text-[11px] text-[var(--foreground-subtle)]">
                      {t.xpRequired.toLocaleString()} XP{!reached && t.xpRequired > seasonXp ? ` · ${Math.ceil((t.xpRequired - seasonXp) / XP_PER_MINUTE)} min` : ""}
                    </span>
                    {reached ? (
                      <Check size={12} className="text-[var(--palette-emerald-400)]" />
                    ) : (
                      <Lock size={12} className="text-[var(--foreground-subtle)]" />
                    )}
                  </div>

                  {/* Free track */}
                  <div className={`mb-2 flex items-center gap-2 rounded-xl p-2.5 ${reached ? "border border-[var(--palette-emerald-500)]/20 bg-[var(--palette-emerald-500)]/10" : "bg-[var(--surface-1)]"}`}>
                    <Gift size={14} className="shrink-0 text-[var(--palette-emerald-400)]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold uppercase text-[var(--foreground-subtle)]">Free</p>
                      <p className="truncate text-xs font-semibold" title={rewardText(t.freeReward)}>{rewardText(t.freeReward)}</p>
                    </div>
                    {reached && !freeClaimed ? (
                      <button
                        onClick={() => claimMutation.mutate({ tier: t.tier })}
                        disabled={claimMutation.isPending}
                        className="rounded-full bg-[var(--palette-emerald-500)] px-3 py-1 text-[11px] font-bold text-black disabled:opacity-50"
                      >
                        Claim
                      </button>
                    ) : freeClaimed ? (
                      <Check size={14} className="shrink-0 text-[var(--palette-emerald-400)]" />
                    ) : null}
                  </div>

                  {/* Premium track */}
                  <div className={`flex items-center gap-2 rounded-xl p-2.5 ${isPremium ? (reached ? "border border-[var(--palette-amber-500)]/20 bg-[var(--palette-amber-500)]/10" : "bg-[var(--surface-1)]") : "bg-[var(--surface-1)] opacity-60"}`}>
                    <Crown size={14} className="shrink-0 text-[var(--palette-amber-400)]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold uppercase text-[var(--foreground-subtle)]">Premium</p>
                      <p className="truncate text-xs font-semibold" title={rewardText(t.premiumReward)}>{rewardText(t.premiumReward)}</p>
                    </div>
                    {isPremium ? (
                      reached && !premClaimed ? (
                        <button
                          onClick={() => claimMutation.mutate({ tier: t.tier, isPremiumReward: true })}
                          disabled={claimMutation.isPending}
                          className="rounded-full bg-[var(--palette-amber-500)] px-3 py-1 text-[11px] font-bold text-black disabled:opacity-50"
                        >
                          Claim
                        </button>
                      ) : premClaimed ? (
                        <Check size={14} className="shrink-0 text-[var(--palette-emerald-400)]" />
                      ) : null
                    ) : (
                      <Lock size={12} className="shrink-0 text-[var(--foreground-subtle)]" />
                    )}
                  </div>

                  {!isPremium && reached && (
                    <Link href="/premium" className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl bg-[var(--surface-1)] py-1.5 text-[11px] font-bold text-[var(--palette-amber-400)]">
                      <Crown size={10} /> Unlock this tier's premium reward
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* How it works — the question the old page never answered. */}
        <section className="mt-8 rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-bold">
            <Sparkles size={14} /> How the battle pass works
          </h3>
          <ol className="mt-3 grid gap-3 text-xs text-[var(--foreground-muted)] sm:grid-cols-2">
            <li className="rounded-xl bg-[var(--surface-1)] p-3">
              <span className="font-semibold text-[var(--foreground)]">1. Focus to earn season XP.</span>{" "}
              {XP_PER_MINUTE} XP per focused minute, inside the timer. XP is yours the moment the session is saved — there is
              nothing to opt into.
            </li>
            <li className="rounded-xl bg-[var(--surface-1)] p-3">
              <span className="font-semibold text-[var(--foreground)]">2. XP unlocks tiers.</span>{" "}
              Each tier needs more than the last ({requiredXpCopy(tiers)}). Tier 1 is 500 XP — one 25-minute session.
            </li>
            <li className="rounded-xl bg-[var(--surface-1)] p-3">
              <span className="font-semibold text-[var(--foreground)]">3. Claim what you unlocked.</span>{" "}
              Claiming is per tier and per track, and it is idempotent: pressing Claim twice cannot double-pay, and "Claim all"
              takes everything you are owed at once.
            </li>
            <li className="rounded-xl bg-[var(--surface-1)] p-3">
              <span className="font-semibold text-[var(--foreground)]">4. Every fifth tier is a milestone.</span>{" "}
              Milestone tiers pay more on both tracks, and the premium track adds a cosmetic you cannot buy with coins.
            </li>
            <li className="rounded-xl bg-[var(--surface-1)] p-3">
              <span className="font-semibold text-[var(--foreground)]">5. The premium track is bought with Focus Tokens</span>{" "}
              — earned by focusing, quests and the season itself. No card, no cash.
            </li>
            <li className="rounded-xl bg-[var(--surface-1)] p-3">
              <span className="font-semibold text-[var(--foreground)]">6. Seasons end, and there is a 3-day grace period.</span>{" "}
              After the season ends you keep 3 days to claim; after that, unclaimed tiers roll into the next season and your
              progress starts clean with new rewards.
            </li>
          </ol>
          <p className="mt-3 text-[11px] text-[var(--foreground-subtle)]">
            Admins introduce each season — tier count, rewards and launch — from Admin → Battle pass. When a new season is
            published, the older one becomes the rollback.
          </p>
          <Link href="/admin" className="mt-3 inline-flex min-h-9 items-center gap-1 rounded-full bg-[var(--surface-1)] px-4 text-xs font-bold">
            Open admin <ArrowRight size={12} />
          </Link>
        </section>
      </div>
    </PageTransition>
  );
}

/** "500 / 1,000 / 1,500 …" — the first few steps, enough to see the shape. */
function requiredXpCopy(tiers: BattlePassTier[]): string {
  const first = tiers.slice(0, 3).map((t) => t.xpRequired.toLocaleString());
  return first.length > 0 ? `${first.join(" / ")} XP…` : "more each tier";
}
