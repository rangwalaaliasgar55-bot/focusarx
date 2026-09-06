import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, Star, Crown, Lock } from "lucide-react";
import { getToken } from "@/lib/auth";

function authHeaders() {
  const t = getToken();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (t) h["Authorization"] = `Bearer ${t}`;
  return h;
}

export default function SeasonalBanner() {
  const [event, setEvent] = useState<any>(null);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    const d = localStorage.getItem("focusarx-seasonal-banner-dismissed");
    return !!d && Date.now() - parseInt(d) < 24 * 60 * 60 * 1000;
  });

  useEffect(() => {
    if (dismissed) return;

    fetch("/api/seasonal/active", { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setEvent(d);
      })
      .catch(() => {});
  }, [dismissed]);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("focusarx-seasonal-banner-dismissed", Date.now().toString());
  };

  if (!event || dismissed) return null;

  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(event.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  );
  const color = event.bannerColor || "var(--brand-violet)";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.25 }}
        className="relative overflow-hidden rounded-xl border px-3 py-2.5 sm:px-4 sm:py-3"
        style={{
          borderColor: `color-mix(in srgb, ${color} 28%, transparent)`,
          background: `color-mix(in srgb, ${color} 8%, transparent)`,
        }}
        role="status"
        aria-label={`${event.name}. ${event.description || ""}`}
      >
        <div className="flex items-start gap-2.5 sm:items-center sm:gap-3">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg sm:mt-0 sm:h-9 sm:w-9" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)` }}>
            {event.premiumOnly ? (
              <Crown size={15} style={{ color }} />
            ) : (
              <Star size={15} style={{ color }} />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-sm font-semibold leading-tight" style={{ color }}>
                {event.name}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {event.xpMultiplier > 1 && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold"
                    style={{
                      color,
                      borderColor: `color-mix(in srgb, ${color} 30%, transparent)`,
                      background: `color-mix(in srgb, ${color} 12%, transparent)`,
                    }}
                  >
                    <Zap size={10} />
                    {event.xpMultiplier}x XP
                  </span>
                )}
                <span className="text-[11px] font-medium text-[var(--foreground-subtle)]">
                  {daysLeft}d left
                </span>
              </div>
            </div>
            {event.description ? (
              <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-[var(--foreground-muted)] sm:line-clamp-1">
                {event.description}
              </p>
            ) : null}
            {event.locked ? (
              <a
                href="/premium"
                className="mt-1.5 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold sm:mt-1"
                style={{
                  color,
                  borderColor: `color-mix(in srgb, ${color} 30%, transparent)`,
                }}
              >
                <Lock size={10} />
                Unlock Premium
              </a>
            ) : null}
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss seasonal banner"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--foreground-subtle)] transition-colors hover:bg-[var(--palette-white)]/5 hover:text-[var(--foreground)]"
          >
            <X size={14} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
