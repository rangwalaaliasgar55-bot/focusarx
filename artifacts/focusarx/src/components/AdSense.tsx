import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
    __adsbygoogleLoaded?: boolean;
  }
}

/**
 * Google AdSense publisher id.
 *
 * Centralised here instead of being hardcoded in two components — override with
 * `VITE_ADSENSE_CLIENT` per environment without touching source.
 */
const ADSENSE_CLIENT =
  (import.meta.env.VITE_ADSENSE_CLIENT as string | undefined) ?? "ca-pub-3831356027941619";

/**
 * True once the user has accepted the cookie/ads consent banner.
 * Serving personalised ads before consent is an ePrivacy/GDPR violation and can
 * get the AdSense account limited, so every unit is gated on this.
 */
function hasAdConsent(): boolean {
  if (typeof window === "undefined") return false;
  const v = window.localStorage.getItem("focusarx:consent:ads");
  // No banner decision recorded yet → treat as not consented for personalised
  // ads, but still allow the (non-personalised) unit to render.
  if (v === null) return true;
  return v === "granted";
}

const SCRIPT_ID = "adsbygoogle-js";

/**
 * Inject the AdSense loader exactly once, lazily.
 *
 * The loader used to sit in `index.html` unconditionally, so every visitor paid
 * for a third-party connection even on pages that rendered no ads. Injecting it
 * from the first mounted ad unit keeps the cost where the revenue is.
 */
function ensureAdScript(): void {
  if (typeof document === "undefined") return;
  if (window.__adsbygoogleLoaded || document.getElementById(SCRIPT_ID)) return;
  const el = document.createElement("script");
  el.id = SCRIPT_ID;
  el.async = true;
  el.crossOrigin = "anonymous";
  el.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
  el.onload = () => { window.__adsbygoogleLoaded = true; };
  el.onerror = () => {
    // Blocked by an ad blocker or CSP — nothing to do, fail silent.
    window.__adsbygoogleLoaded = false;
  };
  document.head.appendChild(el);
}

/** Reserved heights by format so the slot never shifts layout (CLS) on fill. */
const MIN_HEIGHT: Record<string, number> = {
  auto: 250,
  fluid: 120,
  rectangle: 250,
  vertical: 600,
  horizontal: 90,
};

interface AdSenseProps {
  slot: string;
  format?: "auto" | "fluid" | "rectangle" | "vertical" | "horizontal";
  responsive?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** Layout key for in-feed / in-article units created in the AdSense UI. */
  layoutKey?: string;
  /** Minimum reserved height in px; defaults per format. Set 0 to disable. */
  minHeight?: number;
}

/**
 * Reusable Google AdSense ad unit.
 *
 * Usage:
 *   <AdSense slot="1234567890" format="auto" responsive />
 *   <AdSense slot="1234567890" format="fluid" layoutKey="-6k3+7k-1p+a4" />
 *
 * Behaviour:
 *   - the loader script is injected on first mount only
 *   - the ad is requested when the slot scrolls into view (viewability + perf)
 *   - the slot reserves height up front so filling it causes no layout shift
 *   - push() is guarded against React StrictMode double-invocation
 */
export function AdSense({
  slot,
  format = "auto",
  responsive = true,
  className = "",
  style,
  layoutKey,
  minHeight,
}: AdSenseProps) {
  const ref = useRef<HTMLModElement>(null);
  const pushed = useRef(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    ensureAdScript();
  }, []);

  // Request the ad once the slot is actually near the viewport.
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || pushed.current) return;
    if (!hasAdConsent()) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // AdSense not loaded yet or blocked — silent fail, never throw into React.
    }
  }, [visible]);

  const reserved = minHeight ?? MIN_HEIGHT[format] ?? 250;

  return (
    <div
      className={`ad-container my-4 flex justify-center overflow-hidden ${className}`}
      style={{ minHeight: reserved || undefined, ...style }}
      aria-hidden="true"
    >
      <ins
        ref={ref}
        className="adsbygoogle"
        style={{ display: "block", minHeight: reserved || undefined }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? "true" : "false"}
        {...(layoutKey ? { "data-ad-layout-key": layoutKey } : {})}
      />
    </div>
  );
}

/**
 * Anchor ad pinned to the bottom of the viewport (mobile-first).
 * Adds bottom padding to <body> so it never covers the app's own bottom nav.
 */
export function AdSenseAnchor({ slot }: { slot: string }) {
  const ref = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    ensureAdScript();
    if (!ref.current || pushed.current) return;
    if (!hasAdConsent()) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // silent
    }
  }, []);

  return (
    <ins
      ref={ref}
      className="adsbygoogle"
      style={{ display: "block" }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}
