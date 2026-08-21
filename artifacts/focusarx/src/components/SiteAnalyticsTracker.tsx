import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { initSiteAnalytics, trackPageView } from "@/lib/site-analytics";
import { initGtag, trackPageView as trackGAPageView, isGAConfigured } from "@/lib/gtag";

/** Background page-view tracker — mounts once inside the router. */
export function SiteAnalyticsTracker() {
  const [location] = useLocation();
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      if (typeof requestIdleCallback !== "undefined") {
        requestIdleCallback(() => {
          initSiteAnalytics();
          if (isGAConfigured()) initGtag();
        });
      } else {
        setTimeout(() => {
          initSiteAnalytics();
          if (isGAConfigured()) initGtag();
        }, 0);
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
