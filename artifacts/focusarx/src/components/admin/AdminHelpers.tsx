import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { ApiError, apiFetch } from "@/lib/api";

// ─── Data transport ─────────────────────────────────────────────────────────

/**
 * Every admin request goes through here instead of calling `fetch` directly.
 *
 * The console used to hand-roll `fetch(url, { headers: authHeaders(),
 * credentials: "include" })` in 55 places, which silently opted out of
 * everything the app's API client does: the access token lasts 15 minutes, so a
 * panel left open simply stopped working until a reload; a 401 never triggered a
 * silent refresh; the deployment-skew header was missing, so a write issued
 * against an old frontend was rejected without being queued for replay; and a
 * 4xx response body — the server's own explanation, e.g. "Flag key already
 * exists" — was thrown away in favour of a generic "Request failed".
 *
 * A straight swap to `apiFetch` would have been a regression, though: it throws
 * on every non-2xx, while these panels branch on `res.ok`. So the adapter
 * catches and re-materialises the failure as a `Response` carrying the status
 * and the server's envelope. Existing call sites keep working untouched, and
 * `!res.ok` branches now display the real message. Network-level failures become
 * a 504 rather than an unhandled rejection that leaves the panel spinning.
 */
export async function adminFetch(
  path: string,
  init: RequestInit = {},
  options: { silent?: boolean } = {},
): Promise<Response> {
  let response: Response;
  try {
    response = await apiFetch(path, init);
  } catch (err) {
    if (err instanceof ApiError) {
      const body =
        err.data && typeof err.data === "object"
          ? JSON.stringify(err.data)
          : JSON.stringify({ error: { code: "REQUEST_FAILED", message: err.message } });
      response = new Response(body, { status: err.status, headers: { "Content-Type": "application/json" } });
    } else {
      response = new Response(
        JSON.stringify({
          error: {
            code: "NETWORK",
            message: "FocusArx could not be reached. Nothing was changed — try again.",
          },
        }),
        { status: 504, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  // Twenty of the twenty-eight panels have no error state at all: a rejected
  // write looked exactly like an accepted one, and a failed load looked like an
  // empty table. `ToastProvider` already listens for this event, so every call
  // site gets a message without 55 edits — panels that render the failure
  // inline pass `{ silent: true }` instead of duplicating it. 401 is left to the
  // session layer, which already tells the user what happened.
  if (!options.silent && !response.ok && response.status !== 401) {
    const message = await describeFailure(response);
    const now = Date.now();
    if (message && announced.get(message) !== now && (announced.get(message) ?? 0) < now - ANNOUNCE_DEDUPE_MS) {
      announced.set(message, now);
      window.dispatchEvent(new CustomEvent("focusarx:api-error", { detail: { message } }));
    }
  }

  return response;
}

const ANNOUNCE_DEDUPE_MS = 1_500;
const announced = new Map<string, number>();

/** The server's own wording, if it sent one; a plain sentence if it didn't. */
async function describeFailure(response: Response): Promise<string | null> {
  const fallback = `That didn't go through (${response.status}).`;
  const text = await response.clone().text().catch(() => "");
  if (!text) return fallback;
  try {
    const data = JSON.parse(text) as { error?: unknown };
    const error = data?.error;
    const message =
      typeof error === "string" ? error : typeof (error as { message?: unknown })?.message === "string"
        ? ((error as { message: string }).message ?? "")
        : "";
    // `apiFetch` falls back to `Request failed (502)` when a proxy answers with
    // no envelope at all; that number is a log line, not something to show an
    // operator. Anything else is the route's own sentence and gets used verbatim.
    const trimmed = message.trim();
    if (!trimmed || /^Request failed \(\d+\)$/.test(trimmed)) return fallback;
    return trimmed;
  } catch {
    /* HTML/plain-text error page (proxy, rate limiter) — fall through */
    return fallback;
  }
}

// ─── Stat Card ──────────────────────────────────────────────────────────────

export function StatCard({ label, value, accent, sub }: { label: string; value: string; accent?: "rose" | "sky" | "violet" | "amber" | "emerald"; sub?: string }) {
  const configs = {
    rose: { text: "text-[var(--palette-rose-400)]", bg: "bg-[var(--palette-rose-500)]/10", border: "border-[var(--palette-rose-500)]/20" },
    sky: { text: "text-[var(--palette-sky-400)]", bg: "bg-[var(--palette-sky-500)]/10", border: "border-[var(--palette-sky-500)]/20" },
    violet: { text: "text-[var(--palette-violet-400)]", bg: "bg-[var(--palette-violet-500)]/10", border: "border-[var(--palette-violet-500)]/20" },
    amber: { text: "text-[var(--palette-amber-400)]", bg: "bg-[var(--palette-amber-500)]/10", border: "border-[var(--palette-amber-500)]/20" },
    emerald: { text: "text-[var(--palette-emerald-400)]", bg: "bg-[var(--palette-emerald-500)]/10", border: "border-[var(--palette-emerald-500)]/20" },
  };
  const config = accent ? configs[accent] : { text: "text-[var(--palette-zinc-100)]", bg: "bg-[var(--palette-zinc-800)]/10", border: "border-[var(--palette-zinc-800)]/40" };

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className={`rounded-[var(--radius-xl)] border ${config.border} ${config.bg} p-4 shadow-[var(--shadow-sm)] backdrop-blur-xl transition-all sm:p-5`}
    >
      <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[var(--foreground-subtle)]">{label}</p>
      <p className={`text-2xl font-bold ${config.text} tracking-tight tabular-nums sm:text-3xl`}>{value}</p>
      {sub && <p className="mt-2 inline-block rounded-full bg-[var(--surface-hover)] px-2 py-0.5 text-[0.6875rem] font-medium text-[var(--foreground-muted)]">{sub}</p>}
    </motion.div>
  );
}

// ─── Section Header ─────────────────────────────────────────────────────────

export function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <header className="mb-6 border-b border-[var(--border-subtle)] pb-5">
      <p className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[var(--danger)]">Administration</p>
      <h1 className="text-balance text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">{title}</h1>
      {sub && <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[var(--foreground-muted)]">{sub}</p>}
    </header>
  );
}

// ─── Badge ──────────────────────────────────────────────────────────────────

export function Badge({ label, color }: { label: string; color: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${color}`}>{label}</span>;
}

// ─── Motion Tab Wrapper ─────────────────────────────────────────────────────

export function MotionTab({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="mx-auto max-w-[100rem] space-y-6"
    >
      {children}
    </motion.div>
  );
}

// ─── Admin Card ─────────────────────────────────────────────────────────────

export function AdminCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/40 p-5 ${className}`}>
      {children}
    </div>
  );
}

// ─── Admin Form Card (for input forms) ──────────────────────────────────────

export function AdminFormCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--palette-violet-800)]/50 bg-[var(--palette-violet-950)]/20 p-5 space-y-3">
      <p className="text-xs font-semibold text-[var(--palette-violet-300)] uppercase tracking-wider">{title}</p>
      {children}
    </div>
  );
}

// ─── Admin Panel Card ───────────────────────────────────────────────────────

export function AdminPanelCard({ title, subtitle, actions, children }: {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-950)]/40 p-5">
      {(title || actions) && (
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          {title && (
            <div>
              <h3 className="text-sm font-semibold text-[var(--palette-zinc-100)]">{title}</h3>
              {subtitle && <p className="mt-0.5 text-xs text-[var(--palette-zinc-500)]">{subtitle}</p>}
            </div>
          )}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Loading State ──────────────────────────────────────────────────────────

export function LoadingState({ text = "Loading…" }: { text?: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex items-center gap-3 text-sm text-[var(--palette-zinc-500)]">
        <RefreshCw size={14} className="animate-spin" />
        {text}
      </div>
    </div>
  );
}

// ─── Empty State ────────────────────────────────────────────────────────────

export function EmptyState({ icon, title, description, action }: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--palette-zinc-800)] p-10 text-center">
      {icon && <div className="mx-auto mb-3 text-[var(--palette-zinc-600)]">{icon}</div>}
      <p className="text-sm font-medium text-[var(--palette-zinc-300)]">{title}</p>
      {description && <p className="mt-1 text-xs text-[var(--palette-zinc-500)]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ─── Status Badge ───────────────────────────────────────────────────────────

export function StatusBadge({ status }: { status: "live" | "upcoming" | "ended" | "cancelled" | "active" | "inactive" | "sent" | "failed" | "pending" }) {
  const styles: Record<string, string> = {
    live: "bg-[var(--palette-emerald-500)]/15 text-[var(--palette-emerald-400)]",
    active: "bg-[var(--palette-emerald-500)]/15 text-[var(--palette-emerald-400)]",
    upcoming: "bg-[var(--palette-amber-500)]/15 text-[var(--palette-amber-400)]",
    ended: "bg-[var(--palette-zinc-700)]/40 text-[var(--palette-zinc-400)]",
    inactive: "bg-[var(--palette-zinc-700)]/40 text-[var(--palette-zinc-400)]",
    cancelled: "bg-[var(--palette-rose-500)]/15 text-[var(--palette-rose-400)]",
    sent: "bg-[var(--palette-emerald-950)] text-[var(--palette-emerald-400)]",
    failed: "bg-[var(--palette-red-950)] text-[var(--palette-red-400)]",
    pending: "bg-[var(--palette-zinc-800)] text-[var(--palette-zinc-400)]",
  };
  return (
    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[0.5625rem] font-semibold uppercase tracking-wide ${styles[status] ?? styles.pending}`}>
      {status}
    </span>
  );
}

// ─── Form Input ─────────────────────────────────────────────────────────────

export function FormInput({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[0.6875rem] font-medium text-[var(--palette-zinc-400)]">{label}</label>
      {children}
    </div>
  );
}

// ─── Quick Action Button ────────────────────────────────────────────────────

export function QuickActionButton({ onClick, loading, disabled, variant = "default", children }: {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "default" | "danger" | "success" | "primary";
  children: React.ReactNode;
}) {
  const variants = {
    default: "border border-[var(--palette-zinc-700)] text-[var(--palette-zinc-400)] hover:text-[var(--palette-zinc-200)]",
    primary: "bg-[var(--palette-violet-700)] hover:bg-[var(--palette-violet-600)] text-[var(--palette-white)] font-medium",
    success: "bg-[var(--palette-emerald-700)] hover:bg-[var(--palette-emerald-600)] text-[var(--palette-white)] font-medium",
    danger: "border border-[var(--palette-rose-800)] text-[var(--palette-rose-400)] hover:bg-[var(--palette-rose-950)]",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`rounded-lg px-3 py-1.5 text-xs flex items-center gap-1 transition disabled:opacity-50 ${variants[variant]}`}
    >
      {loading && <RefreshCw size={12} className="animate-spin" />}
      {children}
    </button>
  );
}
