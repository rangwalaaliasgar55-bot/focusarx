import { useEffect, useState, useCallback } from "react";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminShell } from "@/components/admin/AdminShell";
import { AnalyticsDashboard } from "@/components/admin/AnalyticsDashboard";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  Plus, Pencil, Trash2, Save, X, Send, CheckCircle, RefreshCw,
  Gift, Coins, AlertTriangle, ChevronDown, ChevronUp, Star, Search, Bot, Settings2
} from "lucide-react";
import { UserManagerDialog } from "@/components/admin/UserManagerDialog";
import { GeminiPanel } from "@/components/admin/GeminiPanel";
import { SqlConsolePanel } from "@/components/admin/SqlConsolePanel";

// ─── Types ────────────────────────────────────────────────────────────────────

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

type DailyPoint = { day: string; date: string; sessions: number; minutes: number };
type TopUser = { id: string; name: string; email: string; isGuest: boolean; minutes: number };
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
type AdminData = { users: AdminUser[]; activeCount: number; guestCount?: number; botCount?: number };

type MarketplaceItem = {
  id: string; name: string; description: string; type: string;
  costCoins: number; rarity: string; emoji: string; isActive: boolean;
};
type LootBoxType = {
  id: string; name: string; description: string; coinCost: number;
  rarity: string; icon: string; glowColor: string; sessionsRequired: number;
  possibleRewards: any[];
};
type QuestDef = {
  id: string; title: string; description: string; type: string;
  metric: string; target: number;
  xpReward: number; coinReward: number; icon: string; isActive: boolean; difficulty?: string;
};
type BattlePassStats = {
  stats: { totalUsers: number; avgTier: number; avgXp: number; premiumCount: number; maxTier: number } | null;
  tierDistribution: { tier: number; count: number }[];
};
type PetStats = { stats: { petType: string; count: number; avgLevel: number }[]; totalPets: number };
type CmsOverview = {
  users: { total: number; registered: number; guests: number; admins: number } | null;
  wallets: { totalCoins: number; totalXp: number; avgCoins: number; avgXp: number } | null;
  marketplace: { totalItems: number; activeItems: number } | null;
  quests: { totalQuests: number; activeQuests: number } | null;
};

type Tab =
  | "overview" | "analytics" | "users" | "moderation" | "missions" | "retention" | "sql" | "rivals"
  | "marketplace" | "pets" | "lootboxes" | "battlepass" | "quests"
  | "city" | "notify" | "drops" | "economy" | "coins" | "email" | "premium" | "site" | "gemini";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, accent, sub }: { label: string; value: string; accent?: "rose" | "sky" | "violet" | "amber" | "emerald"; sub?: string }) {
  const configs = {
    rose: { text: "text-[var(--palette-rose-400)]", bg: "bg-[var(--palette-rose-500)]/10", border: "border-[var(--palette-rose-500)]/20" },
    sky: { text: "text-[var(--palette-sky-400)]", bg: "bg-[var(--palette-sky-500)]/10", border: "border-[var(--palette-sky-500)]/20" },
    violet: { text: "text-[var(--palette-violet-400)]", bg: "bg-[var(--palette-violet-500)]/10", border: "border-[var(--palette-violet-500)]/20" },
    amber: { text: "text-[var(--palette-amber-400)]", bg: "bg-[var(--palette-amber-500)]/10", border: "border-[var(--palette-amber-500)]/20" },
    emerald: { text: "text-[var(--palette-emerald-400)]", bg: "bg-[var(--palette-emerald-500)]/10", border: "border-[var(--palette-emerald-500)]/20" },
  };
  const config = accent ? configs[accent] : { text: "text-[var(--palette-zinc-100)]", bg: "bg-[var(--palette-zinc-800)]/10", border: "border-[var(--palette-zinc-800)]/40" };

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className={`rounded-[var(--radius-xl)] border ${config.border} ${config.bg} p-4 shadow-[var(--shadow-sm)] backdrop-blur-xl transition-all sm:p-5`}
    >
      <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[var(--foreground-subtle)]">{label}</p>
      <p className={`text-2xl font-bold ${config.text} tracking-tight tabular-nums sm:text-3xl`}>{value}</p>
      {sub && <p className="mt-2 inline-block rounded-full bg-[var(--surface-hover)] px-2 py-0.5 text-[0.6875rem] font-medium text-[var(--foreground-muted)]">{sub}</p>}
    </motion.div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <header className="mb-6 border-b border-[var(--border-subtle)] pb-5">
      <p className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[var(--danger)]">Administration</p>
      <h1 className="text-balance text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">{title}</h1>
      {sub && <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[var(--foreground-muted)]">{sub}</p>}
    </header>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${color}`}>{label}</span>;
}

function MotionTab({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="mx-auto max-w-[100rem] space-y-6"
    >
      {children}
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

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
  const [missionData, setMissionData] = useState<{ missions: { key: string; title: string; completions: number; claims: number; completionRate: number }[]; totalCompletions: number; totalClaims: number } | null>(null);
  const [retentionData, setRetentionData] = useState<any>(null);

  // CMS State
  const [marketplaceItems, setMarketplaceItems] = useState<MarketplaceItem[]>([]);
  const [marketplaceLoading, setMarketplaceLoading] = useState(false);
  const [marketplaceEditId, setMarketplaceEditId] = useState<string | null>(null);
  const [marketplaceForm, setMarketplaceForm] = useState<Partial<MarketplaceItem>>({});
  const [marketplaceAddMode, setMarketplaceAddMode] = useState(false);

  const [lootboxTypes, setLootboxTypes] = useState<LootBoxType[]>([]);
  const [lootboxLoading, setLootboxLoading] = useState(false);
  const [lootboxEditId, setLootboxEditId] = useState<string | null>(null);
  const [lootboxForm, setLootboxForm] = useState<Partial<LootBoxType>>({});

  const [quests, setQuests] = useState<QuestDef[]>([]);
  const [questsLoading, setQuestsLoading] = useState(false);
  const [questEditId, setQuestEditId] = useState<string | null>(null);
  const [questForm, setQuestForm] = useState<Partial<QuestDef>>({});
  const [questAddMode, setQuestAddMode] = useState(false);

  const [bpStats, setBpStats] = useState<BattlePassStats>({ stats: null, tierDistribution: [] });
  const [petStats, setPetStats] = useState<PetStats>({ stats: [], totalPets: 0 });
  const [cmsOverview, setCmsOverview] = useState<CmsOverview>({ users: null, wallets: null, marketplace: null, quests: null });

  // Notification blast
  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyMessage, setNotifyMessage] = useState("");
  const [notifyType, setNotifyType] = useState("system");
  const [notifySending, setNotifySending] = useState(false);
  const [notifyResult, setNotifyResult] = useState<{ sent: number } | null>(null);
  const [notifyError, setNotifyError] = useState<string | null>(null);

  // Coin grant
  const [grantUserId, setGrantUserId] = useState("");
  const [grantAmount, setGrantAmount] = useState("");
  const [grantReason, setGrantReason] = useState("");
  const [grantLoading, setGrantLoading] = useState(false);
  const [grantResult, setGrantResult] = useState<{ newBalance: number } | null>(null);
  const [grantError, setGrantError] = useState<string | null>(null);

  // Email blast
  const [emailTemplate, setEmailTemplate] = useState("welcome");
  const [emailAudience, setEmailAudience] = useState<"all" | "inactive" | "premium" | "selected">("all");
  const [emailCustomSubject, setEmailCustomSubject] = useState("");
  const [emailCustomHtml, setEmailCustomHtml] = useState("");
  const [emailBlasting, setEmailBlasting] = useState(false);
  const [emailResult, setEmailResult] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [emailLogsLoading, setEmailLogsLoading] = useState(false);
  const [emailTemplates, setEmailTemplates] = useState<{ key: string; subject: string }[]>([]);

  // Premium management
  const [premiumUsers, setPremiumUsers] = useState<any[]>([]);
  const [premiumLoading, setPremiumLoading] = useState(false);
  const [premiumGrantId, setPremiumGrantId] = useState("");
  const [premiumGranting, setPremiumGranting] = useState(false);
  const [premiumGrantResult, setPremiumGrantResult] = useState<string | null>(null);

  // Moderation queue state
  const [moderationPosts, setModerationPosts] = useState<any[]>([]);
  const [moderationCount, setModerationCount] = useState(0);
  const [moderationLoading, setModerationLoading] = useState(false);
  const [moderationActionId, setModerationActionId] = useState<string | null>(null);
  const [digestSending, setDigestSending] = useState(false);
  const [digestResult, setDigestResult] = useState<string | null>(null);

  // Bulk user actions
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  // User manager + search + AI rivals
  const [userSearch, setUserSearch] = useState("");
  const [managingUserId, setManagingUserId] = useState<string | null>(null);
  const [botsState, setBotsState] = useState<{
    bots: any[];
    total: number;
    personas: number;
    stats?: { total: number; today: { posts: number; comments: number; reactions: number; follows: number; pendingReplies: number } };
    preview?: Array<{ name: string; bio: string; xp: number; streak: number; timezone: string }>;
    istDay?: string;
  } | null>(null);
  const [botsLoading, setBotsLoading] = useState(false);
  const [botsBusy, setBotsBusy] = useState(false);

  // Admin Drops state
  const [dropsState, setDropsState] = useState<{
    drops: any[];
    sparklines: Record<string, Array<{ bucket: string; n: number }>>;
    templates: Array<{ type: string; label: string; description: string; defaultPayload: Record<string, any> }>;
    items: Array<{ id: string; name: string; costCoins: number }>;
  } | null>(null);
  const [dropsLoading, setDropsLoading] = useState(false);
  const [dropsBusy, setDropsBusy] = useState(false);
  const [dropForm, setDropForm] = useState({
    type: "coin_rain",
    title: "",
    description: "",
    startsInMin: 15,
    durationH: 3,
    coinsPerClaim: 250,
    poolTotal: 25000,
    multiplier: 2,
    targetMinutes: 120,
    rewardCoins: 1000,
    rewardXp: 500,
    itemId: "",
    discountPct: 50,
    emailBlast: false,
  });

  // Economy dashboard state
  const [economyState, setEconomyState] = useState<{
    supply: { total: number; humans: number; bots: number; wallets: number };
    last7: { mints: number; burns: number; net: number };
    inflationPct: number;
    inflationAlert: boolean;
    daily: Array<{ day: string; mints: number; burns: number }>;
    topReasons: Array<{ reason: string; type: string; total: string; n: number }>;
    marketplace: Record<string, { n: number; total: number }>;
  } | null>(null);
  const [economyLoading, setEconomyLoading] = useState(false);

  // Site settings state (maintenance mode, announcement, branding)
  const [siteSettings, setSiteSettings] = useState<{
    maintenanceMode: boolean;
    maintenanceMessage: string;
    announcementEnabled: boolean;
    announcementTitle: string;
    announcementText: string;
    announcementEmoji: string;
    brandingName: string;
    brandingTagline: string;
    heroTitle: string;
    heroSubtitle: string;
    heroCtaText: string;
  } | null>(null);
  const [siteSettingsSaving, setSiteSettingsSaving] = useState(false);
  const [siteSettingsResult, setSiteSettingsResult] = useState<string | null>(null);

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

  // Lazy load CMS data when tab is visited
  useEffect(() => {
    if (tab === "marketplace" && marketplaceItems.length === 0) loadMarketplace();
    if (tab === "lootboxes" && lootboxTypes.length === 0) loadLootboxes();
    if (tab === "quests" && quests.length === 0) loadQuests();
    if (tab === "battlepass" && !bpStats.stats) loadBattlePass();
    if (tab === "pets" && petStats.stats.length === 0) loadPets();
    if (tab === "overview" && !cmsOverview.users) loadCmsOverview();
    if (tab === "email") { loadEmailLogs(); loadEmailTemplates(); }
    if (tab === "premium" && premiumUsers.length === 0) loadPremiumUsers();
    if (tab === "moderation") loadModerationQueue();
    if (tab === "site") loadSiteSettings();
    if (tab === "rivals" && !botsState) void loadBots();
    if (tab === "drops" && !dropsState) void loadDrops();
    if (tab === "economy" && !economyState) void loadEconomy();
  }, [tab]);

  useEffect(() => {
    if (tab !== "moderation" || moderationPosts.length === 0) return;
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      const first = moderationPosts[0];
      if (!first || moderationActionId) return;
      if (event.key.toLowerCase() === "a") {
        event.preventDefault();
        void moderatePost(first.id, "approve");
      }
      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        void moderatePost(first.id, "reject");
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [moderationActionId, moderationPosts, tab]);

  async function loadMarketplace() {
    setMarketplaceLoading(true);
    try {
      const r = await fetch("/api/admin/cms/marketplace", { headers: authHeaders(), credentials: "include" });
      if (r.ok) { const d = await r.json(); setMarketplaceItems(d.items ?? []); }
    } finally { setMarketplaceLoading(false); }
  }

  async function loadLootboxes() {
    setLootboxLoading(true);
    try {
      const r = await fetch("/api/admin/cms/lootboxes", { headers: authHeaders(), credentials: "include" });
      if (r.ok) { const d = await r.json(); setLootboxTypes(d.types ?? []); }
    } finally { setLootboxLoading(false); }
  }

  async function loadQuests() {
    setQuestsLoading(true);
    try {
      const r = await fetch("/api/admin/cms/quests", { headers: authHeaders(), credentials: "include" });
      if (r.ok) { const d = await r.json(); setQuests(d.quests ?? []); }
    } finally { setQuestsLoading(false); }
  }

  async function loadBattlePass() {
    try {
      const r = await fetch("/api/admin/cms/battle-pass", { headers: authHeaders(), credentials: "include" });
      if (r.ok) setBpStats(await r.json());
    } catch { }
  }

  async function loadPets() {
    try {
      const r = await fetch("/api/admin/cms/pets", { headers: authHeaders(), credentials: "include" });
      if (r.ok) setPetStats(await r.json());
    } catch { }
  }

  async function loadCmsOverview() {
    try {
      const r = await fetch("/api/admin/cms/overview", { headers: authHeaders(), credentials: "include" });
      if (r.ok) setCmsOverview(await r.json());
    } catch { }
  }

  async function loadEmailLogs() {
    setEmailLogsLoading(true);
    try {
      const r = await fetch("/api/admin/email/logs", { headers: authHeaders(), credentials: "include" });
      if (r.ok) { const d = await r.json(); setEmailLogs(d.logs ?? []); }
    } finally { setEmailLogsLoading(false); }
  }

  async function loadEmailTemplates() {
    try {
      const r = await fetch("/api/admin/email/templates", { headers: authHeaders(), credentials: "include" });
      if (r.ok) { const d = await r.json(); setEmailTemplates(d.templates ?? []); }
    } catch { }
  }

  async function sendEmailBlast() {
    setEmailBlasting(true); setEmailResult(null); setEmailError(null);
    try {
      const r = await fetch("/api/admin/email/blast", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify({
          template: emailTemplate,
          audience: emailAudience,
          customSubject: emailCustomSubject || undefined,
          customHtml: emailCustomHtml || undefined,
        }),
      });
      const d = await r.json();
      if (r.ok) { setEmailResult(d); loadEmailLogs(); }
      else setEmailError(d.error ?? "Failed to send");
    } catch (e: any) { setEmailError(e.message); }
    finally { setEmailBlasting(false); }
  }

  async function loadPremiumUsers() {
    setPremiumLoading(true);
    try {
      const r = await fetch("/api/admin/users", { headers: authHeaders(), credentials: "include" });
      if (r.ok) {
        const d = await r.json();
        setPremiumUsers((d.users ?? []).filter((u: any) => u.role !== "guest"));
      }
    } finally { setPremiumLoading(false); }
  }

  async function adminGrantPremium() {
    if (!premiumGrantId) return;
    setPremiumGranting(true); setPremiumGrantResult(null);
    try {
      const r = await fetch("/api/admin/users/" + premiumGrantId + "/premium", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify({ days: 30 }),
      });
      if (r.ok) { setPremiumGrantResult("Premium granted for 30 days!"); loadPremiumUsers(); }
      else { const d = await r.json(); setPremiumGrantResult("Error: " + (d.error ?? "Unknown")); }
    } catch (e: any) { setPremiumGrantResult("Error: " + e.message); }
    finally { setPremiumGranting(false); }
  }

  async function loadModerationQueue() {
    setModerationLoading(true);
    try {
      const r = await fetch("/api/admin/moderation/queue", { headers: authHeaders(), credentials: "include" });
      if (r.ok) {
        const d = await r.json();
        setModerationPosts(d.posts ?? []);
        setModerationCount(d.flaggedCount ?? 0);
      }
    } finally { setModerationLoading(false); }
  }

  async function loadSiteSettings() {
    try {
      const r = await fetch("/api/admin/site/settings", { headers: authHeaders(), credentials: "include" });
      if (r.ok) {
        const d = await r.json();
        setSiteSettings({
          maintenanceMode: d.maintenanceMode ?? false,
          maintenanceMessage: d.maintenanceMessage ?? "We're making FocusArx even better. Check back in a few minutes.",
          announcementEnabled: d.announcementEnabled ?? false,
          announcementTitle: d.announcementTitle ?? "",
          announcementText: d.announcementText ?? "",
          announcementEmoji: d.announcementEmoji ?? "",
          brandingName: d.brandingName ?? "FocusArx",
          brandingTagline: d.brandingTagline ?? "",
          heroTitle: d.heroTitle ?? "",
          heroSubtitle: d.heroSubtitle ?? "",
          heroCtaText: d.heroCtaText ?? "",
        });
      }
    } catch { /* ignore */ }
  }

  async function saveSiteSettings() {
    if (!siteSettings) return;
    setSiteSettingsSaving(true);
    setSiteSettingsResult(null);
    try {
      const r = await fetch("/api/admin/site/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify({
          maintenanceMode: siteSettings.maintenanceMode,
          maintenanceMessage: siteSettings.maintenanceMessage,
          announcementEnabled: siteSettings.announcementEnabled,
          announcementTitle: siteSettings.announcementTitle || null,
          announcementText: siteSettings.announcementText || null,
          announcementEmoji: siteSettings.announcementEmoji || null,
          brandingName: siteSettings.brandingName,
          brandingTagline: siteSettings.brandingTagline || null,
          heroTitle: siteSettings.heroTitle || null,
          heroSubtitle: siteSettings.heroSubtitle || null,
          heroCtaText: siteSettings.heroCtaText || null,
        }),
      });
      if (r.ok) setSiteSettingsResult("Settings saved! Changes are live site-wide.");
      else { const d = await r.json().catch(() => ({})); setSiteSettingsResult("Error: " + (d.error ?? "Failed to save")); }
    } catch (e: any) { setSiteSettingsResult("Error: " + e.message); }
    finally { setSiteSettingsSaving(false); }
  }

  async function sendModerationDigest() {
    setDigestSending(true);
    setDigestResult(null);
    try {
      const r = await fetch("/api/admin/moderation/digest", { method: "POST", headers: authHeaders(), credentials: "include" });
      const d = await r.json();
      if (r.ok) setDigestResult(d.sent ? `Digest emailed with ${d.flaggedCount} flagged post(s).` : (d.reason ?? "Nothing to send."));
      else setDigestResult("Error: " + (d.error ?? "Failed"));
    } catch (e: any) { setDigestResult("Error: " + e.message); }
    finally { setDigestSending(false); }
  }

  function toggleUserSelect(id: string) {
    setSelectedUsers((prev) => {
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
      const r = await fetch("/api/admin/cms/grant-coins/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify({ userIds: ids, amount: Number(amt), reason: "Bulk grant" }),
      });
      const d = await r.json();
      setBulkResult(r.ok ? `Granted ${amt} coins to ${d.granted}/${d.attempted} users.` : ("Error: " + (d.error ?? "Failed")));
      if (r.ok) { clearSelection(); loadData(); }
    } catch (e: any) { setBulkResult("Error: " + e.message); }
    finally { setBulkLoading(false); }
  }

  async function bulkDeleteUsers() {
    const ids = [...selectedUsers];
    if (!confirm(`Delete ${ids.length} selected user(s)? This cannot be undone.`)) return;
    setBulkLoading(true);
    setBulkResult(null);
    try {
      const r = await fetch("/api/admin/users/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify({ userIds: ids }),
      });
      const d = await r.json();
      setBulkResult(r.ok ? `Deleted ${d.deleted}/${d.attempted} users (admins skipped).` : ("Error: " + (d.error ?? "Failed")));
      if (r.ok) { clearSelection(); loadData(); }
    } catch (e: any) { setBulkResult("Error: " + e.message); }
    finally { setBulkLoading(false); }
  }

  async function moderatePost(postId: string, action: "approve" | "reject") {
    setModerationActionId(postId);
    try {
      const r = await fetch(`/api/admin/moderation/${postId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify({ reason: "Removed by admin" }),
      });
      if (r.ok) {
        // Optimistically remove from queue.
        setModerationPosts((prev) => prev.filter((p) => p.id !== postId));
        setModerationCount((c) => Math.max(0, c - 1));
      }
    } finally { setModerationActionId(null); }
  }

  async function loadBots() {
    setBotsLoading(true);
    try {
      const r = await fetch("/api/admin/bots", { headers: authHeaders(), credentials: "include" });
      if (r.ok) setBotsState(await r.json());
    } finally { setBotsLoading(false); }
  }

  async function seedRivals(target: number) {
    setBotsBusy(true);
    try {
      const r = await fetch("/api/admin/bots/seed", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ target }),
      });
      const d = await r.json();
      alert(r.ok
        ? `AI rivals ready — ${d.created} created, ${d.total} total (${Math.round((d.ms ?? 0) / 100) / 10}s).`
        : (d.error ?? "Failed"));
      await loadBots();
      await loadData();
    } finally { setBotsBusy(false); }
  }

  async function removeRivals() {
    if (!confirm("Remove ALL AI rival accounts and their content?")) return;
    setBotsBusy(true);
    try {
      const r = await fetch("/api/admin/bots", { method: "DELETE", headers: authHeaders(), credentials: "include" });
      const d = await r.json();
      alert(r.ok ? `Removed ${d.deleted} AI rivals.` : (d.error ?? "Failed"));
      await loadBots();
      await loadData();
    } finally { setBotsBusy(false); }
  }

  // ── Admin Drops ─────────────────────────────────────────────────────────────
  async function loadDrops() {
    setDropsLoading(true);
    try {
      const r = await fetch("/api/admin/drops", { headers: authHeaders(), credentials: "include" });
      if (r.ok) setDropsState(await r.json());
    } finally { setDropsLoading(false); }
  }

  function dropPayloadFor(form: typeof dropForm): Record<string, any> {
    switch (form.type) {
      case "coin_rain": return { coinsPerClaim: form.coinsPerClaim, poolTotal: form.poolTotal };
      case "streak_freeze": return { tokensPerClaim: 1, poolTotal: form.poolTotal };
      case "double_xp": return { multiplier: form.multiplier };
      case "board_shakeup": return { multiplier: form.multiplier, scope: "weekly" };
      case "flash_quest": return { targetMinutes: form.targetMinutes, rewardCoins: form.rewardCoins, rewardXp: form.rewardXp };
      case "item_flash_sale": return { itemId: form.itemId, discountPct: form.discountPct };
      default: return {};
    }
  }

  async function createDropNow() {
    if (!dropForm.title.trim()) { alert("Give the drop a title."); return; }
    if (dropForm.type === "item_flash_sale" && !dropForm.itemId) { alert("Pick an item for the flash sale."); return; }
    setDropsBusy(true);
    try {
      const start = new Date(Date.now() + dropForm.startsInMin * 60 * 1000);
      const end = new Date(start.getTime() + dropForm.durationH * 3600 * 1000);
      const r = await fetch("/api/admin/drops", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type: dropForm.type,
          title: dropForm.title.trim(),
          description: dropForm.description.trim() || undefined,
          payload: dropPayloadFor(dropForm),
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          emailBlast: dropForm.emailBlast,
        }),
      });
      const d = await r.json();
      alert(r.ok
        ? `Drop live — announced to ${d.fannedOut} members${d.emailBlast === "queued" ? " + email blast queued" : ""}.`
        : (d.error ?? "Failed"));
      await loadDrops();
    } finally { setDropsBusy(false); }
  }

  async function dropAction(id: string, action: "end" | "cancel" | "duplicate") {
    setDropsBusy(true);
    try {
      const r = await fetch(`/api/admin/drops/${id}/${action}`, {
        method: "POST",
        headers: authHeaders(),
        credentials: "include",
      });
      const d = await r.json();
      if (!r.ok) alert(d.error ?? "Failed");
      await loadDrops();
    } finally { setDropsBusy(false); }
  }

  async function loadEconomy() {
    setEconomyLoading(true);
    try {
      const r = await fetch("/api/admin/economy", { headers: authHeaders(), credentials: "include" });
      if (r.ok) setEconomyState(await r.json());
    } finally { setEconomyLoading(false); }
  }

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
        setData(prev => prev ? {
          ...prev, users: prev.users.map(u => u.id === user.id ? { ...u, role: newRole } : u),
        } : prev);
      }
    } finally { setRoleLoading(null); }
  };

  const deleteUser = async (id: string) => {
    setDeleteLoading(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "DELETE", headers: authHeaders(), credentials: "include",
      });
      if (res.ok) {
        setData(prev => prev ? { ...prev, users: prev.users.filter(u => u.id !== id) } : prev);
        setStats(prev => prev ? { ...prev, totalUsers: prev.totalUsers - 1 } : prev);
      }
    } finally { setDeleteLoading(null); setDeleteConfirm(null); }
  };

  const purgeAllGuests = async () => {
    const guestCount = stats?.guestCount ?? data?.guestCount ?? 0;
    if (guestCount === 0) return;
    if (!window.confirm(`Delete all ${guestCount} guest account(s)?`)) return;
    setPurgeLoading(true);
    try {
      const res = await fetch("/api/admin/users/guests", {
        method: "DELETE", headers: authHeaders(), credentials: "include",
      });
      if (res.ok) await loadData();
    } finally { setPurgeLoading(false); }
  };

  // Marketplace CRUD
  const saveMarketplaceItem = async (isNew: boolean) => {
    const url = isNew ? "/api/admin/cms/marketplace" : `/api/admin/cms/marketplace/${marketplaceForm.id}`;
    const method = isNew ? "POST" : "PATCH";
    try {
      const r = await fetch(url, {
        method, headers: { ...authHeaders(), "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify(marketplaceForm),
      });
      if (r.ok) {
        const d = await r.json();
        if (isNew) setMarketplaceItems(prev => [...prev, d.item]);
        else setMarketplaceItems(prev => prev.map(i => i.id === d.item.id ? d.item : i));
        setMarketplaceEditId(null); setMarketplaceAddMode(false); setMarketplaceForm({});
      }
    } catch { }
  };

  const deleteMarketplaceItem = async (itemId: string) => {
    if (!window.confirm("Delete this item?")) return;
    const r = await fetch(`/api/admin/cms/marketplace/${itemId}`, {
      method: "DELETE", headers: authHeaders(), credentials: "include",
    });
    if (r.ok) setMarketplaceItems(prev => prev.filter(i => i.id !== itemId));
  };

  // Quest CRUD
  const saveQuest = async (isNew: boolean) => {
    const url = isNew ? "/api/admin/cms/quests" : `/api/admin/cms/quests/${questForm.id}`;
    const method = isNew ? "POST" : "PATCH";
    try {
      const r = await fetch(url, {
        method, headers: { ...authHeaders(), "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify(questForm),
      });
      if (r.ok) {
        const d = await r.json();
        if (isNew) setQuests(prev => [...prev, d.quest]);
        else setQuests(prev => prev.map(q => q.id === d.quest.id ? d.quest : q));
        setQuestEditId(null); setQuestAddMode(false); setQuestForm({});
      }
    } catch { }
  };

  const deactivateQuest = async (questId: string) => {
    if (!window.confirm("Deactivate this quest?")) return;
    const r = await fetch(`/api/admin/cms/quests/${questId}`, {
      method: "DELETE", headers: authHeaders(), credentials: "include",
    });
    if (r.ok) setQuests(prev => prev.map(q => q.id === questId ? { ...q, isActive: false } : q));
  };

  // Lootbox edit
  const saveLootbox = async (typeId: string) => {
    const r = await fetch(`/api/admin/cms/lootboxes/${typeId}`, {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(lootboxForm),
    });
    if (r.ok) {
      const d = await r.json();
      setLootboxTypes(prev => prev.map(t => t.id === typeId ? { ...t, ...d.type } : t));
      setLootboxEditId(null); setLootboxForm({});
    }
  };

  // Notify all
  const sendNotification = async () => {
    if (!notifyTitle || !notifyMessage) return;
    setNotifySending(true); setNotifyResult(null); setNotifyError(null);
    try {
      const r = await fetch("/api/admin/cms/notify-all", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: notifyTitle, message: notifyMessage, type: notifyType }),
      });
      const d = await r.json();
      if (r.ok) { setNotifyResult(d); setNotifyTitle(""); setNotifyMessage(""); }
      else setNotifyError(d.error ?? "Failed");
    } finally { setNotifySending(false); }
  };

  // Coin grant
  const sendCoinGrant = async () => {
    if (!grantUserId || !grantAmount) return;
    setGrantLoading(true); setGrantResult(null); setGrantError(null);
    try {
      const r = await fetch("/api/admin/cms/grant-coins", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId: grantUserId, amount: Number(grantAmount), reason: grantReason }),
      });
      const d = await r.json();
      if (r.ok) { setGrantResult(d); setGrantUserId(""); setGrantAmount(""); setGrantReason(""); }
      else setGrantError(d.error ?? "Failed");
    } finally { setGrantLoading(false); }
  };

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
  const users = userSearch.trim()
    ? allUsers.filter(u =>
        (u.name ?? "").toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearch.toLowerCase()))
    : allUsers;
  const botCount = data?.botCount ?? 0;
  const maxSessions = Math.max(1, ...(stats?.dailyChart.map(d => d.sessions) ?? [1]));

  function maskEmail(email: string) {
    const [local, domain] = email.split("@");
    if (!local || !domain) return email;
    if (email.endsWith("@guest.focusarx.internal")) return "guest";
    return local.slice(0, 2) + "***@" + domain;
  }

  // ─── Render Tabs ─────────────────────────────────────────────────────────────

  function renderOverview() {
    return (
      <MotionTab>
        <SectionHeader title="Platform Overview" sub="Real-time snapshot of platform health and user activity." />

        {/* Platform KPIs */}
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Registered users" value={String(stats?.totalUsers ?? users.length)} />
          <StatCard label="New this week" value={String(stats?.newUsersThisWeek ?? 0)} accent="sky" />
          <StatCard label="Active sessions" value={String(stats?.activeSessions ?? data?.activeCount ?? 0)} accent="rose" />
          <StatCard label="Total focus hrs" value={String(stats?.totalFocusHours ?? 0)} accent="violet" />
          <StatCard label="Total sessions" value={String(stats?.totalSessions ?? 0)} />
          <StatCard label="Guest accounts" value={String(stats?.guestCount ?? data?.guestCount ?? 0)} accent="amber" />
        </div>

        {/* CMS Overview (lazy loaded) */}
        {cmsOverview.wallets && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total coins in circulation" value={Number(cmsOverview.wallets.totalCoins).toLocaleString()} accent="amber" />
            <StatCard label="Total XP earned" value={Number(cmsOverview.wallets.totalXp).toLocaleString()} accent="violet" />
            <StatCard label="Avg coins / user" value={Math.round(cmsOverview.wallets.avgCoins).toLocaleString()} />
            <StatCard label="Marketplace items" value={`${cmsOverview.marketplace?.activeItems ?? 0} active`} accent="sky" />
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-5">
          {/* Activity chart */}
          <div className="lg:col-span-3 rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/40 p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--palette-zinc-500)]">Platform activity — last 7 days</p>
            <div className="mt-4 flex items-end gap-1.5 h-32">
              {(stats?.dailyChart ?? Array.from({ length: 7 }, (_, i) => ({
                day: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][i] ?? "?", date: "", sessions: 0, minutes: 0,
              }))).map((d, index) => (
                <div key={`${d.date || d.day}-${index}`} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-md bg-[var(--palette-rose-500)]/70 hover:bg-[var(--palette-rose-400)]/90 transition-all"
                    style={{ height: `${Math.round((d.sessions / maxSessions) * 100)}%`, minHeight: d.sessions > 0 ? "4px" : "2px" }}
                    title={`${d.sessions} sessions · ${d.minutes}m`}
                  />
                  <span className="text-[10px] text-[var(--palette-zinc-600)]">{d.day}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top users */}
          <div className="lg:col-span-2 rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/40 p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--palette-zinc-500)]">Top focusers</p>
            <div className="mt-3 space-y-2.5">
              {(stats?.topUsers ?? []).length === 0 && <p className="text-sm text-[var(--palette-zinc-600)]">No sessions yet.</p>}
              {(stats?.topUsers ?? []).map((u, i) => (
                <div key={u.id} className="flex items-center gap-3">
                  <span className={`w-5 shrink-0 text-center text-xs font-bold ${i === 0 ? "text-[var(--palette-amber-400)]" : i === 1 ? "text-[var(--palette-zinc-300)]" : i === 2 ? "text-[var(--palette-orange-600)]" : "text-[var(--palette-zinc-600)]"}`}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-[var(--palette-zinc-200)]">{u.name || maskEmail(u.email)}</p>
                    <p className="text-xs text-[var(--palette-zinc-500)]">{u.minutes}m focused</p>
                  </div>
                  <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-[var(--palette-zinc-800)]">
                    <div className="h-full rounded-full bg-[var(--palette-violet-500)]/70"
                      style={{ width: `${Math.round((u.minutes / Math.max(1, stats?.topUsers[0]?.minutes ?? 1)) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent signups */}
        <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/40 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--palette-zinc-500)] mb-3">Recent signups</p>
          <div className="divide-y divide-[var(--palette-zinc-800)]/60">
            {users.slice(0, 5).map(u => (
              <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <span className="text-sm text-[var(--palette-zinc-200)]">{u.name ?? "Unnamed"}</span>
                  <span className="ml-2 text-xs text-[var(--palette-zinc-500)]">{maskEmail(u.email)}</span>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs text-[var(--palette-zinc-500)]">
                  <span>{u.sessionCount} sessions</span>
                  <span>{u.streak} 🔥</span>
                  <span>{new Date(u.createdAt).toLocaleDateString()}</span>
                  {u.role === "admin" && <span className="rounded-full bg-[var(--palette-violet-950)] px-2 py-0.5 text-[var(--palette-violet-300)]">Admin</span>}
                </div>
              </div>
            ))}
          </div>
          {users.length > 5 && (
            <button onClick={() => setTab("users")} className="mt-3 text-xs text-[var(--palette-zinc-500)] hover:text-[var(--palette-zinc-300)] transition">
              View all {users.length} users →
            </button>
          )}
        </div>
      </MotionTab>
    );
  }

  function renderUsers() {
    return (
      <MotionTab>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <SectionHeader title="User Management" sub={`${users.length} registered accounts`} />
          <div className="flex items-center gap-2">
            {(stats?.guestCount ?? data?.guestCount ?? 0) > 0 && (
              <button
                onClick={() => void purgeAllGuests()} disabled={purgeLoading}
                className="rounded-lg border border-[var(--palette-amber-900)]/60 bg-[var(--palette-amber-950)]/40 px-3 py-1.5 text-xs font-medium text-[var(--palette-amber-300)] hover:bg-[var(--palette-amber-950)]/70 disabled:opacity-50"
              >
                {purgeLoading ? "Purging…" : `Purge ${stats?.guestCount ?? data?.guestCount} guest(s)`}
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Registered users" value={String(allUsers.length - botCount)} />
          <StatCard label="Active sessions" value={String(data?.activeCount ?? 0)} accent="rose" />
          <StatCard label={botCount > 0 ? "AI rivals" : "Guest accounts"}
            value={String(botCount > 0 ? botCount : (data?.guestCount ?? stats?.guestCount ?? 0))} accent="amber" />
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
                    <p className="mt-0.5 font-mono text-[10px] text-[var(--palette-zinc-600)]">{user.id.slice(0, 8)}…</p>
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
                  <td className="px-4 py-3 text-[var(--palette-zinc-300)]">{user.sessionCount}</td>
                  <td className="px-4 py-3 text-[var(--palette-zinc-300)]">{user.streak} 🔥</td>
                  <td className="px-4 py-3 text-xs text-[var(--palette-zinc-500)] whitespace-nowrap">{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setManagingUserId(user.id)}
                        className="rounded-lg border border-[var(--palette-violet-800)] px-2.5 py-1 text-xs font-semibold text-[var(--palette-violet-300)] hover:bg-[var(--palette-violet-950)] transition"
                      >
                        <Settings2 size={11} className="inline mr-1" />Manage
                      </button>
                      {!user.isGuest && user.role !== "bot" && (
                        <button
                          onClick={() => void toggleRole(user)}
                          disabled={roleLoading === user.id}
                          className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition disabled:opacity-40 ${user.role === "admin" ? "border-[var(--palette-rose-800)] text-[var(--palette-rose-400)] hover:bg-[var(--palette-rose-950)]" : "border-[var(--palette-violet-800)] text-[var(--palette-violet-400)] hover:bg-[var(--palette-violet-950)]"}`}
                        >
                          {roleLoading === user.id ? "…" : user.role === "admin" ? "Demote" : "Make Admin"}
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteConfirm(user.id)}
                        className="rounded-lg border border-[var(--palette-zinc-800)] px-2.5 py-1 text-xs text-[var(--palette-zinc-500)] hover:border-[var(--palette-red-900)] hover:text-[var(--palette-red-400)] transition"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => { setGrantUserId(user.id); setTab("coins"); }}
                        className="rounded-lg border border-[var(--palette-zinc-800)] px-2.5 py-1 text-xs text-[var(--palette-zinc-500)] hover:border-[var(--palette-amber-900)] hover:text-[var(--palette-amber-400)] transition"
                        title="Grant coins"
                      >
                        🪙
                      </button>
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

  function renderMissions() {
    return (
      <MotionTab>
        <SectionHeader title="Mission Analytics" sub="Track completion rates and engagement across all mission types." />
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Total completions" value={String(missionData?.totalCompletions ?? 0)} accent="violet" />
          <StatCard label="Rewards claimed" value={String(missionData?.totalClaims ?? 0)} accent="sky" />
          <StatCard label="Mission types" value={String(missionData?.missions?.length ?? 0)} />
        </div>

        <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/40 overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--palette-zinc-800)] flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--palette-zinc-500)]">Mission Performance</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--palette-zinc-900)]/80 text-xs uppercase tracking-wider text-[var(--palette-zinc-500)]">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Mission</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Difficulty</th>
                  <th className="px-4 py-2.5 font-medium">Completions</th>
                  <th className="px-4 py-2.5 font-medium">Claims</th>
                  <th className="px-4 py-2.5 font-medium">Rate</th>
                  <th className="px-4 py-2.5 font-medium">Rewards</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--palette-zinc-800)]/50">
                {(missionData?.missions ?? []).map((m: any) => (
                  <tr key={m.key} className="hover:bg-[var(--palette-zinc-900)]/30 transition">
                    <td className="px-4 py-2.5">
                      <span className="mr-1.5">{m.icon}</span>
                      <span className="text-[var(--palette-zinc-200)] text-xs font-medium">{m.title}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge label={m.type} color={m.type === "daily" ? "bg-[var(--palette-blue-950)] text-[var(--palette-blue-400)]" : "bg-[var(--palette-purple-950)] text-[var(--palette-purple-400)]"} />
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-medium ${m.difficulty === "epic" ? "text-[var(--palette-purple-400)]" : m.difficulty === "hard" ? "text-[var(--palette-red-400)]" : m.difficulty === "medium" ? "text-[var(--palette-amber-400)]" : "text-[var(--palette-emerald-400)]"}`}>{m.difficulty}</span>
                    </td>
                    <td className="px-4 py-2.5 text-[var(--palette-zinc-300)] text-xs">{m.completions}</td>
                    <td className="px-4 py-2.5 text-[var(--palette-zinc-300)] text-xs">{m.claims}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-[var(--palette-zinc-800)] overflow-hidden">
                          <div className="h-full rounded-full bg-[var(--palette-violet-500)]/70" style={{ width: `${m.completionRate}%` }} />
                        </div>
                        <span className="text-[10px] text-[var(--palette-zinc-500)]">{m.completionRate}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-[10px] text-[var(--palette-violet-400)]">+{m.xpReward}xp</span>
                      <span className="text-[10px] text-[var(--palette-zinc-600)] mx-1">·</span>
                      <span className="text-[10px] text-[var(--palette-amber-400)]">{m.coinReward}🪙</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </MotionTab>
    );
  }

  function renderRetention() {
    return (
      <MotionTab>
        <SectionHeader title="Retention Analytics" sub="Login rewards, streak freeze usage, and battle pass engagement." />
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--palette-zinc-500)] mb-3">Daily Login Rewards</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Total claims" value={String(retentionData?.loginRewards?.totalClaims ?? 0)} accent="sky" />
            <StatCard label="Avg claim streak" value={`${retentionData?.loginRewards?.avgStreak ?? 0}d`} accent="violet" />
            <StatCard label="Users with claims" value={String(retentionData?.loginRewards?.usersWithClaims ?? 0)} />
          </div>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--palette-zinc-500)] mb-3">Streak Freeze Tokens</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Tokens issued" value={String(retentionData?.streakFreeze?.totalTokensGiven ?? 0)} />
            <StatCard label="Tokens used" value={String(retentionData?.streakFreeze?.totalTokensUsed ?? 0)} accent="rose" />
            <StatCard label="Users with tokens" value={String(retentionData?.streakFreeze?.usersWithTokens ?? 0)} accent="sky" />
          </div>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--palette-zinc-500)] mb-3">Battle Pass — Season 1</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Users enrolled" value={String(retentionData?.battlePass?.totalUsers ?? 0)} />
            <StatCard label="Avg tier" value={`Tier ${retentionData?.battlePass?.avgTier ?? 0}`} accent="violet" />
            <StatCard label="Avg season XP" value={String(retentionData?.battlePass?.avgSeasonXp ?? 0)} accent="sky" />
            <StatCard label="Premium unlocked" value={String(retentionData?.battlePass?.premiumCount ?? 0)} accent="rose" />
          </div>
          {(retentionData?.battlePass?.tierDistribution?.length ?? 0) > 0 && (
            <div className="mt-4 rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/40 p-5">
              <p className="text-xs text-[var(--palette-zinc-500)] mb-3">Tier distribution</p>
              <div className="flex items-end gap-1 h-20">
                {retentionData.battlePass.tierDistribution.map((d: any) => {
                  const maxC = Math.max(1, ...retentionData.battlePass.tierDistribution.map((x: any) => x.count));
                  return (
                    <div key={d.tier} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t bg-[var(--palette-violet-500)]/60 hover:bg-[var(--palette-violet-400)]/80 transition-colors"
                        style={{ height: `${Math.round((d.count / maxC) * 100)}%`, minHeight: "2px" }}
                        title={`Tier ${d.tier}: ${d.count} users`}
                      />
                      {d.tier % 10 === 0 && <span className="text-[9px] text-[var(--palette-zinc-600)]">{d.tier}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--palette-zinc-500)] mb-3">Notifications</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard label="Total sent" value={String(retentionData?.notifications?.total ?? 0)} />
            <StatCard label="Unread" value={String(retentionData?.notifications?.unread ?? 0)} accent="rose" />
          </div>
        </div>
      </MotionTab>
    );
  }

  function renderMarketplace() {
    const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];
    const TYPES = ["frame", "avatar", "effect", "accessory", "decoration", "booster"];
    return (
      <MotionTab>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <SectionHeader title="Marketplace CMS" sub="Manage all purchasable cosmetic items and boosters." />
          <div className="flex items-center gap-2">
            <button onClick={loadMarketplace} className="rounded-lg border border-[var(--palette-zinc-700)] px-3 py-1.5 text-xs text-[var(--palette-zinc-400)] hover:text-[var(--palette-zinc-200)] transition">
              <RefreshCw size={12} className="inline mr-1" />Refresh
            </button>
            <button
              onClick={() => { setMarketplaceAddMode(true); setMarketplaceForm({ isActive: true, rarity: "common", type: "frame" }); setMarketplaceEditId(null); }}
              className="rounded-lg bg-[var(--palette-violet-700)] hover:bg-[var(--palette-violet-600)] px-3 py-1.5 text-xs text-[var(--palette-white)] font-medium flex items-center gap-1"
            >
              <Plus size={12} /> Add Item
            </button>
          </div>
        </div>

        {/* Add form */}
        {marketplaceAddMode && (
          <div className="rounded-xl border border-[var(--palette-violet-800)]/50 bg-[var(--palette-violet-950)]/20 p-5 space-y-3">
            <p className="text-xs font-semibold text-[var(--palette-violet-300)] uppercase tracking-wider">New Item</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <input className="admin-input" placeholder="Item ID (unique)" value={marketplaceForm.id ?? ""} onChange={e => setMarketplaceForm(p => ({ ...p, id: e.target.value }))} />
              <input className="admin-input" placeholder="Name" value={marketplaceForm.name ?? ""} onChange={e => setMarketplaceForm(p => ({ ...p, name: e.target.value }))} />
              <input className="admin-input" placeholder="Emoji" value={marketplaceForm.emoji ?? ""} onChange={e => setMarketplaceForm(p => ({ ...p, emoji: e.target.value }))} />
              <input className="admin-input" placeholder="Description" value={marketplaceForm.description ?? ""} onChange={e => setMarketplaceForm(p => ({ ...p, description: e.target.value }))} />
              <input className="admin-input" placeholder="Cost (coins)" type="number" value={marketplaceForm.costCoins ?? ""} onChange={e => setMarketplaceForm(p => ({ ...p, costCoins: Number(e.target.value) }))} />
              <select className="admin-input" value={marketplaceForm.type ?? "frame"} onChange={e => setMarketplaceForm(p => ({ ...p, type: e.target.value }))}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select className="admin-input" value={marketplaceForm.rarity ?? "common"} onChange={e => setMarketplaceForm(p => ({ ...p, rarity: e.target.value }))}>
                {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => saveMarketplaceItem(true)} className="rounded-lg bg-[var(--palette-violet-700)] hover:bg-[var(--palette-violet-600)] px-3 py-1.5 text-xs text-[var(--palette-white)] font-medium flex items-center gap-1">
                <Save size={12} /> Save
              </button>
              <button onClick={() => { setMarketplaceAddMode(false); setMarketplaceForm({}); }} className="rounded-lg border border-[var(--palette-zinc-700)] px-3 py-1.5 text-xs text-[var(--palette-zinc-400)] hover:text-[var(--palette-zinc-200)]">
                <X size={12} className="inline mr-1" />Cancel
              </button>
            </div>
          </div>
        )}

        {marketplaceLoading
          ? <div className="text-center py-8 text-[var(--palette-zinc-500)] text-sm">Loading…</div>
          : (
            <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-[40rem] w-full text-left text-xs">
                  <thead className="bg-[var(--palette-zinc-900)]/80 text-[var(--palette-zinc-500)] uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 font-medium">Item</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Rarity</th>
                      <th className="px-4 py-3 font-medium">Cost</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--palette-zinc-800)]/50">
                    {marketplaceItems.map(item => (
                      marketplaceEditId === item.id ? (
                        <tr key={item.id} className="bg-[var(--palette-violet-950)]/20">
                          <td colSpan={6} className="px-4 py-3">
                            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                              <input className="admin-input" placeholder="Name" value={marketplaceForm.name ?? item.name} onChange={e => setMarketplaceForm(p => ({ ...p, name: e.target.value }))} />
                              <input className="admin-input" placeholder="Emoji" value={marketplaceForm.emoji ?? item.emoji} onChange={e => setMarketplaceForm(p => ({ ...p, emoji: e.target.value }))} />
                              <input className="admin-input" placeholder="Cost" type="number" value={marketplaceForm.costCoins ?? item.costCoins} onChange={e => setMarketplaceForm(p => ({ ...p, costCoins: Number(e.target.value) }))} />
                              <select className="admin-input" value={marketplaceForm.rarity ?? item.rarity} onChange={e => setMarketplaceForm(p => ({ ...p, rarity: e.target.value }))}>
                                {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                              <input className="admin-input sm:col-span-2" placeholder="Description" value={marketplaceForm.description ?? item.description} onChange={e => setMarketplaceForm(p => ({ ...p, description: e.target.value }))} />
                              <label className="flex items-center gap-2 text-[var(--palette-zinc-400)]">
                                <input type="checkbox" checked={marketplaceForm.isActive ?? item.isActive} onChange={e => setMarketplaceForm(p => ({ ...p, isActive: e.target.checked }))} />
                                Active
                              </label>
                            </div>
                            <div className="flex gap-2 mt-2">
                              <button onClick={() => saveMarketplaceItem(false)} className="rounded-lg bg-[var(--palette-violet-700)] px-3 py-1 text-xs text-[var(--palette-white)] flex items-center gap-1"><Save size={10} /> Save</button>
                              <button onClick={() => { setMarketplaceEditId(null); setMarketplaceForm({}); }} className="rounded-lg border border-[var(--palette-zinc-700)] px-3 py-1 text-xs text-[var(--palette-zinc-400)]"><X size={10} className="inline" /></button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={item.id} className="hover:bg-[var(--palette-zinc-900)]/30 transition">
                          <td className="px-4 py-3">
                            <span className="mr-1.5">{item.emoji}</span>
                            <span className="text-[var(--palette-zinc-200)] font-medium">{item.name}</span>
                            <p className="text-[10px] text-[var(--palette-zinc-600)] font-mono">{item.id}</p>
                          </td>
                          <td className="px-4 py-3 text-[var(--palette-zinc-400)]">{item.type}</td>
                          <td className="px-4 py-3">
                            <Badge label={item.rarity} color={
                              item.rarity === "legendary" ? "bg-[var(--palette-amber-950)] text-[var(--palette-amber-400)]"
                              : item.rarity === "epic" ? "bg-[var(--palette-purple-950)] text-[var(--palette-purple-400)]"
                              : item.rarity === "rare" ? "bg-[var(--palette-blue-950)] text-[var(--palette-blue-400)]"
                              : item.rarity === "uncommon" ? "bg-[var(--palette-emerald-950)] text-[var(--palette-emerald-400)]"
                              : "bg-[var(--palette-zinc-800)] text-[var(--palette-zinc-400)]"
                            } />
                          </td>
                          <td className="px-4 py-3 text-[var(--palette-amber-400)]">{item.costCoins.toLocaleString()} 🪙</td>
                          <td className="px-4 py-3">
                            <Badge label={item.isActive ? "Active" : "Inactive"} color={item.isActive ? "bg-[var(--palette-emerald-950)] text-[var(--palette-emerald-400)]" : "bg-[var(--palette-zinc-800)] text-[var(--palette-zinc-500)]"} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button onClick={() => { setMarketplaceEditId(item.id); setMarketplaceForm({}); }} className="rounded p-1 text-[var(--palette-zinc-500)] hover:text-[var(--palette-violet-400)] transition"><Pencil size={12} /></button>
                              <button onClick={() => void deleteMarketplaceItem(item.id)} className="rounded p-1 text-[var(--palette-zinc-500)] hover:text-[var(--palette-red-400)] transition"><Trash2 size={12} /></button>
                            </div>
                          </td>
                        </tr>
                      )
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
      </MotionTab>
    );
  }

  function renderPets() {
    const PET_TYPES = [
      { id: "owl", emoji: "🦉", name: "Sage Owl" },
      { id: "fox", emoji: "🦊", name: "Focus Fox" },
      { id: "dragon", emoji: "🐲", name: "Study Dragon" },
      { id: "robot", emoji: "🤖", name: "Study Bot" },
      { id: "cat", emoji: "🐱", name: "Neko Scholar" },
      { id: "phoenix", emoji: "🦅", name: "Rising Phoenix" },
    ];
    return (
      <MotionTab>
        <SectionHeader title="Pet CMS" sub="Overview of all pet companions across the platform." />
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Total pets" value={String(petStats.totalPets)} accent="violet" />
          <StatCard label="Pet types" value={String(PET_TYPES.length)} />
          <StatCard label="Most popular" value={petStats.stats[0]?.petType ?? "N/A"} accent="amber" />
        </div>

        <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/40 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--palette-zinc-500)] mb-4">Pet Type Distribution</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PET_TYPES.map(pt => {
              const s = petStats.stats.find(x => x.petType === pt.id);
              return (
                <div key={pt.id} className="flex items-center gap-3 rounded-lg border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/40 px-4 py-3">
                  <span className="text-2xl">{pt.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--palette-zinc-200)]">{pt.name}</p>
                    <p className="text-xs text-[var(--palette-zinc-500)]">{s?.count ?? 0} adopted · avg level {s?.avgLevel ?? 0}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-[var(--palette-violet-400)]">{s?.count ?? 0}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/20 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--palette-zinc-500)] mb-3">Evolution System</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-xs text-[var(--palette-zinc-400)]">
            {[
              { stage: 0, name: "Newborn", level: "Lv 1–9", color: "text-[var(--palette-zinc-400)]" },
              { stage: 1, name: "Growing", level: "Lv 10–19", color: "text-[var(--palette-emerald-400)]" },
              { stage: 2, name: "Evolved", level: "Lv 20–29", color: "text-[var(--palette-blue-400)]" },
              { stage: 3, name: "Legendary", level: "Lv 30+", color: "text-[var(--palette-amber-400)]" },
            ].map(e => (
              <div key={e.stage} className="rounded-lg border border-[var(--palette-zinc-800)] px-3 py-2">
                <p className={`font-semibold ${e.color}`}>Stage {e.stage + 1}: {e.name}</p>
                <p className="text-[var(--palette-zinc-600)]">{e.level}</p>
                <p className="text-[var(--palette-zinc-600)]">500 XP per level</p>
              </div>
            ))}
          </div>
        </div>
      </MotionTab>
    );
  }

  function renderLootboxes() {
    return (
      <MotionTab>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <SectionHeader title="Loot Box CMS" sub="Edit box types, costs, and availability." />
          <div className="flex gap-2 flex-wrap">
            <button onClick={async () => {
              const r = await fetch("/api/admin/cms/seed/lootboxes", { method: "POST", headers: authHeaders(), credentials: "include" });
              const d = await r.json();
              alert(`Seeded ${d.seeded ?? 0} new boxes (${d.total ?? 0} total)`);
              loadLootboxes();
            }} className="rounded-lg bg-[var(--palette-emerald-800)] hover:bg-[var(--palette-emerald-700)] px-3 py-1.5 text-xs text-[var(--palette-white)] font-medium flex items-center gap-1">
              <Plus size={12} /> Seed 50 Boxes
            </button>
            <button onClick={loadLootboxes} className="rounded-lg border border-[var(--palette-zinc-700)] px-3 py-1.5 text-xs text-[var(--palette-zinc-400)] hover:text-[var(--palette-zinc-200)] transition">
              <RefreshCw size={12} className="inline mr-1" />Refresh
            </button>
          </div>
        </div>

        {lootboxLoading
          ? <div className="text-center py-8 text-[var(--palette-zinc-500)]">Loading…</div>
          : (
            <div className="space-y-3">
              {lootboxTypes.map(lb => (
                lootboxEditId === lb.id ? (
                  <div key={lb.id} className="rounded-xl border border-[var(--palette-violet-800)]/50 bg-[var(--palette-violet-950)]/20 p-5 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <input className="admin-input" placeholder="Name" value={lootboxForm.name ?? lb.name} onChange={e => setLootboxForm(p => ({ ...p, name: e.target.value }))} />
                      <input className="admin-input" placeholder="Icon emoji" value={lootboxForm.icon ?? lb.icon} onChange={e => setLootboxForm(p => ({ ...p, icon: e.target.value }))} />
                      <input className="admin-input" placeholder="Coin Cost" type="number" value={lootboxForm.coinCost ?? lb.coinCost} onChange={e => setLootboxForm(p => ({ ...p, coinCost: Number(e.target.value) }))} />
                      <input className="admin-input sm:col-span-2" placeholder="Description" value={lootboxForm.description ?? lb.description} onChange={e => setLootboxForm(p => ({ ...p, description: e.target.value }))} />
                      <input className="admin-input" placeholder="Glow color (#hex)" value={lootboxForm.glowColor ?? lb.glowColor} onChange={e => setLootboxForm(p => ({ ...p, glowColor: e.target.value }))} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => void saveLootbox(lb.id)} className="rounded-lg bg-[var(--palette-violet-700)] px-3 py-1.5 text-xs text-[var(--palette-white)] flex items-center gap-1"><Save size={10} /> Save</button>
                      <button onClick={() => { setLootboxEditId(null); setLootboxForm({}); }} className="rounded-lg border border-[var(--palette-zinc-700)] px-3 py-1.5 text-xs text-[var(--palette-zinc-400)]"><X size={10} className="inline mr-1" />Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div key={lb.id} className="flex items-center gap-4 rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/40 px-5 py-4">
                    <span className="text-3xl">{lb.icon ?? "📦"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--palette-zinc-200)]">{lb.name}</p>
                      <p className="text-xs text-[var(--palette-zinc-500)]">{lb.description}</p>
                      <p className="text-xs text-[var(--palette-zinc-600)] mt-1">{lb.possibleRewards?.length ?? 0} possible rewards</p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-bold text-[var(--palette-amber-400)]">{lb.coinCost.toLocaleString()} 🪙</p>
                        <Badge label={lb.rarity ?? "common"} color="bg-[var(--palette-violet-950)] text-[var(--palette-violet-400)]" />
                      </div>
                      <button onClick={() => { setLootboxEditId(lb.id); setLootboxForm({}); }} className="rounded-lg border border-[var(--palette-zinc-700)] px-2.5 py-1.5 text-xs text-[var(--palette-zinc-400)] hover:text-[var(--palette-violet-400)] flex items-center gap-1 transition">
                        <Pencil size={11} /> Edit
                      </button>
                    </div>
                  </div>
                )
              ))}
              {lootboxTypes.length === 0 && (
                <div className="text-center py-8 text-[var(--palette-zinc-500)] text-sm">No loot box types found. Run DB seeder to add defaults.</div>
              )}
            </div>
          )}
      </MotionTab>
    );
  }

  function renderBattlePass() {
    const s = bpStats.stats;
    return (
      <MotionTab>
        <SectionHeader title="Battle Pass Admin" sub="Season progress tracking and tier analytics." />
        {s ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard label="Enrolled users" value={String(s.totalUsers)} />
              <StatCard label="Avg tier" value={`Tier ${s.avgTier}`} accent="violet" />
              <StatCard label="Avg season XP" value={String(Math.round(s.avgXp))} accent="sky" />
              <StatCard label="Premium unlocked" value={String(s.premiumCount)} accent="amber" />
              <StatCard label="Highest tier" value={`Tier ${s.maxTier}`} accent="rose" />
            </div>

            {bpStats.tierDistribution.length > 0 && (
              <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/40 p-5">
                <p className="text-xs text-[var(--palette-zinc-500)] mb-4">Tier Distribution</p>
                <div className="flex items-end gap-1 h-32">
                  {bpStats.tierDistribution.map(d => {
                    const maxC = Math.max(1, ...bpStats.tierDistribution.map(x => x.count));
                    return (
                      <div key={d.tier} className="flex flex-1 flex-col items-center gap-1">
                        <div className="w-full rounded-t bg-[var(--palette-violet-500)]/60 hover:bg-[var(--palette-violet-400)]/80 transition-colors"
                          style={{ height: `${Math.round((d.count / maxC) * 100)}%`, minHeight: "2px" }}
                          title={`Tier ${d.tier}: ${d.count} users`}
                        />
                        {d.tier % 10 === 0 && <span className="text-[9px] text-[var(--palette-zinc-600)]">{d.tier}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-[var(--palette-zinc-500)] text-sm">Loading battle pass data…</div>
        )}

        <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/20 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--palette-zinc-500)] mb-3">Season Configuration</p>
          <div className="grid gap-2 sm:grid-cols-3 text-xs text-[var(--palette-zinc-400)]">
            <div className="rounded-lg border border-[var(--palette-zinc-800)] px-4 py-3">
              <p className="text-[var(--palette-zinc-500)] text-[10px] uppercase tracking-wider">Season</p>
              <p className="text-[var(--palette-zinc-100)] font-semibold mt-1">Season 1</p>
            </div>
            <div className="rounded-lg border border-[var(--palette-zinc-800)] px-4 py-3">
              <p className="text-[var(--palette-zinc-500)] text-[10px] uppercase tracking-wider">XP per Tier</p>
              <p className="text-[var(--palette-violet-400)] font-semibold mt-1">1,000 XP</p>
            </div>
            <div className="rounded-lg border border-[var(--palette-zinc-800)] px-4 py-3">
              <p className="text-[var(--palette-zinc-500)] text-[10px] uppercase tracking-wider">Max Tiers</p>
              <p className="text-[var(--palette-amber-400)] font-semibold mt-1">50 Tiers</p>
            </div>
          </div>
        </div>
      </MotionTab>
    );
  }

  function renderQuests() {
    const TYPES = ["daily", "weekly"];
    const REQ_TYPES = ["focus_minutes", "session_count", "streak_days", "coins_earned", "xp_earned"];
    return (
      <MotionTab>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <SectionHeader title="Quest Builder" sub="Create and manage daily and weekly quests for users." />
          <div className="flex items-center gap-2">
            <button onClick={loadQuests} className="rounded-lg border border-[var(--palette-zinc-700)] px-3 py-1.5 text-xs text-[var(--palette-zinc-400)] hover:text-[var(--palette-zinc-200)] transition">
              <RefreshCw size={12} className="inline mr-1" />Refresh
            </button>
            <button
              onClick={() => { setQuestAddMode(true); setQuestForm({ type: "daily", metric: "focus_minutes", isActive: true }); setQuestEditId(null); }}
              className="rounded-lg bg-[var(--palette-violet-700)] hover:bg-[var(--palette-violet-600)] px-3 py-1.5 text-xs text-[var(--palette-white)] font-medium flex items-center gap-1"
            >
              <Plus size={12} /> New Quest
            </button>
          </div>
        </div>

        {questAddMode && (
          <div className="rounded-xl border border-[var(--palette-violet-800)]/50 bg-[var(--palette-violet-950)]/20 p-5 space-y-3">
            <p className="text-xs font-semibold text-[var(--palette-violet-300)] uppercase tracking-wider">New Quest</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <input className="admin-input" placeholder="Title" value={questForm.title ?? ""} onChange={e => setQuestForm(p => ({ ...p, title: e.target.value }))} />
              <input className="admin-input" placeholder="Icon (emoji)" value={questForm.icon ?? ""} onChange={e => setQuestForm(p => ({ ...p, icon: e.target.value }))} />
              <select className="admin-input" value={questForm.type ?? "daily"} onChange={e => setQuestForm(p => ({ ...p, type: e.target.value }))}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select className="admin-input" value={questForm.metric ?? "focus_minutes"} onChange={e => setQuestForm(p => ({ ...p, metric: e.target.value }))}>
                {REQ_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <input className="admin-input" placeholder="Target Value" type="number" value={questForm.target ?? ""} onChange={e => setQuestForm(p => ({ ...p, target: Number(e.target.value) }))} />
              <input className="admin-input" placeholder="XP Reward" type="number" value={questForm.xpReward ?? ""} onChange={e => setQuestForm(p => ({ ...p, xpReward: Number(e.target.value) }))} />
              <input className="admin-input" placeholder="Coin Reward" type="number" value={questForm.coinReward ?? ""} onChange={e => setQuestForm(p => ({ ...p, coinReward: Number(e.target.value) }))} />
              <input className="admin-input lg:col-span-2" placeholder="Description" value={questForm.description ?? ""} onChange={e => setQuestForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => void saveQuest(true)} className="rounded-lg bg-[var(--palette-violet-700)] px-3 py-1.5 text-xs text-[var(--palette-white)] font-medium flex items-center gap-1"><Save size={12} /> Save Quest</button>
              <button onClick={() => { setQuestAddMode(false); setQuestForm({}); }} className="rounded-lg border border-[var(--palette-zinc-700)] px-3 py-1.5 text-xs text-[var(--palette-zinc-400)]"><X size={12} className="inline mr-1" />Cancel</button>
            </div>
          </div>
        )}

        {questsLoading
          ? <div className="text-center py-8 text-[var(--palette-zinc-500)]">Loading…</div>
          : (
            <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-[40rem] w-full text-left text-xs">
                  <thead className="bg-[var(--palette-zinc-900)]/80 text-[var(--palette-zinc-500)] uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 font-medium">Quest</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Requirement</th>
                      <th className="px-4 py-3 font-medium">Rewards</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--palette-zinc-800)]/50">
                    {quests.map(q => (
                      questEditId === q.id ? (
                        <tr key={q.id} className="bg-[var(--palette-violet-950)]/20">
                          <td colSpan={6} className="px-4 py-3">
                            <div className="grid gap-2 sm:grid-cols-3">
                              <input className="admin-input" placeholder="Title" value={questForm.title ?? q.title} onChange={e => setQuestForm(p => ({ ...p, title: e.target.value }))} />
                              <input className="admin-input" placeholder="Icon (emoji)" value={questForm.icon ?? q.icon} onChange={e => setQuestForm(p => ({ ...p, icon: e.target.value }))} />
                              <input className="admin-input" placeholder="Target Value" type="number" value={questForm.target ?? q.target} onChange={e => setQuestForm(p => ({ ...p, target: Number(e.target.value) }))} />
                              <input className="admin-input" placeholder="XP Reward" type="number" value={questForm.xpReward ?? q.xpReward} onChange={e => setQuestForm(p => ({ ...p, xpReward: Number(e.target.value) }))} />
                              <input className="admin-input" placeholder="Coin Reward" type="number" value={questForm.coinReward ?? q.coinReward} onChange={e => setQuestForm(p => ({ ...p, coinReward: Number(e.target.value) }))} />
                              <label className="flex items-center gap-2 text-[var(--palette-zinc-400)]">
                                <input type="checkbox" checked={questForm.isActive ?? q.isActive} onChange={e => setQuestForm(p => ({ ...p, isActive: e.target.checked }))} />
                                Active
                              </label>
                            </div>
                            <div className="flex gap-2 mt-2">
                              <button onClick={() => void saveQuest(false)} className="rounded-lg bg-[var(--palette-violet-700)] px-3 py-1 text-xs text-[var(--palette-white)] flex items-center gap-1"><Save size={10} /> Save</button>
                              <button onClick={() => { setQuestEditId(null); setQuestForm({}); }} className="rounded-lg border border-[var(--palette-zinc-700)] px-3 py-1 text-xs text-[var(--palette-zinc-400)]"><X size={10} className="inline" /></button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={q.id} className="hover:bg-[var(--palette-zinc-900)]/30 transition">
                          <td className="px-4 py-3">
                            <span className="mr-1.5">{q.icon}</span>
                            <span className="text-[var(--palette-zinc-200)] font-medium">{q.title}</span>
                            {q.description && <p className="text-[var(--palette-zinc-600)] text-[10px] mt-0.5">{q.description}</p>}
                          </td>
                          <td className="px-4 py-3">
                            <Badge label={q.type} color={q.type === "daily" ? "bg-[var(--palette-blue-950)] text-[var(--palette-blue-400)]" : "bg-[var(--palette-purple-950)] text-[var(--palette-purple-400)]"} />
                          </td>
                          <td className="px-4 py-3 text-[var(--palette-zinc-400)]">{q.metric}: <span className="text-[var(--palette-zinc-200)]">{q.target}</span></td>
                          <td className="px-4 py-3">
                            <span className="text-[var(--palette-violet-400)]">+{q.xpReward}xp</span>
                            <span className="text-[var(--palette-zinc-600)] mx-1">·</span>
                            <span className="text-[var(--palette-amber-400)]">{q.coinReward}🪙</span>
                          </td>
                          <td className="px-4 py-3">
                            <Badge label={q.isActive ? "Active" : "Inactive"} color={q.isActive ? "bg-[var(--palette-emerald-950)] text-[var(--palette-emerald-400)]" : "bg-[var(--palette-zinc-800)] text-[var(--palette-zinc-500)]"} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button onClick={() => { setQuestEditId(q.id); setQuestForm({}); }} className="rounded p-1 text-[var(--palette-zinc-500)] hover:text-[var(--palette-violet-400)]"><Pencil size={12} /></button>
                              {q.isActive && <button onClick={() => void deactivateQuest(q.id)} className="rounded p-1 text-[var(--palette-zinc-500)] hover:text-[var(--palette-red-400)]"><Trash2 size={12} /></button>}
                            </div>
                          </td>
                        </tr>
                      )
                    ))}
                  </tbody>
                </table>
              </div>
              {quests.length === 0 && (
                <div className="text-center py-6 text-[var(--palette-zinc-500)] text-sm space-y-3">
                  <p>No quests found.</p>
                  <button onClick={async () => {
                    const r = await fetch("/api/admin/cms/seed/quests", { method: "POST", headers: authHeaders(), credentials: "include" });
                    const d = await r.json();
                    alert(`Seeded ${d.seeded ?? 0} new quests (${d.total ?? 0} total)`);
                    loadQuests();
                  }} className="rounded-lg bg-[var(--palette-violet-700)] hover:bg-[var(--palette-violet-600)] px-4 py-2 text-xs text-[var(--palette-white)] font-medium inline-flex items-center gap-1">
                    <Plus size={12} /> Seed Default Quests
                  </button>
                </div>
              )}
            </div>
          )}
      </MotionTab>
    );
  }

  function renderCity() {
    return (
      <MotionTab>
        <SectionHeader title="Focus City CMS" sub="Building types and experience-based unlock configuration." />
        <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/20 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--palette-zinc-500)] mb-4">Building Configuration</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { id: "town_hall", name: "Town Hall", emoji: "🏛️", desc: "Central building — unlocked at start", unlock: 0, color: "text-[var(--palette-amber-400)]" },
              { id: "library", name: "Library", emoji: "📚", desc: "Unlocked at 1,000 XP", unlock: 1000, color: "text-[var(--palette-sky-400)]" },
              { id: "coffee_shop", name: "Coffee Shop", emoji: "☕", desc: "Unlocked at 2,500 XP", unlock: 2500, color: "text-[var(--palette-orange-400)]" },
              { id: "lab", name: "Research Lab", emoji: "🔬", desc: "Unlocked at 5,000 XP", unlock: 5000, color: "text-[var(--palette-violet-400)]" },
              { id: "stadium", name: "Focus Stadium", emoji: "🏟️", desc: "Unlocked at 10,000 XP", unlock: 10000, color: "text-[var(--palette-rose-400)]" },
              { id: "observatory", name: "Observatory", emoji: "🔭", desc: "Unlocked at 25,000 XP", unlock: 25000, color: "text-[var(--palette-emerald-400)]" },
            ].map(b => (
              <div key={b.id} className="rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/40 px-4 py-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{b.emoji}</span>
                  <div>
                    <p className="text-sm font-medium text-[var(--palette-zinc-200)]">{b.name}</p>
                    <p className={`text-xs font-semibold ${b.color}`}>
                      {b.unlock === 0 ? "Free" : `${b.unlock.toLocaleString()} XP`}
                    </p>
                  </div>
                </div>
                <p className="text-[10px] text-[var(--palette-zinc-500)]">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/20 p-4">
          <p className="text-xs text-[var(--palette-zinc-500)]">💡 City building configs are stored in code (<code className="font-mono text-[var(--palette-violet-400)]">routes/city.ts</code>). Modify unlock thresholds and add new buildings by editing the server config.</p>
        </div>
      </MotionTab>
    );
  }

  function renderNotify() {
    return (
      <MotionTab>
        <SectionHeader title="Notification Blast" sub="Send a platform-wide notification to all registered users." />

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/40 p-5 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--palette-zinc-400)]">Compose Message</p>

            <div>
              <label className="block text-xs text-[var(--palette-zinc-500)] mb-1">Notification Type</label>
              <select className="admin-input" value={notifyType} onChange={e => setNotifyType(e.target.value)}>
                <option value="system">System</option>
                <option value="announcement">Announcement</option>
                <option value="reward">Reward</option>
                <option value="mission">Mission</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-[var(--palette-zinc-500)] mb-1">Title</label>
              <input className="admin-input" placeholder="e.g. New Feature Alert!" value={notifyTitle} onChange={e => setNotifyTitle(e.target.value)} />
            </div>

            <div>
              <label className="block text-xs text-[var(--palette-zinc-500)] mb-1">Message</label>
              <textarea
                className="admin-input resize-none"
                rows={4}
                placeholder="Your message to all users…"
                value={notifyMessage}
                onChange={e => setNotifyMessage(e.target.value)}
              />
            </div>

            <button
              onClick={() => void sendNotification()}
              disabled={notifySending || !notifyTitle || !notifyMessage}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-[var(--palette-violet-700)] hover:bg-[var(--palette-violet-600)] px-4 py-2.5 text-sm font-medium text-[var(--palette-white)] disabled:opacity-50 transition"
            >
              {notifySending ? <><RefreshCw size={14} className="animate-spin" /> Sending…</> : <><Send size={14} /> Send to All Users</>}
            </button>

            {notifyResult && (
              <div className="flex items-center gap-2 rounded-lg border border-[var(--palette-emerald-800)]/50 bg-[var(--palette-emerald-950)]/30 px-4 py-3 text-[var(--palette-emerald-400)] text-sm">
                <CheckCircle size={14} />
                Sent to {notifyResult.sent} users successfully!
              </div>
            )}
            {notifyError && (
              <div className="flex items-center gap-2 rounded-lg border border-[var(--palette-red-800)]/50 bg-[var(--palette-red-950)]/30 px-4 py-3 text-[var(--palette-red-400)] text-sm">
                <AlertTriangle size={14} />
                {notifyError}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/40 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--palette-zinc-400)] mb-3">Quick Templates</p>
              <div className="space-y-2">
                {[
                  { title: "Welcome Back!", message: "We've been working hard on new features. Check out what's new in FocusArx!", type: "announcement" },
                  { title: "🎁 Special Reward", message: "As a thank you for being part of FocusArx, you've received a bonus today. Keep up the great work!", type: "reward" },
                  { title: "⚡ Weekly Challenge", message: "This week's challenge is live! Complete 5 focus sessions today and earn bonus XP.", type: "mission" },
                  { title: "🔧 Maintenance Notice", message: "We'll be performing maintenance tonight. The app will be back up within 30 minutes.", type: "system" },
                ].map(t => (
                  <button
                    key={t.title}
                    onClick={() => { setNotifyTitle(t.title); setNotifyMessage(t.message); setNotifyType(t.type); }}
                    className="w-full text-left rounded-lg border border-[var(--palette-zinc-800)] px-3 py-2.5 hover:border-[var(--palette-zinc-600)] hover:bg-[var(--palette-zinc-800)]/50 transition"
                  >
                    <p className="text-xs font-medium text-[var(--palette-zinc-300)]">{t.title}</p>
                    <p className="text-[10px] text-[var(--palette-zinc-500)] mt-0.5 line-clamp-1">{t.message}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[var(--palette-amber-800)]/30 bg-[var(--palette-amber-950)]/10 p-4">
              <div className="flex items-start gap-2 text-[var(--palette-amber-400)]">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold">Important</p>
                  <p className="text-[10px] text-[var(--palette-amber-500)] mt-1 leading-relaxed">
                    This sends an in-app notification to all registered users. Use sparingly. Guests do not receive notifications.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </MotionTab>
    );
  }

  function renderCoins() {
    return (
      <MotionTab>
        <SectionHeader title="Coin Grants" sub="Manually grant coins to specific users." />

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/40 p-5 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--palette-zinc-400)]">Grant Coins</p>

            <div>
              <label className="block text-xs text-[var(--palette-zinc-500)] mb-1">User ID</label>
              <input
                className="admin-input font-mono"
                placeholder="paste user UUID here…"
                value={grantUserId}
                onChange={e => setGrantUserId(e.target.value)}
              />
              <p className="text-[10px] text-[var(--palette-zinc-600)] mt-1">Find user IDs in the Users tab (grey monospace under each name)</p>
            </div>

            <div>
              <label className="block text-xs text-[var(--palette-zinc-500)] mb-1">Amount (coins)</label>
              <input className="admin-input" type="number" min="1" placeholder="500" value={grantAmount} onChange={e => setGrantAmount(e.target.value)} />
            </div>

            <div>
              <label className="block text-xs text-[var(--palette-zinc-500)] mb-1">Reason (optional)</label>
              <input className="admin-input" placeholder="e.g. Bug compensation, contest winner" value={grantReason} onChange={e => setGrantReason(e.target.value)} />
            </div>

            <button
              onClick={() => void sendCoinGrant()}
              disabled={grantLoading || !grantUserId || !grantAmount}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-[var(--palette-amber-700)] hover:bg-[var(--palette-amber-600)] px-4 py-2.5 text-sm font-medium text-[var(--palette-white)] disabled:opacity-50 transition"
            >
              {grantLoading ? <><RefreshCw size={14} className="animate-spin" /> Granting…</> : <>🪙 Grant Coins</>}
            </button>

            {grantResult && (
              <div className="flex items-center gap-2 rounded-lg border border-[var(--palette-emerald-800)]/50 bg-[var(--palette-emerald-950)]/30 px-4 py-3 text-[var(--palette-emerald-400)] text-sm">
                <CheckCircle size={14} />
                Coins granted! New balance: {grantResult.newBalance.toLocaleString()} 🪙
              </div>
            )}
            {grantError && (
              <div className="flex items-center gap-2 rounded-lg border border-[var(--palette-red-800)]/50 bg-[var(--palette-red-950)]/30 px-4 py-3 text-[var(--palette-red-400)] text-sm">
                <AlertTriangle size={14} />
                {grantError}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/40 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--palette-zinc-400)] mb-3">Quick Users</p>
              <p className="text-xs text-[var(--palette-zinc-500)] mb-3">Click a user to auto-fill their ID</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {users.map(u => (
                  <button
                    key={u.id}
                    onClick={() => setGrantUserId(u.id)}
                    className={`w-full text-left rounded-lg border px-3 py-2 transition ${grantUserId === u.id ? "border-[var(--palette-amber-700)]/50 bg-[var(--palette-amber-950)]/20" : "border-[var(--palette-zinc-800)] hover:border-[var(--palette-zinc-600)] hover:bg-[var(--palette-zinc-800)]/40"}`}
                  >
                    <p className="text-xs font-medium text-[var(--palette-zinc-300)]">{u.name ?? "Unnamed"}</p>
                    <p className="text-[10px] text-[var(--palette-zinc-500)] font-mono">{u.id.slice(0, 16)}…</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </MotionTab>
    );
  }

  function renderSql() {
    return (
      <MotionTab>
        <SectionHeader
          title="SQL Console"
          sub="Read-only by default (SELECT / SHOW / EXPLAIN / WITH). Write mode unlocks for 15 minutes with the typed phrase; destructive statements need a second confirmation. Every statement is recorded in the insert-only admin_sql_log audit table. Set ENABLE_ADMIN_SQL=false to hard-disable it."
        />
        <SqlConsolePanel authHeaders={authHeaders} />
      </MotionTab>
    );
  }

  function renderEmail() {
    const TEMPLATES = emailTemplates.length > 0 ? emailTemplates : [
      { key: "welcome", subject: "Welcome to FocusArx 🎯" },
      { key: "come_back", subject: "We miss you! Come back and focus 🔥" },
      { key: "streak_reminder", subject: "Don't break your streak! 🔥" },
      { key: "new_feature", subject: "New Features Available ✨" },
      { key: "weekly_report", subject: "Your Weekly Focus Report 📊" },
      { key: "monthly_wrapped", subject: "Your Monthly Focus Wrapped 🎁" },
      { key: "premium_promo", subject: "Unlock Premium 👑" },
    ];
    return (
      <MotionTab>
        <SectionHeader title="Email System" sub="Send email blasts to your users. Requires RESEND_API_KEY env var — without it, sends are logged but not delivered." />

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Blast form */}
          <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/40 p-5 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--palette-zinc-400)]">Send Email Blast</p>

            <div>
              <label className="block text-xs text-[var(--palette-zinc-500)] mb-1">Template</label>
              <select className="admin-input" value={emailTemplate} onChange={e => setEmailTemplate(e.target.value)}>
                {TEMPLATES.map(t => <option key={t.key} value={t.key}>{t.key} — {t.subject}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs text-[var(--palette-zinc-500)] mb-1">Audience</label>
              <select className="admin-input" value={emailAudience} onChange={e => setEmailAudience(e.target.value as any)}>
                <option value="all">All registered users</option>
                <option value="inactive">Inactive users (7+ days)</option>
                <option value="premium">Premium users only</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-[var(--palette-zinc-500)] mb-1">Custom Subject (optional — overrides template)</label>
              <input className="admin-input" placeholder="Leave blank to use template subject" value={emailCustomSubject} onChange={e => setEmailCustomSubject(e.target.value)} />
            </div>

            <div>
              <label className="block text-xs text-[var(--palette-zinc-500)] mb-1">Custom HTML Body (optional)</label>
              <textarea
                className="admin-input resize-none font-mono text-xs"
                rows={4}
                placeholder="<h1>Hello!</h1><p>Your message here…</p>"
                value={emailCustomHtml}
                onChange={e => setEmailCustomHtml(e.target.value)}
              />
            </div>

            <button
              onClick={() => void sendEmailBlast()}
              disabled={emailBlasting}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-[var(--palette-sky-700)] hover:bg-[var(--palette-sky-600)] px-4 py-2.5 text-sm font-medium text-[var(--palette-white)] disabled:opacity-50 transition"
            >
              {emailBlasting ? <><RefreshCw size={14} className="animate-spin" /> Sending…</> : <><Send size={14} /> Send Email Blast</>}
            </button>

            {emailResult && (
              <div className="flex items-center gap-2 rounded-lg border border-[var(--palette-emerald-800)]/50 bg-[var(--palette-emerald-950)]/30 px-4 py-3 text-[var(--palette-emerald-400)] text-sm">
                <CheckCircle size={14} />
                Sent to {emailResult.sent}/{emailResult.total} users — {emailResult.failed} failed
              </div>
            )}
            {emailError && (
              <div className="flex items-center gap-2 rounded-lg border border-[var(--palette-red-800)]/50 bg-[var(--palette-red-950)]/30 px-4 py-3 text-[var(--palette-red-400)] text-sm">
                <AlertTriangle size={14} />
                {emailError}
              </div>
            )}

            <div className="rounded-xl border border-[var(--palette-amber-800)]/30 bg-[var(--palette-amber-950)]/10 p-4">
              <div className="flex items-start gap-2 text-[var(--palette-amber-400)]">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <p className="text-[10px] text-[var(--palette-amber-500)] leading-relaxed">
                  Emails require <code className="bg-[var(--palette-amber-950)] px-1 rounded">RESEND_API_KEY</code> to actually deliver. Without it, sends are logged as "sent" but emails are not dispatched. Max 500 recipients per blast.
                </p>
              </div>
            </div>
          </div>

          {/* Email logs */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--palette-zinc-400)]">Recent Logs</p>
              <button onClick={() => loadEmailLogs()} className="text-[10px] text-[var(--palette-zinc-500)] hover:text-[var(--palette-zinc-300)] flex items-center gap-1">
                <RefreshCw size={10} /> Refresh
              </button>
            </div>
            {emailLogsLoading ? (
              <div className="text-center py-8 text-[var(--palette-zinc-500)] text-sm">Loading…</div>
            ) : emailLogs.length === 0 ? (
              <div className="rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/20 p-4 text-center text-xs text-[var(--palette-zinc-500)]">No emails sent yet.</div>
            ) : (
              <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 max-h-[500px] overflow-auto">
                <table className="min-w-[40rem] w-full text-left text-xs">
                  <thead className="bg-[var(--palette-zinc-900)]/80 text-[var(--palette-zinc-500)] uppercase tracking-wider sticky top-0">
                    <tr>
                      <th className="px-3 py-2 font-medium">Recipient</th>
                      <th className="px-3 py-2 font-medium">Template</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Sent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--palette-zinc-800)]/50">
                    {emailLogs.map((log: any) => (
                      <tr key={log.id} className="hover:bg-[var(--palette-zinc-900)]/30">
                        <td className="px-3 py-2 text-[var(--palette-zinc-300)] truncate max-w-[160px]">{log.recipientEmail}</td>
                        <td className="px-3 py-2 text-[var(--palette-zinc-500)]">{log.template}</td>
                        <td className="px-3 py-2">
                          <Badge
                            label={log.status}
                            color={log.status === "sent" ? "bg-[var(--palette-emerald-950)] text-[var(--palette-emerald-400)]" : log.status === "failed" ? "bg-[var(--palette-red-950)] text-[var(--palette-red-400)]" : "bg-[var(--palette-zinc-800)] text-[var(--palette-zinc-400)]"}
                          />
                        </td>
                        <td className="px-3 py-2 text-[var(--palette-zinc-600)] text-[10px]">
                          {log.sentAt ? new Date(log.sentAt).toLocaleDateString() : "—"}
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

  function renderPremiumManagement() {
    const premiumCount = premiumUsers.filter((u: any) => {
      const sub = u.premiumUntil;
      return sub && new Date(sub) > new Date();
    }).length;
    return (
      <MotionTab>
        <SectionHeader title="Premium Management" sub="View all users and manually grant premium access. Premium is purchased with 9,000 in-app coins." />

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/40 p-5 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--palette-zinc-400)]">Grant Premium (Admin Override)</p>
            <div>
              <label className="block text-xs text-[var(--palette-zinc-500)] mb-1">User ID</label>
              <input
                className="admin-input font-mono"
                placeholder="paste user UUID…"
                value={premiumGrantId}
                onChange={e => setPremiumGrantId(e.target.value)}
              />
              <p className="text-[10px] text-[var(--palette-zinc-600)] mt-1">Grants 30 days of premium without deducting coins. Find user IDs in the Users tab.</p>
            </div>
            <button
              onClick={() => void adminGrantPremium()}
              disabled={premiumGranting || !premiumGrantId}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-[var(--palette-amber-600)] hover:bg-[var(--palette-amber-500)] px-4 py-2.5 text-sm font-medium text-[var(--palette-white)] disabled:opacity-50 transition"
            >
              {premiumGranting ? <><RefreshCw size={14} className="animate-spin" /> Granting…</> : <>👑 Grant 30-day Premium</>}
            </button>
            {premiumGrantResult && (
              <div className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${premiumGrantResult.startsWith("Error") ? "border-[var(--palette-red-800)]/50 bg-[var(--palette-red-950)]/30 text-[var(--palette-red-400)]" : "border-[var(--palette-emerald-800)]/50 bg-[var(--palette-emerald-950)]/30 text-[var(--palette-emerald-400)]"}`}>
                {premiumGrantResult.startsWith("Error") ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}
                {premiumGrantResult}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="rounded-xl border border-[var(--palette-amber-800)]/30 bg-[var(--palette-amber-950)]/10 px-4 py-3 text-center">
                <p className="text-xl font-bold text-[var(--palette-amber-400)]">{premiumCount}</p>
                <p className="text-[10px] text-[var(--palette-zinc-500)] mt-0.5">Active premium users</p>
              </div>
              <div className="rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/20 px-4 py-3 text-center">
                <p className="text-xl font-bold text-[var(--palette-zinc-200)]">{premiumUsers.length}</p>
                <p className="text-[10px] text-[var(--palette-zinc-500)] mt-0.5">Registered users total</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--palette-zinc-400)]">User List</p>
              <button onClick={() => void loadPremiumUsers()} className="text-[10px] text-[var(--palette-zinc-500)] hover:text-[var(--palette-zinc-300)] flex items-center gap-1"><RefreshCw size={10} /> Refresh</button>
            </div>
            {premiumLoading ? (
              <div className="text-center py-8 text-[var(--palette-zinc-500)]">Loading…</div>
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
                    {premiumUsers.slice(0, 50).map((u: any) => (
                      <tr key={u.id} className="hover:bg-[var(--palette-zinc-900)]/30">
                        <td className="px-3 py-2">
                          <p className="text-[var(--palette-zinc-200)] font-medium truncate max-w-[140px]">{u.name || u.email?.split("@")[0]}</p>
                          <p className="text-[var(--palette-zinc-600)] text-[10px] font-mono truncate">{u.id.slice(0, 8)}…</p>
                        </td>
                        <td className="px-3 py-2">
                          <Badge label={u.role} color={u.role === "admin" ? "bg-[var(--palette-rose-950)] text-[var(--palette-rose-400)]" : "bg-[var(--palette-zinc-800)] text-[var(--palette-zinc-400)]"} />
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => { setPremiumGrantId(u.id); }}
                            className="rounded px-2 py-0.5 text-[10px] border border-[var(--palette-amber-800)]/50 text-[var(--palette-amber-400)] hover:bg-[var(--palette-amber-950)]/30 transition"
                          >
                            Select
                          </button>
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

  function renderModeration() {
    return (
      <MotionTab>
        <SectionHeader
          title="Content Moderation"
          sub={`${moderationCount} post${moderationCount !== 1 ? "s" : ""} awaiting review. AI flags suspicious content automatically; approve or remove here.`}
        />
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
          <button
            onClick={() => void loadModerationQueue()}
            className="min-h-10 rounded-lg border border-[var(--border-strong)] px-3 text-xs font-medium text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
          >
            ↻ Refresh queue
          </button>
          <button
            onClick={() => void sendModerationDigest()}
            disabled={digestSending}
            className="min-h-10 rounded-lg border border-[var(--card-border)] bg-[var(--brand-soft)] px-3 text-xs font-medium text-[var(--brand-strong)] disabled:opacity-50"
          >
            {digestSending ? "Sending…" : "Email digest"}
          </button>
          {digestResult && <span className="text-xs text-[var(--foreground-muted)]">{digestResult}</span>}
          <span className="ml-auto text-[0.6875rem] text-[var(--foreground-subtle)]">
            Shortcuts: <kbd className="rounded border border-[var(--border)] px-1.5 py-0.5">A</kbd> approve · <kbd className="rounded border border-[var(--border)] px-1.5 py-0.5">R</kbd> reject first item
          </span>
        </div>

        {moderationLoading ? (
          <div className="rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/40 p-8 text-center text-sm text-[var(--palette-zinc-500)]">
            Loading moderation queue…
          </div>
        ) : moderationPosts.length === 0 ? (
          <div className="rounded-xl border border-[var(--palette-emerald-800)]/60 bg-[var(--palette-emerald-900)]/20 p-10 text-center">
            <p className="text-lg">✅</p>
            <p className="mt-2 text-sm font-medium text-[var(--palette-emerald-300)]">All clear — no flagged content.</p>
            <p className="mt-1 text-xs text-[var(--palette-zinc-500)]">New posts are auto-moderated as they come in.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {moderationPosts.map((p, index) => (
              <div key={p.id} className="rounded-xl border border-[color-mix(in_srgb,var(--warning)_28%,transparent)] bg-[var(--warning-soft)] p-4 sm:p-5">
                <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="rounded-full border border-[color-mix(in_srgb,var(--warning)_26%,transparent)] bg-[var(--warning-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--warning)]">
                        {index === 0 ? "First in queue · " : ""}{p.moderationStatus}
                      </span>
                      <span className="text-[10px] text-[var(--palette-zinc-500)]">
                        {p.author?.name || p.author?.email || "Unknown"} · {p.type}
                      </span>
                      <span className="text-[10px] text-[var(--palette-zinc-600)]">
                        {new Date(p.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--palette-zinc-200)] whitespace-pre-wrap break-words">{p.content}</p>
                    {p.moderationReason && (
                      <p className="mt-2 text-xs text-[var(--palette-amber-500)]/80">Reason: {p.moderationReason}</p>
                    )}
                  </div>
                  <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex sm:flex-col">
                    <button
                      onClick={() => void moderatePost(p.id, "approve")}
                      disabled={moderationActionId === p.id}
                      className="min-h-11 rounded-lg border border-[var(--success)] bg-[var(--success-soft)] px-4 text-xs font-semibold text-[var(--success)] disabled:opacity-50"
                    >
                      Approve {index === 0 && <kbd className="ml-1 opacity-70">A</kbd>}
                    </button>
                    <button
                      onClick={() => void moderatePost(p.id, "reject")}
                      disabled={moderationActionId === p.id}
                      className="min-h-11 rounded-lg border border-[var(--danger)] bg-[var(--danger-soft)] px-4 text-xs font-semibold text-[var(--danger)] disabled:opacity-50"
                    >
                      Reject {index === 0 && <kbd className="ml-1 opacity-70">R</kbd>}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </MotionTab>
    );
  }

  function renderSiteSettings() {
    if (!siteSettings) {
      return (
        <MotionTab>
          <SectionHeader title="Site Settings" sub="Maintenance mode, announcements, and branding." />
          <div className="rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/40 p-8 text-center text-sm text-[var(--palette-zinc-500)]">Loading…</div>
        </MotionTab>
      );
    }

    const set = (patch: Partial<typeof siteSettings>) => setSiteSettings((s) => (s ? { ...s, ...patch } : s));

    return (
      <MotionTab>
        <SectionHeader
          title="Site Settings"
          sub="Control the entire site from here — put it in maintenance mode, publish announcements, and edit branding. Changes are live instantly."
        />

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Maintenance mode */}
          <div className="rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/40 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[var(--palette-zinc-100)]">🛠 Maintenance Mode</h3>
                <p className="mt-0.5 text-xs text-[var(--palette-zinc-500)]">Show a maintenance screen to everyone except admins.</p>
              </div>
              <button
                onClick={() => set({ maintenanceMode: !siteSettings.maintenanceMode })}
                className={`relative h-6 w-11 rounded-full transition-colors ${siteSettings.maintenanceMode ? "bg-[var(--palette-amber-600)]" : "bg-[var(--palette-zinc-700)]"}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--palette-white)] transition-transform ${siteSettings.maintenanceMode ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--palette-zinc-500)]">Maintenance message</label>
            <textarea
              rows={3}
              value={siteSettings.maintenanceMessage}
              onChange={(e) => set({ maintenanceMessage: e.target.value })}
              className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-3 py-2 text-sm text-[var(--palette-zinc-200)] outline-none focus:border-[var(--palette-amber-500)] resize-none"
            />
          </div>

          {/* Announcement */}
          <div className="rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/40 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[var(--palette-zinc-100)]">📣 Site Announcement</h3>
                <p className="mt-0.5 text-xs text-[var(--palette-zinc-500)]">Publish a banner across the whole app.</p>
              </div>
              <button
                onClick={() => set({ announcementEnabled: !siteSettings.announcementEnabled })}
                className={`relative h-6 w-11 rounded-full transition-colors ${siteSettings.announcementEnabled ? "bg-[var(--palette-emerald-600)]" : "bg-[var(--palette-zinc-700)]"}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--palette-white)] transition-transform ${siteSettings.announcementEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
            <div className="space-y-2">
              <input
                placeholder="Emoji (e.g. 🎉)"
                value={siteSettings.announcementEmoji}
                onChange={(e) => set({ announcementEmoji: e.target.value })}
                className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-3 py-2 text-sm text-[var(--palette-zinc-200)] outline-none focus:border-[var(--palette-emerald-500)]"
              />
              <input
                placeholder="Title"
                value={siteSettings.announcementTitle}
                onChange={(e) => set({ announcementTitle: e.target.value })}
                className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-3 py-2 text-sm text-[var(--palette-zinc-200)] outline-none focus:border-[var(--palette-emerald-500)]"
              />
              <input
                placeholder="Message"
                value={siteSettings.announcementText}
                onChange={(e) => set({ announcementText: e.target.value })}
                className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-3 py-2 text-sm text-[var(--palette-zinc-200)] outline-none focus:border-[var(--palette-emerald-500)]"
              />
            </div>
          </div>

          {/* Branding */}
          <div className="rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/40 p-5 lg:col-span-2">
            <h3 className="text-sm font-semibold text-[var(--palette-zinc-100)] mb-1">🎨 Branding</h3>
            <p className="mb-4 text-xs text-[var(--palette-zinc-500)]">Edit the app name and tagline shown across the product.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--palette-zinc-500)]">App name</label>
                <input
                  value={siteSettings.brandingName}
                  onChange={(e) => set({ brandingName: e.target.value })}
                  className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-3 py-2 text-sm text-[var(--palette-zinc-200)] outline-none focus:border-[var(--palette-violet-500)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--palette-zinc-500)]">Tagline</label>
                <input
                  value={siteSettings.brandingTagline}
                  onChange={(e) => set({ brandingTagline: e.target.value })}
                  className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-3 py-2 text-sm text-[var(--palette-zinc-200)] outline-none focus:border-[var(--palette-violet-500)]"
                />
              </div>
            </div>
          </div>

          {/* Landing page copy */}
          <div className="rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/40 p-5 lg:col-span-2">
            <h3 className="text-sm font-semibold text-[var(--palette-zinc-100)] mb-1">📝 Landing Page Copy</h3>
            <p className="mb-4 text-xs text-[var(--palette-zinc-500)]">Edit the hero headline, subtitle, and CTA on the landing page. Leave blank to use defaults.</p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--palette-zinc-500)]">Hero subtitle</label>
                <textarea
                  rows={2}
                  value={siteSettings.heroSubtitle}
                  onChange={(e) => set({ heroSubtitle: e.target.value })}
                  placeholder="Strap in, Commander. Every focus session fires your thrusters…"
                  className="w-full resize-none rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-3 py-2 text-sm text-[var(--palette-zinc-200)] outline-none focus:border-[var(--palette-violet-500)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--palette-zinc-500)]">CTA button text</label>
                <input
                  value={siteSettings.heroCtaText}
                  onChange={(e) => set({ heroCtaText: e.target.value })}
                  placeholder="🚀 Begin Launch Sequence"
                  className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-3 py-2 text-sm text-[var(--palette-zinc-200)] outline-none focus:border-[var(--palette-violet-500)]"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={() => void saveSiteSettings()}
            disabled={siteSettingsSaving}
            className="rounded-lg bg-[var(--palette-violet-600)] px-5 py-2.5 text-sm font-semibold text-[var(--palette-white)] hover:bg-[var(--palette-violet-500)] disabled:opacity-50 transition"
          >
            {siteSettingsSaving ? "Saving…" : "Save Settings"}
          </button>
          {siteSettingsResult && (
            <span className={`text-xs ${siteSettingsResult.startsWith("Error") ? "text-[var(--palette-rose-400)]" : "text-[var(--palette-emerald-400)]"}`}>
              {siteSettingsResult}
            </span>
          )}
        </div>
      </MotionTab>
    );
  }

  function renderEconomy() {
    const e = economyState;
    const fmt = (n: number) => n.toLocaleString("en-IN");
    const maxFlow = e ? Math.max(1, ...e.daily.map(d => Math.max(d.mints, d.burns))) : 1;
    return (
      <MotionTab>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <SectionHeader
            title="Economy"
            sub="Circulating supply, coin flow and ledger health. Every mint/burn in the product writes coin_transactions (lib/coinLedger), so these numbers are complete by construction. Humans and AI rivals are kept separate."
          />
          <button onClick={() => void loadEconomy()} className="rounded-lg border border-[var(--palette-zinc-700)] px-3 py-1.5 text-xs text-[var(--palette-zinc-400)] hover:text-[var(--palette-zinc-200)] transition">
            <RefreshCw size={12} className={cn("inline mr-1", economyLoading && "animate-spin")} />Refresh
          </button>
        </div>

        {!e && <p className="text-xs text-[var(--palette-zinc-500)]">{economyLoading ? "Loading…" : "No data yet."}</p>}

        {e && (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Circulating supply" value={fmt(e.supply.total)} accent="violet" sub={`${fmt(e.supply.humans)} humans · ${fmt(e.supply.wallets)} wallets`} />
              <StatCard label="In AI rival wallets" value={fmt(e.supply.bots)} accent="sky" sub={`${e.supply.total > 0 ? Math.round((e.supply.bots / e.supply.total) * 100) : 0}% of supply (simulated economy)`} />
              <StatCard label="7-day mints" value={`+${fmt(e.last7.mints)}`} accent="emerald" sub={`${e.last7.net >= 0 ? "net +":""}${fmt(e.last7.net)}`} />
              <StatCard label="7-day burns" value={`-${fmt(e.last7.burns)}`} accent="rose" sub={`inflation ${e.inflationPct}% of supply / 7d`} />
            </div>

            {e.inflationAlert && (
              <div className="mt-4 rounded-xl border border-[var(--palette-amber-500)]/40 bg-[var(--palette-amber-500)]/10 p-4">
                <p className="text-xs font-semibold text-[var(--palette-amber-400]">⚠️ Inflation alert</p>
                <p className="mt-1 text-[0.6875rem] leading-relaxed text-[var(--palette-zinc-400)]">
                  Net coin mints over 7 days are {e.inflationPct}% of circulating supply (threshold 5%). Consider raising coin sinks (bundle discounts, gifting tax, sell-back caps) or lowering mint rates (session rewards, drop pools) before the supply doubles.
                </p>
              </div>
            )}

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {/* 14-day flow */}
              <div className="rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-950)]/40 p-4">
                <h3 className="mb-3 text-sm font-semibold text-[var(--palette-zinc-200)]">14-day coin flow (IST days)</h3>
                <div className="flex h-40 items-end gap-1">
                  {e.daily.map((d) => (
                    <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${d.day} — minted ${d.mints.toLocaleString()}, burned ${d.burns.toLocaleString()}`}>
                      <div className="flex w-full flex-1 items-end justify-center gap-px">
                        <div className="w-1/2 rounded-t-sm bg-[var(--palette-emerald-500)]/70" style={{ height: `${Math.max(3, (d.mints / maxFlow) * 100)}%` }} />
                        <div className="w-1/2 rounded-t-sm bg-[var(--palette-rose-500)]/70" style={{ height: `${Math.max(3, (d.burns / maxFlow) * 100)}%` }} />
                      </div>
                      <span className="text-[0.5rem] text-[var(--palette-zinc-600)]">{d.day.slice(3)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex gap-4 text-[0.625rem] text-[var(--palette-zinc-500)]">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[var(--palette-emerald-500)]/70" /> minted</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[var(--palette-rose-500)]/70" /> burned</span>
                </div>
              </div>

              {/* Top reasons */}
              <div className="rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-950)]/40 p-4">
                <h3 className="mb-3 text-sm font-semibold text-[var(--palette-zinc-200)]">Top coin movers — last 7 days</h3>
                <div className="space-y-1.5">
                  {e.topReasons.length === 0 && <p className="text-xs text-[var(--palette-zinc-500)]">No transactions yet.</p>}
                  {e.topReasons.map((r) => {
                    const total = Number(r.total);
                    return (
                      <div key={`${r.reason}-${r.type}`} className="flex items-center justify-between rounded-lg bg-[var(--palette-zinc-900)]/50 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-[var(--palette-zinc-300)]">{r.reason.replace(/_/g, " ")}</p>
                          <p className="text-[0.625rem] text-[var(--palette-zinc-500)]">{r.n} transactions</p>
                        </div>
                        <span className={cn("shrink-0 text-xs font-bold", total >= 0 ? "text-[var(--palette-emerald-400)]" : "text-[var(--palette-rose-400)]")}>
                          {total >= 0 ? "+" : ""}{total.toLocaleString("en-IN")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Marketplace flows */}
            <div className="mt-4 rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-950)]/40 p-4">
              <h3 className="mb-3 text-sm font-semibold text-[var(--palette-zinc-200)]">Marketplace flows — last 7 days</h3>
              <div className="grid gap-3 sm:grid-cols-4">
                {([
                  { label: "🛒 Purchases", key: "marketplace_purchase" },
                  { label: "🎁 Gifts (incl. 5% tax)", key: "gift_purchase" },
                  { label: "♻️ Sell-backs (50% refund)", key: "sellback" },
                  { label: "📦 Bundles", key: "bundle_purchase" },
                ] as Array<{ label: string; key: string }>).map(({ label, key }) => {
                  const m = e.marketplace[key];
                  return (
                    <div key={key} className="rounded-lg bg-[var(--palette-zinc-900)]/50 p-3">
                      <p className="text-[0.6875rem] text-[var(--palette-zinc-400)]">{label}</p>
                      <p className="mt-1 text-lg font-bold text-[var(--palette-zinc-200)]">{m?.n ?? 0}</p>
                      <p className={cn("text-[0.625rem]", (m?.total ?? 0) >= 0 ? "text-[var(--palette-emerald-400)]" : "text-[var(--palette-rose-400)]")}>
                        {(m?.total ?? 0) >= 0 ? "+" : ""}{(m?.total ?? 0).toLocaleString("en-IN")} coins
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </MotionTab>
    );
  }

  function renderDrops() {
    const drops = dropsState?.drops ?? [];
    const templates = dropsState?.templates ?? [];
    const items = dropsState?.items ?? [];
    const sparklines = dropsState?.sparklines ?? {};
    const now = Date.now();
    const currentTemplate = templates.find((t) => t.type === dropForm.type);

    function fmtCountdown(target: number): string {
      const diff = target - now;
      if (diff <= 0) return "now";
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const sec = Math.floor((diff % 60000) / 1000);
      if (h > 0) return `${h}h ${m}m`;
      if (m > 0) return `${m}m ${sec}s`;
      return `${sec}s`;
    }

    const numField = (label: string, key: string, step = 1) => (
      <label className="block">
        <span className="mb-1 block text-[0.6875rem] font-medium text-[var(--palette-zinc-400)]">{label}</span>
        <input
          type="number"
          step={step}
          min={0}
          value={dropForm[key as keyof typeof dropForm] as number}
          onChange={(e) => setDropForm((f) => ({ ...f, [key]: Number(e.target.value) || 0 }))}
          className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-900)] px-3 py-2 text-xs text-[var(--palette-zinc-200)] outline-none focus:border-[var(--accent)]"
        />
      </label>
    );

    return (
      <MotionTab>
        <SectionHeader
          title="Admin Drops"
          sub="Scheduled hype events — coin rain, double-XP hours, flash quests, streak-freeze giveaways, item flash sales and leaderboard shake-ups. Creating a drop announces it to every real member (notification + push + socket pop; bots are never spammed) and optional email blast."
        />

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Create panel */}
          <div className="rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-950)]/40 p-4">
            <h3 className="mb-3 text-sm font-semibold text-[var(--palette-zinc-200)]">New drop</h3>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {templates.map((t) => (
                <button
                  key={t.type}
                  onClick={() => setDropForm((f) => ({ ...f, type: t.type }))}
                  title={t.description}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[0.6875rem] transition",
                    dropForm.type === t.type
                      ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                      : "border-[var(--palette-zinc-700)] text-[var(--palette-zinc-400)] hover:text-[var(--palette-zinc-200)]"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="mb-3 text-[0.6875rem] leading-relaxed text-[var(--palette-zinc-500)]">{currentTemplate?.description}</p>

            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-[0.6875rem] font-medium text-[var(--palette-zinc-400)]">Title</span>
                <input
                  value={dropForm.title}
                  onChange={(e) => setDropForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Monsoon Coin Rain — 250 coins"
                  className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-900)] px-3 py-2 text-xs text-[var(--palette-zinc-200)] outline-none focus:border-[var(--accent)]"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[0.6875rem] font-medium text-[var(--palette-zinc-400)]">Announcement text (shown in notification + banner)</span>
                <input
                  value={dropForm.description}
                  onChange={(e) => setDropForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. Coins are raining — grab yours before the pool runs out!"
                  className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-900)] px-3 py-2 text-xs text-[var(--palette-zinc-200)] outline-none focus:border-[var(--accent)]"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                {numField("Starts in (minutes)", "startsInMin")}
                {numField("Window length (hours)", "durationH")}
                {(dropForm.type === "coin_rain" || dropForm.type === "streak_freeze") && numField(dropForm.type === "coin_rain" ? "Coins per claim" : "Tokens per claim", "coinsPerClaim")}
                {(dropForm.type === "coin_rain" || dropForm.type === "streak_freeze") && numField("Total pool", "poolTotal")}
                {(dropForm.type === "double_xp" || dropForm.type === "board_shakeup") && numField("XP multiplier (×)", "multiplier", 0.5)}
                {dropForm.type === "flash_quest" && numField("Target focus minutes", "targetMinutes")}
                {dropForm.type === "flash_quest" && numField("Reward coins", "rewardCoins")}
                {dropForm.type === "flash_quest" && numField("Reward XP", "rewardXp")}
                {dropForm.type === "item_flash_sale" && numField("Discount %", "discountPct")}
              </div>
              {dropForm.type === "item_flash_sale" && (
                <label className="block">
                  <span className="mb-1 block text-[0.6875rem] font-medium text-[var(--palette-zinc-400)]">Item</span>
                  <select
                    value={dropForm.itemId}
                    onChange={(e) => setDropForm((f) => ({ ...f, itemId: e.target.value }))}
                    className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-900)] px-3 py-2 text-xs text-[var(--palette-zinc-200)] outline-none focus:border-[var(--accent)]"
                  >
                    <option value="">Select an item…</option>
                    {items.map((it) => (
                      <option key={it.id} value={it.id}>{it.name} — {it.costCoins.toLocaleString()} coins</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--palette-zinc-400)]">
                <input
                  type="checkbox"
                  checked={dropForm.emailBlast}
                  onChange={(e) => setDropForm((f) => ({ ...f, emailBlast: e.target.checked }))}
                  className="accent-[var(--accent)]"
                />
                Also send an email blast to every member
              </label>
              <button
                onClick={() => void createDropNow()}
                disabled={dropsBusy}
                className="w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {dropsBusy ? "Working…" : "Create & announce drop"}
              </button>
            </div>
          </div>

          {/* Live monitor */}
          <div className="rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-950)]/40 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--palette-zinc-200)]">Drops ({drops.length})</h3>
              <button onClick={() => void loadDrops()} className="text-xs text-[var(--palette-zinc-500)] hover:text-[var(--palette-zinc-300)] transition">
                <RefreshCw size={12} className={cn("inline mr-1", dropsLoading && "animate-spin")} />Refresh
              </button>
            </div>
            {drops.length === 0 && <p className="text-xs text-[var(--palette-zinc-500)]">No drops yet. Create your first drop — it announces instantly to every member.</p>}
            <div className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
              {drops.map((d) => {
                const state = d.live ? "LIVE" : d.cancelledAt ? "cancelled" : d.startsAt > new Date(now) ? "upcoming" : "ended";
                const spark = sparklines[d.id] ?? [];
                const maxN = Math.max(1, ...spark.map((s: any) => s.n));
                const pct = d.poolTotal > 0 ? Math.max(0, Math.min(100, Math.round(((d.poolRemaining ?? 0) / d.poolTotal) * 100))) : null;
                return (
                  <div key={d.id} className="rounded-lg border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-xs font-semibold text-[var(--palette-zinc-200)]">{d.title}</span>
                          <span className={cn(
                            "shrink-0 rounded-full px-1.5 py-0.5 text-[0.5625rem] font-semibold uppercase tracking-wide",
                            state === "LIVE" && "bg-[var(--accent)]/15 text-[var(--accent)]",
                            state === "upcoming" && "bg-[var(--palette-amber-500)]/15 text-[var(--palette-amber-400)]",
                            state === "ended" && "bg-[var(--palette-zinc-700)]/40 text-[var(--palette-zinc-400)]",
                            state === "cancelled" && "bg-[var(--palette-rose-500)]/15 text-[var(--palette-rose-400)]"
                          )}>
                            {state === "upcoming" ? `in ${fmtCountdown(new Date(d.startsAt).getTime())}` : state}
                          </span>
                        </div>
                        {d.description && <p className="mt-0.5 truncate text-[0.6875rem] text-[var(--palette-zinc-500)]">{d.description}</p>}
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.625rem] text-[var(--palette-zinc-500)]">
                          <span>{d.type.replace("_", " ")}</span>
                          <span>ends {new Date(d.endsAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                          <span className="text-[var(--palette-zinc-300)]">{d.claims} claims{d.createdVia === "gemini" && " · via Gemini"}</span>
                          {pct !== null && <span className={pct === 0 ? "text-[var(--palette-rose-400)]" : undefined}>{d.poolRemaining ?? 0} / {d.poolTotal} left ({pct}%)</span>}
                        </div>
                        {pct !== null && (
                          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[var(--palette-zinc-800)]">
                            <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
                          </div>
                        )}
                        {spark.length > 0 && (
                          <div className="mt-2 flex h-8 items-end gap-0.5">
                            {spark.map((sp: any, i: number) => (
                              <div key={i} className="flex-1 rounded-sm bg-[var(--accent)]/50" style={{ height: `${Math.max(8, (sp.n / maxN) * 100)}%` }} title={`${sp.bucket} — ${sp.n} claims`} />
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        {d.live && (
                          <>
                            <button onClick={() => { if (confirm(`End “${d.title}” now?`)) void dropAction(d.id, "end"); }} className="rounded border border-[var(--palette-zinc-700)] px-2 py-1 text-[0.625rem] text-[var(--palette-zinc-300)] hover:text-[var(--palette-zinc-100)]">End</button>
                            <button onClick={() => void dropAction(d.id, "duplicate")} className="rounded border border-[var(--palette-zinc-700)] px-2 py-1 text-[0.625rem] text-[var(--palette-zinc-300)] hover:text-[var(--palette-zinc-100)]">Repeat</button>
                          </>
                        )}
                        {!d.live && !d.cancelledAt && d.startsAt > new Date(now) && (
                          <button onClick={() => { if (confirm(`Cancel “${d.title}” before it starts?`)) void dropAction(d.id, "cancel"); }} className="rounded border border-[var(--palette-rose-800)] px-2 py-1 text-[0.625rem] text-[var(--palette-rose-400)] hover:bg-[var(--palette-rose-950)]">Cancel</button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <ul className="mt-4 list-disc space-y-1 pl-5 text-[0.6875rem] leading-relaxed text-[var(--palette-zinc-500)]">
          <li>Pools are atomic — the last coin can never be oversold to two members; each member claims once per drop (enforced in the database).</li>
          <li>Double-XP and shake-up multipliers apply server-side to session rewards only while the window is live — nothing to claim, nothing to spoof.</li>
          <li>Expiry is a window check (no cron). The public /drops endpoint drives the live countdown chips in the app.</li>
        </ul>
      </MotionTab>
    );
  }

  function renderRivals() {

    const bots = botsState?.bots ?? [];
    const stats = botsState?.stats;
    return (
      <MotionTab>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <SectionHeader
            title="AI Rivals"
            sub="A living community of clearly-labelled AI accounts — Indian names, exam goals, real XP curves. They post, hold threads, reply to members with a natural 1–8h lag, like, react and follow. Every rival is visibly badged “AI” so nobody mistakes them for real people."
          />
          <div className="flex items-center gap-2">
            <button onClick={() => void loadBots()} className="rounded-lg border border-[var(--palette-zinc-700)] px-3 py-1.5 text-xs text-[var(--palette-zinc-400)] hover:text-[var(--palette-zinc-200)] transition">
              <RefreshCw size={12} className={`inline mr-1 ${botsLoading ? "animate-spin" : ""}`} />Refresh
            </button>
            {bots.length > 0 && (
              <button
                onClick={() => void removeRivals()}
                disabled={botsBusy}
                className="rounded-lg border border-[var(--palette-rose-800)] px-3 py-1.5 text-xs font-medium text-[var(--palette-rose-400)] hover:bg-[var(--palette-rose-950)] disabled:opacity-50"
              >
                Remove all
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="AI rivals live" value={String(botsState?.total ?? bots.length)} accent="sky" />
          <StatCard label="Posts today" value={String(stats?.today.posts ?? 0)} />
          <StatCard label="Comments today" value={String(stats?.today.comments ?? 0)} />
          <StatCard label="Follows today" value={String(stats?.today.follows ?? 0)} />
        </div>

        {/* Target dial (A1) */}
        <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/20 p-4">
          <p className="mb-2 text-xs font-semibold text-[var(--palette-zinc-300)]">Community size</p>
          <div className="flex flex-wrap items-center gap-2">
            {[500, 2000, 12000].map((n) => {
              const active = (botsState?.total ?? 0) === n;
              return (
                <button
                  key={n}
                  onClick={() => { if (confirm(`Seed the community up to ${n.toLocaleString()} AI rivals? (idempotent — existing rivals are kept)`)) void seedRivals(n); }}
                  disabled={botsBusy || active}
                  className={`rounded-lg px-4 py-2 text-xs font-semibold transition disabled:opacity-60 ${
                    active
                      ? "border border-[var(--palette-emerald-700)] bg-[var(--palette-emerald-950)] text-[var(--palette-emerald-300)]"
                      : "border border-[var(--palette-zinc-700)] text-[var(--palette-zinc-300)] hover:border-[var(--palette-sky-700)] hover:text-[var(--palette-sky-300)]"
                  }`}
                >
                  {active ? "✓ " : ""}{n.toLocaleString()} rivals
                </button>
              );
            })}
            <button
              onClick={() => void seedRivals(Math.max(36, Math.floor((botsState?.total ?? 0) * 1.5)))}
              disabled={botsBusy || !bots.length}
              className="rounded-lg border border-[var(--palette-zinc-700)] px-3 py-2 text-xs text-[var(--palette-zinc-400)] hover:text-[var(--palette-zinc-200)] disabled:opacity-50"
            >
              +50% more
            </button>
            <span className="text-[10px] text-[var(--palette-zinc-500)]">
              {botsBusy ? "Seeding… (12k takes a few seconds, batched in transactions)" : "Idempotent + resumable. Seeding runs off request paths."}
            </span>
          </div>
        </div>

        {/* Next personas preview */}
        {Array.isArray(botsState?.preview) && botsState.preview.length > 0 && (
          <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/20 p-4">
            <p className="mb-2 text-xs font-semibold text-[var(--palette-zinc-300)]">Next personas (deterministic preview)</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {botsState.preview.map((p: any, i: number) => (
                <div key={i} className="rounded-lg border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/40 p-3">
                  <p className="truncate text-xs font-semibold text-[var(--palette-zinc-200)]">🤖 {p.name}</p>
                  <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-[var(--palette-zinc-500)]">{p.bio}</p>
                  <p className="mt-1 text-[10px] text-[var(--palette-zinc-400)]">{p.xp.toLocaleString()} XP · 🔥{p.streak} · {p.timezone}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/20 p-4 text-xs leading-relaxed text-[var(--palette-zinc-400)]">
          <p className="mb-1 font-semibold text-[var(--palette-zinc-300)]">How it works</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>Each rival earns XP and advances its streak once a day — triggered lazily when anyone views the leaderboard or community feed (no cron; exactly-once per IST day even across serverless instances).</li>
            <li>Daily rhythm: 3–8 posts spread across IST 06:00–now, 1–2 real bot-to-bot threads, 5–15 topic-matched comments, 15–30 reactions, ≤30 new follows.</li>
            <li>When a human posts, 0–2 rivals reply with a natural 1–8h lag. Per-bot daily caps: 1 post · 3 comments · 15 reactions · 5 follows; the feed stays majority-human by design.</li>
            <li>Rivals blend into the community — no visible AI badge on leaderboards, feed, rooms or messages (owner decision, Aug 2026). They stay internally flagged <code>role="bot"</code> so admin analytics always separate humans from bots.</li>
            <li>Admin analytics keep real humans and AI rivals as separate numbers.</li>
          </ul>
        </div>

        <p className="mt-4 mb-2 text-xs font-semibold text-[var(--palette-zinc-300)]">
          Latest rivals {bots.length > 0 && <span className="font-normal text-[var(--palette-zinc-500)]">(newest {bots.length} of {botsState?.total ?? bots.length})</span>}
        </p>
        {botsLoading ? (
          <div className="text-center py-8 text-[var(--palette-zinc-500)] text-sm">Loading…</div>
        ) : bots.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--palette-zinc-800)] p-10 text-center">
            <Bot size={36} className="mx-auto mb-3 text-[var(--palette-zinc-600)]" />
            <p className="text-sm font-medium text-[var(--palette-zinc-300)]">No AI rivals yet</p>
            <p className="mt-1 text-xs text-[var(--palette-zinc-500)]">Pick a community size above to seed the crew.</p>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {bots.map((b: any) => (
              <div key={b.id} className="flex items-center gap-3 rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/40 px-4 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--palette-sky-950)] text-[var(--palette-sky-400)]"><Bot size={16} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--palette-zinc-200)]">{b.name ?? "Rival"}</p>
                  <p className="truncate text-[10px] font-mono text-[var(--palette-zinc-600)]">{b.email}</p>
                </div>
                <button
                  onClick={() => setManagingUserId(b.id)}
                  className="rounded-lg border border-[var(--palette-zinc-700)] px-2 py-1 text-[10px] text-[var(--palette-zinc-400)] hover:text-[var(--palette-zinc-200)]"
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        )}
      </MotionTab>
    );
  }

  const TAB_RENDER: Record<Tab, () => React.ReactNode> = {
    overview: renderOverview,
    analytics: () => (
      <MotionTab>
        <SectionHeader title="Advanced Analytics" sub="Deep-dive into platform events and visitor data." />
        <AnalyticsDashboard authHeaders={authHeaders} />
      </MotionTab>
    ),
    users: renderUsers,
    moderation: renderModeration,
    missions: renderMissions,
    retention: renderRetention,
    sql: renderSql,
    rivals: renderRivals,
    marketplace: renderMarketplace,
    pets: renderPets,
    lootboxes: renderLootboxes,
    battlepass: renderBattlePass,
    quests: renderQuests,
    city: renderCity,
    notify: renderNotify,
    drops: renderDrops,
    economy: renderEconomy,
    gemini: () => (
      <MotionTab>
        <SectionHeader
          title="Gemini Chief-of-Staff"
          sub="AI budget & traffic (G5), idea backlog with human approval (G3), daily IST briefing + SEO officer (G7/G6), and bot-fleet ops reviews (G4). Suggest-only: nothing AI-initiated can block, mute, or ban."
        />
        <GeminiPanel authHeaders={authHeaders} />
      </MotionTab>
    ),
    coins: renderCoins,
    email: renderEmail,
    premium: renderPremiumManagement,
    site: renderSiteSettings,
  };

  return (
    <AdminShell activeTab={tab} onTabChange={(t) => setTab(t as Tab)}>
      <AnimatePresence mode="wait">
        <div key={tab}>
          {TAB_RENDER[tab]?.() ?? null}
        </div>
      </AnimatePresence>

      <UserManagerDialog
        userId={managingUserId}
        onClose={() => setManagingUserId(null)}
        onChanged={() => void loadData()}
        authHeaders={authHeaders}
      />

      <Dialog open={Boolean(deleteConfirm)} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="w-[min(calc(100vw-2rem),28rem)]">
          <DialogHeader>
            <DialogTitle>Delete user?</DialogTitle>
            <DialogDescription>This permanently removes the account and all associated data. This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="rounded-[var(--radius-md)] border border-[var(--danger)] bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]">
              Confirm that you intend to permanently delete this user.
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              loading={Boolean(deleteConfirm && deleteLoading === deleteConfirm)}
              onClick={() => deleteConfirm && void deleteUser(deleteConfirm)}
            >
              Delete user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
