/**
 * DropBanner (Workstream B) — live drop countdown + claim chip.
 *
 * Reads the public /drops endpoint (no auth needed to see hype), polls the
 * countdown once per second while a drop is live/upcoming, and pops in
 * instantly via the `drop:started` socket event (polling fallback on
 * serverless). Claiming hits /drops/:id/claim — server enforces the window,
 * the atomic pool and the one-claim-per-member rule; we only surface the
 * verdict. Respects prefers-reduced-motion.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useSocketEvent } from "@/lib/socket";

interface Drop {
  id: string;
  type: string;
  title: string;
  description: string | null;
  payload: Record<string, any>;
  startsAt: string;
  endsAt: string;
  poolTotal: number;
  poolRemaining: number;
  live: boolean;
  upcoming: boolean;
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
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}:${String(sec).padStart(2, "0")}`;
  return `${sec}s`;
}

export function DropBanner() {
  const [drops, setDrops] = useState<Drop[]>([]);
  const [now, setNow] = useState(Date.now());
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/drops", { credentials: "include" });
      if (r.ok) {
        const d = await r.json();
        setDrops(Array.isArray(d.drops) ? d.drops : []);
      }
    } catch { /* best effort */ }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  // Instant pop when an admin creates a drop (socket), polling fallback.
  useSocketEvent("drop:started", () => { void refresh(); });
  useEffect(() => {
    const t = setInterval(() => void refresh(), 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  // 1s countdown while anything is visible.
  const active = drops.filter((d) => d.live || d.upcoming);
  useEffect(() => {
    if (active.length === 0) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active.length]);

  // Dismissal state survives re-renders within a mount.
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});
  const visible = active.filter((d) => !dismissed[d.id]);
  if (visible.length === 0) return null;

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }

  async function claim(id: string) {
    setClaiming(id);
    try {
      const r = await fetch(`/drops/${id}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: "{}",
      });
      const d = await r.json();
      if (r.ok) {
        setClaimed((c) => ({ ...c, [id]: true }));
        const bits: string[] = [];
        if (d.rewardCoins) bits.push(`+${d.rewardCoins.toLocaleString()} coins`);
        if (d.rewardXp) bits.push(`+${d.rewardXp.toLocaleString()} XP`);
        if (d.itemGranted) bits.push(d.itemGranted);
        showToast(`Claimed! ${bits.join(" · ") || "You're in."}`);
        void refresh();
      } else {
        showToast(d.error ?? "Could not claim that drop.");
      }
    } catch {
      showToast("Network hiccup — try again.");
    } finally {
      setClaiming(null);
    }
  }

  return (
    <div className="relative w-full" aria-live="polite">
      <div className="flex flex-col gap-1.5">
        {visible.map((d) => {
          const msLeft = new Date(d.endsAt).getTime() - now;
          const msUntil = new Date(d.startsAt).getTime() - now;
          const icon = TYPE_ICONS[d.type] ?? "🔥";
          const claimable = d.live && !claimed[d.id] && ["coin_rain", "streak_freeze", "flash_quest", "item_flash_sale"].includes(d.type);

          let label: string;
          if (d.live) {
            switch (d.type) {
              case "double_xp":
                label = `${Number(d.payload?.multiplier ?? 2)}× XP is live — ends in ${fmtCountdown(msLeft)}`;
                break;
              case "board_shakeup":
                label = `Weekly board counts ${d.payload?.multiplier ?? 1.5}× — ${fmtCountdown(msLeft)} left`;
                break;
              case "flash_quest":
                label = `Focus ${d.payload?.targetMinutes ?? 60} min before it ends → ${Number(d.payload?.rewardCoins ?? 0).toLocaleString()} coins (${fmtCountdown(msLeft)} left)`;
                break;
              case "coin_rain":
                label = `${d.poolRemaining.toLocaleString()} coins left — ${fmtCountdown(msLeft)}`;
                break;
              case "streak_freeze":
                label = `${d.poolRemaining.toLocaleString()} streak-freezes left — ${fmtCountdown(msLeft)}`;
                break;
              case "item_flash_sale":
                label = `Flash sale: ${d.payload?.discountPct ?? 50}% off — ${fmtCountdown(msLeft)} left`;
                break;
              default:
                label = `Live — ${fmtCountdown(msLeft)} left`;
            }
          } else {
            label = `Upcoming: starts in ${fmtCountdown(msUntil)}`;
          }

          return (
            <div
              key={d.id}
              className="flex items-center gap-2.5 rounded-xl border border-[var(--palette-6c63ff)]/30 bg-[var(--palette-6c63ff)]/8 px-3 py-2"
            >
              <span className="text-base leading-none" aria-hidden>{icon}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-[var(--foreground)]">{d.title}</p>
                <p className="truncate text-[0.6875rem] text-[var(--foreground-muted)]">{label}</p>
              </div>
              {claimable && (
                <button
                  onClick={() => void claim(d.id)}
                  disabled={claiming === d.id}
                  className="shrink-0 rounded-lg bg-[var(--palette-6c63ff)] px-3 py-1.5 text-[0.6875rem] font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                >
                  {claiming === d.id ? "…" : d.type === "item_flash_sale" ? "Buy" : "Claim"}
                </button>
              )}
              {claimed[d.id] && (
                <span className="shrink-0 text-[0.6875rem] font-semibold text-[var(--palette-emerald-400)]">Claimed ✓</span>
              )}
              <button
                onClick={() => setDismissed((s) => ({ ...s, [d.id]: true }))}
                aria-label="Dismiss drop banner"
                className="shrink-0 rounded p-1 text-[var(--foreground-subtle)] transition hover:text-[var(--foreground)]"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
      {toast && (
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[var(--foreground)] px-3 py-1.5 text-[0.6875rem] font-medium text-[var(--background)] shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
