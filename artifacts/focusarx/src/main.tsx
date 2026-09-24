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

// Prerendered public routes have a useful static shell in #root. Mount the
// interactive application beside it, rather than clearing that shell as soon
// the entry chunk evaluates; on a slow phone this avoids an SEO-first paint
// turning into a spinner while the lazy route arrives. RoutedContent emits the
// ready event only after its Suspense boundary resolves, then the shell is
// removed in one handoff (never displayed beside the interactive page).
const staticRoot = document.getElementById("root");
const hasStaticShell = Boolean(staticRoot?.querySelector(".fa-seo"));
const appMount = hasStaticShell && staticRoot?.parentElement
  ? (() => {
      staticRoot.id = "focusarx-prerender";
      staticRoot.setAttribute("aria-live", "off");
      Object.assign(staticRoot.style, {
        position: "fixed",
        inset: "0",
        zIndex: "10000",
        overflow: "auto",
        width: "100%",
        background: "var(--background, #0b0d13)",
      });
      const mount = document.createElement("div");
      mount.id = "root";
      staticRoot.insertAdjacentElement("afterend", mount);
      window.addEventListener("focusarx:route-ready", () => staticRoot.remove(), { once: true });
      return mount;
    })()
  : staticRoot;

createRoot(appMount!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
