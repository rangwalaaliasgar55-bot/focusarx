import { lazy } from "react";

/**
 * AdSense placement registry.
 *
 * Every ad slot on the site is declared here so placement, sizing and density
 * can be reviewed in one file instead of being scattered through JSX. Replace
 * the `slot` values with the real unit ids from the AdSense console — until
 * then each placement renders an empty reserved box (or nothing at all, when
 * `ENABLE_ADS` is off).
 *
 * ── Placement policy ───────────────────────────────────────────────
 * AdSense policy prohibits ads in or immediately around interactive controls,
 * and too many units per screen triggers the "accidental clicks" limiter. The
 * rules applied here:
 *   • one in-feed/in-article unit per ~2 screens of content
 *   • nothing inside the active focus timer, the shop, or payment flows
 *   • nothing on pages behind a login wall that AdSense cannot crawl
 *   • never adjacent to a primary CTA button
 */

/** Master switch — flip off to ship the app with no ad requests at all. */
export const ENABLE_ADS =
  (import.meta.env.VITE_ENABLE_ADS as string | undefined) !== "false";

/**
 * Sticky mobile anchor ads. OFF by default — they permanently consume ~90px of
 * a phone viewport. Set `VITE_ENABLE_ANCHOR_AD=true` to opt in.
 */
export const ENABLE_ANCHOR_AD =
  (import.meta.env.VITE_ENABLE_ANCHOR_AD as string | undefined) === "true";

export const AD_SLOTS = {
  /** Landing page, below the fold between feature sections. */
  landingMid: { slot: "1000000001", format: "auto" as const },
  /** Landing page, above the footer. */
  landingFooter: { slot: "1000000002", format: "horizontal" as const },
  /** Content hub — between guide cards. */
  guidesInFeed: { slot: "1000000003", format: "fluid" as const },
  /** Long-form guide articles — after the first third of the copy. */
  articleInArticle: { slot: "1000000004", format: "fluid" as const },
  /** Exam hub index — between exam cards. */
  examInFeed: { slot: "1000000005", format: "fluid" as const },
  /** Study rooms list — between room cards. */
  studyRoomsInFeed: { slot: "1000000006", format: "fluid" as const },
  /** Leaderboard, below the table. */
  leaderboardBottom: { slot: "1000000007", format: "rectangle" as const },
  /** Comparison pages — between the comparison tables. */
  comparisonMid: { slot: "1000000008", format: "rectangle" as const },
  /** Mobile-only sticky anchor. */
  mobileAnchor: { slot: "1000000009" },
} as const;

export type AdSlotKey = keyof typeof AD_SLOTS;

/**
 * Lazy-loaded ad component. Keeps the ~4KB of ad glue out of the critical
 * bundle; pages with no ads never download it.
 */
export const AdUnit = lazy(() =>
  import("@/components/AdSense").then((m) => ({ default: m.AdSense })),
);

export const AdAnchorUnit = lazy(() =>
  import("@/components/AdSense").then((m) => ({ default: m.AdSenseAnchor })),
);
