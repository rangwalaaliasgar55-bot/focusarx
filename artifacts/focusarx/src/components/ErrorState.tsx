import { AlertTriangle, RefreshCw } from "lucide-react";

export function ErrorState({
  title = "Something went wrong",
  message = "We couldn't load this page. Check your connection and try again.",
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry: () => void;
}) {
  return (
    <div className="mx-auto my-12 max-w-md rounded-2xl border border-[var(--rgba-239-68-68-0_25)] bg-[var(--rgba-239-68-68-0_06)] p-8 text-center" role="alert">
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
