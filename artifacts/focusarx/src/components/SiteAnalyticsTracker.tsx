import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { initSiteAnalytics, trackPageView, trackSiteEvent } from "@/lib/site-analytics";
import { trackPageView as trackGAPageView } from "@/lib/gtag";
import { getDeviceTier, markTierReported, probeDeviceCaps } from "@/lib/deviceTier";

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

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      const boot = () => {
        initSiteAnalytics();
        reportDeviceContextOnce();
      };
      if (typeof requestIdleCallback !== "undefined") {
        requestIdleCallback(boot);
      } else {
        setTimeout(boot, 0);
      }
    }
  }, []);

  useEffect(() => {
    const path = location || "/";
    const t = setTimeout(() => {
      trackPageView(path);
      trackGAPageView(path);
    }, 300);
    return () => clearTimeout(t);
  }, [location]);

  return null;
}
