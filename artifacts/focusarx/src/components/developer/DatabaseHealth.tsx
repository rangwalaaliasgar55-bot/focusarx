/**
 * Database Health Dashboard — real-time database monitoring for Developer Mode.
 *
 * Displays:
 * - Connection status and latency
 * - PostgreSQL version
 * - Database size
 * - Table and index counts
 * - Migration status
 * - Schema drift detection
 */

import { useState, useEffect, useCallback } from "react";
import { apiJson } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Database, Activity, HardDrive, Table2, Hash, Clock,
  AlertTriangle, CheckCircle2, XCircle, RefreshCw, Shield,
  GitBranch, Zap,
} from "lucide-react";

interface DbHealth {
  connected: boolean;
  latencyMs: number;
  pgVersion: string;
  dbSize: string;
  tableCount: number;
  indexCount: number;
  database: string;
  user: string;
  timestamp: string;
  error?: string;
}

interface MigrationInfo {
  migrations: Array<{
    index: number;
    name: string;
    timestamp: string;
    applied: boolean;
  }>;
  total: number;
  appliedCount: number;
  pendingCount: number;
}

interface DiffInfo {
  hasDrift: boolean;
  summary: {
    expectedTables: number;
    actualTables: number;
    inSync: number;
    missingInDb: number;
    extraInDb: number;
  };
  missingInDb: string[];
  extraInDb: string[];
  recommendation: string;
}

function StatCard({ icon: Icon, label, value, sub, color = "text-white" }: {
  icon: React.ComponentType<{ className?: string; size?: number }>;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/10">
      <div className="p-2 rounded-lg bg-white/5">
        <Icon size={16} className={color} />
      </div>
      <div>
        <div className="text-[10px] text-white/40 uppercase tracking-wider">{label}</div>
        <div className={cn("text-sm font-bold tabular-nums", color)}>{value}</div>
        {sub && <div className="text-[10px] text-white/30">{sub}</div>}
      </div>
    </div>
  );
}

export function DatabaseHealth() {
  const [health, setHealth] = useState<DbHealth | null>(null);
  const [migrations, setMigrations] = useState<MigrationInfo | null>(null);
  const [diff, setDiff] = useState<DiffInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [h, m, d] = await Promise.all([
        apiJson<DbHealth>("/api/developer/db/health"),
        apiJson<MigrationInfo>("/api/developer/db/migrations"),
        apiJson<DiffInfo>("/api/developer/db/diff"),
      ]);
      setHealth(h);
      setMigrations(m);
      setDiff(d);
      setLastRefresh(new Date());
    } catch {
      // Keep existing data on error
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30_000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, [loadData]);

  if (!health && loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-white/40">
          <RefreshCw size={16} className="animate-spin" />
          <span className="text-sm">Loading database health...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-3 h-3 rounded-full",
            health?.connected ? "bg-emerald-400 shadow-lg shadow-emerald-400/50" : "bg-red-400 shadow-lg shadow-red-400/50"
          )} />
          <h2 className="text-lg font-bold text-white">
            {health?.connected ? "Database Connected" : "Database Disconnected"}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-[10px] text-white/30 flex items-center gap-1">
              <Clock size={10} /> Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/60 hover:text-white/90 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Connection Status */}
      {!health?.connected && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <div className="flex items-center gap-2 text-red-300">
            <XCircle size={16} />
            <span className="text-sm font-semibold">Database Connection Failed</span>
          </div>
          <p className="text-xs text-red-300/70 mt-1 ml-6">{health?.error || "Unable to connect to the database."}</p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          icon={Activity}
          label="Latency"
          value={health ? `${health.latencyMs}ms` : "—"}
          color={health && health.latencyMs < 50 ? "text-emerald-400" : health && health.latencyMs < 200 ? "text-yellow-400" : "text-red-400"}
        />
        <StatCard
          icon={Database}
          label="PostgreSQL"
          value={health?.pgVersion || "—"}
          sub={health?.database}
          color="text-blue-400"
        />
        <StatCard
          icon={HardDrive}
          label="Database Size"
          value={health?.dbSize || "—"}
          color="text-violet-400"
        />
        <StatCard
          icon={Table2}
          label="Tables"
          value={health?.tableCount ?? "—"}
          color="text-cyan-400"
        />
        <StatCard
          icon={Hash}
          label="Indexes"
          value={health?.indexCount ?? "—"}
          color="text-amber-400"
        />
        <StatCard
          icon={Zap}
          label="User"
          value={health?.user || "—"}
          color="text-emerald-400"
        />
      </div>

      {/* Migration Status */}
      {migrations && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <GitBranch size={14} className="text-violet-400" />
              <span className="text-sm font-semibold text-white">Migrations</span>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="text-emerald-400">{migrations.appliedCount} applied</span>
              {migrations.pendingCount > 0 && (
                <span className="text-amber-400">{migrations.pendingCount} pending</span>
              )}
              <span className="text-white/30">{migrations.total} total</span>
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {migrations.migrations.slice().reverse().map((m) => (
              <div key={m.index} className="flex items-center gap-3 px-4 py-2 border-b border-white/5 last:border-0">
                <div className={cn(
                  "w-2 h-2 rounded-full shrink-0",
                  m.applied ? "bg-emerald-400" : "bg-amber-400"
                )} />
                <span className="text-xs font-mono text-white/60 flex-1">{m.name}</span>
                <span className="text-[10px] text-white/30">{new Date(m.timestamp).toLocaleDateString()}</span>
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded",
                  m.applied ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
                )}>
                  {m.applied ? "Applied" : "Pending"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Schema Drift */}
      {diff && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Shield size={14} className={diff.hasDrift ? "text-amber-400" : "text-emerald-400"} />
              <span className="text-sm font-semibold text-white">Schema Sync Status</span>
            </div>
            {diff.hasDrift ? (
              <span className="text-[10px] px-2 py-1 rounded bg-amber-500/20 text-amber-400 flex items-center gap-1">
                <AlertTriangle size={10} /> DRIFT DETECTED
              </span>
            ) : (
              <span className="text-[10px] px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 flex items-center gap-1">
                <CheckCircle2 size={10} /> IN SYNC
              </span>
            )}
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
              <div className="p-2 rounded bg-white/5">
                <div className="text-lg font-bold text-white">{diff.summary.expectedTables}</div>
                <div className="text-[10px] text-white/40">Expected</div>
              </div>
              <div className="p-2 rounded bg-white/5">
                <div className="text-lg font-bold text-white">{diff.summary.actualTables}</div>
                <div className="text-[10px] text-white/40">Actual</div>
              </div>
              <div className="p-2 rounded bg-white/5">
                <div className="text-lg font-bold text-emerald-400">{diff.summary.inSync}</div>
                <div className="text-[10px] text-white/40">In Sync</div>
              </div>
              <div className="p-2 rounded bg-white/5">
                <div className="text-lg font-bold text-red-400">{diff.summary.missingInDb}</div>
                <div className="text-[10px] text-white/40">Missing in DB</div>
              </div>
              <div className="p-2 rounded bg-white/5">
                <div className="text-lg font-bold text-amber-400">{diff.summary.extraInDb}</div>
                <div className="text-[10px] text-white/40">Extra in DB</div>
              </div>
            </div>

            {diff.missingInDb.length > 0 && (
              <div>
                <div className="text-[10px] text-red-400 font-semibold mb-1">Missing tables (in application but not in database):</div>
                <div className="flex flex-wrap gap-1">
                  {diff.missingInDb.slice(0, 10).map((t) => (
                    <span key={t} className="text-[10px] font-mono px-1.5 py-0.5 bg-red-500/10 text-red-300 rounded">{t}</span>
                  ))}
                  {diff.missingInDb.length > 10 && (
                    <span className="text-[10px] text-red-300/60">+{diff.missingInDb.length - 10} more</span>
                  )}
                </div>
              </div>
            )}

            {diff.extraInDb.length > 0 && (
              <div>
                <div className="text-[10px] text-amber-400 font-semibold mb-1">Extra tables (in database but not in application):</div>
                <div className="flex flex-wrap gap-1">
                  {diff.extraInDb.slice(0, 10).map((t) => (
                    <span key={t} className="text-[10px] font-mono px-1.5 py-0.5 bg-amber-500/10 text-amber-300 rounded">{t}</span>
                  ))}
                  {diff.extraInDb.length > 10 && (
                    <span className="text-[10px] text-amber-300/60">+{diff.extraInDb.length - 10} more</span>
                  )}
                </div>
              </div>
            )}

            <div className="text-[10px] text-white/50 italic">
              {diff.recommendation}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
