import { useState, useEffect } from "react";
import { RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";
import { Badge, LoadingState, MotionTab, SectionHeader, adminFetch } from "./AdminHelpers";
import type { AdminPanelProps, AdminUser } from "./AdminTypes";

export function AdminPremiumPanel({ authHeaders }: AdminPanelProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [grantId, setGrantId] = useState("");
  const [granting, setGranting] = useState(false);
  const [grantResult, setGrantResult] = useState<string | null>(null);

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      const r = await adminFetch("/api/admin/users", { headers: authHeaders(), credentials: "include" });
      if (r.ok) {
        const d = await r.json();
        setUsers((d.users ?? []).filter((u: any) => u.role !== "guest"));
      }
    } finally { setLoading(false); }
  }

  async function grantPremium() {
    if (!grantId) return;
    setGranting(true); setGrantResult(null);
    try {
      const r = await adminFetch("/api/admin/users/" + grantId + "/premium", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify({ days: 30 }),
      });
      if (r.ok) { setGrantResult("Premium granted for 30 days!"); loadUsers(); }
      else { const d = await r.json(); setGrantResult("Error: " + (d.error ?? "Unknown")); }
    } catch (e: any) { setGrantResult("Error: " + e.message); }
    finally { setGranting(false); }
  }

  const premiumCount = users.filter((u) => {
    const sub = (u as any).premiumUntil;
    return sub && new Date(sub) > new Date();
  }).length;

  return (
    <MotionTab>
      <SectionHeader title="Premium Management" sub="View all users and manually grant premium access. Premium is purchased with 9,000 in-app coins." />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/40 p-5 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--palette-zinc-400)]">Grant Premium (Admin Override)</p>
          <div>
            <label htmlFor="adminpremiumpanel-user-id" className="block text-xs text-[var(--palette-zinc-500)] mb-1">User ID</label>
            <input id="adminpremiumpanel-user-id" className="admin-input font-mono" placeholder="paste user UUID…" value={grantId} onChange={e => setGrantId(e.target.value)} />
            <p className="text-[11px] text-[var(--palette-zinc-600)] mt-1">Grants 30 days of premium without deducting coins.</p>
          </div>
          <button onClick={() => void grantPremium()} disabled={granting || !grantId}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[var(--palette-amber-700)] hover:bg-[var(--palette-amber-800)] px-4 py-2.5 text-sm font-medium text-[var(--palette-white)] disabled:opacity-50 transition"
          >
            {granting ? <><RefreshCw size={14} className="animate-spin" /> Granting…</> : <>👑 Grant 30-day Premium</>}
          </button>
          {grantResult && (
            <div className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${grantResult.startsWith("Error") ? "border-[var(--palette-red-800)]/50 bg-[var(--palette-red-950)]/30 text-[var(--palette-red-400)]" : "border-[var(--palette-emerald-800)]/50 bg-[var(--palette-emerald-950)]/30 text-[var(--palette-emerald-400)]"}`}>
              {grantResult.startsWith("Error") ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}
              {grantResult}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="rounded-xl border border-[var(--palette-amber-800)]/30 bg-[var(--palette-amber-950)]/10 px-4 py-3 text-center">
              <p className="text-xl font-bold text-[var(--palette-amber-400)]">{premiumCount}</p>
              <p className="text-[11px] text-[var(--palette-zinc-500)] mt-0.5">Active premium users</p>
            </div>
            <div className="rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/20 px-4 py-3 text-center">
              <p className="text-xl font-bold text-[var(--palette-zinc-200)]">{users.length}</p>
              <p className="text-[11px] text-[var(--palette-zinc-500)] mt-0.5">Registered users total</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--palette-zinc-400)]">User List</p>
            <button onClick={() => void loadUsers()} className="text-[11px] text-[var(--palette-zinc-500)] hover:text-[var(--palette-zinc-300)] flex items-center gap-1"><RefreshCw size={10} /> Refresh</button>
          </div>
          {loading ? (
            <LoadingState />
          ) : (
            <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 max-h-[420px] overflow-auto">
              <table className="min-w-[40rem] w-full text-left text-xs">
                <thead className="bg-[var(--palette-zinc-900)]/80 text-[var(--palette-zinc-500)] uppercase tracking-wider sticky top-0">
                  <tr>
                    <th className="px-3 py-2 font-medium">User</th>
                    <th className="px-3 py-2 font-medium">Role</th>
                    <th className="px-3 py-2 font-medium">Quick Grant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--palette-zinc-800)]/50">
                  {users.slice(0, 50).map((u) => (
                    <tr key={u.id} className="hover:bg-[var(--palette-zinc-900)]/30">
                      <td className="px-3 py-2">
                        <p className="text-[var(--palette-zinc-200)] font-medium truncate max-w-[140px]">{u.name || u.email?.split("@")[0]}</p>
                        <p className="text-[var(--palette-zinc-600)] text-[11px] font-mono truncate">{u.id.slice(0, 8)}…</p>
                      </td>
                      <td className="px-3 py-2">
                        <Badge label={u.role} color={u.role === "admin" ? "bg-[var(--palette-rose-950)] text-[var(--palette-rose-400)]" : "bg-[var(--palette-zinc-800)] text-[var(--palette-zinc-400)]"} />
                      </td>
                      <td className="px-3 py-2">
                        <button onClick={() => { setGrantId(u.id); }}
                          className="rounded px-2 py-0.5 text-[11px] border border-[var(--palette-amber-800)]/50 text-[var(--palette-amber-400)] hover:bg-[var(--palette-amber-950)]/30 transition"
                        >Select</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </MotionTab>
  );
}
