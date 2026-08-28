# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please email **focusarx@gmail.com** with:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested mitigation

We aim to respond within 48 hours and will keep you updated on the fix.

Please do NOT open a public GitHub issue for security vulnerabilities.

## Security Architecture

FocusArx ships with the following protections (verify against the code when auditing):

### Authentication & Authorization
- **Environment validation**: Centralized Zod schema in `artifacts/api-server/src/lib/env.ts` — fails fast in production when `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_PASSWORD` are missing
- **ADMIN_PASSWORD**: Constant-time comparison via SHA-256 + `timingSafeEqual`, audit logging, secure HttpOnly cookies (`SameSite=Lax`, `Secure` in prod), 12h expiry (reduced from 24h), rate limited (20/15min), generic error messages
- **JWT**: Short-lived access tokens (15m) + 7d refresh tokens with rotation, HttpOnly cookies, `secure: true` in production, `sameSite: lax`, token revocation on logout, password reset tokens hashed (SHA-256) with 1h expiry
- **Database-backed admin roles**: `role=admin` in `users` table supported as alternative to password bootstrap

### CORS
- Production CORS locked down to explicit allowlist: `APP_URL`, `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, plus `CORS_ALLOWED_ORIGINS` env
- Credentials true, methods allowlist, maxAge 86400
- Socket.IO CORS mirrors same allowlist, `maxHttpBufferSize` 1MB

### Rate Limiting & Abuse Controls
- `authLimiter` (10/15min prod), `adminLimiter` (20/15min prod), `aiCoachLimiter` (20/min), `aiRoadmapLimiter` (10/hour), `generalLimiter` (120/min prod)
- AI: per-user daily limits (30 coach, 10 roadmap for free tier), per-IP daily limit (100), prompt injection detection, input sanitization, output length caps (2000), Zod validation of AI responses, usage logging in `ai_call_log` and `ai_budget_state`

### Socket.IO
- Authentication during handshake via Bearer token
- Room membership verified via DB join on every `join:room` and `room:chat`
- Zod validation of payloads, max message 500 chars, rate limiting 20/min per socket, XSS sanitization (`<>` stripped), no trust of client-supplied userId

### Timer & Gamification Anti-Cheat
- Timer uses timestamp-based deadline (`Date.now() + secondsLeft*1000`), server calculates authoritative remaining — handles tab suspend, phone lock, background
- Active session stored server-side in `active_sessions` with unique index per user (prevents multiple active sessions)
- `verifiedDurationSec = min(clientDuration, activeSeconds, wallClockSeconds, 14400)` — client cannot spoof longer sessions
- Idempotency via `clientNonce` unique index, replay protection
- Rewards calculated server-side via `computeSessionRewards` (sub-linear, premium multipliers, drop multipliers server-side)
- All reward operations wrapped in `db.transaction` for atomic XP/coins + productivity logs + streaks
- Indexes: `focus_sessions_user_started_idx`, `room_members_room_user_idx`, `active_session_per_user_idx`

### Error Handling
- Centralized error middleware with consistent format: `{ error: { code, message, requestId } }`
- Request IDs via `X-Request-Id` header and `pino-http`
- No leakage of stack traces, SQL errors, API keys, internal paths, provider details, user existence

### 3D UI Resilience
- WebGL capability detection, fallback to 2D `FocusCityFallback`
- ErrorBoundary wraps all 3D sections
- DPR caps `[1, 1.5]`, `frameloop="demand"` when `prefers-reduced-motion`, `antialias: false`, `powerPreference: high-performance`
- Mobile low-detail mode (fewer lights, no shadows, reduced geometry, 600 stars vs 1800)
- GPU cleanup on unmount (`THREE.Cache.clear()`, context loss handling)

### Frontend
- Route-level lazy loading for all pages (including 3D, MediaPipe, analytics)
- React Query for data fetching with query keys
- Reduced motion respected: `@media (prefers-reduced-motion: reduce)` disables animations

## Environment Variables

Required in production:

- `DATABASE_URL` (or `POSTGRES_URL_NON_POOLING`)
- `AUTH_SECRET` (min 32 chars)
- `ADMIN_PASSWORD` (min 16 chars, bootstrap only — use DB roles after setup)
- `APP_URL` (canonical URL for CORS, OAuth, password reset)

See `.env.example` for full list.

## Best Practices for Operators

- Rotate `AUTH_SECRET` and `ADMIN_PASSWORD` regularly
- Use DB-backed admin roles, remove `ADMIN_PASSWORD` after initial bootstrap if possible
- Enable MFA for admin accounts (roadmap)
- Monitor `audit_logs` and AI usage via admin dashboard
- Keep dependencies updated (`pnpm audit`, Dependabot)
- Test migrations against clean DB and production snapshot
