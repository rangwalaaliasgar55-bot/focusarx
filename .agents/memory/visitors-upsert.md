---
name: Visitors upsert race condition
description: siteAnalytics.ts had a check-then-insert pattern that caused duplicate key errors under concurrent requests
---

**Problem:** The `/api/track` endpoint in `siteAnalytics.ts` used a check-then-insert pattern:
1. `SELECT * FROM visitors WHERE visitor_id = $1`
2. If not found: `INSERT INTO visitors ...`
3. If found: `UPDATE visitors ...`

Under concurrent requests (two tabs or rapid navigation), both reads return "not found" simultaneously, then both try to INSERT → duplicate key error on `visitors_visitor_id_idx`.

**Fix:** Replace the two-step pattern with a single atomic upsert:
```ts
await db.insert(visitorsTable).values({...}).onConflictDoUpdate({
  target: visitorsTable.visitorId,
  set: { lastSeen: now, deviceType, browser, os, ...country ? { country } : {} },
});
```

**Why:** INSERT ... ON CONFLICT DO UPDATE is atomic at the DB level; no race condition possible.
