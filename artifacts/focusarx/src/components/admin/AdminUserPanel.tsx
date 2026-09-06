import { useState } from "react";
import { Badge, MotionTab, SectionHeader, StatCard, adminFetch } from "./AdminHelpers";
import { Search } from "lucide-react";

type AdminUser = {
  id: string;
  name: string | null;
  email: string;
  isGuest: boolean;
  role: string;
  sessionCount: number;
  streak: number;
  createdAt: string;
};

type AdminData = { users: AdminUser[]; activeCount: number; guestCount?: number; botCount?: number };
type AdminStats = { totalUsers: number; guestCount?: number };

interface AdminUserPanelProps {
  /** Opens the shared UserManagerDialog. The Users tab had a Manage button that
   // wrote to a local state nothing read, so it did nothing at all. */
  onManageUser: (id: string) => void;
  data: AdminData;
  stats: AdminStats | null;
  authHeaders: () => Record<string, string>;
  onDataChanged: () => void;
}

export function AdminUserPanel({ data, stats, authHeaders, onDataChanged, onManageUser }: AdminUserPanelProps) {
  const [userSearch, setUserSearch] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const [purgeLoading, setPurgeLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState<string | null>(null);

  const allUsers = data.users ?? [];
  const users = userSearch.trim()
    ? allUsers.filter(u =>
        (u.name ?? "").toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearch.toLowerCase()))
    : allUsers;
  const botCount = data.botCount ?? 0;

  function maskEmail(email: string) {
    const [local, domain] = email.split("@");
    if (!local || !domain) return email;
    if (email.endsWith("@guest.focusarx.internal")) return "guest";
    return local.slice(0, 2) + "***@" + domain;
  }

  function toggleUserSelect(id: string) {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedUsers(new Set());
    setBulkResult(null);
  }

  async function bulkGrantCoins() {
    const ids = [...selectedUsers];
    const amt = prompt(`Grant how many coins to ${ids.length} selected user(s)?`, "100");
    if (!amt || !Number(amt) || Number(amt) <= 0) return;
    setBulkLoading(true);
    setBulkResult(null);
    try {
      const r = await adminFetch("/api/admin/cms/grant-coins/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify({ userIds: ids, amount: Number(amt), reason: "Bulk grant" }),
      });
      const d = await r.json();
      setBulkResult(r.ok ? `Granted ${amt} coins to ${d.granted}/${d.attempted} users.` : ("Error: " + (d.error ?? "Failed")));
      if (r.ok) { clearSelection(); onDataChanged(); }
    } catch (e: any) { setBulkResult("Error: " + e.message); }
    finally { setBulkLoading(false); }
  }

  async function bulkDeleteUsers() {
    const ids = [...selectedUsers];
    if (!confirm(`Delete ${ids.length} selected user(s)? This cannot be undone.`)) return;
    setBulkLoading(true);
    setBulkResult(null);
    try {
      const r = await adminFetch("/api/admin/users/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify({ userIds: ids }),
      });
      const d = await r.json();
      setBulkResult(r.ok ? `Deleted ${d.deleted}/${d.attempted} users (admins skipped).` : ("Error: " + (d.error ?? "Failed")));
      if (r.ok) { clearSelection(); onDataChanged(); }
    } catch (e: any) { setBulkResult("Error: " + e.message); }
    finally { setBulkLoading(false); }
  }

  const toggleRole = async (user: AdminUser) => {
    const newRole = user.role === "admin" ? "user" : "admin";
    setRoleLoading(user.id);
    try {
      const res = await adminFetch(`/api/admin/users/${user.id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) onDataChanged();
    } finally { setRoleLoading(null); }
  };

  const deleteUser = async (id: string) => {
    setDeleteLoading(id);
    try {
      const res = await adminFetch(`/api/admin/users/${id}`, {
        method: "DELETE", headers: authHeaders(), credentials: "include",
      });
      if (res.ok) onDataChanged();
    } finally { setDeleteLoading(null); setDeleteConfirm(null); }
  };

  const purgeAllGuests = async () => {
    const guestCount = stats?.guestCount ?? data.guestCount ?? 0;
    if (guestCount === 0) return;
    if (!window.confirm(`Delete all ${guestCount} guest account(s)?`)) return;
    setPurgeLoading(true);
    try {
      const res = await adminFetch("/api/admin/users/guests", {
        method: "DELETE", headers: authHeaders(), credentials: "include",
      });
      if (res.ok) onDataChanged();
    } finally { setPurgeLoading(false); }
  };

  return (
    <MotionTab>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <SectionHeader title="User Management" sub={`${users.length} registered accounts`} />
        <div className="flex items-center gap-2">
          {(stats?.guestCount ?? data.guestCount ?? 0) > 0 && (
            <button
              onClick={() => void purgeAllGuests()} disabled={purgeLoading}
              className="rounded-lg border border-[var(--palette-amber-900)]/60 bg-[var(--palette-amber-950)]/40 px-3 py-1.5 text-xs font-medium text-[var(--palette-amber-300)] hover:bg-[var(--palette-amber-950)]/70 disabled:opacity-50"
            >
              {purgeLoading ? "Purging…" : `Purge ${stats?.guestCount ?? data.guestCount} guest(s)`}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Registered users" value={String(allUsers.length - botCount)} />
        <StatCard label="Active sessions" value={String(data.activeCount ?? 0)} accent="rose" />
        <StatCard label={botCount > 0 ? "AI rivals" : "Guest accounts"}
          value={String(botCount > 0 ? botCount : (data.guestCount ?? stats?.guestCount ?? 0))} accent="amber" />
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--palette-zinc-600)]" />
        <input
          value={userSearch}
          onChange={e => setUserSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-950)]/60 py-2.5 pl-9 pr-3 text-sm text-[var(--palette-zinc-200)] placeholder-[var(--palette-zinc-600)] outline-none focus:border-[var(--palette-violet-600)]"
        />
      </div>

      {/* Bulk actions bar */}
      {selectedUsers.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--palette-violet-800)]/60 bg-[var(--palette-violet-950)]/30 p-3">
          <span className="text-xs font-semibold text-[var(--palette-violet-300)]">{selectedUsers.size} selected</span>
          <button onClick={() => void bulkGrantCoins()} disabled={bulkLoading} className="rounded-lg border border-[var(--palette-amber-800)] px-3 py-1.5 text-xs font-medium text-[var(--palette-amber-300)] hover:bg-[var(--palette-amber-950)] disabled:opacity-50">🪙 Grant coins</button>
          <button onClick={() => void bulkDeleteUsers()} disabled={bulkLoading} className="rounded-lg border border-[var(--palette-rose-800)] px-3 py-1.5 text-xs font-medium text-[var(--palette-rose-400)] hover:bg-[var(--palette-rose-950)] disabled:opacity-50">🗑 Delete</button>
          <button onClick={clearSelection} className="rounded-lg px-3 py-1.5 text-xs text-[var(--palette-zinc-500)] hover:text-[var(--palette-zinc-300)]">Clear</button>
          {bulkResult && <span className={`text-xs ${bulkResult.startsWith("Error") ? "text-[var(--palette-rose-400)]" : "text-[var(--palette-emerald-400)]"}`}>{bulkResult}</span>}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-[var(--palette-zinc-800)]/80">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--palette-zinc-900)]/80 text-xs uppercase tracking-wider text-[var(--palette-zinc-500)]">
            <tr>
              <th className="w-10 px-3 py-3 font-medium">
                <input type="checkbox" checked={selectedUsers.size === users.length && users.length > 0} onChange={() => selectedUsers.size === users.length ? setSelectedUsers(new Set()) : setSelectedUsers(new Set(users.map((u) => u.id)))} className="accent-[var(--palette-violet-600)]" />
              </th>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Sessions</th>
              <th className="px-4 py-3 font-medium">Streak</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-t border-[var(--palette-zinc-800)]/60 hover:bg-[var(--palette-zinc-900)]/40 transition">
                <td className="px-3 py-3">
                  <input type="checkbox" checked={selectedUsers.has(user.id)} onChange={() => toggleUserSelect(user.id)} className="accent-[var(--palette-violet-600)]" />
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-[var(--palette-zinc-200)]">{user.name ?? "Unnamed"}</p>
                  <p className="text-xs text-[var(--palette-zinc-500)]">{maskEmail(user.email)}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-[var(--palette-zinc-600)]">{user.id.slice(0, 8)}…</p>
                </td>
                <td className="px-4 py-3">
                  {user.isGuest
                    ? <Badge label="Guest" color="bg-[var(--palette-zinc-800)] text-[var(--palette-zinc-400)]" />
                    : <Badge label="Registered" color="bg-[var(--palette-sky-950)] text-[var(--palette-sky-400)]" />}
                </td>
                <td className="px-4 py-3">
                  {user.role === "admin"
                    ? <Badge label="Admin" color="bg-[var(--palette-violet-950)] text-[var(--palette-violet-300)]" />
                    : user.role === "bot"
                    ? <Badge label="AI rival" color="bg-[var(--palette-sky-950)] text-[var(--palette-sky-400)]" />
                    : <Badge label="User" color="bg-[var(--palette-zinc-800)] text-[var(--palette-zinc-400)]" />}
                </td>
                <td className="px-4 py-3 tabular-nums">{user.sessionCount}</td>
                <td className="px-4 py-3 tabular-nums">{user.streak} 🔥</td>
                <td className="px-4 py-3 text-xs text-[var(--palette-zinc-500)]">{new Date(user.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onManageUser(user.id)}
                      className="rounded-lg px-2 py-1 text-[11px] font-medium text-[var(--palette-sky-400)] hover:bg-[var(--palette-sky-950)] transition"
                    >Manage</button>
                    <button
                      onClick={() => void toggleRole(user)} disabled={roleLoading === user.id}
                      className="rounded-lg px-2 py-1 text-[11px] font-medium text-[var(--palette-violet-400)] hover:bg-[var(--palette-violet-950)] transition disabled:opacity-50"
                    >{roleLoading === user.id ? "…" : user.role === "admin" ? "Demote" : "Promote"}</button>
                    {deleteConfirm === user.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => void deleteUser(user.id)} disabled={deleteLoading === user.id} className="rounded-lg px-2 py-1 text-[11px] font-medium text-[var(--palette-rose-400)] hover:bg-[var(--palette-rose-950)]">
                          {deleteLoading === user.id ? "…" : "Confirm"}
                        </button>
                        <button onClick={() => setDeleteConfirm(null)} className="rounded-lg px-2 py-1 text-[11px] text-[var(--palette-zinc-500)]">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirm(user.id)} className="rounded-lg px-2 py-1 text-[11px] font-medium text-[var(--palette-rose-400)]/70 hover:bg-[var(--palette-rose-950)] transition">Delete</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MotionTab>
  );
}
