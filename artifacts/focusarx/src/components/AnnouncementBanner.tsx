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
        <div className="mx-auto flex max-w-7xl items-start gap-2.5 px-3 py-2.5 sm:items-center sm:gap-3 sm:px-4">
          {settings.announcementEmoji && <span className="mt-0.5 text-base leading-none sm:mt-0 sm:text-lg">{settings.announcementEmoji}</span>}
          <div className="min-w-0 flex-1">
            {title && <p className="text-xs font-bold leading-snug text-[var(--brand-400)]">{title}</p>}
            {text && <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-[var(--foreground-muted)] sm:line-clamp-1">{text}</p>}
          </div>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss announcement"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--foreground-subtle)] transition-colors hover:bg-[var(--palette-white)]/5 hover:text-[var(--foreground)]"
          >
            <X size={14} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
