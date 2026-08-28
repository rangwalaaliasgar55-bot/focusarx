/**
 * /developer — Admin God Mode Page
 *
 * Only accessible to users with role=admin in the database.
 * No separate password needed — if you're logged in as admin, you're in.
 *
 * God Mode capabilities:
 * - System overview dashboard (users, sessions, economy, AI)
 * - User search with grant XP/coins/premium/reset streak
 * - Database schema explorer (safe read-only metadata)
 * - Feature flag management
 * - AI budget and cost monitoring
 * - Deployment health and migration status
 * - API documentation browser
 * - Call flow diagrams
 */
import { useState, useEffect, lazy, Suspense, useCallback } from "react";
import { useAuth, isAdminUser } from "@/lib/auth";
import { apiJson } from "@/lib/api";
import { Link } from "wouter";
import {
  Code2, Database, Server, Shield, Cpu, Layers, GitBranch,
  Users, Coins, Zap, Brain, Flag, Activity, Crown, Search,
  ChevronRight, RefreshCw, Send, Star, TrendingUp, AlertTriangle,
  Lock, Gift, Bell, BarChart3, Globe, ArrowUpRight, Timer,
} from "lucide-react";

const SchemaExplorer = lazy(() =>
  import("@/components/developer/SchemaExplorer").then((m) => ({ default: m.SchemaExplorer }))
);
const ApiDocumentation = lazy(() =>
  import("@/components/developer/ApiDocumentation").then((m) => ({ default: m.ApiDocumentation }))
);

type Tab = "overview" | "users" | "economy" | "schema" | "flags" | "ai" | "api" | "flows" | "health";

const TABS: { id: Tab; label: string; icon: typeof Code2 }[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "users", label: "Users", icon: Users },
  { id: "economy", label: "Economy", icon: Coins },
  { id: "flags", label: "Flags", icon: Flag },
  { id: "ai", label: "AI Budget", icon: Brain },
  { id: "schema", label: "Schema", icon: Database },
  { id: "api", label: "API Docs", icon: Code2 },
  { id: "flows", label: "Call Flows", icon: GitBranch },
  { id: "health", label: "Health", icon: Activity },
];

export default function DeveloperPage() {
  const { status, data } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");

  // Gate: only admins can see this page
  if (status === "loading") return <div className="page-container py-20 text-center text-white/40">Loading...</div>;
  if (status === "unauthenticated") return <NotAdminMessage reason="Please sign in to access the developer console." />;
  if (!isAdminUser(data?.user)) return <NotAdminMessage reason="Developer mode requires admin role. Contact an administrator." />;

  return (
    <div className="page-container max-w-7xl mx-auto py-6 px-4">
      <title>Developer Console — FocusArx</title>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-red-500/20 border border-amber-500/20">
            <Crown className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              Developer Console
              <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-full font-medium">GOD MODE</span>
            </h1>
            <p className="text-white/50 text-sm">
              Signed in as <span className="text-amber-300 font-medium">{data?.user?.email}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-2 border-b border-white/10">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t.id
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  : "text-white/50 hover:text-white/70 hover:bg-white/5"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <Suspense fallback={<div className="animate-pulse space-y-4">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-white/5 rounded-lg" />)}</div>}>
        {tab === "overview" && <OverviewTab />}
        {tab === "users" && <UsersTab />}
        {tab === "economy" && <EconomyTab />}
        {tab === "flags" && <FlagsTab />}
        {tab === "ai" && <AiBudgetTab />}
        {tab === "schema" && <SchemaExplorer />}
        {tab === "api" && <ApiDocumentation />}
        {tab === "flows" && <CallFlowsTab />}
        {tab === "health" && <HealthTab />}
      </Suspense>
    </div>
  );
}

function NotAdminMessage({ reason }: { reason: string }) {
  return (
    <div className="page-container flex flex-col items-center justify-center min-h-[60vh] text-center">
      <Lock className="w-12 h-12 text-white/20 mb-4" />
      <h2 className="text-xl font-semibold text-white mb-2">Admin Access Required</h2>
      <p className="text-white/50 mb-6 max-w-md">{reason}</p>
      <Link href="/login" className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors">
        Sign In
      </Link>
    </div>
  );
}

// ─── Overview Tab ────────────────────────────────────────────────────────────

function OverviewTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiJson("/api/developer/overview");
      setData(result);
      setError(null);
    } catch (e) {
      setError("Failed to load overview");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) return <LoadingSkeleton />;
  if (error && !data) return <ErrorBox message={error} onRetry={load} />;
  if (!data) return null;

  const stats = [
    { label: "Total Users", value: data.users?.total ?? 0, icon: Users, color: "blue" },
    { label: "Guest Users", value: data.users?.guests ?? 0, icon: Globe, color: "gray" },
    { label: "Onboarded", value: data.users?.onboarded ?? 0, icon: Star, color: "emerald" },
    { label: "Sessions Today", value: data.sessions?.today ?? 0, icon: Timer, color: "purple" },
    { label: "Sessions (Week)", value: data.sessions?.thisWeek ?? 0, icon: TrendingUp, color: "cyan" },
    { label: "Avg Duration", value: `${Math.round((data.sessions?.avgDuration ?? 0) / 60)}m`, icon: Timer, color: "amber" },
    { label: "Total Coins", value: formatNumber(data.economy?.totalCoins ?? 0), icon: Coins, color: "yellow" },
    { label: "Total XP", value: formatNumber(data.economy?.totalXp ?? 0), icon: Zap, color: "orange" },
    { label: "Avg Level", value: data.economy?.avgLevel ?? 0, icon: ArrowUpRight, color: "pink" },
    { label: "Avg Streak", value: data.streaks?.avgStreak ?? 0, icon: Activity, color: "red" },
    { label: "Max Streak", value: data.streaks?.maxStreak ?? 0, icon: Crown, color: "amber" },
    { label: "Active Premium", value: data.premium?.active ?? 0, icon: Gift, color: "purple" },
  ];

  const colorMap: Record<string, string> = {
    blue: "text-blue-400 bg-blue-500/10", gray: "text-gray-400 bg-gray-500/10",
    emerald: "text-emerald-400 bg-emerald-500/10", purple: "text-purple-400 bg-purple-500/10",
    cyan: "text-cyan-400 bg-cyan-500/10", amber: "text-amber-400 bg-amber-500/10",
    yellow: "text-yellow-400 bg-yellow-500/10", orange: "text-orange-400 bg-orange-500/10",
    pink: "text-pink-400 bg-pink-500/10", red: "text-red-400 bg-red-500/10",
  };

  return (
    <div className="space-y-6">
      {/* Deploy info */}
      <div className="flex items-center gap-4 text-sm">
        <span className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white/60">
          Deploy: <span className="text-white font-mono">{data.deployment?.version}</span>
        </span>
        <span className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white/60">
          Env: <span className="text-white">{data.deployment?.environment}</span>
        </span>
        <button onClick={load} className="ml-auto p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-white/70">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="p-4 bg-white/5 border border-white/10 rounded-xl">
              <div className={`w-8 h-8 rounded-lg ${colorMap[s.color]} flex items-center justify-center mb-2`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="text-xl font-bold text-white">{s.value}</div>
              <div className="text-xs text-white/40">{s.label}</div>
            </div>
          );
        })}
      </div>

      {/* Tasks & Goals */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard title="Tasks" total={data.tasks?.total} completed={data.tasks?.completed} />
        <StatCard title="Goals" total={data.goals?.total} completed={data.goals?.completed} />
      </div>

      {/* Recent signups */}
      {data.recentUsers?.length > 0 && (
        <div className="border border-white/10 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-white/5 border-b border-white/10">
            <h3 className="font-medium text-white text-sm">Recent Signups</h3>
          </div>
          <div className="divide-y divide-white/5">
            {data.recentUsers.map((u: any) => (
              <div key={u.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                <span className={`w-2 h-2 rounded-full ${u.isGuest ? "bg-gray-400" : "bg-emerald-400"}`} />
                <span className="text-white/70 flex-1 truncate">{u.name || u.email}</span>
                <span className="text-white/30 text-xs">{new Date(u.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, total, completed }: { title: string; total?: number; completed?: number }) {
  const pct = total ? Math.round(((completed ?? 0) / total) * 100) : 0;
  return (
    <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
      <h3 className="text-sm font-medium text-white/60 mb-2">{title}</h3>
      <div className="flex items-end gap-2 mb-2">
        <span className="text-2xl font-bold text-white">{completed ?? 0}</span>
        <span className="text-sm text-white/40 mb-0.5">/ {total ?? 0} ({pct}%)</span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Users Tab (God Mode) ────────────────────────────────────────────────────

function UsersTab() {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userDetails, setUserDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [customCoins, setCustomCoins] = useState("1000");
  const [customXp, setCustomXp] = useState("5000");
  const [customStreak, setCustomStreak] = useState("100");
  const [customPremiumDays, setCustomPremiumDays] = useState("30");

  const searchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiJson<{ users: any[] }>(`/api/developer/users?search=${encodeURIComponent(search)}&limit=20`);
      setUsers(result.users);
    } catch { setUsers([]); }
    setLoading(false);
  }, [search]);

  useEffect(() => { searchUsers(); }, [searchUsers]);

  const loadUserDetails = async (userId: string) => {
    try {
      const details = await apiJson(`/api/developer/users/${userId}/details`);
      setUserDetails(details);
    } catch { setUserDetails(null); }
  };

  const selectUser = (u: any) => {
    if (selectedUser?.id === u.id) {
      setSelectedUser(null);
      setUserDetails(null);
    } else {
      setSelectedUser(u);
      loadUserDetails(u.id);
    }
  };

  const doAction = async (action: string, body: Record<string, unknown>, method = "POST") => {
    try {
      await apiJson(`/api/developer/users/${action}`, {
        method,
        body: method !== "DELETE" ? JSON.stringify(body) : undefined,
      });
      setActionResult(`✅ ${action} succeeded`);
      searchUsers();
      if (selectedUser) loadUserDetails(selectedUser.id);
    } catch (e: any) {
      setActionResult(`❌ ${action} failed: ${e.message}`);
    }
    setTimeout(() => setActionResult(null), 5000);
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email or name..."
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
        </div>
      </div>

      {actionResult && (
        <div className={`p-3 rounded-lg text-sm ${actionResult.startsWith("✅") ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>
          {actionResult}
        </div>
      )}

      {/* User list */}
      <div className="border border-white/10 rounded-xl overflow-hidden">
        <div className="divide-y divide-white/5 max-h-[40vh] overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-white/30">Searching...</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-white/30">No users found</div>
          ) : (
            users.map((u) => (
              <button
                key={u.id}
                onClick={() => selectUser(u)}
                className={`w-full text-left px-4 py-3 hover:bg-white/5 transition-colors ${selectedUser?.id === u.id ? "bg-amber-500/10" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${u.role === "admin" ? "bg-amber-400" : u.role === "bot" ? "bg-blue-400" : u.isGuest ? "bg-gray-400" : "bg-emerald-400"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{u.name || u.email}</div>
                    <div className="text-xs text-white/40">{u.email}</div>
                  </div>
                  {u.wallet && (
                    <div className="text-xs text-white/40 flex gap-3 flex-shrink-0">
                      <span>Lv {u.wallet.level}</span>
                      <span className="text-yellow-400">{formatNumber(u.wallet.coins)} 🪙</span>
                      <span className="text-purple-400">{formatNumber(u.wallet.totalXp)} XP</span>
                    </div>
                  )}
                  {u.role === "admin" && <Crown className="w-4 h-4 text-amber-400 flex-shrink-0" />}
                  {u.role === "bot" && <span className="text-xs bg-blue-500/20 text-blue-300 px-1.5 rounded">BOT</span>}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* User Details Panel */}
      {selectedUser && userDetails && (
        <div className="border border-white/10 bg-white/[0.02] rounded-xl p-4">
          <h4 className="text-sm font-medium text-white/60 mb-3">📊 User Stats</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-white/5 rounded-lg p-3">
              <div className="text-lg font-bold text-white">{userDetails.sessionStats?.total ?? 0}</div>
              <div className="text-xs text-white/40">Sessions</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <div className="text-lg font-bold text-white">{userDetails.sessionStats?.totalMinutes ?? 0}m</div>
              <div className="text-xs text-white/40">Focus Time</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <div className="text-lg font-bold text-white">{userDetails.sessionStats?.avgFocus ?? 0}%</div>
              <div className="text-xs text-white/40">Avg Focus</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <div className="text-lg font-bold text-orange-400">{userDetails.streak?.currentStreak ?? 0}</div>
              <div className="text-xs text-white/40">Streak</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <div className="text-lg font-bold text-white">{userDetails.taskStats?.completed ?? 0}/{userDetails.taskStats?.total ?? 0}</div>
              <div className="text-xs text-white/40">Tasks Done</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <div className="text-lg font-bold text-white">{userDetails.goalStats?.completed ?? 0}/{userDetails.goalStats?.total ?? 0}</div>
              <div className="text-xs text-white/40">Goals Done</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <div className="text-lg font-bold text-emerald-400">{userDetails.streak?.longestStreak ?? 0}</div>
              <div className="text-xs text-white/40">Best Streak</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <div className="text-lg font-bold text-amber-400">{userDetails.premium?.isActive ? "✅" : "—"}</div>
              <div className="text-xs text-white/40">Premium</div>
            </div>
          </div>
        </div>
      )}

      {/* God Mode Actions */}
      {selectedUser && (
        <div className="border border-amber-500/20 bg-amber-500/5 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-amber-300 flex items-center gap-2">
            <Crown className="w-4 h-4" />
            God Mode: {selectedUser.name || selectedUser.email}
          </h3>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <ActionButton icon={Coins} label="Grant 1000 Coins" onClick={() => doAction("grant-coins", { userId: selectedUser.id, amount: 1000, reason: "Admin grant" })} />
            <ActionButton icon={Coins} label="Grant 10000 Coins" onClick={() => doAction("grant-coins", { userId: selectedUser.id, amount: 10000, reason: "Admin grant" })} />
            <ActionButton icon={Zap} label="Grant 5000 XP" onClick={() => doAction("grant-xp", { userId: selectedUser.id, amount: 5000 })} />
            <ActionButton icon={Zap} label="Grant 50000 XP" onClick={() => doAction("grant-xp", { userId: selectedUser.id, amount: 50000 })} />
            <ActionButton icon={Gift} label="Grant 30d Premium" onClick={() => doAction("grant-premium", { userId: selectedUser.id, days: 30 })} />
            <ActionButton icon={Gift} label="Grant 365d Premium" onClick={() => doAction("grant-premium", { userId: selectedUser.id, days: 365 })} />
            <ActionButton icon={Activity} label="Set Streak to 100" onClick={() => doAction("reset-streak", { userId: selectedUser.id, streak: 100 })} />
            <ActionButton icon={Activity} label="Reset Streak to 0" onClick={() => doAction("reset-streak", { userId: selectedUser.id, streak: 0 })} />
            <ActionButton icon={Bell} label="Send Notification" onClick={() => doAction("notify", { userId: selectedUser.id, title: "Admin Message", message: "Hello from the developer console!" })} />
          </div>

          {/* Custom Amounts */}
          <div className="border-t border-white/10 pt-4">
            <h4 className="text-sm font-medium text-white/60 mb-3">Custom Amounts</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex gap-2">
                <input type="number" value={customCoins} onChange={e => setCustomCoins(e.target.value)} className="w-24 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50" />
                <ActionButton icon={Coins} label="Grant Coins" onClick={() => doAction("grant-coins", { userId: selectedUser.id, amount: Number(customCoins), reason: "Custom grant" })} />
              </div>
              <div className="flex gap-2">
                <input type="number" value={customXp} onChange={e => setCustomXp(e.target.value)} className="w-24 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50" />
                <ActionButton icon={Zap} label="Grant XP" onClick={() => doAction("grant-xp", { userId: selectedUser.id, amount: Number(customXp) })} />
              </div>
              <div className="flex gap-2">
                <input type="number" value={customStreak} onChange={e => setCustomStreak(e.target.value)} className="w-24 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50" />
                <ActionButton icon={Activity} label="Set Streak" onClick={() => doAction("reset-streak", { userId: selectedUser.id, streak: Number(customStreak) })} />
              </div>
              <div className="flex gap-2">
                <input type="number" value={customPremiumDays} onChange={e => setCustomPremiumDays(e.target.value)} className="w-24 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50" />
                <ActionButton icon={Gift} label="Grant Premium" onClick={() => doAction("grant-premium", { userId: selectedUser.id, days: Number(customPremiumDays) })} />
              </div>
            </div>
          </div>

          {/* Dangerous Zone */}
          <div className="border-t border-red-500/20 pt-4">
            <h4 className="text-sm font-medium text-red-400 mb-3 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" /> Danger Zone
            </h4>
            <div className="flex flex-wrap gap-3">
              <ActionButton
                icon={Shield}
                label={`Set Role: ${selectedUser.role === "admin" ? "user" : "admin"}`}
                onClick={() => doAction("set-role", { userId: selectedUser.id, role: selectedUser.role === "admin" ? "user" : "admin" })}
              />
              {selectedUser.role !== "admin" && (
                <ActionButton
                  icon={AlertTriangle}
                  label="Delete User"
                  onClick={() => {
                    if (confirm(`Delete ${selectedUser.name || selectedUser.email}? This cannot be undone.`)) {
                      doAction(`${selectedUser.id}`, {}, "DELETE");
                    }
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick }: { icon: typeof Coins; label: string; onClick: () => void }) {
  const [loading, setLoading] = useState(false);
  return (
    <button
      onClick={async () => { setLoading(true); await onClick(); setLoading(false); }}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
    >
      <Icon className="w-4 h-4" />
      {loading ? "..." : label}
    </button>
  );
}

// ─── Economy Tab ─────────────────────────────────────────────────────────────

function EconomyTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await apiJson("/api/developer/economy")); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="animate-pulse space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-white/5 rounded-lg" />)}</div>;
  if (!data) return <ErrorBox message="Failed to load economy data" onRetry={load} />;

  return (
    <div className="space-y-6">
      {/* Totals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-yellow-400">{formatNumber(data.totals?.totalCoins ?? 0)}</div>
          <div className="text-xs text-white/40 mt-1">Total Coins in Circulation</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-purple-400">{formatNumber(data.totals?.totalXp ?? 0)}</div>
          <div className="text-xs text-white/40 mt-1">Total XP Earned</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">Lv {data.totals?.avgLevel ?? 0}</div>
          <div className="text-xs text-white/40 mt-1">Average Level</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-white">{formatNumber(data.totals?.usersWithWallets ?? 0)}</div>
          <div className="text-xs text-white/40 mt-1">Active Wallets</div>
        </div>
      </div>

      {/* Leaderboards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top by Coins */}
        <div className="border border-white/10 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-yellow-500/5 border-b border-white/10">
            <h3 className="font-medium text-yellow-300 flex items-center gap-2"><Coins className="w-4 h-4" /> Richest Users</h3>
          </div>
          <div className="divide-y divide-white/5">
            {(data.topCoins ?? []).map((u: any, i: number) => (
              <div key={u.userId} className="px-4 py-2.5 flex items-center gap-3">
                <span className="text-sm text-white/30 w-6">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{u.name || u.email?.split("@")[0]}</div>
                  <div className="text-xs text-white/40">Level {u.level}</div>
                </div>
                <span className="text-sm font-medium text-yellow-400">{formatNumber(u.coins)} 🪙</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top by XP */}
        <div className="border border-white/10 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-purple-500/5 border-b border-white/10">
            <h3 className="font-medium text-purple-300 flex items-center gap-2"><Zap className="w-4 h-4" /> Top XP Earners</h3>
          </div>
          <div className="divide-y divide-white/5">
            {(data.topXp ?? []).map((u: any, i: number) => (
              <div key={u.userId} className="px-4 py-2.5 flex items-center gap-3">
                <span className="text-sm text-white/30 w-6">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{u.name || u.email?.split("@")[0]}</div>
                  <div className="text-xs text-white/40">Level {u.level}</div>
                </div>
                <span className="text-sm font-medium text-purple-400">{formatNumber(u.totalXp)} XP</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Flags Tab ───────────────────────────────────────────────────────────────

function FlagsTab() {
  const [flags, setFlags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiJson<{ flags: any[] }>("/api/developer/flags");
      setFlags(result.flags);
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleFlag = async (id: string, enabled: boolean) => {
    try {
      await apiJson(`/api/developer/flags/${id}`, { method: "PATCH", body: JSON.stringify({ enabled }) });
      setFlags((prev) => prev.map((f) => f.id === id ? { ...f, enabled } : f));
    } catch { /* */ }
  };

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-3">
      {flags.length === 0 ? (
        <div className="p-8 text-center text-white/30">No feature flags found</div>
      ) : (
        flags.map((flag) => (
          <div key={flag.id} className="p-4 bg-white/5 border border-white/10 rounded-xl flex items-center gap-4">
            <button
              onClick={() => toggleFlag(flag.id, !flag.enabled)}
              className={`w-12 h-6 rounded-full transition-colors relative ${flag.enabled ? "bg-emerald-500" : "bg-white/20"}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${flag.enabled ? "left-6" : "left-0.5"}`} />
            </button>
            <div className="flex-1">
              <div className="font-mono text-sm text-white">{flag.key}</div>
              {flag.description && <div className="text-xs text-white/40 mt-0.5">{flag.description}</div>}
            </div>
            <div className="text-xs text-white/30">
              Rollout: {flag.rolloutPercentage}%
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── AI Budget Tab ───────────────────────────────────────────────────────────

function AiBudgetTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiJson("/api/developer/ai-budget");
      setData(result);
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      {/* Budget */}
      <div>
        <h3 className="text-sm font-medium text-white/60 mb-3">Today's Budget ({data?.date})</h3>
        {data?.todayBudget?.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.todayBudget.map((b: any) => {
              const pct = Math.round((b.calls_used / b.cap) * 100);
              return (
                <div key={b.provider} className="p-4 bg-white/5 border border-white/10 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm text-white">{b.provider}</span>
                    <span className="text-xs text-white/40">{b.calls_used} / {b.cap}</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct > 80 ? "bg-red-500" : pct > 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-white/30 text-sm">{data?.error ?? "No budget data available"}</p>
        )}
      </div>

      {/* Recent Usage */}
      <div>
        <h3 className="text-sm font-medium text-white/60 mb-3">Last 24h Usage</h3>
        {data?.recentUsage?.length > 0 ? (
          <div className="border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/5">
                  <th className="text-left px-3 py-2 text-white/50 font-medium">Provider</th>
                  <th className="text-left px-3 py-2 text-white/50 font-medium">Model</th>
                  <th className="text-left px-3 py-2 text-white/50 font-medium">Purpose</th>
                  <th className="text-right px-3 py-2 text-white/50 font-medium">Calls</th>
                  <th className="text-right px-3 py-2 text-white/50 font-medium">Avg ms</th>
                </tr>
              </thead>
              <tbody>
                {data.recentUsage.map((r: any, i: number) => (
                  <tr key={i} className="border-t border-white/5">
                    <td className="px-3 py-2 text-white/70">{r.provider}</td>
                    <td className="px-3 py-2 font-mono text-white/50 text-xs">{r.model}</td>
                    <td className="px-3 py-2 text-white/70">{r.purpose}</td>
                    <td className="px-3 py-2 text-right text-white/70">{r.call_count}</td>
                    <td className="px-3 py-2 text-right text-white/50">{r.avg_latency_ms}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-white/30 text-sm">No AI calls in the last 24 hours</p>
        )}
      </div>
    </div>
  );
}

// ─── Health Tab ──────────────────────────────────────────────────────────────

function HealthTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [devHealth, migrations] = await Promise.all([
        apiJson("/api/developer/health"),
        apiJson("/api/healthz/migrations").catch(() => ({ status: "unknown" })),
      ]);
      setData({ ...devHealth as any, migrations });
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSkeleton />;
  if (!data) return <div className="text-white/30">Failed to load health data</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <HealthCard
          title="Database"
          status={data.database?.connected ? "ok" : "error"}
          details={[
            `Latency: ${data.database?.latencyMs ?? "?"}ms`,
            `Tables: ${data.database?.tableCount ?? "?"}`,
          ]}
        />
        <HealthCard
          title="Deployment"
          status="ok"
          details={[
            `Version: ${data.deployment?.version ?? "?"}`,
            `Env: ${data.deployment?.environment ?? "?"}`,
          ]}
        />
        <HealthCard
          title="Migrations"
          status={data.migrations?.lockStatus === "unlocked" ? "ok" : "warning"}
          details={[
            `Lock: ${data.migrations?.lockStatus ?? "unknown"}`,
            data.migrations?.lockedBy ? `By: ${data.migrations.lockedBy}` : "",
          ].filter(Boolean)}
        />
      </div>
      <div className="text-xs text-white/30">
        Last checked: {data.timestamp}
      </div>
    </div>
  );
}

function HealthCard({ title, status, details }: { title: string; status: "ok" | "warning" | "error"; details: string[] }) {
  const colors = { ok: "bg-emerald-500", warning: "bg-amber-500", error: "bg-red-500" };
  return (
    <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-3 h-3 rounded-full ${colors[status]}`} />
        <span className="font-medium text-white">{title}</span>
      </div>
      {details.map((d, i) => d && <div key={i} className="text-xs text-white/50 mb-1">{d}</div>)}
    </div>
  );
}

// ─── Call Flows Tab ──────────────────────────────────────────────────────────

function CallFlowsTab() {
  const flows = [
    { title: "Starting a Focus Session", steps: ["User clicks 'Start Focus' → POST /api/sessions/active", "Server validates auth, checks no active session", "Creates active_sessions row with server timestamp", "Returns session ID + initial timer state", "Frontend starts local countdown timer", "Periodic PUT /api/sessions/sync updates focus timeline"] },
    { title: "Completing a Session (Anti-Cheat)", steps: ["Timer reaches zero → POST /api/sessions", "Server validates idempotency key (client_nonce)", "Calculates actual duration from server timestamps", "Awards XP via sessionCompletionCore (server-authoritative)", "Updates streak via studyStreaksTable (transactional)", "Inserts coin_transactions audit record", "Checks achievement unlocks", "Deletes active_sessions row", "Returns completion summary with rewards"] },
    { title: "Deployment Skew Detection (v2)", steps: ["Frontend attaches X-FocusArx-Deployment header to every request", "Server compares with its own deployment version", "GET requests: always pass (safe to retry)", "POST/PUT/DELETE: blocked with 409 DEPLOYMENT_SKEW", "Frontend queues idempotent mutations in sessionStorage", "User sees 'Update available' banner", "Click 'Update now' → form data saved → SW cache cleared → hard refresh", "After refresh: queued mutations auto-replayed", "Multi-tab: BroadcastChannel notifies all tabs"] },
    { title: "Silent Auth Refresh", steps: ["Access token expires (15 min) → API returns 401", "apiFetch detects 401, calls tryRefreshSession()", "POST /api/auth/refresh with refresh_token cookie", "Server rotates token (old revoked, new issued)", "New access_token persisted in localStorage", "Original request replayed with new token", "Web Locks API prevents concurrent tab refresh races"] },
  ];

  return (
    <div className="space-y-6">
      {flows.map((flow) => (
        <div key={flow.title} className="border border-white/10 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-white/5 border-b border-white/10">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              {flow.title}
            </h3>
          </div>
          <div className="p-4">
            <ol className="space-y-2">
              {flow.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/10 text-white/50 text-xs flex items-center justify-center font-mono">{i + 1}</span>
                  <span className="text-white/70 pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Shared Components ───────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-16 bg-white/5 rounded-lg" />
      ))}
    </div>
  );
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3">
      <AlertTriangle className="w-5 h-5 text-red-400" />
      <span className="text-red-300 text-sm flex-1">{message}</span>
      <button onClick={onRetry} className="px-3 py-1.5 bg-red-500/20 text-red-300 rounded-lg text-sm hover:bg-red-500/30">Retry</button>
    </div>
  );
}

function formatNumber(n: number | string): string {
  const num = Number(n);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
}
