# Focusarx

A Pomodoro timer with auth, session persistence, dashboard analytics, AI learning roadmap, and admin panel — migrated from Next.js to a Replit pnpm workspace stack.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (builds then starts on assigned PORT)
- `pnpm --filter @workspace/focusarx run dev` — run the Vite frontend dev server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Optional env: `ANTHROPIC_API_KEY` — enables the AI roadmap feature
- Optional env: `ADMIN_PASSWORD` — admin panel password (default: `focusarx-admin-dev`)
- Optional env: `AUTH_SECRET` — JWT signing secret (default: dev fallback)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS v4 + Framer Motion + Wouter
- API: Express 5 + JWT auth (bcryptjs + jsonwebtoken)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Build: esbuild (CJS bundle for API)

## Where things live

- **Frontend**: `artifacts/focusarx/src/`
  - `App.tsx` — Wouter router, all page routes
  - `lib/auth.tsx` — JWT auth context (AuthProvider, useAuth, getToken, setToken)
  - `lib/session-persistence-api.ts` — API calls for active session sync
  - `lib/sync-focus-session.ts` — POST a completed session to the backend
  - `pages/` — login, signup, forgot-password, dashboard, roadmap, admin
  - `components/` — Timer, FocusCamera, GuestBootstrap, AdminGate, AdminShell, etc.
- **API**: `artifacts/api-server/src/routes/`
  - `auth.ts` — POST /auth/login, /auth/register, /auth/guest, GET /auth/session
  - `sessions.ts` — GET/POST/DELETE /sessions/active, POST /sessions/sync, POST /sessions
  - `stats.ts` — GET /stats, GET /streak
  - `tasks.ts` — CRUD /tasks, POST /tasks/reorder
  - `admin.ts` — POST/DELETE /admin/auth, GET /admin/users
  - `ai.ts` — POST /ai/roadmap (Anthropic Claude)
- **DB schema**: `lib/db/src/schema/focusarx.ts`
  - Tables: users, focus_sessions, active_sessions, study_streaks, tasks, goals

## Architecture decisions

- **JWT in localStorage** — replaced next-auth/sessions with a custom JWT context. Token key: `focusarx-auth-token`. Guest key: `focusarx-guest-token`.
- **Guest flow** — GuestBootstrap auto-creates a guest account on first visit using a UUID stored in localStorage; guest accounts are full DB rows so sessions persist across browser refreshes.
- **Vision processor stubbed** — TensorFlow + MediaPipe face detection requires GPU access not available in the Replit sandbox. The stub returns `facePresent: true` so focus score is never penalised without a camera.
- **Capacitor no-op** — CapacitorNativeBridge is a no-op on web; the original used native iOS/Android APIs.
- **Admin auth via cookie** — the admin panel uses a simple HTTP-only cookie set after password check. No JWT needed for admin-only routes.

## Product

- **Pomodoro timer** — Focus / Short Break / Long Break modes with session dots and controls
- **Session persistence** — active timer state is synced to Postgres every 10s and restored on reload
- **Dashboard** — weekly focus bar chart, today's study time, avg focus score, streak, completed tasks
- **AI roadmap** — Claude generates a day-by-day Pomodoro plan given a goal, daily hours, and skill level
- **Admin panel** — password-protected view of all users, session counts, streaks, and join dates
- **Guest mode** — users land and start focusing immediately without signing up

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm --filter @workspace/db run push` after changing `lib/db/src/schema/focusarx.ts`
- The Vite frontend proxies API calls through the Replit path-based router — `/api/*` routes go to the api-server artifact
- `"use client"` directives in component files are harmless no-ops in Vite (they're just strings)
- Firebase env vars use `VITE_FIREBASE_*` prefix (not `NEXT_PUBLIC_*`) in the Vite build

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- DB schema source of truth: `lib/db/src/schema/focusarx.ts`
- Auth flow source of truth: `artifacts/focusarx/src/lib/auth.tsx`
