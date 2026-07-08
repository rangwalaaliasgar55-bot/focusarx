---
name: Enterprise V10 schema additions
description: New DB tables added during enterprise transformation
---

## New tables (pushed to DB)
- `missions` — static mission definitions (if ever needed server-side; mostly defined in code)
- `user_mission_progress` — (userId, missionKey, periodStart, currentValue, completed, rewardClaimed, completedAt)
- `friendships` — (requesterId, addresseeId, status, createdAt)
- `productivity_logs` — (userId, date, focusMinutes, sessionsCompleted, avgFocusScore, productivityScore)

## Enhanced existing columns
- `tasks` table: category, priority (low/medium/high/urgent), tags (text[]), dueDate, recurring, completedAt
- `users` table: bio, timezone, productivityScore
- `focus_sessions` table: category field

## Schema file
`lib/db/src/schema/focusarx.ts`

**How to apply:** After any schema change, run `pnpm --filter @workspace/db run push`. DB changes in dev are pushed immediately (no migration files). For prod, use the database skill to apply the same changes.
