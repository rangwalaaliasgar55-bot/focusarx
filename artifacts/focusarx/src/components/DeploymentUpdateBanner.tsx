/**
 * Deployment update notification banner.
 *
 * Shows a non-destructive notification when a new deployment is detected, asking
 * the user to refresh. Never auto-refreshes on its own — the reload decision
 * belongs to reloadCoordinator, which owns the budget and the cache purge.
 *
 * Two extra states matter, both learned the hard way:
 *
 *   • `reloadBlocked` — the reload budget for this window is spent. Offering an
 *     "Update now" button here is a lie: clicking it does nothing, and that is
 *     exactly how users ended up mashing refresh. The banner says the update
 *     will apply on the next visit instead.
 *   • `reloadIneffective` — we just came back from a reload that delivered the
 *     same build. Same treatment: no button, and no repeat attempts.
 */
import { useDeploymentSkew } from "@/lib/deploymentSkew";
import { RefreshCw, X, CloudDownload } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function DeploymentUpdateBanner() {
  const { mismatch, serverVersion, frontendVersion, dismiss, refresh, reloadBlocked, reloadIneffective } =
    useDeploymentSkew();

  const cannotRefresh = reloadBlocked || reloadIneffective;

  return (
    <AnimatePresence>
      {mismatch && (
        <motion.div
          initial={{ y: -50 }}
          animate={{ y: 0 }}
          exit={{ y: -50 }}
          className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-3 shadow-lg"
          role="alert"
          aria-live="polite"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {cannotRefresh ? (
                <CloudDownload className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              ) : (
                <RefreshCw className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              )}
              <div>
                <p className="font-medium text-sm">New version available</p>
                <p className="text-xs text-blue-50 hidden sm:block">
                  {cannotRefresh
                    ? "We couldn't switch you over automatically. The latest version will load on your next visit — nothing you've done is lost."
                    : "A new version of FocusArx has been deployed. Refresh to get the latest features and fixes."}
                  {!cannotRefresh && serverVersion && frontendVersion && (
                    <span className="ml-1 opacity-80 tabular-nums">
                      ({frontendVersion.slice(0, 7)} → {serverVersion.slice(0, 7)})
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!cannotRefresh && (
                <button
                  type="button"
                  onClick={refresh}
                  className="px-4 py-1.5 bg-white text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600"
                >
                  Update now
                </button>
              )}
              <button
                type="button"
                onClick={dismiss}
                className="p-1.5 hover:bg-blue-500 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-white"
                aria-label="Dismiss update notification"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
