# FocusArx

A productivity-focused web app that combines Pomodoro-style focus tracking, gamification, AI-driven insights, and webcam-based attention monitoring (MediaPipe).

## Run & Operate

- `pnpm --filter @workspace/focusarx run dev` — run the frontend (port 20925)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (auto-set by Replit DB)

## Stack

- pnpm workspaces, Node.js 20, TypeScript 5.9
- Frontend: React 19, Vite, Tailwind CSS 4, Wouter, TanStack Query, Radix UI, Framer Motion
- API: Express 5, Pino, Helmet, bcryptjs, jsonwebtoken
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (ESM bundle)
- AI: Gemini 2.5 Flash (roadmap), Groq Llama (coach chat) — both have local fallbacks if keys absent

## Where things live

- `artifacts/api-server/` — Express backend
- `artifacts/focusarx/` — React frontend
- `lib/db/` — Drizzle schema and DB client
- `lib/api-spec/openapi.yaml` — OpenAPI source of truth
- `lib/api-zod/` — generated Zod schemas from spec
- `lib/api-client-react/` — generated React Query hooks from spec

## Architecture decisions

- Contract-first: OpenAPI spec drives both frontend types and backend validation via Orval codegen
- Custom JWT auth (bcryptjs + jsonwebtoken) — no external auth provider required
- AI features degrade gracefully: all AI routes have built-in fallbacks when API keys are absent
- Frontend proxies `/api` to the API server at port 8080 (configured in vite.config.ts)

## Product

FocusArx helps users build deep focus habits through Pomodoro sessions, webcam attention tracking, gamification (XP/coins/badges/streaks), an AI study roadmap generator, an AI coach, and rich session analytics.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after any changes to `lib/api-spec/openapi.yaml`
- Run `pnpm --filter @workspace/db run push` after schema changes in `lib/db/src/schema/`
- esbuild version is pinned to `0.27.3` — do not upgrade without testing the build

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
