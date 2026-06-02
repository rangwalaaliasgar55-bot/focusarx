---
name: FocusArx project setup
description: Key setup facts for the FocusArx monorepo on Replit
---

# FocusArx Monorepo Setup

**Why:** Avoid re-discovering these non-obvious facts.

## Ports
- Frontend (Vite): port 20925 → external port 80
- API (Express): port 8080 → external port 8080

## Codegen workflow
After changing `lib/api-spec/openapi.yaml`:
1. `pnpm --filter @workspace/api-spec run codegen`
2. Restart FocusArx Frontend workflow (Vite needs restart after generated files change)

**Why:** `clean: true` in orval.config.ts deletes and recreates generated files. Vite's `fs.strict: true` caches file presence at startup.

## Database
- Replit PostgreSQL, `DATABASE_URL` auto-provisioned as Replit secret
- Schema in `lib/db/src/schema/focusarx.ts`
- Push schema: `pnpm --filter @workspace/db run push`

## Secrets already configured
- `DATABASE_URL`, `SESSION_SECRET` (used as JWT secret via `AUTH_SECRET ?? SESSION_SECRET`)
- `GEMINI_API_KEY` and `GROQ_API_KEY` — requested from user, not yet set

## Auth
Custom JWT (bcrypt + jsonwebtoken). NOT Replit Auth. Token stored in localStorage as `focusarx-auth-token`. Guest mode creates anonymous users automatically.

## How to apply
Any time you need to add a route, change the DB schema, or modify the API contract.
