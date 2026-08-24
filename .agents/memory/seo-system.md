---
name: SEO system
description: Canonical domain, build-time prerendering, PageSEO component, schema blocks, sitemap, and robots.txt for FocusArx
---

## Canonical domain
`https://www.focusarx.site` — ALL canonical URLs, OG meta, and JSON-LD schemas must use this domain. Old code used `focusarx.app` — always update to `.site`.

## Build-time prerendering (added 2026-08-24)
`artifacts/focusarx/scripts/prerender.mjs` + `scripts/prerender-data.mjs`, runs automatically after `vite build` (both `build` and `build:vercel` scripts).
- Emits static `dist/public/<route>/index.html` for all 36 public routes: unique title/description/canonical/OG/Twitter, route-scoped JSON-LD (Breadcrumb always; Article + FAQ when set in manifest), and crawler-visible body content inside `#root` (React replaces it on mount).
- Vercel serves these via the existing `"handle": "filesystem"` route — no config change needed. vite preview does NOT resolve clean URLs to nested index.html (use python http.server for local checks).
- Homepage-only global schemas (FAQPage, ItemList) are stripped from subpages by the script.
- **RULE when adding a public page:** add it to ALL of — `PAGE_SEO` (PageSEO.tsx), `scripts/prerender-data.mjs`, `public/sitemap.xml`, `robots.txt` Allow list, `/guides` hub page, `/search` page index — then rebuild.
- The script intentionally fails the build if a head pattern stops matching (guards against silent SEO regressions).

## PageSEO component
`artifacts/focusarx/src/components/PageSEO.tsx`
- `PageSEO` component: useEffect-based, returns null, mutates `document.title` + meta tags + canonical link (client-side layer for SPA navigation)
- `PAGE_SEO` export: presets keyed by page name (home, about, contact, support, pricing, privacy, terms, refund, focusGuide, pomodoroGuide, studyTechniques, virtualStudyRoom, roadmap, guides, adhdFocus, stopProcrastinating, studyWithMe, focusMusic, search, …)
- Pattern: `import { PageSEO, PAGE_SEO } from "@/components/PageSEO";` then `<PageSEO {...PAGE_SEO.about} />` as first child of the page's root div

## index.html schemas (6 blocks)
1. Organization — @id #organization, name/alternateName/logo/contactPoint
2. WebSite — @id #website, SearchAction potentialAction → `/search?q=` (real page exists now)
3. SoftwareApplication — full featureList, aggregateRating, offers
4. FAQPage — 10 questions (homepage only; stripped from subpages by prerender)
5. BreadcrumbList — auto-generated per route by prerender script + PageSEO
6. ItemList — key features; URLs point only at public routes

## Public content pages (all prerendered)
Guides: /guides (hub), /focus-guide, /pomodoro-guide, /study-techniques, /deep-study-guide, /two-hour-study-method, /science-of-deep-work, /feynman-technique, /adhd-focus-tips, /stop-procrastinating, /study-with-me, /focus-music, /virtual-study-room
Tools: /study-method-quiz, /study-calculator, /breathe, /break-free, /search
Comparisons: /comparison/focusarx-vs-forest, /comparison/focusarx-vs-focus-todo

## robots.txt
Blocks private/auth routes (dashboard, analytics, profile, settings, onboarding, missions, achievements, shop, wallet, goals, habits, pets, city, leaderboard-adjacent social routes, /api/, /admin, auth callbacks, *.map$). Allows all public + guide pages incl. new /guides, /adhd-focus-tips, /stop-procrastinating, /study-with-me, /focus-music, /comparison.

## sitemap.xml
36 URLs. `/data-deletion` REMOVED (it's noindex — never list noindex URLs in a sitemap).

**Why:** Static per-route HTML + unique titles/snippets + rich data = every crawler (incl. non-JS social scrapers) sees correct per-page info; content guides target long-tail keywords; see docs/SEO-GROWTH-PLAN.md for the full strategy and content calendar.
