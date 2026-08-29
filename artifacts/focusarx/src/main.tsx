import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { getToken } from "@/lib/auth";
import { getTheme, applyTheme, registerPremiumChecker } from "@/lib/theme";
import { installChunkRecovery } from "@/lib/chunkRecovery";
import { logger } from "./lib/logger";

// Apply saved theme before first paint (prevents flash of wrong theme)
applyTheme(getTheme());

// Recover automatically from stale lazy chunks after a deploy instead of
// forcing the user to reload to reach a page.
installChunkRecovery();
// Keep the recent-reload guard in sessionStorage until it naturally expires.
// Clearing it before React renders can create a reload loop when a genuinely
// broken lazy chunk fails again during route hydration.

// Register premium checker so theme.ts can gate premium themes
registerPremiumChecker(async () => {
  try {
    const token = getToken();
    const res = await fetch("/api/premium/status", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.isPremium === true;
  } catch {
    return false;
  }
});

// Wire up the auth token so all Orval-generated hooks
// automatically attach Authorization: Bearer <token>
setAuthTokenGetter(() => getToken());

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").then((registration) => {
      // A tab left open for hours only revalidates sw.js on navigation, so it
      // can sit on an old build indefinitely. Poll for updates so a deploy
      // reaches open tabs on its own.
      setInterval(() => void registration.update().catch(() => {}), 5 * 60 * 1000);
      registration.addEventListener("updatefound", () => {
        const next = registration.installing;
        if (!next) return;
        next.addEventListener("statechange", () => {
          // New worker is ready and pages are already claimed, so the next
          // navigation (or chunk recovery reload) runs the fresh build.
          if (next.state === "activated") logger.info("[pwa] updated build ready");
        });
      });
    }).catch((error) => {
      logger.warn("[pwa] service worker registration failed", error);
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
