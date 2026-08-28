import { useEffect, useState, useCallback } from "react";

import { AdminGate } from "@/components/admin/AdminGate";
import { AdminShell } from "@/components/admin/AdminShell";
import { AnalyticsDashboard } from "@/components/admin/AnalyticsDashboard";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { MotionTab, SectionHeader } from "@/components/admin/AdminHelpers";

// ─── Extracted Panel Components ──────────────────────────────────────────────
import { AdminOverviewPanel } from "@/components/admin/AdminOverviewPanel";
import { AdminUserPanel } from "@/components/admin/AdminUserPanel";
import { AdminMarketplacePanel } from "@/components/admin/AdminMarketplacePanel";
import { AdminQuestsPanel } from "@/components/admin/AdminQuestsPanel";
import { AdminLootboxPanel } from "@/components/admin/AdminLootboxPanel";
import { AdminPetsPanel } from "@/components/admin/AdminPetsPanel";
import { AdminBattlePassPanel } from "@/components/admin/AdminBattlePassPanel";
import { AdminDropsPanel } from "@/components/admin/AdminDropsPanel";
import { AdminEconomyPanel } from "@/components/admin/AdminEconomyPanel";
import { AdminNotifyPanel } from "@/components/admin/AdminNotifyPanel";
import { AdminEmailPanel } from "@/components/admin/AdminEmailPanel";
import { AdminPremiumPanel } from "@/components/admin/AdminPremiumPanel";
import { AdminModerationPanel } from "@/components/admin/AdminModerationPanel";
import { AdminSitePanel } from "@/components/admin/AdminSitePanel";
import { AdminCoinsPanel } from "@/components/admin/AdminCoinsPanel";
import { AdminMissionsPanel } from "@/components/admin/AdminMissionsPanel";
import { AdminRetentionPanel } from "@/components/admin/AdminRetentionPanel";
import { AdminRivalsPanel } from "@/components/admin/AdminRivalsPanel";
import { AdminCityPanel } from "@/components/admin/AdminCityPanel";
import { AdminTokensPanel } from "@/components/admin/AdminTokensPanel";
import { AdminFlagsPanel } from "@/components/admin/AdminFlagsPanel";
import { UserManagerDialog } from "@/components/admin/UserManagerDialog";
import { GeminiPanel } from "@/components/admin/GeminiPanel";
import { SqlConsolePanel } from "@/components/admin/SqlConsolePanel";

// ─── Types ──────────────────────────────────────────────────────────────────
import type { AdminStats, AdminData, CmsOverview, Tab } from "@/components/admin/AdminTypes";

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { data: session, status: authStatus } = useAuth();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [data, setData] = useState<AdminData | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [missionData, setMissionData] = useState<any>(null);
  const [retentionData, setRetentionData] = useState<any>(null);
  const [bpStats, setBpStats] = useState<{ stats: any; tierDistribution: any[] }>({ stats: null, tierDistribution: [] });
  const [petStats, setPetStats] = useState<{ stats: any[]; totalPets: number }>({ stats: [], totalPets: 0 });
  const [cmsOverview, setCmsOverview] = useState<CmsOverview>({ users: null, wallets: null, marketplace: null, quests: null });
  const [managingUserId, setManagingUserId] = useState<string | null>(null);

  const authHeaders = useCallback((): Record<string, string> => {
    const token = localStorage.getItem("focusarx-auth-token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const loadData = useCallback(async () => {
    if (authStatus === "loading") return;
    try {
      const [usersRes, statsRes, missionsRes, retentionRes] = await Promise.all([
        fetch("/api/admin/users", { headers: authHeaders(), credentials: "include" }),
        fetch("/api/admin/stats", { headers: authHeaders(), credentials: "include" }),
        fetch("/api/admin/missions", { headers: authHeaders(), credentials: "include" }),
        fetch("/api/admin/retention", { headers: authHeaders(), credentials: "include" }),
      ]);
      if (usersRes.status === 401 || usersRes.status === 403) { setAuthed(false); return; }
      if (usersRes.ok) { setData(await usersRes.json() as AdminData); setAuthed(true); }
      if (statsRes.ok) setStats(await statsRes.json() as AdminStats);
      if (missionsRes.ok) setMissionData(await missionsRes.json());
      if (retentionRes.ok) setRetentionData(await retentionRes.json());
    } catch { setAuthed(false); }
    finally { setLoading(false); }
  }, [authHeaders, authStatus]);

  useEffect(() => { void loadData(); }, [loadData]);

  // Lazy load data when tabs are visited
  useEffect(() => {
    if (tab === "battlepass" && !bpStats.stats) {
      fetch("/api/admin/cms/battle-pass", { headers: authHeaders(), credentials: "include" })
        .then(r => r.ok ? r.json() : null).then(d => d && setBpStats(d)).catch(() => {});
    }
    if (tab === "pets" && petStats.stats.length === 0) {
      fetch("/api/admin/cms/pets", { headers: authHeaders(), credentials: "include" })
        .then(r => r.ok ? r.json() : null).then(d => d && setPetStats(d)).catch(() => {});
    }
    if (tab === "overview" && !cmsOverview.users) {
      fetch("/api/admin/cms/overview", { headers: authHeaders(), credentials: "include" })
        .then(r => r.ok ? r.json() : null).then(d => d && setCmsOverview(d)).catch(() => {});
    }
  }, [tab, authHeaders]);

  // ─── Loading / Auth States ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--palette-zinc-700)] border-t-[var(--palette-rose-400)]" />
      </div>
    );
  }

  if (!authed) {
    return (
      <AdminGate onUnlocked={() => { setAuthed(true); setLoading(true); void loadData(); }} />
    );
  }

  const allUsers = data?.users ?? [];
  const maxSessions = Math.max(1, ...(stats?.dailyChart.map(d => d.sessions) ?? [1]));

  // ─── Tab Renderer ─────────────────────────────────────────────────────────

  const TAB_RENDER: Record<Tab, () => React.ReactNode> = {
    overview: () => (
      <AdminOverviewPanel
        stats={stats}
        data={data!}
        users={allUsers}
        cmsOverview={cmsOverview}
        maxSessions={maxSessions}
        onNavigateToUsers={() => setTab("users")}
      />
    ),
    analytics: () => (
      <MotionTab>
        <SectionHeader title="Advanced Analytics" sub="Deep-dive into platform events and visitor data." />
        <AnalyticsDashboard authHeaders={authHeaders} />
      </MotionTab>
    ),
    users: () => (
      <AdminUserPanel
        data={data!}
        stats={stats}
        authHeaders={authHeaders}
        onDataChanged={() => loadData()}
      />
    ),
    moderation: () => <AdminModerationPanel authHeaders={authHeaders} />,
    missions: () => <AdminMissionsPanel data={missionData} />,
    retention: () => <AdminRetentionPanel data={retentionData} />,
    sql: () => (
      <MotionTab>
        <SectionHeader
          title="SQL Console"
          sub="Read-only by default (SELECT / SHOW / EXPLAIN / WITH). Write mode unlocks for 15 minutes with the typed phrase; destructive statements need a second confirmation."
        />
        <SqlConsolePanel authHeaders={authHeaders} />
      </MotionTab>
    ),
    rivals: () => <AdminRivalsPanel authHeaders={authHeaders} onManageUser={(id) => setManagingUserId(id)} />,
    marketplace: () => <AdminMarketplacePanel authHeaders={authHeaders} />,
    pets: () => <AdminPetsPanel petStats={petStats} />,
    lootboxes: () => <AdminLootboxPanel authHeaders={authHeaders} />,
    battlepass: () => <AdminBattlePassPanel bpStats={bpStats} />,
    quests: () => <AdminQuestsPanel authHeaders={authHeaders} />,
    city: () => <AdminCityPanel />,
    notify: () => <AdminNotifyPanel authHeaders={authHeaders} />,
    drops: () => <AdminDropsPanel authHeaders={authHeaders} />,
    economy: () => <AdminEconomyPanel authHeaders={authHeaders} />,
    gemini: () => (
      <MotionTab>
        <SectionHeader
          title="Gemini Chief-of-Staff"
          sub="AI budget & traffic, idea backlog with human approval, daily IST briefing + SEO officer, and bot-fleet ops reviews."
        />
        <GeminiPanel authHeaders={authHeaders} />
      </MotionTab>
    ),
    coins: () => <AdminCoinsPanel authHeaders={authHeaders} users={allUsers} />,
    email: () => <AdminEmailPanel authHeaders={authHeaders} />,
    premium: () => <AdminPremiumPanel authHeaders={authHeaders} />,
    site: () => <AdminSitePanel authHeaders={authHeaders} />,
    tokens: () => <AdminTokensPanel authHeaders={authHeaders} />,
    flags: () => <AdminFlagsPanel authHeaders={authHeaders} />,
  };

  return (
    <AdminShell activeTab={tab} onTabChange={(t) => setTab(t as Tab)}>
      <div key={tab}>
        {TAB_RENDER[tab]?.() ?? null}
      </div>

      <UserManagerDialog
        userId={managingUserId}
        onClose={() => setManagingUserId(null)}
        onChanged={() => void loadData()}
        authHeaders={authHeaders}
      />
    </AdminShell>
  );
}
