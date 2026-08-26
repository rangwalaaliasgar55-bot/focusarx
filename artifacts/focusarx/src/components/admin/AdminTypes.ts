// ─── Shared Admin Types ──────────────────────────────────────────────────────

export type AdminUser = {
  id: string;
  name: string | null;
  email: string;
  isGuest: boolean;
  role: string;
  sessionCount: number;
  streak: number;
  createdAt: string;
  premiumUntil?: string;
};

export type DailyPoint = { day: string; date: string; sessions: number; minutes: number };
export type TopUser = { id: string; name: string; email: string; isGuest: boolean; minutes: number };

export type AdminStats = {
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

export type AdminData = {
  users: AdminUser[];
  activeCount: number;
  guestCount?: number;
  botCount?: number;
};

export type MarketplaceItem = {
  id: string; name: string; description: string; type: string;
  costCoins: number; rarity: string; emoji: string; isActive: boolean;
};

export type LootBoxType = {
  id: string; name: string; description: string; coinCost: number;
  rarity: string; icon: string; glowColor: string; sessionsRequired: number;
  possibleRewards: any[];
};

export type QuestDef = {
  id: string; title: string; description: string; type: string;
  metric: string; target: number;
  xpReward: number; coinReward: number; icon: string; isActive: boolean; difficulty?: string;
};

export type BattlePassStats = {
  stats: { totalUsers: number; avgTier: number; avgXp: number; premiumCount: number; maxTier: number } | null;
  tierDistribution: { tier: number; count: number }[];
};

export type PetStats = { stats: { petType: string; count: number; avgLevel: number }[]; totalPets: number };

export type CmsOverview = {
  users: { total: number; registered: number; guests: number; admins: number } | null;
  wallets: { totalCoins: number; totalXp: number; avgCoins: number; avgXp: number } | null;
  marketplace: { totalItems: number; activeItems: number } | null;
  quests: { totalQuests: number; activeQuests: number } | null;
};

export type SiteSettings = {
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
};

export type Tab =
  | "overview" | "analytics" | "users" | "moderation" | "missions" | "retention" | "sql" | "rivals"
  | "marketplace" | "pets" | "lootboxes" | "battlepass" | "quests"
  | "city" | "notify" | "drops" | "economy" | "coins" | "email" | "premium" | "site" | "gemini";

// ─── Common props interface for admin panels ────────────────────────────────

export interface AdminPanelProps {
  authHeaders: () => Record<string, string>;
  onDataChanged?: () => void;
}
