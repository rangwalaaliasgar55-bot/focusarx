# FocusArx API Documentation

## Base URL

```
Development: http://localhost:8080/api
Production:  https://<your-domain>/api
```

## Authentication

All protected endpoints require a valid JWT. The token is sent via:
1. **httpOnly cookie** (`access_token`) — preferred
2. **Authorization header** (`Bearer <token>`) — fallback

### Error Response Format

All errors follow a consistent envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request is invalid",
    "requestId": "req_abc123"
  }
}
```

## Endpoints

### Health & System

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | No | Health check |
| GET | `/deployment` | No | Deployment version info |
| GET | `/db-health` | Admin | Database health check |

### Authentication

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | No | Register new user |
| POST | `/auth/login` | No | Login with email/password |
| POST | `/auth/logout` | No | Logout (clears cookies) |
| POST | `/auth/refresh` | No | Refresh access token |
| POST | `/auth/forgot-password` | No | Request password reset |
| POST | `/auth/reset-password` | No | Reset password with token |
| GET | `/auth/me` | Yes | Get current user |
| POST | `/auth/guest` | No | Create guest session |
| DELETE | `/auth/account` | Yes | Delete account |

### Sessions

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/sessions/active` | Yes | Get current active session |
| POST | `/sessions/active` | Yes | Create active session |
| PUT | `/sessions/active/:id` | Yes | Sync active session state |
| DELETE | `/sessions/active/:id` | Yes | Cancel active session |
| POST | `/sessions` | Yes | Complete a focus session |
| GET | `/sessions` | Yes | List completed sessions |

### Tasks

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/tasks` | Yes | List tasks |
| POST | `/tasks` | Yes | Create task |
| PATCH | `/tasks/:id` | Yes | Update task |
| DELETE | `/tasks/:id` | Yes | Delete task |
| GET | `/tasks/stats` | Yes | Task statistics |
| GET | `/tasks/missed-review` | Yes | Tasks needing daily review |
| POST | `/tasks/missed-review` | Yes | Process missed task action |

### Goals

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/goals` | Yes | List goals |
| POST | `/goals` | Yes | Create goal |
| PATCH | `/goals/:id/complete` | Yes | Toggle goal completion |
| DELETE | `/goals/:id` | Yes | Delete goal |

### Stats & Analytics

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/stats` | Yes | Dashboard stats |
| GET | `/stats/streak` | Yes | Current streak |
| GET | `/stats/community` | Yes | Community stats |
| GET | `/stats/onboarding` | Yes | Onboarding progress |
| GET | `/stats/productivity` | Yes | Productivity metrics |
| GET | `/analytics` | Yes | Full analytics data |
| GET | `/streak` | Yes | Streak data (alias) |

### Gamification

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/gamification` | Yes | User gamification data |
| GET | `/missions` | Yes | Active missions |
| POST | `/missions/:key/claim` | Yes | Claim mission reward |
| GET | `/quests` | Yes | Active quests |
| POST | `/quests/:id/claim` | Yes | Claim quest reward |
| GET | `/leaderboard` | Yes | Global leaderboard |
| GET | `/achievements` | Yes | User achievements |
| GET | `/battle-pass` | Yes | Battle pass progress |
| POST | `/battle-pass/claim/:tier` | Yes | Claim battle pass tier |
| POST | `/daily-reward/claim` | Yes | Claim daily login reward |

### Social

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/social/feed` | Yes | Social feed |
| POST | `/social/posts` | Yes | Create post |
| DELETE | `/social/posts/:id` | Yes | Delete own post |
| POST | `/social/posts/:id/react` | Yes | React to post |
| POST | `/social/posts/:id/comment` | Yes | Comment on post |
| POST | `/social/posts/:id/save` | Yes | Save post |
| GET | `/social/friends` | Yes | Friends list |
| POST | `/social/friends/request` | Yes | Send friend request |
| GET | `/notifications` | Yes | User notifications |
| POST | `/notifications/:id/read` | Yes | Mark notification read |

### Groups & Rooms

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/groups` | Yes | List groups |
| POST | `/groups` | Yes | Create group |
| GET | `/study-rooms` | Yes | List study rooms |
| POST | `/study-rooms` | Yes | Create study room |

### Messaging

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/dm/conversations` | Yes | List conversations |
| POST | `/dm/conversations` | Yes | Create conversation |
| GET | `/dm/conversations/:id/messages` | Yes | Get messages |
| POST | `/dm/conversations/:id/messages` | Yes | Send message |

### Premium & Economy

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/premium/status` | Yes | Check premium status |
| POST | `/premium/activate` | Yes | Activate premium with coins |
| GET | `/wallet` | Yes | Wallet balance |
| GET | `/shop` | Yes | Shop items |
| POST | `/shop/purchase/:id` | Yes | Purchase item |
| GET | `/marketplace` | Yes | Marketplace listings |
| POST | `/marketplace` | Yes | List item for sale |
| GET | `/lootboxes` | Yes | User loot boxes |
| POST | `/lootboxes/:id/open` | Yes | Open loot box |
| GET | `/pets` | Yes | User pets |
| GET | `/city` | Yes | User city data |

### AI Features

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/ai/arx` | Yes | Chat with Arx coach |
| POST | `/ai/roadmap` | Yes | Generate study roadmap |
| POST | `/ai/flashcards` | Yes | Generate flashcards |
| GET | `/ai-insights` | Yes | AI-generated insights |

### Developer Mode (Admin Only)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/developer/overview` | Admin | System overview |
| GET | `/developer/users` | Admin | Search users |
| GET | `/developer/users/:id/details` | Admin | User deep view |
| POST | `/developer/users/grant-coins` | Admin | Grant coins |
| POST | `/developer/users/grant-xp` | Admin | Grant XP |
| POST | `/developer/users/grant-premium` | Admin | Grant premium |
| POST | `/developer/users/set-role` | Admin | Set user role |
| DELETE | `/developer/users/:id` | Admin | Delete user |
| GET | `/developer/flags` | Admin | Feature flags |
| PATCH | `/developer/flags/:id` | Admin | Update flag |
| GET | `/developer/ai-budget` | Admin | AI usage monitor |
| GET | `/developer/economy` | Admin | Economy overview |
| GET | `/developer/health` | Admin | System health |

### Admin (Admin Only)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/admin/auth` | No | Admin login |
| DELETE | `/admin/auth` | No | Admin logout |
| GET | `/admin/users` | Admin | User list |
| POST | `/admin/sql/query` | Admin | SQL console query |
| POST | `/admin/sql/unlock` | Admin | Unlock write mode |
| GET | `/admin/cms/site-settings` | Admin | Get site settings |
| PUT | `/admin/cms/site-settings` | Admin | Update site settings |
| GET | `/admin/moderation/queue` | Admin | Moderation queue |

## Rate Limits

| Endpoint Category | Limit | Window |
|---|---|---|
| General API | 100 requests | 15 minutes |
| Auth (login/register) | 10 requests | 15 minutes |
| Session complete | 10 requests | 1 minute |
| Admin SQL | 20 queries | 1 minute |
| AI endpoints | 30 requests | 1 day (per user) |
