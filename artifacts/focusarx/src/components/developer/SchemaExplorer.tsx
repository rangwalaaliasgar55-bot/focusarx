/**
 * Database Schema Explorer — safe, read-only visual schema browser.
 *
 * Fetches table metadata from /api/healthz/tables and renders an
 * interactive schema explorer with:
 * - Table list with search and filter
 * - Column details (name, type, nullable, PK/FK, default)
 * - Index listing
 * - Relationship visualization (table connections)
 *
 * This component never exposes production data, credentials, or
 * connection strings — only schema metadata from information_schema.
 */
import { useState, useEffect, useMemo } from "react";
import { apiJson } from "@/lib/api";
import { Search, Database, Key, Link, Table2, Hash } from "lucide-react";

interface TableSummary {
  name: string;
  columnCount: number;
  hasPrimaryKey: boolean;
  foreignKeyCount: number;
  indexCount: number;
}

interface ColumnDetail {
  name: string;
  dataType: string;
  nullable: boolean;
  defaultValue: string | null;
  maxLength: number | null;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
}

interface IndexDetail {
  name: string;
  definition: string;
}

interface TableDetail {
  tableName: string;
  columns: ColumnDetail[];
  indexes: IndexDetail[];
}

export function SchemaExplorer() {
  const [tables, setTables] = useState<TableSummary[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableDetail, setTableDetail] = useState<TableDetail | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiJson<{ tables: TableSummary[] }>("/api/healthz/tables")
      .then((data) => {
        setTables(data.tables);
        setLoading(false);
      })
      .catch(() => {
        setError("Unable to load schema. You may need to be authenticated.");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedTable) return;
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setDetailLoading(true);
      try {
        const data = await apiJson<TableDetail>(`/api/healthz/tables/${selectedTable}`);
        if (!cancelled) setTableDetail(data);
      } catch {
        if (!cancelled) setTableDetail(null);
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedTable]);

  const filteredTables = useMemo(() => {
    if (!search) return tables;
    const q = search.toLowerCase();
    return tables.filter((t) => t.name.includes(q));
  }, [tables, search]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-10 bg-white/5 rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Table List */}
      <div className="lg:col-span-1">
        <div className="sticky top-4">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tables..."
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>

          <div className="text-xs text-white/40 mb-2">
            {filteredTables.length} table{filteredTables.length !== 1 ? "s" : ""}
          </div>

          <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-2">
            {filteredTables.map((table) => (
              <button
                key={table.name}
                onClick={() => setSelectedTable(table.name)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                  selectedTable === table.name
                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                    : "hover:bg-white/5 text-white/70 border border-transparent"
                }`}
              >
                <Table2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="font-mono truncate">{table.name}</span>
                <span className="ml-auto text-xs text-white/30">{table.columnCount}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table Detail */}
      <div className="lg:col-span-2">
        {!selectedTable ? (
          <div className="flex flex-col items-center justify-center h-64 text-white/30">
            <Database className="w-12 h-12 mb-3" />
            <p className="text-sm">Select a table to view its schema</p>
          </div>
        ) : detailLoading ? (
          <div className="animate-pulse space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 bg-white/5 rounded-lg" />
            ))}
          </div>
        ) : tableDetail ? (
          <div>
            <h3 className="text-lg font-mono font-semibold text-white mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-400" />
              {tableDetail.tableName}
            </h3>

            {/* Columns */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-white/60 mb-2 flex items-center gap-2">
                <Table2 className="w-4 h-4" />
                Columns ({tableDetail.columns.length})
              </h4>
              <div className="border border-white/10 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-white/5">
                      <th className="text-left px-3 py-2 text-white/50 font-medium">Name</th>
                      <th className="text-left px-3 py-2 text-white/50 font-medium">Type</th>
                      <th className="text-center px-3 py-2 text-white/50 font-medium">PK</th>
                      <th className="text-center px-3 py-2 text-white/50 font-medium">FK</th>
                      <th className="text-center px-3 py-2 text-white/50 font-medium">Nullable</th>
                      <th className="text-left px-3 py-2 text-white/50 font-medium">Default</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableDetail.columns.map((col) => (
                      <tr key={col.name} className="border-t border-white/5 hover:bg-white/5">
                        <td className="px-3 py-2 font-mono text-white/80">{col.name}</td>
                        <td className="px-3 py-2 font-mono text-emerald-300/80">
                          {col.dataType}
                          {col.maxLength ? `(${col.maxLength})` : ""}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {col.isPrimaryKey && <Key className="w-3.5 h-3.5 text-yellow-400 inline" />}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {col.isForeignKey && <Link className="w-3.5 h-3.5 text-blue-400 inline" />}
                        </td>
                        <td className="px-3 py-2 text-center text-white/40">
                          {col.nullable ? "✓" : "—"}
                        </td>
                        <td className="px-3 py-2 font-mono text-white/40 text-xs truncate max-w-[120px]">
                          {col.defaultValue ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Indexes */}
            {tableDetail.indexes.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-white/60 mb-2 flex items-center gap-2">
                  <Hash className="w-4 h-4" />
                  Indexes ({tableDetail.indexes.length})
                </h4>
                <div className="space-y-1">
                  {tableDetail.indexes.map((idx) => (
                    <div key={idx.name} className="px-3 py-2 bg-white/5 rounded-lg">
                      <div className="font-mono text-xs text-purple-300">{idx.name}</div>
                      <div className="font-mono text-xs text-white/40 mt-0.5 truncate">{idx.definition}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-white/40 text-sm p-4">
            Unable to load table details.
          </div>
        )}
      </div>
    </div>
  );
}
