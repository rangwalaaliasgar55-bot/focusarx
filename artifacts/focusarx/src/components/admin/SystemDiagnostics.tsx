import { useCallback, useEffect, useState } from "react";
import { Activity, Database, GitCompareArrows, RefreshCw, Server, Users, Wind } from "lucide-react";
import { FRONTEND_DEPLOYMENT_VERSION, isVersionCompatible, useDeploymentSkew } from "@/lib/deploymentSkew";

/**
 * System diagnostics — the one card that answers "is it us or is it down?"
 * ══════════════════════════════════════════════════════════════════
 * During the study-rooms 500s and the deployment-skew incident, the only way
 * to tell what was broken was four browser tabs and the Vercel logs. Every
 * signal needed was already exposed by an endpoint: /api/deployment names the
 * build the server runs, /api/healthz/ready separates "the function is alive"
 * from "the database answers", /api/study-rooms is the endpoint that actually
 * 500'd, and the service worker plus the skew detector explain the client half.
 *
 * This card puts those six answers in one compact panel on the admin overview,
 * each with its own loading and error state — a diagnostics card that spins
 * forever or shows a bare "error" is worse than none, because it reads as
 * "the diagnostics are broken" rather than "the database is down".
 *
 * It is deliberately read-only and unauthenticated-endpoint-only: nothing here
 * needs admin scope, so the card degrades to honest unknowns instead of 403s.
 */

type Status = "loading" | "ok" | "warn" | "error";

interface Row {
  id: string;
  icon: typeof Server;
  label: string;
  detail: string;
  status: Status;
}

interface DeploymentInfo {
  version?: string;
  knownIds?: string[];
  skewProtectionAvailable?: boolean;
}

interface ReadyInfo {
  ready?: boolean;
  database?: boolean;
  config?: { ok?: boolean; errors?: string[] };
}

/** First paint and every re-check: six rows, all probing. */
const loadingRows = (): Record<string, Row> => ({
  build: { id: "build", icon: GitCompareArrows, label: "Deployment", detail: "asking the server…", status: "loading" },
  api: { id: "api", icon: Server, label: "API", detail: "probing /healthz…", status: "loading" },
  db: { id: "db", icon: Database, label: "Database", detail: "probing readiness…", status: "loading" },
  rooms: { id: "rooms", icon: Users, label: "Study rooms", detail: "loading rooms…", status: "loading" },
  sw: { id: "sw", icon: Wind, label: "Service worker", detail: "checking registration…", status: "loading" },
  skewRow: { id: "skewRow", icon: Activity, label: "Skew state", detail: "…", status: "loading" },
});

const short = (v: string | null | undefined) => (v ? (v.length > 12 ? `${v.slice(0, 12)}…` : v) : "unknown");

async function getJson(url: string, signal: AbortSignal): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, { signal, cache: "no-store" });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // A non-JSON probe answer is itself a finding; keep the status code.
  }
  return { status: res.status, body };
}

export function SystemDiagnostics() {
  const skew = useDeploymentSkew();
  const [rows, setRows] = useState<Record<string, Row>>(loadingRows);
  const [checking, setChecking] = useState(true);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  const patch = (row: Row) => setRows((prev) => ({ ...prev, [row.id]: row }));

  const check = useCallback(async () => {
    setChecking(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const signal = controller.signal;

    setRows(loadingRows());

    try {
      // Deployment identity: is the build in the browser the build on the server?
      try {
        const { status, body } = await getJson("/api/deployment", signal);
        const info = (body ?? {}) as DeploymentInfo;
        if (status !== 200 || !info.version) {
          patch({ id: "build", icon: GitCompareArrows, label: "Deployment", detail: `/api/deployment answered ${status}`, status: "error" });
        } else {
          const compatible = isVersionCompatible(FRONTEND_DEPLOYMENT_VERSION, info.knownIds ?? info.version);
          patch({
            id: "build",
            icon: GitCompareArrows,
            label: "Deployment",
            detail: compatible
              ? `this build (${short(FRONTEND_DEPLOYMENT_VERSION)}) is live on the server`
              : `browser ${short(FRONTEND_DEPLOYMENT_VERSION)} vs server ${short(info.version)}`,
            status: compatible ? "ok" : "warn",
          });
        }
      } catch {
        patch({ id: "build", icon: GitCompareArrows, label: "Deployment", detail: "unreachable", status: "error" });
      }

      // API liveness and database readiness, from the combined probe.
      try {
        const { status, body } = await getJson("/api/healthz/ready", signal);
        const info = (body ?? {}) as ReadyInfo;
        patch({
          id: "api",
          icon: Server,
          label: "API",
          detail: status === 200 ? "serving requests" : `readiness probe returned ${status}`,
          status: status === 200 ? "ok" : "error",
        });
        const configError = info.config?.ok === false ? info.config.errors?.[0] : undefined;
        patch({
          id: "db",
          icon: Database,
          label: "Database",
          detail: info.database ? "connected" : configError ? `config: ${configError}` : "probe failed — no connection",
          status: info.database ? "ok" : configError ? "warn" : "error",
        });
      } catch {
        patch({ id: "api", icon: Server, label: "API", detail: "unreachable", status: "error" });
        patch({ id: "db", icon: Database, label: "Database", detail: "unknown — the probe never answered", status: "warn" });
      }

      // The endpoint behind the production 500s: worth its own row.
      try {
        const { status, body } = await getJson("/api/study-rooms", signal);
        const list = Array.isArray(body) ? body : ((body as { rooms?: unknown[] })?.rooms ?? null);
        patch({
          id: "rooms",
          icon: Users,
          label: "Study rooms",
          detail:
            status === 200
              ? `${Array.isArray(list) ? list.length : "?"} room(s) listed`
              : `HTTP ${status} — the rooms endpoint is failing`,
          status: status === 200 ? "ok" : "error",
        });
      } catch {
        patch({ id: "rooms", icon: Users, label: "Study rooms", detail: "unreachable", status: "error" });
      }

      // Client half: the service worker and the skew detector.
      if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          const active = reg?.active;
          patch({
            id: "sw",
            icon: Wind,
            label: "Service worker",
            detail: active ? `active (${active.state})` : reg?.waiting ? "installed, waiting to activate" : "registered but not controlling",
            status: active ? "ok" : "warn",
          });
        } catch {
          patch({ id: "sw", icon: Wind, label: "Service worker", detail: "registration unreadable", status: "warn" });
        }
      } else {
        patch({ id: "sw", icon: Wind, label: "Service worker", detail: "not supported in this browser", status: "warn" });
      }

      patch({
        id: "skewRow",
        icon: Activity,
        label: "Skew state",
        detail: skew.mismatch
          ? `server moved to ${short(skew.serverVersion)} — banner shown`
          : skew.serverVersion
            ? `in sync with ${short(skew.serverVersion)}`
            : "no server version seen yet",
        status: skew.mismatch ? "warn" : "ok",
      });

      setCheckedAt(new Date());
    } finally {
      clearTimeout(timer);
      setChecking(false);
    }
  }, [skew.mismatch, skew.serverVersion]);

  // Deferred a tick: the react-hooks lint rule (rightly) flags a setState that
  // runs synchronously inside an effect, and the first probe state is exactly
  // that. A 0 ms timer keeps the initial paint as the loading rows.
  useEffect(() => {
    const timer = setTimeout(() => void check(), 0);
    return () => clearTimeout(timer);
  }, [check]);

  const list = Object.values(rows);

  return (
    <section aria-label="System diagnostics" className="ui-panel p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-[var(--foreground)]">System diagnostics</h3>
          <p className="mt-0.5 text-xs text-[var(--muted-fg)]">
            {checkedAt
              ? `Checked at ${checkedAt.toLocaleTimeString("en-IN", { hour12: false })} IST-local`
              : "Checking the deployment, the API and this browser…"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void check()}
          disabled={checking}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-2.5 py-1.5 text-xs font-medium text-[var(--muted-fg)] transition-colors hover:text-[var(--foreground)] disabled:opacity-50"
        >
          <RefreshCw size={12} className={checking ? "animate-spin" : undefined} aria-hidden="true" />
          Re-check
        </button>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((row) => (
          <li
            key={row.id}
            className="flex items-start gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)]/40 px-3 py-2.5"
          >
            <row.icon size={14} className="mt-0.5 shrink-0 text-[var(--muted-fg)]" aria-hidden="true" />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--foreground)]">
                <span
                  aria-hidden="true"
                  className={`inline-block h-1.5 w-1.5 rounded-full ${DOT[row.status]}`}
                />
                {row.label}
              </p>
              <p className="mt-0.5 truncate text-[11px] leading-snug text-[var(--muted-fg)]" title={row.detail}>
                {row.detail}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const DOT: Record<Status, string> = {
  loading: "bg-[var(--muted-fg)]/50 animate-pulse",
  ok: "bg-emerald-400",
  warn: "bg-amber-400",
  error: "bg-red-400",
};
