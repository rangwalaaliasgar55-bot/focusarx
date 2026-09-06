# FocusArx

A production-grade productivity and focus platform with real-time features, gamification, and community tools.

## Features

- **Focus Timer** — Pomodoro-style timer with server-side verification, session persistence, and anti-cheat measures
- **Task & Goal Management** — Create, organize, and track tasks and goals with categories, priorities, and due dates
- **Analytics Dashboard** — Real analytics from actual focus sessions: heatmaps, streaks, weekly trends, personal bests
- **Gamification** — XP, coins, levels, missions, quests, battle pass, loot boxes, achievements, and pets
- **City Builder** — Progress your city from hamlet to civilization through focus sessions
- **Social Features** — Feed, reactions, comments, friends, study groups, real-time study rooms, and direct messaging
- **AI Coach (Arx)** — Conversational AI for study tips, motivation, and insights (graceful degradation when unavailable)
- **Flashcards** — Spaced repetition study cards with Leitner system
- **Habits** — Daily habit tracking with streak support
- **Break Free** — Addiction recovery tools with urge surfing and mood tracking
- **Premium** — Token-based premium tier with extended features
- **Admin Panel** — Full admin control center with user management, CMS, moderation, SQL console
- **Developer Mode** — System overview, user inspection, feature flags, AI budget monitoring

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 7, Tailwind CSS 4, TypeScript |
| Backend | Express 5, Drizzle ORM, Zod validation |
| Database | PostgreSQL (Neon serverless) |
| Real-time | Socket.IO |
| Auth | JWT (access + refresh tokens, httpOnly cookies) |
| Deployment | Vercel (serverless functions + static) |
| Testing | Vitest (unit), Playwright (E2E) |

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env: set DATABASE_URL and AUTH_SECRET

# Push database schema
pnpm db:push

# Start development servers (frontend + API)
pnpm dev
```

- Frontend: http://localhost:5173
- API: http://localhost:8080

## Build

```bash
# Type check
pnpm typecheck

# Run tests
pnpm test

# Build for production
pnpm build

# Build for Vercel deployment
pnpm build:vercel
```

## Project Structure

```
focusarx/
├── artifacts/focusarx/       # Frontend (React SPA)
│   ├── src/
│   │   ├── components/       # UI components
│   │   ├── pages/            # Route pages
│   │   ├── hooks/            # Custom React hooks
│   │   ├── lib/              # Utilities and helpers
│   │   ├── store/            # State management
│   │   └── types/            # TypeScript types
│   └── vite.config.ts
├── artifacts/api-server/     # Backend (Express API)
│   ├── src/
│   │   ├── routes/           # API route handlers
│   │   ├── lib/              # Business logic
│   │   └── middlewares/      # Express middleware
│   └── package.json
├── lib/
│   ├── db/                   # Database schema + migrations
│   │   ├── src/schema/       # Drizzle ORM schema definitions
│   │   └── drizzle/          # SQL migration files
│   ├── api-spec/             # OpenAPI specification
│   ├── api-client-react/     # Generated API client
│   └── api-zod/              # Shared Zod schemas
├── database/                 # Schema SQL + verification scripts
├── docs/                     # Documentation
└── tests/                    # E2E tests (Playwright)
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — System design and data flow
- [API Reference](docs/API.md) — All endpoints with auth requirements
- [Database](docs/DATABASE.md) — Schema, tables, and migration guide
- [Security](docs/SECURITY.md) — Auth, authorization, and security measures
- [Deployment](docs/DEPLOYMENT.md) — Production deployment guide
- [Developer Mode](docs/DEVELOPER_MODE.md) — Admin developer console
- [Microsoft Store](docs/MICROSOFT_STORE.md) — Windows packaging guide

## Environment Variables

See [`.env.example`](.env.example) for the full list. Key variables:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | JWT signing secret (32+ chars) |
| `ADMIN_PASSWORD` | Yes | Admin panel password (8+ chars) |
| `APP_URL` | Yes | Canonical public URL |
| `GROQ_API_KEY` | No | AI coach (graceful degradation) |
| `GEMINI_API_KEY` | No | AI roadmap generation |
| `RESEND_API_KEY` | No | Email delivery |
| `UPSTASH_REDIS_REST_URL` | No | Shared rate limiting |

## Testing

```bash
# Unit tests (Vitest)
pnpm test

# E2E tests (Playwright)
pnpm test:e2e

# Accessibility tests
pnpm test:a11y

# Responsive design tests
pnpm test:responsive
```

## License

MIT
