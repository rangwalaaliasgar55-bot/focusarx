import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { initSiteAnalytics, trackPageView } from "@/lib/site-analytics";

/** Background page-view tracker — mounts once inside the router. */
export function SiteAnalyticsTracker() {
  const [location] = useLocation();
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      if (typeof requestIdleCallback !== "undefined") {
        requestIdleCallback(() => initSiteAnalytics());
      } else {
        setTimeout(() => initSiteAnalytics(), 0);
      }
    }
  }, []);

  useEffect(() => {
    const path = location || "/";
    const t = setTimeout(() => trackPageView(path), 300);
    return () => clearTimeout(t);
  }, [location]);

  return null;
}
