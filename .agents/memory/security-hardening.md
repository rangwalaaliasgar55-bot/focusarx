---
name: Security hardening decisions
description: Key security fixes applied and the patterns to maintain going forward
---

## Admin password comparison
**Rule:** Use `crypto.timingSafeEqual` with equal-length buffers. Never `===` on strings.
**Why:** String equality short-circuits on first mismatch, enabling timing attacks that leak password length.
**How to apply:** Any route comparing a raw secret must pad both sides to equal length before `timingSafeEqual`.

## devResetUrl
**Rule:** Password reset URLs must ONLY be logged server-side (`logger.info`), never returned in API responses.
**Why:** The `devResetUrl` field was previously returned in the JSON response, which would be visible to any party that could observe the response (logs, proxies, browser devtools).
**Location:** `artifacts/api-server/src/routes/auth.ts` — `POST /auth/forgot-password`

## Coach message length
**Rule:** `/coach/chat` enforces a hard 1000-character limit checked server-side before any AI call.
**Why:** Without a cap, an attacker could flood the AI provider with huge payloads, burning quota and potentially causing prompt injection at scale.

## AI rate limiters
Two dedicated limiters live in `lib/rateLimiter.ts`:
- `aiRoadmapLimiter` — 10 req/hr per user+IP, applied to `POST /ai/roadmap` and `POST /roadmap/save`
- `aiCoachLimiter` — 20 req/min per user+IP, applied to `POST /coach/chat`
Key generator uses the first 50 chars of the JWT token + IP so per-user limits work even without a DB lookup.

## Structured data (SEO)
**Rule:** Never put fabricated `aggregateRating` in JSON-LD. It violates Google's policies and can result in manual actions.
Removed from `artifacts/focusarx/index.html`.
