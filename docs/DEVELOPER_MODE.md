# Developer Mode

## Overview

Developer Mode is an admin-only control panel accessible at `/developer`. It provides deep insight into the application's state, user data, and system health. It is gated by admin authorization — only users with `role=admin` or a valid admin session cookie can access it.

## Access

1. **Admin role**: Log in as a user with `role=admin` in the database
2. **Admin password**: Use `/admin` to authenticate with `ADMIN_PASSWORD`
3. Navigate to `/developer`

## Sections

### System Overview
- Total users (guests, admins, onboarded)
- Session statistics (total, today, this week, average duration)
- Economy overview (total coins, total XP, average level)
- Streak statistics (average, max)
- Task/goal completion rates
- Premium subscription counts
- Recent signups
- Deployment version and environment

### User Management
- Search users by email or name
- Paginated user list with wallet data
- Deep user view:
  - Profile info, role, guest status
  - Wallet balance (coins, XP, level)
  - Streak data
  - Recent sessions (last 10)
  - Session stats (total, minutes, average focus)
  - Task/goal stats
  - Premium status
- User actions:
  - Grant coins (positive or negative)
  - Grant XP
  - Grant premium (1-3650 days)
  - Reset streak
  - Set role (user/admin/bot)
  - Send notification
  - Delete user (non-admin only)

### Feature Flags
- List all feature flags
- Toggle enabled/disabled
- Adjust rollout percentage (0-100%)

### AI Budget Monitor
- Today's AI budget by provider (Gemini, Groq)
- Calls used vs cap
- Recent AI call statistics (by provider, model, purpose)
- Average latency
- Token usage

### Economy Overview
- Total coins and XP in circulation
- Average and maximum values
- Users with wallets count
- Top 10 by coins
- Top 10 by XP

### System Health
- Database connection status and latency
- Table count
- New users (last 24 hours)
- Deployment version
- Environment info

## Security

- All endpoints require admin authorization via `authMiddleware` + `requireAdmin`
- No secrets, API keys, or passwords are exposed
- User passwords/hashed passwords are never shown
- Destructive actions (user deletion) check for admin targets
- All admin actions are logged to `audit_logs`

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/developer/overview` | System overview |
| GET | `/api/developer/users` | Search users |
| GET | `/api/developer/users/:id/details` | User deep view |
| POST | `/api/developer/users/grant-coins` | Grant coins |
| POST | `/api/developer/users/grant-xp` | Grant XP |
| POST | `/api/developer/users/grant-premium` | Grant premium |
| POST | `/api/developer/users/reset-streak` | Reset streak |
| POST | `/api/developer/users/set-role` | Set user role |
| POST | `/api/developer/users/:id/notify` | Send notification |
| DELETE | `/api/developer/users/:id` | Delete user |
| GET | `/api/developer/flags` | List feature flags |
| PATCH | `/api/developer/flags/:id` | Update flag |
| GET | `/api/developer/ai-budget` | AI budget monitor |
| GET | `/api/developer/economy` | Economy overview |
| GET | `/api/developer/health` | System health |
