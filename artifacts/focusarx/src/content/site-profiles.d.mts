/**
 * Type declarations for `src/content/site-profiles.mjs`.
 *
 * The content modules are plain `.mjs` so the build-time scripts
 * (prerender.mjs, seo-validate.mjs) can import them without a transpile step;
 * TypeScript reads these declarations instead.
 */

export interface SiteProfile {
  /** Human-readable platform name, used in UI and the press kit. */
  platform: string;
  /** Absolute https URL of the profile FocusArx controls. */
  url: string;
}

export declare const SITE_PROFILES: SiteProfile[];
export declare const SAME_AS: string[];
