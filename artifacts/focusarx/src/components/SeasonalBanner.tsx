import { useEffect, useState } from "react";
import { Link } from "wouter";
import { X, Zap, Star, Crown, Lock } from "lucide-react";
import { getToken } from "@/lib/auth";

interface SeasonalEvent {
  name: string;
  description?: string | null;
  endDate: string;
  bannerColor?: string | null;
  locked?: boolean;
  premiumOnly?: boolean;
  xpMultiplier?: number;
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/**
 * A quiet season summary, not a second campaign billboard.
 *
 * It shares space with live drops and navigation, so it leads with the useful
 * facts (name, reward, end date) and puts the editorial description behind an
 * explicit disclosure. This prevents the seasonal card from pushing/overlapping
 * the task a member opened the app to do, especially on narrow screens.
 */
export default function SeasonalBanner() {
  const [event, setEvent] = useState<SeasonalEvent | null>(null);
  const [daysLeft, setDaysLeft] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    const at = localStorage.getItem("focusarx-seasonal-banner-dismissed");
    return !!at && Date.now() - Number(at) < 24 * 60 * 60 * 1000;
  });

  useEffect(() => {
    if (dismissed) return;
    fetch("/api/seasonal/active", { headers: authHeaders() })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: SeasonalEvent | null) => {
        if (!data) return;
        setEvent(data);
        setDaysLeft(Math.max(0, Math.ceil((new Date(data.endDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000))));
      })
      .catch(() => {});
  }, [dismissed]);

  if (!event || dismissed) return null;

  const color = event.bannerColor || "var(--brand-violet)";
  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem("focusarx-seasonal-banner-dismissed", String(Date.now()));
  };

  return (
    <section
      className="relative overflow-hidden rounded-xl border px-3 py-2.5 sm:px-4"
      style={{
        borderColor: `color-mix(in srgb, ${color} 28%, transparent)`,
        background: `color-mix(in srgb, ${color} 8%, transparent)`,
      }}
      aria-label={`${event.name} season`}
    >
      <div aria-hidden="true" className="pointer-events-none absolute -right-5 -top-7 h-20 w-20 rounded-full opacity-50 blur-2xl" style={{ background: color }} />
      <div className="relative flex items-center gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `color-mix(in srgb, ${color} 15%, transparent)` }} aria-hidden="true">
          {event.premiumOnly ? <Crown size={15} style={{ color }} /> : <Star size={15} style={{ color }} />}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link href="/battle-pass" className="truncate text-sm font-semibold leading-tight hover:underline" style={{ color }}>{event.name}</Link>
            {(event.xpMultiplier ?? 0) > 1 && (
              <span className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[0.6875rem] font-bold" style={{ color, borderColor: `color-mix(in srgb, ${color} 30%, transparent)`, background: `color-mix(in srgb, ${color} 12%, transparent)` }}>
                <Zap size={9} aria-hidden="true" /> {event.xpMultiplier}× XP
              </span>
            )}
            <span className="text-[0.6875rem] font-medium text-[var(--foreground-subtle)]">{daysLeft}d left</span>
          </div>
          {event.description && detailsOpen && (
            <p className="mt-1 text-xs leading-relaxed text-[var(--foreground-muted)]">{event.description}</p>
          )}
        </div>

        {event.locked ? (
          <Link href="/premium" className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg border px-2 text-[0.6875rem] font-semibold" style={{ color, borderColor: `color-mix(in srgb, ${color} 36%, transparent)` }}>
            <Lock size={11} aria-hidden="true" /> <span className="hidden sm:inline">Unlock</span>
          </Link>
        ) : (
          <Link href="/battle-pass" className="hidden min-h-8 shrink-0 items-center rounded-lg px-2 text-[0.6875rem] font-semibold sm:inline-flex" style={{ color, background: `color-mix(in srgb, ${color} 13%, transparent)` }}>
            Rewards
          </Link>
        )}
        {event.description && (
          <button type="button" onClick={() => setDetailsOpen((open) => !open)} aria-expanded={detailsOpen} className="hidden min-h-8 shrink-0 rounded-lg px-2 text-[0.6875rem] font-medium text-[var(--foreground-muted)] hover:bg-[var(--surface-raised)] sm:inline-flex">
            {detailsOpen ? "Less" : "Details"}
          </button>
        )}
        <button type="button" onClick={dismiss} aria-label={`Dismiss ${event.name} season`} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--foreground-subtle)] transition hover:bg-[var(--surface-raised)] hover:text-[var(--foreground)]">
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      {/* On a phone a hidden description is intentional: the season still has
          a clear name/reward/end date and the full reward page remains linked
          by the desktop affordance without competing with the focus task. */}
    </section>
  );
}
