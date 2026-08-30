# FocusArx Architecture

## Overview

FocusArx is a monorepo productivity application built with React + Vite on the frontend and Express 5 + Drizzle ORM on the backend, targeting PostgreSQL (Neon serverless) for data persistence.

```
focusarx/
├── artifacts/
│   ├── focusarx/          # Frontend (React + Vite + Tailwind)
│   └── api-server/        # Backend (Express 5 + Drizzle + Socket.IO)
├── lib/
│   ├── api-spec/          # OpenAPI specification
│   ├── api-client-react/  # Generated API client (Orval)
│   ├── api-zod/           # Shared Zod validation schemas
│   └── db/                # Database schema + migrations (Drizzle)
├── database/              # Schema SQL + verification
├── docs/                  # Documentation
├── tests/                 # E2E tests (Playwright)
└── scripts/               # Build + dev utilities
```

## Frontend Architecture

- **Framework**: React 19 with TypeScript
- **Build tool**: Vite 7
- **Styling**: Tailwind CSS 4 with CSS custom properties for theming
- **Routing**: wouter (lightweight, ~2kB)
- **State management**: TanStack React Query (server state) + React context (auth)
- **Real-time**: Socket.IO client
- **Animation**: Framer Motion
- **3D/Visual**: Three.js via @react-three/fiber + @react-three/drei
- **Components**: shadcn/ui (Radix UI primitives)

### Code Splitting

The Vite build produces ~50 route-level chunks via `React.lazy()` + dynamic imports. Vendor code is split into stable, independently cacheable chunks:

- `vendor-react` — React core (~190kB)
- `vendor-motion` — Framer Motion (~129kB)
- `vendor-three` — Three.js (~732kB, only loaded for 3D pages)
- `vendor-charts` — Recharts/D3 (~332kB)
- `vendor-query` — TanStack Query (~36kB)
- `vendor-radix` — Radix UI primitives (~77kB)

### Key Pages

| Route | Component | Auth Required | Description |
|---|---|---|---|
| `/` | Landing / Focus Home | No | Landing for guests, focus home for authenticated |
| `/dashboard` | Dashboard | Yes | Main productivity dashboard |
| `/tasks` | Tasks | Yes | Task management |
| `/goals` | Goals | Yes | Goal tracking |
| `/analytics` | Analytics | Yes | Focus session analytics |
| `/admin` | Admin Panel | Admin | Admin control center |
| `/developer` | Developer Mode | Admin | Developer god-mode panel |

## Backend Architecture

- **Framework**: Express 5
- **Database**: PostgreSQL (Neon serverless) via Drizzle ORM
- **Authentication**: JWT (access + refresh tokens) with httpOnly cookies
- **Real-time**: Socket.IO with ticket-based authentication
- **Rate limiting**: express-rate-limit with optional Upstash Redis shared store
- **Logging**: Pino (structured JSON logging)

### API Structure

All API routes are mounted under `/api/` and follow REST conventions. Routes are organized by domain:

- `auth.ts` — Registration, login, logout, password reset, token refresh
- `sessions.ts` — Focus session CRUD, active session management
- `tasks.ts` — Task CRUD, missed review, stats
- `goals.ts` — Goal CRUD
- `stats.ts` — Analytics, streaks, productivity stats
- `admin.ts` — Admin user management, economy, seeding
- `developer.ts` — Developer god-mode (overview, user search, flags, AI budget)
- `adminSql.ts` — SQL console (read/write with guardrails)
- `adminCms.ts` — Content management (site settings, announcements)
- + 50+ domain-specific route files

### Security Layers

1. **Helmet** — CSP, HSTS, X-Frame-Options, etc.
2. **CORS** — Origin allowlist, credentials support
3. **Rate limiting** — Per-route and global limits
4. **Auth middleware** — JWT verification on protected routes
5. **Admin auth** — Separate admin cookie + role check
6. **Input validation** — Zod schemas on all write endpoints
7. **Ownership checks** — All user data queries filter by `userId`
8. **Error sanitization** — No stack traces or internals exposed

## Data Flow

```
Browser → Vite dev server → /api proxy → Express API → Drizzle ORM → PostgreSQL
                                         ↕
                                    Socket.IO (real-time)
```

### Authentication Flow

1. User registers → bcrypt password hash → JWT access + refresh tokens
2. Access token: 15-minute expiry, httpOnly cookie
3. Refresh token: 7-day expiry, httpOnly cookie, family-based rotation
4. Token refresh: POST /api/auth/refresh → new access + refresh pair
5. Logout: revoke refresh token, clear cookies

### Focus Session Flow

1. Start: POST /api/sessions/active → creates active session row
2. Sync: PUT /api/sessions/active/:id → periodic heartbeat
3. Complete: POST /api/sessions → finalizes session, computes rewards
4. Idempotency: client nonce prevents double-counting
5. Rewards: server-side computation of XP, coins, streak updates

## Deployment

- **Platform**: Vercel (serverless functions)
- **Database**: Neon PostgreSQL
- **Cache**: Upstash Redis (optional, for shared rate limiting)
- **Frontend**: Static export + server-side prerendering (69 pages)
- **API**: Single serverless function at `/api/*`
