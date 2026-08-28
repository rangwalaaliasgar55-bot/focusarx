import { Suspense } from "react";
import { AD_SLOTS, ENABLE_ADS, ENABLE_ANCHOR_AD, AdUnit, AdAnchorUnit, type AdSlotKey } from "@/lib/adSlots";

/**
 * Placement wrapper for an AdSense unit.
 *
 * `<AdSlot name="landingMid" />` — resolves the slot id from the central
 * registry, respects the `ENABLE_ADS` kill switch, and lazy-loads the ad
 * component so non-ad pages pay nothing.
 */
export function AdSlot({
  name,
  className = "",
  minHeight,
}: {
  name: AdSlotKey;
  className?: string;
  minHeight?: number;
}) {
  if (!ENABLE_ADS) return null;
  const cfg = AD_SLOTS[name];
  if (!cfg || !("format" in cfg)) return null;

  return (
    <Suspense fallback={<div className={`my-4 ${className}`} style={{ minHeight: minHeight ?? 250 }} />}>
      <AdUnit
        slot={cfg.slot}
        format={cfg.format}
        responsive
        className={className}
        minHeight={minHeight}
      />
    </Suspense>
  );
}

/** Height of `MobileBottomNav` — `calc(4.5rem + env(safe-area-inset-bottom))`. */
const BOTTOM_NAV_HEIGHT = "calc(4.5rem + env(safe-area-inset-bottom))";

/**
 * Mobile sticky anchor ad.
 *
 * Sits *above* the app's own bottom nav rather than over it, and is off by
 * default: an anchor unit permanently consumes ~90px of a phone viewport,
 * which is a real UX cost. Flip `VITE_ENABLE_ANCHOR_AD=true` to turn it on.
 * `hideOnFocus` keeps it out of the focus timer, where an ad strip is both a
 * distraction and a policy risk (ads must not sit inside the primary task).
 */
export function MobileAdAnchor({ hideOnFocus = false }: { hideOnFocus?: boolean }) {
  if (!ENABLE_ADS || !ENABLE_ANCHOR_AD) return null;
  if (hideOnFocus) return null;
  const cfg = AD_SLOTS.mobileAnchor;
  return (
    <div
      className="fixed inset-x-0 z-[var(--z-nav)] block border-t border-[var(--border-subtle)] bg-[var(--backdrop)] backdrop-blur-[24px] md:hidden"
      style={{ bottom: BOTTOM_NAV_HEIGHT }}
      aria-hidden="true"
    >
      <Suspense fallback={null}>
        <AdAnchorUnit slot={cfg.slot} />
      </Suspense>
    </div>
  );
}

export default AdSlot;
