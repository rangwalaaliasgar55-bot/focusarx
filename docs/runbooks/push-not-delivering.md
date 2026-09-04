# Runbook — push not delivering

Push stack: VAPID (`VAPID_PUBLIC_KEY/PRIVATE_KEY/EMAIL`) → `push_subscriptions`
→ `pushSender` → Supabase cron + `pg_net` (server-scheduled) or API-triggered.

1. Confirm scope:
   - `GET /api/push/status` (authed): subscribed? `priorityEnabled`?
   - Server logs: `pushSender` errors; VAPID pair rotation warnings
     ("subscriptions stop working on the next cold start" = keys changed —
     regenerate ONE stable pair and keep it).
2. Common causes:
   - Subscription created for one VAPID key, server restarted with another.
   - In-app WebViews (Instagram/TikTok): push unsupported — expected; the
     `InAppBrowserPill` covers guidance. Do not "fix" per-user.
   - 410/404 from the push service → delete the dead subscription row
     (endpoint gone); client re-subscribes on next visit.
   - Cron (`/api/retention/reengage/run`) 503 → `CRON_SECRET` unset.
3. Verify end-to-end:
   - Send a test push to your own subscription; check service-worker
     `push` handler fires and the notification shows with sound per
     subscription prefs.
4. Follow-up: expiring-subscription sweeper is tracked in `REMAINING.md`.
