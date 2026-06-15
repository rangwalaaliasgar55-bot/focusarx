import { Component, type ReactNode, type ErrorInfo } from "react";
import { isChunkLoadError } from "@/lib/lazyWithReload";

const RELOAD_FLAG = "focusarx:chunk-reloaded";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // A stale chunk after a new deploy can throw synchronously past the lazy
    // retry — recover with a single hard reload instead of an error screen.
    if (isChunkLoadError(error) && !sessionStorage.getItem(RELOAD_FLAG)) {
      sessionStorage.setItem(RELOAD_FLAG, "1");
      window.location.reload();
      return;
    }
    console.error("[ErrorBoundary]", error, info.componentStack);
    this.props.onError?.(error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
          <div className="mb-3 text-3xl">⚠️</div>
          <p className="mb-1 text-sm font-semibold text-[#E2E8F0]">Something went wrong</p>
          <p className="mb-4 max-w-xs text-xs text-[#94A3B8]">
            {this.state.error?.message ?? "An unexpected error occurred."}
          </p>
          <button
            onClick={this.handleReset}
            className="rounded-xl bg-[rgba(124,58,237,0.2)] border border-[rgba(124,58,237,0.3)] px-4 py-2 text-xs font-semibold text-[#A78BFA] transition-colors hover:bg-[rgba(124,58,237,0.3)]"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
