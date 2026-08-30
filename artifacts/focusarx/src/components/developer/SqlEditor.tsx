/**
 * SQL Editor — Professional database console for Developer Mode.
 *
 * Features:
 * - SQL syntax highlighting (CSS-based, no external editor dependency)
 * - Line numbers
 * - Schema sidebar with tables, columns, indexes, FKs
 * - Query execution with permission level indicators
 * - Result table with pagination
 * - Query history
 * - Execution time and row count
 * - Export results (CSV/JSON)
 * - Clear results
 * - Copy results
 * - Destructive query confirmation
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { apiJson } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  Play, Clock, Table2, Key, Link2, Hash, Database, Download,
  Copy, Trash2, ChevronRight, ChevronDown, Search, AlertTriangle,
  CheckCircle2, XCircle, Loader2, History, Columns3, Eye,
  ShieldAlert, ShieldCheck, Shield, FileText,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SchemaTable {
  name: string;
  rowCount: number;
  columnCount: number;
}

interface SchemaColumn {
  name: string;
  type: string;
  fullType: string;
  nullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  position: number;
}

interface SchemaIndex {
  name: string;
  definition: string;
}

interface SchemaForeignKey {
  column: string;
  referencedTable: string;
  referencedColumn: string;
  onDelete: string;
  onUpdate: string;
}

interface TableDetail {
  tableName: string;
  rowCount: number;
  columns: SchemaColumn[];
  indexes: SchemaIndex[];
  foreignKeys: SchemaForeignKey[];
  constraints: { name: string; type: string; columns: string[] }[];
}

interface StatementResult {
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
}

interface HistoryEntry {
  id: string;
  sql: string;
  kind: "read" | "write";
  rowsAffected: number;
  status: "ok" | "error" | "blocked";
  error: string | null;
  createdAt: string;
}

// ─── SQL Keywords for highlighting ────────────────────────────────────────────

const SQL_KEYWORDS = new Set([
  "SELECT", "FROM", "WHERE", "INSERT", "INTO", "VALUES", "UPDATE", "SET",
  "DELETE", "CREATE", "TABLE", "ALTER", "DROP", "INDEX", "VIEW", "TRIGGER",
  "FUNCTION", "PROCEDURE", "BEGIN", "COMMIT", "ROLLBACK", "TRANSACTION",
  "JOIN", "LEFT", "RIGHT", "INNER", "OUTER", "FULL", "CROSS", "ON",
  "AND", "OR", "NOT", "IN", "EXISTS", "BETWEEN", "LIKE", "IS", "NULL",
  "AS", "ORDER", "BY", "ASC", "DESC", "GROUP", "HAVING", "LIMIT", "OFFSET",
  "UNION", "ALL", "DISTINCT", "COUNT", "SUM", "AVG", "MIN", "MAX",
  "CASE", "WHEN", "THEN", "ELSE", "END", "CAST", "COALESCE", "NULLIF",
  "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "CONSTRAINT", "UNIQUE",
  "CHECK", "DEFAULT", "CASCADE", "RESTRICT", "SET", "NO", "ACTION",
  "EXPLAIN", "ANALYZE", "VACUUM", "REINDEX", "TRUNCATE",
  "TRUE", "FALSE", "RETURNING", "WITH", "RECURSIVE",
  "GRANT", "REVOKE", "IF", "REPLACE", "TEMPORARY", "TEMP",
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classifySql(sql: string): { level: "read" | "write" | "schema" | "destructive"; label: string; color: string } {
  const upper = sql.toUpperCase().replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  
  if (/\b(DROP|TRUNCATE)\b/.test(upper)) {
    return { level: "destructive", label: "DESTRUCTIVE", color: "text-red-400" };
  }
  if (/\bDELETE\b/.test(upper) && !/\bWHERE\b/.test(upper)) {
    return { level: "destructive", label: "DESTRUCTIVE", color: "text-red-400" };
  }
  if (/\bUPDATE\b/.test(upper) && !/\bWHERE\b/.test(upper)) {
    return { level: "destructive", label: "DESTRUCTIVE", color: "text-red-400" };
  }
  if (/\b(CREATE|ALTER)\b/.test(upper)) {
    return { level: "schema", label: "SCHEMA", color: "text-amber-400" };
  }
  if (/\b(INSERT|UPDATE|DELETE)\b/.test(upper)) {
    return { level: "write", label: "WRITE", color: "text-yellow-400" };
  }
  return { level: "read", label: "READ", color: "text-emerald-400" };
}

function highlightSql(code: string): string {
  // Escape HTML
  let html = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  
  // Comments
  html = html.replace(/(--.*$)/gm, '<span class="text-zinc-500 italic">$1</span>');
  html = html.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="text-zinc-500 italic">$1</span>');
  
  // Strings
  html = html.replace(/('(?:[^'\\]|\\.)*')/g, '<span class="text-emerald-300">$1</span>');
  
  // Numbers
  html = html.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="text-orange-300">$1</span>');
  
  // Keywords (case-insensitive word boundary)
  const keywordPattern = new RegExp(`\\b(${[...SQL_KEYWORDS].join("|")})\\b`, "gi");
  html = html.replace(keywordPattern, '<span class="text-violet-400 font-semibold">$1</span>');
  
  return html;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function formatTime(ms: number): string {
  if (ms < 1) return "<1ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SchemaSidebar({ tables, onSelectTable }: {
  tables: SchemaTable[];
  onSelectTable: (name: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [tableDetail, setTableDetail] = useState<TableDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() =>
    tables.filter((t) => t.name.toLowerCase().includes(search.toLowerCase())),
    [tables, search]
  );

  const handleTableClick = useCallback(async (name: string) => {
    if (expandedTable === name) {
      setExpandedTable(null);
      return;
    }
    setExpandedTable(name);
    onSelectTable(name);
    setLoading(true);
    try {
      const detail = await apiJson<TableDetail>(`/api/developer/db/schema/${name}`);
      setTableDetail(detail);
    } catch {
      setTableDetail(null);
    }
    setLoading(false);
  }, [expandedTable, onSelectTable]);

  return (
    <div className="flex flex-col h-full border-r border-white/10 bg-zinc-950/50">
      <div className="p-3 border-b border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <Database size={14} className="text-violet-400" />
          <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">Schema</span>
        </div>
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tables..."
            className="w-full pl-7 pr-2 py-1.5 text-xs bg-white/5 border border-white/10 rounded text-white/80 placeholder:text-white/30 focus:outline-none focus:border-violet-500/50"
          />
        </div>
        <div className="mt-1.5 text-[10px] text-white/40">
          {tables.length} tables
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.map((table) => (
          <div key={table.name}>
            <button
              onClick={() => handleTableClick(table.name)}
              className={cn(
                "w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-left hover:bg-white/5 transition-colors",
                expandedTable === table.name && "bg-violet-500/10 text-violet-300"
              )}
            >
              {expandedTable === table.name ? (
                <ChevronDown size={10} className="shrink-0 text-white/40" />
              ) : (
                <ChevronRight size={10} className="shrink-0 text-white/40" />
              )}
              <Table2 size={11} className="shrink-0 text-blue-400/60" />
              <span className="truncate flex-1 font-mono">{table.name}</span>
              <span className="text-[10px] text-white/30 tabular-nums">
                {formatNumber(table.rowCount)}
              </span>
            </button>

            {expandedTable === table.name && (
              <div className="px-3 pb-2 pl-8">
                {loading ? (
                  <div className="flex items-center gap-1.5 py-2 text-[10px] text-white/40">
                    <Loader2 size={10} className="animate-spin" /> Loading...
                  </div>
                ) : tableDetail ? (
                  <div className="space-y-2">
                    <div>
                      <div className="text-[10px] text-white/40 font-semibold uppercase tracking-wider mb-1">
                        Columns ({tableDetail.columns.length})
                      </div>
                      <div className="space-y-0.5">
                        {tableDetail.columns.map((col) => (
                          <div key={col.name} className="flex items-center gap-1.5 text-[10px]">
                            {col.isPrimaryKey && <Key size={8} className="text-amber-400 shrink-0" />}
                            {col.isForeignKey && <Link2 size={8} className="text-blue-400 shrink-0" />}
                            {!col.isPrimaryKey && !col.isForeignKey && <Columns3 size={8} className="text-white/20 shrink-0" />}
                            <span className="font-mono text-white/70 truncate">{col.name}</span>
                            <span className="text-white/30 ml-auto shrink-0">{col.type}</span>
                            {col.nullable && <span className="text-white/20">?</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                    {tableDetail.indexes.length > 0 && (
                      <div>
                        <div className="text-[10px] text-white/40 font-semibold uppercase tracking-wider mb-1">
                          Indexes ({tableDetail.indexes.length})
                        </div>
                        {tableDetail.indexes.slice(0, 5).map((idx) => (
                          <div key={idx.name} className="text-[10px] text-white/50 font-mono truncate" title={idx.definition}>
                            {idx.name}
                          </div>
                        ))}
                        {tableDetail.indexes.length > 5 && (
                          <div className="text-[10px] text-white/30">+{tableDetail.indexes.length - 5} more</div>
                        )}
                      </div>
                    )}
                    {tableDetail.foreignKeys.length > 0 && (
                      <div>
                        <div className="text-[10px] text-white/40 font-semibold uppercase tracking-wider mb-1">
                          Foreign Keys ({tableDetail.foreignKeys.length})
                        </div>
                        {tableDetail.foreignKeys.map((fk) => (
                          <div key={fk.column} className="text-[10px] text-white/50">
                            <span className="text-blue-300">{fk.column}</span>
                            {" → "}
                            <span className="text-emerald-300">{fk.referencedTable}.{fk.referencedColumn}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-[10px] text-white/40 py-2">Failed to load details</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultsTable({ result }: { result: StatementResult }) {
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const totalPages = Math.ceil(result.rows.length / pageSize);
  const pageRows = result.rows.slice(page * pageSize, (page + 1) * pageSize);

  if (!result.ok) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
        <XCircle size={16} className="text-red-400 shrink-0" />
        <pre className="text-xs text-red-300 whitespace-pre-wrap font-mono overflow-auto max-h-40">{result.error}</pre>
      </div>
    );
  }

  if (result.columns.length === 0 && result.rows.length === 0) {
    return (
      <div className="flex items-center gap-2 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
        <CheckCircle2 size={16} className="text-emerald-400" />
        <span className="text-xs text-emerald-300">
          Query executed successfully. {result.rowCount} row(s) affected. ({formatTime(result.durationMs)})
        </span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3 text-[10px] text-white/50">
          <span className="flex items-center gap-1">
            <Clock size={10} /> {formatTime(result.durationMs)}
          </span>
          <span className="flex items-center gap-1">
            <Hash size={10} /> {result.rowCount} row{result.rowCount !== 1 ? "s" : ""}
          </span>
          {result.truncated && (
            <span className="flex items-center gap-1 text-amber-400">
              <AlertTriangle size={10} /> Results truncated
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const text = [
                result.columns.join("\t"),
                ...result.rows.map((r) => r.map((c) => c ?? "").join("\t")),
              ].join("\n");
              navigator.clipboard.writeText(text);
            }}
            className="flex items-center gap-1 px-2 py-1 text-[10px] text-white/50 hover:text-white/80 hover:bg-white/5 rounded transition-colors"
            title="Copy results"
          >
            <Copy size={10} /> Copy
          </button>
          <button
            onClick={() => {
              const csv = [
                result.columns.join(","),
                ...result.rows.map((r) => r.map((c) => {
                  if (c === null) return "";
                  const s = String(c);
                  return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
                }).join(",")),
              ].join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "query-results.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-1 px-2 py-1 text-[10px] text-white/50 hover:text-white/80 hover:bg-white/5 rounded transition-colors"
            title="Export as CSV"
          >
            <Download size={10} /> CSV
          </button>
        </div>
      </div>

      <div className="overflow-auto max-h-96 border border-white/10 rounded-lg">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-zinc-900/90 backdrop-blur">
            <tr>
              <th className="px-2 py-1.5 text-left text-[10px] text-white/30 font-medium">#</th>
              {result.columns.map((col) => (
                <th key={col} className="px-2 py-1.5 text-left text-[10px] text-white/50 font-semibold font-mono whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={i} className="border-t border-white/5 hover:bg-white/[0.02]">
                <td className="px-2 py-1 text-[10px] text-white/20 tabular-nums">{page * pageSize + i + 1}</td>
                {row.map((cell, j) => (
                  <td key={j} className="px-2 py-1 font-mono text-white/70 whitespace-nowrap max-w-xs truncate" title={cell != null ? String(cell) : "NULL"}>
                    {cell === null ? <span className="text-white/20 italic">NULL</span> : String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-2 text-[10px] text-white/40">
          <span>Page {page + 1} of {totalPages}</span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function QueryHistory({ entries, onRerun }: {
  entries: HistoryEntry[];
  onRerun: (sql: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-white/30 text-xs">
        No query history yet
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="group flex items-start gap-2 p-2 rounded hover:bg-white/5 transition-colors"
        >
          <div className={cn(
            "mt-0.5 w-1.5 h-1.5 rounded-full shrink-0",
            entry.status === "ok" && "bg-emerald-400",
            entry.status === "error" && "bg-red-400",
            entry.status === "blocked" && "bg-amber-400",
          )} />
          <div className="flex-1 min-w-0">
            <pre className="text-[10px] font-mono text-white/60 truncate">
              {entry.sql.slice(0, 120)}
            </pre>
            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-white/30">
              <span>{new Date(entry.createdAt).toLocaleString()}</span>
              <span className={cn(
                entry.kind === "write" && "text-yellow-400/60",
                entry.kind === "read" && "text-emerald-400/60",
              )}>
                {entry.kind.toUpperCase()}
              </span>
              {entry.rowsAffected > 0 && <span>{entry.rowsAffected} rows</span>}
              {entry.error && <span className="text-red-400/60 truncate">{entry.error.slice(0, 60)}</span>}
            </div>
          </div>
          <button
            onClick={() => onRerun(entry.sql)}
            className="opacity-0 group-hover:opacity-100 px-2 py-0.5 text-[10px] text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 rounded transition-all"
          >
            Rerun
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SqlEditor() {
  const [query, setQuery] = useState("SELECT * FROM users LIMIT 10;");
  const [tables, setTables] = useState<SchemaTable[]>([]);
  const [results, setResults] = useState<StatementResult[]>([]);
  const [executing, setExecuting] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showSchema, setShowSchema] = useState(true);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // Load schema on mount
  useEffect(() => {
    apiJson<{ tables: SchemaTable[] }>("/api/developer/db/schema")
      .then((data) => setTables(data.tables))
      .catch(() => setError("Failed to load schema"));
  }, []);

  // Load history
  const loadHistory = useCallback(() => {
    apiJson<{ entries: HistoryEntry[] }>("/api/developer/db/history?limit=50")
      .then((data) => setHistory(data.entries))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (showHistory) loadHistory();
  }, [showHistory, loadHistory]);

  // Line numbers
  const lineCount = useMemo(() => query.split("\n").length, [query]);

  // SQL classification for current query
  const classification = useMemo(() => classifySql(query), [query]);

  // Execute query
  const execute = useCallback(async (confirmed = false) => {
    if (!query.trim() || executing) return;
    setExecuting(true);
    setError(null);
    setNeedsConfirm(false);
    setResults([]);

    try {
      const token = getToken();
      const res = await fetch("/api/developer/db/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ query, destructiveConfirmed: confirmed }),
        credentials: "include",
      });

      if (res.status === 409) {
        const data = await res.json();
        setNeedsConfirm(true);
        setConfirmMsg(data.destructive || []);
        setExecuting(false);
        return;
      }

      if (res.status === 403) {
        const data = await res.json();
        setError(data.error || "Write mode is locked. Unlock from SQL Console first.");
        setExecuting(false);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Execution failed" }));
        setError(data.error || "Execution failed");
        setExecuting(false);
        return;
      }

      const data = await res.json();
      setResults(data.statements || []);
      
      // Refresh history after execution
      loadHistory();
    } catch (err) {
      setError("Network error: " + (err instanceof Error ? err.message : "Unknown"));
    }
    setExecuting(false);
  }, [query, executing, loadHistory]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Ctrl/Cmd + Enter to execute
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      execute();
    }
    // Tab to indent
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = query.substring(0, start) + "  " + query.substring(end);
      setQuery(newValue);
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      });
    }
  }, [execute, query]);

  // Sync scroll between line numbers and textarea
  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  const totalDuration = results.reduce((sum, r) => sum + r.durationMs, 0);
  const totalRows = results.reduce((sum, r) => sum + r.rowCount, 0);
  const hasError = results.some((r) => !r.ok);

  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[500px] rounded-xl border border-white/10 bg-zinc-950/50 overflow-hidden">
      {/* Schema Sidebar */}
      {showSchema && (
        <div className="w-64 shrink-0">
          <SchemaSidebar tables={tables} onSelectTable={setSelectedTable} />
        </div>
      )}

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSchema(!showSchema)}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 text-[11px] rounded transition-colors",
                showSchema ? "bg-violet-500/20 text-violet-300" : "text-white/50 hover:bg-white/5"
              )}
            >
              <Table2 size={12} /> Schema
            </button>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 text-[11px] rounded transition-colors",
                showHistory ? "bg-violet-500/20 text-violet-300" : "text-white/50 hover:bg-white/5"
              )}
            >
              <History size={12} /> History
            </button>
            <div className={cn("flex items-center gap-1.5 px-2 py-1 text-[11px] rounded", classification.color, "bg-white/5")}>
              {classification.level === "read" && <ShieldCheck size={12} />}
              {classification.level === "write" && <Shield size={12} />}
              {classification.level === "schema" && <ShieldAlert size={12} />}
              {classification.level === "destructive" && <ShieldAlert size={12} />}
              {classification.label}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { setQuery(""); setResults([]); setError(null); }}
              className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-white/50 hover:text-white/80 hover:bg-white/5 rounded transition-colors"
            >
              <Trash2 size={12} /> Clear
            </button>
            <button
              onClick={() => execute()}
              disabled={executing || !query.trim()}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded transition-colors",
                executing
                  ? "bg-white/10 text-white/30"
                  : classification.level === "destructive"
                    ? "bg-red-500/20 text-red-300 hover:bg-red-500/30"
                    : classification.level === "write" || classification.level === "schema"
                      ? "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
                      : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
              )}
            >
              {executing ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              {executing ? "Running..." : "Execute"}
              <span className="text-[9px] opacity-60 ml-1">⌘↵</span>
            </button>
          </div>
        </div>

        {/* Confirmation Dialog */}
        {needsConfirm && (
          <div className="px-4 py-3 bg-red-500/10 border-b border-red-500/20">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={14} className="text-red-400" />
              <span className="text-xs font-semibold text-red-300">Destructive Query Confirmation Required</span>
            </div>
            <div className="space-y-1 mb-3">
              {confirmMsg.map((msg, i) => (
                <pre key={i} className="text-[10px] font-mono text-red-300/70 bg-red-500/10 rounded px-2 py-1 overflow-auto">
                  {msg}
                </pre>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => execute(true)}
                className="px-3 py-1.5 text-[11px] font-semibold bg-red-500/20 text-red-300 hover:bg-red-500/30 rounded transition-colors"
              >
                Confirm & Execute
              </button>
              <button
                onClick={() => { setNeedsConfirm(false); setConfirmMsg([]); }}
                className="px-3 py-1.5 text-[11px] text-white/50 hover:text-white/80 hover:bg-white/5 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-xs text-red-300">
            {error}
          </div>
        )}

        {/* Editor + Results */}
        {showHistory ? (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Query History</h3>
              <button
                onClick={loadHistory}
                className="text-[10px] text-white/40 hover:text-white/60"
              >
                Refresh
              </button>
            </div>
            <QueryHistory
              entries={history}
              onRerun={(sql) => { setQuery(sql); setShowHistory(false); }}
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            {/* SQL Input */}
            <div className="relative flex border-b border-white/10 min-h-[150px] max-h-[300px]">
              {/* Line Numbers */}
              <div
                ref={lineNumbersRef}
                className="w-10 shrink-0 bg-zinc-950/80 overflow-hidden select-none"
              >
                <div className="py-2 px-1">
                  {Array.from({ length: lineCount }, (_, i) => (
                    <div key={i} className="text-[11px] leading-[1.6] text-right text-white/15 font-mono pr-2">
                      {i + 1}
                    </div>
                  ))}
                </div>
              </div>

              {/* Textarea with syntax highlighting overlay */}
              <div className="relative flex-1">
                {/* Highlighted background */}
                <pre
                  className="absolute inset-0 p-2 text-[11px] leading-[1.6] font-mono text-white/80 overflow-hidden pointer-events-none whitespace-pre-wrap break-words"
                  aria-hidden="true"
                  dangerouslySetInnerHTML={{ __html: highlightSql(query) + "\n" }}
                />
                {/* Actual textarea */}
                <textarea
                  ref={textareaRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onScroll={handleScroll}
                  className="absolute inset-0 w-full h-full p-2 text-[11px] leading-[1.6] font-mono bg-transparent text-transparent caret-white resize-none focus:outline-none"
                  spellCheck={false}
                  autoComplete="off"
                  autoCapitalize="off"
                  placeholder="-- Write your SQL query here..."
                />
              </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-4">
              {results.length > 0 ? (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="flex items-center gap-4 text-[10px] text-white/40">
                    <span>{results.length} statement{results.length !== 1 ? "s" : ""}</span>
                    <span>Total: {formatTime(totalDuration)}</span>
                    <span>{totalRows} row{totalRows !== 1 ? "s" : ""}</span>
                    {hasError && <span className="text-red-400">Errors occurred</span>}
                  </div>

                  {results.map((result, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded font-semibold",
                          result.ok && result.kind === "read" && "bg-emerald-500/20 text-emerald-400",
                          result.ok && result.kind === "write" && "bg-yellow-500/20 text-yellow-400",
                          !result.ok && "bg-red-500/20 text-red-400",
                        )}>
                          {result.ok ? "OK" : "ERR"}
                        </span>
                        {result.destructive && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">DESTRUCTIVE</span>
                        )}
                        <pre className="text-[10px] font-mono text-white/40 truncate flex-1">{result.statement.slice(0, 100)}</pre>
                      </div>
                      <ResultsTable result={result} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-white/20">
                  <FileText size={32} className="mb-2" />
                  <p className="text-xs">Execute a query to see results</p>
                  <p className="text-[10px] mt-1">Press Ctrl+Enter to execute</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
