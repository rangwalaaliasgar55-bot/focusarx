import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { getToken } from "@/lib/auth";
import { ArrowUpRight, ArrowDownLeft, Coins, Zap, TrendingUp, Calendar } from "lucide-react";
import { PAGE, CARD, STAGGER } from "@/lib/animations";
import { TiltCard, StaggerContainer, StaggerItem } from "@/components/TiltCard";

function authHeaders() {
  const t = getToken();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (t) h["Authorization"] = `Bearer ${t}`;
  return h;
}

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

export default function WalletPage() {
  const [wallet, setWallet] = useState<any>(null);
  const [txs, setTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [wr, tr] = await Promise.all([
          fetch("/api/gamification/wallet", { headers: authHeaders() }),
          fetch(`/api/gamification/wallet/transactions?page=${page}&limit=20`, { headers: authHeaders() }),
        ]);
        if (wr.ok) setWallet(await wr.json());
        if (tr.ok) {
          const data = await tr.json();
          setTxs(prev => page === 1 ? (data.transactions ?? data) : [...prev, ...(data.transactions ?? data)]);
          setHasMore(!!(data.hasMore ?? false));
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [page]);

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
                  <motion.span className="text-xl" whileHover={{ scale: 1.3, rotate: 15 }} transition={{ type: "spring", stiffness: 400 }}>🪙</motion.span>
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
                  <motion.span className="text-xl" animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}>🏅</motion.span>
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
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>
          </div>
        )}

        {/* Transactions */}
        <div>
          <h2 className="text-sm font-semibold text-[var(--foreground-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Calendar size={13} /> Transaction History
          </h2>
          {loading && page === 1 ? (
            <div className="py-8 flex justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--palette-zinc-700)] border-t-[var(--brand-600)]" />
            </div>
          ) : txs.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-3 text-center">
              <Coins size={32} className="text-[var(--foreground-subtle)]" />
              <p className="text-sm text-[var(--foreground-subtle)]">No transactions yet. Complete sessions to earn coins!</p>
            </div>
          ) : (
            <motion.div variants={STAGGER} initial="initial" animate="animate" className="space-y-2">
              {txs.map((tx: any, i: number) => (
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
                <button onClick={() => setPage(p => p + 1)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--muted)] py-2.5 text-xs text-[var(--muted-fg)] hover:text-[var(--foreground-muted)] transition-colors">
                  Load more…
                </button>
              )}
            </motion.div>
          )}
        </div>
      </motion.div>
    </PageTransition>
  );
}
