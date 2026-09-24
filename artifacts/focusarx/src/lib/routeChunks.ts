/**
 * Route → chunk, generated from the router's own route table.
 *
 * Every page in `App.tsx` is a `lazyWithRetry(() => import(...))`, which Vite
 * turns into one JavaScript chunk per page, fetched *when the route renders* —
 * i.e. the whole download happens after the click, while the student looks at
 * the page spinner. On a phone on 4G a page chunk is 300–900 ms of visible
 * waiting, on every navigation, forever.
 *
 * The fix costs nothing at build time and nothing at runtime for someone who
 * never navigates: keep the same import factory, and call it early — on hover,
 * on focus, on touch-down, and for the two or three most likely next screens
 * once the browser is idle. `import()` is memoised by the module map, so a
 * prefetch that is never used wastes bandwidth only (and only after
 * `shouldPrefetch()` says the connection can afford it), while a prefetch that
 * is used turns a page load into a render.
 *
 * This map is derived from `App.tsx`, not maintained by hand — and
 * `routeChunks.test.ts` fails if a route exists there and not here, so the
 * router cannot drift away from the prefetch list.
 */
export const ROUTE_CHUNKS: Record<string, () => Promise<unknown>> = {
  "/10-minute-timer": () => import("@/pages/minute-timer"),
  "/15-minute-timer": () => import("@/pages/minute-timer"),
  "/30-minute-timer": () => import("@/pages/minute-timer"),
  "/45-minute-timer": () => import("@/pages/minute-timer"),
  "/5-minute-timer": () => import("@/pages/minute-timer"),
  "/about": () => import("@/pages/about"),
  "/acceptable-use": () => import("@/pages/acceptable-use"),
  "/accessibility": () => import("@/pages/accessibility"),
  "/achievements": () => import("@/pages/achievements"),
  "/adhd-focus-tips": () => import("@/pages/adhd-focus"),
  "/adhd-focus-tools": () => import("@/pages/adhd-focus-tools"),
  "/admin": () => import("@/pages/admin"),
  "/ai-insights": () => import("@/pages/ai-insights"),
  "/ai-policy": () => import("@/pages/ai-policy"),
  "/analytics": () => import("@/pages/analytics"),
  "/auth/callback": () => import("@/pages/auth-callback"),
  "/battle-pass": () => import("@/pages/battle-pass"),
  "/blog": () => import("@/pages/blog"),
  "/blog/:slug": () => import("@/pages/blog-post"),
  "/body-doubling": () => import("@/pages/body-doubling"),
  "/break-free": () => import("@/pages/break-free"),
  "/breathe": () => import("@/pages/breathe"),
  "/camera-data": () => import("@/pages/camera-data"),
  "/changelog": () => import("@/pages/changelog"),
  "/city": () => import("@/pages/city"),
  "/comparison/:slug": () => import("@/pages/comparison"),
  "/consequences": () => import("@/pages/consequences"),
  "/constellations": () => import("@/pages/constellations"),
  "/contact": () => import("@/pages/contact"),
  "/cookie-policy": () => import("@/pages/cookie-policy"),
  "/dashboard": () => import("@/pages/dashboard"),
  "/data-deletion": () => import("@/pages/data-deletion"),
  "/deep-study-guide": () => import("@/pages/deep-study-guide"),
  "/deep-work-guide": () => import("@/pages/deep-work-guide"),
  "/developer": () => import("@/pages/developer"),
  "/dreams": () => import("@/pages/dreams"),
  "/es": () => import("@/pages/locale-edition"),
  "/es/pricing": () => import("@/pages/locale-edition"),
  "/evidence": () => import("@/pages/evidence"),
  "/exam": () => import("@/pages/exam"),
  "/exam/:slug": () => import("@/pages/exam"),
  "/feynman-technique": () => import("@/pages/feynman-technique"),
  "/flashcards": () => import("@/pages/flashcards"),
  "/focus": () => import("@/pages/focus"),
  "/focus-dna": () => import("@/pages/focus-dna"),
  "/focus-guide": () => import("@/pages/focus-guide"),
  "/focus-music": () => import("@/pages/focus-music"),
  "/focus-timer": () => import("@/pages/focus-timer"),
  "/focus-timer-for-programmers": () => import("@/pages/focus-timer-for-programmers"),
  "/forge": () => import("@/pages/forge"),
  "/forge-room": () => import("@/pages/forge-room"),
  "/forgot-password": () => import("@/pages/forgot-password"),
  "/goals": () => import("@/pages/goals"),
  "/groups": () => import("@/pages/groups"),
  "/guides": () => import("@/pages/guides"),
  "/habits": () => import("@/pages/habits"),
  "/hi": () => import("@/pages/locale-edition"),
  "/hi/pricing": () => import("@/pages/locale-edition"),
  "/how-to-focus-while-studying": () => import("@/pages/how-to-focus-while-studying"),
  "/in": () => import("@/pages/locale-edition"),
  "/in/pricing": () => import("@/pages/locale-edition"),
  "/leaderboard": () => import("@/pages/leaderboard"),
  "/login": () => import("@/pages/login"),
  "/lootboxes": () => import("@/pages/lootboxes"),
  "/marketplace": () => import("@/pages/marketplace"),
  "/messages": () => import("@/pages/messages"),
  "/missions": () => import("@/pages/missions"),
  "/notifications": () => import("@/pages/notifications"),
  "/onboarding": () => import("@/pages/onboarding"),
  "/pets": () => import("@/pages/pets"),
  "/pomodoro-guide": () => import("@/pages/pomodoro-guide"),
  "/pomodoro-timer": () => import("@/pages/pomodoro-timer"),
  "/pomodoro-timer-for/:exam": () => import("@/pages/exam-funnel"),
  "/premium": () => import("@/pages/premium"),
  "/press": () => import("@/pages/press"),
  "/pricing": () => import("@/pages/pricing"),
  "/privacy": () => import("@/pages/privacy"),
  "/profile": () => import("@/pages/profile"),
  "/pt-br": () => import("@/pages/locale-edition"),
  "/pt-br/pricing": () => import("@/pages/locale-edition"),
  "/quests": () => import("@/pages/quests"),
  "/referral": () => import("@/pages/referral"),
  "/reset-password": () => import("@/pages/reset-password"),
  "/roadmap": () => import("@/pages/roadmap"),
  "/safety": () => import("@/pages/safety"),
  "/science-of-deep-work": () => import("@/pages/science-of-deep-work"),
  "/search": () => import("@/pages/search"),
  "/shop": () => import("@/pages/shop"),
  "/signup": () => import("@/pages/signup"),
  "/social": () => import("@/pages/social"),
  "/stop-procrastinating": () => import("@/pages/stop-procrastinating"),
  "/stop-scrolling": () => import("@/pages/stop-scrolling"),
  "/study-calculator": () => import("@/pages/study-calculator"),
  "/study-method-quiz": () => import("@/pages/study-method-quiz"),
  "/study-rooms": () => import("@/pages/study-rooms"),
  "/study-techniques": () => import("@/pages/study-techniques"),
  "/study-timer": () => import("@/pages/study-timer"),
  "/study-timer-for-medical-students": () => import("@/pages/study-timer-for-medical-students"),
  "/study-with-me": () => import("@/pages/study-with-me"),
  "/support": () => import("@/pages/support"),
  "/tasks": () => import("@/pages/tasks"),
  "/terms": () => import("@/pages/terms"),
  "/two-hour-study-method": () => import("@/pages/two-hour-study-method"),
  "/u/:username": () => import("@/pages/user-profile"),
  "/us": () => import("@/pages/locale-edition"),
  "/us/pricing": () => import("@/pages/locale-edition"),
  "/virtual-study-room": () => import("@/pages/virtual-study-room"),
  "/wallet": () => import("@/pages/wallet"),
  "/welcome": () => import("@/pages/mobile-welcome"),
};

/**
 * Resolve a URL pathname to its chunk.
 *
 * Exact matches first (the common case), then the dynamic routes: `/u/ada`
 * must find `/u/:username`, `/blog/why-focus` must find `/blog/:slug`. The
 * longest pattern wins so `/pomodoro-timer-for/:exam` is preferred over a
 * hypothetical `/pomodoro-timer-for` route.
 */
export function routeChunkFor(pathname: string): (() => Promise<unknown>) | null {
  const clean = pathname.split("?")[0]!.replace(/\/+$/, "") || "/";
  const direct = ROUTE_CHUNKS[clean];
  if (direct) return direct;
  let best: { loader: () => Promise<unknown>; length: number } | null = null;
  for (const [pattern, loader] of Object.entries(ROUTE_CHUNKS)) {
    const idx = pattern.indexOf(":");
    if (idx === -1) continue;
    const prefix = pattern.slice(0, idx);
    if (!clean.startsWith(prefix)) continue;
    if (best && prefix.length <= best.length) continue;
    best = { loader, length: prefix.length };
  }
  return best?.loader ?? null;
}
