---
name: SEO system
description: Canonical domain, PageSEO component, schema blocks, sitemap, and robots.txt for FocusArx
---

## Canonical domain
`https://focusarx.site` — ALL canonical URLs, OG meta, and JSON-LD schemas must use this domain. Old code used `focusarx.app` — always update to `.site`.

## PageSEO component
`artifacts/focusarx/src/components/PageSEO.tsx`
- `PageSEO` component: useEffect-based, returns null, mutates `document.title` + meta tags + canonical link
- `PAGE_SEO` export: object with presets keyed by page name (home, about, contact, support, pricing, privacy, terms, refund, focusGuide, pomodoroGuide, studyTechniques, virtualStudyRoom, roadmap)
- Pattern to use: `import { PageSEO, PAGE_SEO } from "@/components/PageSEO";` then `<PageSEO {...PAGE_SEO.about} />` as first child of the page's root div

## index.html schemas (6 blocks)
1. Organization — @id #organization, name/alternateName/logo/contactPoint
2. WebSite — @id #website, SearchAction potentialAction
3. SoftwareApplication — full featureList, aggregateRating, offers
4. FAQPage — 10 questions covering what/free/compare/focus-score/deep-work/study/mobile/pomodoro/habits/privacy
5. BreadcrumbList — Home → Features → Pricing → About → Contact → Support
6. ItemList — 9 key product features with URLs

## robots.txt
Production-ready. Blocks: /dashboard, /analytics, /profile, /settings, /onboarding, /missions, /achievements, /shop, /wallet, /goals, /habits, /pets, /city, /leaderboard, /social, /api/, /admin, /auth/callback, /reset-password, *.map$
Allows: all public pages including OG image, logo, manifest.json

## sitemap.xml
24 URLs: home, signup, login, about, contact, support, pricing, roadmap, focus-guide, pomodoro-guide, study-techniques, virtual-study-room, study-rooms, leaderboard, breathe, break-free, privacy, terms, cookie-policy, acceptable-use, ai-policy, data-deletion, refund

**Why:** Comprehensive sitemap + blocked user-private routes = maximum crawlable surface; blocked routes prevent Google from wasting crawl budget on auth-gated pages.
