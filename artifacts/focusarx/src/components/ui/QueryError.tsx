import { RefreshCw, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface QueryErrorProps {
  /** What failed to load, e.g. "your goals". */
  what: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}

/**
 * Compact, consistent "couldn't load" block for react-query failures. Pages
 * used to fall through to their empty state on error, which told users they
 * had *no data* when the request had simply failed.
 */
export function QueryError({ what, onRetry, retrying, className }: QueryErrorProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-1)] px-6 py-10 text-center",
        className,
      )}
    >
      <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--color-error)]/10 text-[var(--color-error)]" aria-hidden>
        <WifiOff size={18} />
      </span>
      <div>
        <p className="text-sm font-semibold text-[var(--foreground)]">Couldn't load {what}</p>
        <p className="mt-1 text-xs text-[var(--foreground-subtle)]">Check your connection, then try again.</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border-strong)] px-4 text-xs font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-60"
        >
          <RefreshCw size={13} className={retrying ? "animate-spin" : ""} /> Try again
        </button>
      )}
    </div>
  );
}
