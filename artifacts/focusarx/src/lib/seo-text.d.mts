// Type declarations for ./seo-text.mjs. Same convention as
// src/content/seo-pages.d.mts — the module is shared with the build scripts,
// which run as plain Node ESM and cannot import the .tsx.
export declare const BRAND: "FocusArx";
export declare const SEPARATOR: " | ";
export declare const TITLE_BUDGET: number;
export declare const DESCRIPTION_BUDGET: number;
export declare const MIN_SNIPPET: number;
export declare const PAGE_TITLE_BUDGET: number;
export declare function clampText(text: string, limit: number, options?: { fullStop?: boolean }): string;
export declare function composeTitle(raw: string): string;
