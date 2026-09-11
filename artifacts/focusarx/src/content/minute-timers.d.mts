// Type declarations for ./minute-timers.mjs.
// Same convention as ./seo-pages.d.mts and ./exam-funnel.d.mts.

import type { SeoPage } from "./seo-pages.mjs";

export const MINUTE_TIMER_DURATIONS: number[];
export const MINUTE_TIMER_PAGES: Record<string, SeoPage>;
export function getMinuteTimerPage(minutes: number | string): SeoPage | null;
