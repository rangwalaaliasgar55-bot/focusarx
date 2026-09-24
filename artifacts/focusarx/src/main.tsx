import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { getToken } from "@/lib/auth";
import { getTheme, applyTheme, registerPremiumChecker } from "@/lib/theme";
import { installChunkRecovery } from "@/lib/chunkRecovery";
import { FRONTEND_DEPLOYMENT_VERSION } from "@/lib/deploymentSkew";
import { logger } from "./lib/logger";

// Apply saved theme before first paint (prevents flash of wrong theme)
applyTheme(getTheme());

// Recover automatically from stale lazy chunks after a deploy instead of
// forcing the user to reload to reach a page. The build version is passed so the
// reload coordinator can verify the reload actually delivered a new build.
installChunkRecovery(FRONTEND_DEPLOYMENT_VERSION);
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

// Optional crash reporting (Sentry, env-gated): without VITE_SENTRY_DSN
// the SDK never loads. Dynamic import keeps it out of the entry chunk.
if (import.meta.env.VITE_SENTRY_DSN) {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string;
  void import("@sentry/react")
    .then((Sentry) =>
      Sentry.init({
        dsn,
        environment: import.meta.env.MODE,
        release:
          (import.meta.env.VITE_DEPLOYMENT_VERSION as string | undefined) ?? "dev-local",
        tracesSampleRate: 0.1,
        sendDefaultPii: false,
      }),
    )
    .catch((error) => {
      logger.warn("[sentry] init failed", error);
    });
}

// Tell the pre-paint boot guard in index.html that the bundle took over, so it
// stands down instead of reloading a page that is working. Set before render()
// returns synchronously-mounted content — anything later would race the guard's
// 12s timer on a slow device.
declare global {
  interface Window {
    /** Set by main.tsx once the app has mounted; read by the index.html boot guard. */
    __focusarxBooted?: boolean;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

window.__focusarxBooted = true;

/**
 * Page chunks are fetched on intent (hover/focus/tap) and warmed for the most
 * likely next screens once the browser is idle, so a navigation renders instead
 * of downloading.
 *
 * Imported *dynamically*, and this matters: `routePrefetch` statically imports
 * the 109-entry route→chunk map, and that map is a few kilobytes of entry bundle
 * for an optimisation that only pays off later. Loading it on the first idle
 * callback keeps the entry chunk (the one blocking first paint, budget-checked
 * at 55 kB gzip) free of it — the prefetch machinery becomes its own chunk,
 * fetched when the browser has nothing better to do, and `shouldPrefetch()`
 * inside it still refuses on save-data/slow links.
 */
function warmRoutePrefetch() {
  void import("@/lib/routePrefetch")
    .then((m) => m.installRoutePrefetch())
    .catch(() => {
      /* prefetching is an optimisation — never let it break the app */
    });
}
if (typeof window.requestIdleCallback === "function") {
  window.requestIdleCallback(warmRoutePrefetch, { timeout: 3000 });
} else {
  window.setTimeout(warmRoutePrefetch, 1500);
}
