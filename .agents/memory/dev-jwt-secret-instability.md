---
name: Dev JWT secret instability broke login/signup
description: getServerConfig() generated a new dev JWT secret on every call, so login tokens could not be verified one request later
---

# Dev JWT secret instability

## Symptom

In development (or any environment without `AUTH_SECRET`/`SESSION_SECRET`),
login and sign-up appeared to do nothing or immediately bounced back:
`POST /api/auth/login` returned 200, but the next `/api/auth/session` request
returned 401 and the frontend cleared the token.

## Root cause

`getServerConfig()` in `artifacts/api-server/src/lib/config.ts` generated a fresh
dev secret on **every call**:

```ts
if (!jwtSecret && !isProduction) {
  jwtSecret = `dev-${crypto.randomUUID()}`; // new value every call!
}
```

`login` signs a token with the secret from call A, then `/api/auth/session`
`extractUserId()` calls `getServerConfig()` again and verifies with secret from
call B. Every call differed, so verification always failed → 401.

## Fix

Cache one dev secret per process:

```ts
let devJwtSecret: string | null = null;
...
if (!devJwtSecret) devJwtSecret = `dev-${crypto.randomUUID()}`;
jwtSecret = devJwtSecret;
```

The secret still resets on process restart (matching the warning), but is stable
for the lifetime of the process so tokens can be verified.

## Also fixed

- Frontend auth pages now normalize the backend `{ error: { code, message } }`
  shape into a string before displaying it. Previously `data.error` was an
  object, which React could not render as a child and crashed the error UI.
- `/auth/callback` now calls `AuthProvider.refresh()` after storing a token so
  `ProtectedRoute` sees the session before navigating; previously OAuth callback
  landed on protected pages as "unauthenticated" and bounced to `/login`.
- Added `config.test.ts` to prevent the unstable-secret regression.
