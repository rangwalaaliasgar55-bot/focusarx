---
name: Constellations page routing
description: The constellations.tsx page existed but was unrouted; correct sessions endpoint; how to add it back
---

The `/constellations` page plots focus sessions as stars on a polar coordinate SVG map. It existed as a file but had no route in App.tsx.

**Route added:** `<Route path="/constellations" component={...ProtectedRoute component={ConstellationsPage}...} />`
**Lazy import added:** `const ConstellationsPage = lazy(() => import("@/pages/constellations"))`
**Nav added:** AppShell MORE_NAV and CommandPalette both have `/constellations` entries.

**API endpoint fix:** The page was calling `/api/stats/sessions-history?limit=200` which does NOT exist. The correct endpoint is `/api/sessions/history?limit=200` (in routes/sessions.ts). The fallback is `/api/sessions?limit=200`.

**Why:** The page was likely written before the endpoint was renamed and the route was never wired into the router.
