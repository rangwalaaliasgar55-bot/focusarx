import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
    this.props.onError?.(error, info);
  }

  private handleRetry = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <section className="page-container" role="alert">
        <div className="mx-auto flex min-h-[24rem] max-w-xl flex-col items-center justify-center rounded-[var(--radius-2xl)] border border-[color-mix(in_srgb,var(--danger)_24%,transparent)] bg-[var(--danger-soft)] p-8 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-[var(--radius-xl)] bg-[var(--surface)] text-[var(--danger)] shadow-[var(--shadow-sm)]">
            <AlertTriangle size={24} aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-xl font-semibold text-[var(--foreground)]">This view hit a snag</h1>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--foreground-muted)]">
            {this.state.error?.message || "We couldn't render this page. Your data is safe; try loading the view again."}
          </p>
          <Button className="mt-6" onClick={this.handleRetry}><RefreshCw /> Retry</Button>
        </div>
      </section>
    );
  }
}

export default ErrorBoundary;
