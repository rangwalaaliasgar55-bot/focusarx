---
name: Missions system
description: Daily/weekly missions engine — how missions are defined, tracked, and claimed
---

## Structure
- All mission definitions live in `artifacts/api-server/src/routes/missions.ts` as `DAILY_MISSIONS` / `WEEKLY_MISSIONS` / `ALL_MISSIONS` arrays
- Progress tracked in `user_mission_progress` table (key: userId + missionKey + periodStart)
- `periodStart` = today's date for daily, Monday's date for weekly

## Key exported function
`updateMissionProgress(userId, unit, value, opts?)` — called from sessions.ts (after each focus session) and tasks.ts (after task completion). Units: `sessions | minutes | tasks | score | days`.

## API routes
- `GET /api/missions` — returns daily/weekly missions with current progress for auth user
- `POST /api/missions/:key/claim` — awards XP + coins to wallet, marks rewardClaimed = true

## Frontend
- Full page at `/missions` (artifacts/focusarx/src/pages/missions.tsx)
- Sidebar widget at `artifacts/focusarx/src/components/MissionsWidget.tsx` — embedded in SidePanel (App.tsx)
- AppShell nav badge shows count of claimable missions

**Why:** Daily/weekly missions drive retention loops and increase DAU — users return to claim rewards.

**How to apply:** Any new action that should advance missions must call `updateMissionProgress(userId, unit, value)` with the correct unit. To add new mission types, add to `DAILY_MISSIONS` or `WEEKLY_MISSIONS` arrays.
