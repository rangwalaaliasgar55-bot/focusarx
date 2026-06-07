import { useEffect, useState, useCallback } from "react";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminShell } from "@/components/admin/AdminShell";
import { AnalyticsDashboard } from "@/components/admin/AnalyticsDashboard";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";

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

type DailyPoint = {
  day: string;
  date: string;
  sessions: number;
  minutes: number;
};

type TopUser = {
  id: string;
  name: string;
  email: string;
  isGuest: boolean;
  minutes: number;
};

type AdminStats = {
  totalUsers: number;
  registeredUsers: number;
  guestCount?: number;
  totalFocusHours: number;
  totalSessions: number;
  activeSessions: number;
  newUsersThisWeek: number;
  dailyChart: DailyPoint[];
  topUsers: TopUser[];
};

type AdminData = {
  users: AdminUser[];
  activeCount: number;
  guestCount?: number;
};

type Tab = "overview" | "analytics" | "users" | "missions";

export default function AdminPage() {
  const { data: session, status: authStatus } = useAuth();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [data, setData] = useState<AdminData | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [purgeLoading, setPurgeLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [missionData, setMissionData] = useState<{ missions: any[]; totalCompletions: number; totalClaims: number } | null>(null);

  const authHeaders = useCallback((): Record<string, string> => {
    const token = localStorage.getItem("focusarx-auth-token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const loadData = useCallback(async () => {
    if (authStatus === "loading") return;
    try {
      const [usersRes, statsRes, missionsRes] = await Promise.all([
        fetch("/api/admin/users", { headers: authHeaders(), credentials: "include" }),
        fetch("/api/admin/stats", { headers: authHeaders(), credentials: "include" }),
        fetch("/api/admin/missions", { headers: authHeaders(), credentials: "include" }),
      ]);
      if (usersRes.status === 401 || usersRes.status === 403) {
        setAuthed(false);
        return;
      }
      if (usersRes.ok) {
        const json = await usersRes.json() as AdminData;
        setData(json);
        setAuthed(true);
      }
      if (statsRes.ok) {
        const json = await statsRes.json() as AdminStats;
        setStats(json);
      }
      if (missionsRes && missionsRes.ok) {
        const json = await missionsRes.json();
        setMissionData(json);
      }
    } catch {
      setAuthed(false);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, authStatus]);

  useEffect(() => { void loadData(); }, [loadData]);

  const toggleRole = async (user: AdminUser) => {
    const newRole = user.role === "admin" ? "user" : "admin";
    setRoleLoading(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
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

  const deleteUser = async (id: string) => {
    setDeleteLoading(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
        credentials: "include",
      });
      if (res.ok) {
        setData((prev) => prev ? { ...prev, users: prev.users.filter((u) => u.id !== id) } : prev);
        setStats((prev) => prev ? { ...prev, totalUsers: prev.totalUsers - 1 } : prev);
      }
    } finally {
      setDeleteLoading(null);
      setDeleteConfirm(null);
    }
  };

  const purgeAllGuests = async () => {
    const guestCount = stats?.guestCount ?? data?.guestCount ?? 0;
    if (guestCount === 0) return;
    if (!window.confirm(`Delete all ${guestCount} guest account(s)? This cannot be undone.`)) return;
    setPurgeLoading(true);
    try {
      const res = await fetch("/api/admin/users/guests", {
        method: "DELETE",
        headers: authHeaders(),
        credentials: "include",
      });
      if (res.ok) {
        await loadData();
      }
    } finally {
      setPurgeLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-rose-400" />
      </div>
    );
  }

  if (!authed) {
    return (
      <AdminGate
        onUnlocked={() => {
          setAuthed(true);
          setLoading(true);
          void loadData();
        }}
      />
    );
  }

  const users = data?.users ?? [];

  function maskEmail(email: string) {
    const [local, domain] = email.split("@");
    if (!local || !domain) return email;
    if (email.endsWith("@guest.focusarx.internal")) return "guest";
    return local.slice(0, 2) + "***@" + domain;
  }

  const maxSessions = Math.max(1, ...(stats?.dailyChart.map((d) => d.sessions) ?? [1]));

  return (
    <AdminShell>
      <div className="space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Admin Dashboard</h1>
            <p className="mt-1 text-sm text-zinc-500">Platform overview and user management.</p>
          </div>
          <div className="flex items-center gap-2">
            {(stats?.guestCount ?? data?.guestCount ?? 0) > 0 && (
              <button
                onClick={() => void purgeAllGuests()}
                disabled={purgeLoading}
                className="rounded-lg border border-amber-900/60 bg-amber-950/40 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-950/70 disabled:opacity-50"
              >
                {purgeLoading ? "Purging…" : `Purge ${stats?.guestCount ?? data?.guestCount} guest(s)`}
              </button>
            )}
            <div className="flex gap-1 rounded-xl border border-zinc-800 bg-zinc-900/60 p-1">
            {(["overview", "analytics", "users", "missions"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-4 py-1.5 text-xs font-medium capitalize transition ${
                  tab === t
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {t}
              </button>
            ))}
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {tab === "overview" ? (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="space-y-6"
            >
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <StatCard label="Registered users" value={String(stats?.totalUsers ?? users.length)} />
                <StatCard label="New this week" value={String(stats?.newUsersThisWeek ?? 0)} accent="sky" />
                <StatCard label="Active sessions" value={String(stats?.activeSessions ?? data?.activeCount ?? 0)} accent="rose" />
                <StatCard label="Total focus hrs" value={String(stats?.totalFocusHours ?? 0)} accent="violet" />
                <StatCard label="Total sessions" value={String(stats?.totalSessions ?? 0)} />
              </div>

              <div className="grid gap-4 lg:grid-cols-5">
                <div className="lg:col-span-3 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-5">
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Platform activity — last 7 days</p>
                  <div className="mt-4 flex items-end gap-1.5 h-32">
                    {(stats?.dailyChart ?? Array.from({ length: 7 }, (_, i) => ({ day: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][i] ?? "?", date: "", sessions: 0, minutes: 0 }))).map((d) => (
                      <div key={d.date || d.day} className="flex flex-1 flex-col items-center gap-1">
                        <div
                          className="w-full rounded-t-md bg-rose-500/70 transition-all hover:bg-rose-400/90"
                          style={{ height: `${Math.round((d.sessions / maxSessions) * 100)}%`, minHeight: d.sessions > 0 ? "4px" : "2px" }}
                          title={`${d.sessions} sessions · ${d.minutes}m`}
                        />
                        <span className="text-[10px] text-zinc-600">{d.day}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-rose-500/70" />
                    <span className="text-xs text-zinc-500">Sessions per day</span>
                  </div>
                </div>

                <div className="lg:col-span-2 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-5">
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Top focusers</p>
                  <div className="mt-3 space-y-2.5">
                    {(stats?.topUsers ?? []).length === 0 && (
                      <p className="text-sm text-zinc-600">No sessions yet.</p>
                    )}
                    {(stats?.topUsers ?? []).map((u, i) => (
                      <div key={u.id} className="flex items-center gap-3">
                        <span className={`w-5 shrink-0 text-center text-xs font-bold ${i === 0 ? "text-amber-400" : i === 1 ? "text-zinc-300" : i === 2 ? "text-orange-600" : "text-zinc-600"}`}>
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-zinc-200">{u.name || maskEmail(u.email)}</p>
                          <p className="text-xs text-zinc-500">{u.minutes}m focused</p>
                        </div>
                        <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className="h-full rounded-full bg-violet-500/70"
                            style={{ width: `${Math.round((u.minutes / Math.max(1, stats?.topUsers[0]?.minutes ?? 1)) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-3">Recent signups</p>
                <div className="divide-y divide-zinc-800/60">
                  {users.slice(0, 5).map((u) => (
                    <div key={u.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <span className="text-sm text-zinc-200">{u.name ?? "Unnamed"}</span>
                        <span className="ml-2 text-xs text-zinc-500">{maskEmail(u.email)}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-500">
                        <span>{u.sessionCount} sessions</span>
                        <span>{u.streak} 🔥</span>
                        <span>{new Date(u.createdAt).toLocaleDateString()}</span>
                        {u.role === "admin" && (
                          <span className="rounded-full bg-violet-950 px-2 py-0.5 text-violet-300">Admin</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {users.length > 5 && (
                  <button
                    onClick={() => setTab("users")}
                    className="mt-3 text-xs text-zinc-500 hover:text-zinc-300 transition"
                  >
                    View all {users.length} users →
                  </button>
                )}
              </div>
            </motion.div>
          ) : tab === "analytics" ? (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <AnalyticsDashboard authHeaders={authHeaders} />
            </motion.div>
          ) : tab === "missions" ? (
            <motion.div
              key="missions"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="space-y-6"
            >
              {/* Mission KPIs */}
              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard label="Total completions" value={String(missionData?.totalCompletions ?? 0)} accent="violet" />
                <StatCard label="Rewards claimed" value={String(missionData?.totalClaims ?? 0)} accent="sky" />
                <StatCard label="Mission types" value={String(missionData?.missions?.length ?? 0)} />
              </div>

              {/* Mission breakdown table */}
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden">
                <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Mission Performance</p>
                  <span className="text-xs text-zinc-600">{missionData?.missions?.length ?? 0} missions</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-900/80 text-xs uppercase tracking-wider text-zinc-500">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">Mission</th>
                        <th className="px-4 py-2.5 font-medium">Type</th>
                        <th className="px-4 py-2.5 font-medium">Difficulty</th>
                        <th className="px-4 py-2.5 font-medium">Completions</th>
                        <th className="px-4 py-2.5 font-medium">Claims</th>
                        <th className="px-4 py-2.5 font-medium">Rate</th>
                        <th className="px-4 py-2.5 font-medium">XP/Coins</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {(missionData?.missions ?? []).map((m: any) => (
                        <tr key={m.key} className="hover:bg-zinc-900/30 transition">
                          <td className="px-4 py-2.5">
                            <span className="mr-1.5">{m.icon}</span>
                            <span className="text-zinc-200 text-xs font-medium">{m.title}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.type === "daily" ? "bg-blue-950 text-blue-400" : "bg-purple-950 text-purple-400"}`}>
                              {m.type}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs font-medium ${m.difficulty === "epic" ? "text-purple-400" : m.difficulty === "hard" ? "text-red-400" : m.difficulty === "medium" ? "text-amber-400" : "text-emerald-400"}`}>
                              {m.difficulty}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-zinc-300 text-xs">{m.completions}</td>
                          <td className="px-4 py-2.5 text-zinc-300 text-xs">{m.claims}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 rounded-full bg-zinc-800 overflow-hidden">
                                <div className="h-full rounded-full bg-violet-500/70" style={{ width: `${m.completionRate}%` }} />
                              </div>
                              <span className="text-[10px] text-zinc-500">{m.completionRate}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="text-[10px] text-violet-400">+{m.xpReward}xp</span>
                            <span className="text-[10px] text-zinc-600 mx-1">·</span>
                            <span className="text-[10px] text-amber-400">{m.coinReward}🪙</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="users"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="space-y-4"
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard label="Registered users" value={String(users.length)} />
                <StatCard label="Active sessions" value={String(data?.activeCount ?? 0)} accent="rose" />
                {(data?.guestCount ?? stats?.guestCount ?? 0) > 0 && (
                  <StatCard label="Guest accounts (DB)" value={String(data?.guestCount ?? stats?.guestCount ?? 0)} accent="violet" />
                )}
              </div>

              <div className="overflow-x-auto rounded-xl border border-zinc-800/80">
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
                        <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">{new Date(user.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
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
                            <button
                              onClick={() => setDeleteConfirm(user.id)}
                              className="rounded-lg border border-zinc-800 px-2.5 py-1 text-xs text-zinc-500 transition hover:border-red-900 hover:text-red-400"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={() => setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
            >
              <h2 className="text-base font-semibold text-zinc-100">Delete user?</h2>
              <p className="mt-2 text-sm text-zinc-400">
                This will permanently remove this account and all their data. This cannot be undone.
              </p>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 rounded-xl border border-zinc-700 py-2 text-sm text-zinc-400 transition hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void deleteUser(deleteConfirm)}
                  disabled={deleteLoading === deleteConfirm}
                  className="flex-1 rounded-xl bg-red-700 py-2 text-sm font-medium text-white transition hover:bg-red-600 disabled:opacity-50"
                >
                  {deleteLoading === deleteConfirm ? "Deleting…" : "Delete"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminShell>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: "rose" | "sky" | "violet" }) {
  const color = accent === "rose" ? "text-rose-400" : accent === "sky" ? "text-sky-400" : accent === "violet" ? "text-violet-400" : "text-zinc-100";
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-4 py-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}
