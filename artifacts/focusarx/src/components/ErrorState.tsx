import { AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/** `compact` fits narrow side panels and inline slots; the default is a full-width page-level block. */
export function ErrorState({
  title = "Something went wrong",
  message = "We couldn't load this page. Check your connection and try again.",
  onRetry,
  compact = false,
  className,
}: {
  title?: string;
  message?: string;
  onRetry: () => void;
  compact?: boolean;
  className?: string;
}) {
  if (compact) {
    return (
      <div
        className={cn(
          "rounded-xl border border-[var(--rgba-239-68-68-0_25)] bg-[var(--rgba-239-68-68-0_06)] p-3 text-left",
          className,
        )}
        role="alert"
      >
        <div className="flex items-start gap-2">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[var(--color-error)]" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[var(--foreground)]">{title}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-[var(--foreground-subtle)]">{message}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="mt-2.5 inline-flex min-h-[32px] items-center gap-1.5 rounded-lg bg-[var(--brand-600)] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[var(--brand-500)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-400)]"
        >
          <RefreshCw size={12} aria-hidden /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className={cn("mx-auto my-12 max-w-md rounded-2xl border border-[var(--rgba-239-68-68-0_25)] bg-[var(--rgba-239-68-68-0_06)] p-8 text-center", className)} role="alert">
      <AlertTriangle className="mx-auto mb-3 text-[var(--color-error)]" aria-hidden />
      <h2 className="text-lg font-semibold text-[var(--foreground)]">{title}</h2>
      <p className="mt-2 text-sm text-[var(--foreground-subtle)]">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--brand-600)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-500)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-400)]"
      >
        <RefreshCw size={14} aria-hidden /> Retry
      </button>
    </div>
  );
}
