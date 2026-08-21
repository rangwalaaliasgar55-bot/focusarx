import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { PageTransition } from "@/components/PageTransition";
import { getToken } from "@/lib/auth";
import { User, Award, Zap, Lock, Pencil, X, Save, ShoppingBag, Globe, FileText, TrendingUp, TrendingDown, Wallet, History, Star } from "lucide-react";
import { Link } from "wouter";
import ProductivityResume from "@/components/ProductivityResume";
import { useQuery } from "@tanstack/react-query";

type BadgeDef = {
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
};

type UserStats = {
  totalMinutes: number;
  sessions: number;
  streak: number;
  maxScore: number;
  perfectSessions: number;
  maxSessionMinutes: number;
  maxDayMinutes: number;
  nightSessions: number;
  earlySessions: number;
};

type WalletData = {
  coins: number;
  totalXp: number;
  weeklyXp: number;
  rank: number | null;
};

type CoinTx = {
  id: string;
  type: "earn" | "spend";
  amount: number;
  reason: string;
  description: string;
  balanceAfter: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

type TxHistory = {
  transactions: CoinTx[];
  totalEarned: number;
  totalSpent: number;
  currentBalance: number;
};

const TIER_COLORS = {
  bronze:    { text: "#CD7F32", bg: "rgba(205,127,50,0.12)",  border: "rgba(205,127,50,0.3)"  },
  silver:    { text: "#94A3B8", bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.3)" },
  gold:      { text: "#F59E0B", bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.3)"  },
  legendary: { text: "#A78BFA", bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.4)" },
};

const TIMEZONES = [
  "UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Toronto", "America/Vancouver", "America/Sao_Paulo", "Europe/London", "Europe/Paris",
  "Europe/Berlin", "Europe/Madrid", "Europe/Rome", "Europe/Amsterdam", "Europe/Stockholm",
  "Europe/Helsinki", "Europe/Moscow", "Asia/Dubai", "Asia/Kolkata", "Asia/Bangkok",
  "Asia/Shanghai", "Asia/Tokyo", "Asia/Seoul", "Asia/Singapore", "Australia/Sydney",
  "Australia/Melbourne", "Pacific/Auckland",
];

function getLevel(totalXp: number) {
  return Math.floor(Math.sqrt(totalXp / 100)) + 1;
}
function xpForLevel(level: number) {
  return (level - 1) ** 2 * 100;
}
function xpForNextLevel(level: number) {
  return level ** 2 * 100;
}

function LevelBar({ totalXp }: { totalXp: number }) {
  const level = getLevel(totalXp);
  const xpStart = xpForLevel(level);
  const xpEnd = xpForNextLevel(level);
  const progress = (totalXp - xpStart) / (xpEnd - xpStart);
  const xpInLevel = totalXp - xpStart;
  const xpNeeded = xpEnd - xpStart;

  return (
    <div className="rounded-2xl border border-[rgba(124,58,237,0.3)] bg-[rgba(124,58,237,0.06)] p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] flex items-center justify-center">
            <span className="text-lg font-black text-white">{level}</span>
          </div>
          <div>
            <p className="text-base font-bold text-[var(--foreground)]">Level {level}</p>
            <p className="text-xs text-[var(--foreground-subtle)]">{totalXp.toLocaleString()} total XP</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-[var(--foreground-subtle)]">Next level</p>
          <p className="text-sm font-semibold text-[#A78BFA]">{xpInLevel} / {xpNeeded} XP</p>
        </div>
      </div>
      <div className="h-2.5 rounded-full bg-[rgba(124,58,237,0.1)] overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#A78BFA]"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, progress * 100)}%` }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </div>
      <p className="mt-2 text-[10px] text-[var(--foreground-subtle)]">{xpNeeded - xpInLevel} XP to level {level + 1}</p>
    </div>
  );
}

function BadgeCard({ badge }: { badge: BadgeDef }) {
  const colors = TIER_COLORS[badge.tier];
  const pct = badge.unlocked ? 100 : Math.round((badge.progress / badge.threshold) * 100);

  return (
    <motion.div
      layout
      className="rounded-2xl border p-4 flex flex-col gap-2"
      style={{
        borderColor: badge.unlocked ? colors.border : "rgba(124,58,237,0.1)",
        background: badge.unlocked ? colors.bg : "rgba(124,58,237,0.03)",
        opacity: badge.unlocked ? 1 : 0.7,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`text-2xl ${!badge.unlocked ? "grayscale" : ""}`}>{badge.icon}</span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[var(--foreground)] leading-tight truncate">{badge.name}</p>
            <p
              className="text-[9px] font-semibold uppercase tracking-wider"
              style={{ color: badge.unlocked ? colors.text : "#4B5563" }}
            >
              {badge.tier}
            </p>
          </div>
        </div>
        {!badge.unlocked && <Lock size={11} className="text-[var(--foreground-subtle)] shrink-0 mt-0.5" />}
      </div>
      <p className="text-[10px] text-[var(--foreground-subtle)] leading-snug">{badge.description}</p>
      {!badge.unlocked && (
        <div>
          <div className="h-1 rounded-full bg-[rgba(124,58,237,0.1)] overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${pct}%`, background: colors.text }}
            />
          </div>
          <p className="text-[9px] text-[var(--foreground-subtle)] mt-0.5">{badge.progress}/{badge.threshold}</p>
        </div>
      )}
      {badge.unlocked && badge.unlockedAt && (
        <p className="text-[9px] text-[var(--foreground-subtle)]">{new Date(badge.unlockedAt).toLocaleDateString()}</p>
      )}
    </motion.div>
  );
}

type EditFields = { name: string; bio: string; timezone: string };

function EditProfileModal({
  initial,
  onClose,
  onSave,
}: {
  initial: EditFields;
  onClose: () => void;
  onSave: (f: EditFields) => Promise<void>;
}) {
  const [fields, setFields] = useState<EditFields>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave(fields);
      onClose();
    } catch (err: any) {
      setError(err.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative z-10 w-full max-w-md rounded-2xl border border-[rgba(124,58,237,0.25)] bg-[#0f1118] p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-[var(--foreground)] flex items-center gap-2">
            <Pencil size={14} className="text-[#7C3AED]" /> Edit Profile
          </h2>
          <button onClick={onClose} className="text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)] transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-[var(--foreground-subtle)] mb-1.5">Display Name</label>
            <input
              value={fields.name}
              onChange={e => setFields(f => ({ ...f, name: e.target.value }))}
              maxLength={60}
              placeholder="Your name"
              className="w-full rounded-xl border border-[rgba(124,58,237,0.2)] bg-[rgba(124,58,237,0.06)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder-[#4B5563] focus:border-[#7C3AED] focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-[var(--foreground-subtle)] mb-1.5 flex items-center gap-1.5">
              <FileText size={11} /> Bio <span className="ml-auto text-[#3a3d4a]">{fields.bio.length}/300</span>
            </label>
            <textarea
              value={fields.bio}
              onChange={e => setFields(f => ({ ...f, bio: e.target.value }))}
              maxLength={300}
              rows={3}
              placeholder="A short bio about yourself…"
              className="w-full rounded-xl border border-[rgba(124,58,237,0.2)] bg-[rgba(124,58,237,0.06)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder-[#4B5563] focus:border-[#7C3AED] focus:outline-none transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-[var(--foreground-subtle)] mb-1.5 flex items-center gap-1.5">
              <Globe size={11} /> Timezone
            </label>
            <select
              value={fields.timezone}
              onChange={e => setFields(f => ({ ...f, timezone: e.target.value }))}
              className="w-full rounded-xl border border-[rgba(124,58,237,0.2)] bg-[#0f1118] px-3 py-2.5 text-sm text-[var(--foreground)] focus:border-[#7C3AED] focus:outline-none transition-colors"
            >
              {TIMEZONES.map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-[rgba(124,58,237,0.2)] py-2.5 text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 rounded-xl bg-[#7C3AED] py-2.5 text-sm font-semibold text-white hover:bg-[#6d31d4] disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
              <Save size={13} />
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default function ProfilePage() {
  const { status, data: authData } = useAuth();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [badges, setBadges] = useState<BadgeDef[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unlocked" | "locked">("all");
  const [newlyUnlocked, setNewlyUnlocked] = useState<BadgeDef[]>([]);
  const [showUnlock, setShowUnlock] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [localName, setLocalName] = useState("");
  const [localBio, setLocalBio] = useState("");
  const [localTimezone, setLocalTimezone] = useState("UTC");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [txHistory, setTxHistory] = useState<TxHistory | null>(null);
  const [txFilter, setTxFilter] = useState<"all" | "earn" | "spend">("all");

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") { setLoading(false); return; }
    const token = getToken();
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch("/api/gamification/wallet", { headers }).then((r) => r.json()),
      fetch("/api/gamification/badges", { headers }).then((r) => r.json()),
      fetch("/api/auth/session", { headers }).then((r) => r.json()),
      fetch("/api/gamification/wallet/transactions?limit=50", { headers }).then((r) => r.ok ? r.json() : null).catch(() => null),
    ])
      .then(([walletData, badgeData, sessionData, txData]) => {
        setWallet(walletData as WalletData);
        const bd = (badgeData as { badges: BadgeDef[]; stats: UserStats });
        setBadges(bd.badges);
        setStats(bd.stats);
        const newOnes = bd.badges.filter((b) => b.newlyUnlocked);
        if (newOnes.length > 0) {
          setNewlyUnlocked(newOnes);
          setShowUnlock(true);
          setTimeout(() => setShowUnlock(false), 4000);
        }
        const u = sessionData?.user;
        setLocalName(u?.name ?? "");
        setLocalBio(u?.bio ?? "");
        setLocalTimezone(u?.timezone ?? "UTC");
        if (txData) setTxHistory(txData as TxHistory);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status]);

  const user = authData?.user;
  const filteredBadges = badges.filter((b) => {
    if (filter === "unlocked") return b.unlocked;
    if (filter === "locked") return !b.unlocked;
    return true;
  });
  const unlockedCount = badges.filter((b) => b.unlocked).length;

  async function handleSaveProfile(fields: EditFields) {
    const token = getToken();
    const res = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(fields),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || "Save failed");
    }
    setLocalName(fields.name);
    setLocalBio(fields.bio);
    setLocalTimezone(fields.timezone);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  }

  return (
    <div className="relative min-h-[100dvh] overflow-hidden forge-bg-glow">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -right-32 top-0 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.07),transparent_68%)] blur-2xl" />
      </div>

      {/* Badge unlock toast */}
      <AnimatePresence>
        {showUnlock && newlyUnlocked.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl border border-[rgba(245,158,11,0.4)] bg-[rgba(245,158,11,0.1)] px-5 py-3 backdrop-blur-xl shadow-2xl"
          >
            <span className="text-xl">{newlyUnlocked[0]?.icon}</span>
            <div>
              <p className="text-xs font-bold text-amber-400">Badge Unlocked!</p>
              <p className="text-[11px] text-[var(--foreground-muted)]">{newlyUnlocked[0]?.name}</p>
            </div>
          </motion.div>
        )}
        {saveSuccess && (
          <motion.div
            key="save-success"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-3 backdrop-blur-xl shadow-2xl"
          >
            <span className="text-xl">✅</span>
            <p className="text-xs font-bold text-emerald-400">Profile saved!</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit profile modal */}
      <AnimatePresence>
        {showEdit && (
          <EditProfileModal
            initial={{ name: localName, bio: localBio, timezone: localTimezone }}
            onClose={() => setShowEdit(false)}
            onSave={handleSaveProfile}
          />
        )}
      </AnimatePresence>

      <main className="relative z-10 mx-auto max-w-2xl px-4 py-10">
        <PageTransition>
          <header className="mb-8 flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--foreground-subtle)]">Identity</p>
              <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-[var(--foreground)] sm:text-3xl">
                <User size={22} className="text-[#A78BFA]" /> Profile
              </h1>
            </div>
            <Link
              to="/shop"
              className="flex items-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-500/20 transition-colors"
            >
              <ShoppingBag size={13} />
              Coin Shop
            </Link>
          </header>

          {loading && (
            <div className="flex h-48 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[rgba(124,58,237,0.3)] border-t-[#7C3AED]" />
            </div>
          )}

          {!loading && status === "unauthenticated" && (
            <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-8 text-center">
              <p className="text-[var(--foreground-muted)] text-sm">Sign in to see your profile.</p>
            </div>
          )}

          {!loading && status === "authenticated" && wallet && (
            <div className="space-y-6">
              {/* User info card */}
              <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-5 backdrop-blur-xl">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] flex items-center justify-center text-xl font-black text-white shrink-0">
                    {(localName?.slice(0, 1) || user?.name?.slice(0, 1) || user?.email?.slice(0, 1) || "?").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[var(--foreground)] truncate">{localName || user?.name || user?.email?.split("@")[0] || "User"}</p>
                    <p className="text-xs text-[var(--foreground-subtle)] truncate">{user?.email || ""}</p>
                    {localBio && <p className="text-xs text-[#6B7280] mt-1 line-clamp-2">{localBio}</p>}
                    {localTimezone !== "UTC" && (
                      <p className="text-[10px] text-[var(--foreground-subtle)] mt-0.5 flex items-center gap-1">
                        <Globe size={9} /> {localTimezone}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="flex gap-3 text-center">
                      <div>
                        <p className="text-base font-bold text-[#A78BFA]">{wallet.coins.toLocaleString()}</p>
                        <p className="text-[9px] text-[var(--foreground-subtle)]">Coins</p>
                      </div>
                      {wallet.rank && (
                        <div>
                          <p className="text-base font-bold text-amber-400">#{wallet.rank}</p>
                          <p className="text-[9px] text-[var(--foreground-subtle)]">Rank</p>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setShowEdit(true)}
                      className="flex items-center gap-1.5 rounded-xl border border-[rgba(124,58,237,0.2)] px-2.5 py-1.5 text-[11px] font-medium text-[#7C3AED] hover:bg-[rgba(124,58,237,0.08)] transition-colors"
                    >
                      <Pencil size={11} /> Edit
                    </button>
                  </div>
                </div>
              </div>

              {/* Productivity Resume */}
              {user && wallet && stats && (
                <ProductivityResume 
                   userName={localName || user.name || "Focus User"}
                   totalFocusHours={Math.round(stats.totalMinutes / 60)}
                   avgFocusScore={stats.maxScore} // simplified
                   rank={`Level ${getLevel(wallet.totalXp)}`}
                   streak={stats.streak}
                   topMode="Flow"
                />
              )}

              {/* Level bar */}
              <LevelBar totalXp={wallet.totalXp} />

              {/* Quick stats */}
              {stats && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Sessions",    value: stats.sessions,                          color: "#A78BFA" },
                    { label: "Focus hours", value: `${Math.round(stats.totalMinutes / 60)}h`, color: "#06D6A0" },
                    { label: "Best streak", value: `${stats.streak}d`,                     color: "#F59E0B" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-3 text-center backdrop-blur-xl">
                      <p className="text-base font-bold" style={{ color }}>{value}</p>
                      <p className="text-[10px] text-[var(--foreground-subtle)]">{label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* XP this week */}
              <div className="rounded-2xl border border-[rgba(124,58,237,0.15)] bg-[rgba(124,58,237,0.04)] p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap size={16} className="text-[#A78BFA]" />
                  <span className="text-sm text-[var(--foreground-muted)]">Weekly XP</span>
                </div>
                <span className="text-sm font-bold text-[#A78BFA]">{wallet.weeklyXp.toLocaleString()} XP</span>
              </div>

              {/* Coin Wallet History */}
              {txHistory && (
                <div className="rounded-2xl border border-[rgba(255,184,0,0.12)] bg-[rgba(255,184,0,0.03)] p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
                      <Wallet size={14} className="text-amber-400" />
                      Coin Wallet
                    </h2>
                    <div className="flex gap-1">
                      {(["all", "earn", "spend"] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => setTxFilter(f)}
                          className={`rounded-lg px-2.5 py-1 text-[10px] font-medium transition-all capitalize ${txFilter === f ? "bg-amber-500/20 text-amber-400" : "text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)]"}`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Summary row */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { label: "Balance", value: `🪙 ${txHistory.currentBalance.toLocaleString()}`, color: "#F59E0B" },
                      { label: "Total earned", value: `+${txHistory.totalEarned.toLocaleString()}`, color: "#06D6A0" },
                      { label: "Total spent", value: `-${txHistory.totalSpent.toLocaleString()}`, color: "#F87171" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="rounded-xl border border-[var(--forge-border)] bg-[var(--card)] p-3 text-center">
                        <p className="text-sm font-bold tabular-nums" style={{ color }}>{value}</p>
                        <p className="text-[9px] text-[var(--foreground-subtle)] mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Transaction list */}
                  <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
                    {txHistory.transactions
                      .filter(t => txFilter === "all" || (txFilter === "earn" ? t.amount > 0 : t.amount < 0))
                      .slice(0, 30)
                      .map((tx, i) => {
                        const isEarn = tx.amount > 0;
                        const date = new Date(tx.createdAt);
                        const timeStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " + date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
                        return (
                          <motion.div
                            key={tx.id}
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.02 }}
                            className="flex items-center gap-3 rounded-xl border border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.02)] px-3 py-2.5"
                          >
                            <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${isEarn ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                              {isEarn ? <TrendingUp size={13} className="text-emerald-400" /> : <TrendingDown size={13} className="text-red-400" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-medium text-[#CBD5E1] truncate">{tx.description}</p>
                              <p className="text-[9px] text-[var(--foreground-subtle)]">{timeStr}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`text-[12px] font-bold tabular-nums ${isEarn ? "text-emerald-400" : "text-red-400"}`}>
                                {isEarn ? "+" : ""}{tx.amount.toLocaleString()} 🪙
                              </p>
                              <p className="text-[9px] text-[var(--foreground-subtle)]">bal: {tx.balanceAfter.toLocaleString()}</p>
                            </div>
                          </motion.div>
                        );
                      })}
                    {txHistory.transactions.filter(t => txFilter === "all" || (txFilter === "earn" ? t.amount > 0 : t.amount < 0)).length === 0 && (
                      <div className="flex flex-col items-center gap-2 py-8">
                        <History size={28} className="text-[#2D3748]" />
                        <p className="text-xs text-[var(--foreground-subtle)]">No transactions yet</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Badges section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
                    <Award size={14} className="text-amber-400" />
                    Badges
                    <span className="rounded-full bg-[rgba(124,58,237,0.15)] px-2 py-0.5 text-[10px] text-[#A78BFA]">
                      {unlockedCount}/{badges.length}
                    </span>
                  </h2>
                  <div className="flex gap-1">
                    {(["all", "unlocked", "locked"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`rounded-lg px-2.5 py-1 text-[10px] font-medium transition-all ${filter === f ? "bg-[rgba(124,58,237,0.2)] text-[#A78BFA]" : "text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)]"}`}
                      >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {filteredBadges.map((badge) => (
                    <BadgeCard key={badge.id} badge={badge} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </PageTransition>
      </main>
    </div>
  );
}
