
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, AlertTriangle, RefreshCw } from "lucide-react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";

export function NetworkStatusBanner() {
  const { isOffline, isSlow } = useNetworkStatus();
  const { queueCount, syncing, processQueue, summary, retryAll, persistenceFailed } = useOfflineQueue();

  const showOffline = isOffline;
  const showSlow = isSlow && !isOffline;
  // A stalled queue takes precedence over the ordinary "waiting to sync" pill,
  // because it is the state where nothing will happen without the user.
  const showStalled = queueCount > 0 && summary.needsAttention > 0 && !isOffline;
  const showQueue = queueCount > 0 && !isOffline && !showStalled;
  // Surfaced because the in-memory queue means a reload loses the session.
  const showPersistenceWarning = persistenceFailed && queueCount > 0;

  if (!showOffline && !showSlow && !showQueue && !showStalled && !showPersistenceWarning) return null;

  return (
    <div className="pointer-events-none fixed left-0 right-0 top-0 z-[var(--z-toast)] flex flex-col items-center gap-2 p-3 pt-[calc(0.5rem+env(safe-area-inset-top))]">
      <AnimatePresence>
        {showOffline && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-full border border-[var(--warning)]/30 bg-[var(--warning-soft)] px-4 py-2.5 text-sm shadow-lg"
            role="status"
            aria-live="polite"
          >
            <WifiOff size={16} className="shrink-0 text-[var(--warning)]" />
            <span className="flex-1 text-xs font-medium leading-snug">
              You are offline. Your timer is still running. Progress will sync when you reconnect.
            </span>
          </motion.div>
        )}
        {showSlow && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] px-4 py-2 text-xs shadow-lg"
            role="status"
          >
            <AlertTriangle size={14} className="text-[var(--warning)]" />
            <span>Slow connection — saving locally</span>
          </motion.div>
        )}
        {showStalled && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-[var(--danger)]/30 bg-[var(--danger-soft,var(--warning-soft))] px-4 py-3 text-sm shadow-lg"
            role="alert"
          >
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[var(--danger)]" />
            <div className="flex-1">
              <p className="text-xs font-semibold leading-snug">
                {summary.needsAttention === 1
                  ? "1 session could not be saved"
                  : `${summary.needsAttention} sessions could not be saved`}
              </p>
              {/* The old queue deleted these after five failures and said
                  nothing. They are kept now, so the honest thing is to admit
                  they need a hand rather than let them sit here forever. */}
              <p className="mt-0.5 text-[11px] leading-snug text-[var(--foreground-subtle)]">
                Your data is safe on this device. Try again, or contact support if it keeps failing.
              </p>
              <button
                type="button"
                onClick={retryAll}
                className="mt-2 rounded-full bg-[var(--danger)] px-3 py-1 text-[11px] font-bold text-white"
              >
                Try again
              </button>
            </div>
          </motion.div>
        )}
        {showPersistenceWarning && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-full border border-[var(--warning)]/30 bg-[var(--surface-2)] px-4 py-2 text-xs shadow-lg"
            role="status"
          >
            <AlertTriangle size={14} className="shrink-0 text-[var(--warning)]" />
            <span>Keep this tab open — unsynced sessions are not saved to disk.</span>
          </motion.div>
        )}
        {showQueue && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-full border border-[var(--brand-500)]/20 bg-[var(--brand-soft)] px-4 py-2.5 text-sm shadow-lg"
            role="status"
            aria-live="polite"
          >
            <RefreshCw size={14} className={syncing ? "animate-spin text-[var(--brand-strong)]" : "text-[var(--brand-strong)]"} />
            <span className="flex-1 text-xs font-medium">
              {syncing ? "Syncing your progress…" : `${queueCount} session${queueCount > 1 ? "s" : ""} waiting to sync`}
            </span>
            {!syncing && (
              <button
                type="button"
                onClick={() => void processQueue()}
                className="rounded-full bg-[var(--brand-600)] px-3 py-1 text-[11px] font-bold text-white hover:bg-[var(--brand-700)]"
              >
                Sync now
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
