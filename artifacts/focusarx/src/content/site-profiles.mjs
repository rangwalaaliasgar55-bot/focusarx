// ══════════════════════════════════════════════════════════════════
// FocusArx social profiles — the source of truth for Organization.sameAs
// ══════════════════════════════════════════════════════════════════
// `sameAs` tells Google "these other URLs are the same entity as this
// Organization". It is an *identity claim*, not a footer decoration:
//
//   • A profile we do not control is a wrong answer that weakens the entity
//     graph instead of strengthening it, and a reviewer can check it in
//     seconds. `https://twitter.com/focusarx` sat in this slot for months
//     without existing.
//   • Our own origin must never appear here. `sameAs: ["https://www.focusarx.site"]`
//     says the site is the same entity as the site, which is a no-op at best.
//
// Both gates are asserted at build time by scripts/seo-validate.mjs against
// the JSON-LD actually emitted in index.html, so the list cannot drift from
// what ships.
//
// Adding a profile: it has to be live, owned by FocusArx, and ideally named
// FocusArx. Do not add a personal account unless the product presents it as
// the brand's channel.
//
// @typedef {Object} SiteProfile
// @property {string} platform  Human name, used in UI and the press kit
// @property {string} url       Absolute URL, https only

/** @type {SiteProfile[]} */
export const SITE_PROFILES = [
  {
    // The channel embedded by components/YouTubeFocusTimer.tsx (focus ambience
    // and timer videos), presented in-product as FocusArx's video library.
    platform: "YouTube",
    url: "https://www.youtube.com/@AJourneyR",
  },
  {
    // The public source repository (MIT licensed — see LICENSE and README).
    platform: "GitHub",
    url: "https://github.com/rangwalaaliasgar55-bot/focusarx",
  },
];

/** Ordered list of URLs for `Organization.sameAs`. */
export const SAME_AS = SITE_PROFILES.map((profile) => profile.url);
