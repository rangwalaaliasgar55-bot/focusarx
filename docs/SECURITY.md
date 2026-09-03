# FocusArx Security Documentation

## Authentication

- **JWT-based**: HS256 signed tokens with configurable secret (`AUTH_SECRET`)
- **Access tokens**: 15-minute expiry, httpOnly + secure + SameSite=Lax cookies
- **Refresh tokens**: 7-day expiry, family-based rotation, revocation on reuse
- **Password hashing**: bcrypt (minimum 8 characters)
- **Cookie security**: httpOnly, secure in production, SameSite=Lax
- **Token extraction**: Authorization header → cookie → manual cookie parse (fallback)

## Authorization

### User Routes
- `authMiddleware` extracts `userId` from JWT on every protected route
- All user data queries filter by `userId` — ownership enforced server-side
- Cross-user data access is impossible via API manipulation (IDOR protection)

### Admin Routes
- Two auth methods: admin password cookie OR user role=admin in database
- `checkAdminAuth()` checks both, fails closed on DB errors
- `requireAdmin` middleware rejects with 403 if not admin
- Admin SQL console requires additional unlock phrase for write mode
- All admin actions are logged to `audit_logs` / `admin_sql_log`

## Security Headers

Applied via Helmet middleware:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- Content Security Policy (configured for AdSense + analytics)
- Permissions Policy (camera allowed for focus camera, others blocked)

## CORS

- Configured allowlist: app URL + Vercel URLs + `CORS_ALLOWED_ORIGINS`
- Same-origin requests (`Origin` host === request `Host`, honouring
  `X-Forwarded-Host`) are always allowed — the SPA and API share one
  deployment, so a custom domain / `www.` variant / preview alias that isn't
  in the env config can never 403 the app's own login/refresh/track POSTs
  while its GETs keep working (browsers only send `Origin` on mutations,
  which is exactly the failure shape that incident had).
- `www.`/apex counterparts of every configured origin are allowed (scheme-preserving)
- Credentials enabled
- Origin validation is case-insensitive and trailing-slash-tolerant
- Rejections log `{ origin, requestHost, allowedOrigins }` and keep the
  `403 { error: { code: "CORS_FORBIDDEN" } }` contract

## Rate Limiting

- Global: 100 requests per 15 minutes
- Auth endpoints: 10 requests per 15 minutes
- Session completion: 10 per minute
- Admin SQL: 20 queries per minute, 5 unlocks per minute
- AI endpoints: 30 per day per user
- Optional Upstash Redis shared store for serverless consistency

## Input Validation

- All write endpoints use Zod schemas for validation
- Email: max 254 chars, lowercased, trimmed
- Passwords: 8-128 characters
- Text fields: length-bounded
- JSON fields: typed and validated
- UUID validation on path parameters

## Error Handling

- Production errors never expose stack traces, SQL errors, or internal paths
- Standardized error envelope: `{ error: { code, message, requestId } }`
- Client errors (4xx) are logged at warn level
- Server errors (5xx) are logged at error level
- Zod validation errors return 400, not 500

## Secrets Management

- All secrets in environment variables, never in code
- `.env.example` documents all variables with PUBLIC/SERVER_ONLY labels
- No server secrets exposed to the browser
- API keys (Groq, Gemini, Resend) are server-only
- VAPID keys for push are public/private pair (private is server-only)

## SQL Injection Prevention

- Drizzle ORM uses parameterized queries throughout
- No raw SQL concatenation in route handlers
- Admin SQL console has guardrails:
  - Statement timeout (8 seconds)
  - Max 10 statements per run
  - Max 200 rows returned
  - All statements logged
  - Write mode requires explicit unlock

## XSS Prevention

- React's built-in escaping for user content
- CSP headers restrict inline scripts
- No `dangerouslySetInnerHTML` with user content
- All user-generated text is sanitized server-side for social posts

## Session Security

- Active sessions expire server-side after inactivity (state machine)
- Tab close/reopen handled via active session persistence
- Multiple tabs share one active session (unique constraint per user)
- Session completion uses nonce-based idempotency (no double-counting)

## Audit Logging

- Admin actions: `audit_logs` table (who, what, when, result)
- SQL console: `admin_sql_log` table (immutable, insert-only)
- AI actions: `ai_action_audit` table (actor, model, action, payload, outcome)
- Never logs passwords, tokens, or secrets
