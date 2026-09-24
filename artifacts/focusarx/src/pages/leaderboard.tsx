import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Trophy, Flame, Crown, Medal, RefreshCw, Shield, Users, Calendar, Timer } from "lucide-react";
import { Link } from "wouter";
import { getToken } from "@/lib/auth";
import { useNow } from "@/hooks/useNow";
import { PageTransition } from "@/components/PageTransition";
import { TiltCard } from "@/components/TiltCard";
import { ErrorState } from "@/components/ErrorState";
import { AdSlot } from "@/components/AdSlot";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  weeklyXp: number;
  totalXp: number;
  coins: number;
  streak: number;
  isPremium?: boolean;
  /** Display tier for AI rivals ("premium" | "standard") — set by the server. */
  botTier?: "premium" | "standard" | null;
  isAdmin?: boolean;
  isBot?: boolean;
  isCurrentUser: boolean;
}

type Filter = "weekly" | "total";
type Scope = "global" | "friends";

const AVATAR_GRADIENTS = [
  "from-[var(--brand-600)] to-[var(--palette-4f46e5)]",
  "from-[var(--brand-teal)] to-[var(--palette-0ea5e9)]",
  "from-[var(--color-warning)] to-[var(--color-error)]",
  "from-[var(--palette-ec4899)] to-[var(--brand-500)]",
  "from-[var(--palette-14b8a6)] to-[var(--color-info)]",
  "from-[var(--palette-f97316)] to-[var(--color-error)]",
];

function getAvatarGradient(name: string) {
  return AVATAR_GRADIENTS[name.charCodeAt(0) % AVATAR_GRADIENTS.length]!;
}

/**
 * Who you are looking at, at a glance.
 *
 * A leaderboard full of identical names is not a competition — it is a list.
 * Every row now declares its character: staff, an AI rival, and for rivals
 * whether they are on the premium track. The tier comes from the server and is
 * deterministic, so a rival's badge never flickers between page loads.
 */
/**
 * Who you are looking at, at a glance.
 *
 * Staff get a badge. Synthetic rivals do **not** — a "🤖 AI rival" label on a
 * leaderboard turns a competitive board into a disclaimer, and it tells every
 * visitor which entries are not real, which is exactly the detail that makes the
 * ranking feel like padding. Training partners compete under their names, and
 * the only roles worth surfacing are human ones.
 */
function NameBadges({ entry }: { entry: LeaderboardEntry }) {
  if (!entry.isAdmin) return null;
  return (
    <span
      className="ml-1.5 inline-flex items-center gap-0.5 rounded-full border border-[var(--rgba-239-68-68-0_35)] bg-[var(--rgba-239-68-68-0_12)] px-1.5 py-px text-[11px] font-semibold uppercase tracking-wider text-[var(--color-error)]"
      title="FocusArx team"
    >
      <Shield size={7} /> Admin
    </span>
  );
}

const RANK_META = {
  1: { crown: "var(--brand-gold)", glow: "var(--rgba-255-184-0-0_35)", bg: "from-[var(--rgba-255-184-0-0_12)] to-[var(--rgba-255-184-0-0_02)]", border: "var(--rgba-255-184-0-0_3)",  height: "h-28" },
  2: { crown: "var(--palette-c0c0c0)", glow: "var(--rgba-192-192-192-0_25)", bg: "from-[var(--rgba-192-192-192-0_1)] to-[var(--rgba-192-192-192-0_02)]", border: "var(--rgba-192-192-192-0_22)", height: "h-24" },
  3: { crown: "var(--palette-cd7f32)", glow: "var(--rgba-205-127-50-0_25)", bg: "from-[var(--rgba-205-127-50-0_1)] to-[var(--rgba-205-127-50-0_02)]", border: "var(--rgba-205-127-50-0_22)", height: "h-20" },
};

/**
 * Milliseconds until the weekly board resets.
 *
 * Weekly XP is server-owned and resets on Monday, so this is a display of a
 * boundary that already exists rather than a timer we control.
 */
export function msUntilWeeklyReset(now: number): number {
  const date = new Date(now);
  const day = date.getDay(); // 0 = Sun, 1 = Mon
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  const next = new Date(date);
  next.setDate(date.getDate() + daysUntilMonday);
  next.setHours(0, 0, 0, 0);
  return Math.max(0, next.getTime() - now);
}

/** "2d 5h" / "13h 20m" — coarser as the interval grows, so the string is stable
 * enough to read rather than a digit flickering every second. */
export function formatCountdown(remainingMs: number): string {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return "resetting now";
  const totalMinutes = Math.floor(remainingMs / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${minutes}m`;
}

/**
 * The reset chip, subscribing to the shared 1 Hz clock.
 *
 * This used to be a page-local `setInterval` writing to page state, so every
 * second re-rendered the entire board — the podium, all 200 rows and their
 * framer-motion wrappers — to update four characters. `useNow` serves every
 * live clock in the app from one interval, and putting the subscription in a
 * child means a tick re-renders the chip, not the page.
 */
function WeeklyResetChip() {
  const now = useNow();
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--rgba-6-214-160-0_2)] bg-[var(--rgba-6-214-160-0_06)] px-3 py-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-teal)]">Weekly reset</span>
      {/*
        `useNow` is null during the prerender, because the build has no clock
        and no business baking a countdown into static HTML that would be stale
        the moment it was served. The chip renders with a dash and fills in on
        hydration — the same shape in both, so nothing shifts.
      */}
      <span className="text-[11px] font-bold text-[var(--brand-teal)]" data-testid="reset-countdown">
        {now === null ? "—" : formatCountdown(msUntilWeeklyReset(now))}
      </span>
    </div>
  );
}

function PodiumCard({ entry, podiumRank, filter }: { entry: LeaderboardEntry; podiumRank: 1 | 2 | 3; filter: Filter }) {
  const meta = RANK_META[podiumRank];
  const xp = filter === "weekly" ? entry.weeklyXp : entry.totalXp;

  return (
    <TiltCard intensity={podiumRank === 1 ? 12 : 8}>
    <motion.div
      initial={{ opacity: 0, y: 20 + podiumRank * 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: podiumRank === 1 ? 0 : podiumRank === 2 ? 0.1 : 0.15, type: "spring", stiffness: 300, damping: 28 }}
      className={`relative flex flex-col items-center rounded-2xl border bg-gradient-to-b p-4 text-center h-full ${entry.isCurrentUser ? "ring-2 ring-[var(--brand-600)]" : ""}`}
      style={{
        background: `linear-gradient(to bottom, ${meta.bg.replace("from-", "").replace("to-", "").split("]")[0].trim()})`,
        borderColor: meta.border,
        boxShadow: `0 0 20px ${meta.glow}`,
      }}
    >
      {/* Rank-1 floating particles */}
      {podiumRank === 1 && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          {[...Array(6)].map((_, j) => (
            <motion.div
              key={j}
              className="absolute h-1 w-1 rounded-full"
              style={{ background: meta.crown, left: `${12 + j * 15}%`, top: `${8 + (j % 3) * 25}%` }}
              animate={{ y: [0, -10, 0], opacity: [0.3, 0.9, 0.3] }}
              transition={{ repeat: Infinity, duration: 2.2 + j * 0.25, delay: j * 0.18 }}
            />
          ))}
        </div>
      )}

      {/* Avatar */}
      <div
        className={`relative mb-2 flex ${podiumRank === 1 ? "h-14 w-14" : "h-11 w-11"} items-center justify-center rounded-full bg-gradient-to-br ${getAvatarGradient(entry.name)} font-bold text-[var(--palette-white)] shadow-lg`}
        style={{ fontSize: podiumRank === 1 ? "15px" : "12px" }}
      >
        {entry.name.slice(0, 2).toUpperCase()}
        {/* Crown */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Crown size={podiumRank === 1 ? 18 : 14} style={{ color: meta.crown, filter: `drop-shadow(0 0 4px ${meta.glow})` }} />
        </div>
      </div>

      {/* Rank number */}
      <div className="mb-0.5 flex items-center justify-center">
        <span className="text-[11px] font-semibold" style={{ color: meta.crown }}>#{podiumRank}</span>
      </div>

      {/* Name */}
      <p className="max-w-[80px] truncate text-xs font-bold text-[var(--foreground)]">{entry.name}</p>
      {entry.isAdmin && <NameBadges entry={entry} />}
      {entry.isCurrentUser && <span className="text-[11px] text-[var(--brand-400)]">(you)</span>}

      {/* XP */}
      <p className="mt-1.5 text-base font-semibold" style={{ color: "var(--brand-400)" }}>
        {xp.toLocaleString()}
        <span className="ml-0.5 text-[11px] font-normal text-[var(--foreground-subtle)]">XP</span>
      </p>

      {/* Streak */}
      <div className="mt-1 flex items-center gap-1 text-[11px] text-[var(--palette-f97316)]">
        <Flame size={9} />
        {entry.streak}d
      </div>
    </motion.div>
    </TiltCard>
  );
}

export default function LeaderboardPage() {
  const [filter, setFilter] = useState<Filter>("weekly");
  const [scope, setScope] = useState<Scope>("global");
  const [nonce, setNonce] = useState(0);
  const loadLeaderboard = useCallback(() => setNonce((n) => n + 1), []);

  /**
   * Identifies the board currently being asked for.
   *
   * Loading state is *derived* from this rather than tracked in a second piece
   * of state. Setting `loading = true` at the top of the fetch effect is a
   * synchronous state update during the effect — React rejects it because it
   * renders a frame that is neither the old board nor the new one — and the
   * usual workarounds (`setTimeout(…, 0)`, a ref) only hide the extra render.
   * Comparing keys means there is nothing to set: a board whose key does not
   * match the request is by definition not loaded yet.
   */
  const requestKey = `${filter}|${scope}|${nonce}`;
  const [board, setBoard] = useState<{ key: string; entries: LeaderboardEntry[]; failed: boolean } | null>(null);
  const loading = board?.key !== requestKey;
  const fetchError = !loading && board?.failed === true;
  const entries = board && board.key === requestKey ? board.entries : [];

  /**
   * Load the board for the current filter, scope and refresh count.
   *
   * The cancellation flag matters even with the key check: switching from "This
   * Week" to "All Time" starts a second request, and without it the slower of
   * the two would win the `setBoard` race. The key check alone would hide that,
   * but the wasted render and the wrong `entries` for one frame would not be.
   */
  useEffect(() => {
    let cancelled = false;
    const token = getToken();
    (async () => {
      try {
        const res = await fetch(
          `/api/social/leaderboard?period=${filter}&scope=${scope}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: unknown = await res.json();
        if (cancelled) return;
        setBoard({ key: requestKey, entries: Array.isArray(data) ? (data as LeaderboardEntry[]) : [], failed: false });
      } catch {
        if (cancelled) return;
        setBoard({ key: requestKey, entries: [], failed: true });
      }
    })();
    return () => {
      cancelled = true;
    };
    // `requestKey` covers filter, scope and nonce; the fetch itself reads
    // filter and scope, both of which it is derived from.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  /**
   * Display order, by the **server's** rank.
   *
   * This page used to renumber everyone from 1 over the rows it received, which
   * discarded the one number the server computes carefully: the API caps the
   * board at 200 rows but always appends the viewer with their true rank, even
   * past the cut. Renumbering turned a user genuinely ranked 4,812 into
   * "rank 201" — a wrong number presented with complete confidence, and one
   * that never moves, because 201 is where everyone outside the cut lands.
   *
   * Sorting by `rank` instead of by XP also keeps the server's tie order, so
   * two people on the same XP cannot swap places between a refresh.
   */
  const byRank = [...entries].sort((a, b) => a.rank - b.rank);
  const viewer = byRank.find((e) => e.isCurrentUser) ?? null;
  const top3 = byRank.filter((e) => e.rank <= 3).slice(0, 3);
  const podiumOrder = top3.length === 3 ? [top3[1]!, top3[0]!, top3[2]!] : top3;
  const podiumRanks: (1 | 2 | 3)[] = top3.length === 3 ? [2, 1, 3] : [1, 2, 3];

  /**
   * Is the viewer's rank inside the rows the server actually ranked?
   *
   * Membership of the returned array is the wrong test: the API appends the
   * viewer to *every* response, even one where their true rank is far past the
   * cut, precisely so the client can tell them where they are. Their presence
   * says nothing about whether they earned a place in it.
   *
   * Board ranks are contiguous from 1, so a rank greater than the number of rows
   * returned cannot be one of them. `viewer.rank <= byRank.length` is the honest
   * test, and it still puts a viewer at rank 201 of 201 rows in the list, where
   * they belong — they are one place off the cut, not far down the board.
   */
  const viewerInList = Boolean(viewer && viewer.rank <= byRank.length);

  /** Rows for the list. A viewer past the cut is shown by the standing block
   * instead, so their row is not also printed after rank 200 — which would read
   * as adjacency to it. */
  const rest = byRank.filter((e) => e.rank > 3 && (viewerInList || !e.isCurrentUser));

  /** The nearest row above the viewer, for the gap. Only known if both are visible. */
  const viewerIndex = viewer ? byRank.findIndex((e) => e.isCurrentUser) : -1;
  const rowAbove = viewerIndex > 0 ? byRank[viewerIndex - 1]! : null;
  const myXp = viewer ? (filter === "weekly" ? viewer.weeklyXp : viewer.totalXp) : 0;
  const gapToNext = rowAbove ? Math.max(0, (filter === "weekly" ? rowAbove.weeklyXp : rowAbove.totalXp) - myXp) : 0;

  return (
    <div className="relative min-h-[100dvh] overflow-hidden">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
      </div>

      <main id="main-content" className="relative z-[var(--z-content)] mx-auto max-w-3xl px-4 py-10">
        <PageTransition>

          {/* Header */}
          <header className="mb-6 flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--foreground-subtle)]">Rankings</p>
              <h1 className="mt-1 flex items-center gap-2.5 text-2xl font-bold text-[var(--foreground)] sm:text-3xl">
                <Trophy size={26} className="text-[var(--brand-gold)]" aria-hidden />
                Leaderboard
              </h1>
            </div>
            <button
              onClick={loadLeaderboard}
              disabled={loading}
              aria-label="Refresh leaderboard"
              className="mt-1 rounded-xl border border-[var(--rgba-124-58-237-0_2)] bg-[var(--rgba-124-58-237-0_07)] p-2 text-[var(--muted-fg)] transition-all hover:border-[var(--rgba-124-58-237-0_4)] hover:text-[var(--brand-400)] disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </header>

          {/* Weekly reset chip */}
          <div className="mb-5 flex flex-wrap items-center gap-3">
            {filter === "weekly" ? <WeeklyResetChip /> : (
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--rgba-124-58-237-0_2)] bg-[var(--rgba-124-58-237-0_06)] px-3 py-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">All time</span>
                <span className="text-[11px] text-[var(--foreground-subtle)]">never resets</span>
              </div>
            )}
            {fetchError && (
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--rgba-239-68-68-0_25)] bg-[var(--rgba-239-68-68-0_06)] px-3 py-1">
                <Medal size={10} className="text-[var(--color-error)]" />
                <p className="text-[11px] text-[var(--color-error)]">Could not load rankings</p>
              </div>
            )}

          </div>

          {/* Filter tabs */}
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-xl border border-[var(--rgba-124-58-237-0_2)] bg-[var(--rgba-16-23-50-0_7)] p-1">
              {(["weekly", "total"] as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  aria-pressed={filter === f}
                  className={`rounded-lg px-5 py-1.5 text-xs font-semibold capitalize transition-all duration-[var(--duration-fast)] ${ filter === f ? "bg-[var(--brand-600)] text-[var(--palette-white)]" : "text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)]" }`}
                >
                  {f === "weekly" ? "🗓 This Week" : "🏆 All Time"}
                </button>
              ))}
            </div>
            <div className="inline-flex rounded-xl border border-[var(--rgba-124-58-237-0_2)] bg-[var(--rgba-16-23-50-0_7)] p-1">
              {(["global", "friends"] as Scope[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  aria-pressed={scope === s}
                  className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold transition-all duration-[var(--duration-fast)] ${ scope === s ? "bg-[var(--brand-600)] text-[var(--palette-white)]" : "text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)]" }`}
                >
                  {s === "global" ? <Trophy size={11} /> : <Users size={11} />}
                  {s === "global" ? "Everyone" : "My friends"}
                </button>
              ))}
            </div>
          </div>

          {fetchError ? (
            <ErrorState title="Rankings unavailable" onRetry={loadLeaderboard} />
          ) : loading ? (
            <div className="flex h-52 items-center justify-center" role="status" aria-label="Loading leaderboard">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--rgba-124-58-237-0_3)] border-t-[var(--brand-600)]" />
            </div>
          ) : byRank.length === 0 ? (
            /*
              An empty board used to be two lines of grey text in a large box —
              and it promised "AI rivals", which stopped being true when the
              synthetic-rival badges came off the rows. A student who opens the
              leaderboard and finds nothing learns nothing: not how ranking
              works, not what one session would do, not whether anyone else is
              here. So the empty state now explains the mechanic it is asking
              them to join, and gives them the one button that changes it.
            */
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-8 text-center">
              <Trophy size={36} className="mx-auto mb-3 text-[var(--brand-400)]" aria-hidden="true" />
              <h2 className="text-base font-semibold text-[var(--foreground)]">The board opens with your first session</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--foreground-muted)]">
                Everyone here is ranked on the same two numbers: the XP a session pays
                (20 per minute, so a 25-minute block is 500) and the streak you keep.
                Nothing to buy, nothing to unlock — the board is just who is doing
                the work this week.
              </p>
              <div className="mx-auto mt-5 grid max-w-lg gap-3 text-left sm:grid-cols-3">
                {[
                  { icon: <Timer size={16} />, title: "One block", body: "25 minutes enters you at rank 1." },
                  { icon: <Flame size={16} />, title: "Keep the streak", body: "Streak bonuses compound daily." },
                  { icon: <Calendar size={16} />, title: "Resets weekly", body: "A bad week never haunts you." },
                ].map((item) => (
                  <div key={item.title} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3">
                    <span className="mb-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand-400)]" aria-hidden="true">
                      {item.icon}
                    </span>
                    <p className="text-xs font-semibold text-[var(--foreground)]">{item.title}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-[var(--foreground-subtle)]">{item.body}</p>
                  </div>
                ))}
              </div>
              <Link
                href="/focus"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--brand-600)] px-5 py-2.5 text-sm font-semibold text-[var(--neutral-0)] transition-colors hover:bg-[var(--brand-700)]"
              >
                <Timer size={15} aria-hidden="true" /> Start a 25-minute block
              </Link>
            </div>
          ) : (
            <div className="space-y-4">

              {/* Podium (2-1-3 order for visual height hierarchy) */}
              {top3.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:gap-3 items-end">
                  {podiumOrder.map((entry, i) => (
                    <PodiumCard
                      key={entry.userId}
                      entry={entry}
                      podiumRank={podiumRanks[i]!}
                      filter={filter}
                    />
                  ))}
                </div>
              )}

              {/* List rows (rank 4+) */}
              {rest.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-[var(--rgba-124-58-237-0_12)]">
                  {rest.map((entry, i) => (
                    <motion.div
                      key={entry.userId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.04 }}
                      className={`flex items-center gap-3 px-4 py-3 transition-colors ${ entry.isCurrentUser ? "bg-[var(--rgba-124-58-237-0_1)] border-l-2 border-[var(--brand-600)]" : "hover:bg-[var(--rgba-124-58-237-0_04)]" } ${i < rest.length - 1 ? "border-b border-[var(--rgba-124-58-237-0_07)]" : ""}`}
                    >
                      <span className="w-6 text-center text-xs font-semibold text-[var(--foreground-subtle)]">{entry.rank}</span>
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarGradient(entry.name)} text-[11px] font-bold text-[var(--palette-white)]`}
                      >
                        {entry.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                          {entry.name}
                          <NameBadges entry={entry} />
                          {entry.isPremium && <Crown size={10} className="ml-1 inline text-[var(--brand-gold)]" aria-label="Premium" />}
                          {entry.isCurrentUser && <span className="ml-1.5 text-[11px] font-normal text-[var(--brand-400)]">(you)</span>}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-0.5 text-[11px] text-[var(--palette-f97316)]">
                            <Flame size={9} />{entry.streak}d
                          </span>
                          <span className="text-[11px] text-[var(--brand-gold)]">🪙{entry.coins.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-[var(--brand-400)]">
                          {(filter === "weekly" ? entry.weeklyXp : entry.totalXp).toLocaleString()}
                        </p>
                        <p className="text-[11px] text-[var(--foreground-subtle)]">XP</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/*
                Your standing.
                
                Rendered whenever the viewer is not among the rows above — which
                is the whole point of the block. It used to be conditioned on a
                renumbered rank exceeding the list length, a comparison that
                could never be true, so the one row a user outside the top 200
                needs was never shown.
              */}
              {viewer && !viewerInList ? (
                <div
                  className="rounded-2xl border border-[var(--brand-600)] bg-[var(--rgba-124-58-237-0_09)] p-4"
                  data-testid="your-standing"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-12 shrink-0 text-xs font-semibold text-[var(--brand-400)]">
                      #{viewer.rank.toLocaleString()}
                    </span>
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarGradient(viewer.name)} text-xs font-bold text-[var(--palette-white)]`}>
                      {viewer.name.slice(0, 2).toUpperCase()}
                    </div>
                    <p className="flex-1 text-sm font-semibold text-[var(--foreground)]">
                      You
                      <span className="ml-1.5 text-[11px] font-normal text-[var(--foreground-subtle)]">
                        outside the top {rest.length + top3.length}
                      </span>
                    </p>
                    <p className="text-sm font-bold text-[var(--brand-400)]">{myXp.toLocaleString()} XP</p>
                  </div>
                  <p className="mt-2 text-xs text-[var(--foreground-subtle)]">
                    Complete a session to close the gap — this is your real position on the board, not your place
                    on this page.
                  </p>
                </div>
              ) : null}

              {/*
                The gap to the next place.
                
                A rank on its own does not tell you what to do. "83 XP to pass
                the person above you" does, and the distance is the only number
                on this page a session can change in one sitting.
              */}
              {viewer && viewerInList && rowAbove && gapToNext > 0 ? (
                <div className="rounded-2xl border border-[var(--rgba-124-58-237-0_12)] bg-[var(--rgba-16-23-50-0_4)] px-4 py-3" data-testid="gap-to-next">
                  <p className="text-xs text-[var(--foreground-subtle)]">
                    <span className="font-semibold text-[var(--brand-400)]">{gapToNext.toLocaleString()} XP</span>{" "}
                    to pass {rowAbove.name} and take #{Math.max(1, viewer.rank - 1)}
                  </p>
                </div>
              ) : null}

              {/*
                A board that is only ever you.
                
                The empty-state copy promises AI rivals, so a global board with
                one row would read as broken. It happens on a fresh friends
                board where nobody has followed anyone yet, which is precisely
                when the user needs to be told what to do about it.
              */}
              {scope === "friends" && byRank.length <= 1 ? (
                <div className="rounded-2xl border border-[var(--rgba-124-58-237-0_15)] bg-[var(--rgba-16-23-50-0_5)] p-6 text-center">
                  <Users size={28} className="mx-auto mb-2 text-[var(--foreground-subtle)]" />
                  <p className="text-sm text-[var(--muted-fg)]">Nobody else is here yet.</p>
                  <p className="mt-1 text-xs text-[var(--foreground-subtle)]">
                    Follow people from the community feed and they will appear on this board.
                  </p>
                </div>
              ) : null}

            </div>
          )}

        </PageTransition>

        {/* Ad below the board — outside the interactive ranking table. */}
        <div className="mx-auto mt-10 max-w-3xl px-4 sm:px-6">
          <AdSlot name="leaderboardBottom" minHeight={250} />
        </div>
      </main>
    </div>
  );
}
