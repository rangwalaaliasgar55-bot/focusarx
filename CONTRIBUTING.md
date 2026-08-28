# Contributing to FocusArx

Thank you for contributing to FocusArx! This guide covers the workflow, testing requirements, and key conventions.

## Local Setup

1. **Prerequisites**: Node.js 20+ and `pnpm` (enable via `corepack enable`).
2. **Clone and install**:
   ```bash
   git clone https://github.com/rangwalaaliasgar55-bot/focusarx.git
   cd focusarx
   pnpm install
   ```
3. **Environment variables**: Copy `.env.example` to `.env` and fill in the required values.
   Only `DATABASE_URL` and `AUTH_SECRET` (32+ chars) are required.
4. **Database**: Push the schema to your local or Neon database:
   ```bash
   pnpm run db:push
   ```
5. **Seed data** (optional):
   ```bash
   node lib/db/scripts/seed.mjs
   ```
6. **Start development servers**:
   ```bash
   pnpm run dev   # API on :8080, frontend on :5000
   ```

## Project Structure

```text
/
├── api/                    # Vercel serverless entry
├── artifacts/
│   ├── focusarx/           # React frontend (Vite)
│   └── api-server/         # Express API (also standalone)
├── lib/
│   ├── db/                 # Drizzle schema + migrations
│   ├── api-spec/           # OpenAPI specification
│   ├── api-zod/            # Generated Zod types
│   └── api-client-react/   # Generated typed API client
├── tests/e2e/              # Playwright tests
└── docs/                   # Documentation
```

## Development Workflow

### Adding a new feature

1. Create a feature branch from `main`.
2. Make changes to the schema (if needed) in `lib/db/src/schema/`.
3. Generate a migration: `cd lib/db && npx drizzle-kit generate`
4. Implement the API route in `artifacts/api-server/src/routes/`.
5. Update the OpenAPI spec in `lib/api-spec/openapi.yaml`.
6. Regenerate API types: `cd lib/api-spec && npx orval`
7. Build the frontend component in `artifacts/focusarx/src/`.
8. Add tests.
9. Open a pull request.

### Adding a new database table

1. Define the table in `lib/db/src/schema/` (follow existing patterns).
2. Add it to `lib/db/src/schema/index.ts` exports.
3. Generate migration: `cd lib/db && npx drizzle-kit generate`
4. Push to dev DB: `pnpm run db:push`
5. Add appropriate indexes for query patterns.

### Changing an API endpoint

1. Update the route handler in `artifacts/api-server/src/routes/`.
2. Update the OpenAPI spec.
3. Regenerate types: `cd lib/api-spec && npx orval`
4. Update frontend consumers.
5. Add/update tests.

## Testing

```bash
pnpm run typecheck    # TypeScript across all workspaces
pnpm run test         # Unit + integration tests (vitest)
pnpm run build        # Production builds
```

### Test requirements for PRs

- Unit tests for new utility functions and business logic.
- Integration tests for API endpoints (auth, authorization, idempotency).
- Tests for deployment skew protection (see `middlewares/deploymentSkew.test.ts`).
- Tests for the recommendation engine (see `lib/recommendationEngine.test.ts`).
- Migration validation runs automatically in CI.

## Database Commands

| Command | Description |
|---------|-------------|
| `pnpm run db:push` | Push schema to local dev database |
| `node lib/db/scripts/seed.mjs` | Seed development data |
| `node lib/db/scripts/seed.mjs --clear` | Clear seeded data |
| `node lib/db/scripts/validate-migrations.mjs` | Check migration safety |
| `node lib/db/scripts/validate-migrations.mjs --strict` | Fail on any destructive SQL |

## Deployment Skew Protection

Every API request carries an `X-FocusArx-Deployment` header. The server detects
version mismatches and blocks mutations to prevent data corruption during
rolling deployments. See `artifacts/api-server/src/middlewares/deploymentSkew.ts`.

## Environment Variables

See [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) for the complete reference.
Required: `DATABASE_URL`, `AUTH_SECRET` (32+ chars).
Optional: `GROQ_API_KEY`, `GEMINI_API_KEY`, Google OAuth, Resend email, etc.

## Security

- Never commit secrets, API keys, or tokens.
- Use parameterized queries (Drizzle handles this automatically).
- Validate all inputs with Zod schemas.
- Never expose internal error details in production.
- See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## Code Style

- TypeScript strict mode across all workspaces.
- Descriptive names, JSDoc comments on public APIs.
- Small, focused functions with clear error handling.
- Use the existing patterns — don't introduce new frameworks without discussion.
