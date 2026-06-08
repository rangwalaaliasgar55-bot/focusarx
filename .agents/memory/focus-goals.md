---
name: Focus Goals
description: Long-form user goals (not tasks/habits) with create/complete/delete and dashboard widget.
---

- Schema: `goalsTable` was already in `lib/db/src/schema/focusarx.ts` (lines ~105-114); already pushed to DB
- API: `artifacts/api-server/src/routes/goals.ts` — `goalsRouter` registered in `routes/index.ts`
  - GET /api/goals — list user goals ordered newest first
  - POST /api/goals — create with title + optional description
  - PATCH /api/goals/:id/complete — toggle completed true/false
  - DELETE /api/goals/:id — delete
- Frontend page: `artifacts/focusarx/src/pages/goals.tsx`; lazy-loaded at `/goals`
- Dashboard widget: `GoalsWidget()` in dashboard.tsx — shows active goals list + progress bar; only renders if user has goals
- AppShell nav: Flag icon, shortcut "g", "core" group

**Why:** goalsTable was unused in the schema; needed a dedicated CRUD page + dashboard integration.
