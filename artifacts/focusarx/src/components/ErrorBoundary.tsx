import { Component, type ErrorInfo, type ReactNode } from "react";
import { ArrowUpRight, RefreshCw, WifiOff } from "lucide-react";
import { BrandMark } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { isChunkLoadError, recoverFromChunkError } from "@/lib/chunkRecovery";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
  /** Context label shown in the recovery panel (e.g. "the admin console"). */
  fallbackTitle?: string;
  fallbackMessage?: string;
  /** Changing this value clears a caught error — lets parents retry tabs. */
  resetKey?: string | number | null;
  onReset?: () => void;
  /** Render the recovery panel on the dark developer-console material. */
  variant?: "default" | "dark";
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/** Safe, human copy — a raw Error.message can carry SQL, tokens or paths. */
const FRIENDLY_MESSAGE =
  "An unexpected problem interrupted this view. Your data is safe — reload the view to continue.";

function debugEnabled(): boolean {
  try {
    if (typeof window === "undefined") return false;
    if (window.localStorage.getItem("focusarx:debug") === "1") return true;
  } catch {
    /* storage unavailable */
  }
  return false;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Always keep the real diagnostic in the console — the sanitized UI copy
    // must never hide a crash from a developer's F12.
    console.error("[ErrorBoundary]", error, info.componentStack);
    this.props.onError?.(error, info);
  }

  componentDidUpdate(previous: Props) {
    if (
      this.state.hasError &&
      previous.resetKey !== this.props.resetKey &&
      !isChunkLoadError(this.state.error)
    ) {
      this.setState({ hasError: false, error: null });
      this.props.onReset?.();
    }
  }

  private handleRetry = () => {
    // If the view failed because its lazy chunk is stale (a deploy replaced the
    // hashed filename), clearing the error state just re-runs the same failed
    // import. Reload instead so the new index.html is picked up.
    if (isChunkLoadError(this.state.error) && recoverFromChunkError()) return;
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    const dark = this.props.variant === "dark";
    const title = offline ? "You're offline" : (this.props.fallbackTitle ?? "This view hit a snag");
    const message = offline
      ? "FocusArx needs a connection for this view. Reconnect and try again — nothing was lost."
      : (this.props.fallbackMessage ?? FRIENDLY_MESSAGE);

    if (dark) {
      return (
        <section className="dev-console-page" role="alert">
          <div className="mx-auto flex min-h-[16rem] max-w-md flex-col items-center justify-center py-10 text-center">
            <BrandMark className="h-12 w-12 opacity-90" />
            <h1 className="mt-5 text-lg font-semibold tracking-tight text-white">{title}</h1>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/50">{message}</p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={this.handleRetry}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/12 px-4 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] hover:bg-white/16"
              >
                <RefreshCw size={14} aria-hidden /> Reload section
              </button>
            </div>
          </div>
        </section>
      );
    }

    return (
      <section className="page-container" role="alert">
        <div className="mx-auto flex min-h-[22rem] max-w-md flex-col items-center justify-center text-center">
          <BrandMark className="h-14 w-14 opacity-90" />
          <h1 className="mt-6 text-xl font-semibold tracking-tight text-[var(--foreground)]">{title}</h1>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--foreground-muted)]">{message}</p>

          {!offline && debugEnabled() && this.state.error?.message && (
            <details className="mt-4 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] px-4 py-3 text-left">
              <summary className="cursor-pointer text-xs font-semibold text-[var(--foreground-subtle)]">
                Technical details (debug mode)
              </summary>
              <p className="mt-2 break-words font-mono text-[0.6875rem] leading-relaxed text-[var(--foreground-muted)]">
                {this.state.error.message}
              </p>
            </details>
          )}

          <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
            <Button onClick={this.handleRetry}>
              <RefreshCw /> {offline ? "Try again" : "Reload view"}
            </Button>
            <Button asChild variant="ghost">
              <a href="/support">
                Get help <ArrowUpRight aria-hidden />
              </a>
            </Button>
          </div>

          {offline && (
            <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-[var(--foreground-subtle)]">
              <WifiOff size={13} aria-hidden /> Changes made while offline are queued and synced on reconnection.
            </p>
          )}
        </div>
      </section>
    );
  }
}

export default ErrorBoundary;
