import { useEffect, useState } from "react";
import { safeGet, safeSet } from "@/lib/safeStorage";
import { isInAppWebView } from "@/lib/deviceTier";

const DISMISS_KEY = "focusarx-inapp-pill-dismissed";
const SESSIONS_KEY = "focusarx-sessions-completed";

/**
 * In-app WebView guidance (Phase 6.3).
 *
 * Instagram/TikTok in-app browsers break install prompts, push and
 * background timers. Everything must still work without leaving — so this is
 * ONE dismissible pill, shown only inside an in-app WebView and only after
 * the first completed session (never before value is proven).
 */
export function InAppBrowserPill() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isInAppWebView(navigator.userAgent || "")) return;
    if (safeGet(DISMISS_KEY) === "1") return;
    const completed = Number.parseInt(safeGet(SESSIONS_KEY) || "0", 10);
    if (Number.isFinite(completed) && completed >= 1) {
      const t = window.setTimeout(() => setVisible(true), 1500);
      return () => window.clearTimeout(t);
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[var(--z-toast)] flex justify-center px-4"
    >
      <div className="glass flex min-h-[44px] max-w-md items-center gap-3 rounded-2xl px-4 py-2.5 text-[13px] text-[var(--foreground-muted)]">
        <span className="flex-1">
          For alerts and offline mode, open FocusArx in Chrome or Safari.
        </span>
        <button
          type="button"
          onClick={() => {
            safeSet(DISMISS_KEY, "1");
            setVisible(false);
          }}
          className="min-h-[44px] min-w-[44px] shrink-0 rounded-full px-2 font-semibold text-[var(--brand-strong)]"
          aria-label="Dismiss browser suggestion"
        >
          OK
        </button>
      </div>
    </div>
  );
}
