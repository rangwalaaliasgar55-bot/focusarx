import { AlertTriangle, ArrowUpRight, RefreshCw, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

function debugEnabled(): boolean {
  try {
    if (typeof window !== "undefined" && window.localStorage.getItem("focusarx:debug") === "1") return true;
  } catch {
    /* storage unavailable */
  }
  return false;
}

/** Presentational error slot. The `message` prop is shown verbatim by design
 *  (callers pass server envelopes) — pass raw internals as `details` instead:
 *  they only render with debug mode enabled. */
export function ErrorState({
  title = "Something went wrong",
  message = "We couldn't load this. Check your connection and try again.",
  details,
  onRetry,
  compact = false,
  className,
}: {
  title?: string;
  message?: string;
  details?: string | null;
  onRetry: () => void;
  compact?: boolean;
  className?: string;
}) {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;

  if (compact) {
    return (
      <div
        className={cn(
          "rounded-xl border border-[color-mix(in_srgb,var(--danger)_28%,transparent)] bg-[var(--danger-soft)] p-3 text-left",
          className,
        )}
        role="alert"
      >
        <div className="flex items-start gap-2">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[var(--danger)]" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[var(--foreground)]">{offline ? "You're offline" : title}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-[var(--foreground-muted)]">
              {offline ? "Reconnect and this will load on its own." : message}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="mt-2.5 inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-[var(--brand-600)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--neutral-0)] hover:bg-[var(--brand-700)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-400)]"
        >
          <RefreshCw size={12} aria-hidden /> {offline ? "Reconnect" : "Retry"}
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn("mx-auto my-12 max-w-md rounded-[var(--radius-2xl)] border border-[var(--border-subtle)] bg-[var(--surface)] p-8 text-center shadow-[var(--shadow-sm)]", className)}
      role="alert"
    >
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--danger-soft)] text-[var(--danger)]">
        <AlertTriangle size={20} aria-hidden />
      </span>
      <h2 className="mt-4 text-lg font-semibold tracking-tight text-[var(--foreground)]">
        {offline ? "You're offline" : title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">
        {offline ? "Reconnect to load this view — nothing you did will be lost." : message}
      </p>
      {details && debugEnabled() && (
        <details className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] px-4 py-2.5 text-left">
          <summary className="cursor-pointer text-xs font-semibold text-[var(--foreground-subtle)]">
            Technical details (debug mode)
          </summary>
          <p className="mt-2 break-words text-left font-mono text-[0.6875rem] leading-relaxed text-[var(--foreground-muted)]">
            {details}
          </p>
        </details>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--brand-600)] px-4 text-sm font-semibold text-[var(--neutral-0)] hover:bg-[var(--brand-700)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-400)]"
        >
          <RefreshCw size={14} aria-hidden /> Retry
        </button>
        <a
          href="/support"
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3.5 text-sm font-medium text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
        >
          Get help <ArrowUpRight size={14} aria-hidden />
        </a>
      </div>
      {offline && (
        <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-[var(--foreground-subtle)]">
          <WifiOff size={13} aria-hidden /> Offline edits are queued and sync when you reconnect.
        </p>
      )}
    </div>
  );
}
