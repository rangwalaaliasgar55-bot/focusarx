# Runbook — AI cost spike

Trigger: `ai_budget_state.calls_used` near cap, Groq/Gemini 429s, or a cost alert.

1. Confirm scope (5 min):
   - `GET /admin/gemini/status` (auth + admin) → `used/cap`, `coolUntil`.
   - Logs: `[aiBudget]`, `gemini budget exhausted`, `prompt injection detected`.
2. Stop the bleed without downtime:
   - App degrades to `builtinReply`/template roadmaps automatically when
     budgets exhaust — verify fallback rate, not errors.
   - Tighten caps now (no deploy): `GROQ_DAILY_CAP` / `GEMINI_DAILY_CAP` env
     → redeploy API only.
3. Find the abuser:
   - `userPurposeCalls` heavy hitters in `ai_budget`/ledger tables by
     `userId` + `purpose`; check `checkIpLimit` rejections rising (rotating IPs).
   - If one purpose (e.g. `roadmap`) dominates, lower its per-user quota in
     `routes/ai.ts` / `routes/coach.ts` temporarily.
4. Recover:
   - `cool_until` passes automatically; to force: reset the day row in
     `ai_budget_state` (admin SQL console, logged).
5. Follow-up: adjust caps, add purpose-level alert, note in CHANGELOG.
