import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { CalendarClock, Check, Crown, Lock, Coins, Sparkles } from "lucide-react";
import { apiJson, asNumber, asRecord, asString, errorMessage } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { usePremium } from "@/hooks/usePremium";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

/**
 * This week's premium contract.
 *
 * Premium's engagement problem is novelty: the perk list is identical on day
 * fifty and day one, so there is nothing in it that says *come back this week*.
 * The challenge behind this card is drawn from the ISO week, so it is a
 * different target every Monday, with a countdown to the reset and a payout in
 * the currency premium members actually collect.
 *
 * `requirePremium` decides the two legitimate uses:
 *   • `true`  — render nothing for a free student (the dashboard);
 *   • `false` — show it, locked (the premium page), because "here is what you
 *     get, here is this week's version of it" converts better than a perk list.
 */
interface ChallengeView {
  title: string;
  description: string;
  tokenReward: number;
  coinReward: number;
  xpReward: number;
}

interface ProgressView {
  current: number;
  target: number;
  percent: number;
  complete: boolean;
}

function readChallenge(payload: unknown) {
  const raw = asRecord(payload);
  const challenge = asRecord(raw.challenge);
  const progressRaw = asRecord(raw.progress);
  return {
    requiresPremium: raw.requiresPremium === true,
    claimed: raw.claimed === true,
    claimable: raw.claimable === true,
    weekKey: asString(raw.weekKey),
    resetsAt: asString(raw.resetsAt),
    challenge: {
      title: asString(challenge.title, "Weekly challenge"),
      description: asString(challenge.description),
      tokenReward: asNumber(challenge.tokenReward),
      coinReward: asNumber(challenge.coinReward),
      xpReward: asNumber(challenge.xpReward),
    } satisfies ChallengeView,
    progress: {
      current: asNumber(progressRaw.current),
      target: asNumber(progressRaw.target, 1),
      percent: asNumber(progressRaw.percent),
      complete: progressRaw.complete === true,
    } satisfies ProgressView,
  };
}

/** "2d 4h left" — the reset is the reason to act this week rather than later. */
function Countdown({ resetsAt }: { resetsAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const end = new Date(resetsAt).getTime();
  if (!Number.isFinite(end) || end <= 0) return null;
  const diff = end - now;
  if (diff <= 0) return <span>Resets now</span>;
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return <span>{days > 0 ? `${days}d ${hours}h left` : hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`}</span>;
}

export function PremiumWeeklyChallenge({ requirePremium = false }: { requirePremium?: boolean } = {}) {
  const { isPremium, isLoading: premiumLoading } = usePremium();
  const { toast } = useToast();
  const qc = useQueryClient();

  const enabled = !premiumLoading && (!requirePremium || isPremium);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["premium-challenge"],
    queryFn: async () => readChallenge(await apiJson("/api/premium/challenge")),
    staleTime: 60_000,
    enabled,
  });

  const claim = useMutation({
    mutationFn: () => apiJson<Record<string, unknown>>("/api/premium/challenge/claim", { method: "POST" }),
    onSuccess: (res) => {
      const r = asRecord(res);
      if (r.alreadyClaimed) {
        toast(`Already claimed — next challenge lands Monday`, "info");
      } else {
        toast(`Weekly challenge complete: +${asNumber(r.tokenReward)} tokens`, "success");
      }
      void qc.invalidateQueries({ queryKey: ["premium-challenge"] });
      void qc.invalidateQueries({ queryKey: ["battle-pass-enhanced"] });
      void qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e: unknown) => toast(errorMessage(e, "Could not claim the challenge"), "error"),
  });

  if (!enabled || isLoading || isError || !data) return null;

  const { challenge, progress } = data;
  const locked = data.requiresPremium;

  return (
    <section
      aria-labelledby="weekly-challenge-title"
      className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface)] p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">
            {locked ? <Lock aria-hidden className="size-3" /> : <Crown aria-hidden className="size-3 text-[var(--palette-amber-400)]" />}
            Premium weekly challenge
            {data.weekKey && <span className="font-normal normal-case tracking-normal">· {data.weekKey}</span>}
          </p>
          <h2 id="weekly-challenge-title" className="mt-1.5 text-sm font-semibold">{challenge.title}</h2>
          <p className="mt-1 text-xs text-[var(--foreground-muted)]">{challenge.description}</p>
        </div>
        <p className="flex items-center gap-1.5 text-[11px] text-[var(--foreground-subtle)]">
          <CalendarClock aria-hidden className="size-3.5" />
          <Countdown resetsAt={data.resetsAt} />
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="min-w-[10rem] flex-1">
          <Progress
            value={progress.percent}
            aria-label={`${progress.current} of ${progress.target} towards ${challenge.title}`}
          />
          <p className="mt-1.5 text-[11px] text-[var(--foreground-muted)]">
            <span className="font-semibold text-[var(--foreground)]">{progress.current}</span> of {progress.target}
            {progress.complete ? " — target met" : ` · ${Math.max(0, progress.target - progress.current)} to go`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2.5 py-1 font-semibold text-[var(--palette-amber-400)]">
            <Coins aria-hidden className="size-3" /> {challenge.tokenReward} tokens
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[var(--foreground-muted)]">
            {challenge.coinReward} coins
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[var(--foreground-muted)]">
            {challenge.xpReward} XP
          </span>
        </div>
        <div className="ml-auto">
          {locked ? (
            <Link
              href="/premium"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[var(--palette-amber-500)] px-4 text-xs font-bold text-[var(--neutral-0)]"
            >
              <Crown aria-hidden className="size-3.5" /> Unlock with tokens
            </Link>
          ) : data.claimed ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--palette-emerald-400)]">
              <Check aria-hidden className="size-3.5" /> Claimed this week
            </span>
          ) : (
            <Button size="sm" onClick={() => claim.mutate()} disabled={!data.claimable || claim.isPending}>
              <Sparkles aria-hidden className="size-3.5" />
              {claim.isPending ? "Claiming…" : data.claimable ? "Claim tokens" : "Not yet"}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
