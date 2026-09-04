import { useEffect, useState } from "react";

/**
 * Live "focusing right now" counter (Phase 4.6).
 *
 * Real by construction (counts live `active_sessions` rows server-side).
 * Fail-silent: hides on error, zero, or while loading — a missing counter
 * is always better than a fabricated one.
 */
export default function FocusingNow() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stats/focusing-now", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { focusingNow?: number | null } | null) => {
        if (cancelled) return;
        const n = d?.focusingNow;
        setCount(typeof n === "number" && n > 0 ? n : null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (count == null) return null;
  return (
    <span className="inline-flex items-center gap-2" role="status" aria-live="polite">
      <span className="relative flex h-2 w-2" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--success)] opacity-60 motion-reduce:animate-none" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--success)]" />
      </span>
      {count.toLocaleString()} focusing right now
    </span>
  );
}
