import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSiteSettings } from "@/lib/site-settings";
import { X } from "lucide-react";

/**
 * Site-wide announcement banner, fully controlled by an admin from the
 * admin panel (title/text/emoji). Dismissible per-session by the user.
 */
export function AnnouncementBanner() {
  const settings = useSiteSettings();
  const [dismissed, setDismissed] = useState(false);

  if (!settings.announcementEnabled || dismissed) return null;

  const title = settings.announcementTitle;
  const text = settings.announcementText;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="relative z-[var(--z-modal)] overflow-hidden border-b border-[var(--brand-600)]/30 bg-gradient-to-r from-[var(--brand-600)]/15 via-[var(--palette-4f46e5)]/10 to-[var(--brand-600)]/15 backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
          {settings.announcementEmoji && <span className="text-lg">{settings.announcementEmoji}</span>}
          <div className="min-w-0 flex-1">
            {title && <p className="text-xs font-bold text-[var(--brand-400)]">{title}</p>}
            {text && <p className="truncate text-xs text-[var(--foreground-muted)]">{text}</p>}
          </div>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss announcement"
            className="shrink-0 rounded-lg p-1 text-[var(--foreground-subtle)] transition-colors hover:bg-[var(--palette-white)]/5 hover:text-[var(--foreground)]"
          >
            <X size={14} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
