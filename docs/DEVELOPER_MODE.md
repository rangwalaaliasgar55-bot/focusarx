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

### SQL Editor (Database Console)
Professional SQL editor with full database management capabilities:

**Schema Explorer Sidebar**
- Searchable list of all database tables with approximate row counts
- Expandable table detail showing columns (name, type, nullable, PK/FK)
- Index listing per table
- Foreign key relationship visualization
- Constraint details (primary keys, unique, check)

**SQL Execution**
- CSS-based syntax highlighting (keywords, strings, numbers, comments)
- Line numbers with scroll sync
- Permission level indicator (READ / WRITE / SCHEMA / DESTRUCTIVE)
- Keyboard shortcut: Ctrl+Enter to execute, Tab to indent
- Multi-statement support (up to 10 per run)
- Server-side query timeout (15 seconds)
- Result limit (500 rows max) prevents browser crashes

**Permission Levels**
- **READ** (green): SELECT, EXPLAIN — always allowed
- **WRITE** (yellow): INSERT, UPDATE, DELETE — requires write-mode unlock
- **SCHEMA** (amber): CREATE, ALTER — requires write-mode unlock
- **DESTRUCTIVE** (red): DROP, TRUNCATE, DELETE/UPDATE without WHERE — requires explicit confirmation

**Results**
- Paginated result tables (50 rows per page)
- Copy results to clipboard
- Export as CSV
- Execution time and row count display
- NULL value highlighting
- Error messages with PostgreSQL details

**Query History**
- Recent 50 queries from audit log
- Rerun previous queries
- Status indicators (success/error/blocked)
- Query type and affected row count

### Database Health
Real-time database monitoring dashboard:

**Connection Status**
- Connected/disconnected indicator
- Query latency (color-coded: green <50ms, yellow <200ms, red >200ms)
- PostgreSQL version
- Database name and user

**Metrics**
- Database size (human-readable)
- Table count
- Index count
- Auto-refresh every 30 seconds

**Migration Status**
- Lists all Drizzle migrations from journal
- Applied vs pending status
- Migration timestamps

**Schema Drift Detection**
- Compares actual database tables against application schema
- Reports missing tables (expected but not in DB)
- Reports extra tables (in DB but not in application)
- Sync status indicator (IN SYNC / DRIFT DETECTED)
- Recommendation for resolution (e.g., "Run `pnpm db:push`")

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
- SQL Editor write operations require the adminSql unlock mechanism (15-minute window)
- Destructive SQL queries require explicit confirmation
- Server-side query timeouts prevent runaway queries
- Row limits prevent browser crashes
- All SQL operations logged to `admin_sql_log` (immutable audit trail)
- Database connection strings never exposed in responses
- Table name validation prevents SQL injection in introspection endpoints

## API Endpoints

### Core Developer Mode
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

### SQL Editor & Database Intelligence
| Method | Path | Description |
|---|---|---|
| GET | `/api/developer/db/health` | Database health (version, size, latency) |
| GET | `/api/developer/db/schema` | Full schema introspection (tables, columns, indexes, FKs) |
| GET | `/api/developer/db/schema/:table` | Table detail (columns, types, PK/FK, indexes, constraints) |
| POST | `/api/developer/db/execute` | Execute SQL (with permission levels and safety checks) |
| GET | `/api/developer/db/history` | Query history (paginated) |
| GET | `/api/developer/db/migrations` | Migration listing and status |
| GET | `/api/developer/db/diff` | Schema drift detection |
| POST | `/api/developer/db/export` | Export table data (JSON/CSV) |
| GET | `/api/developer/db/tables/:table/sample` | Sample table data (up to 100 rows) |
