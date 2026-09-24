/**
 * Live-event rail for drops.
 *
 * A previous version rendered every active/upcoming drop as another small
 * banner. During a seasonal event that could create a tall, competing stack
 * above the page, while hiding the one thing a member needed to know: what is
 * available, whether they need to act, and how long they have. This component
 * promotes one relevant event and keeps any others behind an explicit,
 * non-overlay disclosure.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useSocketEvent } from "@/lib/socket";
import { haptic } from "@/lib/haptics";
import { getToken } from "@/lib/auth";

interface SaleItem {
  name: string;
  emoji?: string | null;
  price?: number;
  salePrice?: number;
}

interface Drop {
  id: string;
  type: string;
  title: string;
  description: string | null;
  payload: Record<string, unknown>;
  startsAt: string;
  endsAt: string;
  poolTotal: number;
  poolRemaining: number;
  live: boolean;
  upcoming: boolean;
  claimed?: boolean;
  saleItem?: SaleItem | null;
}

const TYPE_ICONS: Record<string, string> = {
  coin_rain: "🪙",
  double_xp: "⚡",
  board_shakeup: "🏆",
  flash_quest: "🚩",
  streak_freeze: "❄️",
  item_flash_sale: "🏷️",
};

function fmtCountdown(ms: number): string {
  if (ms <= 0) return "now";
  const seconds = Math.floor(ms / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
  return `${remainingSeconds}s`;
}

function isLimitedPool(drop: Drop): boolean {
  return drop.type === "coin_rain" || drop.type === "streak_freeze";
}

function canClaim(drop: Drop, claimed: Record<string, boolean>): boolean {
  return drop.live
    && !claimed[drop.id]
    && (!isLimitedPool(drop) || drop.poolRemaining > 0)
    && ["coin_rain", "streak_freeze", "flash_quest", "item_flash_sale"].includes(drop.type);
}

/** Plain-language reward and action copy, so an event never looks like a
 * mystery banner or a manual claim when it actually applies automatically. */
function dropSummary(drop: Drop): string {
  switch (drop.type) {
    case "coin_rain":
      return `Claim ${Number(drop.payload?.coinsPerClaim ?? 0).toLocaleString()} coins while rewards remain.`;
    case "double_xp":
      return `${Number(drop.payload?.multiplier ?? 2)}× XP applies automatically to every completed focus session.`;
    case "board_shakeup":
      return `${Number(drop.payload?.multiplier ?? 1.5)}× progress applies automatically to your weekly leaderboard score.`;
    case "flash_quest":
      return `Focus ${Number(drop.payload?.targetMinutes ?? 60)} minutes, then claim ${Number(drop.payload?.rewardCoins ?? 0).toLocaleString()} coins and ${Number(drop.payload?.rewardXp ?? 0).toLocaleString()} XP.`;
    case "streak_freeze":
      return `Claim a streak-freeze token while the giveaway pool is open.`;
    case "item_flash_sale": {
      const item = drop.saleItem?.name ?? "limited marketplace item";
      const discount = Number(drop.payload?.discountPct ?? 0);
      const price = drop.saleItem?.salePrice;
      return `${discount}% off ${item}${price ? ` — ${price.toLocaleString()} coins today` : ""}.`;
    }
    default:
      return "A limited FocusArx event is live.";
  }
}

function primaryLabel(drop: Drop): string {
  if (drop.type === "item_flash_sale") return "Buy sale item";
  if (drop.type === "flash_quest") return "Claim reward";
  return "Claim reward";
}

export function DropBanner() {
  const [drops, setDrops] = useState<Drop[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});
  const [showAll, setShowAll] = useState(false);
  const noticeTimer = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const token = getToken();
      const response = await fetch("/api/drops", {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) return;
      const data = await response.json() as { drops?: Drop[] };
      const nextDrops = Array.isArray(data.drops) ? data.drops : [];
      setDrops(nextDrops);
      setClaimed(Object.fromEntries(nextDrops.filter((drop) => drop.claimed).map((drop) => [drop.id, true])));
    } catch {
      // A drop is optional UI; never turn a temporary API failure into page UI.
    }
  }, []);

  // Socket delivery is instant for signed-in members; polling retains a
  // serverless/public fallback without putting a permanent socket on guests.
  useSocketEvent("drop:started", () => { void refresh(); });
  useEffect(() => {
    const first = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), 60_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, [refresh]);

  const active = drops.filter((drop) => drop.live || drop.upcoming);
  useEffect(() => {
    if (active.length === 0) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [active.length]);

  useEffect(() => () => {
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
  }, []);

  const showNotice = (message: string) => {
    setNotice(message);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 5_000);
  };

  async function claim(drop: Drop) {
    const token = getToken();
    if (!token) {
      showNotice("Sign in to claim this reward.");
      return;
    }
    setClaiming(drop.id);
    try {
      const response = await fetch(`/api/drops/${drop.id}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: "{}",
      });
      const data = await response.json().catch(() => ({})) as { rewardCoins?: number; rewardXp?: number; itemGranted?: string; error?: string };
      if (!response.ok) {
        showNotice(data.error ?? "This reward is no longer available.");
        return;
      }
      setClaimed((current) => ({ ...current, [drop.id]: true }));
      const rewards: string[] = [];
      if (data.rewardCoins) rewards.push(`+${data.rewardCoins.toLocaleString()} coins`);
      if (data.rewardXp) rewards.push(`+${data.rewardXp.toLocaleString()} XP`);
      if (data.itemGranted) rewards.push(data.itemGranted);
      showNotice(`Claimed! ${rewards.join(" · ") || "You're in."}`);
      haptic("success");
      void refresh();
    } catch {
      showNotice("Network hiccup — try again.");
    } finally {
      setClaiming(null);
    }
  }

  const visible = active.filter((drop) => !dismissed[drop.id]);
  if (visible.length === 0) return null;

  // A pending action is more important than an automatic multiplier; then show
  // a live event, then the nearest upcoming event. This keeps the primary card
  // useful instead of merely following database ordering.
  const featured = visible.find((drop) => canClaim(drop, claimed))
    ?? visible.find((drop) => drop.live)
    ?? visible[0]!;
  const remaining = visible.filter((drop) => drop.id !== featured.id);
  const milliseconds = featured.live
    ? new Date(featured.endsAt).getTime() - now
    : new Date(featured.startsAt).getTime() - now;
  const poolPercent = featured.poolTotal > 0 && isLimitedPool(featured)
    ? Math.max(0, Math.min(100, Math.round((featured.poolRemaining / featured.poolTotal) * 100)))
    : null;
  const claimedFeatured = claimed[featured.id];

  const dismiss = (id: string) => setDismissed((current) => ({ ...current, [id]: true }));

  const action = (drop: Drop, compact = false) => {
    if (!drop.live || claimed[drop.id]) return null;
    if (isLimitedPool(drop) && drop.poolRemaining <= 0) {
      return <span className="text-xs font-semibold text-[var(--foreground-subtle)]">Fully claimed</span>;
    }
    if (canClaim(drop, claimed)) {
      if (!getToken()) {
        return <Link href="/login" className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[var(--brand-600)] px-3 text-xs font-semibold text-white hover:bg-[var(--brand-700)]">Sign in to claim</Link>;
      }
      return (
        <button
          type="button"
          onClick={() => void claim(drop)}
          disabled={claiming === drop.id}
          className={`inline-flex min-h-10 items-center justify-center rounded-lg bg-[var(--brand-600)] px-3 text-xs font-semibold text-white transition hover:bg-[var(--brand-700)] disabled:opacity-60 ${compact ? "" : "sm:px-4"}`}
        >
          {claiming === drop.id ? "Claiming…" : primaryLabel(drop)}
        </button>
      );
    }
    // Multiplier events do not have a claim endpoint. State that plainly and
    // offer the meaningful next action instead of a dead button.
    return <Link href="/focus" className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--brand-500)]/40 px-3 text-xs font-semibold text-[var(--brand-strong)] hover:bg-[var(--brand-soft)]">Start a focus session</Link>;
  };

  return (
    <section className="w-full" aria-label="Live FocusArx events">
      <article className="relative overflow-hidden rounded-xl border border-[var(--brand-500)]/30 bg-[var(--brand-soft)] px-3 py-3 sm:px-4">
        <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[var(--brand-500)]/10 blur-2xl" />
        <div className="relative flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-raised)] text-xl shadow-sm" aria-hidden="true">
            {TYPE_ICONS[featured.type] ?? "✨"}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-bold uppercase tracking-[0.12em] ${featured.live ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--surface-raised)] text-[var(--foreground-muted)]"}`}>
                {featured.live ? "Live now" : "Coming up"}
              </span>
              <time dateTime={featured.live ? featured.endsAt : featured.startsAt} className="text-[0.6875rem] font-medium text-[var(--foreground-muted)]">
                {featured.live ? `${fmtCountdown(milliseconds)} left` : `starts in ${fmtCountdown(milliseconds)}`}
              </time>
            </div>
            <h2 className="mt-1 text-sm font-semibold leading-snug text-[var(--foreground)]">{featured.title}</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--foreground-muted)]">
              {featured.description || dropSummary(featured)}
            </p>
            {featured.description && <p className="mt-1 text-[0.6875rem] leading-relaxed text-[var(--foreground-subtle)]">{dropSummary(featured)}</p>}

            {poolPercent !== null && (
              <div className="mt-2.5 max-w-md">
                <div className="mb-1 flex items-center justify-between gap-3 text-[0.6875rem] font-medium text-[var(--foreground-muted)]">
                  <span>Reward pool</span>
                  <span>{featured.poolRemaining.toLocaleString()} of {featured.poolTotal.toLocaleString()} left</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-raised)]" aria-hidden="true">
                  <div className="h-full rounded-full bg-[var(--brand-500)] transition-[width] duration-300" style={{ width: `${poolPercent}%` }} />
                </div>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {featured.live && !claimedFeatured && action(featured)}
              {claimedFeatured && <span className="inline-flex min-h-10 items-center rounded-lg border border-[var(--success)]/30 bg-[var(--success-soft)] px-3 text-xs font-semibold text-[var(--success)]">Claimed ✓</span>}
              {!featured.live && <span className="inline-flex min-h-10 items-center rounded-lg border border-[var(--border-strong)] px-3 text-xs font-medium text-[var(--foreground-muted)]">No action needed yet</span>}
            </div>
          </div>
          <button type="button" onClick={() => dismiss(featured.id)} aria-label={`Dismiss ${featured.title}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[var(--foreground-subtle)] transition hover:bg-[var(--surface-raised)] hover:text-[var(--foreground)]">
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </article>

      {notice && <p role="status" className="mt-2 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 py-2 text-xs font-medium text-[var(--foreground)]">{notice}</p>}

      {remaining.length > 0 && (
        <div className="mt-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)]">
          <button type="button" onClick={() => setShowAll((open) => !open)} aria-expanded={showAll} className="flex min-h-10 w-full items-center justify-between gap-3 px-3 text-left text-xs font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)]">
            <span>{showAll ? "Hide" : "Show"} {remaining.length} other {remaining.length === 1 ? "event" : "events"}</span>
            <span aria-hidden="true">{showAll ? "−" : "+"}</span>
          </button>
          {showAll && (
            <ul className="border-t border-[var(--border-subtle)] p-2">
              {remaining.map((drop) => {
                const time = drop.live ? new Date(drop.endsAt).getTime() - now : new Date(drop.startsAt).getTime() - now;
                return (
                  <li key={drop.id} className="flex items-center gap-2 rounded-lg px-2 py-2">
                    <span aria-hidden="true">{TYPE_ICONS[drop.type] ?? "✨"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-[var(--foreground)]">{drop.title}</p>
                      <p className="truncate text-[0.6875rem] text-[var(--foreground-subtle)]">{drop.live ? `${fmtCountdown(time)} left` : `starts in ${fmtCountdown(time)}`}</p>
                    </div>
                    {drop.live && action(drop, true)}
                    <button type="button" onClick={() => dismiss(drop.id)} aria-label={`Dismiss ${drop.title}`} className="grid h-8 w-8 place-items-center rounded text-[var(--foreground-subtle)] hover:bg-[var(--surface-hover)]">×</button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
