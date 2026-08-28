import { useMemo, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Award,
  Check,
  Clock3,
  Coins,
  Edit3,
  Flame,
  History,
  Lock,
  Save,
  Sparkles,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  UserRound,
  WalletCards,
  X,
  Zap,
  Crown,
  Palette,
  Image as ImageIcon,
} from "lucide-react";
import { usePremium } from "@/hooks/usePremium";
import { useQuery } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { playSessionComplete } from "@/lib/soundEngine";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";
import { AccountSecuritySection } from "@/components/settings/AccountSecuritySection";
import { NotificationSettingsCard } from "@/components/mobile/NotificationPermissionPrompt";
import { useAuth, getToken } from "@/lib/auth";
import { apiJson } from "@/lib/api";
import { useToast } from "@/components/Toast";
import PageHeader from "@/components/PageHeader";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface BadgeDef {
  id: string;
  name: string;
  description: string;
  tier: "bronze" | "silver" | "gold" | "legendary";
  category: string;
  icon: string;
  threshold: number;
  unit: string;
  unlocked: boolean;
  unlockedAt: string | null;
  progress: number;
  newlyUnlocked: boolean;
}

interface UserStats {
  totalMinutes: number;
  sessions: number;
  streak: number;
  maxScore: number;
  perfectSessions: number;
  maxSessionMinutes: number;
  maxDayMinutes: number;
  nightSessions: number;
  earlySessions: number;
}

/** Fallback so a partial/older API response can never blank the whole page. */
const EMPTY_USER_STATS: UserStats = {
  totalMinutes: 0,
  sessions: 0,
  streak: 0,
  maxScore: 0,
  perfectSessions: 0,
  maxSessionMinutes: 0,
  maxDayMinutes: 0,
  nightSessions: 0,
  earlySessions: 0,
};

interface WalletData { coins: number; totalXp: number; weeklyXp: number; rank: number | null; }
interface CoinTx { id: string; amount: number; description: string; reason: string; balanceAfter: number; createdAt: string; }
interface TxHistory { transactions: CoinTx[]; totalEarned: number; totalSpent: number; currentBalance: number; }
interface AnalyticsData { heatmap: Record<string, number>; }
interface ProfileData { user?: { name?: string; bio?: string; timezone?: string }; }
interface EditFields { name: string; bio: string; timezone: string; }

const TIMEZONES = ["UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Toronto", "America/Sao_Paulo", "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Dubai", "Asia/Kolkata", "Asia/Bangkok", "Asia/Shanghai", "Asia/Tokyo", "Asia/Seoul", "Asia/Singapore", "Australia/Sydney", "Pacific/Auckland"];

const TIER_TONES: Record<BadgeDef["tier"], "secondary" | "outline" | "warning" | "default"> = { bronze: "secondary", silver: "outline", gold: "warning", legendary: "default" };

function levelData(totalXp: number) {
  const level = Math.floor(Math.sqrt(Math.max(0, totalXp) / 100)) + 1;
  const start = (level - 1) ** 2 * 100;
  const end = level ** 2 * 100;
  return { level, inLevel: totalXp - start, needed: end - start, percent: ((totalXp - start) / Math.max(1, end - start)) * 100 };
}

function ProfileDialog({ open, initial, onOpenChange, onSave }: { open: boolean; initial: EditFields; onOpenChange: (open: boolean) => void; onSave: (fields: EditFields) => Promise<void> }) {
  const [fields, setFields] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(""); setSaving(true);
    try { await onSave(fields); onOpenChange(false); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Profile could not be saved"); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onEscapeKeyDown={() => onOpenChange(false)}>
        <form onSubmit={submit}>
          <DialogHeader><DialogTitle>Edit profile</DialogTitle><DialogDescription>Update the details used across your FocusArx workspace.</DialogDescription></DialogHeader>
          <div className="space-y-4 px-6 py-5">
            {error && <p className="rounded-lg bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]" role="alert">{error}</p>}
            <div><label htmlFor="profile-name" className="mb-2 block text-sm font-medium">Display name</label><Input id="profile-name" value={fields.name} onChange={(event) => setFields((current) => ({ ...current, name: event.target.value }))} /></div>
            <div><label htmlFor="profile-bio" className="mb-2 block text-sm font-medium">Bio</label><Textarea id="profile-bio" rows={4} value={fields.bio} onChange={(event) => setFields((current) => ({ ...current, bio: event.target.value }))} placeholder="A short note about what you are working toward" /></div>
            <div><label className="mb-2 block text-sm font-medium">Timezone</label><Select value={fields.timezone} onValueChange={(timezone) => setFields((current) => ({ ...current, timezone }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TIMEZONES.map((timezone) => <SelectItem key={timezone} value={timezone}>{timezone}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" loading={saving}><Save /> Save profile</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ActivityHeatmap({ data }: { data: Record<string, number> }) {
  const cells = useMemo(() => Array.from({ length: 91 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (90 - index));
    const key = date.toISOString().split("T")[0]!;
    return { key, minutes: data[key] ?? 0 };
  }), [data]);
  const max = Math.max(1, ...cells.map((cell) => cell.minutes));
  return (
    <div>
      <div className="grid grid-flow-col grid-rows-7 gap-1 overflow-x-auto pb-2" aria-label="Focus activity over the last 13 weeks">
        {cells.map((cell) => <span key={cell.key} title={`${cell.key}: ${cell.minutes} focus minutes`} className="h-3 w-3 rounded-[3px] border border-[var(--border-subtle)] bg-[var(--brand-500)]" style={{ opacity: cell.minutes ? 0.2 + (cell.minutes / max) * 0.8 : 0.08 }} />)}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-[var(--foreground-subtle)]"><span>13 weeks ago</span><span>Today</span></div>
    </div>
  );
}

/** Sound preferences (audit L1): persistent toggles for effects + coach voice. */
function SoundPreferencesCard() {
  const [effectsOn, setEffectsOn] = useState(() => localStorage.getItem("fx_muted") !== "1");
  const [voiceOn, setVoiceOn] = useState(() => localStorage.getItem("fx-coach-voice") === "true");

  const setEffects = (on: boolean) => {
    localStorage.setItem("fx_muted", on ? "0" : "1");
    setEffectsOn(on);
    if (on) playSessionComplete();
  };

  const setVoice = (on: boolean) => {
    localStorage.setItem("fx-coach-voice", on ? "true" : "false");
    setVoiceOn(on);
  };

  return (
    <Card className="mb-5">
      <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">Sound effects</p>
              <p className="text-xs text-[var(--foreground-subtle)]">Session chimes, XP and achievement sounds.</p>
            </div>
            <Switch checked={effectsOn} onCheckedChange={setEffects} aria-label="Toggle sound effects" />
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-[var(--border-subtle)] pt-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">AI coach voice</p>
              <p className="text-xs text-[var(--foreground-subtle)]">Spoken encouragement at session start and end.</p>
            </div>
            <Switch checked={voiceOn} onCheckedChange={setVoice} aria-label="Toggle AI coach voice" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AchievementCard({ badge }: { badge: BadgeDef }) {
  const percent = badge.unlocked ? 100 : Math.min(100, (badge.progress / Math.max(1, badge.threshold)) * 100);
  return (
    <motion.article layout className={cn("rounded-[var(--radius-lg)] border p-4", badge.unlocked ? "border-[var(--card-border)] bg-[var(--brand-soft)]" : "border-[var(--border-subtle)] bg-[var(--surface-hover)]")}>
      <div className="flex items-start justify-between gap-3"><span className={cn("text-2xl", !badge.unlocked && "grayscale opacity-60")}>{badge.icon}</span>{badge.unlocked ? <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--success-soft)] text-[var(--success)]"><Check size={14} /></span> : <Lock size={14} className="text-[var(--foreground-subtle)]" />}</div>
      <h3 className="mt-3 truncate text-sm font-semibold">{badge.name}</h3><p className="mt-1 line-clamp-2 min-h-8 text-xs leading-relaxed text-[var(--foreground-muted)]">{badge.description}</p>
      <div className="mt-3 flex items-center justify-between"><Badge variant={TIER_TONES[badge.tier]} className="capitalize">{badge.tier}</Badge><span className="text-[0.6875rem] tabular-nums text-[var(--foreground-subtle)]">{badge.unlocked ? "Unlocked" : `${badge.progress}/${badge.threshold}`}</span></div>
      {!badge.unlocked && <Progress value={percent} className="mt-3 h-1.5" />}
    </motion.article>
  );
}

function CustomizationTab() {
  const { isPremium } = usePremium();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["cosmetics-inventory"],
    queryFn: async () => {
      const token = getToken();
      const res = await fetch("/api/cosmetics/inventory", { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (!res.ok) return { inventory: [], catalog: [] };
      return res.json();
    },
  });

  const equipMutation = useQuery({
    queryKey: ["equip-mutation-placeholder"],
    queryFn: async () => null,
    enabled: false,
  });

  const handleEquip = async (id: string) => {
    const token = getToken();
    await fetch(`/api/cosmetics/${id}/equip`, { method: "POST", headers: { Authorization: `Bearer ${token ?? ""}` } });
    refetch();
  };
  const handleUnlock = async (id: string) => {
    const token = getToken();
    const res = await fetch(`/api/cosmetics/${id}/unlock`, { method: "POST", headers: { Authorization: `Bearer ${token ?? ""}` } });
    const json = await res.json();
    if (!res.ok) alert(json.error || "Failed");
    refetch();
  };

  const catalog = data?.catalog ?? [];
  const inventory = data?.inventory ?? [];
  const ownedIds = new Set(inventory.map((i: any) => i.cosmeticId));

  const grouped = catalog.reduce((acc: any, c: any) => {
    if (!acc[c.type]) acc[c.type] = [];
    acc[c.type].push(c);
    return acc;
  }, {});

  if (isLoading) return <Card><CardContent className="p-6"><Skeleton className="h-32" /></CardContent></Card>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Palette size={16}/> Profile customization</CardTitle><CardDescription>Frames, nameplates, backgrounds, badges, aura, emotes. Premium unlocks exclusive styles with Focus Tokens.</CardDescription></CardHeader>
        <CardContent>
          {!isPremium && <div className="mb-4 rounded-xl border border-[var(--palette-amber-500)]/20 bg-[var(--palette-amber-950)]/10 p-3 text-xs"><Crown size={12} className="inline text-[var(--palette-amber-400)]"/> Premium styles require Premium membership + Focus Tokens. <Link href="/premium" className="font-bold text-[var(--palette-amber-400)]">Unlock Premium</Link></div>}
          {Object.entries(grouped).map(([type, items]: any) => (
            <div key={type} className="mb-6">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--foreground-subtle)]">{type.replace("_", " ")}</h4>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(items as any[]).map((c: any) => {
                  const owned = ownedIds.has(c.id);
                  const inv = inventory.find((i: any) => i.cosmeticId === c.id);
                  return (
                    <div key={c.id} className={`rounded-xl border p-3 ${inv?.equipped ? "border-[var(--brand-400)] bg-[var(--brand-soft)]" : "border-[var(--border-subtle)] bg-[var(--surface-hover)]"}`}>
                      <p className="text-sm font-semibold">{c.name}</p>
                      <p className="text-[10px] text-[var(--foreground-subtle)]">{c.description ?? c.type} • {c.rarity} {c.premium ? "• Premium" : ""}</p>
                      {c.tokenCost > 0 && <p className="mt-1 text-[11px] font-bold text-[var(--palette-amber-400)]">🪙 {c.tokenCost} tokens</p>}
                      <div className="mt-2 flex gap-1.5">
                        {owned ? <button onClick={() => handleEquip(c.id)} className={`flex-1 rounded-lg py-1.5 text-xs font-bold ${inv?.equipped ? "bg-[var(--surface-1)] text-[var(--brand-400)]" : "bg-[var(--brand-600)] text-white"}`}>{inv?.equipped ? "Equipped" : "Equip"}</button> : <button onClick={() => handleUnlock(c.id)} className="flex-1 rounded-lg bg-[var(--surface-1)] py-1.5 text-xs font-bold">{c.tokenCost > 0 ? "Unlock" : "Claim"}</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ProfilePage() {
  const { data: session } = useAuth();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [achievementFilter, setAchievementFilter] = useState<"all" | "unlocked" | "locked">("all");
  const [txFilter, setTxFilter] = useState<"all" | "earn" | "spend">("all");

  const query = useQuery({
    queryKey: ["profile-overview"],
    queryFn: async () => {
      const [wallet, badgeData, profile, transactions, analytics] = await Promise.all([
        apiJson<WalletData>("/api/gamification/wallet").catch(() => ({ coins: 0, totalXp: 0, weeklyXp: 0, rank: null })),
        // Each of these degrades on its own: a single failing endpoint must not
        // blank the entire profile view.
        apiJson<{ badges?: BadgeDef[]; stats?: UserStats }>("/api/gamification/badges")
          .catch(() => ({ badges: [], stats: EMPTY_USER_STATS })),
        apiJson<ProfileData>("/api/auth/session").catch(() => ({}) as ProfileData),
        apiJson<TxHistory>("/api/gamification/wallet/transactions?limit=50").catch(() => null),
        apiJson<AnalyticsData>("/api/analytics").catch(() => ({ heatmap: {} })),
      ]);
      return { wallet, badgeData, profile, transactions, analytics };
    },
    staleTime: 60_000,
  });

  const saveProfile = async (fields: EditFields) => {
    const token = getToken();
    const response = await fetch("/api/auth/profile", { method: "PATCH", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(fields) });
    if (!response.ok) throw new Error((await response.json().catch(() => ({})))?.error ?? "Profile could not be saved");
    await query.refetch();
    toast("Profile updated", "success");
  };

  const data = query.data;
  const profile = data?.profile.user;
  const displayName = profile?.name || session?.user?.name || session?.user?.email?.split("@")[0] || "Focus learner";
  const initials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const level = levelData(data?.wallet.totalXp ?? 0);
  const badges = data?.badgeData.badges ?? [];
  const filteredBadges = badges.filter((badge) => achievementFilter === "all" || (achievementFilter === "unlocked" ? badge.unlocked : !badge.unlocked));
  const transactions = (data?.transactions?.transactions ?? []).filter((transaction) => txFilter === "all" || (txFilter === "earn" ? transaction.amount > 0 : transaction.amount < 0));

  if (query.isLoading) return <div className="page-container space-y-5" role="status" aria-label="Loading profile"><Skeleton className="h-32" /><Skeleton className="h-44" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-40" />)}</div></div>;
  if (query.isError || !data) return <div className="page-container"><EmptyState icon={<UserRound />} title="Profile could not be loaded" description="Check your connection and try again. Your progress is safe." action={{ label: "Retry", onClick: () => void query.refetch() }} /></div>;

  const stats = data.badgeData.stats ?? EMPTY_USER_STATS;
  const editFields = { name: displayName, bio: profile?.bio ?? "", timezone: profile?.timezone ?? "UTC" };

  return (
    <div className="page-container">
      <PageHeader eyebrow="Your progress" title="Profile" subtitle="A record of the focus, consistency, and milestones you have built." icon={<UserRound />} actions={<Button variant="outline" onClick={() => setEditing(true)}><Edit3 /> Edit profile</Button>} />

      <Card elevation="glow" className="mb-5 overflow-hidden">
        <CardContent className="grid gap-6 p-6 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-8">
          <Avatar className="h-20 w-20 border border-[var(--card-border)] shadow-[var(--shadow-violet-sm)]"><AvatarFallback className="bg-[var(--brand-soft)] text-xl font-semibold text-[var(--brand-strong)]">{initials}</AvatarFallback></Avatar>
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-2xl font-semibold tracking-tight">{displayName}</h2><Badge><Zap /> Level {level.level}</Badge></div><p className="mt-1 text-sm text-[var(--foreground-muted)]">{profile?.bio || "Building a more deliberate focus practice."}</p><p className="mt-2 text-xs text-[var(--foreground-subtle)]">{session?.user?.email} · {profile?.timezone ?? "UTC"}</p></div>
          <div className="grid grid-cols-2 gap-2 text-center"><div className="rounded-xl bg-[var(--warning-soft)] p-3"><p className="text-xl font-semibold tabular-nums text-[var(--warning)]">{(data.wallet.coins ?? 0).toLocaleString()}</p><p className="text-[0.6875rem] text-[var(--foreground-subtle)]">coins</p></div><div className="rounded-xl bg-[var(--brand-soft)] p-3"><p className="text-xl font-semibold tabular-nums text-[var(--brand-strong)]">{(data.wallet.weeklyXp ?? 0).toLocaleString()}</p><p className="text-[0.6875rem] text-[var(--foreground-subtle)]">weekly XP</p></div></div>
        </CardContent>
      </Card>

      <Card className="mb-5"><CardContent><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="page-eyebrow">XP progress</p><p className="text-xl font-semibold">Level {level.level}</p></div><p className="text-sm tabular-nums text-[var(--foreground-muted)]">{level.inLevel.toLocaleString()} / {level.needed.toLocaleString()} XP</p></div><Progress value={level.percent} className="mt-4 h-3" /><p className="mt-2 text-xs text-[var(--foreground-subtle)]">{Math.max(0, level.needed - level.inLevel).toLocaleString()} XP until level {level.level + 1}</p></CardContent></Card>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[{ label: "Focus time", value: `${Math.round(stats.totalMinutes / 60)}h`, icon: Clock3, tone: "var(--brand-strong)", soft: "var(--brand-soft)" }, { label: "Sessions", value: stats.sessions.toLocaleString(), icon: Target, tone: "var(--success)", soft: "var(--success-soft)" }, { label: "Current streak", value: `${stats.streak}d`, icon: Flame, tone: "var(--warning)", soft: "var(--warning-soft)" }, { label: "Best score", value: `${stats.maxScore}%`, icon: Star, tone: "var(--info)", soft: "var(--info-soft)" }].map(({ label, value, icon: Icon, tone, soft }) => <Card key={label} interactive><CardContent className="flex items-center gap-4"><span className="grid h-11 w-11 place-items-center rounded-xl" style={{ color: tone, background: soft }}><Icon size={20} /></span><div><p className="text-2xl font-semibold tabular-nums">{value}</p><p className="text-xs text-[var(--foreground-subtle)]">{label}</p></div></CardContent></Card>)}
      </div>

      <SoundPreferencesCard />
      <AppearanceSettings />
      <NotificationSettingsCard />
      <AccountSecuritySection />

      <Tabs defaultValue="achievements">
        <TabsList className="mb-5 grid h-auto w-full max-w-md grid-cols-4"><TabsTrigger value="achievements" className="min-h-11"><Award /> Achievements</TabsTrigger><TabsTrigger value="activity" className="min-h-11"><History /> Activity</TabsTrigger><TabsTrigger value="wallet" className="min-h-11"><WalletCards /> Wallet</TabsTrigger><TabsTrigger value="custom" className="min-h-11"><Palette /> Style</TabsTrigger></TabsList>

        <TabsContent value="achievements">
          <Card><CardHeader className="flex-row items-start justify-between"><div><CardTitle>Achievements</CardTitle><CardDescription>{badges.filter((badge) => badge.unlocked).length} of {badges.length} unlocked</CardDescription></div><div className="flex rounded-lg bg-[var(--surface-hover)] p-1">{(["all", "unlocked", "locked"] as const).map((filter) => <button key={filter} onClick={() => setAchievementFilter(filter)} className={cn("min-h-11 min-w-11 rounded-md px-3 text-xs capitalize text-[var(--foreground-muted)]", achievementFilter === filter && "bg-[var(--surface-raised)] text-[var(--foreground)] shadow-[var(--shadow-xs)]")}>{filter}</button>)}</div></CardHeader><CardContent>{filteredBadges.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{filteredBadges.map((badge) => <AchievementCard key={badge.id} badge={badge} />)}</div> : <EmptyState icon={<Award />} title="No achievements here yet" description="Switch filters or keep building your focus practice." />}</CardContent></Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card><CardHeader><CardTitle>Focus activity</CardTitle><CardDescription>Minutes focused each day over the last 13 weeks.</CardDescription></CardHeader><CardContent><ActivityHeatmap data={data.analytics.heatmap} /></CardContent></Card>
        </TabsContent>

        <TabsContent value="wallet">
          <Card><CardHeader className="flex-row items-start justify-between"><div><CardTitle>Coin activity</CardTitle><CardDescription>Rewards earned and spent across FocusArx.</CardDescription></div><div className="flex rounded-lg bg-[var(--surface-hover)] p-1">{(["all", "earn", "spend"] as const).map((filter) => <button key={filter} onClick={() => setTxFilter(filter)} className={cn("min-h-11 min-w-11 rounded-md px-3 text-xs capitalize text-[var(--foreground-muted)]", txFilter === filter && "bg-[var(--surface-raised)] text-[var(--foreground)]")}>{filter}</button>)}</div></CardHeader><CardContent>{transactions.length ? <div className="divide-y divide-[var(--border-subtle)]">{transactions.map((transaction) => { const earned = transaction.amount > 0; return <div key={transaction.id} className="flex min-h-16 items-center gap-3 py-2"><span className={cn("grid h-9 w-9 place-items-center rounded-lg", earned ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--danger-soft)] text-[var(--danger)]")}>{earned ? <TrendingUp /> : <TrendingDown />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{transaction.description}</p><p className="text-xs text-[var(--foreground-subtle)]">{new Date(transaction.createdAt).toLocaleString()}</p></div><div className="text-right"><p className={cn("font-semibold tabular-nums", earned ? "text-[var(--success)]" : "text-[var(--danger)]")}>{earned ? "+" : ""}{transaction.amount.toLocaleString()} <Coins className="inline size-3" /></p><p className="text-xs text-[var(--foreground-subtle)]">{transaction.balanceAfter.toLocaleString()} balance</p></div></div>; })}</div> : <EmptyState icon={<Coins />} title="No coin activity" description="Completed sessions and rewards will appear here." />}</CardContent></Card>
        </TabsContent>

        <TabsContent value="custom">
          <CustomizationTab />
        </TabsContent>
      </Tabs>

      <ProfileDialog open={editing} initial={editFields} onOpenChange={setEditing} onSave={saveProfile} />
    </div>
  );
}
