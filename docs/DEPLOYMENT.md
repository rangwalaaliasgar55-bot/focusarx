# FocusArx Deployment Guide

## Production Deployment (Vercel)

### Prerequisites
- Vercel account
- Neon PostgreSQL database
- Domain (optional)

### Environment Variables

Set these in Vercel project settings:

**Required:**
```
DATABASE_URL=postgresql://...
AUTH_SECRET=<32+ character random string>
APP_URL=https://your-domain.com
ADMIN_PASSWORD=<secure password, 8+ chars>
```

**Optional:**
```
GOOGLE_CLIENT_ID=...        # Google OAuth
GOOGLE_CLIENT_SECRET=...    # Google OAuth
RESEND_API_KEY=re_...       # Email delivery
GROQ_API_KEY=gsk_...        # AI coach features
GEMINI_API_KEY=...          # AI roadmap generation
VAPID_PUBLIC_KEY=...        # Web push
VAPID_PRIVATE_KEY=...       # Web push
UPSTASH_REDIS_REST_URL=...  # Shared rate limiting
UPSTASH_REDIS_REST_TOKEN=...
CORS_ALLOWED_ORIGINS=...    # Additional CORS origins
```

### Build Command

```bash
pnpm run build:vercel
```

This runs:
1. `pnpm --filter @workspace/db run push:vercel` — push schema to Neon
2. `pnpm --filter @workspace/api-server run build` — build API
3. `pnpm --filter @workspace/focusarx run build:vercel` — build frontend

### Vercel Configuration

See `vercel.json` for routing rules:
- `/api/*` → API serverless function
- `/socket.io/*` → API serverless function (WebSocket)
- All other routes → static frontend (SPA fallback)

## Local Development

```bash
# 1. Install dependencies
pnpm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL and AUTH_SECRET

# 3. Push database schema
pnpm db:push

# 4. Start development servers
pnpm dev
```

This starts:
- Frontend: http://localhost:5173 (Vite)
- API: http://localhost:8080 (Express)

The Vite dev server proxies `/api` and `/socket.io` to the Express server.

## Database Migration

### Push (Development)
```bash
pnpm db:push
```

### Push (Vercel/Production)
```bash
pnpm --filter @workspace/db run push:vercel
```

### Verify Schema
```bash
psql "$DATABASE_URL" -f database/verify.sql
```

## Health Checks

- `GET /api/health` — basic health check
- `GET /api/deployment` — version info
- `GET /api/db-health` — database connection check (admin only)

## Monitoring

- Pino structured logging (JSON format in production)
- Request IDs on all responses (`X-Request-Id`)
- Deployment version headers (`X-FocusArx-Deployment`)
- Client-side deployment skew detection
