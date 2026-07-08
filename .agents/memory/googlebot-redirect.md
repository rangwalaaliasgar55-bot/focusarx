---
name: Googlebot mobile redirect bug
description: MobileWelcomeGate was redirecting Google's mobile crawler to /welcome, causing GSC "Page with redirect" issues for all public SEO pages.
---

## The Rule
`MobileWelcomeGate` must always bail out for bot user agents before running `isMobileDevice()`.

## Why
Googlebot's smartphone crawler UA contains "Android" (e.g., `Googlebot/2.1 ... Android ...`), which caused `isMobileDevice()` to return `true`. Since Googlebot has no localStorage, `hasDoneMobileWelcome()` always returned `false`. The result: every public page on the sitemap was JS-redirected to `/welcome` during Google's mobile-first indexing crawl, which Google Search Console reported as "Page with redirect".

## How to Apply
The fix in `MobileWelcomeGate` (App.tsx):
1. Early-return check for bot UAs: `/bot|crawl|spider|Googlebot|bingbot|Slurp|DuckDuck/i.test(navigator.userAgent)`
2. An explicit `publicPaths` list (all sitemap/marketing/SEO/legal pages) is also in the skip array as belt-and-suspenders.

If any new public routes are added to the sitemap, also add them to the `publicPaths` array in `MobileWelcomeGate`.

## Related
- `/leaderboard` was also removed from sitemap.xml because it was simultaneously in the sitemap AND in robots.txt `Disallow` — a contradiction Google flags as a separate issue.
