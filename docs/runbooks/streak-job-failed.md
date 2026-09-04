# Runbook — streaks look wrong (job/eval failure)

There is no nightly streak cron by design: streaks advance transactionally on
`POST /api/sessions` (`applyStreakProgress`, `FOR UPDATE`) and expired
sessions finalize lazily on next read (`finalizeExpiredSession`). So "streak
job failed" almost always means day-key or clock trouble, not a missed cron.

1. Confirm scope:
   - Compare `study_streaks.last_study_date` vs the user's `users.timezone`
     and `dayKeyInZone(now, zone)` (`lib/timezone.ts`). Legacy rows with
     unset zones intentionally use IST (`Asia/Kolkata`).
   - Check for zone flips: profile `timezone` updated recently (travel) —
     `legacyYesterday` continuity should have held; verify the completion
     carried the device `timezone` field.
2. Common causes:
   - Client clock wrong → `completedAt`/deadline skew (server clamps rewards
     via wall-clock, streak still advances — by design).
   - Double completion same day → `changed:false`, no increment (correct).
   - IST-vs-local confusion for pre-migration rows (see `AUDIT.md` §5).
3. Repair (never silently reset):
   - Recompute from `focus_sessions.completedAt` in the user's zone; take
     `MAX(stored, recomputed)`; write the delta reason to the release notes.
   - There is no `streak_history` table yet (tracked in `REMAINING.md`) —
     until then, log repairs in the admin moderation log.
4. Follow-up: add the missing-day regression fixture to `timezone.test.ts`.
