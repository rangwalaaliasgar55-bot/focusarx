/**
 * Admin SQL console (Workstream F).
 *
 * Read mode is always available. Write mode needs the typed unlock phrase
 * (15-minute server-side window). Destructive statements require an
 * explicit second confirmation. Every statement is server-logged to the
 * insert-only admin_sql_log table.
 *
 * Self-contained admin component (same pattern as GeminiPanel).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle, ClipboardCopy, Database, GitBranch, History, LockKeyhole, Play,
  ShieldAlert, Terminal, Unlock,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── types ────────────────────────────────────────────────────────────────────

type Status = {
  enabled: boolean;
  writeUnlocked: boolean;
  remainingMs: number;
  windowMs: number;
  unlockPhrase: string;
  unlockedBy: string | null;
  hasUnlockRecord: boolean;
};

type StatementResult = {
  statement: string;
  kind: "read" | "write";
  destructive: boolean;
  ok: boolean;
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  truncated: boolean;
  durationMs: number;
  error?: string;
};

type LogEntry = {
  id: string;
  kind: "read" | "write";
  sql: string;
  rowsAffected: number;
  status: "ok" | "error" | "blocked";
  error: string | null;
  branchName: string | null;
  createdAt: string;
};

const SAMPLES: Array<{ label: string; sql: string }> = [
  { label: "Users by role", sql: "SELECT role, count(*) AS n FROM users GROUP BY role ORDER BY n DESC;" },
  { label: "Top focused users (30d)", sql: `SELECT u.name, u.email, sum(s.duration_minutes) AS total_min
FROM users u
JOIN focus_sessions s ON s.user_id = u.id
WHERE s.created_at > now() - interval '30 days'
GROUP BY u.id ORDER BY total_min DESC LIMIT 25;` },
  { label: "Wallet balance distribution", sql: `SELECT count(*) FILTER (WHERE balance < 100) AS under_100,
       count(*) FILTER (WHERE balance BETWEEN 100 AND 999) AS mid,
       count(*) FILTER (WHERE balance >= 1000) AS rich
FROM user_wallets;` },
  { label: "Recent coin ledger (audit)", sql: `SELECT created_at, user_id, amount, reason FROM coin_transactions ORDER BY created_at DESC LIMIT 30;` },
  { label: "Active drops + claims", sql: `SELECT d.id, d.type, d.title, d.claims, d.created_at FROM admin_drops d ORDER BY d.created_at DESC LIMIT 20;` },
];

// Client-side mirror of the server's classification (for pre-warnings only).
const WRITE_VERB = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|REPLACE|GRANT|REVOKE|REINDEX|VACUUM|COPY|COMMENT)\b/i;
const DESTRUCTIVE_VERB = /\b(DROP|TRUNCATE|ALTER)\b/i;

function splitStatements(input: string): string[] {
  // Good-enough client preview split (server re-splits with full quoting rules).
  return input.split(";").map((s) => s.trim()).filter(Boolean);
}

function classify(sql: string): { isWrite: boolean; isDestructive: boolean } {
  const bare = sql
    .replace(/--[^\n]*/g, " ")
    .replace(/'(?:''|[^'\n])*'/g, " ''");
  const isWrite = WRITE_VERB.test(bare);
  let isDestructive = DESTRUCTIVE_VERB.test(bare);
  if (!isDestructive && /\bDELETE\b/i.test(bare) && !/\bWHERE\b/i.test(bare)) isDestructive = true;
  if (!isDestructive && /\bUPDATE\b/i.test(bare) && !/\bWHERE\b/i.test(bare)) isDestructive = true;
  return { isWrite, isDestructive };
}

function fmtMs(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const NEON_BRANCH_HELP = [
  { label: "Create a restore-point branch (Neon CLI)", cmd: "npx neon branches create --name focusarx-restore-$(date +%Y%m%d-%H%M)" },
  { label: "Restore the production branch from it", cmd: "npx neon branches reset --branch main --restore-to-branch focusarx-restore-YYYYMMDD-HHMM" },
  { label: "Console: Branches → New branch → name it, run your statement, compare", cmd: "" },
];

// ── component ───────────────────────────────────────────────────────────────

export function SqlConsolePanel({ authHeaders }: { authHeaders: () => Record<string, string> }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [sql, setSql] = useState("");
  const [busy, setBusy] = useState(false);
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [unlockErr, setUnlockErr] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [results, setResults] = useState<StatementResult[] | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [branchName, setBranchName] = useState("");
  const [schemaData, setSchemaData] = useState<Record<string, Array<{ column: string; type: string }>> | null>(null);
  const [schemaExpanded, setSchemaExpanded] = useState<Set<string>>(new Set());
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/sql/status", { headers: authHeaders(), credentials: "include" });
      if (r.ok) setStatus(await r.json());
    } catch { /* panel degrades */ }
  }, [authHeaders]);

  const loadLog = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/sql/log?limit=15", { headers: authHeaders(), credentials: "include" });
      if (r.ok) {
        const d = await r.json();
        setLog(d.entries ?? []);
      }
    } catch { /* non-fatal */ }
  }, [authHeaders]);

  const loadSchema = useCallback(async () => {
    setSchemaLoading(true);
    try {
      const r = await fetch("/api/admin/schema", { headers: authHeaders(), credentials: "include" });
      if (r.ok) {
        const d = await r.json();
        setSchemaData(d.tables ?? {});
      }
    } catch { /* non-fatal */ } finally {
      setSchemaLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    void loadStatus();
    void loadLog();
    void loadSchema();
    const t = setInterval(() => void loadStatus(), 15_000);
    return () => clearInterval(t);
  }, [loadStatus, loadLog, loadSchema]);

  /*
    Escape must dismiss these dialogs. They gate destructive admin actions, and
    before this the only ways out were the backdrop and a button — both mouse
    only. Never close mid-request: dismissing while a mutation is in flight
    would hide the spinner and leave the operator guessing.
  */
  useEffect(() => {
    if (!unlockOpen && !confirmOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (unlockOpen && !unlockBusy) setUnlockOpen(false);
      else if (confirmOpen && !busy) setConfirmOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [unlockOpen, confirmOpen, unlockBusy, busy]);

  // Live countdown ticker while the write window is open.
  useEffect(() => {
    const active = Boolean(status?.writeUnlocked);
    if (active && !timerRef.current) {
      timerRef.current = setInterval(() => setNow(Date.now()), 1000);
    } else if (!active && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status?.writeUnlocked]);

  const preview = useMemo(() => {
    const stmts = splitStatements(sql);
    const classified = stmts.map((s) => ({ s, ...classify(s) }));
    return {
      count: classified.length,
      writes: classified.filter((c) => c.isWrite),
      destructive: classified.filter((c) => c.isDestructive),
    };
  }, [sql]);

  // The server's remainingMs (at last poll) is the source of truth; tick locally.
  const displayRemaining = status?.writeUnlocked ? Math.max(0, status.remainingMs - (Date.now() - now)) : 0;

  const doUnlock = async () => {
    setUnlockBusy(true);
    setUnlockErr(null);
    try {
      const r = await fetch("/api/admin/sql/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify({ phrase }),
      });
      const d = await r.json();
      if (!r.ok) {
        setUnlockErr(d.error ?? "Unlock failed");
        return;
      }
      setUnlockOpen(false);
      setPhrase("");
      setNow(Date.now());
      await loadStatus();
      await loadLog();
    } catch {
      setUnlockErr("Network error");
    } finally {
      setUnlockBusy(false);
    }
  };

  const doRun = async (destructiveConfirmed: boolean) => {
    setBusy(true);
    setRunError(null);
    setResults(null);
    try {
      const r = await fetch("/api/admin/sql/query", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify({
          query: sql,
          destructiveConfirmed,
          branchName: branchName.trim() || undefined,
        }),
      });
      const d = await r.json();
      if (r.status === 409) {
        setConfirmChecked(false);
        setConfirmOpen(true);
        return;
      }
      if (!r.ok) {
        setRunError(d.error ?? "Query failed");
        if (r.status === 403) void loadStatus();
        return;
      }
      setResults(d.statements);
      await loadLog();
    } catch {
      setRunError("Network error — nothing was executed");
    } finally {
      setBusy(false);
    }
  };

  const onRunClick = () => {
    if (!sql.trim() || disabled) return;
    if (preview.destructive.length > 0) {
      setConfirmChecked(false);
      setConfirmOpen(true);
      return;
    }
    void doRun(false);
  };

  const copy = (label: string, text: string) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const unlocked = Boolean(status?.writeUnlocked);

  const disabled = status?.enabled === false;

  const insertSelect = (table: string) => {
    setSql(`SELECT * FROM ${table} LIMIT 50;`);
    setResults(null);
    setRunError(null);
  };

  return (
    <div className="space-y-5">
      {disabled && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-300">
          <ShieldAlert size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-bold">SQL console is disabled on this deployment.</p>
            <p className="mt-1 text-xs text-red-300/80">The server sets <code>ENABLE_ADMIN_SQL=false</code> to hard-disable this page.</p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-5 xl:flex-row">
        {/* ── schema browser ── */}
        <aside className="shrink-0 xl:w-60">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-xs font-bold text-[var(--foreground-subtle)]"><Database size={14} /> Tables</span>
              <button onClick={() => void loadSchema()} disabled={schemaLoading}
                className="text-[11px] text-[var(--foreground-subtle)] hover:text-[var(--foreground)] disabled:opacity-40">
                {schemaLoading ? "Loading…" : "↺ refresh"}
              </button>
            </div>
            {schemaData ? (
              <div className="max-h-[420px] space-y-0.5 overflow-y-auto pr-1">
                {Object.entries(schemaData).map(([table, cols]) => (
                  <div key={table}>
                    <button
                      onClick={() => {
                        setSchemaExpanded((prev) => {
                          const n = new Set(prev);
                          if (n.has(table)) n.delete(table); else n.add(table);
                          return n;
                        });
                        insertSelect(table);
                      }}
                      className="w-full truncate rounded-md px-2 py-1 text-left font-mono text-[11px] text-violet-300/90 hover:bg-white/5 hover:text-violet-200"
                    >
                      {table} <span className="text-[var(--foreground-subtle)]/60">({cols.length})</span>
                    </button>
                    {schemaExpanded.has(table) && (
                      <div className="mb-1 space-y-0.5 pl-3">
                        {cols.map((c) => (
                          <div key={c.column} className="font-mono text-[10px] text-[var(--foreground-subtle)]">
                            <span className="text-[var(--foreground-muted)]">{c.column}</span> <span className="opacity-60">{c.type}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-[var(--foreground-subtle)]">{schemaLoading ? "Loading schema…" : "Schema unavailable."}</p>
            )}
          </div>
        </aside>

        {/* ── console (status + editor + results) ── */}
        <div className="min-w-0 flex-1 space-y-5">
      {/* ── status bar ── */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-5 py-4">
        {unlocked ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-300">
            <Unlock size={13} /> WRITE MODE UNLOCKED · {fmtMs(displayRemaining)} left
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-xs font-bold text-amber-300">
            <LockKeyhole size={13} /> READ-ONLY MODE
          </span>
        )}
        <div className="flex items-center gap-2 text-xs text-[var(--foreground-subtle)]">
          <Terminal size={14} />
          <span>{preview.count} statement{preview.count === 1 ? "" : "s"} in editor</span>
          {preview.writes.length > 0 && <span className="text-amber-300 font-semibold">· {preview.writes.length} write</span>}
          {preview.destructive.length > 0 && <span className="text-red-400 font-semibold">· {preview.destructive.length} DESTRUCTIVE</span>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-[var(--foreground-subtle)]">
            <GitBranch size={13} />
            <span className="hidden sm:inline">Restore-point branch (optional):</span>
            <input
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder="focusarx-restore-…"
              className="w-44 rounded-lg border border-[var(--border)] bg-transparent px-2.5 py-1.5 text-xs text-[var(--foreground)] outline-none focus:border-violet-500/50"
            />
          </label>
          <button
            onClick={() => { setUnlockOpen(true); setPhrase(""); setUnlockErr(null); }}
            disabled={unlocked}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-colors",
              unlocked
                ? "cursor-not-allowed bg-white/5 text-[var(--foreground-subtle)]"
                : "bg-amber-500/15 border border-amber-500/40 text-amber-200 hover:bg-amber-500/25"
            )}
          >
            <Unlock size={14} /> Unlock write mode (15 min)
          </button>
        </div>
      </div>

      {/* ── editor ── */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <p className="text-sm font-bold">Query editor</p>
          <select
            onChange={(e) => {
              const s = SAMPLES.find((x) => x.label === e.target.value);
              if (s) setSql(s.sql);
              e.target.value = "";
            }}
            defaultValue=""
            className="rounded-lg border border-[var(--border)] bg-transparent px-2 py-1.5 text-xs text-[var(--foreground-muted)] outline-none"
          >
            <option value="" disabled>Load a sample…</option>
            {SAMPLES.map((s) => (
              <option key={s.label} value={s.label}>{s.label}</option>
            ))}
          </select>
          <button
            onClick={onRunClick}
            disabled={busy || !sql.trim() || disabled}
            className={cn(
              "ml-auto inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all",
              busy || !sql.trim() || disabled
                ? "cursor-not-allowed bg-white/5 text-[var(--foreground-subtle)]"
                : preview.destructive.length > 0
                  ? "bg-red-500/20 border border-red-500/40 text-red-200 hover:bg-red-500/30"
                  : preview.writes.length > 0 && !unlocked
                    ? "bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30"
                    : "bg-violet-600 text-white hover:bg-violet-500"
            )}
          >
            <Play size={15} /> {busy ? "Running…" : "Run"}
          </button>
        </div>
        <textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          spellCheck={false}
          rows={9}
          placeholder={
            "SELECT count(*) FROM users;\n\nMulti-statement scripts are supported (split on ';').\nWrite statements (INSERT/UPDATE/DELETE/DDL) need write mode unlocked."
          }
          className="w-full resize-y rounded-xl border border-[var(--border)] bg-black/30 p-4 font-mono text-[13px] leading-relaxed text-[var(--foreground)] outline-none focus:border-violet-500/50"
        />
        {runError && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {runError}
          </div>
        )}
      </div>

      {/* ── results ── */}
      {results && (
        <div className="space-y-3">
          {results.map((r, i) => (
            <div key={i} className={cn("rounded-2xl border p-5", r.ok ? "border-[var(--border)] bg-[var(--card)]" : "border-red-500/40 bg-red-500/5")}>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-xs font-bold text-[var(--foreground-subtle)]">STMT {i + 1}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", r.kind === "write" ? "bg-amber-500/15 text-amber-300" : "bg-sky-500/15 text-sky-300")}>
                  {r.kind}
                </span>
                {r.destructive && (
                  <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-red-300">destructive</span>
                )}
                <span className={cn("ml-auto text-xs font-semibold", r.ok ? "text-emerald-300" : "text-red-400")}>
                  {r.ok ? `${r.rowCount} row${r.rowCount === 1 ? "" : "s"}${r.truncated ? " (truncated)" : ""} · ${r.durationMs} ms` : "failed · " + r.durationMs + " ms"}
                </span>
              </div>
              <pre className="mb-3 max-h-24 overflow-auto rounded-lg bg-black/30 p-3 font-mono text-[11px] text-[var(--foreground-muted)] whitespace-pre-wrap break-all">{r.statement}</pre>
              {r.ok && r.columns.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-white/[0.03]">
                        {r.columns.map((c) => (
                          <th key={c} className="px-3 py-2 font-bold text-[var(--foreground-subtle)] uppercase tracking-wider text-[10px] whitespace-nowrap">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {r.rows.map((row, ri) => (
                        <tr key={ri} className="border-b border-[var(--border)]/50 last:border-0">
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-3 py-1.5 text-[var(--foreground-muted)] whitespace-nowrap max-w-[280px] overflow-hidden text-ellipsis">
                              {cell == null ? <span className="text-[var(--foreground-subtle)]/50">NULL</span> : String(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : r.ok ? (
                <p className="text-xs text-[var(--foreground-subtle)]">Executed — no rows returned.</p>
              ) : (
                <p className="font-mono text-xs text-red-300 break-all">{r.error}</p>
              )}
            </div>
          ))}
        </div>
      )}

        </div>
      </div>

      {/* ── history + Neon help (2-col) ── */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <History size={15} className="text-[var(--foreground-subtle)]" />
            <p className="text-sm font-bold">Recent executions</p>
            <button onClick={() => void loadLog()} className="ml-auto text-xs text-[var(--foreground-subtle)] hover:text-[var(--foreground)]">refresh</button>
          </div>
          {log.length === 0 ? (
            <p className="text-xs text-[var(--foreground-subtle)]">Nothing logged yet.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {log.map((e) => (
                <div key={e.id} className="rounded-xl border border-[var(--border)]/60 px-3 py-2">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                    <span className={e.kind === "write" ? "text-amber-300" : "text-sky-300"}>{e.kind}</span>
                    <span className={e.status === "ok" ? "text-emerald-300" : e.status === "error" ? "text-red-400" : "text-amber-300"}>{e.status}</span>
                    {e.rowsAffected > 0 && <span className="text-[var(--foreground-subtle)]">{e.rowsAffected} rows</span>}
                    {e.branchName && <span className="text-violet-300 flex items-center gap-1"><GitBranch size={10} />{e.branchName}</span>}
                    <span className="ml-auto text-[var(--foreground-subtle)] font-medium normal-case">{fmtTime(e.createdAt)}</span>
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-[var(--foreground-muted)] truncate">{e.sql}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="flex items-center gap-2 mb-1">
            <GitBranch size={15} className="text-violet-300" />
            <p className="text-sm font-bold">Neon branch helpers</p>
          </div>
          <p className="mb-4 text-xs text-[var(--foreground-subtle)] leading-relaxed">
            Before any destructive statement, create a Neon branch as a restore point and put its name in the
            branch field above — it's recorded in the audit log.
          </p>
          <div className="space-y-3">
            {NEON_BRANCH_HELP.map((h) => (
              <div key={h.label}>
                <p className="text-[11px] font-semibold text-[var(--foreground-muted)] mb-1">{h.label}</p>
                {h.cmd && (
                  <div className="flex items-center gap-2 rounded-lg bg-black/30 border border-[var(--border)] px-3 py-2">
                    <code className="flex-1 font-mono text-[11px] text-emerald-300 break-all">{h.cmd}</code>
                    <button onClick={() => copy(h.label, h.cmd)} className="shrink-0 text-[var(--foreground-subtle)] hover:text-[var(--foreground)]" title="Copy">
                      {copied === h.label ? <span className="text-emerald-300 text-[10px] font-bold">COPIED</span> : <ClipboardCopy size={14} />}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-violet-500/20 bg-violet-500/5 px-3 py-2.5 text-[11px] text-[var(--foreground-muted)] leading-relaxed">
            <ShieldAlert size={14} className="mt-0.5 shrink-0 text-violet-300" />
            Every statement is written to <code className="text-violet-300">admin_sql_log</code> (insert-only) with admin, kind, rows affected, status and timestamp.
          </div>
        </div>
      </div>

      {/* ── unlock modal ── */}
      {unlockOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => !unlockBusy && setUnlockOpen(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sql-unlock-title"
            className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface-2,rgba(255,255,255,0.04))] p-6 backdrop-blur-xl"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl bg-amber-500/15 p-2.5"><Unlock size={18} className="text-amber-300" /></div>
              <div>
                <h3 id="sql-unlock-title" className="text-lg font-black">Unlock write mode</h3>
                <p className="text-xs text-[var(--foreground-subtle)]">15-minute window · every statement is logged</p>
              </div>
            </div>
            <p className="mb-3 text-xs text-[var(--foreground-muted)] leading-relaxed">
              Type the phrase exactly to confirm you accept full responsibility for any SQL change made in the next 15 minutes:
            </p>
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-black/30 border border-amber-500/30 px-3 py-2.5">
              <code className="flex-1 font-mono text-sm font-bold text-amber-200">{status?.unlockPhrase ?? "FOCUSARX SQL WRITE MODE"}</code>
              <button onClick={() => setPhrase(status?.unlockPhrase ?? "")} className="text-xs font-semibold text-[var(--foreground-subtle)] hover:text-[var(--foreground)]">fill</button>
            </div>
            <input
              autoFocus
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !unlockBusy && void doUnlock()}
              placeholder="Type the phrase…"
              className="w-full rounded-xl border border-[var(--border)] bg-black/30 px-4 py-3 font-mono text-sm outline-none focus:border-amber-500/50"
            />
            {unlockErr && <p className="mt-2 text-xs text-red-400">{unlockErr}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setUnlockOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-[var(--foreground-subtle)] hover:text-[var(--foreground)]">Cancel</button>
              <button
                onClick={() => void doUnlock()}
                disabled={unlockBusy || phrase.trim().length === 0}
                className="rounded-xl bg-amber-500/20 border border-amber-500/40 px-5 py-2.5 text-sm font-bold text-amber-200 hover:bg-amber-500/30 disabled:opacity-40"
              >
                {unlockBusy ? "Unlocking…" : "Unlock for 15 minutes"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── destructive confirm modal ── */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => !busy && setConfirmOpen(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sql-confirm-title"
            className="w-full max-w-lg rounded-3xl border border-red-500/30 bg-[var(--surface-2,rgba(255,255,255,0.04))] p-6 backdrop-blur-xl"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl bg-red-500/15 p-2.5"><ShieldAlert size={18} className="text-red-400" /></div>
              <div>
                <h3 id="sql-confirm-title" className="text-lg font-black text-red-300">Destructive statement detected</h3>
                <p className="text-xs text-[var(--foreground-subtle)]">DROP / TRUNCATE / ALTER, or DELETE / UPDATE without WHERE</p>
              </div>
            </div>
            <div className="mb-4 max-h-40 space-y-2 overflow-y-auto">
              {preview.destructive.map((d, i) => (
                <pre key={i} className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 font-mono text-[11px] text-red-200 whitespace-pre-wrap break-all">{d.s}</pre>
              ))}
            </div>
            <label className="mb-5 flex items-start gap-3 rounded-xl border border-[var(--border)] px-4 py-3 cursor-pointer">
              <input type="checkbox" checked={confirmChecked} onChange={(e) => setConfirmChecked(e.target.checked)} className="mt-0.5 accent-red-500" />
              <span className="text-xs text-[var(--foreground-muted)] leading-relaxed">
                I understand this statement can modify or delete data, that write mode must be unlocked, and that it will be recorded in <code className="text-red-300">admin_sql_log</code> with my admin id.
              </span>
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-[var(--foreground-subtle)] hover:text-[var(--foreground)]">Cancel</button>
              <button
                onClick={() => { setConfirmOpen(false); void doRun(true); }}
                disabled={!confirmChecked || busy}
                className="rounded-xl bg-red-500/20 border border-red-500/50 px-5 py-2.5 text-sm font-bold text-red-200 hover:bg-red-500/30 disabled:opacity-40"
              >
                Run it
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default SqlConsolePanel;
