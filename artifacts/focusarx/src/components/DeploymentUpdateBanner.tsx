/**
 * Deployment update notification banner.
 *
 * Shows a non-destructive notification when a new deployment is detected,
 * asking the user to refresh. Does not auto-refresh to prevent losing
 * unsaved work.
 */
import { useDeploymentSkew } from "@/lib/deploymentSkew";
import { RefreshCw, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function DeploymentUpdateBanner() {
  const { mismatch, serverVersion, frontendVersion, dismiss, refresh } = useDeploymentSkew();

  return (
    <AnimatePresence>
      {mismatch && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-3 shadow-lg"
          role="alert"
          aria-live="polite"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">New version available</p>
                <p className="text-xs text-blue-100 hidden sm:block">
                  A new version of FocusArx has been deployed. Refresh to get the latest features and fixes.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={refresh}
                className="px-4 py-1.5 bg-white text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600"
              >
                Update now
              </button>
              <button
                onClick={dismiss}
                className="p-1.5 hover:bg-blue-500 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-white"
                aria-label="Dismiss update notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
