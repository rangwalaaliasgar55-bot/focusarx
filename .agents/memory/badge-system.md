---
name: Badge system
description: 65+ achievement badges across 8 categories — how they're defined and computed
---

## Structure
All badge definitions live in `artifacts/api-server/src/routes/gamification.ts` as `BADGE_DEFS` array (type `BadgeDef[]`).

## 8 Categories
time, streak, sessions, quality, special, tasks, social, milestones

## 4 Tiers
bronze, silver, gold, legendary

## Computation
`computeUserStats(userId)` queries DB and returns a flat stats object. `GET /api/gamification/badges` calls this, compares progress vs threshold for each badge, auto-inserts newly unlocked badges, and returns all badges with progress percentages.

## stat units used for threshold matching
totalMinutes, sessions, streak, maxScore, perfectSessions, maxSessionMinutes, maxDayMinutes, nightSessions, earlySessions, weekendSessions, lunchSessions, totalTasks, level, totalXp, totalCoins

## Frontend
- Full page at `/achievements` — has category pills, tier filter, locked/unlocked filter
- Newly unlocked badges appear with "NEW" badge and a celebration banner

**Why:** 65+ badges (vs previous 20) gives long-tail progression — players always have something close to unlock.

**How to apply:** To add new badges, add a new `BadgeDef` to `BADGE_DEFS` array with the correct `unit` matching a key in the statMap inside `computeUserStats`.
