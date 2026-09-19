import { useState, useEffect } from "react";
import { ArrowDownLeft, ArrowUpRight, Calendar, Coins, Medal, TrendingUp, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { QueryError } from "@/components/ui/QueryError";
import { apiJson } from "@/lib/api";

import { PAGE, CARD, STAGGER } from "@/lib/animations";
import { TiltCard, StaggerContainer, StaggerItem } from "@/components/TiltCard";

function txIcon(type: string) {
  if (type.includes("earn") || type.includes("reward") || type.includes("bonus")) return <ArrowDownLeft size={14} className="text-[var(--palette-10b981)]" />;
  if (type.includes("spend") || type.includes("purchase") || type.includes("shop")) return <ArrowUpRight size={14} className="text-[var(--color-error)]" />;
  return <ArrowDownLeft size={14} className="text-[var(--brand-400)]" />;
}

function txColor(type: string) {
  if (type.includes("earn") || type.includes("reward") || type.includes("bonus")) return "text-[var(--palette-10b981)]";
  if (type.includes("spend") || type.includes("purchase") || type.includes("shop")) return "text-[var(--color-error)]";
  return "text-[var(--brand-400)]";
}

/**
 * A coin transaction, as `/api/gamification/wallet/transactions` returns it.
 *
 * Was `any[]`, which is how `tx.amount > 0 ? "+" : ""` silently rendered
 * "+undefined" the first time the field was renamed.
 */
interface WalletShape {
  coins: number;
  totalXp: number;
  weeklyXp: number;
  level: number;
}

interface TxRow {
  id: string;
  type?: string;
  amount: number;
  description?: string | null;
  createdAt?: string | null;
}

export default function WalletPage() {
  const [wallet, setWallet] = useState<WalletShape | null>(null);
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  /**
   * One page of transactions.
   *
   * `cursor` is null for the first page and opaque afterwards. The old code
   * sent `?page=N`, which the server ignored — it returned the newest 50 rows
   * every time — and gated "Load more…" on a `hasMore` the server never sent.
   * The button was therefore unreachable, and appending a second page would
   * have duplicated all 50 rows had it ever rendered.
   */
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [walletRes, txPage] = await Promise.all([
          apiJson<WalletShape>("/api/gamification/wallet"),
          apiJson<{ transactions?: TxRow[]; nextCursor?: string | null; hasMore?: boolean }>(
            `/api/gamification/wallet/transactions?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
          ),
        ]);
        if (cancelled) return;
        setWallet(walletRes);
        // When `transactions` is absent the response is not the shape we asked
        // for, and assuming `data` itself is an array is how a 404 body becomes
        // a list of garbage rows.
        const incoming = Array.isArray(txPage.transactions) ? txPage.transactions : [];
        setTxs((prev) => (cursor ? [...prev, ...incoming] : incoming));
        setHasMore(Boolean(txPage.hasMore));
        setNextCursor(txPage.nextCursor ?? null);
        setLoadError(false);
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [cursor, reloadKey]);

  const level = wallet?.level ?? 1;
  const xpStart = (level - 1) ** 2 * 100;
  const xpEnd = level ** 2 * 100;
  const xpProgress = wallet ? Math.min(1, (wallet.totalXp - xpStart) / Math.max(1, xpEnd - xpStart)) : 0;

  return (
    <PageTransition>
      <motion.div variants={PAGE} initial="initial" animate="animate" className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Wallet & XP</h1>

        {/* Stats row */}
        {wallet && (
          <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StaggerItem><TiltCard intensity={10}>
              <div className="rounded-2xl border border-[var(--rgba-245-158-11-0_2)] bg-[var(--rgba-245-158-11-0_06)] p-4 shadow-3d-violet">
                <div className="flex items-center gap-2 mb-2">
                  <motion.span className="text-xl" whileHover={{ scale: 1.3, rotate: 15 }} transition={{ type: "spring", stiffness: 400 }}><Coins size={16} aria-hidden="true" /></motion.span>
                  <span className="text-[11px] text-[var(--color-warning)] font-semibold uppercase tracking-wider">Coins</span>
                </div>
                <p className="text-2xl font-bold text-[var(--color-warning)]">{wallet.coins.toLocaleString()}</p>
              </div>
            </TiltCard></StaggerItem>
            <StaggerItem><TiltCard intensity={10}>
              <div className="rounded-2xl border border-[var(--rgba-124-58-237-0_2)] bg-[var(--rgba-124-58-237-0_06)] p-4 shadow-3d-violet">
                <div className="flex items-center gap-2 mb-2">
                  <motion.div whileHover={{ scale: 1.2, rotate: -10 }}><Zap size={14} className="text-[var(--brand-400)]" /></motion.div>
                  <span className="text-[11px] text-[var(--brand-400)] font-semibold uppercase tracking-wider">Total XP</span>
                </div>
                <p className="text-2xl font-bold text-[var(--brand-400)]">{wallet.totalXp.toLocaleString()}</p>
              </div>
            </TiltCard></StaggerItem>
            <StaggerItem><TiltCard intensity={10}>
              <div className="rounded-2xl border border-[var(--rgba-6-214-160-0_2)] bg-[var(--rgba-6-214-160-0_06)] p-4 shadow-3d-violet">
                <div className="flex items-center gap-2 mb-2">
                  <motion.div whileHover={{ scale: 1.2, y: -2 }}><TrendingUp size={14} className="text-[var(--brand-teal)]" /></motion.div>
                  <span className="text-[11px] text-[var(--brand-teal)] font-semibold uppercase tracking-wider">Weekly XP</span>
                </div>
                <p className="text-2xl font-bold text-[var(--brand-teal)]">{wallet.weeklyXp.toLocaleString()}</p>
              </div>
            </TiltCard></StaggerItem>
            <StaggerItem><TiltCard intensity={10}>
              <div className="rounded-2xl border border-[var(--rgba-255-184-0-0_2)] bg-[var(--rgba-255-184-0-0_06)] p-4 shadow-3d-violet">
                <div className="flex items-center gap-2 mb-2">
                  <motion.span className="text-xl" animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}><Medal size={16} aria-hidden="true" /></motion.span>
                  <span className="text-[11px] text-[var(--brand-gold)] font-semibold uppercase tracking-wider">Level</span>
                </div>
                <p className="text-2xl font-bold text-[var(--brand-gold)]">{wallet.level}</p>
              </div>
            </TiltCard></StaggerItem>
          </StaggerContainer>
        )}

        {/* XP bar */}
        {wallet && (
          <div className="rounded-2xl border border-[var(--rgba-124-58-237-0_15)] bg-[var(--muted)] p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-[var(--brand-400)]">Level {level} → {level + 1}</span>
              <span className="text-xs text-[var(--foreground-subtle)]">{wallet.totalXp - xpStart} / {xpEnd - xpStart} XP</span>
            </div>
            <div className="h-2 rounded-full bg-[var(--rgba-124-58-237-0_12)] overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[var(--brand-600)] to-[var(--brand-400)]"
                initial={{ width: 0 }}
                animate={{ width: `${Math.round(xpProgress * 100)}%` }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              />
            </div>
          </div>
        )}

        {/* Transactions */}
        <div>
          <h2 className="text-sm font-semibold text-[var(--foreground-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Calendar size={13} /> Transaction History
          </h2>
          {loading && !cursor ? (
            <div className="py-8 flex justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--palette-zinc-700)] border-t-[var(--brand-600)]" />
            </div>
          ) : loadError ? (
            <QueryError
              what="your wallet"
              onRetry={() => { setLoadError(false); setLoading(true); setCursor(null); setReloadKey((k) => k + 1); }}
            />
          ) : txs.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-3 text-center">
              <Coins size={32} className="text-[var(--foreground-subtle)]" />
              <p className="text-sm text-[var(--foreground-subtle)]">No transactions yet. Complete sessions to earn coins!</p>
            </div>
          ) : (
            <motion.div variants={STAGGER} initial="initial" animate="animate" className="space-y-2">
              {txs.map((tx, i) => (
                <motion.div key={tx.id ?? i} variants={CARD}
                  className="flex items-center gap-3 rounded-xl border border-[var(--rgba-255-255-255-0_04)] bg-[var(--muted)] px-4 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--muted)]">
                    {txIcon(tx.type ?? "")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[var(--foreground)] truncate">{tx.description ?? tx.type ?? "Transaction"}</p>
                    <p className="text-[11px] text-[var(--foreground-subtle)]">{tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : ""}</p>
                  </div>
                  <span className={`text-sm font-bold tabular-nums ${txColor(tx.type ?? "")}`}>
                    {tx.amount > 0 ? "+" : ""}{tx.amount} 🪙
                  </span>
                </motion.div>
              ))}
              {hasMore && (
                <button
                  onClick={() => { setLoadingMore(true); setCursor(nextCursor); }}
                  disabled={loadingMore}
                  aria-busy={loadingMore}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--muted)] py-2.5 text-xs text-[var(--muted-fg)] hover:text-[var(--foreground-muted)] transition-colors disabled:opacity-60"
                >
                  {loadingMore ? "Loading…" : "Load more…"}
                </button>
              )}
            </motion.div>
          )}
        </div>
      </motion.div>
    </PageTransition>
  );
}
