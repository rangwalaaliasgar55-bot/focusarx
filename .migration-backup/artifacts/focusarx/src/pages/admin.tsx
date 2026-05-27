import { useEffect, useState, useCallback } from "react";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminShell } from "@/components/admin/AdminShell";

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

type AdminData = {
  users: AdminUser[];
  activeCount: number;
};

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const token = localStorage.getItem("focusarx-auth-token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/admin/users", { headers, credentials: "include" });
      if (res.status === 401 || res.status === 403) {
        setAuthed(false);
      } else if (res.ok) {
        const json = await res.json() as AdminData;
        setData(json);
        setAuthed(true);
      }
    } catch {
      setAuthed(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const toggleRole = async (user: AdminUser) => {
    const newRole = user.role === "admin" ? "user" : "admin";
    setRoleLoading(user.id);
    try {
      const token = localStorage.getItem("focusarx-auth-token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`/api/admin/users/${user.id}/role`, {
        method: "PATCH",
        headers,
        credentials: "include",
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        setData((prev) => prev ? {
          ...prev,
          users: prev.users.map((u) => u.id === user.id ? { ...u, role: newRole } : u),
        } : prev);
      }
    } finally {
      setRoleLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-rose-400" />
      </div>
    );
  }

  if (!authed) return <AdminGate />;

  const users = data?.users ?? [];
  const activeCount = data?.activeCount ?? 0;

  function maskEmail(email: string) {
    const [local, domain] = email.split("@");
    if (!local || !domain) return email;
    if (email.endsWith("@guest.focusarx.internal")) return "guest";
    return local.slice(0, 2) + "***@" + domain;
  }

  return (
    <AdminShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-zinc-500">All accounts — manage roles, inspect sessions and streaks.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <MetricCard label="Total users" value={String(users.length)} />
          <MetricCard label="Registered" value={String(users.filter((u) => !u.isGuest).length)} />
          <MetricCard label="Guest accounts" value={String(users.filter((u) => u.isGuest).length)} />
          <MetricCard label="Active sessions" value={String(activeCount)} accent="rose" />
        </div>
        <div className="overflow-hidden rounded-xl border border-zinc-800/80">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900/80 text-xs uppercase tracking-wider text-zinc-500">
              <tr>
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
              {users.map((user) => (
                <tr key={user.id} className="border-t border-zinc-800/60 transition hover:bg-zinc-900/40">
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-200">{user.name ?? "Unnamed"}</p>
                    <p className="text-xs text-zinc-500">{maskEmail(user.email)}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-zinc-600">{user.id.slice(0, 8)}…</p>
                  </td>
                  <td className="px-4 py-3">
                    {user.isGuest ? (
                      <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">Guest</span>
                    ) : (
                      <span className="rounded-full bg-sky-950 px-2 py-0.5 text-xs text-sky-400">Registered</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {user.role === "admin" ? (
                      <span className="rounded-full bg-violet-950 px-2 py-0.5 text-xs text-violet-300">Admin</span>
                    ) : (
                      <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">User</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{user.sessionCount}</td>
                  <td className="px-4 py-3 text-zinc-300">{user.streak} 🔥</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {!user.isGuest && (
                      <button
                        onClick={() => void toggleRole(user)}
                        disabled={roleLoading === user.id}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition disabled:opacity-40 ${
                          user.role === "admin"
                            ? "border-rose-800 text-rose-400 hover:bg-rose-950"
                            : "border-violet-800 text-violet-400 hover:bg-violet-950"
                        }`}
                      >
                        {roleLoading === user.id ? "…" : user.role === "admin" ? "Demote" : "Make Admin"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: string; accent?: "rose" }) {
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-4 py-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${accent === "rose" ? "text-rose-400" : "text-zinc-100"}`}>{value}</p>
    </div>
  );
}
