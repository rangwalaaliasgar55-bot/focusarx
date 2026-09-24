import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { initSiteAnalytics, trackPageView, trackSiteEvent } from "@/lib/site-analytics";
import { trackPageView as trackGAPageView } from "@/lib/gtag";
import { getDeviceTier, markTierReported, probeDeviceCaps } from "@/lib/deviceTier";
import { captureReferralFromUrl } from "@/lib/referral";
import { initPlausible, trackPlausiblePageview } from "@/lib/plausible";
import { hasAnalyticsConsent, restoreConsent, type ConsentState } from "@/lib/consent";

/** Report capability tier + acquisition source once per tab session (Phase 6.1/4.5). */
function reportDeviceContextOnce() {
  try {
    if (markTierReported()) return;
    const caps = probeDeviceCaps();
    const params = new URLSearchParams(window.location.search);
    const src = (params.get("src") || "").slice(0, 32);
    trackSiteEvent("device_context", {
      tier: getDeviceTier(),
      webgl2: caps.webgl2,
      webgl1: caps.webgl1,
      dm: caps.deviceMemoryGb,
      hc: caps.hardwareConcurrency,
      saveData: caps.saveData,
      net: caps.effectiveType,
      inApp: caps.inAppWebView,
      ...(src ? { src } : {}),
    });
  } catch {
    /* analytics must never break the app */
  }
}

/** Background page-view tracker — mounts once inside the router. */
export function SiteAnalyticsTracker() {
  const [location] = useLocation();
  const initialized = useRef(false);
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(() => {
    restoreConsent();
    return hasAnalyticsConsent();
  });

  useEffect(() => {
    const onConsentChange = (event: Event) => {
      setAllowed((event as CustomEvent<ConsentState>).detail.analytics === true);
    };
    window.addEventListener("focusarx:consent-change", onConsentChange);
    return () => window.removeEventListener("focusarx:consent-change", onConsentChange);
  }, []);

  useEffect(() => {
    if (!allowed || initialized.current) return;
    initialized.current = true;
    setReady(true);
    const boot = () => {
      initSiteAnalytics();
      reportDeviceContextOnce();
      initPlausible();
      // Referral capture (?ref=) — applied after first login.
      try {
        captureReferralFromUrl(window.location.search);
      } catch {
        /* ignore */
      }
    };
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(boot, { timeout: 4_000 });
    } else {
      setTimeout(boot, 0);
    }
  }, [allowed]);

  useEffect(() => {
    if (!allowed || !ready) return;
    const path = location || "/";
    const t = window.setTimeout(() => {
      trackPageView(path);
      trackGAPageView(path);
      trackPlausiblePageview(path);
    }, 300);
    return () => window.clearTimeout(t);
  }, [allowed, ready, location]);

  return null;
}
