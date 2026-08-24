# 404/500 sweep — route drift + missing `stats` contract

Found by booting a real Postgres 18 (`@embedded-postgres/linux-x64` from npm;
`apt` has no network here), running `pnpm db:push`, then probing **every**
`/api/...` path the frontend calls (196 method+path pairs extracted from
`artifacts/focusarx/src`) against the live API.

## The profile-tab crash (headline bug)

`GET /api/gamification/badges` returned `{ badges }` only. `pages/profile.tsx`
did `const stats = data.badgeData.stats` and then `stats.totalMinutes` in the
four stat cards → `TypeError: Cannot read properties of undefined` → caught by
`ErrorBoundary` → "This view hit a snag". **That is what "profile tab is not
opening" was.** The handler already computed the stats internally and dropped
them.

Fix: return a full `stats` object (totalMinutes, sessions, streak,
longestStreak, maxScore, perfectSessions, maxSessionMinutes, maxDayMinutes,
nightSessions, earlySessions, completedTasks), and make `profile.tsx` default
to `EMPTY_USER_STATS` + `.catch()` per sub-query so one bad endpoint can never
blank the page again.

Gotcha: drizzle does **not** emit a column alias for `sql` fragments inside a
derived table, so `db.select({...}).from(subquery.as("x"))` produced
`column x.minutes does not exist`. The per-day peak is now a scalar sub-select
written in raw SQL with an explicit `as minutes`.

## Dashboard

`StreakFreezeCard` + `StreakNudge` call `GET /api/stats/streak`; the backend
only had `GET /api/streak`. Both 404'd, and because the card early-returns on
`!streak`, the widget **silently never rendered** — no console error. Both
paths now serve one handler.

## Other route drift fixed

| Endpoint | Was | Fix |
| --- | --- | --- |
| `POST /api/social/requests` | 404 | plural alias + accepts `toUserId` (was `targetId` only) |
| `POST /api/social/requests/:id/accept` / `reject` | 404 | plural + `POST` aliases (backend was singular + `PATCH`) |
| `DELETE /api/social/requests/:id` | 404 | plural alias |
| `POST /api/mood` | 404 | new route in `readiness.ts`; maps mood→`energy` on `readiness_logs` |
| `GET /api/sessions` | 404 | alias of `/sessions/history` (constellations fallback) |
| `DELETE /api/push/subscribe` (no body) | 500 | see below |
| `PATCH|PUT /api/tasks/:id` (empty body) | 500 | 400 "No fields to update" instead of drizzle "No values to set" |

## Systemic: bodyless requests

Express 5 leaves `req.body` **`undefined`** when there is no body; 38 handlers
do `const { x } = req.body as ...` and throw a TypeError → opaque 500. Rather
than touching 38 call sites, `app.ts` normalises `req.body` to `{}` right after
the body parsers.

## Regression guard

`artifacts/api-server/src/routes/routeContract.test.ts` statically cross-checks
every frontend `/api` call against every registered backend route. It would
have caught all 7 route-missing bugs above at once. Verified it fails when the
`/stats/streak` alias is removed and passes when restored. Dynamic frontend
segments (`${action}` from a union) wildcard-match a literal backend segment;
segment count and literal segments must still line up.

## Notes

- `/api/track` 400s and `/api/admin/*` 401/403s are **by design** (zod schema /
  auth), not bugs.
- `POST /api/analytics` appears only inside a comment in `lib/analytics.ts`.
- Session `durationSec` is server-verified from `active_sessions` by design
  (anti-cheat), so posting a raw `durationSec` stores 0.
- `/api/stats` shape already matched `DashboardStats` — the dashboard problems
  were the missing streak route, not `/api/stats`.
